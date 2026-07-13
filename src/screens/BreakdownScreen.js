import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { RefreshControl } from '../components/AppRefreshControl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import CircularLoader from '../components/CircularLoader';
import { fetchBreakdowns, fetchRepairs, fmtDateTime, isOpenRepair, isBreakdownRepair } from '../data/api';
import { presetRange } from '../components/DateRangePicker';

function StatusPill({ closed }) {
  return (
    <View style={[styles.pill, { backgroundColor: closed ? '#E5544B' : '#1FA97A' }]}>
      <Text style={styles.pillText}>{closed ? 'ปิดงานแล้ว' : 'กำลังซ่อม'}</Text>
    </View>
  );
}

export default function BreakdownScreen({ navigation }) {
  const { isMobile, isWide, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoaded = useRef(false);

  const load = useCallback(async (term = q, opts = {}) => {
    if (opts.soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let list = [];
      try {
        const data = await fetchBreakdowns({ q: term.trim(), limit: 150 });
        list = data.rows || [];
      } catch (_) {
        const range = presetRange('365d');
        const rep = await fetchRepairs(range.start, range.end);
        list = (rep.rows || []).filter(isBreakdownRepair);
        if (term.trim()) {
          const t = term.trim().toLowerCase();
          list = list.filter((r) => {
            const hay = [
              r.r_id, r.r_job_num, r.r_dt_rec, r.r_technician, r.r_v_name, r.r_v_plate,
              r.r_v_brand, r.r_v_model, r.r_tank_m, r.r_repair_list, r.r_mile,
            ]
              .map((x) => String(x || '').toLowerCase())
              .join(' ');
            return hay.includes(t);
          });
        }
      }
      setRows(list);
    } catch (e) {
      setError(e.message || 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      load('', { soft: hasLoaded.current });
      hasLoaded.current = true;
    }, [load])
  );

  const filtered = rows.filter((r) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const hay = [
      r.r_id, r.r_job_num, r.r_dt_rec, r.r_technician, r.r_v_name, r.r_v_plate,
      r.r_v_brand, r.r_v_model, r.r_tank_m, r.r_repair_list, r.r_mile,
    ]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    return hay.includes(term);
  });

  const sorted = [...filtered].sort((a, b) => {
    const ao = isOpenRepair(a) ? 0 : 1;
    const bo = isOpenRepair(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return String(b.r_dt_rec || '').localeCompare(String(a.r_dt_rec || ''));
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>เสียกลางทาง</Text>
          {!isMobile ? (
            <Text style={styles.headerSub}>งานแจ้งซ่อมระหว่างทาง · กดเพื่อดูรายละเอียด</Text>
          ) : null}
        </View>

        <View style={[styles.toolbar, { paddingHorizontal: pad }]}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.input}
              value={q}
              onChangeText={setQ}
              placeholder="กรอง..."
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={styles.searchBtn} onPress={() => load(q)}>
              <Text style={styles.searchBtnText}>ค้น</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.newBtn}
            onPress={() => navigation.navigate('RepairForm', { type: 'breakdown' })}
          >
            <Text style={styles.newBtnText}>{isMobile ? '+ แจ้ง' : '+ แจ้งเสียกลางทาง'}</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scroll,
            isMobile && mobileScrollInset,
            sorted.length === 0 && !loading && styles.scrollEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(q, { soft: true })}
              tintColor={colors.navy}
            />
          }
        >
          {loading && !refreshing ? (
            <View style={styles.center}>
              <CircularLoader size={52} />
              <Text style={styles.loadingText}>กำลังโหลด...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.msg}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => load(q)}>
                <Text style={styles.retryText}>ลองใหม่</Text>
              </Pressable>
            </View>
          ) : sorted.length === 0 ? (
            <Text style={styles.msg}>ไม่มีรายการเสียกลางทาง</Text>
          ) : (
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {sorted.map((r, idx) => {
                const open = isOpenRepair(r);
                const code = r.r_job_num || r.r_id;
                const model = [r.r_v_brand, r.r_v_model].filter(Boolean).join(' ');
                return (
                  <Pressable
                    key={r.r_id}
                    style={({ pressed }) => [
                      styles.jobCard,
                      isWide ? styles.jobCardWide : styles.jobCardFull,
                      !open && styles.jobCardClosed,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => navigation.navigate('RepairDetail', { repair: r, rId: r.r_id })}
                  >
                    <View style={styles.jobTopRow}>
                      <View style={styles.indexBadge}>
                        <Text style={styles.indexText}>{idx + 1}</Text>
                      </View>
                      <StatusPill closed={!open} />
                    </View>

                    <Text style={styles.jobCode}>
                      {r.r_dt_rec ? `${fmtDateTime(r.r_dt_rec)} | ` : ''}
                      {code}
                    </Text>

                    <View style={styles.vehicleBox}>
                      {r.r_v_name ? (
                        <Text style={styles.vehicleNo} numberOfLines={1}>
                          🚚 {r.r_v_name}
                        </Text>
                      ) : null}
                      <Text style={styles.jobDetail} numberOfLines={2}>
                        {r.r_v_plate || '-'}
                        {r.r_v_chassis ? ` • ${r.r_v_chassis}` : ''}
                      </Text>
                      {model ? <Text style={styles.jobDetail}>{model}</Text> : null}
                      <Text style={styles.jobDetail}>
                        ผู้ซ่อม: {r.r_technician || 'ไม่ระบุ'}
                        {r.r_mile && Number(r.r_mile) > 0
                          ? ` • ไมล์ ${Number(r.r_mile).toLocaleString()}`
                          : ''}
                        {r.r_tank_m ? ` • ถัง ${r.r_tank_m} ม.` : ''}
                      </Text>
                      {r.r_v_company ? (
                        <Text style={styles.jobDetail} numberOfLines={1}>
                          {r.r_v_company}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.jobTitle} numberOfLines={3}>
                      {r.r_repair_list || 'ไม่ระบุอาการ'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
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
  header: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: colors.barFillAlt,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  searchBtnText: { color: colors.onNavy, fontWeight: '800' },
  newBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  newBtnText: { color: colors.onNavy, fontWeight: '800' },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  scrollEmpty: { flexGrow: 1 },
  grid: { gap: spacing.sm },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#E5544B',
    ...shadow,
  },
  jobCardFull: { width: '100%' },
  jobCardWide: { flexBasis: '31%', flexGrow: 1, minWidth: 260 },
  jobCardClosed: { borderLeftColor: colors.textMuted, opacity: 0.92 },
  pressed: { opacity: 0.85 },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
  jobCode: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  vehicleBox: {
    backgroundColor: '#F3F5FB',
    borderLeftWidth: 3,
    borderLeftColor: colors.barFill,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  vehicleNo: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  jobDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 1 },
  jobTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: 4,
    backgroundColor: '#FFF0C2',
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontWeight: '600' },
  msg: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
  retryBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  retryText: { color: colors.onNavy, fontWeight: '700' },
});
