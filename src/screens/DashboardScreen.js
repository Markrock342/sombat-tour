import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '../components/Card';
import TechnicianBar from '../components/TechnicianBar';
import { SkeletonCardBody } from '../components/Skeleton';
import DateRangePicker, { presetRange } from '../components/DateRangePicker';
import { colors, spacing } from '../theme';
import { fetchTechnicians, fetchRepairs, fetchPending, fmtDate } from '../data/api';

export default function DashboardScreen({ navigation }) {
  const [dateRange, setDateRange] = useState(() => presetRange('today'));
  const [datePreset, setDatePreset] = useState('today');
  const [techs, setTechs] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [pending, setPending] = useState([]);
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
      const rep = await fetchRepairs(dateRange.start, dateRange.end);
      const rows = rep.rows || [];

      // รายชื่อช่าง: เอาจาก technician_list; ถ้าโหลดไม่ได้ (เช่น CORS ตอน dev)
      // ให้ดึงรายชื่อจากตัวงานแทน เพื่อให้ยังแสดงผลได้
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

      // งานค้างซ่อม (สะสมข้ามวัน — ไม่ขึ้นกับวันที่เลือก)
      try {
        const pend = await fetchPending();
        setPending(pend.rows || []);
      } catch (_) {
        setPending([]);
      }

      setRepairs(rows);
      setTechs(techRows);
      setMeta({ date: rep.date, total: rep.total ?? rows.length });
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    load();
  }, [load]);

  // นับจำนวนงานต่อช่าง (จับคู่ด้วยชื่อ r_technician)
  const countByName = {};
  repairs.forEach((r) => {
    const n = r.r_technician || '-';
    countByName[n] = (countByName[n] || 0) + 1;
  });
  const routine = techs
    .map((t) => ({ id: t.id, name: t.name, today: countByName[t.name] || 0 }))
    .sort((a, b) => b.today - a.today);
  const routineMax = Math.max(...routine.map((t) => t.today), 1);
  const total = meta.total || repairs.length;
  const active = routine.filter((t) => t.today > 0).length;

  // งานค้างซ่อมต่อช่าง (จับคู่ด้วยชื่อ)
  const pendingByName = {};
  pending.forEach((p) => {
    const name = p.name?.trim() ? p.name.trim() : 'ไม่ระบุช่าง';
    pendingByName[name] = (pendingByName[name] || 0) + (p.pending || 0);
  });
  const techNames = new Set(techs.map((t) => t.name));
  const pendingList = [
    ...techs.map((t) => ({ id: t.id, name: t.name, pending: pendingByName[t.name] || 0 })),
    ...Object.entries(pendingByName)
      .filter(([name]) => !techNames.has(name))
      .map(([name, count], i) => ({
        id: `pending-${i}`,
        name,
        pending: count,
        queryName: name === 'ไม่ระบุช่าง' ? '' : name,
      })),
  ].sort((a, b) => b.pending - a.pending);
  const pendingMax = Math.max(...pendingList.map((t) => t.pending), 1);
  const pendingSum = pendingList.reduce((s, t) => s + t.pending, 0);

  const openJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.name,
      date: dateStart,
      dateEnd,
      mode: 'day',
    });

  const openPendingJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      mode: 'pending',
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>โปรแกรมงานซ่อมบำรุง</Text>
        </View>
        <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('VehicleSearch')}>
          <Text style={styles.searchBtnText}>🔍 ค้นหารถ</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {/* 1 — งานประจำวัน (ข้อมูลจริง) */}
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

            {loading ? (
              <SkeletonCardBody lines={6} />
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>โหลดข้อมูลไม่สำเร็จ</Text>
                <Text style={styles.errorMsg}>{error}</Text>
                <Pressable style={styles.retryBtn} onPress={load}>
                  <Text style={styles.retryText}>ลองใหม่</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.summary}>
                  มีงาน <Text style={styles.summaryNum}>{active}</Text> ผู้ซ่อม · รวม{' '}
                  <Text style={styles.summaryNum}>{total}</Text> งาน
                </Text>
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

          {/* 2 — งานค้างซ่อมแต่ละช่าง (ข้อมูลจริง) */}
          <Card
            starred
            title="งานค้างซ่อม"
            style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
          >
            {loading ? (
              <SkeletonCardBody lines={6} />
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>โหลดข้อมูลไม่สำเร็จ</Text>
                <Pressable style={styles.retryBtn} onPress={load}>
                  <Text style={styles.retryText}>ลองใหม่</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.summary}>
                  รวม <Text style={styles.summaryNum}>{pendingSum}</Text> งาน
                </Text>
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

          {/* 3-6 — รอเชื่อม endpoint เพิ่ม */}
          <Placeholder title="ประวัติแจ้งซ่อมรายคัน" tag="อาจจะ" icon="🚗" isWide={isWide} />
          <Placeholder title="สต็อกอะไหล่" tag="อาจจะ" icon="📦" isWide={isWide} />
          <Placeholder title="ข้อมูลด้านอื่น ๆ" icon="📊" isWide={isWide} />
          <Placeholder title="xxx" icon="➕" isWide={isWide} />
        </View>
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
  },
  headerLeft: { flexShrink: 1 },
  searchBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
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
  summary: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  summaryNum: { color: colors.navy, fontWeight: '800', fontSize: 15 },
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
  placeholderBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  placeholderIcon: { fontSize: 30, marginBottom: spacing.sm, opacity: 0.7 },
  placeholderText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
