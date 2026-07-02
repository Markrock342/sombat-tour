import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

// สีสถานะงาน (ให้ตรงกับ StatusPill): แดง = ปิดงาน, เขียว = เปิดงาน/กำลังซ่อม
export const CLOSED_COLOR = '#E5544B';
export const OPEN_COLOR = '#1FA97A';

/**
 * แถวกราฟรายวันของงานเสียกลางทาง: วันที่ + แท่งแนวนอน 2 สี
 * (แดง = ปิดงานแล้ว, เขียว = กำลังซ่อม) + จำนวนรวมของวันนั้น
 * ความยาวแท่งเทียบกับวันที่มีงานมากสุด (max) กดเพื่อดูรายการงานของวันนั้น
 */
export default function BreakdownBar({ date, label, open = 0, closed = 0, max = 1, onPress }) {
  const total = open + closed;
  const empty = total <= 0;
  const pct = !empty && max > 0 ? Math.max(0.04, total / max) : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={empty}
      style={({ pressed }) => [
        styles.row,
        empty && styles.rowEmpty,
        pressed && styles.pressed,
      ]}
      android_ripple={{ color: colors.navyTint }}
    >
      <Text style={styles.date} numberOfLines={1}>
        {label || date}
      </Text>
      <View style={styles.barWrap}>
        <View style={styles.track}>
          {!empty ? (
            <View style={[styles.fillGroup, { width: `${pct * 100}%` }]}>
              {closed > 0 ? (
                <View style={[styles.seg, styles.segLeft, { flex: closed, backgroundColor: CLOSED_COLOR }]} />
              ) : null}
              {open > 0 ? (
                <View style={[styles.seg, styles.segRight, { flex: open, backgroundColor: OPEN_COLOR }]} />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[styles.value, empty && styles.valueEmpty]}>{total}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  rowEmpty: { opacity: 0.5 },
  pressed: { backgroundColor: colors.navyTint },
  date: {
    width: 64,
    fontSize: 12.5,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  barWrap: { flex: 1, marginHorizontal: spacing.sm },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.barTrack,
    overflow: 'hidden',
  },
  fillGroup: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 7,
    overflow: 'hidden',
  },
  seg: { height: '100%' },
  segLeft: {},
  segRight: {},
  value: {
    width: 26,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  valueEmpty: { color: colors.textMuted, fontWeight: '600' },
});
