import React, { useEffect, useRef, useState } from 'react';
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
import { parseRepairList } from '../data/repairNotes';

const TYPE_FILTERS = [
  { key: 'all', label: 'ทั้งหมด', hint: 'งาน+รถ' },
  { key: 'repair', label: 'งานซ่อม', hint: 'ใบแจ้งซ่อม' },
  { key: 'vehicle', label: 'รถ', hint: 'เบอร์/ทะเบียน' },
];

const STATUS_FILTERS = [
  { key: '', label: 'ทุกสถานะ' },
  { key: 'open', label: 'กำลังซ่อม' },
  { key: 'closed', label: 'ปิดงานแล้ว' },
];

const KIND_FILTERS = [
  { key: '', label: 'ทุกประเภท' },
  { key: 'breakdown', label: 'เสียกลางทาง' },
  { key: 'normal', label: 'ซ่อมปกติ' },
];

const SORT_REPAIR = [
  { key: 'date_desc', label: 'ใหม่ → เก่า' },
  { key: 'date_asc', label: 'เก่า → ใหม่' },
  { key: 'job_num', label: 'เลขงาน' },
  { key: 'plate', label: 'ทะเบียน' },
  { key: 'tech', label: 'ชื่อช่าง' },
];

const SORT_VEHICLE = [
  { key: 'date_desc', label: 'ใหม่ → เก่า' },
  { key: 'date_asc', label: 'เก่า → ใหม่' },
  { key: 'plate', label: 'ทะเบียน' },
  { key: 'name', label: 'ชื่อรถ' },
];

function Segmented({ options, value, onChange, large }) {
  return (
    <View style={[styles.segment, large && styles.segmentLarge]}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key || opt.label}
            onPress={() => onChange(opt.key)}
            style={[styles.segmentItem, large && styles.segmentItemLarge, active && styles.segmentItemActive]}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
            {large && opt.hint ? (
              <Text style={[styles.segmentHint, active && styles.segmentHintActive]}>{opt.hint}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key || opt.label}
            onPress={() => onChange(opt.key)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function SearchScreen({ navigation, route }) {
  const initialQ = route?.params?.q || '';
  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [jobKind, setJobKind] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [repairs, setRepairs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const timer = useRef(null);
  const reqSeq = useRef(0);
  const isMobile = useIsMobile();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const goBack = () => navigation.goBack();

  useEffect(() => {
    if (type === 'vehicle' && !['date_desc', 'date_asc', 'plate', 'name'].includes(sort)) {
      setSort('date_desc');
    }
  }, [type, sort]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    const trimmed = (q || '').trim();
    // Allow browsing vehicles / open jobs without typing when filters alone are enough
    const canRunWithoutQ = type === 'vehicle' || (type === 'repair' && (status || jobKind));

    if (!trimmed && !canRunWithoutQ) {
      setRepairs([]);
      setVehicles([]);
      setSearched(false);
      setLoading(false);
      setError(null);
      return undefined;
    }

    timer.current = setTimeout(async () => {
      const seq = ++reqSeq.current;
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const data = await globalSearch({
          q: trimmed,
          type,
          status: type === 'vehicle' ? '' : status,
          jobKind: type === 'vehicle' ? '' : jobKind,
          sort,
          limit: 60,
        });
        if (seq !== reqSeq.current) return; // stale response
        setRepairs(data.repairs || []);
        setVehicles(data.vehicles || []);
      } catch (e) {
        if (seq !== reqSeq.current) return;
        setError(e.message || 'ค้นหาไม่สำเร็จ');
        setRepairs([]);
        setVehicles([]);
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    }, 320);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, type, status, jobKind, sort]);

  const repairCount = type === 'vehicle' ? 0 : repairs.length;
  const vehicleCount = type === 'repair' ? 0 : vehicles.length;
  const total = repairCount + vehicleCount;
  const empty = searched && !loading && !error && total === 0;

  const clearFilters = () => {
    setType('all');
    setStatus('');
    setJobKind('');
    setSort('date_desc');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={styles.headerTitle}>ค้นหา</Text>
          <Text style={styles.headerSub}>งานซ่อม · รถ · ทะเบียน · ช่าง · อะไหล่ในรายการ</Text>
        </View>

        <View style={styles.controls}>
          <View style={styles.searchShell}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.input}
              value={q}
              onChangeText={setQ}
              placeholder="พิมพ์คำค้น เช่น เบอร์รถ, ทะเบียน, ช่าง, อาการ..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              returnKeyType="search"
              autoFocus={!initialQ}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={10} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>ล้าง</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.filterLabel}>หมวด</Text>
          <Segmented options={TYPE_FILTERS} value={type} onChange={setType} large />

          {type !== 'vehicle' ? (
            <>
              <Text style={styles.filterLabel}>สถานะงาน</Text>
              <Segmented options={STATUS_FILTERS} value={status} onChange={setStatus} />

              <Text style={styles.filterLabel}>ประเภทงาน</Text>
              <ChipRow options={KIND_FILTERS} value={jobKind} onChange={setJobKind} />
            </>
          ) : null}

          <Text style={styles.filterLabel}>เรียงผลลัพธ์</Text>
          <ChipRow
            options={type === 'vehicle' ? SORT_VEHICLE : SORT_REPAIR}
            value={sort}
            onChange={setSort}
          />

          <View style={styles.filterMeta}>
            <Text style={styles.filterMetaText}>
              {loading ? 'กำลังค้นหา...' : searched ? `พบ ${total} รายการ` : 'ตั้งฟิลเตอร์ หรือพิมพ์คำค้น'}
            </Text>
            <Pressable onPress={clearFilters} hitSlop={8}>
              <Text style={styles.resetText}>รีเซ็ต</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <LoadingView compact />
          ) : error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>ค้นหาไม่สำเร็จ</Text>
              <Text style={styles.stateMsg}>{error}</Text>
            </View>
          ) : !searched ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>เริ่มค้นจากทุกตาราง</Text>
              <Text style={styles.stateMsg}>
                ลองพิมพ์เบอร์รถ / ทะเบียน / ชื่อช่าง / อาการซ่อม หรือเลือกหมวด “รถ” เพื่อดูรายการ
              </Text>
            </View>
          ) : empty ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>ไม่พบผลลัพธ์</Text>
              <Text style={styles.stateMsg}>ลองเปลี่ยนคำค้น หรือรีเซ็ตฟิลเตอร์</Text>
            </View>
          ) : (
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {type !== 'vehicle' &&
                repairs.map((r) => {
                  const open = isOpenRepair(r);
                  const parsed = parseRepairList(r.r_repair_list);
                  const title = parsed.symptom || r.r_repair_list || 'งานแจ้งซ่อม';
                  const isBreakdown =
                    r.r_type === 'breakdown' ||
                    r.r_type === 'roadside' ||
                    parsed.type === 'breakdown';
                  return (
                    <Pressable
                      key={`r-${r.r_id}`}
                      style={({ pressed }) => [
                        styles.card,
                        isWide && styles.cardWide,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        navigation.navigate('RepairDetail', { repair: r, rId: r.r_id })
                      }
                    >
                      <View style={styles.rowBetween}>
                        <View style={styles.badgeRow}>
                          <Text style={styles.badge}>งานซ่อม</Text>
                          {isBreakdown ? (
                            <Text style={[styles.badge, styles.badgeWarn]}>เสียกลางทาง</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.status, { color: open ? '#1FA97A' : '#E5544B' }]}>
                          {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
                        </Text>
                      </View>
                      <Text style={styles.title} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text style={styles.sub}>
                        #{r.r_job_num || r.r_id}
                        {r.r_dt_rec ? ` · ${fmtDateTime(r.r_dt_rec)}` : ''}
                      </Text>
                      <Text style={styles.sub}>
                        {[r.r_v_name, r.r_v_plate].filter(Boolean).join(' · ') || 'ไม่ระบุรถ'}
                      </Text>
                      <Text style={styles.sub}>
                        ช่าง {r.r_technician || 'ไม่ระบุ'}
                        {r.r_technician_id ? ` · #${r.r_technician_id}` : ''}
                      </Text>
                      {parsed.location ? (
                        <Text style={styles.subMuted}>ที่: {parsed.location}</Text>
                      ) : null}
                      {parsed.parts ? (
                        <Text style={styles.subMuted}>อะไหล่: {parsed.parts}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}

              {type !== 'repair' &&
                vehicles.map((v) => (
                  <Pressable
                    key={`v-${v.v_id}`}
                    style={({ pressed }) => [
                      styles.card,
                      isWide && styles.cardWide,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => navigation.navigate('VehicleDetail', { vehicle: v })}
                  >
                    <Text style={[styles.badge, styles.badgeVehicle]}>รถ</Text>
                    <Text style={styles.title}>{v.v_name || `ID ${v.v_id}`}</Text>
                    <Text style={styles.sub}>
                      {[v.v_brand, v.v_model].filter(Boolean).join(' ') || 'ไม่ระบุรุ่น'}
                    </Text>
                    <Text style={styles.sub}>ทะเบียน {v.v_plate || '-'} · ID {v.v_id}</Text>
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
  safe: { flex: 1, backgroundColor: colors.navyDeep },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  headerSub: { color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 4 },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 6,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    color: colors.barFillAlt,
    fontSize: 22,
    fontWeight: '700',
    marginRight: 8,
    marginTop: -2,
  },
  input: {
    flex: 1,
    color: colors.onNavy,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: { color: colors.barFillAlt, fontWeight: '800', fontSize: 12 },
  filterLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segmentLarge: { padding: 4 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  segmentItemLarge: { paddingVertical: 12 },
  segmentItemActive: {
    backgroundColor: colors.barFillAlt,
  },
  segmentLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentLabelActive: { color: colors.navyDeep },
  segmentHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  segmentHintActive: { color: 'rgba(15,26,56,0.65)' },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipActive: {
    backgroundColor: colors.onNavy,
    borderColor: colors.onNavy,
  },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.navy },
  filterMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  filterMetaText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600' },
  resetText: { color: colors.barFillAlt, fontWeight: '800', fontSize: 12 },
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  cardWide: { flexBasis: '31%', flexGrow: 1, minWidth: 260 },
  pressed: { opacity: 0.88 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  badge: {
    backgroundColor: colors.navyTint,
    color: colors.navy,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
  },
  badgeWarn: { backgroundColor: '#FFF0C2', color: '#9A6700' },
  badgeVehicle: { backgroundColor: '#E3F2FD', color: '#1565C0' },
  status: { fontSize: 12, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 6, lineHeight: 22 },
  sub: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  subMuted: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  stateBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  stateTitle: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  stateMsg: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
});
