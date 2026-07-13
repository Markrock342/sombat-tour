import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  fetchBoard,
  createBoardNote,
  updateBoardNote,
  deleteBoardNote,
  fetchTechnicians,
  fmtDateTime,
} from '../data/api';
import {
  BOARD_ZONES,
  BOARD_STATUSES,
  composeBoardBody,
  parseBoardBody,
  statusBadgeColor,
  groupNotesByZone,
} from '../data/boardNotes';

const COLORS = ['#FFF59D', '#C8E6C9', '#BBDEFB', '#F8BBD0', '#FFE0B2', '#E1BEE7'];

export default function BoardScreen({ navigation }) {
  const { canWrite, user } = useAuth();
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [techs, setTechs] = useState([]);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftZone, setDraftZone] = useState(BOARD_ZONES[0]);
  const [draftZoneCustom, setDraftZoneCustom] = useState('');
  const [draftStatus, setDraftStatus] = useState('wait');
  const [draftTechId, setDraftTechId] = useState(null);
  const [draftTechName, setDraftTechName] = useState('');
  const [draftProblem, setDraftProblem] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftParts, setDraftParts] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchBoard());
    } catch (e) {
      const msg = e.message || '';
      if (/1142|denied|INSERT|SELECT|board/i.test(msg) || e.code === 'DB_PRIVILEGE') {
        setError(
          'ตารางบอร์ดยังไม่มีสิทธิ์อ่าน/เขียน — ให้ไป cPanel → MySQL Databases → กด Repair Privileges ให้ user ของ API (เช่น cp021446_Test01) แล้วลองใหม่'
        );
      } else {
        setError(msg || 'โหลดบอร์ดไม่สำเร็จ');
      }
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
    fetchTechnicians()
      .then(setTechs)
      .catch(() => setTechs([]));
  }, []);

  const grouped = useMemo(() => groupNotesByZone(rows), [rows]);

  const zoneValue =
    draftZone === 'อื่นๆ' && draftZoneCustom.trim()
      ? draftZoneCustom.trim()
      : draftZone;

  const resetDraft = () => {
    setDraftTitle('');
    setDraftZone(BOARD_ZONES[0]);
    setDraftZoneCustom('');
    setDraftStatus('wait');
    setDraftTechId(null);
    setDraftTechName('');
    setDraftProblem('');
    setDraftLocation('');
    setDraftParts('');
    setDraftNote('');
    setDraftColor(COLORS[0]);
  };

  const addNote = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    if (!draftTitle.trim()) {
      Alert.alert('กรุณาใส่หัวข้อ', 'เช่น เบอร์รถ / โซน / ชื่องาน');
      return;
    }
    setSaving(true);
    try {
      await createBoardNote({
        title: draftTitle.trim(),
        body: composeBoardBody({
          status: draftStatus,
          techId: draftTechId,
          techName: draftTechName,
          problem: draftProblem,
          location: draftLocation,
          parts: draftParts,
          note: draftNote,
        }),
        color: draftColor,
        department: zoneValue,
        pin: false,
      });
      resetDraft();
      setShowComposer(false);
      await load();
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else {
        const msg = e.message || '';
        Alert.alert(
          'ไม่สำเร็จ',
          /1142|denied/i.test(msg)
            ? 'ฐานข้อมูลยังไม่อนุญาตเขียนตาราง board — กด Repair Privileges ใน cPanel ก่อน'
            : msg
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (note) => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    try {
      await updateBoardNote({ id: note.id, pin: !note.pin });
      await load();
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e.message || '');
    }
  };

  const remove = async (note) => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    try {
      await deleteBoardNote(note.id);
      await load();
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e.message || '');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>บอร์ดงาน (ไวท์บอร์ด)</Text>
              <Text style={styles.headerSub}>จดงานตามโซน · ผูกช่างด้วย ID</Text>
            </View>
            {canWrite ? (
              <Pressable
                style={styles.addBtn}
                onPress={() => setShowComposer((v) => !v)}
              >
                <Text style={styles.addBtnText}>{showComposer ? 'ปิด' : '+ โน้ต'}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.addBtn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.addBtnText}>เข้าสู่ระบบ</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          {showComposer ? (
            <View style={styles.composer}>
              <Text style={styles.composerTitle}>เพิ่มโน้ตงาน</Text>

              <Text style={styles.label}>หัวข้อ *</Text>
              <TextInput
                style={styles.input}
                value={draftTitle}
                onChangeText={setDraftTitle}
                placeholder="เบอร์รถ / ทะเบียน / ชื่องาน"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>โซน / แผนก</Text>
              <View style={styles.chipRow}>
                {BOARD_ZONES.map((z) => {
                  const active = draftZone === z;
                  return (
                    <Pressable
                      key={z}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setDraftZone(z)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{z}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {draftZone === 'อื่นๆ' ? (
                <TextInput
                  style={styles.input}
                  value={draftZoneCustom}
                  onChangeText={setDraftZoneCustom}
                  placeholder="พิมพ์ชื่อโซนเอง"
                  placeholderTextColor={colors.textMuted}
                />
              ) : null}

              <Text style={styles.label}>สถานะ</Text>
              <View style={styles.chipRow}>
                {BOARD_STATUSES.map((s) => {
                  const active = draftStatus === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      style={[
                        styles.chip,
                        active && { backgroundColor: statusBadgeColor(s.key), borderColor: statusBadgeColor(s.key) },
                      ]}
                      onPress={() => setDraftStatus(s.key)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>ช่างผู้รับ (ID)</Text>
              <View style={styles.techGrid}>
                {techs.slice(0, 24).map((t) => {
                  const active = String(draftTechId) === String(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.techChip, active && styles.techChipActive]}
                      onPress={() => {
                        if (active) {
                          setDraftTechId(null);
                          setDraftTechName('');
                        } else {
                          setDraftTechId(t.id);
                          setDraftTechName(t.name);
                        }
                      }}
                    >
                      <Text style={[styles.techChipName, active && styles.techChipNameActive]} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={[styles.techChipId, active && styles.techChipIdActive]}>#{t.id}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>ปัญหา</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={draftProblem}
                onChangeText={setDraftProblem}
                placeholder="รถมีปัญหาอะไร"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.label}>สถานที่</Text>
              <TextInput
                style={styles.input}
                value={draftLocation}
                onChangeText={setDraftLocation}
                placeholder="พังที่ไหน / ทำที่ไหน"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>อะไหล่</Text>
              <TextInput
                style={styles.input}
                value={draftParts}
                onChangeText={setDraftParts}
                placeholder="อะไหล่ที่ใช้ / ที่ต้องการ"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>หมายเหตุ / ใครทำอะไร</Text>
              <TextInput
                style={[styles.input, styles.textareaSm]}
                value={draftNote}
                onChangeText={setDraftNote}
                placeholder="บันทึกเพิ่ม"
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.label}>สีโน้ต</Text>
              <View style={styles.colorRow}>
                {COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setDraftColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      draftColor === c && styles.colorDotActive,
                    ]}
                  />
                ))}
              </View>

              <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={addNote} disabled={saving}>
                <Text style={styles.btnText}>{saving ? 'กำลังบันทึก...' : 'ปักโน้ตบนบอร์ด'}</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <LoadingView compact />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>โหลดบอร์ดไม่สำเร็จ</Text>
              <Text style={styles.errorMsg}>{error}</Text>
              <Pressable style={styles.btn} onPress={load}>
                <Text style={styles.btnText}>ลองใหม่</Text>
              </Pressable>
            </View>
          ) : rows.length === 0 ? (
            <Text style={styles.msg}>ยังไม่มีโน้ตบนบอร์ด — กด “+ โน้ต” เพื่อเริ่มจด</Text>
          ) : (
            grouped.map(({ zone, notes }) => (
              <View key={zone} style={styles.zoneBlock}>
                <Text style={styles.zoneTitle}>{zone}</Text>
                <View style={styles.board}>
                  {notes.map((n) => {
                    const parsed = parseBoardBody(n.body);
                    const statusLabel =
                      BOARD_STATUSES.find((s) => s.key === parsed.status)?.label || 'รอ';
                    return (
                      <View key={n.id} style={[styles.note, { backgroundColor: n.color || COLORS[0] }]}>
                        <View style={styles.noteTop}>
                          <Text style={styles.noteTitle}>{n.title}</Text>
                          {n.pin ? <Text style={styles.pin}>📌</Text> : null}
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusBadgeColor(parsed.status) },
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                        </View>
                        {(parsed.techName || parsed.techId) ? (
                          <Text style={styles.noteLine}>
                            ช่าง: {parsed.techName || '-'}
                            {parsed.techId ? ` · #${parsed.techId}` : ''}
                          </Text>
                        ) : null}
                        {parsed.problem ? (
                          <Text style={styles.noteBody} numberOfLines={4}>
                            {parsed.problem}
                          </Text>
                        ) : null}
                        {parsed.location ? (
                          <Text style={styles.noteLine}>ที่: {parsed.location}</Text>
                        ) : null}
                        {parsed.parts ? (
                          <Text style={styles.noteLine}>อะไหล่: {parsed.parts}</Text>
                        ) : null}
                        {parsed.note ? (
                          <Text style={styles.noteLine}>{parsed.note}</Text>
                        ) : null}
                        <Text style={styles.noteMeta}>
                          {[n.created_by, n.updated_at ? fmtDateTime(n.updated_at) : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <View style={styles.noteActions}>
                          <Pressable onPress={() => togglePin(n)}>
                            <Text style={styles.link}>{n.pin ? 'เลิกปักหมุด' : 'ปักหมุด'}</Text>
                          </Pressable>
                          <Pressable onPress={() => remove(n)}>
                            <Text style={[styles.link, { color: '#B91C1C' }]}>ลบ</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  addBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 13 },
  scroll: {
    backgroundColor: '#F3EEE3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
  },
  composer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow,
  },
  composerTitle: { fontWeight: '800', color: colors.navy, marginBottom: spacing.sm, fontSize: 16 },
  label: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  textareaSm: { minHeight: 56, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.navyTint,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: colors.navy },
  chipText: { color: colors.navySoft, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: colors.onNavy },
  techGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  techChip: {
    width: '31%',
    flexGrow: 1,
    minWidth: 100,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  techChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  techChipName: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  techChipNameActive: { color: colors.onNavy },
  techChipId: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  techChipIdActive: { color: 'rgba(255,255,255,0.7)' },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00000022' },
  colorDotActive: { borderWidth: 3, borderColor: colors.navy },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  zoneBlock: { marginBottom: spacing.lg },
  zoneTitle: {
    fontWeight: '800',
    color: colors.navy,
    fontSize: 14,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  note: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 6,
    padding: spacing.md,
    ...shadow,
  },
  noteTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  noteTitle: { fontWeight: '800', color: '#1A1A1A', fontSize: 15, flex: 1 },
  pin: { fontSize: 14 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noteBody: { marginTop: 8, color: '#333', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  noteLine: { marginTop: 4, color: '#444', fontSize: 12 },
  noteMeta: { marginTop: 10, color: '#666', fontSize: 11 },
  noteActions: { flexDirection: 'row', gap: spacing.lg, marginTop: 8 },
  link: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  msg: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
  errorBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow,
  },
  errorTitle: { fontWeight: '800', color: colors.navy, marginBottom: 6 },
  errorMsg: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md, lineHeight: 20 },
});
