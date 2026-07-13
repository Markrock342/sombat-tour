import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { colors, spacing, radius } from '../theme';
import { fmtDateTime, isOpenRepair } from '../data/api';
import { parseRepairList, REPAIR_TYPES } from '../data/repairNotes';

function StatusPill({ closed }) {
  return (
    <View style={[styles.pill, { backgroundColor: closed ? '#E5544B' : '#1FA97A' }]}>
      <Text style={styles.pillText}>{closed ? 'ปิดงานแล้ว' : 'กำลังซ่อม'}</Text>
    </View>
  );
}

/** Flat note block from structured r_repair_list (ครบฟิลด์ ไม่ทับซ้อนการ์ด) */
export function formatRepairCardNotes(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'ไม่ระบุอาการ';
  const p = parseRepairList(text);
  const known = ['อาการ', 'สถานที่', 'อะไหล่', 'ดำเนินการ', 'ประเภท'];
  const structured = known.some((l) => text.includes(`${l}:`));
  if (!structured && !p.symptom && !p.location && !p.parts && !p.action) {
    return text;
  }
  const lines = [];
  const reporter = text.match(/\[แจ้งโดย\s*([^\]]+)\]/);
  if (reporter) lines.push(`แจ้งโดย: ${reporter[1].trim()}`);
  const typeLabel =
    REPAIR_TYPES.find((t) => t.key === p.type)?.label ||
    (p.type && p.type !== 'normal' ? p.type : '');
  if (typeLabel) lines.push(`ประเภท: ${typeLabel}`);
  if (p.symptom) lines.push(`อาการ: ${p.symptom}`);
  else if (!structured && text.replace(/\[แจ้งโดย[^\]]*\]/g, '').trim()) {
    lines.push(text.replace(/\[แจ้งโดย[^\]]*\]/g, '').trim());
  }
  if (p.location) lines.push(`สถานที่: ${p.location}`);
  if (p.parts) lines.push(`อะไหล่: ${p.parts}`);
  if (p.action) lines.push(`ดำเนินการ: ${p.action}`);
  return lines.filter(Boolean).join('\n') || text;
}

export function mapRepairToCardJob(r, index = 0) {
  return {
    id: index + 1,
    rId: r.r_id,
    raw: r,
    code: r.r_job_num ? `#${r.r_job_num}` : `#${r.r_id}`,
    title: formatRepairCardNotes(r.r_repair_list),
    closed: !isOpenRepair(r),
    vehicleNo: r.r_v_name || '',
    plate: r.r_v_plate || '',
    chassis: r.r_v_chassis || '',
    model: [r.r_v_brand, r.r_v_model].filter(Boolean).join(' · '),
    mile: Number(r.r_mile) || 0,
    tankM: r.r_tank_m || '',
    company: r.r_v_company || r.r_inv_com || '',
    technician: r.r_technician || '',
    datetime: r.r_dt_rec,
  };
}

/** Search haystack matching old JobDetail card lists */
export function jobCardSearchHay(job) {
  return [
    job.code,
    job.rId,
    job.title,
    job.vehicleNo,
    job.plate,
    job.chassis,
    job.model,
    job.company,
    job.technician,
    job.datetime,
    job.mile,
    job.tankM,
    job.raw?.r_repair_list,
    job.raw?.r_job_num,
  ]
    .map((x) => String(x || '').toLowerCase())
    .join(' ');
}

/**
 * Shared repair list card — same look on รายการแจ้งซ่อม / งานค้าง / เสียกลางทาง.
 * Flat layout (no nested white/shadow box) so it does not look like 2 cards stacked.
 */
export default function RepairJobCard({
  job,
  index,
  onPress,
  accent = 'default',
  style,
}) {
  const displayId = job.displayId ?? job.id ?? index + 1;
  const closed = !!job.closed;
  const notes = useMemo(() => job.title || formatRepairCardNotes(job.raw?.r_repair_list), [job]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        accent === 'breakdown' && styles.cardBreakdown,
        closed && styles.cardClosed,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{displayId}</Text>
        </View>
        <StatusPill closed={closed} />
      </View>

      <Text style={styles.metaLine}>
        {job.datetime ? `${fmtDateTime(job.datetime)}  ·  ` : ''}
        {job.code}
      </Text>

      <View style={styles.vehicleBlock}>
        {job.vehicleNo ? (
          <Text style={styles.vehicleNo} numberOfLines={1}>
            {job.vehicleNo}
          </Text>
        ) : null}
        <Text style={styles.detail} numberOfLines={2}>
          {job.plate || '—'}
          {job.chassis ? ` · ${job.chassis}` : ''}
        </Text>
        {job.model ? <Text style={styles.detail}>{job.model}</Text> : null}
        <Text style={styles.detail}>
          ผู้ซ่อม: {job.technician || 'ไม่ระบุ'}
          {job.mile > 0 ? ` · ไมล์ ${job.mile.toLocaleString()}` : ''}
          {job.tankM ? ` · ถัง ${job.tankM} ม.` : ''}
        </Text>
        {job.company ? (
          <Text style={styles.detail} numberOfLines={1}>
            {job.company}
          </Text>
        ) : null}
      </View>

      <View style={styles.noteBlock}>
        <Text style={styles.noteText}>{notes}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.barFill,
  },
  cardBreakdown: { borderLeftColor: '#E5544B' },
  cardClosed: { borderLeftColor: colors.textMuted, opacity: 0.92 },
  pressed: { opacity: 0.88, backgroundColor: '#F7F8FC' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  metaLine: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: spacing.sm,
  },
  vehicleBlock: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  vehicleNo: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  detail: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  noteBlock: {
    marginTop: spacing.xs,
    backgroundColor: '#FFF6D6',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
});
