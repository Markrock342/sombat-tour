import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Easing } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * Shimmering skeleton block. Compose several of these to fake a loading card.
 */
export function SkeletonBlock({ width = '100%', height = 14, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.55, 1, 0.55],
  });

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, opacity },
        style,
      ]}
    />
  );
}

/** A few stacked lines + a chart-ish placeholder, used for the "loading" cards. */
export function SkeletonCardBody({ lines = 3, showChart = false }) {
  return (
    <View style={{ flex: 1 }}>
      {showChart ? (
        <View style={styles.chartRow}>
          {[40, 70, 55, 90, 60, 80].map((h, i) => (
            <SkeletonBlock
              key={i}
              width={14}
              height={h}
              style={styles.chartBar}
            />
          ))}
        </View>
      ) : null}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={12}
          style={{ marginBottom: spacing.sm }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.skeletonBase,
    borderRadius: radius.sm,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  chartBar: {
    borderRadius: 6,
  },
});
