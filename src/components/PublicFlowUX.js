import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { MOBILE_BREAKPOINT } from './BackNavigation';

const STEPS = [
  { n: 1, label: 'ชื่อผู้แจ้ง' },
  { n: 2, label: 'รถ + อาการ' },
  { n: 3, label: 'รับ QR' },
];

export function PublicStepBanner({ activeStep = 1 }) {
  const { width } = useWindowDimensions();
  const compact = width < MOBILE_BREAKPOINT;

  return (
    <View style={styles.wrap}>
      {STEPS.map((s, i) => {
        const done = s.n < activeStep;
        const active = s.n === activeStep;
        return (
          <React.Fragment key={s.n}>
            <View style={styles.item}>
              <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                <Text style={[styles.dotText, (done || active) && styles.dotTextOn]}>
                  {done ? '✓' : s.n}
                </Text>
              </View>
              {!compact ? <Text style={[styles.label, active && styles.labelActive]}>{s.label}</Text> : null}
            </View>
            {i < STEPS.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export function StickyActionBar({
  primaryLabel,
  onPrimary,
  disabled,
  secondaryLabel,
  onSecondary,
  hint,
}) {
  return (
    <View style={styles.barWrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.barRow}>
        {secondaryLabel && onSecondary ? (
          <Pressable
            onPress={onSecondary}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPrimary}
          disabled={disabled}
          style={({ pressed }) => [
            styles.primary,
            disabled && styles.primaryDisabled,
            pressed && !disabled && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    gap: 4,
  },
  item: { alignItems: 'center', minWidth: 56 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { borderColor: colors.navy, backgroundColor: colors.navy },
  dotDone: { borderColor: '#059669', backgroundColor: '#059669' },
  dotText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  dotTextOn: { color: colors.onNavy },
  label: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  labelActive: { color: colors.navy },
  line: { flex: 1, height: 2, backgroundColor: colors.border, maxWidth: 32, marginBottom: 14 },
  lineDone: { backgroundColor: '#059669' },
  barWrap: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  hint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  secondary: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  secondaryText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  primary: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: colors.onNavy, fontWeight: '800', fontSize: 16 },
  pressed: { opacity: 0.88 },
});
