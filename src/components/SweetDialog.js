import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

let _present = null;

export function presentDialog(config) {
  if (_present) return _present(config);
  // Fallback before provider mounts
  return Promise.resolve({ type: 'dismiss', value: false });
}

const ICONS = {
  warning: { emoji: '!', bg: '#FEF3C7', fg: '#B45309' },
  danger: { emoji: '!', bg: '#FEE2E2', fg: '#B91C1C' },
  success: { emoji: '✓', bg: '#D1FAE5', fg: '#047857' },
  info: { emoji: 'i', bg: '#DBEAFE', fg: '#1D4ED8' },
  question: { emoji: '?', bg: '#E8ECF5', fg: '#16234A' },
};

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const current = queue[0] || null;
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const present = useCallback((config) => {
    return new Promise((resolve) => {
      setQueue((q) => [...q, { ...config, resolve }]);
    });
  }, []);

  useEffect(() => {
    _present = present;
    return () => {
      if (_present === present) _present = null;
    };
  }, [present]);

  useEffect(() => {
    if (!current) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [current, scale, opacity]);

  const close = useCallback(
    (result) => {
      if (!current) return;
      const { resolve } = current;
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setQueue((q) => q.slice(1));
        resolve(result);
      });
    },
    [current, opacity]
  );

  const icon = ICONS[current?.icon] || ICONS.question;

  const buttons = useMemo(() => {
    if (!current) return [];
    if (current.buttons?.length) return current.buttons;
    if (current.mode === 'alert') {
      return [{ text: current.confirmText || 'ตกลง', style: 'primary', value: true }];
    }
    return [
      { text: current.cancelText || 'ยกเลิก', style: 'cancel', value: false },
      {
        text: current.confirmText || 'ตกลง',
        style: current.destructive ? 'danger' : 'primary',
        value: true,
      },
    ];
  }, [current]);

  return (
    <>
      {children}
      <Modal
        visible={!!current}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => close({ type: 'dismiss', value: false, button: null })}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close({ type: 'dismiss', value: false, button: null })} />
          <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
            <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
              <Text style={[styles.iconText, { color: icon.fg }]}>{icon.emoji}</Text>
            </View>
            {current?.title ? <Text style={styles.title}>{current.title}</Text> : null}
            {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}

            <View style={[styles.actions, buttons.length > 2 && styles.actionsStack]}>
              {buttons.map((btn, idx) => {
                const kind = btn.style || (idx === buttons.length - 1 ? 'primary' : 'cancel');
                return (
                  <Pressable
                    key={`${btn.text}-${idx}`}
                    style={({ pressed }) => [
                      styles.btn,
                      buttons.length > 2 ? styles.btnFull : styles.btnFlex,
                      kind === 'cancel' && styles.btnCancel,
                      kind === 'primary' && styles.btnPrimary,
                      kind === 'danger' && styles.btnDanger,
                      kind === 'success' && styles.btnSuccess,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => {
                      const value = btn.value !== undefined ? btn.value : kind !== 'cancel';
                      close({ type: 'action', value, button: btn });
                      if (btn.onPress) {
                        setTimeout(() => btn.onPress(), 0);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        kind === 'cancel' && styles.btnTextCancel,
                        (kind === 'primary' || kind === 'danger' || kind === 'success') && styles.btnTextOn,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 26, 56, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadow,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: Platform.OS === 'web' ? 32 : 34,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.xs,
  },
  actionsStack: {
    flexDirection: 'column',
  },
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnFlex: { flex: 1 },
  btnFull: { width: '100%' },
  btnCancel: {
    backgroundColor: colors.navyTint,
  },
  btnPrimary: {
    backgroundColor: colors.navy,
  },
  btnDanger: {
    backgroundColor: '#DC2626',
  },
  btnSuccess: {
    backgroundColor: '#059669',
  },
  btnPressed: { opacity: 0.88 },
  btnText: { fontSize: 15, fontWeight: '800' },
  btnTextCancel: { color: colors.navy },
  btnTextOn: { color: colors.onNavy },
});
