import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, shadow } from '../theme';
import { TopBackLink, MobileBackBar, useScreenLayout, mobileScrollInset, contentSheetStyle } from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import ImageLightbox from '../components/ImageLightbox';
import { useAuth } from '../auth/AuthContext';
import {
  getRepair,
  updateRepair,
  deleteRepair,
  fetchRepairImages,
  uploadRepairImage,
  deleteRepairImage,
  fetchRepairTracking,
  updateRepairStatus,
  fetchTechnicians,
  fmtDateTime,
  isOpenRepair,
} from '../data/api';
import {
  repairListSections,
  parseRepairList,
  withRepairLocation,
  workshopNamesFromTechs,
  personTechsFromTechs,
} from '../data/repairNotes';
import { statusColor } from '../data/repairTracking';
import StatusPicker from '../components/StatusPicker';
import RepairStatusTimeline from '../components/RepairStatusTimeline';
import ContactActionRow from '../components/ContactActionRow';
import { shareTrackLink, shareViaLine, callPhone, saveQrToGallery } from '../data/contactActions';
import { qrImageUrl, trackUrl } from '../data/repairTracking';
import { showAlert, chooseAction, confirmDialog } from '../utils/dialog';

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function RepairDetailScreen({ route, navigation }) {
  const { repair: initial, rId: paramId } = route.params ?? {};
  const rId = paramId || initial?.r_id;
  const { canWrite, canSeePartsPrice } = useAuth();
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const goBack = () => navigation.goBack();
  const sheetStyle = contentSheetStyle(centerContent, contentMaxWidth);

  const [repair, setRepair] = useState(initial || null);
  const [images, setImages] = useState([]);
  const [tracking, setTracking] = useState(null);
  const [statusNote, setStatusNote] = useState('');
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [deletingImage, setDeletingImage] = useState(false);

  const [techs, setTechs] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTechId, setAssignTechId] = useState(null);
  const [assignTechName, setAssignTechName] = useState('');
  const [workshopQ, setWorkshopQ] = useState('');
  const [workshopPicked, setWorkshopPicked] = useState(false);

  const workshops = useMemo(() => workshopNamesFromTechs(techs), [techs]);
  const personTechs = useMemo(() => personTechsFromTechs(techs), [techs]);
  const workshopHits = useMemo(() => {
    if (workshopPicked) return [];
    const term = workshopQ.trim().toLowerCase();
    if (!term) return workshops.slice(0, 12);
    return workshops.filter((n) => n.toLowerCase().includes(term)).slice(0, 12);
  }, [workshopPicked, workshopQ, workshops]);

  const load = useCallback(async () => {
    if (!rId) return;
    setLoading(true);
    setError(null);
    try {
      const [row, imgs] = await Promise.all([
        initial && String(initial.r_id) === String(rId) ? Promise.resolve(initial) : getRepair(rId),
        fetchRepairImages(rId).catch(() => []),
      ]);
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

  useEffect(() => {
    if (!canWrite) return undefined;
    let cancelled = false;
    fetchTechnicians()
      .then((rows) => {
        if (!cancelled) setTechs(rows || []);
      })
      .catch(() => {
        if (!cancelled) setTechs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canWrite]);

  useEffect(() => {
    if (!repair) return;
    setAssignTechId(repair.r_technician_id || null);
    setAssignTechName(repair.r_technician || '');
    const loc = parseRepairList(repair.r_repair_list).location || '';
    setWorkshopQ(loc);
    setWorkshopPicked(!!loc);
  }, [repair?.r_id, repair?.r_technician, repair?.r_technician_id, repair?.r_repair_list]);

  const openAssign = () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    setAssignOpen(true);
  };

  const saveAssign = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    if (!assignTechId && !assignTechName.trim() && !workshopQ.trim()) {
      showAlert('เลือกอย่างน้อยช่าง หรือ อู่');
      return;
    }
    setBusy(true);
    try {
      const payload = { r_id: rId };
      if (assignTechId || assignTechName.trim()) {
        payload.r_technician = assignTechName.trim();
        payload.r_technician_id = assignTechId || 0;
      }
      if (workshopQ.trim()) {
        payload.r_repair_list = withRepairLocation(repair?.r_repair_list || '', workshopQ.trim());
      }
      const data = await updateRepair(payload);
      setRepair(data.row || repair);
      setAssignOpen(false);
      showAlert('มอบหมายแล้ว');
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else showAlert('ไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const closeJob = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    setBusy(true);
    try {
      const data = await updateRepair({ r_id: rId, r_close: 1 });
      setRepair(data.row || { ...repair, r_close: 1 });
      showAlert('ปิดงานแล้ว');
    } catch (e) {
      showAlert('ไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const deleteJob = async () => {
    if (!canSeePartsPrice) {
      showAlert('ลบงานไม่ได้', 'เฉพาะ admin / staff ที่รับเรื่องเท่านั้น');
      return;
    }
    const jobLabel = repair?.r_job_num || rId;
    const ok = await confirmDialog(
      'ลบงานนี้?',
      `ลบ #${jobLabel} ถาวร รวมรูปและประวัติ — กู้คืนไม่ได้`,
      {
        confirmText: 'ลบงาน',
        cancelText: 'ยกเลิก',
        icon: 'warning',
        destructive: true,
      }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteRepair(rId);
      showAlert('ลบแล้ว', `งาน #${jobLabel} ถูกลบออกจากระบบ`);
      navigation.goBack();
    } catch (e) {
      if (e.code === 'UNAUTHORIZED' || e.code === 'FORBIDDEN') navigation.navigate('Login');
      else showAlert('ลบไม่สำเร็จ', e.message || '');
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
      else showAlert('อัปโหลดไม่สำเร็จ', e.message || '');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!preview?.id || !canWrite) return;
    const ok = await confirmDialog('ลบรูปนี้?', 'ลบแล้วกู้คืนไม่ได้', {
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    setDeletingImage(true);
    try {
      await deleteRepairImage(preview.id);
      setImages((prev) => prev.filter((x) => x.id !== preview.id));
      setPreview(null);
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else showAlert('ลบไม่สำเร็จ', e.message || '');
    } finally {
      setDeletingImage(false);
    }
  };

  const setPublicStatus = async (status) => {
    if (!canWrite || !tracking?.meta) return;
    setBusy(true);
    try {
      const note = statusNote.trim();
      const data = await updateRepairStatus({ r_id: rId, status, note });
      const nextMeta = {
        ...tracking.meta,
        public_status: data.public_status,
        public_status_label: data.public_status_label,
      };
      setTracking({
        ...tracking,
        meta: nextMeta,
        timeline: data.timeline || tracking.timeline,
      });
      if (data.row) setRepair(data.row);
      setStatusNote('');

      const jobNum = (data.row || repair)?.r_job_num || rId;
      const phone = nextMeta.reporter_phone;
      const token = nextMeta.track_token;
      const label = data.public_status_label || '';

      await chooseAction('อัปเดตแล้ว', `${label}\nแจ้งผู้แจ้งต่อไหม?`, [
        { text: 'ทีหลัง', style: 'cancel' },
        phone ? { text: 'โทร', onPress: () => callPhone(phone) } : null,
        token
          ? {
              text: 'ส่ง LINE',
              onPress: () =>
                shareViaLine({
                  jobNum,
                  status: data.public_status,
                  trackToken: token,
                  note,
                }),
            }
          : {
              text: 'แชร์ลิงก์',
              onPress: () =>
                shareTrackLink({
                  jobNum,
                  status: data.public_status,
                  trackToken: token,
                  note,
                }),
            },
      ]);
    } catch (e) {
      showAlert('ไม่สำเร็จ', e.message || '');
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

  const vehicleLine = repair
    ? [repair.r_v_name, repair.r_v_plate].filter(Boolean).join(' · ') || '-'
    : '';
  const modelLine = repair
    ? [
        [repair.r_v_brand, repair.r_v_model].filter(Boolean).join(' · '),
        repair.r_mile ? `ไมล์ ${Number(repair.r_mile).toLocaleString()}` : '',
        repair.r_tank_m ? `ถัง ${repair.r_tank_m} ม.` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const primaryNotes = noteSections.filter((s) => s.label === 'อาการ' || s.label === 'ปัญหา');
  const otherNotes = noteSections.filter((s) => s.label !== 'อาการ' && s.label !== 'ปัญหา');
  const heroText =
    primaryNotes.map((s) => s.value).filter(Boolean).join('\n') ||
    otherNotes[0]?.value ||
    'ไม่มีรายละเอียดอาการ';

  const jobPanel = repair ? (
    <View style={styles.panel}>
      <View style={styles.badgeRow}>
        <Text style={[styles.pill, { backgroundColor: open ? '#1FA97A' : '#E5544B' }]}>
          {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
        </Text>
        {typeLabel ? (
          <Text style={styles.typeTag}>{typeLabel}</Text>
        ) : null}
      </View>

      <Text style={styles.kicker}>อาการ</Text>
      <Text style={styles.hero}>{heroText}</Text>

      {otherNotes.map((sec) => (
        <View key={sec.label} style={styles.noteBlock}>
          <Text style={styles.noteLabel}>{sec.label}</Text>
          <Text style={styles.noteValue}>{sec.value}</Text>
        </View>
      ))}

      <View style={styles.factGrid}>
        <Fact
          label="ช่าง"
          value={
            repair.r_technician
              ? `${repair.r_technician}${repair.r_technician_id ? ` · ID ${repair.r_technician_id}` : ''}`
              : 'ยังไม่มอบหมาย'
          }
        />
        <Fact label="รถ" value={vehicleLine} />
        <Fact label="รุ่น / ไมล์" value={modelLine || '-'} />
        <Fact
          label="รับงาน"
          value={repair.r_dt_rec ? fmtDateTime(repair.r_dt_rec) : '-'}
        />
      </View>

      {canWrite ? (
        <View style={styles.assignBox}>
          <View style={styles.assignHead}>
            <Text style={styles.assignTitle}>มอบหมายงาน</Text>
            {!assignOpen ? (
              <Pressable onPress={openAssign} hitSlop={8}>
                <Text style={styles.assignLink}>
                  {repair.r_technician ? 'เปลี่ยน' : 'เลือกช่าง / อู่'}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setAssignOpen(false)} hitSlop={8}>
                <Text style={styles.assignLinkMuted}>ปิด</Text>
              </Pressable>
            )}
          </View>

          {!assignOpen ? (
            <Text style={styles.assignHint}>
              {repair.r_technician
                ? `ช่าง: ${repair.r_technician}`
                : 'งานจากแจ้งสาธารณะ — staff เลือกช่าง/อู่ที่นี่'}
              {parsed?.location ? `\nอู่/ที่: ${parsed.location}` : ''}
            </Text>
          ) : (
            <>
              <Text style={styles.assignLabel}>อู่ (ไม่บังคับ)</Text>
              {workshopPicked ? (
                <View style={styles.pickedRow}>
                  <Text style={styles.pickedText}>{workshopQ}</Text>
                  <Pressable
                    onPress={() => {
                      setWorkshopPicked(false);
                      setWorkshopQ('');
                    }}
                  >
                    <Text style={styles.assignLink}>เปลี่ยน</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.assignInput}
                    value={workshopQ}
                    onChangeText={(v) => {
                      setWorkshopQ(v);
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
                        setWorkshopQ(name);
                        setWorkshopPicked(true);
                      }}
                    >
                      <Text style={styles.hitTitle}>{name}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              <Text style={styles.assignLabel}>ช่าง</Text>
              <View style={styles.techGrid}>
                {personTechs.map((t) => {
                  const active = String(assignTechId) === String(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.techChip, active && styles.techChipActive]}
                      onPress={() => {
                        setAssignTechId(t.id);
                        setAssignTechName(t.name);
                      }}
                    >
                      <Text
                        style={[styles.techChipText, active && styles.techChipTextActive]}
                        numberOfLines={1}
                      >
                        {t.name}
                      </Text>
                      <Text style={[styles.techChipId, active && styles.techChipTextActive]}>
                        #{t.id}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {personTechs.length === 0 ? (
                <Text style={styles.assignHint}>โหลดรายชื่อช่างไม่สำเร็จ — ลองรีเฟรช</Text>
              ) : null}

              <Pressable
                style={[styles.btn, styles.btnAssign, busy && styles.btnDisabled]}
                onPress={saveAssign}
                disabled={busy}
              >
                <Text style={styles.btnText}>{busy ? 'กำลังบันทึก...' : 'บันทึกมอบหมาย'}</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        {open ? (
          <Pressable
            style={[styles.btn, styles.btnClose, busy && styles.btnDisabled]}
            onPress={closeJob}
            disabled={busy}
          >
            <Text style={styles.btnText}>ปิดงาน</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.btnAlt, busy && styles.btnDisabled]}
          onPress={addPhoto}
          disabled={busy}
        >
          <Text style={styles.btnAltText}>+ เพิ่มรูป</Text>
        </Pressable>
        {canSeePartsPrice ? (
          <Pressable
            style={[styles.btnAlt, styles.btnDelete, busy && styles.btnDisabled]}
            onPress={deleteJob}
            disabled={busy}
          >
            <Text style={styles.btnDeleteText}>ลบงาน</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : null;

  const trackPanel =
    repair && tracking?.is_public ? (
      <View style={[styles.panel, styles.trackPanel]}>
        <Text style={styles.trackSectionTitle}>แจ้งจากภายนอก</Text>
        <Text style={styles.reporterLine}>
          {tracking.meta.reporter_name}
          {tracking.meta.reporter_phone ? ` · ${tracking.meta.reporter_phone}` : ''}
        </Text>
        <Text
          style={[
            styles.pill,
            styles.pillInline,
            { backgroundColor: statusColor(tracking.meta.public_status) },
          ]}
        >
          ผู้แจ้งเห็น: {tracking.meta.public_status_label}
        </Text>

        {tracking.meta.track_token ? (
          <View style={styles.qrBox}>
            <Text style={styles.qrTitle}>QR ติดตามสถานะ</Text>
            <Image
              source={{ uri: qrImageUrl(trackUrl(tracking.meta.track_token), 200) }}
              style={styles.qrImage}
              accessibilityLabel="QR ติดตามสถานะ"
            />
            <Text style={styles.qrHint}>สแกนด้วยกล้อง · หรือบันทึกลงแกลเลอรีแล้วเปิดสแกนทีหลัง</Text>
            <View style={styles.qrActions}>
              <Pressable
                style={[styles.btnAlt, styles.qrBtn]}
                onPress={async () => {
                  await saveQrToGallery(tracking.meta.track_token, repair?.r_job_num || rId);
                }}
              >
                <Text style={styles.btnAltText}>บันทึก QR</Text>
              </Pressable>
              <Pressable
                style={[styles.btnAlt, styles.qrBtn]}
                onPress={() =>
                  navigation.navigate('TrackRepair', { token: tracking.meta.track_token })
                }
              >
                <Text style={styles.btnAltText}>เปิดหน้าติดตาม</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {canWrite ? (
          <ContactActionRow
            phone={tracking.meta.reporter_phone}
            jobNum={repair?.r_job_num || rId}
            status={tracking.meta.public_status}
            trackToken={tracking.meta.track_token}
            note={statusNote.trim()}
          />
        ) : null}

        {canWrite ? (
          <>
            <Text style={styles.trackHint}>เลือกสถานะ — ขึ้น QR ทันที</Text>
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
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}>
          <View style={[styles.headerInner, sheetStyle]}>
            {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, { fontSize: titleSize }]}>
                  #{repair?.r_job_num || rId}
                </Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  รายละเอียดงานซ่อม
                  {repair?.r_dt_rec ? ` · ${fmtDateTime(repair.r_dt_rec)}` : ''}
                </Text>
              </View>
              {repair ? (
                <Text style={[styles.pill, { backgroundColor: open ? '#1FA97A' : '#E5544B' }]}>
                  {open ? 'กำลังซ่อม' : 'ปิดงานแล้ว'}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scroll,
            centerContent && styles.scrollCentered,
            isMobile && mobileScrollInset,
          ]}
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
            <View style={[styles.sheet, sheetStyle]}>
              {jobPanel}
              {trackPanel}
              <View style={styles.galleryBlock}>
                <Text style={styles.section}>รูปภาพ ({images.length})</Text>
                {images.length === 0 ? (
                  <View style={styles.emptyGallery}>
                    <Text style={styles.emptyGalleryTitle}>ยังไม่มีรูป</Text>
                    <Text style={styles.emptyGalleryMsg}>กด “เพิ่มรูป” เพื่อแนบหลักฐานงานซ่อม</Text>
                  </View>
                ) : (
                  <View style={styles.gallery}>
                    {images.map((img) => (
                      <View key={img.id} style={styles.thumbWrap}>
                        <Pressable onPress={() => setPreview(img)}>
                          <Image source={{ uri: img.url }} style={styles.thumb} />
                        </Pressable>
                        {canWrite ? (
                          <Pressable
                            style={styles.thumbDelete}
                            hitSlop={8}
                            onPress={async () => {
                              const ok = await confirmDialog('ลบรูปนี้?', 'ลบแล้วกู้คืนไม่ได้', {
                                confirmText: 'ลบ',
                                cancelText: 'ยกเลิก',
                                destructive: true,
                                icon: 'danger',
                              });
                              if (!ok) return;
                              setDeletingImage(true);
                              try {
                                await deleteRepairImage(img.id);
                                setImages((prev) => prev.filter((x) => x.id !== img.id));
                                if (preview?.id === img.id) setPreview(null);
                              } catch (err) {
                                if (err.code === 'UNAUTHORIZED') navigation.navigate('Login');
                                else showAlert('ลบไม่สำเร็จ', err.message || '');
                              } finally {
                                setDeletingImage(false);
                              }
                            }}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>
        {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </View>

      <ImageLightbox
        visible={!!preview}
        uri={preview?.url}
        imageId={preview?.id}
        fileName={`sombat-repair-${rId}-${preview?.id || 'photo'}.jpg`}
        onClose={() => setPreview(null)}
        canDelete={canWrite}
        onDelete={removePhoto}
        deleting={deletingImage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navyDeep },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  headerCentered: { alignItems: 'center' },
  headerInner: { width: '100%' },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: spacing.xs },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.onNavy, fontWeight: '800', letterSpacing: 0.2 },
  headerSub: { color: 'rgba(255,255,255,0.62)', fontSize: 12, marginTop: 2, fontWeight: '600' },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  scrollCentered: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  sheet: {
    gap: spacing.md,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  trackPanel: {
    backgroundColor: '#F7F8FC',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pill: {
    color: colors.onNavy,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
  },
  pillInline: { alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.sm },
  typeTag: {
    color: '#8A5A00',
    backgroundColor: '#F7E7B8',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hero: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  noteBlock: { marginBottom: spacing.sm },
  noteLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  noteValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fact: {
    backgroundColor: colors.navyTint,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '48%',
    flexGrow: 1,
  },
  factLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  factValue: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  assignBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assignHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  assignTitle: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  assignLink: { color: colors.barFillAlt, fontWeight: '800', fontSize: 13 },
  assignLinkMuted: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  assignHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  assignLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  assignInput: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  pickedText: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1 },
  hit: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hitTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techChip: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  techChipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  techChipText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  techChipId: { color: colors.textMuted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  techChipTextActive: { color: colors.onNavy },
  btnAssign: { marginTop: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  btn: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  btnPrimary: { minWidth: 120 },
  btnClose: { minWidth: 120, backgroundColor: '#E5544B' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  btnAlt: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  btnAltText: { color: colors.navy, fontWeight: '800' },
  section: {
    marginBottom: spacing.sm,
    fontWeight: '800',
    color: colors.navy,
    fontSize: 15,
  },
  galleryBlock: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: colors.navyTint },
  thumbDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(229, 84, 75, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  emptyGallery: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: '#F7F8FC',
  },
  emptyGalleryTitle: { color: colors.navy, fontWeight: '800', fontSize: 14, marginBottom: 4 },
  emptyGalleryMsg: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  trackSectionTitle: { fontWeight: '800', color: colors.navy, fontSize: 15, marginBottom: 4 },
  reporterLine: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  trackHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.sm },
  qrBox: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrTitle: { color: colors.navy, fontWeight: '800', fontSize: 13, marginBottom: spacing.sm },
  qrImage: { width: 200, height: 200, borderRadius: 8, backgroundColor: '#fff' },
  qrHint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  qrActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  qrBtn: { minHeight: 40, paddingVertical: 8 },
  statusInput: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 44,
  },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  msg: { color: colors.textSecondary, textAlign: 'center' },
});
