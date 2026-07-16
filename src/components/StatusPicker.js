import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { PUBLIC_STATUSES } from '../data/repairTracking';
import { MOBILE_BREAKPOINT } from './BackNavigation';

export default function StatusPicker({ value, onSelect, disabled }) {
  const { width } = useWindowDimensions();
  const stacked = width < MOBILE_BREAKPOINT;

  return (
    <View style={[styles.wrap, stacked && styles.wrapStack]}>
      {PUBLIC_STATUSES.map((s) => {
        const active = value === s.key;
        return (
          <Pressable
            key={s.key}
            style={[
              styles.chip,
              stacked && styles.chipStack,
              active && { backgroundColor: s.color, borderColor: s.color },
            ]}
            onPress={() => onSelect(s.key)}
            disabled={disabled}
          >
            <Text style={[styles.text, active && styles.textActive]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wrapStack: { flexDirection: 'column' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipStack: { width: '100%' },
  text: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  textActive: { color: colors.onNavy },
});
