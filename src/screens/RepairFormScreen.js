import React, { useCallback, useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useIsMobile, mobileScrollInset } from '../components/BackNavigation';
import { useAuth } from '../auth/AuthContext';
import {
  createRepair,
  fetchTechnicians,
  searchVehicles,
  uploadRepairImage,
} from '../data/api';

export default function RepairFormScreen({ navigation, route }) {
  const { canWrite, user } = useAuth();
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();
  const presetType = route?.params?.type || 'normal';

  const [vehicleQ, setVehicleQ] = useState('');
  const [vehicleHits, setVehicleHits] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [repairList, setRepairList] = useState(presetType === 'breakdown' ? 'เสียกลางทาง: ' : '');
  const [mile, setMile] = useState('');
  const [tankM, setTankM] = useState('');
  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState(null);
  const [techName, setTechName] = useState('');
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canWrite) {
      navigation.replace('Login');
    }
  }, [canWrite, navigation]);

  useEffect(() => {
    fetchTechnicians()
      .then(setTechs)
      .catch(() => setTechs([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = vehicleQ.trim();
      if (!term || vehicle) {
        setVehicleHits([]);
        return;
      }
      try {
        setVehicleHits(await searchVehicles(term));
      } catch (_) {
        setVehicleHits([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [vehicleQ, vehicle]);

  const pickImage = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImages((prev) => [...prev, res.assets[0]]);
    }
  }, []);

  const onSave = async () => {
    if (!repairList.trim()) {
      setError('กรุณากรอกรายการซ่อม');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        r_repair_list: repairList.trim(),
        r_mile: Number(mile) || 0,
        r_technician: techName,
        r_technician_id: techId || 0,
        r_type: presetType === 'breakdown' ? 'breakdown' : 'normal',
        r_tank_m: tankM,
      };
      if (vehicle) {
        payload.v_id = vehicle.v_id;
        payload.r_v_name = vehicle.v_name;
        payload.r_v_plate = vehicle.v_plate;
        payload.r_v_brand = vehicle.v_brand;
        payload.r_v_model = vehicle.v_model;
        payload.r_v_chassis = vehicle.v_chassis;
        payload.r_v_company = vehicle.v_company;
        payload.r_inv_com = vehicle.inv_company;
        if (!tankM && vehicle.v_metr) payload.r_tank_m = String(vehicle.v_metr);
      }
      const created = await createRepair(payload);
      for (const img of images) {
        try {
          await uploadRepairImage(created.r_id, img.uri, img.fileName || 'photo.jpg', img.mimeType || 'image/jpeg');
        } catch (_) {
          /* continue */
        }
      }
      Alert.alert('สำเร็จ', `แจ้งซ่อมแล้ว #${created.r_job_num || created.r_id}`);
      navigation.replace('RepairDetail', { rId: created.r_id });
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') {
        navigation.navigate('Login');
      } else {
        setError(e.message || 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={styles.headerTitle}>
            {presetType === 'breakdown' ? 'แจ้งเสียกลางทาง' : 'แจ้งซ่อมออนไลน์'}
          </Text>
          <Text style={styles.headerSub}>{user?.username ? `ผู้ใช้: ${user.username}` : ''}</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>ค้นหารถ</Text>
          {vehicle ? (
            <View style={styles.selected}>
              <Text style={styles.selectedText}>
                {vehicle.v_name} · {vehicle.v_plate || '-'}
              </Text>
              <Pressable onPress={() => { setVehicle(null); setVehicleQ(''); }}>
                <Text style={styles.clear}>เปลี่ยน</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={vehicleQ}
                onChangeText={setVehicleQ}
                placeholder="เบอร์รถ / ID"
                placeholderTextColor={colors.textMuted}
              />
              {vehicleHits.slice(0, 6).map((v) => (
                <Pressable
                  key={v.v_id}
                  style={styles.hit}
                  onPress={() => {
                    setVehicle(v);
                    setVehicleQ(v.v_name || String(v.v_id));
                    if (v.v_metr) setTankM(String(v.v_metr));
                  }}
                >
                  <Text style={styles.hitText}>
                    {v.v_name} · {v.v_plate || '-'} · {[v.v_brand, v.v_model].filter(Boolean).join(' ')}
                  </Text>
                </Pressable>
              ))}
            </>
          )}

          <Text style={styles.label}>รายการซ่อม *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={repairList}
            onChangeText={setRepairList}
            multiline
            placeholder="อธิบายอาการ / งานซ่อม"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>เลขไมล์ / เมตร</Text>
          <TextInput
            style={styles.input}
            value={mile}
            onChangeText={setMile}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />

          {presetType === 'breakdown' ? (
            <>
              <Text style={styles.label}>เมตรถัง / ความยาว (ม.)</Text>
              <TextInput
                style={styles.input}
                value={tankM}
                onChangeText={setTankM}
                placeholder="เช่น 12"
                placeholderTextColor={colors.textMuted}
              />
            </>
          ) : null}

          <Text style={styles.label}>ช่างผู้ซ่อม</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.techRow}>
            {techs.map((t) => {
              const active = String(techId) === String(t.id);
              return (
                <Pressable
                  key={t.id}
                  style={[styles.techChip, active && styles.techChipActive]}
                  onPress={() => {
                    setTechId(t.id);
                    setTechName(t.name);
                  }}
                >
                  <Text style={[styles.techChipText, active && styles.techChipTextActive]}>{t.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>รูปภาพ ({images.length})</Text>
          <Pressable style={styles.secondaryBtn} onPress={pickImage}>
            <Text style={styles.secondaryBtnText}>+ แนบรูป</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
            <Text style={styles.primaryBtnText}>{saving ? 'กำลังบันทึก...' : 'บันทึกแจ้งซ่อม'}</Text>
          </Pressable>
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
  label: { color: colors.textSecondary, fontWeight: '700', fontSize: 13, marginTop: spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  selected: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.navyTint,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  selectedText: { color: colors.navy, fontWeight: '700', flex: 1 },
  clear: { color: colors.barFillAlt, fontWeight: '800' },
  hit: { backgroundColor: colors.card, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  hitText: { color: colors.textPrimary, fontSize: 13 },
  techRow: { marginBottom: spacing.sm },
  techChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
    marginRight: 8,
  },
  techChipActive: { backgroundColor: colors.navy },
  techChipText: { color: colors.navySoft, fontWeight: '700', fontSize: 13 },
  techChipTextActive: { color: colors.onNavy },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    ...shadow,
  },
  secondaryBtnText: { color: colors.navy, fontWeight: '800' },
  primaryBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 15 },
  error: { color: '#E5544B', marginTop: spacing.md, fontWeight: '700' },
});
