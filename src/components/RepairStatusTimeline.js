import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { statusColor, statusLabel } from '../data/repairTracking';
import { fmtDateTime } from '../data/api';

export default function RepairStatusTimeline({ timeline = [], currentStatus }) {
  if (!timeline.length) {
    return <Text style={styles.empty}>ยังไม่มีประวัติสถานะ</Text>;
  }

  return (
    <View style={styles.wrap}>
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;
        const active = isLast || item.status === currentStatus;
        const color = statusColor(item.status);
        return (
          <View key={item.id || `${item.status}-${item.created_at}-${idx}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: color, borderColor: color }, active && styles.dotActive]} />
              {!isLast ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.card, active && styles.cardActive]}>
              <Text style={[styles.status, { color }]}>{item.status_label || statusLabel(item.status)}</Text>
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              <Text style={styles.meta}>
                {item.created_at ? fmtDateTime(item.created_at) : ''}
                {item.by_user ? ` · ${item.by_user}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 18, alignItems: 'center' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  dotActive: { width: 14, height: 14, borderRadius: 7 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4, minHeight: 24 },
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: { backgroundColor: colors.navyTint, borderColor: colors.navySoft },
  status: { fontWeight: '800', fontSize: 14 },
  note: { color: colors.textPrimary, marginTop: 4, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 6, fontWeight: '600' },
  empty: { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg },
});
