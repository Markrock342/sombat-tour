import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '../components/Card';
import Dropdown from '../components/Dropdown';
import TechnicianBar from '../components/TechnicianBar';
import { SkeletonCardBody } from '../components/Skeleton';
import LiveCandlestickChart from '../components/LiveCandlestickChart';
import { colors, spacing } from '../theme';
import { routineJobs, pendingJobs, filterOptions } from '../data/mock';

export default function DashboardScreen({ navigation }) {
  const [filter, setFilter] = useState(filterOptions[0]);
  const { width } = useWindowDimensions();

  // Single column on phones, three across on wide screens (tablet / web).
  const isWide = width >= 900;

  const routineMax = Math.max(...routineJobs.map((t) => t.count));
  const pendingMax = Math.max(...pendingJobs.map((t) => t.count));

  const openJobs = (tech) =>
    navigation.navigate('JobDetail', { technician: tech.name });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>ภาพรวมงานช่าง</Text>
        </View>
        <Pressable
          style={styles.chartBtn}
          onPress={() => navigation.navigate('CandleGallery')}
        >
          <Text style={styles.chartBtnText}>📊 กราฟแท่งเทียน</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Top row: routine / pending / weekly volume */}
        <View style={[styles.row, isWide && styles.rowWide]}>
          <Card
            starred
            title="งานประจำแต่ละช่าง"
            style={[styles.topCard, isWide && styles.topCardWide]}
          >
            <Dropdown
              value={filter}
              options={filterOptions}
              onChange={setFilter}
            />
            {routineJobs.map((tech) => (
              <TechnicianBar
                key={tech.id}
                name={tech.name}
                value={tech.count}
                max={routineMax}
                color={colors.barFill}
                onPress={() => openJobs(tech)}
              />
            ))}
            <View style={styles.divider} />
            <Text style={styles.chartLabel}>แนวโน้มงาน (เรียลไทม์)</Text>
            <LiveCandlestickChart defaultStyle="navy" />
          </Card>

          <Card
            starred
            title="งานค้างแต่ละช่าง"
            style={[styles.topCard, isWide && styles.topCardWide]}
          >
            <View style={styles.pendingHeaderSpacer} />
            {pendingJobs.map((tech) => (
              <TechnicianBar
                key={tech.id}
                name={tech.name}
                value={tech.count}
                max={pendingMax}
                color={colors.barFillAlt}
                onPress={() => openJobs(tech)}
              />
            ))}
            <View style={styles.divider} />
            <Text style={styles.chartLabel}>แนวโน้มงาน (เรียลไทม์)</Text>
            <LiveCandlestickChart defaultStyle="classic" />
          </Card>

          <Card
            title="ปริมาณงาน (อาทิตย์)"
            style={[styles.topCard, isWide && styles.topCardWide]}
          >
            <SkeletonCardBody showChart lines={2} />
          </Card>
        </View>

        {/* Bottom row: two loading cards */}
        <View style={[styles.row, isWide && styles.rowWide]}>
          <Card
            title="แนวโน้มงานรายเดือน"
            style={[styles.bottomCard, isWide && styles.bottomCardWide]}
          >
            <SkeletonCardBody showChart lines={2} />
          </Card>
          <Card
            title="สรุปสถานะ"
            style={[styles.bottomCardSmall, isWide && styles.bottomCardSmallWide]}
          >
            <SkeletonCardBody lines={4} />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexShrink: 1,
  },
  chartBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  chartBtnText: {
    color: colors.onNavy,
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: colors.onNavy,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  row: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  rowWide: {
    flexDirection: 'row',
  },
  topCard: {
    minHeight: 240,
  },
  topCardWide: {
    flex: 1,
  },
  pendingHeaderSpacer: {
    // keeps the bar list aligned with the card that has a dropdown above it
    height: 48,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  bottomCard: {
    minHeight: 200,
  },
  bottomCardWide: {
    flex: 2,
  },
  bottomCardSmall: {
    minHeight: 200,
  },
  bottomCardSmallWide: {
    flex: 1,
  },
});
