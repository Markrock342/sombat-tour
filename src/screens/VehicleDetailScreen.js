import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ กลับ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ข้อมูลรถ</Text>
        <Text style={styles.headerSub}>
          {v.v_name || `ID ${v.v_id}`} · {[v.v_brand, v.v_model].filter(Boolean).join(' ')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {rows.map(([key, label], i) => (
            <View key={key} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{String(v[key])}</Text>
            </View>
          ))}
        </View>
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
});
