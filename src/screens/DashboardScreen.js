import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  AppState,
} from 'react-native';
import { RefreshControl } from '../components/AppRefreshControl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import Card from '../components/Card';
import TechnicianBar from '../components/TechnicianBar';
import LoadingView from '../components/LoadingView';
import DateRangePicker, { presetRange } from '../components/DateRangePicker';
import { colors, spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchTechnicians,
  fetchRepairs,
  fetchPending,
  fmtDate,
  fmtThaiDate,
  isOpenRepair,
} from '../data/api';
import { useAuth } from '../auth/AuthContext';
import { useScreenLayout } from '../components/BackNavigation';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { isMobile, isWide, pad, heroTitleSize } = useScreenLayout();
  const [dateRange, setDateRange] = useState(() => presetRange('today'));
  const [datePreset, setDatePreset] = useState('today');
  const [techs, setTechs] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [pendingByTech, setPendingByTech] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
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
      const [repSettled, techSettled, pendingSettled] = await Promise.allSettled([
        fetchRepairs(dateRange.start, dateRange.end),
        fetchTechnicians(),
        fetchPending(),
      ]);

      if (repSettled.status !== 'fulfilled') {
        throw repSettled.reason || new Error('โหลดรายการซ่อมไม่สำเร็จ');
      }
      const rep = repSettled.value;
      const rows = rep.rows || [];

      let techRows =
        techSettled.status === 'fulfilled' ? techSettled.value || [] : [];
      if (!techRows.length) {
        const names = [...new Set(rows.map((r) => r.r_technician).filter(Boolean))];
        techRows = names.map((n, i) => ({ id: String(i + 1), name: n }));
      }

      setRepairs(rows);
      setTechs(techRows);
      setMeta({ date: rep.date, total: rep.total ?? rows.length });

      if (pendingSettled.status === 'fulfilled') {
        const pend = pendingSettled.value || {};
        setPendingByTech(pend.rows || []);
        setPendingTotal(pend.total || 0);
      } else {
        // fallback: open jobs in selected date range only
        const open = rows.filter(isOpenRepair);
        const map = {};
        open.forEach((r) => {
          const n = (r.r_technician || '').trim() || '';
          map[n] = (map[n] || 0) + 1;
        });
        const fallback = Object.entries(map)
          .map(([name, pending]) => ({ name, pending }))
          .sort((a, b) => b.pending - a.pending);
        setPendingByTech(fallback);
        setPendingTotal(open.length);
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

  // เมื่อเข้าหน้า / กลับมาแอป: ไม่ soft-refresh อัตโนมัติ (รำคาญ)
  // เปลี่ยนแค่วันที่ถ้าข้ามเที่ยงคืน — ให้ load จาก dateRange effect ตามปกติ
  useFocusEffect(
    useCallback(() => {
      const today = fmtDate(new Date());
      if (today !== lastDeviceDay.current) {
        lastDeviceDay.current = today;
        setDateRange(presetRange('today'));
        setDatePreset('today');
      }
    }, [])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const today = fmtDate(new Date());
        if (today !== lastDeviceDay.current) {
          lastDeviceDay.current = today;
          setDateRange(presetRange('today'));
          setDatePreset('today');
        }
      }
    });
    return () => sub.remove();
  }, []);

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

  const pendingListRaw = pendingByTech.map((row, i) => {
    const name = (row.name || '').trim();
    const pending = Number(row.pending) || 0;
    const matched = techs.find((t) => t.name === name);
    if (!name) {
      return { id: `pending-none-${i}`, name: 'ไม่ระบุช่าง', pending, queryName: '' };
    }
    return {
      id: matched?.id ?? `pending-${i}`,
      name,
      pending,
      queryName: name,
    };
  });

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
  pendingList.sort((a, b) => b.pending - a.pending);
  const pendingMax = Math.max(...pendingList.map((t) => t.pending), 1);
  const pendingSum = pendingTotal || pendingList.reduce((s, t) => s + t.pending, 0);

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
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Pressable style={styles.headerLeft} onPress={refreshHome}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/sombatlogobg.png')} style={[styles.logo, isMobile && styles.logoMobile]} />
            <View style={styles.brandText}>
              <Text style={[styles.headerTitle, { fontSize: heroTitleSize }]}>สมบัติทัวร์</Text>
              <Text style={[styles.headerSub, isMobile && styles.headerSubMobile]}>
                โปรแกรมงานซ่อมบำรุง
              </Text>
            </View>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          {user ? (
            <Pressable
              style={[styles.searchBtn, isMobile && styles.searchBtnMobile]}
              onPress={() => navigation.navigate('Settings')}
              accessibilityRole="button"
              accessibilityLabel="ตั้งค่า"
            >
              <View style={styles.searchBtnInner}>
                <Ionicons name="settings-outline" size={isMobile ? 16 : 15} color={colors.onNavy} />
                <Text style={[styles.searchBtnText, isMobile && styles.searchBtnTextMobile]} numberOfLines={1}>
                  {user.username}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable style={[styles.searchBtn, isMobile && styles.searchBtnMobile]} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.searchBtnText}>เข้าสู่ระบบ</Text>
            </Pressable>
          )}
          <Pressable style={[styles.searchBtn, isMobile && styles.searchBtnMobile]} onPress={() => navigation.navigate('Search')}>
            <View style={styles.searchBtnInner}>
              <Ionicons name="search" size={isMobile ? 16 : 15} color={colors.onNavy} />
              {!isMobile ? <Text style={styles.searchBtnText}>ค้นหา</Text> : null}
            </View>
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
                      สะสมทั้งหมด · รวม <Text style={styles.summaryNum}>{pendingSum}</Text> งานที่ยังไม่ปิด
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

            {/* ฟีเจอร์เสริม (แจ้งด่วน / ประวัติรถ / บอร์ด / จุดจอด / สต็อก) — ซ่อนชั่วคราว */}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: { flex: 1, flexShrink: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', gap: 6, flexShrink: 0, paddingTop: 2 },
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
    minHeight: 44,
    justifyContent: 'center',
  },
  searchBtnMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  searchBtnText: { color: colors.onNavy, fontSize: 13, fontWeight: '700' },
  searchBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchBtnTextMobile: { fontSize: 12, maxWidth: 110 },
  headerTitle: { color: colors.onNavy, fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  headerSubMobile: { fontSize: 11 },
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
  viewAllMuted: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  previewHeaderActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  headerActionHit: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  quickBtn: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  quickBtnText: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  quickBtnAlt: {
    flex: 1,
    backgroundColor: colors.navyTint,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  quickBtnAltText: { fontSize: 13, fontWeight: '800', color: colors.navy },
  previewRow: {
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.barTrack,
  },
  previewMainRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  previewMain: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  previewSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  previewEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
});
