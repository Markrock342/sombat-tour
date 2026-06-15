import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';
import { getJobsForTechnician } from '../data/mock';

export default function JobDetailScreen({ route, navigation }) {
  const { technician } = route.params ?? {};
  const jobs = getJobsForTechnician(technician);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ กลับ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>รายการที่เลือก</Text>
        <Text style={styles.headerSub}>{technician}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {jobs.map((job) => (
          <Pressable
            key={job.id}
            style={({ pressed }) => [styles.jobCard, pressed && styles.pressed]}
          >
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{job.id}</Text>
            </View>
            <View style={styles.jobBody}>
              <View style={styles.jobTopRow}>
                <Text style={styles.jobCode}>{job.code}</Text>
                <StatusPill status={job.status} />
              </View>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobDetail}>{job.detail}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ status }) {
  const map = {
    'กำลังดำเนินการ': colors.barFill,
    'รอตรวจรับ': colors.navySoft,
    'งานค้าง': colors.barFillAlt,
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
  jobCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  pressed: {
    opacity: 0.85,
  },
  indexBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  indexText: {
    color: colors.onNavy,
    fontWeight: '800',
    fontSize: 15,
  },
  jobBody: {
    flex: 1,
  },
  jobTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  jobCode: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  jobTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  jobDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
