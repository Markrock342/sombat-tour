import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RefreshControl } from '../components/AppRefreshControl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, radius, shadow } from '../theme';
import {
  TopBackLink,
  MobileBackBar,
  useScreenLayout,
  mobileScrollInset,
  contentSheetStyle,
} from '../components/BackNavigation';
import LoadingView from '../components/LoadingView';
import { useAuth } from '../auth/AuthContext';
import { showAlert, confirmDialog } from '../utils/dialog';
import {
  fetchBoard,
  createBoardNote,
  updateBoardNote,
  deleteBoardNote,
  fetchTechnicians,
  fmtDateTime,
} from '../data/api';
import {
  BOARD_STATUSES,
  composeBoardBody,
  parseBoardBody,
  statusBadgeColor,
  sortNotesForBoard,
} from '../data/boardNotes';

const COLORS = ['#FFF59D', '#C8E6C9', '#BBDEFB', '#F8BBD0', '#FFE0B2', '#E1BEE7', '#FFFFFF'];

export default function BoardScreen({ navigation }) {
  const { canWrite } = useAuth();
  const { isMobile, centerContent, pad, titleSize, contentMaxWidth } = useScreenLayout();
  const sheetStyle = contentSheetStyle(centerContent, Math.max(contentMaxWidth, 920));
  const goBack = () => navigation.goBack();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [techs, setTechs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [draftStatus, setDraftStatus] = useState('wait');
  const [draftTechId, setDraftTechId] = useState(null);
  const [draftTechName, setDraftTechName] = useState('');
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  const load = useCallback(async (opts = {}) => {
    if (opts.soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setRows(await fetchBoard());
    } catch (e) {
      const msg = e.message || '';
      if (/1142|denied|INSERT|SELECT|board/i.test(msg) || e.code === 'DB_PRIVILEGE') {
        setError(
          'ตารางบอร์ดยังไม่มีสิทธิ์อ่าน/เขียน — ให้ไป cPanel → MySQL Databases → กด Repair Privileges ให้ user ของ API แล้วลองใหม่'
        );
      } else {
        setError(msg || 'โหลดบอร์ดไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const notes = useMemo(() => {
    const sorted = sortNotesForBoard(rows);
    if (filterStatus === 'all') return sorted;
    return sorted.filter((n) => parseBoardBody(n.body).status === filterStatus);
  }, [rows, filterStatus]);

  const resetDraft = () => {
    setDraftTitle('');
    setDraftText('');
    setDraftStatus('wait');
    setDraftTechId(null);
    setDraftTechName('');
    setDraftColor(COLORS[0]);
  };

  const addNote = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    if (!draftTitle.trim() && !draftText.trim()) {
      showAlert('ว่างเปล่า', 'ใส่หัวข้อหรือข้อความบนโน้ตก่อน');
      return;
    }
    setSaving(true);
    try {
      await createBoardNote({
        title: draftTitle.trim() || draftText.trim().slice(0, 40),
        body: composeBoardBody({
          status: draftStatus,
          techId: draftTechId,
          techName: draftTechName,
          problem: draftText,
        }),
        color: draftColor,
        department: '',
        pin: false,
      });
      resetDraft();
      setShowComposer(false);
      await load();
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else {
        const msg = e.message || '';
        showAlert(
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
      showAlert('ไม่สำเร็จ', e.message || '');
    }
  };

  const cycleStatus = async (note) => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    const parsed = parseBoardBody(note.body);
    const idx = BOARD_STATUSES.findIndex((s) => s.key === parsed.status);
    const next = BOARD_STATUSES[(idx + 1) % BOARD_STATUSES.length];
    try {
      await updateBoardNote({
        id: note.id,
        body: composeBoardBody({
          ...parsed,
          status: next.key,
        }),
      });
      await load();
    } catch (e) {
      showAlert('ไม่สำเร็จ', e.message || '');
    }
  };

  const remove = async (note) => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    const ok = await confirmDialog('ลบโน้ต', `ลบ “${note.title || 'โน้ต'}” ใช่ไหม?`, {
      confirmText: 'ลบ',
      cancelText: 'ยกเลิก',
      destructive: true,
      icon: 'danger',
    });
    if (!ok) return;
    try {
      await deleteBoardNote(note.id);
      await load();
    } catch (e) {
      showAlert('ไม่สำเร็จ', e.message || '');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View
          style={[styles.header, { paddingHorizontal: pad }, centerContent && styles.headerCentered]}
        >
          <View style={[styles.headerInner, sheetStyle]}>
            {!isMobile ? <TopBackLink onPress={goBack} style={styles.back} /> : null}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { fontSize: titleSize }]}>ไวท์บอร์ด</Text>
                <Text style={styles.headerSub}>จดโน้ตอิสระ · ปักหมุด · กดสถานะเพื่อเลื่อน</Text>
              </View>
              {canWrite ? (
                <Pressable style={styles.addBtn} onPress={() => setShowComposer((v) => !v)}>
                  <Text style={styles.addBtnText}>{showComposer ? 'ปิด' : '+ โน้ต'}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.addBtn} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.addBtnText}>เข้าสู่ระบบ</Text>
                </Pressable>
              )}
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
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ soft: true })}
              tintColor={colors.navy}
            />
          }
        >
          <View style={sheetStyle}>
            {showComposer ? (
              <View style={styles.composer}>
                <Text style={styles.composerTitle}>เขียนโน้ตใหม่</Text>

                <TextInput
                  style={styles.input}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="หัวข้อสั้นๆ (ไม่บังคับ)"
                  placeholderTextColor={colors.textMuted}
                />

                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={draftText}
                  onChangeText={setDraftText}
                  placeholder="จดอะไรก็ได้บนบอร์ด..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                <Text style={styles.label}>สถานะ</Text>
                <View style={styles.chipRow}>
                  {BOARD_STATUSES.map((s) => {
                    const active = draftStatus === s.key;
                    return (
                      <Pressable
                        key={s.key}
                        style={[
                          styles.chip,
                          active && {
                            backgroundColor: statusBadgeColor(s.key),
                            borderColor: statusBadgeColor(s.key),
                          },
                        ]}
                        onPress={() => setDraftStatus(s.key)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {techs.length > 0 ? (
                  <>
                    <Text style={styles.label}>แท็กช่าง (ไม่บังคับ)</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipRowScroll}
                    >
                      {techs.slice(0, 20).map((t) => {
                        const active = String(draftTechId) === String(t.id);
                        return (
                          <Pressable
                            key={t.id}
                            style={[styles.chip, active && styles.chipActive]}
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
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {t.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : null}

                <Text style={styles.label}>สีโพสต์อิท</Text>
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

                <Pressable
                  style={[styles.btn, saving && { opacity: 0.6 }]}
                  onPress={addNote}
                  disabled={saving}
                >
                  <Text style={styles.btnText}>{saving ? 'กำลังติดบอร์ด...' : 'ติดบนบอร์ด'}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.filterRow}>
              <Pressable
                style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
                onPress={() => setFilterStatus('all')}
              >
                <Text
                  style={[
                    styles.filterText,
                    filterStatus === 'all' && styles.filterTextActive,
                  ]}
                >
                  ทั้งหมด
                </Text>
              </Pressable>
              {BOARD_STATUSES.map((s) => {
                const active = filterStatus === s.key;
                return (
                  <Pressable
                    key={s.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilterStatus(s.key)}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
            ) : notes.length === 0 ? (
              <View style={styles.emptyBoard}>
                <Text style={styles.emptyTitle}>บอร์ดว่าง</Text>
                <Text style={styles.emptySub}>กด “+ โน้ต” แล้วติดโพสต์อิทได้เลย</Text>
              </View>
            ) : (
              <View style={styles.cork}>
                <View style={styles.board}>
                  {notes.map((n) => {
                    const parsed = parseBoardBody(n.body);
                    const statusLabel =
                      BOARD_STATUSES.find((s) => s.key === parsed.status)?.label || 'รอ';
                    const bodyText =
                      parsed.problem ||
                      [parsed.location, parsed.parts, parsed.note].filter(Boolean).join('\n') ||
                      '';
                    return (
                      <View
                        key={n.id}
                        style={[
                          styles.note,
                          isMobile ? styles.noteMobile : styles.noteDesk,
                          { backgroundColor: n.color || COLORS[0] },
                          n.pin && styles.notePinned,
                        ]}
                      >
                        <View style={styles.noteTop}>
                          <Text style={styles.noteTitle} numberOfLines={2}>
                            {n.title || 'โน้ต'}
                          </Text>
                          {n.pin ? <Ionicons name="pin" size={14} color={colors.navy} /> : null}
                        </View>

                        <Pressable
                          onPress={() => cycleStatus(n)}
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusBadgeColor(parsed.status) },
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                        </Pressable>

                        {parsed.techName ? (
                          <Text style={styles.noteLine}>ช่าง: {parsed.techName}</Text>
                        ) : null}

                        {bodyText ? (
                          <Text style={styles.noteBody} numberOfLines={8}>
                            {bodyText}
                          </Text>
                        ) : null}

                        {n.department ? (
                          <Text style={styles.legacyTag}>{n.department}</Text>
                        ) : null}

                        <Text style={styles.noteMeta}>
                          {[n.created_by, n.updated_at ? fmtDateTime(n.updated_at) : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>

                        <View style={styles.noteActions}>
                          <Pressable onPress={() => togglePin(n)} hitSlop={6}>
                            <Text style={styles.link}>{n.pin ? 'เลิกปัก' : 'ปักหมุด'}</Text>
                          </Pressable>
                          <Pressable onPress={() => remove(n)} hitSlop={6}>
                            <Text style={[styles.link, styles.linkDanger]}>ลบ</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
        {isMobile ? <MobileBackBar onPress={goBack} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navyDeep },
  body: { flex: 1 },
  scrollView: { flex: 1 },
  header: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerCentered: { alignItems: 'center' },
  headerInner: { width: '100%' },
  scrollCentered: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2, fontWeight: '600' },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  addBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 13 },
  scroll: {
    backgroundColor: '#E8DFD0',
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
    marginBottom: spacing.md,
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
    paddingVertical: 10,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  chipRowScroll: { flexDirection: 'row', gap: 8, paddingBottom: spacing.sm, paddingRight: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: colors.navyTint,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.navy },
  chipText: { color: colors.navySoft, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: colors.onNavy },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#00000022' },
  colorDotActive: { borderWidth: 3, borderColor: colors.navy },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  filterTextActive: { color: colors.onNavy },
  cork: {
    backgroundColor: '#D9CBB3',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C4B29A',
    minHeight: 280,
  },
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  note: {
    borderRadius: 4,
    padding: spacing.md,
    ...shadow,
  },
  noteDesk: {
    width: '31%',
    minWidth: 200,
    flexGrow: 1,
    maxWidth: 280,
  },
  noteMobile: {
    width: '100%',
  },
  notePinned: {
    transform: [{ rotate: '-1.2deg' }],
  },
  noteTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  noteTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noteBody: { marginTop: 8, color: '#333', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  noteLine: { marginTop: 4, color: '#444', fontSize: 12, fontWeight: '600' },
  legacyTag: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  noteMeta: { marginTop: 10, color: '#666', fontSize: 11 },
  noteActions: { flexDirection: 'row', gap: spacing.lg, marginTop: 8 },
  link: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  linkDanger: { color: '#B91C1C' },
  emptyBoard: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.lg,
  },
  emptyTitle: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  emptySub: { color: colors.textSecondary, marginTop: 6 },
  errorBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow,
  },
  errorTitle: { fontWeight: '800', color: colors.navy, marginBottom: 6 },
  errorMsg: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
