import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { RefreshControl } from '../components/AppRefreshControl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import {
  fetchVehicleHistory,
  fmtDateTime,
  isOpenRepair,
} from '../data/api';

const FIELDS = [
  ['v_id', 'ID รถ'],
  ['v_name', 'เบอร์รถ'],
  ['v_plate', 'ทะเบียน'],
  ['v_brand', 'ยี่ห้อ'],
  ['v_model', 'รุ่น'],
  ['v_chassis', 'เลขตัวถัง'],
  ['v_metr', 'ความยาว (เมตร)'],
  ['v_route', 'เส้นทาง'],
  ['v_class', 'ประเภท/มาตรฐาน'],
  ['v_engine', 'เครื่องยนต์'],
  ['v_company', 'บริษัท'],
  ['inv_company', 'ออกบิลในนาม'],
  ['v_register', 'วันจดทะเบียน'],
  ['v_note', 'หมายเหตุ'],
];

export default function VehicleDetailScreen({ route, navigation }) {
  const { vehicle } = route.params ?? {};
  const v = vehicle || {};
  const rows = FIELDS.filter(([key]) => v[key] !== undefined && v[key] !== null && v[key] !== '');
  const { isMobile, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [histError, setHistError] = useState(null);

  const loadHistory = useCallback(async (soft = false) => {
    if (!v.v_id && !v.v_name && !v.v_plate) {
      setLoadingHist(false);
      return;
    }
    if (soft) setRefreshing(true);
    else setLoadingHist(true);
    setHistError(null);
    try {
      const data = await fetchVehicleHistory({
        vId: v.v_id,
        vName: v.v_name,
        vPlate: v.v_plate,
      });
      setHistory(data.rows || []);
    } catch (e) {
      setHistError(e.message || 'โหลดประวัติไม่สำเร็จ');
    } finally {
      setLoadingHist(false);
      setRefreshing(false);
    }
  }, [v.v_id, v.v_name, v.v_plate]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ข้อมูลรถ</Text>
          <Text style={styles.headerSub} numberOfLines={2}>
            {v.v_name || `ID ${v.v_id}`} · {[v.v_brand, v.v_model].filter(Boolean).join(' ')}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} tintColor={colors.navy} />
          }
        >
          <View style={styles.card}>
            {rows.map(([key, label], i) => (
              <View key={key} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>{String(v[key])}</Text>
              </View>
            ))}
          </View>

          <View style={styles.histHead}>
            <Text style={styles.histTitle}>ประวัติแจ้งซ่อม</Text>
            <Text style={styles.histCount}>{history.length} รายการ</Text>
          </View>

          {loadingHist ? (
            <LoadingView compact />
          ) : histError ? (
            <Text style={styles.msg}>{histError}</Text>
          ) : history.length === 0 ? (
            <Text style={styles.msg}>ยังไม่มีประวัติซ่อมของรถคันนี้</Text>
          ) : (
            history.map((r) => {
              const open = isOpenRepair(r);
              return (
                <Pressable
                  key={r.r_id}
                  style={({ pressed }) => [styles.histCard, pressed && { opacity: 0.85 }]}
                  onPress={() => navigation.navigate('RepairDetail', { repair: r, rId: r.r_id })}
                >
                  <View style={styles.histTop}>
                    <Text style={styles.histCode}>
                      {r.r_dt_rec ? fmtDateTime(r.r_dt_rec) : ''} · #{r.r_job_num || r.r_id}
                    </Text>
                    <Text style={{ color: open ? '#1FA97A' : '#E5544B', fontWeight: '700', fontSize: 11 }}>
                      {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
                    </Text>
                  </View>
                  <Text style={styles.histList}>{r.r_repair_list || '-'}</Text>
                  <Text style={styles.histMeta}>ผู้ซ่อม: {r.r_technician || 'ไม่ระบุ'}</Text>
                </Pressable>
              );
            })
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
    gap: spacing.md,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, ...shadow },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { color: colors.textSecondary, fontSize: 13, flexShrink: 0 },
  value: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  histHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  histTitle: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  histCount: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  histCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  histCode: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', flex: 1 },
  histList: { color: colors.textPrimary, fontWeight: '700', marginTop: 6 },
  histMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  msg: { color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.md },
});
