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
import {
  fetchBoard,
  createBoardNote,
  updateBoardNote,
  deleteBoardNote,
  fmtDateTime,
} from '../data/api';

const COLORS = ['#FFF59D', '#C8E6C9', '#BBDEFB', '#F8BBD0', '#FFE0B2', '#E1BEE7'];

export default function BoardScreen({ navigation }) {
  const { canWrite, user } = useAuth();
  const isMobile = useIsMobile();
  const goBack = () => navigation.goBack();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchBoard());
    } catch (e) {
      setError(e.message || 'โหลดบอร์ดไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addNote = async () => {
    if (!canWrite) {
      navigation.navigate('Login');
      return;
    }
    if (!draftTitle.trim()) {
      Alert.alert('กรุณาใส่หัวข้อ');
      return;
    }
    setSaving(true);
    try {
      await createBoardNote({
        title: draftTitle.trim(),
        body: draftBody.trim(),
        color: draftColor,
        department: user?.department || '',
        pin: false,
      });
      setDraftTitle('');
      setDraftBody('');
      await load();
    } catch (e) {
      if (e.code === 'UNAUTHORIZED') navigation.navigate('Login');
      else Alert.alert('ไม่สำเร็จ', e.message || '');
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
          <Text style={styles.headerTitle}>บอร์ดข่าว (ไวท์บอร์ด)</Text>
          <Text style={styles.headerSub}>แผนกไหนก็เข้ามาเขียน / อ่านได้</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, isMobile && mobileScrollInset]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.composer}>
            <Text style={styles.composerTitle}>เพิ่มโน้ต</Text>
            <TextInput
              style={styles.input}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="หัวข้อ"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              value={draftBody}
              onChangeText={setDraftBody}
              placeholder="รายละเอียด"
              placeholderTextColor={colors.textMuted}
              multiline
            />
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
              <Text style={styles.btnText}>{saving ? 'กำลังบันทึก...' : 'ปักโน้ต'}</Text>
            </Pressable>
          </View>

          {loading ? (
            <LoadingView compact />
          ) : error ? (
            <Text style={styles.msg}>{error}</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.msg}>ยังไม่มีโน้ตบนบอร์ด</Text>
          ) : (
            <View style={styles.board}>
              {rows.map((n) => (
                <View key={n.id} style={[styles.note, { backgroundColor: n.color || COLORS[0] }]}>
                  <View style={styles.noteTop}>
                    <Text style={styles.noteTitle}>{n.title}</Text>
                    {n.pin ? <Text style={styles.pin}>📌</Text> : null}
                  </View>
                  {n.body ? <Text style={styles.noteBody}>{n.body}</Text> : null}
                  <Text style={styles.noteMeta}>
                    {[n.department, n.created_by, n.updated_at ? fmtDateTime(n.updated_at) : '']
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
              ))}
            </View>
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
    backgroundColor: '#F5F0E6',
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
  composerTitle: { fontWeight: '800', color: colors.navy, marginBottom: spacing.sm },
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
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00000022' },
  colorDotActive: { borderWidth: 3, borderColor: colors.navy },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  btnText: { color: colors.onNavy, fontWeight: '800' },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  note: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 4,
    padding: spacing.md,
    ...shadow,
  },
  noteTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  noteTitle: { fontWeight: '800', color: '#1A1A1A', fontSize: 15, flex: 1 },
  pin: { fontSize: 14 },
  noteBody: { marginTop: 6, color: '#333', fontSize: 13, lineHeight: 19 },
  noteMeta: { marginTop: 10, color: '#666', fontSize: 11 },
  noteActions: { flexDirection: 'row', gap: spacing.lg, marginTop: 8 },
  link: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  msg: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
});
