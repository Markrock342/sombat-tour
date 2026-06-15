import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
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
];

const rangeLabel = (r) =>
  sameDay(r.start, r.end)
    ? fmtThai(r.start)
    : `${fmtThai(r.start)} – ${fmtThai(r.end)}`;

export default function DateRangePicker({ value, presetKey, onChange }) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(value.start);
  const [tempEnd, setTempEnd] = useState(value.end);
  const [tempKey, setTempKey] = useState(presetKey);
  const [viewMonth, setViewMonth] = useState(
    new Date(value.start.getFullYear(), value.start.getMonth(), 1)
  );
  // 'days' | 'months' | 'years'
  const [viewMode, setViewMode] = useState('days');
  const [yearBase, setYearBase] = useState(value.start.getFullYear() - 5);

  const openModal = () => {
    setTempStart(value.start);
    setTempEnd(value.end);
    setTempKey(presetKey);
    setViewMonth(new Date(value.start.getFullYear(), value.start.getMonth(), 1));
    setViewMode('days');
    setOpen(true);
  };

  const openYears = (y) => {
    setYearBase(y - 5);
    setViewMode('years');
  };

  const applyPreset = (key) => {
    const r = presetRange(key);
    setTempStart(r.start);
    setTempEnd(r.end);
    setTempKey(key);
    setViewMonth(new Date(r.start.getFullYear(), r.start.getMonth(), 1));
  };

  const pickDay = (day) => {
    setTempKey('custom');
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
    onChange({ start, end }, tempKey);
    setOpen(false);
  };

  // calendar cells for viewMonth
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
    <>
      {/* trigger in the card */}
      <Text style={styles.fieldLabel}>ช่วงวันที่</Text>
      <Pressable style={styles.trigger} onPress={openModal}>
        <Text style={styles.triggerText} numberOfLines={1}>
          📅 {rangeLabel(value)}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      {/* modal card */}
      <Modal transparent visible={open} animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTitle}>เลือกช่วงวันที่</Text>

            {/* presets */}
            <View style={styles.presetRow}>
              {PRESETS.map((p) => {
                const active = tempKey === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => applyPreset(p.key)}
                    style={[styles.preset, active && styles.presetActive]}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ===== DAYS VIEW ===== */}
            {viewMode === 'days' ? (
              <>
                <View style={styles.calHeader}>
                  <Pressable hitSlop={10} onPress={() => setViewMonth(new Date(year, month - 1, 1))}>
                    <Text style={styles.navArrow}>‹</Text>
                  </Pressable>
                  <Pressable onPress={() => setViewMode('months')}>
                    <Text style={styles.calTitle}>{TH_MONTHS[month]} {year + 543} ▾</Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => setViewMonth(new Date(year, month + 1, 1))}>
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
                    const inRange = tempStart && rangeEnd && day >= tempStart && day <= rangeEnd;
                    const edge = isStart || isEnd;
                    return (
                      <Pressable key={i} style={styles.cell} onPress={() => pickDay(day)}>
                        <View style={[styles.dayInner, inRange && styles.dayInRange, edge && styles.dayEdge]}>
                          <Text style={[styles.dayText, edge && styles.dayTextEdge]}>
                            {day.getDate()}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : viewMode === 'months' ? (
              /* ===== MONTHS VIEW ===== */
              <>
                <View style={styles.calHeader}>
                  <Pressable hitSlop={10} onPress={() => setViewMonth(new Date(year - 1, month, 1))}>
                    <Text style={styles.navArrow}>‹</Text>
                  </Pressable>
                  <Pressable onPress={() => openYears(year)}>
                    <Text style={styles.calTitle}>{year + 543} ▾</Text>
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => setViewMonth(new Date(year + 1, month, 1))}>
                    <Text style={styles.navArrow}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.pickGrid}>
                  {TH_MONTHS.map((m, mi) => (
                    <Pressable
                      key={m}
                      style={[styles.pickCell, mi === month && styles.pickCellActive]}
                      onPress={() => {
                        setViewMonth(new Date(year, mi, 1));
                        setViewMode('days');
                      }}
                    >
                      <Text style={[styles.pickText, mi === month && styles.pickTextActive]}>
                        {TH_MONTHS_SHORT[mi]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              /* ===== YEARS VIEW ===== */
              <>
                <View style={styles.calHeader}>
                  <Pressable hitSlop={10} onPress={() => setYearBase(yearBase - 12)}>
                    <Text style={styles.navArrow}>‹</Text>
                  </Pressable>
                  <Text style={styles.calTitle}>
                    {yearBase + 543} - {yearBase + 11 + 543}
                  </Text>
                  <Pressable hitSlop={10} onPress={() => setYearBase(yearBase + 12)}>
                    <Text style={styles.navArrow}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.pickGrid}>
                  {Array.from({ length: 12 }, (_, i) => yearBase + i).map((y) => (
                    <Pressable
                      key={y}
                      style={[styles.pickCell, y === year && styles.pickCellActive]}
                      onPress={() => {
                        setViewMonth(new Date(y, month, 1));
                        setViewMode('months');
                      }}
                    >
                      <Text style={[styles.pickText, y === year && styles.pickTextActive]}>
                        {y + 543}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* footer */}
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.navySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  triggerText: { fontSize: 13, fontWeight: '700', color: colors.navy, flexShrink: 1 },
  caret: { fontSize: 12, color: colors.navySoft, marginLeft: spacing.sm },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,26,56,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    ...shadow,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
  },
  presetActive: { backgroundColor: colors.navy },
  presetText: { fontSize: 13, fontWeight: '700', color: colors.navySoft },
  presetTextActive: { color: colors.onNavy },

  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: spacing.sm,
  },
  pickCell: {
    width: `${100 / 3}%`,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCellActive: { backgroundColor: colors.navyTint, borderRadius: 10 },
  pickText: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  pickTextActive: {
    color: colors.navy,
    fontWeight: '800',
  },
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

  footerHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  footerBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  btnGhost: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
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
