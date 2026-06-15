import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Card from '../components/Card';
import CandlestickChart from '../components/CandlestickChart';
import { colors, spacing } from '../theme';
import { candleData } from '../data/candles';

// Each entry = one visual style with a short note.
const VARIANTS = [
  {
    title: '1 · Classic (เขียว/แดง)',
    note: 'สไตล์มาตรฐาน ตลาดหุ้น — เขียวขึ้น แดงลง ไส้เทียนบาง',
    props: { upColor: '#1FA97A', downColor: '#E5544B' },
  },
  {
    title: '2 · Navy theme (กรม/ทอง)',
    note: 'เข้าธีมแอป — แท่งกรมขึ้น ทองลง มุมมน',
    props: {
      upColor: colors.barFill,
      downColor: colors.barFillAlt,
      bodyRadius: 3,
      bodyWidthRatio: 0.66,
    },
  },
  {
    title: '3 · Hollow (แท่งโปร่ง)',
    note: 'แท่งขึ้นเป็นโครงโปร่ง แท่งลงทึบ — สไตล์ TradingView',
    props: {
      upColor: '#1FA97A',
      downColor: '#E5544B',
      hollowUp: true,
      bodyWidthRatio: 0.6,
    },
  },
  {
    title: '4 · Minimal (โมโนโทนบาง)',
    note: 'แท่งบาง โทนกรมล้วน เน้นความเรียบ',
    props: {
      upColor: colors.navySoft,
      downColor: colors.textMuted,
      bodyWidthRatio: 0.34,
      wickWidth: 1,
    },
  },
  {
    title: '5 · + Volume (มีปริมาณ)',
    note: 'มีแท่งปริมาณ (volume) ด้านล่าง',
    props: {
      upColor: '#1FA97A',
      downColor: '#E5544B',
      showVolume: true,
    },
  },
  {
    title: '6 · + Grid & Axis (เส้นกริด+ราคา)',
    note: 'มีเส้นกริดแนวนอนและป้ายราคาด้านขวา',
    props: {
      upColor: colors.barFill,
      downColor: colors.barFillAlt,
      showAxis: true,
      bodyRadius: 2,
    },
  },
];

export default function CandleGalleryScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        {navigation?.canGoBack?.() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.back}>‹ กลับ</Text>
          </Pressable>
        ) : null}
        <Text style={styles.headerTitle}>กราฟแท่งเทียน</Text>
        <Text style={styles.headerSub}>เปรียบเทียบ {VARIANTS.length} สไตล์</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {VARIANTS.map((v) => (
          <Card key={v.title} title={v.title} style={styles.card}>
            <Text style={styles.note}>{v.note}</Text>
            <CandlestickChart data={candleData} height={150} {...v.props} />
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
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
  headerTitle: { color: colors.onNavy, fontSize: 24, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  card: { marginBottom: spacing.lg },
  note: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
});
