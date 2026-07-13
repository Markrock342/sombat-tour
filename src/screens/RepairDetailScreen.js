import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import { useAuth } from '../auth/AuthContext';
import {
  getRepair,
  updateRepair,
  fetchRepairImages,
  uploadRepairImage,
  fetchRepairTracking,
  updateRepairStatus,
  fmtDateTime,
  isOpenRepair,
} from '../data/api';
import { repairListSections, parseRepairList } from '../data/repairNotes';
import { statusColor } from '../data/repairTracking';
import StatusPicker from '../components/StatusPicker';
import RepairStatusTimeline from '../components/RepairStatusTimeline';

export default function RepairDetailScreen({ route, navigation }) {
  const { repair: initial, rId: paramId } = route.params ?? {};
  const rId = paramId || initial?.r_id;
  const { canWrite, user } = useAuth();
  const { isMobile, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();

  const [repair, setRepair] = useState(initial || null);
  const [images, setImages] = useState([]);
  const [tracking, setTracking] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!rId) return;
    setLoading(true);
    setError(null);
    try {
      const [row, imgs] = await Promise.all([
        initial && String(initial.r_id) === String(rId) ? Promise.resolve(initial) : getRepair(rId),
        fetchRepairImages(rId).catch(() => []),
      ]);
      // always refresh repair from API when possible
      try {
        const fresh = await getRepair(rId);
        setRepair(fresh);
      } catch (_) {
        setRepair(row);
      }
      setImages(imgs);
      if (canWrite) {
        try {
          const tr = await fetchRepairTracking(rId);
          setTracking(tr.is_public ? tr : null);
        } catch (_) {
          setTracking(null);
        }
      }
    } catch (e) {
      setError(e.message || 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [rId, initial, canWrite]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const closeJob = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    setBusy(true);
    try {
      const data = await updateRepair({ r_id: rId, r_close: 1 });
      setRepair(data.row || { ...repair, r_close: 1 });
      Alert.alert('ปิดงานแล้ว');
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const img = res.assets[0];
    setBusy(true);
    try {
      await uploadRepairImage(rId, img.uri, img.fileName || 'photo.jpg', img.mimeType || 'image/jpeg');
      setImages(await fetchRepairImages(rId));
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else Alert.alert('อัปโหลดไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  };

  const setPublicStatus = async (status) => {
    if (!canWrite || !tracking?.meta) return;
    setBusy(true);
    try {
      const data = await updateRepairStatus({ r_id: rId, status, note: statusNote.trim() });
      setTracking({
        ...tracking,
        meta: { ...tracking.meta, public_status: data.public_status, public_status_label: data.public_status_label },
        timeline: data.timeline || tracking.timeline,
      });
      if (data.row) setRepair(data.row);
      setStatusNote('');
      Alert.alert('อัปเดตสถานะแล้ว', data.public_status_label || '');
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const open = repair ? isOpenRepair(repair) : false;
  const noteSections = repair ? repairListSections(repair.r_repair_list) : [];
  const parsed = repair ? parseRepairList(repair.r_repair_list) : null;
  const typeLabel =
    repair?.r_type === 'breakdown' || repair?.r_type === 'roadside' || parsed?.type === 'breakdown'
      ? 'เสียกลางทาง'
      : parsed?.type === 'offsite'
        ? 'งานนอกพื้นที่'
        : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>รายละเอียดงานซ่อม</Text>
          <Text style={styles.headerSub} numberOfLines={2}>
            #{repair?.r_job_num || rId}
            {repair?.r_dt_rec ? ` · ${fmtDateTime(repair.r_dt_rec)}` : ''}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
        >
          {loading ? (
            <LoadingView compact />
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.msg}>{error}</Text>
              <Pressable style={styles.btn} onPress={load}>
                <Text style={styles.btnText}>ลองใหม่</Text>
              </Pressable>
            </View>
          ) : repair ? (
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.pill, { backgroundColor: open ? '#1FA97A' : '#E5544B' }]}>
                    {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
                  </Text>
                  {typeLabel ? <Text style={styles.typeTag}>{typeLabel}</Text> : null}
                </View>

                {noteSections.map((sec) => (
                  <View key={sec.label} style={styles.noteBlock}>
                    <Text style={styles.noteLabel}>{sec.label}</Text>
                    <Text style={styles.noteValue}>{sec.value}</Text>
                  </View>
                ))}

                <Text style={styles.meta}>
                  ช่าง: {repair.r_technician || 'ไม่ระบุ'}
                  {repair.r_technician_id ? ` · ID ${repair.r_technician_id}` : ''}
                </Text>
                <Text style={styles.meta}>
                  รถ: {[repair.r_v_name, repair.r_v_plate].filter(Boolean).join(' · ') || '-'}
                </Text>
                <Text style={styles.meta}>
                  {[repair.r_v_brand, repair.r_v_model].filter(Boolean).join(' · ')}
                  {repair.r_mile ? ` · ไมล์ ${Number(repair.r_mile).toLocaleString()}` : ''}
                  {repair.r_tank_m ? ` · ถัง ${repair.r_tank_m} ม.` : ''}
                </Text>
              </View>

              {tracking?.is_public ? (
                <View style={styles.trackCard}>
                  <Text style={styles.trackSectionTitle}>แจ้งจากภายนอก</Text>
                  <Text style={styles.meta}>
                    ผู้แจ้ง: {tracking.meta.reporter_name}
                    {tracking.meta.reporter_phone ? ` · ${tracking.meta.reporter_phone}` : ''}
                  </Text>
                  <Text style={[styles.pill, styles.pillInline, { backgroundColor: statusColor(tracking.meta.public_status) }]}>
                    ผู้แจ้งเห็น: {tracking.meta.public_status_label}
                  </Text>
                  {canWrite ? (
                    <>
                      <Text style={styles.trackHint}>กดเลือกสถานะ — ผู้แจ้งจะเห็นใน QR ทันที</Text>
                      <StatusPicker
                        value={tracking.meta.public_status}
                        onSelect={setPublicStatus}
                        disabled={busy}
                      />
                      <TextInput
                        style={styles.statusInput}
                        value={statusNote}
                        onChangeText={setStatusNote}
                        placeholder="ข้อความถึงผู้แจ้ง (ไม่บังคับ)"
                        placeholderTextColor={colors.textMuted}
                      />
                    </>
                  ) : null}
                  <RepairStatusTimeline
                    timeline={tracking.timeline || []}
                    currentStatus={tracking.meta.public_status}
                  />
                  {tracking.meta.track_token ? (
                    <Pressable
                      style={[styles.btnAlt, { marginTop: spacing.sm, alignSelf: 'flex-start' }]}
                      onPress={() => navigation.navigate('TrackRepair', { token: tracking.meta.track_token })}
                    >
                      <Text style={styles.btnAltText}>เปิดหน้าที่ผู้แจ้งเห็น</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.actions}>
                {open ? (
                  <Pressable style={[styles.btn, busy && { opacity: 0.6 }]} onPress={closeJob} disabled={busy}>
                    <Text style={styles.btnText}>ปิดงาน</Text>
                  </Pressable>
                ) : null}
                <Pressable style={[styles.btnAlt, busy && { opacity: 0.6 }]} onPress={addPhoto} disabled={busy}>
                  <Text style={styles.btnAltText}>+ เพิ่มรูป</Text>
                </Pressable>
              </View>

              <Text style={styles.section}>รูปภาพ ({images.length})</Text>
              <View style={styles.gallery}>
                {images.length === 0 ? (
                  <Text style={styles.msg}>ยังไม่มีรูป</Text>
                ) : (
                  images.map((img) => (
                    <Image key={img.id} source={{ uri: img.url }} style={styles.thumb} />
                  ))
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
        {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: {
    color: colors.onNavy,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
  },
  typeTag: { color: '#B45309', fontWeight: '800', fontSize: 12 },
  noteBlock: { marginTop: spacing.md },
  noteLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  noteValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  meta: { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  btnAlt: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  btnAltText: { color: colors.navy, fontWeight: '800' },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm, fontWeight: '800', color: colors.navy },
  trackCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  trackSectionTitle: { fontWeight: '800', color: colors.navy, fontSize: 15, marginBottom: spacing.xs },
  trackHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  pillInline: { alignSelf: 'flex-start', marginTop: spacing.sm },
  statusInput: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: colors.navyTint },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  msg: { color: colors.textSecondary, textAlign: 'center' },
});
