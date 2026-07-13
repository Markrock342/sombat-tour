import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import { globalSearch, fmtDateTime, isOpenRepair } from '../data/api';

const TYPE_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'repair', label: 'งานซ่อม' },
  { key: 'vehicle', label: 'รถ' },
];

const STATUS_FILTERS = [
  { key: '', label: 'ทุกสถานะ' },
  { key: 'open', label: 'กำลังซ่อม' },
  { key: 'closed', label: 'ปิดงานแล้ว' },
];

export default function SearchScreen({ navigation, route }) {
  const initialQ = route?.params?.q || '';
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [repairs, setRepairs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const timer = useRef(null);
  const isMobile = useIsMobile();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const goBack = () => navigation.goBack();

  const runSearch = useMemo(
    () => async (term, t, st) => {
      const trimmed = (term || '').trim();
      if (!trimmed) {
        setRepairs([]);
        setVehicles([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const data = await globalSearch({
          q: trimmed,
          type: t,
          status: t === 'vehicle' ? '' : st,
          limit: 50,
        });
        setRepairs(data.repairs || []);
        setVehicles(data.vehicles || []);
      } catch (e) {
        setError(e.message || 'ค้นหาไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(q, type, status), 350);
    return () => clearTimeout(timer.current);
  }, [q, type, status, runSearch]);

  const empty = searched && !loading && !error && repairs.length === 0 && vehicles.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={styles.headerTitle}>ค้นหา</Text>
          <Text style={styles.headerSub}>พิมพ์อะไรก็ได้ — งานซ่อม / รถ / ทะเบียน / ช่าง</Text>
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="ค้นหาทุกอย่าง..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoFocus
          />
        </View>

        <View style={styles.chipWrap}>
          {TYPE_FILTERS.map((f) => {
            const active = type === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setType(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {type !== 'vehicle' ? (
          <View style={styles.chipWrap}>
            {STATUS_FILTERS.map((f) => {
              const active = status === f.key;
              return (
                <Pressable
                  key={f.key || 'allst'}
                  onPress={() => setStatus(f.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <LoadingView compact />
          ) : error ? (
            <Text style={styles.msg}>{error}</Text>
          ) : !searched ? (
            <Text style={styles.msg}>เริ่มพิมพ์เพื่อค้นหาจากทุกตาราง</Text>
          ) : empty ? (
            <Text style={styles.msg}>ไม่พบผลลัพธ์</Text>
          ) : (
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {type !== 'vehicle' &&
                repairs.map((r) => {
                  const open = isOpenRepair(r);
                  return (
                    <Pressable
                      key={`r-${r.r_id}`}
                      style={({ pressed }) => [styles.card, isWide && styles.cardWide, pressed && styles.pressed]}
                      onPress={() => navigation.navigate('RepairDetail', { repair: r, rId: r.r_id })}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.badge}>งานซ่อม</Text>
                        <Text style={[styles.status, { color: open ? '#1FA97A' : '#E5544B' }]}>
                          {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
                        </Text>
                      </View>
                      <Text style={styles.title}>{r.r_repair_list || 'งานแจ้งซ่อม'}</Text>
                      <Text style={styles.sub}>
                        #{r.r_job_num || r.r_id}
                        {r.r_dt_rec ? ` · ${fmtDateTime(r.r_dt_rec)}` : ''}
                      </Text>
                      <Text style={styles.sub}>
                        {[r.r_v_name, r.r_v_plate, r.r_technician].filter(Boolean).join(' · ')}
                      </Text>
                    </Pressable>
                  );
                })}
              {type !== 'repair' &&
                vehicles.map((v) => (
                  <Pressable
                    key={`v-${v.v_id}`}
                    style={({ pressed }) => [styles.card, isWide && styles.cardWide, pressed && styles.pressed]}
                    onPress={() => navigation.navigate('VehicleDetail', { vehicle: v })}
                  >
                    <Text style={styles.badge}>รถ</Text>
                    <Text style={styles.title}>{v.v_name || `ID ${v.v_id}`}</Text>
                    <Text style={styles.sub}>
                      {[v.v_brand, v.v_model].filter(Boolean).join(' ')} · ทะเบียน {v.v_plate || '-'}
                    </Text>
                  </Pressable>
                ))}
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
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  searchBar: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipActive: { backgroundColor: colors.barFillAlt, borderColor: colors.barFillAlt },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.onNavy },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  cardWide: { flexBasis: '30%', flexGrow: 1, minWidth: 260 },
  pressed: { opacity: 0.85 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.navyTint,
    color: colors.navy,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  status: { fontSize: 12, fontWeight: '700' },
  title: { color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sub: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  msg: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
});
