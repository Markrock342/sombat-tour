import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';
import DateRangePicker from '../components/DateRangePicker';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import { fetchRepairs, fetchPendingJobs, fmtThaiDate, fmtDateTime, fmtDate } from '../data/api';

const STATUS_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'open', label: 'กำลังซ่อม' },
  { key: 'closed', label: 'ปิดงานแล้ว' },
];

function parseDateStr(str) {
  if (!str) return new Date();
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function JobDetailScreen({ route, navigation }) {
  const { technician, date, dateEnd, datePreset: initialPreset = 'custom', mode = 'day' } =
    route.params ?? {};
  const isPending = mode === 'pending';
  const [dateRange, setDateRange] = useState(() => ({
    start: parseDateStr(date),
    end: parseDateStr(dateEnd || date),
  }));
  const [datePreset, setDatePreset] = useState(initialPreset);
  const dateStart = fmtDate(dateRange.start);
  const dateEndStr = fmtDate(dateRange.end);
  const dateLabel =
    dateEndStr !== dateStart
      ? `${fmtThaiDate(dateStart)} – ${fmtThaiDate(dateEndStr)}`
      : fmtThaiDate(dateStart);
  const techLabel = technician?.trim() ? technician : 'ไม่ระบุช่าง';
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // โหมดงานค้าง: ดึงงานค้างทั้งหมดของช่าง; โหมดปกติ: งานของวันนั้น
      const rows = isPending
        ? (await fetchPendingJobs(technician)).rows || []
        : ((await fetchRepairs(dateRange.start, dateRange.end)).rows || []).filter((r) => {
            const tech = (r.r_technician || '').trim();
            const want = (technician || '').trim();
            if (!want || want === 'ไม่ระบุช่าง') return !tech;
            return tech === want;
          });

      const sorted = [...rows].sort((a, b) => (b.r_dt_rec || '').localeCompare(a.r_dt_rec || ''));

      const mapped = sorted.map((r, i) => ({
        id: i + 1,
        code: r.r_job_num ? `#${r.r_job_num}` : `#${r.r_id}`,
        title: r.r_repair_list || 'งานแจ้งซ่อม',
        closed: r.r_close && r.r_close !== '0',
        vehicleNo: r.r_v_name || '',
        plate: r.r_v_plate || '',
        chassis: r.r_v_chassis || '',
        model: [r.r_v_brand, r.r_v_model].filter(Boolean).join(' • '),
        mile: Number(r.r_mile) || 0,
        company: r.r_v_company || r.r_inv_com || '',
        datetime: r.r_dt_rec,
      }));
      setJobs(mapped);
      setStatusFilter('all');
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [technician, dateRange.start, dateRange.end, isPending]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleJobs = jobs
    .filter((job) => {
      if (statusFilter === 'open') return !job.closed;
      if (statusFilter === 'closed') return job.closed;
      return true;
    })
    .map((job, i) => ({ ...job, displayId: i + 1 }));

  const countLabel =
    statusFilter === 'all'
      ? `${jobs.length} งาน`
      : `${visibleJobs.length} จาก ${jobs.length} งาน`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
      <View style={styles.header}>
        {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
        <Text style={styles.headerTitle}>
          {isPending ? 'งานค้างซ่อม' : 'รายการแจ้งซ่อม'}
        </Text>
        <Text style={styles.headerSub}>
          {techLabel}
          {isPending ? '' : ` · ${dateLabel}`}
          {!loading && !error && !isPending ? ` · ${jobs.length === 0 ? '0 งาน' : countLabel}` : ''}
          {!loading && !error && isPending && jobs.length > 0 ? ` · ${countLabel}` : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
        showsVerticalScrollIndicator={false}
      >
        {!isPending ? (
          <DateRangePicker
            value={dateRange}
            presetKey={datePreset}
            onChange={(range, key) => {
              setDateRange(range);
              setDatePreset(key);
            }}
          />
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.navy} />
            <Text style={styles.centerText}>กำลังโหลด...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>ลองใหม่</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {jobs.length > 0 ? (
              <View style={styles.filterRow}>
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f.key;
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => setStatusFilter(f.key)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {jobs.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.centerText}>ไม่มีงานของช่างคนนี้ในวันที่เลือก</Text>
              </View>
            ) : visibleJobs.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.centerText}>ไม่มีงานในสถานะที่เลือก</Text>
              </View>
            ) : (
              <View style={[styles.grid, isWide && styles.gridWide]}>
                {visibleJobs.map((job) => (
                  <Pressable
                    key={job.code}
                    style={({ pressed }) => [
                      styles.jobCard,
                      isWide ? styles.jobCardWide : styles.jobCardFull,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.jobTopRow}>
                      <View style={styles.indexBadge}>
                        <Text style={styles.indexText}>{job.displayId}</Text>
                      </View>
                      <StatusPill closed={job.closed} />
                    </View>
                    <Text style={styles.jobCode}>
                      {job.code}
                      {job.datetime ? ` | ${fmtDateTime(job.datetime)}` : ''}
                    </Text>

                    <View style={styles.vehicleBox}>
                      {job.vehicleNo ? (
                        <Text style={styles.vehicleNo}>🚚 {job.vehicleNo}</Text>
                      ) : null}
                      <Text style={styles.jobDetail}>
                        {job.plate || '-'}
                        {job.chassis ? ` • ${job.chassis}` : ''}
                      </Text>
                      {job.model ? <Text style={styles.jobDetail}>{job.model}</Text> : null}
                      {job.mile > 0 || job.company ? (
                        <Text style={styles.jobDetail}>
                          {job.mile > 0 ? `ไมล์ ${job.mile.toLocaleString()}` : ''}
                          {job.mile > 0 && job.company ? ' • ' : ''}
                          {job.company || ''}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.jobTitle}>{job.title}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
      {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </View>
    </SafeAreaView>
  );
}

function StatusPill({ closed }) {
  // กำลังซ่อม = เขียว, ปิดงานแล้ว = แดง
  return (
    <View style={[styles.pill, { backgroundColor: closed ? '#E5544B' : '#1FA97A' }]}>
      <Text style={styles.pillText}>{closed ? 'ปิดงานแล้ว' : 'กำลังซ่อม'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  center: { paddingVertical: spacing.xl * 2, alignItems: 'center' },
  centerText: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  retryText: { color: colors.onNavy, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
  },
  filterChipActive: { backgroundColor: colors.navy },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.navySoft },
  filterTextActive: { color: colors.onNavy },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  jobCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  jobCardFull: { width: '100%' },
  jobCardWide: { flexBasis: '22%', flexGrow: 1, minWidth: 220 },
  pressed: { opacity: 0.85 },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { color: colors.onNavy, fontWeight: '800', fontSize: 14 },
  jobCode: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  jobTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#FFF0C2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  vehicleBox: {
    backgroundColor: '#F3F5FB',
    borderLeftWidth: 3,
    borderLeftColor: colors.barFill,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  vehicleNo: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 3,
  },
  jobDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  jobTime: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
});
