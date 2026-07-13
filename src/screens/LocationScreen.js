import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import { useAuth } from '../auth/AuthContext';
import { fetchLocations, saveLocation, deleteLocation, fmtDateTime } from '../data/api';

export default function LocationScreen({ navigation }) {
  const { canWrite } = useAuth();
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [spot, setSpot] = useState('');
  const [detail, setDetail] = useState('');
  const [vName, setVName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchLocations());
    } catch (e) {
      Alert.alert('โหลดไม่สำเร็จ', e.message || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSave = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    if (!title.trim()) {
      Alert.alert('กรุณาใส่หัวข้อตำแหน่ง');
      return;
    }
    setSaving(true);
    try {
      await saveLocation({
        title: title.trim(),
        spot: spot.trim(),
        detail: detail.trim(),
        v_name: vName.trim(),
      });
      setTitle('');
      setSpot('');
      setDetail('');
      setVName('');
      await load();
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else Alert.alert('ไม่สำเร็จ', e.message || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={styles.headerTitle}>ตำแหน่งรถจอด</Text>
          <Text style={styles.headerSub}>มาร์กตำแหน่งด้วยมือ — ทุกแผนกดูได้</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Text style={styles.label}>หัวข้อ *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="เช่น ลานหน้าอู่" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>จุดจอด / สปอต</Text>
            <TextInput style={styles.input} value={spot} onChangeText={setSpot} placeholder="A-12" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>เบอร์รถ</Text>
            <TextInput style={styles.input} value={vName} onChangeText={setVName} placeholder="332" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>รายละเอียด</Text>
            <TextInput style={[styles.input, styles.textarea]} value={detail} onChangeText={setDetail} multiline placeholder="โน้ตเพิ่มเติม" placeholderTextColor={colors.textMuted} />
            <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'กำลังบันทึก...' : 'บันทึกตำแหน่ง'}</Text>
            </Pressable>
          </View>

          {loading ? (
            <LoadingView compact />
          ) : (
            rows.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                {r.spot ? <Text style={styles.cardSpot}>จุด: {r.spot}</Text> : null}
                {r.v_name ? <Text style={styles.cardMeta}>รถ: {r.v_name}</Text> : null}
                {r.detail ? <Text style={styles.cardDetail}>{r.detail}</Text> : null}
                <Text style={styles.cardMeta}>
                  {[r.created_by, r.updated_at ? fmtDateTime(r.updated_at) : ''].filter(Boolean).join(' · ')}
                </Text>
                <Pressable
                  onPress={async () => {
                    if (!canWrite) {
                      navigation.navigate('Login');
                      return;
                    }
                    try {
                      await deleteLocation(r.id);
                      await load();
                    } catch (e) {
                      Alert.alert('ลบไม่สำเร็จ', e.message || '');
                    }
                  }}
                >
                  <Text style={styles.delete}>ลบ</Text>
                </Pressable>
              </View>
            ))
          )}
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
    gap: spacing.md,
  },
  form: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  label: { color: colors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  cardTitle: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  cardSpot: { color: colors.barFillAlt, fontWeight: '800', marginTop: 4 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  cardDetail: { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
  delete: { color: '#B91C1C', fontWeight: '700', marginTop: 10, fontSize: 12 },
});
