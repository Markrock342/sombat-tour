import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

import Card from './Card';
import CircularLoader from './CircularLoader';
import DateRangePicker, { presetRange } from './DateRangePicker';
import { colors, spacing, radius } from '../theme';
import {
  fetchBreakdowns,
  fetchRepairs,
  fmtDate,
  fmtThaiDate,
  isOpenRepair,
  isBreakdownRepair,
} from '../data/api';

function eachDay(start, end) {
  const days = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    days.push(fmtDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isBreakdownRow(r) {
  return isBreakdownRepair(r);
}

/**
 * Dashboard card: เสียกลางทาง — circular loader while fetching (no skeleton).
 */
export default function BreakdownSummaryCard({ style, navigation }) {
  const [dateRange, setDateRange] = useState(() => presetRange('30d'));
  const [datePreset, setDatePreset] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const hasLoaded = useRef(false);

  const load = useCallback(async (opts = {}) => {
    if (opts.soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      // โหลดตามช่วงวันที่จริง (ไม่ใช้ breakdown_list แบบ limit ล่าสุด — ทำให้วัน/ดูทั้งหมดเพี้ยน)
      const rep = await fetchRepairs(dateRange.start, dateRange.end);
      let list = (rep.rows || []).filter(isBreakdownRow);

      // ถ้า list_repair ไม่ติด tag เสียกลางทาง ลองเสริมจาก breakdown_list แล้วกรองวัน
      if (list.length === 0) {
        try {
          const data = await fetchBreakdowns({ limit: 500 });
          const startStr = fmtDate(dateRange.start);
          const endStr = fmtDate(dateRange.end);
          list = (data.rows || []).filter((r) => {
            const day = String(r.r_dt_rec || '').slice(0, 10);
            return day >= startStr && day <= endStr;
          });
        } catch (_) {
          /* keep empty */
        }
      }

      setRows(list);
    } catch (e) {
      setError(e.message || 'โหลดไม่สำเร็จ');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    load({ soft: hasLoaded.current });
    hasLoaded.current = true;
  }, [load]);

  const dayStats = useMemo(() => {
    const days = eachDay(dateRange.start, dateRange.end).reverse();
    const map = {};
    days.forEach((d) => {
      map[d] = { open: 0, closed: 0 };
    });
    rows.forEach((r) => {
      const day = String(r.r_dt_rec || '').slice(0, 10);
      if (!map[day]) map[day] = { open: 0, closed: 0 };
      if (isOpenRepair(r)) map[day].open += 1;
      else map[day].closed += 1;
    });
    return days.map((d) => ({
      date: d,
      open: map[d].open,
      closed: map[d].closed,
      total: map[d].open + map[d].closed,
    }));
  }, [rows, dateRange.start, dateRange.end]);

  const total = rows.length;
  const max = Math.max(...dayStats.map((d) => d.total), 1);

  const openBreakdown = (day) => {
    const start = day || fmtDate(dateRange.start);
    const end = day || fmtDate(dateRange.end);
    navigation.navigate('Breakdown', {
      date: start,
      dateEnd: end,
      datePreset: day ? 'custom' : datePreset,
    });
  };

  const showLoader = loading && rows.length === 0;

  return (
    <Card
      starred
      title="เสียกลางทาง"
      style={style}
      headerRight={
        <Pressable onPress={() => openBreakdown(null)}>
          <Text style={styles.viewAll}>ดูทั้งหมด ›</Text>
        </Pressable>
      }
    >
      <DateRangePicker
        value={dateRange}
        presetKey={datePreset}
        onChange={(range, key) => {
          setDateRange(range);
          setDatePreset(key);
        }}
      />

      {showLoader ? (
        <View style={styles.loaderBox}>
          <CircularLoader size={48} />
          <Text style={styles.loaderText}>กำลังโหลด...</Text>
        </View>
      ) : error && rows.length === 0 ? (
        <View style={styles.loaderBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retry}>
            <Text style={styles.retryText}>ลองใหม่</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.summary}>
            รวม <Text style={styles.summaryNum}>{total}</Text> งาน
            {refreshing ? ' · กำลังอัปเดต...' : ''}
          </Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#E5544B' }]} />
              <Text style={styles.legendText}>ปิดงาน</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#1FA97A' }]} />
              <Text style={styles.legendText}>เปิดงาน</Text>
            </View>
          </View>
          <ScrollView style={styles.list} nestedScrollEnabled>
            {dayStats.map((d) => {
              const openPct = d.total > 0 ? d.open / max : 0;
              const closedPct = d.total > 0 ? d.closed / max : 0;
              return (
                <Pressable
                  key={d.date}
                  style={styles.row}
                  onPress={() => openBreakdown(d.date)}
                >
                  <Text style={styles.dateLabel}>{fmtThaiDate(d.date)}</Text>
                  <View style={styles.barWrap}>
                    <View style={styles.track}>
                      {d.closed > 0 ? (
                        <View
                          style={[
                            styles.fill,
                            { width: `${closedPct * 100}%`, backgroundColor: '#E5544B' },
                          ]}
                        />
                      ) : null}
                      {d.open > 0 ? (
                        <View
                          style={[
                            styles.fill,
                            { width: `${openPct * 100}%`, backgroundColor: '#1FA97A' },
                          ]}
                        />
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.value, d.total === 0 && styles.valueEmpty]}>{d.total}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  viewAll: { color: colors.barFillAlt, fontWeight: '800', fontSize: 12 },
  loaderBox: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loaderText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  errorText: { color: '#E5544B', fontSize: 13, textAlign: 'center' },
  retry: {
    marginTop: spacing.sm,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  retryText: { color: colors.onNavy, fontWeight: '700' },
  summary: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
  summaryNum: { color: colors.navy, fontWeight: '800' },
  legend: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  dot: { width: 10, height: 10, borderRadius: 2 },
  list: { maxHeight: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 10,
  },
  dateLabel: { width: 88, color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  barWrap: { flex: 1 },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EEF1F7',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 7 },
  value: {
    width: 28,
    textAlign: 'right',
    color: colors.navy,
    fontWeight: '800',
    fontSize: 13,
  },
  valueEmpty: { color: colors.textMuted, fontWeight: '600' },
});
