import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

/**
 * Pure-View candlestick chart. Highly configurable so the gallery can render
 * several visual styles from one implementation.
 *
 * Props:
 *  data            array of { o, h, l, c, v }
 *  height          chart plot height (px)
 *  upColor/downColor   body + wick colors
 *  hollowUp        draw up-candles as outline only (hollow)
 *  bodyRadius      corner radius of bodies
 *  bodyWidthRatio  body width as a fraction of the per-candle slot
 *  wickWidth       width of the high/low wick line
 *  showGrid        horizontal gridlines
 *  showAxis        right-side price labels (implies grid)
 *  showVolume      volume bars under the price plot
 *  gridLines       number of horizontal divisions
 */
export default function CandlestickChart({
  data,
  height = 160,
  upColor = '#1FA97A',
  downColor = '#E5544B',
  hollowUp = false,
  bodyRadius = 1,
  bodyWidthRatio = 0.62,
  wickWidth = 2,
  showGrid = false,
  showAxis = false,
  showVolume = false,
  gridLines = 4,
}) {
  const highs = data.map((d) => d.h);
  const lows = data.map((d) => d.l);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const maxVol = Math.max(...data.map((d) => d.v));

  // map a price to a y offset (0 = top) within `height`
  const y = (price) => ((max - price) / range) * height;

  const grid = showGrid || showAxis;
  const volHeight = showVolume ? 38 : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.plotRow}>
        {/* gridlines + price axis */}
        {grid ? (
          <View style={[styles.gridLayer, { height }]} pointerEvents="none">
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const price = max - (range * i) / gridLines;
              return (
                <View
                  key={i}
                  style={[styles.gridRow, { top: (height / gridLines) * i }]}
                >
                  <View style={styles.gridLine} />
                  {showAxis ? (
                    <Text style={styles.axisLabel}>{price.toFixed(0)}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* candles */}
        <View style={[styles.candles, { height, marginRight: showAxis ? 30 : 0 }]}>
          {data.map((d, i) => {
            const up = d.c >= d.o;
            const color = up ? upColor : downColor;
            const bodyTop = y(Math.max(d.o, d.c));
            const bodyBottom = y(Math.min(d.o, d.c));
            const bodyHeight = Math.max(2, bodyBottom - bodyTop);
            const hollow = hollowUp && up;

            return (
              <View key={i} style={styles.slot}>
                {/* wick */}
                <View
                  style={[
                    styles.wick,
                    {
                      top: y(d.h),
                      height: Math.max(1, y(d.l) - y(d.h)),
                      width: wickWidth,
                      backgroundColor: color,
                    },
                  ]}
                />
                {/* body */}
                <View
                  style={[
                    styles.body,
                    {
                      top: bodyTop,
                      height: bodyHeight,
                      width: `${bodyWidthRatio * 100}%`,
                      borderRadius: bodyRadius,
                      backgroundColor: hollow ? 'transparent' : color,
                      borderWidth: hollow ? 1.5 : 0,
                      borderColor: color,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* volume */}
      {showVolume ? (
        <View style={[styles.volRow, { height: volHeight, marginRight: showAxis ? 30 : 0 }]}>
          {data.map((d, i) => {
            const up = d.c >= d.o;
            return (
              <View key={i} style={styles.slot}>
                <View
                  style={[
                    styles.volBar,
                    {
                      height: Math.max(2, (d.v / maxVol) * volHeight),
                      width: `${bodyWidthRatio * 100}%`,
                      backgroundColor: (up ? upColor : downColor) + '55',
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  plotRow: { position: 'relative' },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  axisLabel: {
    width: 30,
    textAlign: 'right',
    fontSize: 9,
    color: colors.textMuted,
    marginLeft: 4,
  },
  candles: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  slot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  wick: {
    position: 'absolute',
  },
  body: {
    position: 'absolute',
  },
  volRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  volBar: {
    borderRadius: 1,
  },
});
