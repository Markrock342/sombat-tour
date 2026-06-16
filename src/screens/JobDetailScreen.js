import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';
import { fetchRepairs, fetchPendingJobs } from '../data/api';

export default function JobDetailScreen({ route, navigation }) {
  const { technician, date, mode = 'day' } = route.params ?? {};
  const isPending = mode === 'pending';
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // โหมดงานค้าง: ดึงงานค้างทั้งหมดของช่าง; โหมดปกติ: งานของวันนั้น
      const rows = isPending
        ? (await fetchPendingJobs(technician)).rows || []
        : ((await fetchRepairs(date)).rows || []).filter((r) => r.r_technician === technician);

      const mapped = rows.map((r, i) => ({
        id: i + 1,
        code: r.r_job_num ? `#${r.r_job_num}` : `#${r.r_id}`,
        title: r.r_repair_list || 'งานแจ้งซ่อม',
        closed: r.r_close && r.r_close !== '0',
        vehicleNo: r.r_v_name || '',
        plate: r.r_v_plate || '',
        chassis: r.r_v_chassis || '',
        model: [r.r_v_brand, r.r_v_model].filter(Boolean).join(' '),
        mile: Number(r.r_mile) || 0,
        company: r.r_v_company || r.r_inv_com || '',
        datetime: r.r_dt_rec,
      }));
      setJobs(mapped);
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [technician, date, isPending]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ กลับ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isPending ? 'งานค้างซ่อม' : 'รายการแจ้งซ่อม'}
        </Text>
        <Text style={styles.headerSub}>
          {technician}
          {isPending ? '' : ` · ${date}`}
          {!loading && !error ? ` · ${jobs.length} งาน` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.navy} />
            <Text style={styles.centerText}>กำลังโหลด...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryText}>ลองใหม่</Text>
            </Pressable>
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>ไม่มีงานของช่างคนนี้ในวันที่เลือก</Text>
          </View>
        ) : (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {jobs.map((job) => (
              <Pressable
                key={job.id}
                style={({ pressed }) => [
                  styles.jobCard,
                  isWide ? styles.jobCardWide : styles.jobCardFull,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.jobTopRow}>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexText}>{job.id}</Text>
                  </View>
                  <StatusPill closed={job.closed} />
                </View>
                <Text style={styles.jobCode}>{job.code}</Text>
                <Text style={styles.jobTitle}>{job.title}</Text>

                {job.vehicleNo ? (
                  <Text style={styles.vehicleNo}>🚚 หมายเลขรถ {job.vehicleNo}</Text>
                ) : null}
                <Text style={styles.jobDetail}>
                  ทะเบียน {job.plate || '-'}
                  {job.chassis ? ` · คัสซี ${job.chassis}` : ''}
                </Text>
                <Text style={styles.jobDetail}>
                  {job.model}
                  {job.mile > 0 ? `${job.model ? ' · ' : ''}ไมล์ ${job.mile.toLocaleString()} กม.` : ''}
                  {job.company ? ` · ${job.company}` : ''}
                </Text>
                {job.datetime ? <Text style={styles.jobTime}>{job.datetime}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ closed }) {
  // กำลังซ่อม = เขียว, ปิดงานแล้ว = แดง
  return (
    <View style={[styles.pill, { backgroundColor: closed ? '#E5544B' : '#1FA97A' }]}>
      <Text style={styles.pillText}>{closed ? 'ปิดงานแล้ว' : 'กำลังซ่อม'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
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
  center: { paddingVertical: spacing.xl * 2, alignItems: 'center' },
  centerText: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  retryText: { color: colors.onNavy, fontWeight: '700' },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  jobCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  jobCardFull: { width: '100%' },
  jobCardWide: { flexBasis: '22%', flexGrow: 1, minWidth: 220 },
  pressed: { opacity: 0.85 },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { color: colors.onNavy, fontWeight: '800', fontSize: 14 },
  jobCode: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  jobTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    marginBottom: 6,
    backgroundColor: '#FFF0C2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  vehicleNo: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  jobDetail: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  jobTime: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
});
