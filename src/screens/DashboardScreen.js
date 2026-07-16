import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '../components/Card';
import TechnicianBar from '../components/TechnicianBar';
import LoadingView from '../components/LoadingView';
import DateRangePicker, { presetRange } from '../components/DateRangePicker';
import BreakdownSummaryCard from '../components/BreakdownSummaryCard';
import { colors, spacing } from '../theme';
import {
  fetchTechnicians,
  fetchRepairs,
  fetchPending,
  fmtDate,
  fmtThaiDate,
  isOpenRepair,
} from '../data/api';
import { useAuth } from '../auth/AuthContext';
import { confirmDialog } from '../utils/dialog';

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [dateRange, setDateRange] = useState(() => presetRange('today'));
  const [datePreset, setDatePreset] = useState('today');
  const [techs, setTechs] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [pendingByTech, setPendingByTech] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [meta, setMeta] = useState({ date: null, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const dateStart = fmtDate(dateRange.start);
  const dateEnd = fmtDate(dateRange.end);

  const load = useCallback(async () => {
    setLoading(true);
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

      // งานค้างซ่อม = สะสมทุกวัน (backlog) ไม่ผูกช่วงวันที่
      if (pendingSettled.status === 'fulfilled') {
        const pend = pendingSettled.value || {};
        setPendingByTech(pend.rows || []);
        setPendingTotal(pend.total || 0);
      } else {
        const open = rows.filter(isOpenRepair);
        const map = {};
        open.forEach((r) => {
          const n = (r.r_technician || '').trim() || 'ไม่ระบุช่าง';
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
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    load();
  }, [load]);

  const countByName = {};
  repairs.forEach((r) => {
    const n = r.r_technician?.trim() ? r.r_technician.trim() : 'ไม่ระบุช่าง';
    countByName[n] = (countByName[n] || 0) + 1;
  });
  const techNames = new Set(techs.map((t) => t.name));
  const routine = [
    ...techs.map((t) => ({ id: t.id, name: t.name, today: countByName[t.name] || 0 })),
    ...Object.entries(countByName)
      .filter(([name]) => !techNames.has(name))
      .map(([name, count], i) => ({
        id: `routine-${i}`,
        name,
        today: count,
        queryName: name === 'ไม่ระบุช่าง' ? '' : name,
      })),
  ].sort((a, b) => b.today - a.today);
  const routineMax = Math.max(...routine.map((t) => t.today), 1);
  const total = meta.total || repairs.length;
  const active = routine.filter((t) => t.today > 0).length;

  const pendingList = pendingByTech
    .map((row, i) => {
      const name = (row.name || '').trim() || 'ไม่ระบุช่าง';
      const pending = Number(row.pending) || 0;
      const matched = techs.find((t) => t.name === name);
      return {
        id: matched?.id ?? `pending-${i}`,
        name,
        pending,
        queryName: name === 'ไม่ระบุช่าง' ? '' : name,
      };
    })
    .filter((t) => t.pending > 0)
    .sort((a, b) => b.pending - a.pending);
  const pendingMax = Math.max(...pendingList.map((t) => t.pending), 1);
  const pendingSum = pendingTotal || pendingList.reduce((s, t) => s + t.pending, 0);

  const openJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      date: dateStart,
      dateEnd,
      datePreset,
      mode: 'day',
    });

  const openPendingJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      date: dateStart,
      dateEnd,
      datePreset,
      mode: 'pending',
      viewAll: false,
    });

  const confirmLogout = async () => {
    const name = user?.username || '';
    const ok = await confirmDialog(
      'ออกจากระบบ',
      name ? `ออกจากบัญชี ${name} ใช่ไหม?` : 'ออกจากระบบใช่ไหม?',
      { confirmText: 'ออกจากระบบ', cancelText: 'ยกเลิก', destructive: true }
    );
    if (ok) logout();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/sombatlogobg.png')} style={styles.logo} />
            <View style={styles.brandText}>
              <Text style={styles.headerTitle}>สมบัติทัวร์</Text>
              <Text style={styles.headerSub}>โปรแกรมงานซ่อมบำรุง</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.searchBtn} onPress={confirmLogout}>
            <Text style={styles.searchBtnText} numberOfLines={1}>
              {user?.username || 'ผู้ใช้'} · ออก
            </Text>
          </Pressable>
          <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('VehicleSearch')}>
            <Text style={styles.searchBtnText}>🔍 ค้นหารถ</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                    <Pressable
                      onPress={() =>
                        navigation.navigate('JobDetail', {
                          technician: '',
                          date: dateStart,
                          dateEnd,
                          datePreset,
                          mode: 'day',
                          viewAll: true,
                        })
                      }
                    >
                      <Text style={styles.viewAll}>ดูทั้งหมด</Text>
                    </Pressable>
                  </View>
                  <ScrollView style={styles.list} nestedScrollEnabled>
                    {routine.map((tech) => (
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
                      สะสมทั้งหมด · รวม <Text style={styles.summaryNum}>{pendingSum}</Text>{' '}
                      งานที่ยังไม่ปิด
                    </Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('JobDetail', {
                          technician: '',
                          date: dateStart,
                          dateEnd,
                          datePreset,
                          mode: 'pending',
                          viewAll: true,
                        })
                      }
                    >
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

            <Placeholder title="ประวัติแจ้งซ่อมรายคัน" tag="อาจจะ" icon="🚗" isWide={isWide} />
            <Placeholder title="สต็อกอะไหล่" tag="อาจจะ" icon="📦" isWide={isWide} />
            <Placeholder title="ข้อมูลด้านอื่น ๆ" icon="📊" isWide={isWide} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Placeholder({ title, tag, icon, isWide }) {
  return (
    <Card
      title={tag ? `${title} (${tag})` : title}
      style={[styles.card, isWide ? styles.cardWide : styles.cardFull, styles.placeholderCard]}
    >
      <View style={styles.placeholderBody}>
        <Text style={styles.placeholderIcon}>{icon}</Text>
        <Text style={styles.placeholderText}>อยู่ระหว่างพัฒนา</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: { flexShrink: 1, flex: 1 },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.card },
  brandText: { flexShrink: 1 },
  searchBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    maxWidth: 160,
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
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {},
  cardFull: { width: '100%' },
  cardWide: { flexBasis: '30%', flexGrow: 1, minWidth: 280 },
  cardHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summary: { flex: 1, fontSize: 13, color: colors.textSecondary },
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
  placeholderCard: { minHeight: 170 },
  placeholderBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  placeholderIcon: { fontSize: 30, marginBottom: spacing.sm, opacity: 0.7 },
  placeholderText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
