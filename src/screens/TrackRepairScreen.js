import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import RepairStatusTimeline from '../components/RepairStatusTimeline';
import AppRefreshControl from '../components/AppRefreshControl';
import StatusHero from '../components/StatusHero';
import { fetchTrackByToken, fmtDateTime } from '../data/api';
import { parseTrackToken } from '../data/repairTracking';
import { parseRepairList } from '../data/repairNotes';

export default function TrackRepairScreen({ navigation, route }) {
  const initialToken = route?.params?.token || '';
  const { isMobile, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();

  const [tokenInput, setTokenInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [showSearch, setShowSearch] = useState(!initialToken);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!initialToken);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (token) => {
    const t = parseTrackToken(token || '');
    if (!t) {
      setData(null);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetchTrackByToken(t);
      setData(res);
      setActiveToken(t);
      setShowSearch(false);
    } catch (e) {
      setData(null);
      setError(e.message || 'ไม่พบใบงานนี้ — ตรวจลิงก์ / QR อีกครั้ง');
      setShowSearch(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialToken) load(initialToken);
  }, [initialToken, load]);

  useFocusEffect(
    useCallback(() => {
      if (activeToken) load(activeToken);
    }, [activeToken, load])
  );

  const onSearch = () => load(tokenInput);

  const onRefresh = () => {
    setRefreshing(true);
    load(activeToken || tokenInput);
  };

  const row = data?.row;
  const meta = data?.meta;
  const parsed = row ? parseRepairList(row.r_repair_list) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ติดตามสถานะ</Text>
          <Text style={styles.headerSub}>เปิดจาก QR หรือวางลิงก์ที่ได้ตอนแจ้ง</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {showSearch ? (
            <View style={[styles.searchCard, isMobile && styles.searchCardMobile]}>
              <Text style={styles.searchLabel}>วางลิงก์หรือรหัสจาก QR</Text>
              <TextInput
                style={[styles.input, isMobile && styles.inputMobile]}
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="https://.../track/xxxxx"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable style={styles.searchBtn} onPress={onSearch}>
                <Text style={styles.searchBtnText}>ดูสถานะ</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.changeLink} onPress={() => setShowSearch(true)}>
              <Text style={styles.changeLinkText}>เปลี่ยน QR / ลิงก์อื่น</Text>
            </Pressable>
          )}

          {loading ? (
            <LoadingView compact message="กำลังโหลดสถานะ..." />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={onSearch}>
                <Text style={styles.retryText}>ลองอีกครั้ง</Text>
              </Pressable>
            </View>
          ) : data && row ? (
            <>
              <StatusHero
                status={meta?.public_status}
                jobNum={row.r_job_num || row.r_id}
                subtitle={
                  meta?.reporter_name
                    ? `แจ้งโดย ${meta.reporter_name}${meta.reporter_phone ? ` · ${meta.reporter_phone}` : ''}`
                    : undefined
                }
              />

              <View style={styles.card}>
                <Text style={styles.cardTitle}>รายละเอียด</Text>
                <Text style={styles.meta}>
                  รถ: {[row.r_v_plate, row.r_v_name].filter(Boolean).join(' · ') || '—'}
                </Text>
                {parsed?.symptom ? (
                  <>
                    <Text style={styles.blockLabel}>อาการ</Text>
                    <Text style={styles.blockValue}>{parsed.symptom}</Text>
                  </>
                ) : null}
                {parsed?.location ? (
                  <>
                    <Text style={styles.blockLabel}>สถานที่</Text>
                    <Text style={styles.blockValue}>{parsed.location}</Text>
                  </>
                ) : null}
                {row.r_technician ? (
                  <Text style={styles.meta}>ช่าง: {row.r_technician}</Text>
                ) : null}
                {row.r_dt_rec ? (
                  <Text style={styles.metaMuted}>แจ้งเมื่อ {fmtDateTime(row.r_dt_rec)}</Text>
                ) : null}
              </View>

              <Text style={styles.sectionTitle}>ความคืบหน้า</Text>
              <View style={styles.timelineCard}>
                <RepairStatusTimeline timeline={data.timeline || []} currentStatus={meta?.public_status} />
              </View>
              <Text style={styles.pullHint}>ดึงลงเพื่อรีเฟรชสถานะ</Text>

              {(data.images || []).length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>รูปที่แนบ</Text>
                  <View style={styles.gallery}>
                    {data.images.map((img) => (
                      <Image key={img.id} source={{ uri: img.url }} style={styles.thumb} />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>ยังไม่มีข้อมูล</Text>
              <Text style={styles.emptySub}>สแกน QR จากใบแจ้ง หรือวางลิงก์ด้านบน</Text>
              <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('PublicReport')}>
                <Text style={styles.emptyBtnText}>แจ้งซ่อมใหม่</Text>
              </Pressable>
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
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
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
  searchCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadow,
  },
  searchCardMobile: { padding: spacing.md },
  searchLabel: { fontWeight: '800', color: colors.navy, fontSize: 14 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  inputMobile: { minHeight: 48, fontSize: 16 },
  searchBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  searchBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 16 },
  changeLink: { alignSelf: 'flex-end', marginBottom: spacing.sm, paddingVertical: 4 },
  changeLinkText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  cardTitle: { fontWeight: '800', color: colors.navy, fontSize: 15, marginBottom: spacing.sm },
  meta: { color: colors.textPrimary, fontSize: 14, marginTop: 4, fontWeight: '600' },
  metaMuted: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
  blockLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: spacing.md },
  blockValue: { color: colors.textPrimary, fontSize: 15, marginTop: 2, lineHeight: 22 },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: '800', color: colors.navy, fontSize: 15 },
  timelineCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  pullHint: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: 10, backgroundColor: colors.navyTint },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyTitle: { fontWeight: '800', color: colors.navy, fontSize: 18 },
  emptySub: { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  emptyBtnText: { color: colors.onNavy, fontWeight: '800' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  error: { color: '#B91C1C', fontWeight: '700', textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, backgroundColor: colors.navy, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
  retryText: { color: colors.onNavy, fontWeight: '800' },
});
