import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import BreakdownBar, { CLOSED_COLOR, OPEN_COLOR } from '../components/BreakdownBar';
import LoadingView from '../components/LoadingView';
import DateRangePicker, { presetRange } from '../components/DateRangePicker';
import { colors, spacing } from '../theme';
import { fetchTechnicians, fetchRepairs, fetchPending, prefetchRepairRange, fmtDate, fmtThaiDate } from '../data/api';
import { useAuth } from '../data/AuthContext';

// r_job_subtype_id = 2 → งานรถเสียกลางทาง
const BREAKDOWN_SUBTYPE_ID = '2';

const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// "2026-07-01" → "1 ก.ค." (ป้ายวันที่แบบสั้นสำหรับกราฟ)
function shortThaiDate(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return str || '';
  return `${+m[3]} ${TH_MONTHS_SHORT[+m[2] - 1]}`;
}

// รายการวันที่ทั้งหมดในช่วง (YYYY-MM-DD) เพื่อให้วันที่ไม่มีงานยังแสดงเป็นแท่งว่าง
function daysInRange(start, end) {
  const out = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    out.push(fmtDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function DashboardScreen({ navigation }) {
  const { logout } = useAuth();
  const [dateRange, setDateRange] = useState(() => presetRange('today'));
  const [datePreset, setDatePreset] = useState('today');
  const [techs, setTechs] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [meta, setMeta] = useState({ date: null, total: 0 });
  const [pendingRows, setPendingRows] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const pendingLoaded = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // การ์ด "เสียกลางทาง" — มีช่วงวันที่ของตัวเอง (ค่าเริ่มต้น 30 วัน)
  const [bdRange, setBdRange] = useState(() => presetRange('30d'));
  const [bdPreset, setBdPreset] = useState('30d');
  const [bdRepairs, setBdRepairs] = useState([]);
  const [bdLoading, setBdLoading] = useState(true);
  const [bdError, setBdError] = useState(null);

  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const dateStart = fmtDate(dateRange.start);
  const dateEnd = fmtDate(dateRange.end);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = [
        fetchRepairs(dateRange.start, dateRange.end),
        fetchTechnicians().catch(() => null),
      ];
      if (!pendingLoaded.current) tasks.push(fetchPending().catch(() => null));

      const results = await Promise.all(tasks);
      const rep = results[0];
      const techResult = results[1];
      const pendingResult = results[2];
      const rows = rep.rows || [];

      if (!pendingLoaded.current && pendingResult) {
        setPendingRows(pendingResult.rows || []);
        setPendingTotal(pendingResult.total || 0);
        pendingLoaded.current = true;
      }

      // รายชื่อช่าง: เอาจาก technician_list; ถ้าโหลดไม่ได้ (เช่น CORS ตอน dev)
      // ให้ดึงรายชื่อจากตัวงานแทน เพื่อให้ยังแสดงผลได้
      let techRows = techResult;
      if (!techRows || !techRows.length) {
        const names = [...new Set(rows.map((r) => r.r_technician).filter(Boolean))];
        techRows = names.map((n, i) => ({ id: String(i + 1), name: n }));
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

  // โหลดงานเสียกลางทางตามช่วงวันที่ของการ์ดนี้ (แยกจากงานประจำวัน)
  const loadBreakdown = useCallback(async () => {
    setBdLoading(true);
    setBdError(null);
    try {
      const rep = await fetchRepairs(bdRange.start, bdRange.end);
      const rows = (rep.rows || []).filter(
        (r) => String(r.r_job_subtype_id) === BREAKDOWN_SUBTYPE_ID
      );
      setBdRepairs(rows);
    } catch (e) {
      setBdError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setBdLoading(false);
    }
  }, [bdRange.start, bdRange.end]);

  useEffect(() => {
    loadBreakdown();
  }, [loadBreakdown]);

  // นับจำนวนงานต่อช่าง (จับคู่ด้วยชื่อ r_technician)
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

  // งานค้างซ่อมต่อช่าง — รวมทั้งหมดจาก backlog.php (ไม่ตามช่วงวันที่)
  const pendingByName = {};
  pendingRows.forEach((r) => {
    const name = (r.name || '').trim() ? r.name.trim() : 'ไม่ระบุช่าง';
    pendingByName[name] = r.pending || 0;
  });
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
  const pendingSum = pendingTotal || pendingList.reduce((s, t) => s + t.pending, 0);

  // เสียกลางทาง: รวมจำนวนต่อวัน (แดง = ปิดงาน, เขียว = ยังเปิด/กำลังซ่อม)
  const bdByDate = {};
  bdRepairs.forEach((r) => {
    const d = String(r.r_dt_rec || '').slice(0, 10);
    if (!d) return;
    if (!bdByDate[d]) bdByDate[d] = { open: 0, closed: 0 };
    const closed = r.r_close && r.r_close !== '0';
    if (closed) bdByDate[d].closed += 1;
    else bdByDate[d].open += 1;
  });
  const bdDays = daysInRange(bdRange.start, bdRange.end)
    .reverse()
    .map((d) => ({ date: d, open: bdByDate[d]?.open || 0, closed: bdByDate[d]?.closed || 0 }));
  const bdMax = Math.max(...bdDays.map((x) => x.open + x.closed), 1);
  const bdTotal = bdRepairs.length;

  const openJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      date: dateStart,
      dateEnd,
      datePreset,
      mode: 'day',
    });

  const openBreakdownAll = () =>
    navigation.navigate('JobDetail', {
      mode: 'breakdown',
      subtypeId: BREAKDOWN_SUBTYPE_ID,
      headerTitle: 'งานเสียกลางทาง',
      date: fmtDate(bdRange.start),
      dateEnd: fmtDate(bdRange.end),
      datePreset: bdPreset,
    });

  const openBreakdownDay = (date) => {
    if (!date) return;
    navigation.navigate('JobDetail', {
      mode: 'breakdown',
      subtypeId: BREAKDOWN_SUBTYPE_ID,
      headerTitle: 'งานเสียกลางทาง',
      date,
      dateEnd: date,
      datePreset: 'custom',
    });
  };

  const openPendingJobs = (tech) =>
    navigation.navigate('JobDetail', {
      technician: tech.queryName ?? tech.name,
      mode: 'pending',
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {loading ? <LoadingView overlay message="กำลังโหลดข้อมูล..." /> : null}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/sombattourbg.png')} style={styles.logo} />
            <View style={styles.brandText}>
              <Text style={styles.headerSub}>โปรแกรมงานซ่อมบำรุง</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.searchBtn} onPress={() => navigation.navigate('VehicleSearch')}>
            <Text style={styles.searchBtnText}>🔍 ค้นหารถ</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>ออก</Text>
          </Pressable>
        </View>
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
              onPrefetchRange={prefetchRepairRange}
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
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>โหลดข้อมูลไม่สำเร็จ</Text>
                <Pressable style={styles.retryBtn} onPress={load}>
                  <Text style={styles.retryText}>ลองใหม่</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.summary}>
                  รวมทั้งหมด · <Text style={styles.summaryNum}>{pendingSum}</Text> งานที่ยังไม่ปิด
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

          {/* 3 — เสียกลางทาง (ข้อมูลจริง: r_job_subtype_id = 2) */}
          <Card
            starred
            title="เสียกลางทาง"
            style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
          >
            <DateRangePicker
              value={bdRange}
              presetKey={bdPreset}
              onPrefetchRange={prefetchRepairRange}
              onChange={(range, key) => {
                setBdRange(range);
                setBdPreset(key);
              }}
            />

            {bdError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>โหลดข้อมูลไม่สำเร็จ</Text>
                <Text style={styles.errorMsg}>{bdError}</Text>
                <Pressable style={styles.retryBtn} onPress={loadBreakdown}>
                  <Text style={styles.retryText}>ลองใหม่</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Pressable style={styles.bdTotalRow} onPress={openBreakdownAll} hitSlop={6}>
                  <Text style={styles.summary}>
                    รวม <Text style={styles.summaryNum}>{bdTotal}</Text> งาน
                  </Text>
                  <Text style={styles.bdTotalLink}>ดูทั้งหมด ›</Text>
                </Pressable>

                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CLOSED_COLOR }]} />
                    <Text style={styles.legendText}>ปิดงาน</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: OPEN_COLOR }]} />
                    <Text style={styles.legendText}>เปิดงาน</Text>
                  </View>
                </View>

                <ScrollView style={styles.list} nestedScrollEnabled>
                  {bdDays.map((row) => (
                    <BreakdownBar
                      key={row.date}
                      date={row.date}
                      label={shortThaiDate(row.date)}
                      open={row.open}
                      closed={row.closed}
                      max={bdMax}
                      onPress={() => openBreakdownDay(row.date)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </Card>

          {/* 4-6 — รอเชื่อม endpoint เพิ่ม */}
          <Placeholder title="ประวัติแจ้งซ่อมรายคัน" tag="อาจจะ" icon="🚗" isWide={isWide} />
          <Placeholder title="สต็อกอะไหล่" tag="อาจจะ" icon="📦" isWide={isWide} />
          <Placeholder title="ข้อมูลด้านอื่น ๆ" icon="📊" isWide={isWide} />
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
  safe: { flex: 1, backgroundColor: colors.navy, position: 'relative' },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexShrink: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 120, height: 40 },
  brandText: { flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  searchBtnText: { color: colors.onNavy, fontSize: 13, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
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
  bdTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bdTotalLink: { color: colors.barFill, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
  legendRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
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
