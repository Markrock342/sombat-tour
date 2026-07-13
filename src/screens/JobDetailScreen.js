import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  AppState,
} from 'react-native';
import { RefreshControl } from '../components/AppRefreshControl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import DateRangePicker from '../components/DateRangePicker';
import LoadingView from '../components/LoadingView';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import {
  fetchRepairs,
  fetchPendingJobs,
  fmtThaiDate,
  fmtDateTime,
  fmtDate,
  isOpenRepair,
  repairMatchesTech,
} from '../data/api';

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
  const {
    technician,
    technicianId,
    date,
    dateEnd,
    datePreset: initialPreset = 'custom',
    mode = 'day',
    viewAll = false,
  } = route.params ?? {};
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
  const techLabel = viewAll
    ? 'ทั้งหมด'
    : technician?.trim()
      ? technician
      : 'ไม่ระบุช่าง';
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [textFilter, setTextFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { isMobile, isWide, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const lastDeviceDay = useRef(fmtDate(new Date()));

  const load = useCallback(async (opts = {}) => {
    if (opts.soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const techObj = viewAll
        ? null
        : { id: technicianId, name: technician, queryName: technician };

      let rows;
      if (isPending) {
        const data = await fetchPendingJobs(viewAll ? null : technician);
        rows = data.rows || [];
        if (!viewAll && techObj) {
          rows = rows.filter((r) => repairMatchesTech(r, techObj));
        }
      } else {
        rows = ((await fetchRepairs(dateRange.start, dateRange.end)).rows || []).filter((r) => {
          if (viewAll) return true;
          return repairMatchesTech(r, techObj);
        });
      }

      const sorted = [...rows].sort((a, b) => (b.r_dt_rec || '').localeCompare(a.r_dt_rec || ''));

      const mapped = sorted.map((r, i) => ({
        id: i + 1,
        rId: r.r_id,
        raw: r,
        code: r.r_job_num ? `#${r.r_job_num}` : `#${r.r_id}`,
        title: r.r_repair_list || 'งานแจ้งซ่อม',
        closed: !isOpenRepair(r),
        vehicleNo: r.r_v_name || '',
        plate: r.r_v_plate || '',
        chassis: r.r_v_chassis || '',
        model: [r.r_v_brand, r.r_v_model].filter(Boolean).join(' • '),
        mile: Number(r.r_mile) || 0,
        company: r.r_v_company || r.r_inv_com || '',
        technician: r.r_technician || '',
        datetime: r.r_dt_rec,
      }));
      setJobs(mapped);
      setStatusFilter('all');
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [technician, technicianId, dateRange.start, dateRange.end, isPending, viewAll]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      const today = fmtDate(new Date());
      if (today !== lastDeviceDay.current) {
        lastDeviceDay.current = today;
        load({ soft: true });
      }
    }, [load])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load({ soft: true });
    });
    return () => sub.remove();
  }, [load]);

  const visibleJobs = jobs
    .filter((job) => {
      if (statusFilter === 'open') return !job.closed;
      if (statusFilter === 'closed') return job.closed;
      return true;
    })
    .filter((job) => {
      const term = textFilter.trim().toLowerCase();
      if (!term) return true;
      const hay = [
        job.code, job.title, job.vehicleNo, job.plate, job.chassis,
        job.model, job.company, job.technician, job.datetime, job.mile,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(term);
    })
    .map((job, i) => ({ ...job, displayId: i + 1 }));

  const countLabel =
    statusFilter === 'all' && !textFilter.trim()
      ? `${jobs.length} งาน`
      : `${visibleJobs.length} จาก ${jobs.length} งาน`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>
            {isPending ? 'งานค้างซ่อม' : 'รายการแจ้งซ่อม'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={isMobile ? 2 : undefined}>
            {techLabel}
            {isPending ? ' · สะสมทั้งหมด' : ` · ${dateLabel}`}
            {!loading && !error ? ` · ${jobs.length === 0 ? '0 งาน' : countLabel}` : ''}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load({ soft: true })} tintColor={colors.navy} />
          }
          keyboardShouldPersistTaps="handled"
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

          <TextInput
            style={styles.filterInput}
            value={textFilter}
            onChangeText={setTextFilter}
            placeholder="พิมพ์ค้นในแถว..."
            placeholderTextColor={colors.textMuted}
          />

          {loading ? (
            <LoadingView compact />
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
                  <Text style={styles.centerText}>
                    {isPending
                      ? 'ไม่มีงานค้างซ่อม'
                      : 'ไม่มีงานในช่วงวันที่เลือก'}
                  </Text>
                </View>
              ) : visibleJobs.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>ไม่มีงานที่ตรงกับตัวกรอง</Text>
                </View>
              ) : (
                <View style={[styles.grid, isWide && styles.gridWide]}>
                  {visibleJobs.map((job) => (
                    <Pressable
                      key={`${job.rId}-${job.code}`}
                      style={({ pressed }) => [
                        styles.jobCard,
                        isWide ? styles.jobCardWide : styles.jobCardFull,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        navigation.navigate('RepairDetail', { repair: job.raw, rId: job.rId })
                      }
                    >
                      <View style={styles.jobTopRow}>
                        <View style={styles.indexBadge}>
                          <Text style={styles.indexText}>{job.displayId}</Text>
                        </View>
                        <StatusPill closed={job.closed} />
                      </View>
                      {/* วันที่ก่อน แล้วตามด้วยรหัสงาน */}
                      <Text style={styles.jobCode}>
                        {job.datetime ? `${fmtDateTime(job.datetime)} | ` : ''}
                        {job.code}
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
                        <Text style={styles.jobDetail}>
                          ผู้ซ่อม: {job.technician || 'ไม่ระบุ'}
                          {job.mile > 0 ? ` • ไมล์ ${job.mile.toLocaleString()}` : ''}
                        </Text>
                        {job.company ? <Text style={styles.jobDetail}>{job.company}</Text> : null}
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
  filterInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textPrimary,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
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
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
});
