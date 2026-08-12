import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

import { colors, spacing, radius, shadow } from '../theme';
import { fetchJobParts, fetchJobOtherCosts, enrichJobSummary, fmtDateTime } from '../data/api';

// แถวข้อมูลหัวงาน (ป้าย : ค่า)
function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// หัวข้อบล็อก (แถบสีกรมด้านซ้าย + จำนวน)
function SectionTitle({ children, count }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{children}</Text>
      {count != null ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

// การ์ดอะไหล่ 1 รายการ (แทนตารางกว้าง — เหมาะกับมือถือ)
function PartRow({ item }) {
  const meta = [
    item.code ? `รหัส ${item.code}` : '',
    item.partId ? `อะไหล่ #${item.partId}` : '',
    item.lotId ? `ล็อต ${item.lotId}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  return (
    <View style={styles.lineCard}>
      <View style={styles.seqBadge}>
        <Text style={styles.seqText}>{item.seq}</Text>
      </View>
      <View style={styles.lineBody}>
        <Text style={styles.lineName}>{item.name || 'ไม่ระบุชื่ออะไหล่'}</Text>
        {meta ? <Text style={styles.lineMeta}>{meta}</Text> : null}
        {item.dt || item.id ? (
          <Text style={styles.lineDate}>
            {item.dt ? `🕐 ${fmtDateTime(item.dt)}` : ''}
            {item.id ? `${item.dt ? '  ' : ''}#${item.id}` : ''}
          </Text>
        ) : null}
      </View>
      {item.qty !== '' && item.qty != null ? (
        <View style={styles.qtyBox}>
          <Text style={styles.qtyNum}>{item.qty}</Text>
          {item.unit ? <Text style={styles.qtyUnit}>{item.unit}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// การ์ดค่าใช้จ่ายอื่น 1 รายการ
function CostRow({ item }) {
  return (
    <View style={styles.lineCard}>
      <View style={styles.seqBadge}>
        <Text style={styles.seqText}>{item.seq}</Text>
      </View>
      <View style={styles.lineBody}>
        <Text style={styles.lineName}>{item.name || 'ไม่ระบุรายการ'}</Text>
        {item.dt || item.id ? (
          <Text style={styles.lineDate}>
            {item.dt ? `🕐 ${fmtDateTime(item.dt)}` : ''}
            {item.id ? `${item.dt ? '  ' : ''}#${item.id}` : ''}
          </Text>
        ) : null}
      </View>
      {item.qty !== '' && item.qty != null ? (
        <View style={styles.qtyBox}>
          <Text style={styles.qtyNum}>{item.qty}</Text>
          {item.unit ? <Text style={styles.qtyUnit}>{item.unit}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// สถานะของบล็อกตาราง (โหลด / ผิดพลาด / ว่าง / รายการ)
function DataSection({ loading, error, rows, emptyText, renderRow, onRetry }) {
  if (loading) {
    return (
      <View style={styles.sectionState}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.sectionState}>
        <Text style={styles.errorText}>โหลดไม่สำเร็จ</Text>
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>ลองใหม่</Text>
        </Pressable>
      </View>
    );
  }
  if (!rows.length) {
    return (
      <View style={styles.sectionState}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }
  return <View style={styles.lineList}>{rows.map(renderRow)}</View>;
}

export default function JobSummaryModal({ job, onClose }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 720;

  const [detail, setDetail] = useState(null);
  const [parts, setParts] = useState([]);
  const [costs, setCosts] = useState([]);
  const [partsState, setPartsState] = useState({ loading: true, error: false });
  const [costsState, setCostsState] = useState({ loading: true, error: false });

  const jobId = detail?.rawId;

  useEffect(() => {
    if (!job) {
      setDetail(null);
      return;
    }
    setDetail(job);
    let cancelled = false;
    enrichJobSummary(job).then((enriched) => {
      if (!cancelled) setDetail(enriched);
    });
    return () => {
      cancelled = true;
    };
  }, [job]);

  const load = useCallback(async () => {
    if (!jobId) return;
    setPartsState({ loading: true, error: false });
    setCostsState({ loading: true, error: false });

    fetchJobParts(jobId)
      .then((rows) => {
        setParts(rows);
        setPartsState({ loading: false, error: false });
      })
      .catch(() => setPartsState({ loading: false, error: true }));

    fetchJobOtherCosts(jobId)
      .then((rows) => {
        setCosts(rows);
        setCostsState({ loading: false, error: false });
      })
      .catch(() => setCostsState({ loading: false, error: true }));
  }, [jobId]);

  useEffect(() => {
    if (jobId) load();
  }, [jobId, load]);

  const openClose = detail
    ? `${detail.datetime ? fmtDateTime(detail.datetime) : '—'} – ${
        detail.closed ? (detail.closeDatetime ? fmtDateTime(detail.closeDatetime) : 'ปิดงานแล้ว') : 'Working...'
      }`
    : '';

  const vehicleLine = detail
    ? [detail.plate, detail.chassis].filter(Boolean).join('  ')
    : '';
  const brandLine = detail
    ? [detail.vBrand, detail.vModel, detail.meter ? `${detail.meter} เมตร` : ''].filter(Boolean).join('  ')
    : '';

  return (
    <Modal transparent visible={!!job} animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            isWide ? styles.sheetWide : { maxHeight: height * 0.92 },
          ]}
        >
          {/* header ติดด้านบน */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>สรุปงาน</Text>
              {detail ? (
                <Text style={styles.sheetSub}>
                  {detail.code}
                  {detail.jobNum ? ` · เลขที่ ${detail.jobNum}` : ''}
                </Text>
              ) : null}
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            {detail ? (
              <>
                {/* ===== ข้อมูลหัวงาน ===== */}
                <View style={styles.infoCard}>
                  {detail.vehicleNo ? (
                    <Text style={styles.vehicleNo}>🚚 {detail.vehicleNo}</Text>
                  ) : null}
                  <InfoRow label="เปิด-ปิดงาน" value={openClose} />
                  <InfoRow label="ผู้ซ่อม" value={detail.technician} />
                  <InfoRow label="ผู้บันทึก" value={detail.recorder} />
                  <InfoRow label="ยานพาหนะ" value={vehicleLine} />
                  <InfoRow label="ยี่ห้อ" value={brandLine} />
                  <InfoRow label="ผู้ประกอบการ" value={detail.company} />
                  <InfoRow label="วางบิล" value={detail.billing} />
                  {detail.mile > 0 ? (
                    <InfoRow label="เลขไมล์" value={detail.mile.toLocaleString()} />
                  ) : null}
                  <InfoRow label="รายการซ่อม" value={detail.repairList} />
                </View>

                {/* ===== 1. รายงานการปฏิบัติงาน ===== */}
                <SectionTitle>รายงานการปฏิบัติงาน</SectionTitle>
                <View style={styles.reportBox}>
                  <Text style={styles.reportText}>
                    {detail.workReport?.trim() ? detail.workReport : 'ยังไม่มีรายงานการปฏิบัติงาน'}
                  </Text>
                </View>

                {/* ===== 2. รายการเบิกอะไหล่ ===== */}
                <SectionTitle count={partsState.loading ? null : parts.length}>
                  รายการเบิกอะไหล่
                </SectionTitle>
                <DataSection
                  loading={partsState.loading}
                  error={partsState.error}
                  rows={parts}
                  emptyText="ไม่มีรายการเบิกอะไหล่"
                  onRetry={load}
                  renderRow={(item) => <PartRow key={`${item.id}-${item.seq}`} item={item} />}
                />

                {/* ===== 3. รายการค่าใช้จ่ายอื่นๆ ===== */}
                <SectionTitle count={costsState.loading ? null : costs.length}>
                  รายการค่าใช้จ่ายอื่นๆ
                </SectionTitle>
                <DataSection
                  loading={costsState.loading}
                  error={costsState.error}
                  rows={costs}
                  emptyText="ไม่มีรายการค่าใช้จ่ายอื่น"
                  onRetry={load}
                  renderRow={(item) => <CostRow key={`${item.id}-${item.seq}`} item={item} />}
                />
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,26,56,0.5)',
    justifyContent: 'flex-end',
  },
  backdropFill: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetWide: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    marginBottom: spacing.xl,
    borderRadius: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sheetHeaderText: { flex: 1 },
  sheetTitle: { color: colors.onNavy, fontSize: 20, fontWeight: '800' },
  sheetSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2, fontWeight: '700' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  closeText: { color: colors.onNavy, fontSize: 16, fontWeight: '800' },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },

  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow,
  },
  vehicleNo: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  infoLabel: {
    width: 100,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    paddingTop: 1,
  },
  infoValue: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    paddingTop: 1,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.barFill,
    marginRight: spacing.sm,
  },
  sectionTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  sectionCount: {
    marginLeft: spacing.sm,
    backgroundColor: colors.navyTint,
    color: colors.navy,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },

  reportBox: {
    backgroundColor: colors.card,
    borderLeftWidth: 3,
    borderLeftColor: colors.barFill,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow,
  },
  reportText: { color: colors.textPrimary, fontSize: 14, lineHeight: 22 },

  lineList: { gap: spacing.sm, marginBottom: spacing.lg },
  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    ...shadow,
  },
  seqBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  seqText: { color: colors.navy, fontSize: 12, fontWeight: '800' },
  lineBody: { flex: 1 },
  lineName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  lineMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  lineDate: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  qtyBox: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
    minWidth: 52,
  },
  qtyNum: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  qtyUnit: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },

  sectionState: { paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm },
  retryBtn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  retryText: { color: colors.onNavy, fontWeight: '700', fontSize: 13 },
});
