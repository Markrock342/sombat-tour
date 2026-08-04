import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { statusColor, statusLabel } from '../data/repairTracking';

export default function StatusHero({ status, jobNum, subtitle }) {
  const clr = statusColor(status);
  const label = statusLabel(status);

  return (
    <View style={[styles.hero, { borderLeftColor: clr }]}>
      <Text style={styles.kicker}>สถานะล่าสุด</Text>
      <Text style={[styles.status, { color: clr }]}>{label}</Text>
      {jobNum ? <Text style={styles.job}>เลขที่ #{jobNum}</Text> : null}
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 5,
    ...shadow,
  },
  kicker: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  status: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  job: { fontSize: 15, fontWeight: '700', color: colors.navy, marginTop: spacing.sm },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
});
