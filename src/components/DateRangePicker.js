import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const TH_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const TH_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// ---- date helpers (local time) ----
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => {
  const r = startOfDay(d);
  r.setDate(r.getDate() + n);
  return r;
};
const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtThai = (d) =>
  `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;

export function presetRange(key, today = startOfDay(new Date())) {
  switch (key) {
    case 'today':
      return { start: today, end: today };
    case '7d':
      return { start: addDays(today, -6), end: today };
    case '30d':
      return { start: addDays(today, -29), end: today };
    case 'month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    default:
      return { start: today, end: today };
  }
}

const PRESETS = [
  { key: 'today', label: 'วันนี้' },
  { key: '7d', label: '7 วัน' },
  { key: '30d', label: '30 วัน' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'custom', label: 'กำหนดเอง' },
];

export default function DateRangePicker({ value, presetKey, onChange, embedded = false }) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(value.start);
  const [tempEnd, setTempEnd] = useState(value.end);
  const [viewMonth, setViewMonth] = useState(
    new Date(value.start.getFullYear(), value.start.getMonth(), 1)
  );

  const label =
    sameDay(value.start, value.end)
      ? fmtThai(value.start)
      : `${fmtThai(value.start)} – ${fmtThai(value.end)}`;

  const handlePreset = (key) => {
    if (key === 'custom') {
      setTempStart(value.start);
      setTempEnd(value.end);
      setViewMonth(new Date(value.start.getFullYear(), value.start.getMonth(), 1));
      setOpen(true);
      return;
    }
    onChange(presetRange(key), key);
  };

  const pickDay = (day) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(day);
      setTempEnd(null);
    } else if (day < tempStart) {
      setTempEnd(tempStart);
      setTempStart(day);
    } else {
      setTempEnd(day);
    }
  };

  const confirm = () => {
    const start = tempStart;
    const end = tempEnd ?? tempStart;
    onChange({ start, end }, 'custom');
    setOpen(false);
  };

  // build calendar cells for viewMonth
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const rangeEnd = tempEnd ?? tempStart;

  return (
    <View style={[styles.bar, embedded && styles.barEmbedded]}>
      <Text style={styles.barLabel}>ช่วงวันที่</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {PRESETS.map((p) => {
          const active = presetKey === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => handlePreset(p.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.current} onPress={() => handlePreset('custom')}>
        <Text style={styles.currentText}>📅 {label}</Text>
      </Pressable>

      {/* custom range calendar */}
      <Modal transparent visible={open} animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.calendar} onPress={() => {}}>
            <View style={styles.calHeader}>
              <Pressable
                hitSlop={10}
                onPress={() => setViewMonth(new Date(year, month - 1, 1))}
              >
                <Text style={styles.navArrow}>‹</Text>
              </Pressable>
              <Text style={styles.calTitle}>
                {TH_MONTHS[month]} {year + 543}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => setViewMonth(new Date(year, month + 1, 1))}
              >
                <Text style={styles.navArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {TH_WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={i} style={styles.cell} />;
                const isStart = sameDay(day, tempStart);
                const isEnd = sameDay(day, rangeEnd);
                const inRange =
                  tempStart && rangeEnd && day >= tempStart && day <= rangeEnd;
                const edge = isStart || isEnd;
                return (
                  <Pressable key={i} style={styles.cell} onPress={() => pickDay(day)}>
                    <View
                      style={[
                        styles.dayInner,
                        inRange && styles.dayInRange,
                        edge && styles.dayEdge,
                      ]}
                    >
                      <Text style={[styles.dayText, edge && styles.dayTextEdge]}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calFooter}>
              <Text style={styles.footerHint}>
                {tempStart
                  ? `${fmtThai(tempStart)}${tempEnd ? ` – ${fmtThai(tempEnd)}` : ' …'}`
                  : 'เลือกวันเริ่มต้น'}
              </Text>
              <View style={styles.footerBtns}>
                <Pressable style={styles.btnGhost} onPress={() => setOpen(false)}>
                  <Text style={styles.btnGhostText}>ยกเลิก</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnPrimary, !tempStart && styles.btnDisabled]}
                  disabled={!tempStart}
                  onPress={confirm}
                >
                  <Text style={styles.btnPrimaryText}>ตกลง</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow,
  },
  barEmbedded: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: spacing.md,
    shadowOpacity: 0,
    elevation: 0,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chips: { gap: 6, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
  },
  chipActive: { backgroundColor: colors.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.navySoft },
  chipTextActive: { color: colors.onNavy },
  current: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  currentText: { fontSize: 13, fontWeight: '700', color: colors.navy },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,26,56,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  calendar: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navArrow: { fontSize: 24, color: colors.navy, fontWeight: '800', paddingHorizontal: 8 },
  calTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayInRange: { backgroundColor: colors.navyTint },
  dayEdge: { backgroundColor: colors.navy },
  dayText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  dayTextEdge: { color: colors.onNavy, fontWeight: '800' },

  calFooter: { marginTop: spacing.md },
  footerHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  footerBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  btnGhost: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  btnGhostText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  btnPrimary: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimaryText: { color: colors.onNavy, fontWeight: '800', fontSize: 14 },
});
