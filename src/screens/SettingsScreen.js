import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, shadow } from '../theme';
import {
  TopBackLink,
  MobileBackBar,
  useScreenLayout,
  mobileScrollInset,
  contentSheetStyle,
} from '../components/BackNavigation';
import { useAuth } from '../auth/AuthContext';
import { showAlert, confirmDialog } from '../utils/dialog';
import {
  pushSupported,
  getExistingSubscription,
  subscribeStaffPush,
  unsubscribeStaffPush,
  showLocalTestNotification,
  sendServerTestPush,
} from '../data/pushNotifications';
import {
  initPwaInstallCapture,
  onInstallPromptChange,
  canPromptInstall,
  isRunningAsPwa,
  detectInstallTarget,
  installAppSmart,
} from '../data/pwaInstall';
import { APP_VERSION, APP_UPDATE_NOTES, APP_UPDATE_DATE } from '../data/appVersion';

function roleLabel(role) {
  if (role === 'admin') return 'ผู้ดูแลระบบ';
  if (role === 'staff') return 'เจ้าหน้าที่';
  if (role === 'technician') return 'ช่าง';
  if (role === 'viewer') return 'ผู้ชม';
  return role || 'ผู้ใช้';
}

function SettingRow({
  icon,
  iconColor = colors.navy,
  title,
  subtitle,
  onPress,
  right,
  disabled,
  danger,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={20} color={danger ? '#B91C1C' : iconColor} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right != null ? right : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

function StatusPill({ ok, label }) {
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillMuted]}>
      <Text style={[styles.pillText, ok ? styles.pillTextOk : styles.pillTextMuted]}>{label}</Text>
    </View>
  );
}

function InstallGuideModal({ visible, onClose, target }) {
  const os = target?.os || 'desktop';
  const steps =
    os === 'ios'
      ? [
          { icon: 'share-outline', text: 'กดปุ่ม แชร์ (Share) ที่แถบล่าง Safari' },
          { icon: 'add-outline', text: 'เลื่อนหาแล้วกด “เพิ่มไปยังหน้าโฮมสกรีน”' },
          { icon: 'phone-portrait-outline', text: 'เปิดจากไอคอนบนจอโฮม — ติดตั้งเสร็จ' },
        ]
      : os === 'android'
        ? [
            { icon: 'ellipsis-vertical', text: 'กด ⋮ มุมขวาบนของ Chrome' },
            { icon: 'download-outline', text: 'เลือก “ติดตั้งแอป” หรือ “Add to Home screen”' },
            { icon: 'phone-portrait-outline', text: 'ยืนยันติดตั้ง แล้วเปิดจากไอคอน' },
          ]
        : [
            { icon: 'download-outline', text: 'ดูไอคอนติดตั้งในแถบที่อยู่ (Chrome / Edge)' },
            { icon: 'apps-outline', text: 'หรือเมนู ⋮ → “ติดตั้ง 425service…”' },
            { icon: 'checkmark-circle-outline', text: 'ยืนยันแล้วเปิดจากไอคอนแอป' },
          ];

  const title =
    os === 'ios' ? 'ติดตั้งบน iPhone / iPad' : os === 'android' ? 'ติดตั้งบน Android' : 'ติดตั้งบนคอมพิวเตอร์';
  const hint =
    os === 'ios' && target?.preferSafari
      ? 'บน iPhone ต้องใช้ Safari — เปิดลิงก์นี้ใน Safari แล้วกดติดตั้งอีกครั้ง'
      : os === 'android' && target?.preferChrome
        ? 'แนะนำเปิดด้วย Chrome จะติดตั้งง่ายสุด'
        : os === 'ios'
          ? 'Apple ไม่อนุญาตติดตั้งอัตโนมัติ ต้องกดตามขั้นตอนสั้นๆ นี้'
          : 'ถ้ายังไม่ขึ้นหน้าต่างติดตั้งอัตโนมัติ ให้ทำตามนี้';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.guideBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.guideSheet}>
          <View style={styles.guideHandle} />
          <Text style={styles.guideTitle}>{title}</Text>
          <Text style={styles.guideHint}>{hint}</Text>
          {steps.map((s, i) => (
            <View key={s.text} style={styles.guideStep}>
              <View style={styles.guideNum}>
                <Text style={styles.guideNumText}>{i + 1}</Text>
              </View>
              <Ionicons name={s.icon} size={22} color={colors.navy} style={{ marginTop: 2 }} />
              <Text style={styles.guideStepText}>{s.text}</Text>
            </View>
          ))}
          <Pressable style={styles.guideBtn} onPress={onClose}>
            <Text style={styles.guideBtnText}>เข้าใจแล้ว</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen({ navigation }) {
  const { user, logout, canSeePartsPrice } = useAuth();
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const sheetStyle = contentSheetStyle(centerContent, Math.max(contentMaxWidth, 520));
  const goBack = () => navigation.goBack();

  const [asPwa, setAsPwa] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [installTarget, setInstallTarget] = useState(() => detectInstallTarget());

  const refresh = useCallback(async () => {
    setAsPwa(isRunningAsPwa());
    setCanInstall(canPromptInstall());
    setInstallTarget(detectInstallTarget());
    if (user && canSeePartsPrice && pushSupported()) {
      try {
        const sub = await getExistingSubscription();
        setPushOn(!!sub);
      } catch (_) {
        setPushOn(false);
      }
    } else {
      setPushOn(false);
    }
  }, [user, canSeePartsPrice]);

  useEffect(() => {
    initPwaInstallCapture();
    refresh();
    const off = onInstallPromptChange(() => refresh());
    return off;
  }, [refresh]);

  const installSubtitle = useMemo(() => {
    if (asPwa) return `ติดตั้งแล้วบน ${installTarget.label}`;
    if (canInstall) return `ตรวจพบ ${installTarget.label} · กดแล้วระบบจะติดตั้งให้`;
    if (installTarget.os === 'ios') {
      return installTarget.preferSafari
        ? 'ตรวจพบ iPhone · เปิดด้วย Safari แล้วกดอีกครั้ง'
        : 'ตรวจพบ iPhone · กดแล้วมีขั้นตอนสั้นๆ ให้ทำ';
    }
    if (installTarget.os === 'android') {
      return installTarget.preferChrome
        ? 'ตรวจพบ Android · แนะนำใช้ Chrome แล้วกดอีกครั้ง'
        : 'ตรวจพบ Android · กดเพื่อติดตั้ง (หรือเปิดคู่มือถ้ายังไม่ขึ้น)';
    }
    return `ตรวจพบ ${installTarget.label} · กดเพื่อติดตั้ง`;
  }, [asPwa, canInstall, installTarget]);

  const onInstall = async () => {
    if (isRunningAsPwa()) {
      showAlert('ติดตั้งแล้ว', 'คุณกำลังใช้งานแบบแอปบนหน้าจอโฮมอยู่');
      return;
    }
    setBusy(true);
    try {
      const res = await installAppSmart();
      setInstallTarget(res.target || detectInstallTarget());
      if (res.ok && res.reason === 'already_installed') {
        showAlert('ติดตั้งแล้ว', 'คุณกำลังใช้งานแบบแอปบนหน้าจอโฮมอยู่');
        return;
      }
      if (res.ok) {
        showAlert('ติดตั้งแล้ว', 'เปิดจากไอคอนบนจอโฮมได้เลย');
        refresh();
        return;
      }
      if (res.auto && !res.ok) {
        showAlert('ยังไม่ติดตั้ง', 'คุณกดยกเลิกในหน้าต่างติดตั้ง');
        refresh();
        return;
      }
      // No auto prompt available (iOS always, or Android/Desktop without event)
      setGuideOpen(true);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onTogglePush = async () => {
    if (!canSeePartsPrice) {
      showAlert('สำหรับเจ้าหน้าที่รับเรื่อง', 'แจ้งเตือนงานใหม่ส่งเฉพาะ admin / staff ที่รับและจัดการเรื่อง');
      return;
    }
    if (!pushSupported()) {
      showAlert('ยังใช้ไม่ได้', 'ต้องติดตั้งแอปลงจอโฮมแล้วเปิดจากไอคอนนั้น (iPhone iOS 16.4+)');
      return;
    }
    setBusy(true);
    try {
      if (pushOn) {
        await unsubscribeStaffPush();
        setPushOn(false);
        showAlert('ปิดแล้ว', 'จะไม่ได้รับการแจ้งเมื่อมีงานใหม่');
      } else {
        if (!isRunningAsPwa() && Platform.OS === 'web') {
          const cont = await confirmDialog(
            'แนะนำให้ติดตั้งแอปก่อน',
            'บนมือถือควรติดตั้งลงจอโฮมก่อน แล้วค่อยเปิดแจ้งเตือน — ทำต่อเลยไหม?',
            { confirmText: 'เปิดแจ้งเตือน', cancelText: 'ยกเลิก' }
          );
          if (!cont) return;
        }
        await subscribeStaffPush();
        setPushOn(true);
        showAlert('เปิดแล้ว', 'เมื่อมีแจ้งซ่อม/เสียกลางทาง จะเด้งบนเครื่องนี้');
      }
    } catch (e) {
      showAlert('ไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onTestLocal = async () => {
    setBusy(true);
    try {
      await showLocalTestNotification();
      showAlert('ทดสอบบนเครื่อง', 'ควรเห็นแจ้งเตือนทันทีบนอุปกรณ์นี้');
    } catch (e) {
      showAlert('ทดสอบไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const onTestPush = async () => {
    if (!pushOn) {
      showAlert('ยังไม่เปิดรับ', 'กด “รับการแจ้งเตือน” ก่อน แล้วค่อยทดสอบ');
      return;
    }
    setBusy(true);
    try {
      const res = await sendServerTestPush();
      if (res?.push_mode === 'empty') {
        showAlert(
          'ส่งแล้ว (แบบไม่มีข้อความ)',
          'เซิร์ฟเวอร์ยิงแจ้งเตือนสำเร็จ แต่เข้ารหัสข้อความไม่ได้ — Android จะเด้ง ส่วน iPhone จะไม่เด้ง แจ้งทีมดูแลให้เช็ค push_ping.php'
        );
      } else {
        showAlert(
          'เซิร์ฟเวอร์ส่งสำเร็จ ✓',
          'แจ้งเตือนจริงกำลังมา ควรเด้งภายในไม่กี่วินาที — ทดสอบปิดแอปหรือพับหน้าจอไว้ก็เด้งเหมือนกัน'
        );
      }
    } catch (e) {
      showAlert('ส่งไม่ถึง', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    const name = user?.username || '';
    const ok = await confirmDialog('ออกจากระบบ', name ? `ออกจากบัญชี ${name} ใช่ไหม?` : 'ออกจากระบบใช่ไหม?', {
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
      icon: 'warning',
      destructive: true,
    });
    if (!ok) return;
    logout();
    navigation.navigate('Dashboard');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ตั้งค่า</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>กรุณาเข้าสู่ระบบก่อน</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.primaryBtnText}>เข้าสู่ระบบ</Text>
          </Pressable>
        </View>
        {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}>
        <View style={[styles.headerInner, sheetStyle]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ตั้งค่า</Text>
          <Text style={styles.headerSub}>บัญชี · แอป · การแจ้งเตือน</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          centerContent && styles.scrollCentered,
          isMobile && mobileScrollInset,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={sheetStyle}>
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.username || '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.profileName}>{user.username}</Text>
              {user.job ? (
                <Text style={styles.profileJob} numberOfLines={2}>
                  {user.job}
                </Text>
              ) : null}
              <Text style={styles.profileRole}>{roleLabel(user.role)}</Text>
            </View>
            <StatusPill ok={asPwa} label={asPwa ? 'โหมดแอป' : 'ในเบราว์เซอร์'} />
          </View>

          <Text style={styles.sectionLabel}>แอปบนเครื่อง</Text>
          <View style={styles.group}>
            <SettingRow
              icon="phone-portrait-outline"
              title="สถานะแอป"
              subtitle={
                asPwa
                  ? 'เปิดจากไอคอนบนจอโฮมแล้ว — พร้อมแจ้งเตือนเต็มรูปแบบ'
                  : 'ยังเปิดในแท็บเบราว์เซอร์ ติดตั้งลงจอโฮมจะเสถียรกว่า'
              }
              right={<StatusPill ok={asPwa} label={asPwa ? 'พร้อม' : 'ยังไม่ติดตั้ง'} />}
            />
            <View style={styles.divider} />
            <SettingRow
              icon="download-outline"
              iconColor={colors.barFillAlt}
              title={asPwa ? 'ติดตั้งแอปแล้ว' : canInstall ? 'ติดตั้งแอปเลย' : 'ติดตั้งแอป'}
              subtitle={installSubtitle}
              onPress={busy ? undefined : onInstall}
            />
          </View>

          <Text style={styles.sectionLabel}>การแจ้งเตือน</Text>
          <View style={styles.group}>
            {canSeePartsPrice ? (
              <>
                <SettingRow
                  icon={pushOn ? 'notifications' : 'notifications-outline'}
                  iconColor={pushOn ? '#1FA97A' : colors.navy}
                  title="รับการแจ้งเตือนงานใหม่"
                  subtitle={
                    pushOn
                      ? 'เปิดอยู่ — แจ้งเมื่อมีคนแจ้งซ่อม/เสียกลางทาง'
                      : 'สำหรับเจ้าหน้าที่รับเรื่อง · กดเพื่อเปิดบนเครื่องนี้'
                  }
                  onPress={busy ? undefined : onTogglePush}
                  right={
                    <View style={[styles.switchTrack, pushOn && styles.switchTrackOn]}>
                      <View style={[styles.switchThumb, pushOn && styles.switchThumbOn]} />
                    </View>
                  }
                />
                <View style={styles.divider} />
                <SettingRow
                  icon="flash-outline"
                  title="ทดสอบแจ้งเตือน (เครื่องนี้)"
                  subtitle="เด้งทันทีบนเครื่องนี้"
                  onPress={busy ? undefined : onTestLocal}
                />
                <View style={styles.divider} />
                <SettingRow
                  icon="paper-plane-outline"
                  title="ทดสอบจากเซิร์ฟเวอร์"
                  subtitle="จำลองตอนมีคนแจ้งซ่อมเข้ามา"
                  onPress={busy ? undefined : onTestPush}
                  disabled={!pushOn}
                />
              </>
            ) : (
              <SettingRow
                icon="notifications-off-outline"
                title="แจ้งเตือนงานใหม่"
                subtitle="ส่งเฉพาะ admin / staff ที่รับเรื่องและจัดการ — บัญชีช่างไม่ได้รับกลุ่มนี้"
              />
            )}
          </View>

          <Text style={styles.sectionLabel}>บัญชี</Text>
          <View style={styles.group}>
            <SettingRow
              icon="log-out-outline"
              title="ออกจากระบบ"
              subtitle="สิ้นสุดเซสชันบนอุปกรณ์นี้"
              onPress={busy ? undefined : onLogout}
              danger
            />
          </View>

          <Text style={styles.sectionLabel}>เกี่ยวกับระบบ</Text>
          <View style={styles.aboutCard}>
            <View style={styles.aboutHead}>
              <Text style={styles.aboutVersion}>เวอร์ชัน {APP_VERSION}</Text>
              <Text style={styles.aboutDate}>{APP_UPDATE_DATE}</Text>
            </View>
            <Text style={styles.aboutLabel}>อัปเดตล่าสุด</Text>
            {APP_UPDATE_NOTES.map((line) => (
              <View key={line} style={styles.noteRow}>
                <Text style={styles.noteDot}>·</Text>
                <Text style={styles.noteText}>{line}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            เคล็ดลับ: บน iPhone ต้องติดตั้งลงโฮมก่อน แล้วเปิดจากไอคอนนั้น จึงเปิดแจ้งเตือนได้
          </Text>
        </View>
      </ScrollView>
      {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      <InstallGuideModal
        visible={guideOpen}
        onClose={() => setGuideOpen(false)}
        target={installTarget}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navyDeep },
  scrollView: { flex: 1 },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerCentered: { alignItems: 'center' },
  headerInner: { width: '100%' },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  scrollCentered: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onNavy, fontWeight: '800', fontSize: 22 },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: { color: colors.navy, fontWeight: '800', fontSize: 18 },
  profileJob: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginTop: 3 },
  profileRole: { color: colors.textSecondary, fontWeight: '600', fontSize: 12, marginTop: 2 },
  sectionLabel: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 64,
  },
  rowPressed: { backgroundColor: '#F3F5FB' },
  rowDisabled: { opacity: 0.45 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: { backgroundColor: '#FEE2E2' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 15 },
  rowTitleDanger: { color: '#B91C1C' },
  rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillOk: { backgroundColor: 'rgba(31,169,122,0.15)' },
  pillMuted: { backgroundColor: colors.navyTint },
  pillText: { fontSize: 11, fontWeight: '800' },
  pillTextOk: { color: '#059669' },
  pillTextMuted: { color: colors.textMuted },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1D5DB',
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: '#1FA97A' },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  aboutCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow,
  },
  aboutHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  aboutVersion: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  aboutDate: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  aboutLabel: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  noteRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  noteDot: { color: colors.barFillAlt, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  noteText: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.barFillAlt,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.navy, fontWeight: '800' },
  guideBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,26,56,0.55)',
    justifyContent: 'flex-end',
  },
  guideSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  guideHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  guideTitle: { color: colors.navy, fontWeight: '800', fontSize: 18, marginBottom: 2 },
  guideHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.navyTint,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  guideNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideNumText: { color: colors.onNavy, fontWeight: '800', fontSize: 12 },
  guideStepText: { flex: 1, color: colors.textPrimary, fontWeight: '600', fontSize: 14, lineHeight: 20 },
  guideBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 15 },
});
