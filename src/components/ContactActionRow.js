import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { MOBILE_BREAKPOINT } from './BackNavigation';
import { callPhone, shareTrackLink, shareViaLine } from '../data/contactActions';

/**
 * Call reporter / share track link / LINE — Phase 2 without SMS gateway.
 */
export default function ContactActionRow({
  phone,
  jobNum,
  status,
  trackToken,
  note,
  compact = false,
}) {
  const { width } = useWindowDimensions();
  const stacked = width < MOBILE_BREAKPOINT || compact;
  const hasPhone = !!(phone && String(phone).trim());
  const hasToken = !!(trackToken && String(trackToken).trim());

  if (!hasPhone && !hasToken) return null;

  return (
    <View style={[styles.wrap, stacked && styles.wrapStack]}>
      {hasPhone ? (
        <Pressable
          style={[styles.btn, styles.btnCall, stacked && styles.btnFull]}
          onPress={() => callPhone(phone)}
          accessibilityRole="button"
          accessibilityLabel="โทรหาผู้แจ้ง"
        >
          <Text style={styles.btnCallText}>โทรผู้แจ้ง</Text>
          <Text style={styles.btnSub} numberOfLines={1}>
            {phone}
          </Text>
        </Pressable>
      ) : null}

      {hasToken ? (
        <Pressable
          style={[styles.btn, styles.btnShare, stacked && styles.btnFull]}
          onPress={() => shareTrackLink({ jobNum, status, trackToken, note })}
          accessibilityRole="button"
          accessibilityLabel="แชร์ลิงก์ติดตาม"
        >
          <Text style={styles.btnShareText}>แชร์ลิงก์</Text>
        </Pressable>
      ) : null}

      {hasToken ? (
        <Pressable
          style={[styles.btn, styles.btnLine, stacked && styles.btnFull]}
          onPress={() => shareViaLine({ jobNum, status, trackToken, note })}
          accessibilityRole="button"
          accessibilityLabel="แชร์ทาง LINE"
        >
          <Text style={styles.btnLineText}>ส่ง LINE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  wrapStack: { flexDirection: 'column' },
  btn: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 48,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { width: '100%', flexBasis: 'auto' },
  btnCall: { backgroundColor: '#059669' },
  btnCallText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  btnShare: {
    backgroundColor: colors.navyTint,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnShareText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  btnLine: { backgroundColor: '#06C755' },
  btnLineText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
