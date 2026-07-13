import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

import { colors, spacing, radius } from '../theme';
import DateRangePicker from '../components/DateRangePicker';
import LoadingView from '../components/LoadingView';
import RepairJobCard, { mapRepairToCardJob, jobCardSearchHay } from '../components/RepairJobCard';
import {
  TopBackLink,
  MobileBackBar,
  useScreenLayout,
  mobileScrollInset,
  contentSheetStyle,
} from '../components/BackNavigation';
import {
  fetchRepairs,
  fetchPendingJobs,
  fmtThaiDate,
  fmtDate,
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
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const sheetStyle = contentSheetStyle(centerContent, Math.max(contentMaxWidth, 640));
  const lastDeviceDay = useRef(fmtDate(new Date()));

  const load = useCallback(
    async (opts = {}) => {
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

        // เรียงวันเวลาใหม่ → เก่า (แบบเดิมก่อน dense table)
        const sorted = [...rows].sort((a, b) =>
          String(b.r_dt_rec || '').localeCompare(String(a.r_dt_rec || ''))
        );
        setJobs(sorted.map((r, i) => mapRepairToCardJob(r, i)));
      } catch (e) {
        setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [technician, technicianId, dateRange.start, dateRange.end, isPending, viewAll]
  );

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

  const visibleJobs = useMemo(() => {
    const term = textFilter.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (statusFilter === 'open') return !job.closed;
        if (statusFilter === 'closed') return job.closed;
        return true;
      })
      .filter((job) => {
        if (!term) return true;
        return jobCardSearchHay(job).includes(term);
      })
      .map((job, i) => ({ ...job, displayId: i + 1 }));
  }, [jobs, statusFilter, textFilter]);

  const countLabel =
    statusFilter === 'all' && !textFilter.trim()
      ? `${jobs.length} งาน`
      : `${visibleJobs.length} จาก ${jobs.length} งาน`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View
          style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}
        >
          <View style={[styles.headerInner, sheetStyle]}>
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
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scroll,
            centerContent && styles.scrollCentered,
            isMobile && mobileScrollInset,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ soft: true })}
              tintColor={colors.navy}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={sheetStyle}>
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
              placeholder="ค้นเลขงาน · ทะเบียน · ช่าง · อาการ..."
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
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
                      {isPending ? 'ไม่มีงานค้างซ่อม' : 'ไม่มีงานในช่วงวันที่เลือก'}
                    </Text>
                  </View>
                ) : visibleJobs.length === 0 ? (
                  <View style={styles.center}>
                    <Text style={styles.centerText}>ไม่มีงานที่ตรงกับตัวกรอง</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {visibleJobs.map((job) => (
                      <RepairJobCard
                        key={`${job.rId}-${job.code}`}
                        job={job}
                        onPress={() =>
                          navigation.navigate('RepairDetail', {
                            repair: job.raw,
                            rId: job.rId,
                          })
                        }
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
        {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </View>
    </SafeAreaView>
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
  headerCentered: { alignItems: 'center' },
  headerInner: { width: '100%' },
  scrollCentered: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
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
    paddingVertical: 10,
    minHeight: 44,
    marginBottom: spacing.md,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  center: { paddingVertical: spacing.xl * 2, alignItems: 'center' },
  centerText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  retryText: { color: colors.onNavy, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.navy },
  filterText: { fontSize: 13, fontWeight: '700', color: colors.navySoft },
  filterTextActive: { color: colors.onNavy },
  grid: { gap: spacing.sm },
});
