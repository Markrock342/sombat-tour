import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import CircularLoader from '../components/CircularLoader';
import { fetchBreakdowns, fmtDateTime, isOpenRepair } from '../data/api';

export default function BreakdownScreen({ navigation }) {
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (term = q) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBreakdowns({ q: term.trim(), limit: 150 });
      setRows(data.rows || []);
    } catch (e) {
      setError(e.message || 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useFocusEffect(
    useCallback(() => {
      load('');
    }, [])
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
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={styles.headerTitle}>เสียกลางทาง</Text>
          <Text style={styles.headerSub}>งานแจ้งซ่อมระหว่างทาง · กดเพื่อดูรายละเอียด</Text>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="กรองทุกฟิลด์..."
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
          <Text style={styles.newBtnText}>+ แจ้งเสียกลางทาง</Text>
        </Pressable>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
        >
          {loading ? (
            <View style={styles.center}>
              <CircularLoader size={52} />
              <Text style={styles.loadingText}>กำลังโหลด...</Text>
            </View>
          ) : error ? (
            <Text style={styles.msg}>{error}</Text>
          ) : sorted.length === 0 ? (
            <Text style={styles.msg}>ไม่มีรายการเสียกลางทาง</Text>
          ) : (
            sorted.map((r) => {
              const open = isOpenRepair(r);
              return (
                <Pressable
                  key={r.r_id}
                  style={({ pressed }) => [
                    styles.card,
                    open && styles.cardPriority,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => navigation.navigate('RepairDetail', { repair: r, rId: r.r_id })}
                >
                  <View style={styles.topRow}>
                    <Text style={styles.time}>{r.r_dt_rec ? fmtDateTime(r.r_dt_rec) : '-'}</Text>
                    <Text style={styles.id}>#{r.r_job_num || r.r_id}</Text>
                  </View>
                  <Text style={styles.tech}>{r.r_technician || 'ไม่ระบุช่าง'}</Text>
                  <Text style={styles.vehicle}>
                    {[r.r_v_brand, r.r_v_model].filter(Boolean).join(' ') || 'ไม่ระบุรุ่น'}
                    {r.r_v_name ? ` · ${r.r_v_name}` : ''}
                    {r.r_tank_m ? ` · ถัง ${r.r_tank_m} ม.` : ''}
                  </Text>
                  <Text style={styles.plate}>{r.r_v_plate || '-'}</Text>
                  <Text style={styles.list} numberOfLines={2}>{r.r_repair_list}</Text>
                  <Text style={[styles.status, { color: open ? '#1FA97A' : '#9AA3B8' }]}>
                    {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
                  </Text>
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
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
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
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  newBtnText: { color: colors.onNavy, fontWeight: '800' },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  cardPriority: {
    borderLeftWidth: 4,
    borderLeftColor: '#E5544B',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  time: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  id: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  tech: { color: colors.navy, fontSize: 15, fontWeight: '800', marginTop: 2 },
  vehicle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  plate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  list: { color: colors.textPrimary, fontSize: 13, marginTop: 8, lineHeight: 18 },
  status: { marginTop: 8, fontSize: 11, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: spacing.xl * 2, gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontWeight: '600' },
  msg: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
});
