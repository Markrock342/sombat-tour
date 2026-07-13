import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import { useAuth } from '../auth/AuthContext';
import {
  createRepair,
  fetchTechnicians,
  searchVehicles,
  uploadRepairImage,
} from '../data/api';
import { composeRepairList, REPAIR_TYPES, workshopNamesFromTechs, personTechsFromTechs } from '../data/repairNotes';
import { showAlert } from '../utils/dialog';

export default function RepairFormScreen({ navigation, route }) {
  const { canWrite, user } = useAuth();
  const { isMobile, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const presetType = route?.params?.type || 'normal';

  const [jobType, setJobType] = useState(
    presetType === 'breakdown' ? 'breakdown' : presetType === 'offsite' ? 'offsite' : 'normal'
  );
  const [vehicleQ, setVehicleQ] = useState('');
  const [vehicleHits, setVehicleHits] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [symptom, setSymptom] = useState(presetType === 'breakdown' ? '' : '');
  const [location, setLocation] = useState('');
  const [workshopPicked, setWorkshopPicked] = useState(false);
  const [parts, setParts] = useState('');
  const [action, setAction] = useState('');
  const [mile, setMile] = useState('');
  const [tankM, setTankM] = useState('');
  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState(null);
  const [techName, setTechName] = useState('');
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isBreakdown = jobType === 'breakdown';
  const workshops = useMemo(() => workshopNamesFromTechs(techs), [techs]);
  const personTechs = useMemo(() => personTechsFromTechs(techs), [techs]);
  const workshopHits = useMemo(() => {
    if (isBreakdown || workshopPicked || jobType === 'offsite') return [];
    const term = location.trim().toLowerCase();
    if (!term) return workshops.slice(0, 12);
    return workshops.filter((n) => n.toLowerCase().includes(term)).slice(0, 12);
  }, [isBreakdown, workshopPicked, jobType, location, workshops]);

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

  const setType = (key) => {
    setJobType(key);
    setLocation('');
    setWorkshopPicked(false);
  };

  const pickImage = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]) {
      setImages((prev) => [...prev, res.assets[0]]);
    }
  }, []);

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSave = async () => {
    if (!symptom.trim()) {
      setError('กรุณากรอกอาการ / ปัญหา');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const repairList = composeRepairList({
        type: jobType,
        symptom,
        location,
        parts,
        action,
      });
      const payload = {
        r_repair_list: repairList,
        r_mile: Number(mile) || 0,
        r_technician: techName,
        r_technician_id: techId || 0,
        r_type: jobType === 'breakdown' ? 'breakdown' : 'normal',
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
      let uploadFailed = 0;
      let uploadErr = '';
      for (const img of images) {
        try {
          await uploadRepairImage(
            created.r_id,
            img.uri,
            img.fileName || 'photo.jpg',
            img.mimeType || 'image/jpeg'
          );
        } catch (e) {
          uploadFailed += 1;
          uploadErr = e.message || uploadErr;
        }
      }
      if (uploadFailed > 0) {
        await showAlert(
          'บันทึกงานแล้ว แต่รูปไม่ครบ',
          `อัปโหลดไม่สำเร็จ ${uploadFailed}/${images.length} รูป${uploadErr ? ` (${uploadErr})` : ''} — กด "เพิ่มรูป" ในหน้ารายละเอียดได้`
        );
      } else {
        await showAlert('สำเร็จ', `แจ้งซ่อมแล้ว #${created.r_job_num || created.r_id}`);
      }
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

  const showTank = jobType === 'breakdown';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>
            {jobType === 'breakdown' ? 'แจ้งเสียกลางทาง' : 'แจ้งซ่อมออนไลน์'}
          </Text>
          {!isMobile && user?.username ? (
            <Text style={styles.headerSub}>{`ผู้ใช้: ${user.username}`}</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ประเภทงาน */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ประเภทงาน</Text>
            <View style={styles.chipRow}>
              {REPAIR_TYPES.map((t) => {
                const active = jobType === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setType(t.key)}
                  >
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* รถ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>รถ</Text>
            {vehicle ? (
              <View style={styles.vehicleCard}>
                <View style={styles.vehicleHead}>
                  <Text style={styles.vehicleName}>{vehicle.v_name || '-'}</Text>
                  <Pressable
                    onPress={() => {
                      setVehicle(null);
                      setVehicleQ('');
                    }}
                  >
                    <Text style={styles.link}>เปลี่ยน</Text>
                  </Pressable>
                </View>
                <Text style={styles.vehicleMeta}>
                  {[vehicle.v_plate, vehicle.v_brand, vehicle.v_model].filter(Boolean).join(' · ') ||
                    'ไม่มีทะเบียน/รุ่น'}
                </Text>
                {vehicle.v_id ? (
                  <Text style={styles.vehicleId}>ID รถ: {vehicle.v_id}</Text>
                ) : null}
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={vehicleQ}
                  onChangeText={setVehicleQ}
                  placeholder="ค้นหาเบอร์รถ / ทะเบียน / ID"
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
                    <Text style={styles.hitTitle}>{v.v_name}</Text>
                    <Text style={styles.hitMeta}>
                      {[v.v_plate, v.v_brand, v.v_model].filter(Boolean).join(' · ')}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            <View style={styles.row2}>
              <View style={styles.half}>
                <Text style={styles.label}>เลขไมล์</Text>
                <TextInput
                  style={styles.input}
                  value={mile}
                  onChangeText={setMile}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {showTank ? (
                <View style={styles.half}>
                  <Text style={styles.label}>เมตรถัง (ม.)</Text>
                  <TextInput
                    style={styles.input}
                    value={tankM}
                    onChangeText={setTankM}
                    placeholder="เช่น 12"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ) : (
                <View style={styles.half} />
              )}
            </View>
          </View>

          {/* งาน */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>รายละเอียดงาน</Text>

            <Text style={styles.label}>อาการ / ปัญหา *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={symptom}
              onChangeText={setSymptom}
              multiline
              placeholder="รถมีอาการอะไร / ปัญหาอะไร"
              placeholderTextColor={colors.textMuted}
            />

            {isBreakdown ? (
              <>
                <Text style={styles.label}>จุดที่รถเสีย</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="เช่น กม.45 ถ.พหลโยธิน · หน้าปั๊ม"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            ) : jobType === 'offsite' ? (
              <>
                <Text style={styles.label}>สถานที่ทำงาน</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="เช่น นอกพื้นที่ / ลูกค้า"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>อู่</Text>
                {workshopPicked ? (
                  <View style={styles.pickedRow}>
                    <Text style={styles.pickedText}>{location}</Text>
                    <Pressable
                      onPress={() => {
                        setWorkshopPicked(false);
                        setLocation('');
                      }}
                    >
                      <Text style={styles.link}>เปลี่ยน</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      value={location}
                      onChangeText={(v) => {
                        setLocation(v);
                        setWorkshopPicked(false);
                      }}
                      placeholder="เช่น อู่เชียงราย"
                      placeholderTextColor={colors.textMuted}
                      autoCorrect={false}
                    />
                    {workshopHits.map((name) => (
                      <Pressable
                        key={name}
                        style={styles.hit}
                        onPress={() => {
                          setLocation(name);
                          setWorkshopPicked(true);
                        }}
                      >
                        <Text style={styles.hitTitle}>{name}</Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            )}

            <Text style={styles.label}>อะไหล่ (ใช้ / ต้องการ)</Text>
            <TextInput
              style={[styles.input, styles.textareaSm]}
              value={parts}
              onChangeText={setParts}
              multiline
              placeholder="รายการอะไหล่"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>ดำเนินการ / ใครทำอะไร</Text>
            <TextInput
              style={[styles.input, styles.textareaSm]}
              value={action}
              onChangeText={setAction}
              multiline
              placeholder="สรุปสิ่งที่ทำหรือมอบหมาย"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* ช่าง — by ID */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ช่างผู้ซ่อม</Text>
            <Text style={styles.hint}>เลือกด้วยรหัสช่าง (ID) — เปลี่ยนชื่อเล่นได้โดยไม่หลุดงาน</Text>
            <View style={styles.techGrid}>
              {personTechs.map((t) => {
                const active = String(techId) === String(t.id);
                return (
                  <Pressable
                    key={t.id}
                    style={[styles.techCard, isMobile && styles.techCardMobile, active && styles.techCardActive]}
                    onPress={() => {
                      setTechId(t.id);
                      setTechName(t.name);
                    }}
                  >
                    <Text
                      style={[styles.techName, active && styles.techNameActive]}
                      numberOfLines={1}
                    >
                      {t.name}
                    </Text>
                    <Text style={[styles.techId, active && styles.techIdActive]}>#{t.id}</Text>
                  </Pressable>
                );
              })}
            </View>
            {techId ? (
              <Text style={styles.selectedTech}>
                เลือกแล้ว: {techName} (ID {techId})
              </Text>
            ) : null}
          </View>

          {/* รูป */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>รูปภาพ ({images.length})</Text>
            <Pressable style={styles.secondaryBtn} onPress={pickImage}>
              <Text style={styles.secondaryBtnText}>+ แนบรูป</Text>
            </Pressable>
            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {images.map((img, idx) => (
                  <Pressable key={`${img.uri}-${idx}`} onPress={() => removeImage(idx)}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Text style={styles.thumbRemove}>ลบ</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกแจ้งซ่อม'}
            </Text>
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
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
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
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow,
  },
  sectionTitle: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  label: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  textareaSm: { minHeight: 64, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.navyTint,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  typeChipText: { color: colors.navySoft, fontWeight: '700', fontSize: 13 },
  typeChipTextActive: { color: colors.onNavy },
  vehicleCard: {
    backgroundColor: colors.navyTint,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  vehicleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleName: { color: colors.navy, fontWeight: '800', fontSize: 16, flex: 1 },
  vehicleMeta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  vehicleId: { color: colors.textMuted, marginTop: 2, fontSize: 11 },
  link: { color: colors.barFillAlt, fontWeight: '800' },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickedText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15, flex: 1 },
  hit: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hitTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  hitMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  row2: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  half: { flex: 1 },
  techGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  techCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  techCardActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  techCardMobile: { width: '100%', minWidth: 0 },
  techName: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  techNameActive: { color: colors.onNavy },
  techId: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  techIdActive: { color: 'rgba(255,255,255,0.7)' },
  selectedTech: {
    marginTop: spacing.sm,
    color: colors.navy,
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  secondaryBtnText: { color: colors.navy, fontWeight: '800' },
  thumbRow: { marginTop: spacing.sm },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    marginRight: 8,
    backgroundColor: colors.border,
  },
  thumbRemove: {
    textAlign: 'center',
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    marginRight: 8,
  },
  primaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 15 },
  error: { color: '#E5544B', fontWeight: '700', textAlign: 'center' },
});
