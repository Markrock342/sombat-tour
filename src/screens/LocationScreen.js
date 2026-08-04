import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import { useAuth } from '../auth/AuthContext';
import {
  fetchLocations,
  saveLocation,
  deleteLocation,
  searchVehicles,
  fmtDateTime,
} from '../data/api';
import { showAlert, confirmDialog } from '../utils/dialog';

function vehicleLabel(v) {
  if (!v) return '';
  return [v.v_name, v.v_plate].filter(Boolean).join(' · ') || String(v.v_id || '');
}

function locationVehicleLine(row) {
  if (!row) return '';
  const name = String(row.v_name || '').trim();
  if (name) return name;
  if (row.v_id) return `ID ${row.v_id}`;
  return '';
}

export default function LocationScreen({ navigation }) {
  const { canWrite } = useAuth();
  const { isMobile, pad, titleSize } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [spot, setSpot] = useState('');
  const [detail, setDetail] = useState('');
  const [vehicleQ, setVehicleQ] = useState('');
  const [vehicleHits, setVehicleHits] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [vehicleSearching, setVehicleSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchLocations());
    } catch (e) {
      showAlert('โหลดไม่สำเร็จ', e.message || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const term = vehicleQ.trim();
    if (vehicle || !term) {
      setVehicleHits([]);
      setVehicleSearching(false);
      return undefined;
    }
    setVehicleSearching(true);
    const t = setTimeout(async () => {
      try {
        const rowsHit = await searchVehicles(term);
        setVehicleHits(rowsHit.slice(0, 8));
      } catch (_) {
        setVehicleHits([]);
      } finally {
        setVehicleSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [vehicleQ, vehicle]);

  const clearVehicle = () => {
    setVehicle(null);
    setVehicleQ('');
    setVehicleHits([]);
  };

  const onSave = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    if (!title.trim()) {
      showAlert('กรุณาใส่หัวข้อตำแหน่ง');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        spot: spot.trim(),
        detail: detail.trim(),
      };
      if (vehicle) {
        payload.v_id = vehicle.v_id;
        payload.v_name = vehicleLabel(vehicle);
      } else if (vehicleQ.trim()) {
        payload.v_name = vehicleQ.trim();
      }
      await saveLocation(payload);
      setTitle('');
      setSpot('');
      setDetail('');
      clearVehicle();
      await load();
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else showAlert('ไม่สำเร็จ', e.message || '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ตำแหน่งรถจอด</Text>
          {!isMobile ? (
            <Text style={styles.headerSub}>มาร์กตำแหน่งด้วยมือ — ทุกแผนกดูได้</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Text style={styles.label}>หัวข้อ *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="เช่น ลานหน้าอู่"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>จุดจอด / สปอต</Text>
            <TextInput
              style={styles.input}
              value={spot}
              onChangeText={setSpot}
              placeholder="A-12"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>รถ</Text>
            {vehicle ? (
              <View style={styles.vehicleCard}>
                <View style={styles.vehicleHead}>
                  <Text style={styles.vehicleName}>{vehicle.v_name || '-'}</Text>
                  <Pressable onPress={clearVehicle} hitSlop={8}>
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
                  placeholder="ค้นเบอร์รถ / ทะเบียน / ID"
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {vehicleSearching ? (
                  <Text style={styles.hint}>กำลังค้น...</Text>
                ) : null}
                {!vehicleSearching && vehicleQ.trim() && vehicleHits.length === 0 ? (
                  <Text style={styles.hint}>ไม่พบรถ — พิมพ์ชื่อไว้บันทึกเองได้</Text>
                ) : null}
                {vehicleHits.map((v) => (
                  <Pressable
                    key={v.v_id}
                    style={styles.hit}
                    onPress={() => {
                      setVehicle(v);
                      setVehicleQ(v.v_name || String(v.v_id));
                      setVehicleHits([]);
                    }}
                  >
                    <Text style={styles.hitTitle}>{v.v_name || `ID ${v.v_id}`}</Text>
                    <Text style={styles.hitMeta}>
                      {[v.v_plate, v.v_brand, v.v_model, v.v_id ? `ID ${v.v_id}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            <Text style={styles.label}>รายละเอียด</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={detail}
              onChangeText={setDetail}
              multiline
              placeholder="โน้ตเพิ่มเติม"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'กำลังบันทึก...' : 'บันทึกตำแหน่ง'}</Text>
            </Pressable>
          </View>

          {loading ? (
            <LoadingView compact />
          ) : rows.length === 0 ? (
            <Text style={styles.emptyList}>ยังไม่มีตำแหน่งที่บันทึก</Text>
          ) : (
            rows.map((r) => {
              const carLine = locationVehicleLine(r);
              return (
                <View key={r.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  {r.spot ? <Text style={styles.cardSpot}>จุด: {r.spot}</Text> : null}
                  {carLine ? <Text style={styles.cardVehicle}>รถ: {carLine}</Text> : null}
                  {r.detail ? <Text style={styles.cardDetail}>{r.detail}</Text> : null}
                  <Text style={styles.cardMeta}>
                    {[r.created_by, r.updated_at ? fmtDateTime(r.updated_at) : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Pressable
                    onPress={async () => {
                      if (!canWrite) {
                        navigation.navigate('Login');
                        return;
                      }
                      const ok = await confirmDialog('ลบตำแหน่ง', `ลบ “${r.title || 'จุดจอด'}” ใช่ไหม?`, {
                        confirmText: 'ลบ',
                        cancelText: 'ยกเลิก',
                        destructive: true,
                        icon: 'danger',
                      });
                      if (!ok) return;
                      try {
                        await deleteLocation(r.id);
                        await load();
                      } catch (e) {
                        showAlert('ลบไม่สำเร็จ', e.message || '');
                      }
                    }}
                  >
                    <Text style={styles.delete}>ลบ</Text>
                  </Pressable>
                </View>
              );
            })
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
    minHeight: 44,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: '600' },
  vehicleCard: {
    backgroundColor: colors.navyTint,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  vehicleName: { color: colors.navy, fontWeight: '800', fontSize: 17, flex: 1 },
  vehicleMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  vehicleId: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  link: { color: colors.barFill, fontWeight: '800', fontSize: 13 },
  hit: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hitTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  hitMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  emptyList: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  cardTitle: { color: colors.navy, fontWeight: '800', fontSize: 16 },
  cardSpot: { color: colors.barFillAlt, fontWeight: '800', marginTop: 4 },
  cardVehicle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginTop: 6 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  cardDetail: { color: colors.textSecondary, marginTop: 6, fontSize: 13 },
  delete: { color: '#B91C1C', fontWeight: '700', marginTop: 10, fontSize: 12 },
});
