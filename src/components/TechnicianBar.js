import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

/**
 * One row in the technician list: name + horizontal bar (proportional to the
 * job count) + the count itself. Tapping it opens that technician's jobs.
 */
export default function TechnicianBar({
  name,
  value,
  max,
  color = colors.barFill,
  onPress,
}) {
  const pct = max > 0 ? Math.max(0.06, value / max) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      android_ripple={{ color: colors.navyTint }}
    >
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.barWrap}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${pct * 100}%`, backgroundColor: color },
            ]}
          />
        </View>
      </View>
      <Text style={styles.value}>{value}</Text>
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
  pressed: {
    backgroundColor: colors.navyTint,
  },
  name: {
    width: 64,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  barWrap: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.barTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 7,
  },
  value: {
    width: 24,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
