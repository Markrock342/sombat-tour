import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Easing } from 'react-native';
import { colors, spacing } from '../theme';

// รูปจาก repo 425store เดิม (src/assets + public/)
const LOGO_BANNER = require('../../assets/sombattourbg.png');

function BounceDot({ delay, light }) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -8, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(120),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, y]);

  const opacity = light
    ? 0.5 + (delay === 0 ? 0.4 : delay === 120 ? 0.2 : 0.3)
    : 0.35 + (delay === 0 ? 0.45 : delay === 120 ? 0.25 : 0.35);

  return (
    <Animated.View
      style={[
        styles.dot,
        light && styles.dotLight,
        { transform: [{ translateY: y }], opacity },
      ]}
    />
  );
}

/** Loading แบบเดียวกับ LoadingOverlay.tsx ใน repo 425store */
export default function LoadingView({
  message = 'กำลังโหลดข้อมูล...',
  compact = false,
  overlay = false,
}) {
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const content = (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Animated.View style={[styles.logoWrap, { opacity: glow }]}>
        <Image source={LOGO_BANNER} style={[styles.banner, compact && styles.bannerCompact]} resizeMode="contain" />
      </Animated.View>
      <View style={styles.dots}>
        <BounceDot delay={0} light={overlay} />
        <BounceDot delay={120} light={overlay} />
        <BounceDot delay={240} light={overlay} />
      </View>
      {message ? <Text style={[styles.message, overlay && styles.messageOverlay]}>{message}</Text> : null}
    </View>
  );

  if (overlay) {
    return <View style={styles.overlay}>{content}</View>;
  }
  return content;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
  },
  wrapCompact: {
    flex: 0,
    paddingVertical: spacing.xl,
  },
  logoWrap: { marginBottom: spacing.lg },
  banner: { width: 280, height: 95 },
  bannerCompact: { width: 220, height: 74 },
  dots: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 28, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.navy },
  dotLight: { backgroundColor: '#fff' },
  message: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  messageOverlay: { color: 'rgba(255,255,255,0.85)' },
});
