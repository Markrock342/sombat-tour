import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

export function FilterChipRow({ options, value, onChange, compact }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, compact && styles.chipRowCompact]}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key ?? opt.label}
            onPress={() => onChange(opt.key)}
            style={[styles.chip, compact && styles.chipCompact, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, compact && styles.chipTextCompact, active && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function FilterSegment({ options, value, onChange, compact }) {
  if (compact) {
    return <FilterChipRow options={options} value={value} onChange={onChange} compact />;
  }

  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key ?? opt.label}
            onPress={() => onChange(opt.key)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
            {opt.hint ? (
              <Text style={[styles.segmentHint, active && styles.segmentHintActive]} numberOfLines={1}>
                {opt.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function FilterLabel({ children, compact }) {
  if (compact) return null;
  return <Text style={styles.filterLabel}>{children}</Text>;
}

export function FilterToggleBar({ open, onToggle, summary, onReset, compact }) {
  if (!compact) return null;
  return (
    <View style={styles.toggleBar}>
      <Pressable onPress={onToggle} style={styles.toggleBtn} accessibilityRole="button">
        <Text style={styles.toggleText}>{open ? 'ซ่อนตัวกรอง ▲' : 'ตัวกรอง ▼'}</Text>
      </Pressable>
      <Text style={styles.summaryText} numberOfLines={1}>
        {summary}
      </Text>
      <Pressable onPress={onReset} style={styles.resetHit} hitSlop={4} accessibilityRole="button">
        <Text style={styles.resetText}>รีเซ็ต</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  filterLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 6,
  },
  segmentItemActive: { backgroundColor: colors.barFillAlt },
  segmentLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentLabelActive: { color: colors.navyDeep },
  segmentHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  segmentHintActive: { color: 'rgba(15,26,56,0.65)' },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    paddingRight: spacing.lg,
    alignItems: 'center',
  },
  chipRowCompact: { gap: 6, paddingVertical: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  chipActive: {
    backgroundColor: colors.onNavy,
    borderColor: colors.onNavy,
  },
  chipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  chipTextCompact: { fontSize: 12 },
  chipTextActive: { color: colors.navy },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
    minHeight: 44,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  toggleText: { color: colors.barFillAlt, fontSize: 12, fontWeight: '800' },
  summaryText: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
  },
  resetHit: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  resetText: { color: colors.barFillAlt, fontWeight: '800', fontSize: 12 },
});
