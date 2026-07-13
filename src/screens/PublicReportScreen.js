import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset, contentSheetStyle } from '../components/BackNavigation';
import { PublicStepBanner, StickyActionBar } from '../components/PublicFlowUX';
import {
  createPublicRepair,
  searchVehicles,
  uploadPublicRepairImage,
  fetchTechnicians,
} from '../data/api';
import { composeRepairList, REPAIR_TYPES, workshopNamesFromTechs } from '../data/repairNotes';
import { limitPhoneInput } from '../data/contactActions';

export default function PublicReportScreen({ navigation, route }) {
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const sheetStyle = contentSheetStyle(centerContent, contentMaxWidth);
  const goBack = () => navigation.goBack();
  const presetType = route?.params?.type || 'normal';

  const [jobType, setJobType] = useState(presetType === 'breakdown' ? 'breakdown' : 'normal');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [vehicleQ, setVehicleQ] = useState('');
  const [vehicleHits, setVehicleHits] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [symptom, setSymptom] = useState('');
  const [location, setLocation] = useState('');
  const [workshopPicked, setWorkshopPicked] = useState(false);
  const [workshops, setWorkshops] = useState(() => workshopNamesFromTechs([]));
  const [mile, setMile] = useState('');
  const [tankM, setTankM] = useState('');
  const [images, setImages] = useState([]);
  const [honeypot, setHoneypot] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [vehicleSearching, setVehicleSearching] = useState(false);

  const isBreakdown = jobType === 'breakdown';

  const workshopHits = useMemo(() => {
    if (isBreakdown || workshopPicked) return [];
    const term = location.trim().toLowerCase();
    const list = workshops;
    if (!term) return list.slice(0, 8);
    return list.filter((n) => n.toLowerCase().includes(term)).slice(0, 8);
  }, [isBreakdown, workshopPicked, location, workshops]);

  const activeStep = useMemo(() => {
    if (!reporterName.trim()) return 1;
    if (!symptom.trim()) return 2;
    return 2;
  }, [reporterName, symptom]);

  const canSubmit = reporterName.trim() && symptom.trim() && !saving;

  useEffect(() => {
    let cancelled = false;
    fetchTechnicians()
      .then((rows) => {
        if (!cancelled) setWorkshops(workshopNamesFromTechs(rows));
      })
      .catch(() => {
        if (!cancelled) setWorkshops(workshopNamesFromTechs([]));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const term = vehicleQ.trim();
    if (!term || vehicle) {
      setVehicleHits([]);
      setVehicleSearching(false);
      return undefined;
    }
    setVehicleSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchVehicles(term);
        setVehicleHits(rows.slice(0, 8));
      } catch (_) {
        setVehicleHits([]);
      } finally {
        setVehicleSearching(false);
      }
    }, 200);
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

  const onSave = async () => {
    if (!reporterName.trim()) {
      setFieldError('name');
      setError('ใส่ชื่อผู้แจ้งก่อน');
      return;
    }
    if (!symptom.trim()) {
      setFieldError('symptom');
      setError('บอกอาการ / ปัญหาที่พบ');
      return;
    }
    setSaving(true);
    setError(null);
    setFieldError(null);
    try {
      const repairList = composeRepairList({
        type: jobType,
        symptom,
        location,
        parts: '',
        action: '',
      });
      const payload = {
        reporter_name: reporterName.trim(),
        reporter_phone: limitPhoneInput(reporterPhone),
        r_repair_list: repairList,
        r_mile: Number(mile) || 0,
        r_type: jobType === 'breakdown' ? 'breakdown' : 'normal',
        r_tank_m: tankM,
        _website: honeypot,
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
      const created = await createPublicRepair(payload);
      for (const img of images) {
        try {
          await uploadPublicRepairImage(
            created.r_id,
            created.track_token,
            img.uri,
            img.fileName || 'photo.jpg',
            img.mimeType || 'image/jpeg'
          );
        } catch (_) {
          /* continue */
        }
      }
      navigation.replace('ReportSuccess', {
        rId: created.r_id,
        rJobNum: created.r_job_num,
        trackToken: created.track_token,
      });
    } catch (e) {
      setError(e.message || 'ส่งไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [styles.input, isMobile && styles.inputMobile];
  const scrollBottom = isMobile ? { paddingBottom: 140 } : mobileScrollInset;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View
          style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}
        >
          <View style={[styles.headerInner, sheetStyle]}>
            {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
            <Text style={[styles.headerTitle, { fontSize: titleSize }]}>แจ้งซ่อม</Text>
            <Text style={styles.headerSub}>ไม่ต้อง login · ส่งแล้วได้ QR ติดตาม</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scroll,
            scrollBottom,
            centerContent && styles.scrollCentered,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[sheetStyle, styles.sheet]}>
          <PublicStepBanner activeStep={activeStep} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1 · คุณคือใคร</Text>
            <Text style={styles.sectionHint}>แค่ชื่อพอ — ไม่ต้องสมัครสมาชิก</Text>
            <Text style={styles.label}>ชื่อผู้แจ้ง *</Text>
            <TextInput
              style={[...inputStyle, fieldError === 'name' && styles.inputError]}
              value={reporterName}
              onChangeText={(v) => { setReporterName(v); setFieldError(null); setError(null); }}
              placeholder="เช่น สมชาย ใจดี"
              placeholderTextColor={colors.textMuted}
              autoComplete="name"
            />
            <Text style={styles.label}>เบอร์โทร (ไม่บังคับ)</Text>
            <TextInput
              style={inputStyle}
              value={reporterPhone}
              onChangeText={(v) => setReporterPhone(limitPhoneInput(v))}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="เช่น 0812345678"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2 · รถ & อาการ</Text>
            <View style={[styles.chipRow, isMobile && styles.chipRowMobile]}>
              {REPAIR_TYPES.filter((t) => t.key !== 'offsite').map((t) => {
                const active = jobType === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.typeChip, isMobile && styles.typeChipMobile, active && styles.typeChipActive]}
                    onPress={() => setType(t.key)}
                  >
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {vehicle ? (
              <View style={styles.vehicleCard}>
                <View style={styles.vehicleHead}>
                  <Text style={styles.vehicleName}>{vehicle.v_name || vehicle.v_plate || '-'}</Text>
                  <Pressable onPress={() => { setVehicle(null); setVehicleQ(''); setVehicleHits([]); }} hitSlop={8}>
                    <Text style={styles.link}>เปลี่ยน</Text>
                  </Pressable>
                </View>
                <Text style={styles.vehicleMeta}>
                  {[vehicle.v_plate, vehicle.v_brand, vehicle.v_model].filter(Boolean).join(' · ') || '—'}
                </Text>
                {vehicle.v_id ? <Text style={styles.vehicleId}>ID {vehicle.v_id}</Text> : null}
              </View>
            ) : (
              <>
                <Text style={styles.label}>ค้นหารถ (ไม่บังคับ)</Text>
                <Text style={styles.sectionHint}>พิมพ์เบอร์รถ / ทะเบียน / ID แล้วเลือกรายการที่ขึ้น</Text>
                <TextInput
                  style={inputStyle}
                  value={vehicleQ}
                  onChangeText={setVehicleQ}
                  placeholder="เช่น 31-5760 หรือ 142"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {vehicleSearching ? (
                  <Text style={styles.searchStatus}>กำลังค้นหา...</Text>
                ) : null}
                {!vehicleSearching && vehicleQ.trim() && vehicleHits.length === 0 ? (
                  <Text style={styles.searchStatus}>ไม่พบรถ — พิมพ์ทะเบียน/เบอร์รถต่อ หรือข้ามได้</Text>
                ) : null}
                {vehicleHits.length > 0 ? (
                  <View style={styles.suggestBox}>
                    {vehicleHits.map((v) => (
                      <Pressable
                        key={v.v_id}
                        style={styles.hit}
                        onPress={() => {
                          setVehicle(v);
                          setVehicleQ(v.v_name || v.v_plate || String(v.v_id));
                          setVehicleHits([]);
                          if (v.v_metr) setTankM(String(v.v_metr));
                        }}
                      >
                        <Text style={styles.hitTitle}>{v.v_name || v.v_plate || `ID ${v.v_id}`}</Text>
                        <Text style={styles.hitMeta}>
                          {[v.v_plate, v.v_brand, v.v_model, v.v_id ? `ID ${v.v_id}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            )}

            <Text style={styles.label}>อาการ / ปัญหา *</Text>
            <TextInput
              style={[...inputStyle, styles.textarea, fieldError === 'symptom' && styles.inputError]}
              value={symptom}
              onChangeText={(v) => { setSymptom(v); setFieldError(null); setError(null); }}
              multiline
              placeholder="เช่น เบรกเสีย ไฟเตือนโชว์ รถสตาร์ทไม่ติด"
              placeholderTextColor={colors.textMuted}
            />

            {isBreakdown ? (
              <>
                <Text style={styles.label}>จุดที่รถเสีย</Text>
                <Text style={styles.sectionHint}>บอกตำแหน่งให้แผนกหาเจอเร็ว เช่น กม. / แยก / หลักกิโล</Text>
                <TextInput
                  style={inputStyle}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="เช่น กม.45 ถ.พหลโยธิน · หน้าปั๊ม"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={[styles.row2, isMobile && styles.row2Stack]}>
                  <View style={styles.half}>
                    <Text style={styles.label}>ไมล์</Text>
                    <TextInput
                      style={inputStyle}
                      value={mile}
                      onChangeText={setMile}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>เมตรถัง</Text>
                    <TextInput
                      style={inputStyle}
                      value={tankM}
                      onChangeText={setTankM}
                      placeholder="ม."
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>อู่</Text>
                <Text style={styles.sectionHint}>พิมพ์ชื่อแล้วเลือกจากรายการ</Text>
                {workshopPicked ? (
                  <View style={styles.vehicleCard}>
                    <View style={styles.vehicleHead}>
                      <Text style={styles.vehicleName}>{location}</Text>
                      <Pressable
                        onPress={() => {
                          setWorkshopPicked(false);
                          setLocation('');
                        }}
                        hitSlop={8}
                      >
                        <Text style={styles.link}>เปลี่ยน</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={inputStyle}
                      value={location}
                      onChangeText={(v) => {
                        setLocation(v);
                        setWorkshopPicked(false);
                      }}
                      placeholder="เช่น อู่เชียงราย"
                      placeholderTextColor={colors.textMuted}
                      autoCorrect={false}
                    />
                    {workshopHits.length > 0 ? (
                      <View style={styles.suggestBox}>
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
                      </View>
                    ) : null}
                  </>
                )}
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>รูป (ไม่บังคับ)</Text>
            <Pressable style={styles.secondaryBtn} onPress={pickImage}>
              <Text style={styles.secondaryBtnText}>+ ถ่าย / เลือกรูป</Text>
            </Pressable>
            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {images.map((img, idx) => (
                  <Image key={`${img.uri}-${idx}`} source={{ uri: img.uri }} style={styles.thumb} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.optionalHint}>ช่วยให้แผนกเข้าใจปัญหาเร็วขึ้น</Text>
            )}
          </View>

          {Platform.OS === 'web' ? (
            <TextInput style={styles.trap} value={honeypot} onChangeText={setHoneypot} tabIndex={-1} />
          ) : null}

          {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}

          {!isMobile ? (
            <>
              <Pressable style={[styles.primaryBtn, !canSubmit && { opacity: 0.5 }]} onPress={onSave} disabled={!canSubmit}>
                <Text style={styles.primaryBtnText}>{saving ? 'กำลังส่ง...' : 'ส่งแจ้งซ่อม → รับ QR'}</Text>
              </Pressable>
              <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('TrackRepair')}>
                <Text style={styles.linkBtnText}>มี QR แล้ว? ดูสถานะ ›</Text>
              </Pressable>
            </>
          ) : null}
          </View>
        </ScrollView>

        {isMobile ? (
          <>
            <StickyActionBar
              hint={canSubmit ? 'กดส่งแล้วรับ QR ติดตามทันที' : 'ใส่ชื่อ + อาการก่อน'}
              primaryLabel={saving ? 'กำลังส่ง...' : 'ส่ง → รับ QR'}
              onPrimary={onSave}
              disabled={!canSubmit}
              secondaryLabel="ดูสถานะ"
              onSecondary={() => navigation.navigate('TrackRepair')}
            />
            <MobileBackBar onPress={goBack} />
          </>
        ) : null}
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
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    minHeight: '100%',
    gap: spacing.md,
  },
  scrollCentered: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  sheet: { gap: spacing.md },
  section: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, ...shadow },
  sectionTitle: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  sectionHint: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  label: { color: colors.textSecondary, fontWeight: '700', fontSize: 12, marginTop: spacing.sm, marginBottom: 6 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMobile: { minHeight: 48, paddingVertical: 12 },
  inputError: { borderColor: '#E5544B', borderWidth: 2 },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chipRowMobile: { flexDirection: 'column' },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.navyTint,
    minHeight: 44,
    justifyContent: 'center',
  },
  typeChipMobile: { width: '100%' },
  typeChipActive: { backgroundColor: colors.navy },
  typeChipText: { color: colors.navySoft, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  typeChipTextActive: { color: colors.onNavy },
  vehicleCard: { backgroundColor: colors.navyTint, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  vehicleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleName: { color: colors.navy, fontWeight: '800', fontSize: 16, flex: 1 },
  vehicleMeta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  vehicleId: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  searchStatus: { color: colors.textMuted, fontSize: 12, marginTop: 8, fontWeight: '600' },
  suggestBox: {
    marginTop: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  link: { color: colors.barFillAlt, fontWeight: '800', fontSize: 14 },
  hit: {
    padding: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hitTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  hitMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  row2: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  row2Stack: { flexDirection: 'column' },
  half: { flex: 1 },
  secondaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  optionalHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  thumbRow: { marginTop: spacing.sm },
  thumb: { width: 80, height: 80, borderRadius: radius.sm, marginRight: 8, backgroundColor: colors.border },
  primaryBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 16 },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.md },
  linkBtnText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: radius.sm, padding: spacing.md },
  error: { color: '#B91C1C', fontWeight: '700', textAlign: 'center' },
  trap: { height: 0, width: 0, opacity: 0, position: 'absolute' },
});
