import { colors } from '../theme';

// Shared candlestick style presets — used by the live chart's style picker
// and the standalone gallery screen.
export const CANDLE_STYLES = [
  {
    key: 'classic',
    label: 'Classic',
    props: { upColor: '#1FA97A', downColor: '#E5544B' },
  },
  {
    key: 'navy',
    label: 'Navy',
    props: {
      upColor: colors.barFill,
      downColor: colors.barFillAlt,
      bodyRadius: 3,
      bodyWidthRatio: 0.66,
    },
  },
  {
    key: 'hollow',
    label: 'Hollow',
    props: {
      upColor: '#1FA97A',
      downColor: '#E5544B',
      hollowUp: true,
      bodyWidthRatio: 0.6,
    },
  },
  {
    key: 'minimal',
    label: 'Minimal',
    props: {
      upColor: colors.navySoft,
      downColor: colors.textMuted,
      bodyWidthRatio: 0.34,
      wickWidth: 1,
    },
  },
  {
    key: 'volume',
    label: '+Volume',
    props: { upColor: '#1FA97A', downColor: '#E5544B', showVolume: true },
  },
  {
    key: 'grid',
    label: '+Grid',
    props: {
      upColor: colors.barFill,
      downColor: colors.barFillAlt,
      showAxis: true,
      bodyRadius: 2,
    },
  },
];

export const getStyle = (key) =>
  CANDLE_STYLES.find((s) => s.key === key) ?? CANDLE_STYLES[0];
