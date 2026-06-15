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
import { fetchVehicleHistory } from '../data/api';

export default function VehicleHistoryScreen({ route, navigation }) {
  const { id, label } = route.params ?? {};
  const [vehicle, setVehicle] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVehicleHistory(id);
      setVehicle(data.vehicle);
      setJobs(
        (data.rows || []).map((r, i) => ({
          id: i + 1,
          code: r.r_job_num ? `#${r.r_job_num}` : `#${r.r_id}`,
          title: r.r_repair_list || 'งานแจ้งซ่อม',
          closed: r.r_close && r.r_close !== '0',
          technician: r.r_technician || '',
          datetime: r.r_dt_rec,
        }))
      );
    } catch (e) {
      setError(e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ กลับ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ประวัติแจ้งซ่อมรายคัน</Text>
        <Text style={styles.headerSub}>
          {vehicle ? `${vehicle.name || label} · ${vehicle.brand || ''} ${vehicle.model || ''}` : label}
          {!loading && !error ? ` · ${jobs.length} งาน` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {vehicle ? (
          <View style={styles.vehicleCard}>
            <Text style={styles.vLine}>ID รถ: <Text style={styles.vStrong}>{vehicle.id}</Text></Text>
            <Text style={styles.vLine}>เบอร์รถ: <Text style={styles.vStrong}>{vehicle.name || '-'}</Text></Text>
            <Text style={styles.vLine}>ทะเบียน: <Text style={styles.vStrong}>{vehicle.plate || '-'}</Text></Text>
            <Text style={styles.vLine}>เลขตัวถัง: <Text style={styles.vStrong}>{vehicle.chassis || '-'}</Text></Text>
          </View>
        ) : null}

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
            <Text style={styles.centerText}>ไม่พบประวัติแจ้งซ่อมของรถคันนี้</Text>
          </View>
        ) : (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {jobs.map((job) => (
              <View
                key={job.id}
                style={[styles.jobCard, isWide ? styles.jobCardWide : styles.jobCardFull]}
              >
                <View style={styles.jobTopRow}>
                  <Text style={styles.jobCode}>{job.code}</Text>
                  <View style={[styles.pill, { backgroundColor: job.closed ? '#1FA97A' : colors.barFillAlt }]}>
                    <Text style={styles.pillText}>{job.closed ? 'ปิดงานแล้ว' : 'กำลังซ่อม'}</Text>
                  </View>
                </View>
                <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
                <Text style={styles.jobDetail}>
                  {job.technician ? `ช่าง: ${job.technician}` : ''}
                </Text>
                {job.datetime ? <Text style={styles.jobTime}>{job.datetime}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
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
  vehicleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow,
  },
  vLine: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  vStrong: { color: colors.textPrimary, fontWeight: '700' },
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
  jobCardWide: { flexBasis: '30%', flexGrow: 1, minWidth: 240 },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  jobCode: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  jobTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  jobDetail: { color: colors.textSecondary, fontSize: 12 },
  jobTime: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
});
