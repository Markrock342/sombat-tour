import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '../components/Card';
import TechnicianBar from '../components/TechnicianBar';
import DateRangePicker, { presetRange } from '../components/DateRangePicker';
import { colors, spacing } from '../theme';
import { routineJobs, pendingJobs, totalToday, activeToday } from '../data/mock';

export default function DashboardScreen({ navigation }) {
  const [dateRange, setDateRange] = useState(() => presetRange('today'));
  const [datePreset, setDatePreset] = useState('today');
  const { width } = useWindowDimensions();

  // Desktop: 3-column grid. Mobile: single column.
  const isWide = width >= 900;

  const routineMax = Math.max(...routineJobs.map((t) => t.today), 1);
  const pendingMax = Math.max(...pendingJobs.map((t) => t.pending), 1);

  const openJobs = (tech, count) =>
    navigation.navigate('JobDetail', { technician: tech.name, count });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSub}>โปรแกรมงานซ่อมบำรุง</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid, isWide && styles.gridWide]}>
          {/* 1 — งานประจำวันแต่ละช่าง */}
          <Card
            starred
            title="งานประจำวันแต่ละช่าง"
            style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
          >
            <DateRangePicker
              value={dateRange}
              presetKey={datePreset}
              onChange={(range, key) => {
                setDateRange(range);
                setDatePreset(key);
              }}
            />
            <Text style={styles.summary}>
              รวม <Text style={styles.summaryNum}>{totalToday}</Text> งาน ·
              ทำงาน <Text style={styles.summaryNum}>{activeToday}</Text> ช่าง
            </Text>
            <ScrollView style={styles.list} nestedScrollEnabled>
              {routineJobs.map((tech) => (
                <TechnicianBar
                  key={tech.id}
                  name={tech.name}
                  value={tech.today}
                  max={routineMax}
                  color={colors.barFill}
                  onPress={() => openJobs(tech, tech.today)}
                />
              ))}
            </ScrollView>
          </Card>

          {/* 2 — งานค้างซ่อมแต่ละช่าง */}
          <Card
            starred
            title="งานค้างซ่อมแต่ละช่าง"
            style={[styles.card, isWide ? styles.cardWide : styles.cardFull]}
          >
            <ScrollView style={styles.list} nestedScrollEnabled>
              {pendingJobs.map((tech) => (
                <TechnicianBar
                  key={tech.id}
                  name={tech.name}
                  value={tech.pending}
                  max={pendingMax}
                  color={colors.barFillAlt}
                  onPress={() => openJobs(tech, tech.pending)}
                />
              ))}
            </ScrollView>
          </Card>

          {/* 3-6 — placeholders for future cards */}
          <Placeholder title="ประวัติแจ้งซ่อมรายคัน" tag="อาจจะ" icon="🚗" isWide={isWide} />
          <Placeholder title="สต็อกอะไหล่" tag="อาจจะ" icon="📦" isWide={isWide} />
          <Placeholder title="ข้อมูลด้านอื่น ๆ" icon="📊" isWide={isWide} />
          <Placeholder title="xxx" icon="➕" isWide={isWide} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Placeholder({ title, tag, icon, isWide }) {
  return (
    <Card
      title={tag ? `${title} (${tag})` : title}
      style={[styles.card, isWide ? styles.cardWide : styles.cardFull, styles.placeholderCard]}
    >
      <View style={styles.placeholderBody}>
        <Text style={styles.placeholderIcon}>{icon}</Text>
        <Text style={styles.placeholderText}>อยู่ระหว่างพัฒนา</Text>
      </View>
    </Card>
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
  grid: {
    gap: spacing.lg,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {},
  cardFull: {
    width: '100%',
  },
  cardWide: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 280,
  },
  summary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  summaryNum: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 15,
  },
  list: {
    maxHeight: 300,
  },
  placeholderCard: {
    minHeight: 170,
  },
  placeholderBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  placeholderIcon: {
    fontSize: 30,
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
  placeholderText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
