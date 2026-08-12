import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { colors, spacing, radius, shadow } from '../theme';
import { fmtDateTime, isOpenRepair } from '../data/api';

function StatusPill({ closed }) {
  return (
    <View style={[styles.pill, { backgroundColor: closed ? '#E5544B' : '#1FA97A' }]}>
      <Text style={styles.pillText}>{closed ? 'ปิดงานแล้ว' : 'กำลังซ่อม'}</Text>
    </View>
  );
}

/** Map raw repair row → card + summary modal shape (production UI) */
export function mapRepairToCardJob(r, index = 0) {
  const repairList = r.r_repair_list || '';
  return {
    id: index + 1,
    rId: r.r_id,
    rawId: r.r_id || r.r_job_num || '',
    jobNum: r.r_job_num || '',
    raw: r,
    code: r.r_job_num ? `#${r.r_job_num}` : r.r_id ? `#${r.r_id}` : '—',
    title: repairList || 'งานแจ้งซ่อม',
    repairList,
    closed: !isOpenRepair(r),
    vehicleNo: r.r_v_name || '',
    plate: r.r_v_plate || '',
    chassis: r.r_v_chassis || '',
    model: [r.r_v_brand, r.r_v_model].filter(Boolean).join(' • '),
    vBrand: r.r_v_brand || '',
    vModel: r.r_v_model || '',
    meter: r.r_v_metr || '',
    mile: Number(r.r_mile) || 0,
    tankM: r.r_tank_m || '',
    company: r.r_v_company || '',
    billing: r.r_inv_com || '',
    technician: (r.r_technician || '').trim() || 'ไม่ระบุช่าง',
    recorder: (r.r_recorder || '').trim(),
    datetime: r.r_dt_rec || '',
    closeDatetime: r.r_dt_close || '',
    workReport: r.r_work_report || '',
  };
}

/** Search haystack for list filters */
export function jobCardSearchHay(job) {
  return [
    job.code,
    job.rId,
    job.rawId,
    job.title,
    job.repairList,
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
 * UI กลาง — แบบเดียวกับ production รายการแจ้งซ่อม
 */
export default function RepairJobCard({ job, index, onPress, style }) {
  const displayId = job.displayId ?? job.id ?? index + 1;
  const closed = !!job.closed;
  const symptom = (job.repairList || job.title || '').trim() || 'ไม่ระบุอาการ';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{displayId}</Text>
        </View>
        <StatusPill closed={closed} />
      </View>

      <Text style={styles.metaLine}>
        {job.code}
        {job.datetime ? ` | ${fmtDateTime(job.datetime)}` : ''}
      </Text>

      <View style={styles.vehicleBox}>
        {job.vehicleNo ? <Text style={styles.vehicleNo}>🚚 {job.vehicleNo}</Text> : null}
        <Text style={styles.detail}>
          {job.plate || '-'}
          {job.chassis ? ` • ${job.chassis}` : ''}
        </Text>
        {job.model ? <Text style={styles.detail}>{job.model}</Text> : null}
        {job.mile > 0 || job.company ? (
          <Text style={styles.detail}>
            {job.mile > 0 ? `ไมล์ ${job.mile.toLocaleString()}` : ''}
            {job.mile > 0 && job.company ? ' • ' : ''}
            {job.company || ''}
          </Text>
        ) : null}
      </View>

      <Text style={styles.symptom} numberOfLines={4}>
        {symptom}
      </Text>
      <Text style={styles.hint}>ดูสรุปงาน ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  pressed: { opacity: 0.85 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { color: colors.onNavy, fontWeight: '800', fontSize: 14 },
  metaLine: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  vehicleBox: {
    backgroundColor: '#F3F5FB',
    borderLeftWidth: 3,
    borderLeftColor: colors.barFill,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  vehicleNo: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  detail: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 2 },
  symptom: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: '#FFF0C2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  hint: {
    color: colors.barFill,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: colors.onNavy, fontSize: 11, fontWeight: '700' },
});
