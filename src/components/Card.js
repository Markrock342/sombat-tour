import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

/**
 * White card surface with an optional starred title (matches the ★ headers
 * in the sketch).
 */
export default function Card({ title, starred, headerRight, onTitlePress, style, children }) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <Pressable
            onPress={onTitlePress}
            disabled={!onTitlePress}
            style={styles.titlePress}
            accessibilityRole={onTitlePress ? 'button' : undefined}
          >
            <View style={styles.titleRow}>
              {starred ? <Text style={styles.star}>✦</Text> : null}
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
          </Pressable>
          {headerRight}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: 8,
  },
  titlePress: {
    flex: 1,
    flexShrink: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  star: {
    color: colors.barFillAlt,
    fontSize: 13,
    marginRight: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  body: {
    flex: 1,
  },
});
