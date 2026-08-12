import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { RefreshControl } from '../components/AppRefreshControl';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius } from '../theme';
import DateRangePicker from '../components/DateRangePicker';
import LoadingView from '../components/LoadingView';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import RepairJobCard, { mapRepairToCardJob } from '../components/RepairJobCard';
import JobSummaryModal from '../components/JobSummaryModal';
import {
  fetchRepairs,
  fetchPendingJobs,
  fmtThaiDate,
  fmtDate,
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
  const techLabel =
    viewAll || !technician?.trim() || technician === 'ไม่ระบุช่าง'
      ? viewAll
        ? 'ทุกช่าง'
        : 'ไม่ระบุช่าง'
      : technician;
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const hasLoaded = useRef(false);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();

  const load = useCallback(
    async (opts = {}) => {
      if (opts.soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        let rows = [];
        if (isPending) {
          const want = viewAll ? null : technician;
          const data = await fetchPendingJobs(want);
          rows = data.rows || [];
          if (!viewAll) {
            const wantName = (technician || '').trim();
            rows = rows.filter((r) => {
              const tech = (r.r_technician || '').trim();
              if (!wantName || wantName === 'ไม่ระบุช่าง') return !tech;
              return tech === wantName;
            });
          }
        } else {
          rows = ((await fetchRepairs(dateRange.start, dateRange.end)).rows || []).filter((r) => {
            if (viewAll) return true;
            const tech = (r.r_technician || '').trim();
            const want = (technician || '').trim();
            if (!want || want === 'ไม่ระบุช่าง') return !tech;
            return tech === want;
          });
        }

        const sorted = [...rows].sort((a, b) => (b.r_dt_rec || '').localeCompare(a.r_dt_rec || ''));
        setJobs(sorted.map((r, i) => mapRepairToCardJob(r, i)));
        setStatusFilter('all');
      } catch (e) {
        setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [technician, dateRange.start, dateRange.end, isPending, viewAll]
  );

  useEffect(() => {
    load({ soft: hasLoaded.current });
    hasLoaded.current = true;
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
            {isPending ? ' · สะสมทั้งหมด' : ` · ${dateLabel}`}
            {!loading && !error ? ` · ${jobs.length === 0 ? '0 งาน' : countLabel}` : ''}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ soft: true })}
              tintColor={colors.navy}
            />
          }
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

          {loading && jobs.length === 0 ? (
            <LoadingView compact />
          ) : error && jobs.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.centerText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => load()}>
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

              {jobs.length === 0 && !loading ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>
                    {isPending ? 'ไม่มีงานค้างของช่างคนนี้' : 'ไม่มีงานของช่างคนนี้ในวันที่เลือก'}
                  </Text>
                </View>
              ) : visibleJobs.length === 0 && !loading ? (
                <View style={styles.center}>
                  <Text style={styles.centerText}>ไม่มีงานในสถานะที่เลือก</Text>
                </View>
              ) : (
                <View style={[styles.grid, isWide && styles.gridWide]}>
                  {visibleJobs.map((job) => (
                    <RepairJobCard
                      key={`${job.rawId || job.code}-${job.displayId}`}
                      job={job}
                      style={isWide ? styles.cardWide : styles.cardFull}
                      onPress={() => setSelectedJob(job)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
        {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </View>

      <JobSummaryModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </SafeAreaView>
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
  cardFull: { width: '100%' },
  cardWide: { flexBasis: '22%', flexGrow: 1, minWidth: 220 },
});
