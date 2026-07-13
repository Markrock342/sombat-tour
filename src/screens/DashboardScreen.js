import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import Card from '../components/Card';
import TechnicianBar from '../components/TechnicianBar';
import LoadingView from '../components/LoadingView';
import DateRangePicker, { presetRange } from '../components/DateRangePicker';
import BreakdownSummaryCard from '../components/BreakdownSummaryCard';
import { colors, spacing } from '../theme';
import {
  fetchTechnicians,
  fetchRepairs,
  fetchBoard,
  fetchLocations,
  fmtDate,
  fmtThaiDate,
  isOpenRepair,
} from '../data/api';
import { useAuth } from '../auth/AuthContext';
import { useScreenLayout } from '../components/BackNavigation';

export default function DashboardScreen({ navigation }) {
  const { user, logout, canWrite, canSeePartsPrice } = useAuth();
  const { isMobile, isWide, pad, heroTitleSize } = useScreenLayout();
  const [dateRange, setDateRange] = useState(() => presetRange('today'));
  const [datePreset, setDatePreset] = useState('today');
  const [techs, setTechs] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [boardPreview, setBoardPreview] = useState([]);
  const [locationPreview, setLocationPreview] = useState([]);
  const [meta, setMeta] = useState({ date: null, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const lastDeviceDay = useRef(fmtDate(new Date()));

  const dateStart = fmtDate(dateRange.start);
  const dateEnd = fmtDate(dateRange.end);

  const load = useCallback(async (opts = {}) => {
    if (opts.soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rep = await fetchRepairs(dateRange.start, dateRange.end);
      const rows = rep.rows || [];

      let techRows = [];
      try {
        techRows = await fetchTechnicians();
      } catch (_) {
        techRows = null;
      }
      if (!techRows || !techRows.length) {
        const names = [...new Set(rows.map((r) => r.r_technician).filter(Boolean))];
        techRows = names.map((n, i) => ({ id: String(i + 1), name: n }));
      }

      setRepairs(rows);
      setTechs(techRows);
      setMeta({ date: rep.date, total: rep.total ?? rows.length });

      try {
        const notes = await fetchBoard();
        setBoardPreview((notes || []).slice(0, 3));
      } catch (_) {
        setBoardPreview([]);
      }

      try {
        const spots = await fetchLocations();
        setLocationPreview((spots || []).slice(0, 3));
      } catch (_) {
        setLocationPreview([]);
      }
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const today = fmtDate(new Date());
      if (today !== lastDeviceDay.current) {
        lastDeviceDay.current = today;
        setDateRange(presetRange('today'));
        setDatePreset('today');
      } else {
        load({ soft: true });
      }
    }, [load])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const today = fmtDate(new Date());
        if (today !== lastDeviceDay.current) {
          lastDeviceDay.current = today;
          setDateRange(presetRange('today'));
          setDatePreset('today');
        } else {
          load({ soft: true });
        }
      }
    });
    return () => sub.remove();
  }, [load]);

  const countByKey = {};
  repairs.forEach((r) => {
    const key = r.r_technician_id
      ? `id:${r.r_technician_id}`
      : r.r_technician?.trim()
        ? `name:${r.r_technician.trim()}`
        : 'none';
    countByNameOrId(countByKey, key, r);
  });

  function countByNameOrId(map, key) {
    map[key] = (map[key] || 0) + 1;
  }

  const routine = [
    ...techs.map((t) => {
      const byId = countByKey[`id:${t.id}`] || 0;
      const byName = countByKey[`name:${t.name}`] || 0;
      // repairs keyed by id OR by name (mutually exclusive per row)
      const today = byId + byName;
      return { id: t.id, name: t.name, today, queryName: t.name };
    }),
    ...Object.entries(countByKey)
      .filter(([key]) => {
        if (key === 'none') return true;
        if (key.startsWith('id:')) {
          const id = key.slice(3);
          return !techs.some((t) => String(t.id) === String(id));
        }
        const name = key.slice(5);
        return !techs.some((t) => t.name === name);
      })
      .map(([key, count], i) => {
        if (key === 'none') {
          return { id: `routine-none-${i}`, name: 'ไม่ระบุช่าง', today: count, queryName: '' };
        }
        const name = key.startsWith('name:') ? key.slice(5) : key;
        return { id: `routine-${i}`, name, today: count, queryName: name };
      }),
  ].sort((a, b) => b.today - a.today);

  // dedupe names that appear twice (id + orphan name)
  const seenNames = new Set();
  const routineDedup = [];
  for (const t of routine) {
    const k = t.name;
    if (seenNames.has(k)) {
      const existing = routineDedup.find((x) => x.name === k);
      if (existing) existing.today = Math.max(existing.today, t.today);
      continue;
    }
    seenNames.add(k);
    routineDedup.push(t);
  }

  const routineMax = Math.max(...routineDedup.map((t) => t.today), 1);
  const total = meta.total || repairs.length;
  const active = routineDedup.filter((t) => t.today > 0).length;

  const openRepairs = repairs.filter(isOpenRepair);
  const pendingByKey = {};
  openRepairs.forEach((r) => {
    const key = r.r_technician_id
      ? `id:${r.r_technician_id}`
      : r.r_technician?.trim()
        ? `name:${r.r_technician.trim()}`
        : 'none';
    pendingByKey[key] = (pendingByKey[key] || 0) + 1;
  });

  const pendingListRaw = [
    ...techs.map((t) => {
      const byId = pendingByKey[`id:${t.id}`] || 0;
      const byName = pendingByKey[`name:${t.name}`] || 0;
      return { id: t.id, name: t.name, pending: byId + byName, queryName: t.name };
    }),
    ...Object.entries(pendingByKey)
      .filter(([key]) => {
        if (key === 'none') return true;
        if (key.startsWith('id:')) {
          const id = key.slice(3);
          return !techs.some((t) => String(t.id) === String(id));
        }
        const name = key.slice(5);
        return !techs.some((t) => t.name === name);
      })
      .map(([key, count], i) => {
        if (key === 'none') {
          return { id: `pending-none-${i}`, name: 'ไม่ระบุช่าง', pending: count, queryName: '' };
        }
        const name = key.startsWith('name:') ? key.slice(5) : key;
        return { id: `pending-${i}`, name, pending: count, queryName: name };
      }),
  ].sort((a, b) => b.pending - a.pending);

  const pendingSeen = new Set();
  const pendingList = [];
  for (const t of pendingListRaw) {
    if (pendingSeen.has(t.name)) {
      const existing = pendingList.find((x) => x.name === t.name);
      if (existing) existing.pending = Math.max(existing.pending, t.pending);
      continue;
    }
    pendingSeen.add(t.name);
    pendingList.push(t);
  }
  const pendingMax = Math.max(...pendingList.map((t) => t.pending), 1);
  const pendingSum = pendingList.reduce((s, t) => s + t.pending, 0);

  const recentRepairs = [...repairs]
    .sort((a, b) => String(b.r_dt_rec || '').localeCompare(String(a.r_dt_rec || '')))
    .slice(0, 3);

  const recentVehicles = [];
  const seenPlates = new Set();
  for (const r of [...repairs].sort((a, b) => String(b.r_dt_rec || '').localeCompare(String(a.r_dt_rec || '')))) {
    const plate = String(r.r_v_plate || r.r_v_name || '').trim();
    if (!plate || seenPlates.has(plate)) continue;
    seenPlates.add(plate);
    recentVehicles.push({
      plate,
      name: r.r_v_name,
      brand: r.r_v_brand,
      lastJob: r.r_repair_list,
    });
    if (recentVehicles.length >= 3) break;
  }

  const openToday = repairs.filter(isOpenRepair).length;

  const openJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      technicianId: tech.id,
      date: dateStart,
      dateEnd,
      datePreset,
      mode: 'day',
    });

  const openPendingJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      technicianId: tech.id,
      date: dateStart,
      dateEnd,
      datePreset,
      mode: 'pending',
    });

  const refreshHome = () => {
    lastDeviceDay.current = fmtDate(new Date());
    setDateRange(presetRange('today'));
    setDatePreset('today');
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, isMobile && styles.headerMobile, { paddingHorizontal: pad }]}>
        <Pressable style={styles.headerLeft} onPress={refreshHome}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/sombatlogobg.png')} style={[styles.logo, isMobile && styles.logoMobile]} />
            <View style={styles.brandText}>
              <Text style={[styles.headerTitle, { fontSize: heroTitleSize }]}>สมบัติทัวร์</Text>
              {!isMobile ? (
                <Text style={styles.headerSub}>โปรแกรมงานซ่อมบำรุง</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
        <View style={[styles.headerActions, isMobile && styles.headerActionsMobile]}>
          {user ? (
            <Pressable style={[styles.searchBtn, isMobile && styles.searchBtnMobile]} onPress={logout}>
              <Text style={styles.searchBtnText} numberOfLines={1}>{user.username}</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.searchBtn, isMobile && styles.searchBtnMobile]} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.searchBtnText}>เข้าสู่ระบบ</Text>
            </Pressable>
          )}
          <Pressable style={[styles.searchBtn, isMobile && styles.searchBtnMobile]} onPress={() => navigation.navigate('Search')}>
            <Text style={styles.searchBtnText}>{isMobile ? '🔍' : '🔍 ค้นหา'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, isMobile && styles.scrollMobile]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load({ soft: true })} tintColor={colors.navy} />
        }
      >
        {loading ? (
          <LoadingView />
        ) : (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            <Card
              starred
              title="งานประจำวัน"
              style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
            >
              <DateRangePicker
                value={dateRange}
                presetKey={datePreset}
                onChange={(range, key) => {
                  setDateRange(range);
                  setDatePreset(key);
                }}
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>โหลดข้อมูลไม่สำเร็จ</Text>
                  <Text style={styles.errorMsg}>{error}</Text>
                  <Pressable style={styles.retryBtn} onPress={load}>
                    <Text style={styles.retryText}>ลองใหม่</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.summary}>
                      มีงาน <Text style={styles.summaryNum}>{active}</Text> ผู้ซ่อม · รวม{' '}
                      <Text style={styles.summaryNum}>{total}</Text> งาน
                    </Text>
                    <Pressable onPress={() => navigation.navigate('JobDetail', {
                      technician: '',
                      date: dateStart,
                      dateEnd,
                      datePreset,
                      mode: 'day',
                      viewAll: true,
                    })}>
                      <Text style={styles.viewAll}>ดูทั้งหมด</Text>
                    </Pressable>
                  </View>
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {routineDedup.map((tech) => (
                      <TechnicianBar
                        key={tech.id}
                        name={tech.name}
                        value={tech.today}
                        max={routineMax}
                        color={colors.barFill}
                        onPress={() => openJobs(tech)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </Card>

            <Card
              starred
              title="งานค้างซ่อม"
              style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
            >
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>โหลดข้อมูลไม่สำเร็จ</Text>
                  <Pressable style={styles.retryBtn} onPress={load}>
                    <Text style={styles.retryText}>ลองใหม่</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.cardHeadRow}>
                    <Text style={styles.summary}>
                      {dateStart === dateEnd
                        ? fmtThaiDate(dateStart)
                        : `${fmtThaiDate(dateStart)} – ${fmtThaiDate(dateEnd)}`}
                      {' · '}รวม <Text style={styles.summaryNum}>{pendingSum}</Text> งานที่ยังไม่ปิด
                    </Text>
                    <Pressable onPress={() => navigation.navigate('JobDetail', {
                      technician: '',
                      date: dateStart,
                      dateEnd,
                      datePreset,
                      mode: 'pending',
                      viewAll: true,
                    })}>
                      <Text style={styles.viewAll}>ดูทั้งหมด</Text>
                    </Pressable>
                  </View>
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {pendingList.map((tech) => (
                      <TechnicianBar
                        key={tech.id}
                        name={tech.name}
                        value={tech.pending}
                        max={pendingMax}
                        color={colors.barFillAlt}
                        onPress={() => openPendingJobs(tech)}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </Card>

            <BreakdownSummaryCard
              navigation={navigation}
              style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
            />
            <PreviewCard
              title="แจ้งซ่อมออนไลน์"
              isWide={isWide}
              onPress={() => (canWrite ? navigation.navigate('RepairForm') : navigation.navigate('Login'))}
              headerRight={
                canWrite ? (
                  <Pressable onPress={() => navigation.navigate('RepairForm')}>
                    <Text style={styles.viewAll}>+ แจ้ง</Text>
                  </Pressable>
                ) : null
              }
            >
              <Text style={styles.previewSummary}>
                วันนี้เปิดอยู่ <Text style={styles.summaryNum}>{openToday}</Text> งาน
                {!canWrite ? ' · ต้องเข้าสู่ระบบก่อนแจ้ง' : ''}
              </Text>
              {recentRepairs.length ? (
                recentRepairs.map((r) => (
                  <Pressable
                    key={r.r_id}
                    style={styles.previewRow}
                    onPress={() => navigation.navigate('RepairDetail', { id: r.r_id })}
                  >
                    <Text style={styles.previewMain} numberOfLines={1}>
                      {r.r_v_plate || r.r_v_name || '—'}
                    </Text>
                    <Text style={styles.previewSub} numberOfLines={1}>
                      {clipText(r.r_repair_list)} · {r.r_technician || 'ไม่ระบุช่าง'}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.previewEmpty}>ยังไม่มีงานในช่วงวันที่เลือก</Text>
              )}
            </PreviewCard>
            <PreviewCard
              title="ประวัติแจ้งซ่อมรายคัน"
              isWide={isWide}
              onPress={() => navigation.navigate('Search', { q: '' })}
              headerRight={
                <Pressable onPress={() => navigation.navigate('Search', { q: '' })}>
                  <Text style={styles.viewAll}>ค้นหา ›</Text>
                </Pressable>
              }
            >
              <Text style={styles.previewSummary}>รถที่มีงานล่าสุดในช่วงวันที่เลือก</Text>
              {recentVehicles.length ? (
                recentVehicles.map((v) => (
                  <Pressable
                    key={v.plate}
                    style={styles.previewRow}
                    onPress={() => navigation.navigate('Search', { q: v.plate })}
                  >
                    <Text style={styles.previewMain} numberOfLines={1}>
                      {v.plate}
                    </Text>
                    <Text style={styles.previewSub} numberOfLines={1}>
                      {[v.brand, clipText(v.lastJob, 40)].filter(Boolean).join(' · ')}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.previewEmpty}>กดค้นหาเพื่อดูประวัติรายคัน</Text>
              )}
            </PreviewCard>
            <PreviewCard
              title="บอร์ดข่าว"
              isWide={isWide}
              onPress={() => navigation.navigate('Board')}
              headerRight={
                <Pressable onPress={() => navigation.navigate('Board')}>
                  <Text style={styles.viewAll}>ดูทั้งหมด ›</Text>
                </Pressable>
              }
            >
              <Text style={styles.previewSummary}>ไวท์บอร์ดงานตามโซน</Text>
              {boardPreview.length ? (
                boardPreview.map((n) => (
                  <Pressable
                    key={n.id}
                    style={styles.previewRow}
                    onPress={() => navigation.navigate('Board')}
                  >
                    <Text style={styles.previewMain} numberOfLines={1}>
                      {n.pin ? '📌 ' : ''}{n.title}
                    </Text>
                    <Text style={styles.previewSub} numberOfLines={1}>
                      {n.department || 'ทั่วไป'}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.previewEmpty}>ยังไม่มีโน้ต — กดเพื่อเพิ่มบนบอร์ด</Text>
              )}
            </PreviewCard>
            <PreviewCard
              title="ตำแหน่งรถจอด"
              isWide={isWide}
              onPress={() => navigation.navigate('Locations')}
              headerRight={
                <Pressable onPress={() => navigation.navigate('Locations')}>
                  <Text style={styles.viewAll}>ดูทั้งหมด ›</Text>
                </Pressable>
              }
            >
              <Text style={styles.previewSummary}>จุดจอดที่บันทึกล่าสุด</Text>
              {locationPreview.length ? (
                locationPreview.map((loc) => (
                  <Pressable
                    key={loc.id}
                    style={styles.previewRow}
                    onPress={() => navigation.navigate('Locations')}
                  >
                    <Text style={styles.previewMain} numberOfLines={1}>
                      {loc.title || loc.spot || 'จุดจอด'}
                    </Text>
                    <Text style={styles.previewSub} numberOfLines={1}>
                      {[loc.v_name, loc.spot].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.previewEmpty}>ยังไม่มีจุดจอด — กดเพื่อมาร์กด้วยมือ</Text>
              )}
            </PreviewCard>
            <PreviewCard
              title="สต็อกอะไหล่"
              isWide={isWide}
              onPress={() => {}}
              disabled
            >
              <Text style={styles.previewSummary}>
                {canSeePartsPrice ? 'ราคาอะไหล่ (สิทธิ์ staff+)' : 'ซ่อนราคา — สิทธิ์ไม่พอ'}
              </Text>
              <Text style={styles.previewEmpty}>กำลังพัฒนา</Text>
            </PreviewCard>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function clipText(str, max = 36) {
  const s = String(str || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function PreviewCard({ title, isWide, onPress, disabled, headerRight, children }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        isWide ? styles.cardWide : styles.cardFull,
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
      <Card title={title} style={styles.navInner} headerRight={headerRight}>
        <View style={styles.previewBody}>{children}</View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerLeft: { flexShrink: 1 },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  headerActionsMobile: { justifyContent: 'flex-end' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.card },
  logoMobile: { width: 36, height: 36 },
  brandText: { flexShrink: 1 },
  searchBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  searchBtnMobile: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  searchBtnText: { color: colors.onNavy, fontSize: 13, fontWeight: '700' },
  headerTitle: { color: colors.onNavy, fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  scrollMobile: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {},
  cardFull: { width: '100%' },
  cardWide: { flexBasis: '30%', flexGrow: 1, minWidth: 280 },
  navInner: { margin: 0 },
  cardHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: spacing.sm,
  },
  summary: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  summaryNum: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  viewAll: { color: colors.barFillAlt, fontWeight: '800', fontSize: 12 },
  list: { maxHeight: 320 },
  errorBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  errorText: { color: colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  errorMsg: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: spacing.md },
  retryBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryText: { color: colors.onNavy, fontWeight: '700' },
  previewBody: { paddingVertical: spacing.xs, minHeight: 100 },
  previewSummary: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  previewRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.barTrack,
  },
  previewMain: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  previewSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  previewEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
});
