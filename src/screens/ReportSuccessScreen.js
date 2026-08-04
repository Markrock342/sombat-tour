import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, shadow } from '../theme';
import { MobileBackBar, useScreenLayout, mobileScrollInset, contentSheetStyle } from '../components/BackNavigation';
import { PublicStepBanner } from '../components/PublicFlowUX';
import ContactActionRow from '../components/ContactActionRow';
import { qrImageUrl, trackUrl } from '../data/repairTracking';
import { copyText, saveQrToGallery } from '../data/contactActions';
import { showAlert } from '../utils/dialog';

export default function ReportSuccessScreen({ navigation, route }) {
  const { rJobNum, trackToken } = route.params ?? {};
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const sheetStyle = contentSheetStyle(centerContent, contentMaxWidth);
  const link = useMemo(() => (trackToken ? trackUrl(trackToken) : ''), [trackToken]);
  const qrSize = isMobile ? 260 : 220;
  const qrSrc = useMemo(() => (link ? qrImageUrl(link, qrSize) : ''), [link, qrSize]);

  const onCopy = async () => {
    if (!link) return;
    const ok = await copyText(link);
    if (ok) showAlert('คัดลอกแล้ว', 'วางในแชทหรือจดเก็บไว้ได้เลย');
    else showAlert('ลิงก์ติดตาม', link);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}>
          <View style={[styles.headerInner, sheetStyle]}>
            <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ส่งเรื่องแล้ว</Text>
            <Text style={styles.headerSub}>ขั้นที่ 3 — เก็บ QR นี้ไว้ดูสถานะ</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, centerContent && styles.scrollCentered, isMobile && mobileScrollInset]}
        >
          <View style={sheetStyle}>
          <PublicStepBanner activeStep={3} />

          <View style={styles.tipBox}>
            <View style={styles.tipTitleRow}>
              <Ionicons name="alert-circle" size={16} color="#92400E" />
              <Text style={styles.tipTitle}>สำคัญ</Text>
            </View>
            <Text style={styles.tipText}>
              ไม่ต้อง login — แชร์ลิงก์หรือเก็บ QR แล้วเปิดดูได้ว่างานถึงไหนแล้ว
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.jobLabel}>เลขที่ใบงาน</Text>
            <Text style={styles.jobNum}>#{rJobNum || '—'}</Text>

            {qrSrc ? (
              <Image
                source={{ uri: qrSrc }}
                style={[styles.qr, { width: qrSize, height: qrSize }]}
                accessibilityLabel="QR ติดตามสถานะ"
              />
            ) : null}
            <Text style={styles.qrHint}>สแกนด้วยกล้องมือถือ · หรือแชร์ลิงก์ด้านล่าง</Text>

            <ContactActionRow
              jobNum={rJobNum}
              status="submitted"
              trackToken={trackToken}
              compact
            />

            <Pressable
              style={styles.btnPrimary}
              onPress={() => navigation.replace('TrackRepair', { token: trackToken })}
            >
              <Text style={styles.btnPrimaryText}>ดูสถานะตอนนี้</Text>
            </Pressable>

            <Pressable style={styles.btnSecondary} onPress={onCopy}>
              <Text style={styles.btnSecondaryText}>คัดลอกลิงก์</Text>
            </Pressable>

            <Pressable
              style={styles.btnSecondary}
              onPress={() => saveQrToGallery(trackToken, rJobNum)}
            >
              <Text style={styles.btnSecondaryText}>บันทึก QR ลงเครื่อง</Text>
            </Pressable>
          </View>

          <Pressable style={styles.homeBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Text style={styles.homeBtnText}>กลับหน้าหลัก</Text>
          </Pressable>
          </View>
        </ScrollView>
        {isMobile ? <MobileBackBar onPress={() => navigation.navigate('Dashboard')} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.md },
  headerCentered: { alignItems: 'center' },
  headerInner: { width: '100%' },
  scrollCentered: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  tipBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tipTitle: { fontWeight: '800', color: '#92400E', fontSize: 14 },
  tipText: { color: '#78350F', fontSize: 13, marginTop: 4, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'stretch',
    ...shadow,
  },
  jobLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  jobNum: { color: colors.navy, fontWeight: '800', fontSize: 32, marginTop: 4, textAlign: 'center' },
  qr: { marginTop: spacing.lg, borderRadius: radius.sm, backgroundColor: '#fff', alignSelf: 'center' },
  qrHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, textAlign: 'center' },
  btnPrimary: {
    marginTop: spacing.lg,
    backgroundColor: colors.navy,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    width: '100%',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnPrimaryText: { color: colors.onNavy, fontWeight: '800', fontSize: 16 },
  btnSecondary: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    width: '100%',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnSecondaryText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  homeBtn: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.md },
  homeBtnText: { color: colors.textSecondary, fontWeight: '600' },
});
