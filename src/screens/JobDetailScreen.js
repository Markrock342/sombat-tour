import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';
import { getJobsForTechnician } from '../data/mock';

export default function JobDetailScreen({ route, navigation }) {
  const { technician, count } = route.params ?? {};
  const jobs = getJobsForTechnician(technician, count);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ กลับ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>รายการแจ้งซ่อม</Text>
        <Text style={styles.headerSub}>
          {technician} · {jobs.length} งาน
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
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
                <StatusPill status={job.status} />
              </View>
              <Text style={styles.jobCode}>{job.code}</Text>
              <Text style={styles.jobTitle} numberOfLines={2}>
                {job.title}
              </Text>
              <Text style={styles.jobDetail} numberOfLines={2}>
                {job.detail}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ status }) {
  const map = {
    'กำลังดำเนินการ': colors.barFill,
    'รอตรวจรับ': colors.navySoft,
    'งานค้าง': colors.barFillAlt,
    'เสร็จสิ้น': '#1FA97A',
  };
  const bg = map[status] ?? colors.navySoft;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.pillText}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  back: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    color: colors.onNavy,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  grid: {
    gap: spacing.md,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  jobCardFull: {
    width: '100%',
  },
  jobCardWide: {
    flexBasis: '22%',
    flexGrow: 1,
    minWidth: 220,
  },
  pressed: {
    opacity: 0.85,
  },
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
  indexText: {
    color: colors.onNavy,
    fontWeight: '800',
    fontSize: 14,
  },
  jobCode: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  jobTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  jobDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    color: colors.onNavy,
    fontSize: 11,
    fontWeight: '700',
  },
});
