import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';

import CandlestickChart from './CandlestickChart';
import { CANDLE_STYLES, getStyle } from '../data/candleStyles';
import { candleData } from '../data/candles';
import { colors, spacing, radius } from '../theme';

const UP = '#1FA97A';
const DOWN = '#E5544B';

/**
 * Candlestick chart with an in-card style picker and a simulated real-time
 * feed: the latest candle walks every tick, and a new candle opens every few
 * ticks (oldest drops off, keeping a fixed window).
 */
export default function LiveCandlestickChart({
  defaultStyle = 'navy',
  height = 130,
}) {
  const [styleKey, setStyleKey] = useState(defaultStyle);
  const [data, setData] = useState(candleData);
  const [live, setLive] = useState(true);
  const tick = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;

  // real-time simulation
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setData((prev) => {
        const next = prev.slice();
        const last = { ...next[next.length - 1] };
        const drift = (Math.random() - 0.5) * 4;
        last.c = +Math.max(80, last.c + drift).toFixed(1);
        last.h = Math.max(last.h, last.c);
        last.l = Math.min(last.l, last.c);
        last.v = Math.max(5, Math.round(last.v + (Math.random() - 0.5) * 6));
        next[next.length - 1] = last;

        tick.current += 1;
        if (tick.current % 5 === 0) {
          const open = last.c;
          next.push({ o: open, h: open, l: open, c: open, v: 20 });
          if (next.length > candleData.length) next.shift();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [live]);

  // pulsing LIVE dot
  useEffect(() => {
    if (!live) {
      pulse.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  const style = getStyle(styleKey);
  const lastC = data[data.length - 1].c;
  const prevC = data[data.length - 2]?.c ?? lastC;
  const up = lastC >= prevC;

  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View>
      {/* style picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipContent}
        style={styles.chipRow}
      >
        {CANDLE_STYLES.map((s) => {
          const active = s.key === styleKey;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStyleKey(s.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* live status + current value */}
      <View style={styles.statusRow}>
        <Pressable style={styles.liveBtn} onPress={() => setLive((v) => !v)}>
          <View style={styles.dotWrap}>
            {live ? (
              <Animated.View
                style={[
                  styles.dotPulse,
                  { transform: [{ scale: dotScale }], opacity: dotOpacity },
                ]}
              />
            ) : null}
            <View
              style={[styles.dot, { backgroundColor: live ? UP : colors.textMuted }]}
            />
          </View>
          <Text style={styles.liveText}>{live ? 'LIVE' : 'หยุด'}</Text>
        </Pressable>
        <Text style={[styles.price, { color: up ? UP : DOWN }]}>
          {lastC.toFixed(1)} {up ? '▲' : '▼'}
        </Text>
      </View>

      <CandlestickChart data={data} height={height} {...style.props} />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { marginBottom: spacing.sm },
  chipContent: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
  },
  chipActive: { backgroundColor: colors.navy },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.navySoft },
  chipTextActive: { color: colors.onNavy },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  liveBtn: { flexDirection: 'row', alignItems: 'center' },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dotPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: UP,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  price: { fontSize: 15, fontWeight: '800' },
});
