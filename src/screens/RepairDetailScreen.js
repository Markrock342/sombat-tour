import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import { useAuth } from '../auth/AuthContext';
import {
  getRepair,
  updateRepair,
  fetchRepairImages,
  uploadRepairImage,
  fmtDateTime,
  isOpenRepair,
} from '../data/api';

export default function RepairDetailScreen({ route, navigation }) {
  const { repair: initial, rId: paramId } = route.params ?? {};
  const rId = paramId || initial?.r_id;
  const { canWrite, user } = useAuth();
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();

  const [repair, setRepair] = useState(initial || null);
  const [images, setImages] = useState([]);
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
    } catch (e) {
      setError(e.message || 'โหลดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [rId, initial]);

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
    if (!canWrite && !user) {
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

  const open = repair ? isOpenRepair(repair) : false;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={styles.headerTitle}>รายละเอียดงานซ่อม</Text>
          <Text style={styles.headerSub}>
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
                  {repair.r_type === 'breakdown' || repair.r_type === 'roadside' ? (
                    <Text style={styles.typeTag}>เสียกลางทาง</Text>
                  ) : null}
                </View>
                <Text style={styles.title}>{repair.r_repair_list || '-'}</Text>
                <Text style={styles.meta}>ช่าง: {repair.r_technician || 'ไม่ระบุ'}</Text>
                <Text style={styles.meta}>
                  รถ: {[repair.r_v_name, repair.r_v_plate].filter(Boolean).join(' · ') || '-'}
                </Text>
                <Text style={styles.meta}>
                  {[repair.r_v_brand, repair.r_v_model].filter(Boolean).join(' · ')}
                  {repair.r_mile ? ` · ไมล์ ${Number(repair.r_mile).toLocaleString()}` : ''}
                  {repair.r_tank_m ? ` · ถัง ${repair.r_tank_m} ม.` : ''}
                </Text>
              </View>

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
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
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
  title: {
    marginTop: spacing.md,
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    backgroundColor: '#FFF0C2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
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
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: colors.navyTint },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  msg: { color: colors.textSecondary, textAlign: 'center' },
});
