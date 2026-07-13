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
  isOpenRepair,
  repairMatchesTech,
} from '../data/api';
import { parseRepairList } from '../data/repairNotes';

const STATUS_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'open', label: 'กำลังซ่อม' },
  { key: 'closed', label: 'ปิดงานแล้ว' },
];

const PAGE_SIZE = 40;

const SORT_COLS = [
  { key: 'when', label: 'เวลา', style: 'colWhen', defaultDir: 'desc' },
  { key: 'code', label: 'งาน', style: 'colCode', defaultDir: 'desc' },
  { key: 'vehicle', label: 'รถ', style: 'colVehicle', defaultDir: 'asc' },
  { key: 'title', label: 'อาการ', style: 'colTitle', defaultDir: 'asc' },
  { key: 'tech', label: 'ช่าง', style: 'colTech', defaultDir: 'asc' },
  { key: 'status', label: 'สถานะ', style: 'colStatus', defaultDir: 'asc' },
];

function sortValue(job, key) {
  switch (key) {
    case 'when':
      return String(job.datetime || '');
    case 'code':
      return String(job.raw?.r_job_num || job.rId || '');
    case 'vehicle':
      return `${job.vehicleNo || ''} ${job.plate || ''}`.trim().toLowerCase();
    case 'title':
      return String(job.title || '').toLowerCase();
    case 'tech':
      return String(job.technician || '').toLowerCase();
    case 'status':
      return job.closed ? 1 : 0;
    default:
      return '';
  }
}

function compareJobs(a, b, key, dir) {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  let cmp = 0;
  if (key === 'code' || key === 'status') {
    cmp = Number(av) - Number(bv);
  } else {
    cmp = String(av).localeCompare(String(bv), 'th', { numeric: true, sensitivity: 'base' });
  }
  if (cmp === 0) {
    cmp = String(b.datetime || '').localeCompare(String(a.datetime || ''));
  }
  return dir === 'asc' ? cmp : -cmp;
}

function parseDateStr(str) {
  if (!str) return new Date();
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtListWhen(str) {
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::\d{2})?)?/);
  if (!m) return { date: str || '-', time: '' };
  return {
    date: `${+m[3]}/${m[2]}/${+m[1] + 543}`,
    time: m[4] ? `${m[4]}:${m[5]}` : '',
  };
}

function shortSymptom(raw) {
  const parsed = parseRepairList(raw);
  const text = (parsed.symptom || raw || 'งานแจ้งซ่อม').replace(/\s+/g, ' ').trim();
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function PaginationBar({ page, pageCount, total, pageSize, onChange }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const window = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  for (let i = start; i <= end; i += 1) window.push(i);

  return (
    <View style={styles.pager}>
      <Text style={styles.pagerMeta}>
        แสดง {from}–{to} จาก {total} · หน้า {page}/{pageCount}
      </Text>
      <View style={styles.pagerBtns}>
        <Pressable
          style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
          disabled={page <= 1}
          onPress={() => onChange(page - 1)}
        >
          <Text style={styles.pageBtnText}>‹</Text>
        </Pressable>
        {window.map((n) => (
          <Pressable
            key={n}
            style={[styles.pageBtn, n === page && styles.pageBtnActive]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.pageBtnText, n === page && styles.pageBtnTextActive]}>{n}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.pageBtn, page >= pageCount && styles.pageBtnDisabled]}
          disabled={page >= pageCount}
          onPress={() => onChange(page + 1)}
        >
          <Text style={styles.pageBtnText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
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
  const [sortKey, setSortKey] = useState('when');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const sheetStyle = contentSheetStyle(centerContent, Math.max(contentMaxWidth, 820));
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

        const sorted = [...rows].sort((a, b) =>
          String(b.r_dt_rec || '').localeCompare(String(a.r_dt_rec || ''))
        );

        const mapped = sorted.map((r) => ({
          rId: r.r_id,
          raw: r,
          code: r.r_job_num ? `#${r.r_job_num}` : `#${r.r_id}`,
          title: shortSymptom(r.r_repair_list),
          closed: !isOpenRepair(r),
          vehicleNo: r.r_v_name || '',
          plate: r.r_v_plate || '',
          technician: r.r_technician || '',
          datetime: r.r_dt_rec,
        }));
        setJobs(mapped);
        setPage(1);
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

  useEffect(() => {
    setPage(1);
  }, [statusFilter, textFilter, sortKey, sortDir]);

  const toggleSort = useCallback(
    (col) => {
      if (sortKey === col.key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(col.key);
        setSortDir(col.defaultDir);
      }
    },
    [sortKey]
  );

  const visibleJobs = useMemo(() => {
    const term = textFilter.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      if (statusFilter === 'open' && job.closed) return false;
      if (statusFilter === 'closed' && !job.closed) return false;
      if (!term) return true;
      const hay = [job.code, job.title, job.vehicleNo, job.plate, job.technician, job.datetime]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return hay.includes(term);
    });
    return [...filtered].sort((a, b) => compareJobs(a, b, sortKey, sortDir));
  }, [jobs, statusFilter, textFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(visibleJobs.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageJobs = visibleJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
                  <View style={styles.listCard}>
                    <PaginationBar
                      page={safePage}
                      pageCount={pageCount}
                      total={visibleJobs.length}
                      pageSize={PAGE_SIZE}
                      onChange={setPage}
                    />

                    {!isMobile ? (
                      <View style={styles.colHead}>
                        <Text style={[styles.col, styles.colNo]}>#</Text>
                        {SORT_COLS.map((col) => {
                          const active = sortKey === col.key;
                          const mark = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅';
                          return (
                            <Pressable
                              key={col.key}
                              onPress={() => toggleSort(col)}
                              style={[styles.colSortHit, styles[col.style]]}
                              accessibilityRole="button"
                              accessibilityLabel={`เรียงตาม${col.label}`}
                            >
                              <Text
                                style={[
                                  styles.colHeadText,
                                  active && styles.colSortActive,
                                  !active && styles.colSortIdle,
                                  col.key === 'status' && { textAlign: 'right' },
                                ]}
                                numberOfLines={1}
                              >
                                {col.label}
                                {mark}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    {pageJobs.map((job, i) => {
                      const idx = (safePage - 1) * PAGE_SIZE + i + 1;
                      const vehicle = [job.vehicleNo, job.plate].filter(Boolean).join(' · ') || '-';
                      const when = fmtListWhen(job.datetime);
                      return (
                        <Pressable
                          key={`${job.rId}-${job.code}`}
                          style={({ pressed }) => [
                            styles.row,
                            isMobile && styles.rowMobile,
                            pressed && styles.pressed,
                          ]}
                          onPress={() =>
                            navigation.navigate('RepairDetail', {
                              repair: job.raw,
                              rId: job.rId,
                            })
                          }
                        >
                          {isMobile ? (
                            <>
                              <View style={styles.rowTop}>
                                <Text style={styles.mobileCode}>
                                  {idx}. {job.code}
                                </Text>
                                <Text
                                  style={[
                                    styles.statusText,
                                    { color: job.closed ? '#E5544B' : '#1FA97A' },
                                  ]}
                                >
                                  {job.closed ? 'ปิดงาน' : 'กำลังซ่อม'}
                                </Text>
                              </View>
                              <Text style={styles.mobileTitle} numberOfLines={2}>
                                {job.title}
                              </Text>
                              <Text style={styles.mobileMeta} numberOfLines={2}>
                                {vehicle}
                                {job.technician ? ` · ${job.technician}` : ''}
                                {when.date
                                  ? ` · ${when.date}${when.time ? ` ${when.time}` : ''}`
                                  : ''}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.col, styles.colNo]}>{idx}</Text>
                              <View style={styles.colWhen}>
                                <Text style={styles.whenDate} numberOfLines={1}>
                                  {when.date}
                                </Text>
                                {when.time ? (
                                  <Text style={styles.whenTime} numberOfLines={1}>
                                    {when.time}
                                  </Text>
                                ) : null}
                              </View>
                              <Text style={[styles.col, styles.colCode]} numberOfLines={1}>
                                {job.code}
                              </Text>
                              <Text style={[styles.col, styles.colVehicle]} numberOfLines={1}>
                                {vehicle}
                              </Text>
                              <Text style={[styles.col, styles.colTitle]} numberOfLines={1}>
                                {job.title}
                              </Text>
                              <Text style={[styles.col, styles.colTech]} numberOfLines={1}>
                                {job.technician || '—'}
                              </Text>
                              <Text
                                style={[
                                  styles.col,
                                  styles.colStatus,
                                  styles.statusText,
                                  { color: job.closed ? '#E5544B' : '#1FA97A' },
                                ]}
                              >
                                {job.closed ? 'ปิดงาน' : 'กำลังซ่อม'}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      );
                    })}

                    <PaginationBar
                      page={safePage}
                      pageCount={pageCount}
                      total={visibleJobs.length}
                      pageSize={PAGE_SIZE}
                      onChange={setPage}
                    />
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
  safe: { flex: 1, backgroundColor: colors.navyDeep },
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
  listCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.navyTint,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  col: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  colHeadText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  colSortHit: {
    justifyContent: 'center',
    cursor: 'pointer',
    paddingVertical: 2,
  },
  colSortActive: { color: colors.navy, fontWeight: '800' },
  colSortIdle: { opacity: 0.85 },
  colNo: { width: 36, flexShrink: 0 },
  colWhen: { width: 92, flexShrink: 0, paddingRight: 6 },
  colCode: { width: 78, flexShrink: 0 },
  colVehicle: { width: 140, flexShrink: 1, paddingRight: 8 },
  colTitle: { flex: 1, minWidth: 120, paddingRight: 8 },
  colTech: { width: 96, flexShrink: 0 },
  colStatus: { width: 78, flexShrink: 0, textAlign: 'right' },
  whenDate: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  whenTime: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 12,
  },
  pressed: { backgroundColor: '#F3F5FB' },
  statusText: { fontWeight: '800', fontSize: 12 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  mobileCode: { color: colors.navy, fontWeight: '800', fontSize: 13 },
  mobileTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  mobileMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  pager: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F7F8FC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pagerMeta: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  pagerBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pageBtn: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { color: colors.navy, fontWeight: '800', fontSize: 13 },
  pageBtnTextActive: { color: colors.onNavy },
});
