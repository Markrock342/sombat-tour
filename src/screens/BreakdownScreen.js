import React, { useCallback, useMemo, useRef, useState } from 'react';
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

import { colors, spacing, radius } from '../theme';
import {
  TopBackLink,
  MobileBackBar,
  useScreenLayout,
  mobileScrollInset,
  contentSheetStyle,
} from '../components/BackNavigation';
import CircularLoader from '../components/CircularLoader';
import RepairJobCard, { mapRepairToCardJob, jobCardSearchHay } from '../components/RepairJobCard';
import { fetchBreakdowns, fetchRepairs, isBreakdownRepair } from '../data/api';
import { presetRange } from '../components/DateRangePicker';

export default function BreakdownScreen({ navigation }) {
  const { isMobile, isWide, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const sheetStyle = contentSheetStyle(centerContent, Math.max(contentMaxWidth, isWide ? 1180 : 640));
  const goBack = () => navigation.goBack();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoaded = useRef(false);

  const load = useCallback(async (opts = {}) => {
    if (opts.soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let list = [];
      try {
        // โหลดทั้งหมดแล้วกรองฝั่ง client — ค้นหาไม่บัคตอนเคลียร์ช่อง / กดค้นซ้ำ
        const data = await fetchBreakdowns({ q: '', limit: 300 });
        list = data.rows || [];
      } catch (_) {
        const range = presetRange('365d');
        const rep = await fetchRepairs(range.start, range.end);
        list = (rep.rows || []).filter(isBreakdownRepair);
      }
      // เรียงวันเวลาใหม่ → เก่า เหมือนรายการแจ้งซ่อม / งานค้าง
      list = [...list].sort((a, b) =>
        String(b.r_dt_rec || '').localeCompare(String(a.r_dt_rec || ''))
      );
      setRows(list);
    } catch (e) {
      setError(e.message || 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load({ soft: hasLoaded.current });
      hasLoaded.current = true;
    }, [load])
  );

  const visibleJobs = useMemo(() => {
    const term = q.trim().toLowerCase();
    const mapped = rows.map((r, i) => mapRepairToCardJob(r, i));
    const filtered = term
      ? mapped.filter((job) => jobCardSearchHay(job).includes(term))
      : mapped;
    return filtered.map((job, i) => ({ ...job, displayId: i + 1 }));
  }, [rows, q]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View
          style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}
        >
          <View style={[styles.headerInner, sheetStyle]}>
            {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
            <Text style={[styles.headerTitle, { fontSize: titleSize }]}>เสียกลางทาง</Text>
            {!isMobile ? (
              <Text style={styles.headerSub}>งานแจ้งซ่อมระหว่างทาง · กดเพื่อดูรายละเอียด</Text>
            ) : null}
          </View>
        </View>

        <View
          style={[styles.toolbar, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}
        >
          <View style={[sheetStyle, styles.toolbarInner]}>
            <View style={styles.searchBar}>
              <TextInput
                style={styles.input}
                value={q}
                onChangeText={setQ}
                placeholder="ค้นเลขงาน · ทะเบียน · ช่าง · อาการ..."
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {q.trim() ? (
                <Pressable style={styles.clearBtn} onPress={() => setQ('')}>
                  <Text style={styles.clearBtnText}>ล้าง</Text>
                </Pressable>
              ) : null}
            </View>
            {/* + แจ้งเสียกลางทาง — ซ่อนไว้ก่อน */}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scroll,
            centerContent && styles.scrollCentered,
            isMobile && mobileScrollInset,
            visibleJobs.length === 0 && !loading && styles.scrollEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ soft: true })}
              tintColor={colors.navy}
            />
          }
        >
          <View style={sheetStyle}>
            {loading && !refreshing ? (
              <View style={styles.center}>
                <CircularLoader size={52} />
                <Text style={styles.loadingText}>กำลังโหลด...</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.msg}>{error}</Text>
                <Pressable style={styles.retryBtn} onPress={() => load()}>
                  <Text style={styles.retryText}>ลองใหม่</Text>
                </Pressable>
              </View>
            ) : visibleJobs.length === 0 ? (
              <Text style={styles.msg}>
                {q.trim() ? 'ไม่พบรายการที่ตรงกับคำค้น' : 'ไม่มีรายการเสียกลางทาง'}
              </Text>
            ) : (
              <View style={[styles.grid, isWide && styles.gridWide]}>
                {!loading ? (
                  <Text style={[styles.countLabel, isWide && styles.countLabelWide]}>
                    {q.trim()
                      ? `${visibleJobs.length} จาก ${rows.length} งาน`
                      : `${rows.length} งาน`}
                  </Text>
                ) : null}
                {visibleJobs.map((job) => (
                  <RepairJobCard
                    key={`${job.rId}-${job.code}`}
                    job={job}
                    accent="breakdown"
                    style={isWide ? styles.cardWide : styles.cardFull}
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
  header: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headerCentered: { alignItems: 'center' },
  headerInner: { width: '100%' },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  toolbar: { paddingBottom: spacing.sm },
  toolbarInner: { width: '100%', gap: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  clearBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  clearBtnText: { color: colors.onNavy, fontWeight: '800' },
  newBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  newBtnText: { color: colors.onNavy, fontWeight: '800' },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollCentered: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  scrollEmpty: { flexGrow: 1 },
  grid: { gap: spacing.lg },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    gap: spacing.lg,
    rowGap: spacing.lg,
    columnGap: spacing.lg,
  },
  countLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  countLabelWide: { flexBasis: '100%', width: '100%' },
  cardFull: { width: '100%' },
  cardWide: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '22%',
    minWidth: 240,
    maxWidth: '100%',
  },
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
