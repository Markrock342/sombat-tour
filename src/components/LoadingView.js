import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, ActivityIndicator, StyleSheet, Easing } from 'react-native';
import { colors, spacing } from '../theme';

export default function LoadingView({ message = 'กำลังโหลด...', compact = false }) {
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Animated.View style={{ opacity: pulse, transform: [{ scale: pulse }] }}>
        <Image
          source={require('../../assets/sombattourbg.png')}
          style={[styles.banner, compact && styles.bannerCompact]}
          resizeMode="contain"
        />
      </Animated.View>
      <ActivityIndicator color={colors.navy} size="large" style={styles.spinner} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  banner: {
    width: 280,
    height: 95,
    marginBottom: spacing.lg,
  },
  bannerCompact: {
    width: 220,
    height: 74,
  },
  spinner: { marginBottom: spacing.sm },
  message: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
