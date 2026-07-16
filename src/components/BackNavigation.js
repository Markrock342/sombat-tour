import React from 'react';
import { Pressable, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, shadow } from '../theme';

export const MOBILE_BREAKPOINT = 768;
export const WIDE_BREAKPOINT = 900;
/** Max width for single-column detail cards on PC (centered, not edge-to-edge). */
export const CONTENT_MAX_WIDTH = 560;

export function useIsMobile() {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}

export function useScreenLayout() {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const isWide = width >= WIDE_BREAKPOINT;
  return {
    isMobile,
    isWide,
    /** Use for centering one-column pages on tablet/PC */
    centerContent: !isMobile,
    pad: isMobile ? spacing.md : spacing.xl,
    titleSize: isMobile ? 20 : 22,
    heroTitleSize: isMobile ? 22 : 24,
    contentMaxWidth: CONTENT_MAX_WIDTH,
  };
}

/** Centered column sheet — apply to detail/form pages on PC */
export function contentSheetStyle(centerContent, maxWidth = CONTENT_MAX_WIDTH) {
  if (!centerContent) return { width: '100%' };
  return {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
  };
}

export const mobileScrollInset = { paddingBottom: 72 };

export function TopBackLink({ onPress, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="กลับ">
      <Text style={style}>‹ กลับ</Text>
    </Pressable>
  );
}

export function MobileBackBar({ onPress }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.barWrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
        accessibilityRole="button"
        accessibilityLabel="กลับ"
      >
        <Text style={styles.barText}>‹  กลับ</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow,
  },
  bar: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  barPressed: { backgroundColor: colors.navyTint },
  barText: { color: colors.navy, fontSize: 17, fontWeight: '800' },
});
