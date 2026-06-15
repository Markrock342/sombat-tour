import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, radius, shadow } from '../theme';
import { searchVehicles } from '../data/api';

export default function VehicleSearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async () => {
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      setResults(await searchVehicles(term));
    } catch (e) {
      setError(e.message || 'ค้นหาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [q]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ กลับ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ค้นหารถ</Text>
        <Text style={styles.headerSub}>ค้นจาก ID รถ หรือ เบอร์รถ (ไม่ใช่ทะเบียน)</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="เช่น 332 หรือ 993-5ม1น"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={doSearch}
          returnKeyType="search"
          autoFocus
        />
        <Pressable style={styles.searchBtn} onPress={doSearch}>
          <Text style={styles.searchBtnText}>ค้นหา</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.navy} />
          </View>
        ) : error ? (
          <Text style={styles.msg}>{error}</Text>
        ) : !searched ? (
          <Text style={styles.msg}>พิมพ์ ID รถ / เบอร์รถ แล้วกดค้นหา</Text>
        ) : results.length === 0 ? (
          <Text style={styles.msg}>ไม่พบรถที่ค้นหา</Text>
        ) : (
          results.map((v) => (
            <Pressable
              key={v.v_id}
              style={({ pressed }) => [styles.vCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('VehicleDetail', { vehicle: v })}
            >
              <View style={styles.vTop}>
                <Text style={styles.vId}>ID {v.v_id}</Text>
                <Text style={styles.vName}>{v.v_name || '-'}</Text>
              </View>
              <Text style={styles.vSub}>
                {[v.v_brand, v.v_model].filter(Boolean).join(' ')} · ทะเบียน {v.v_plate || '-'}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: spacing.sm },
  headerTitle: { color: colors.onNavy, fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: colors.barFillAlt,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  searchBtnText: { color: colors.onNavy, fontWeight: '800', fontSize: 14 },
  scroll: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    minHeight: '100%',
    gap: spacing.md,
  },
  center: { paddingVertical: spacing.xl * 2, alignItems: 'center' },
  msg: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
  vCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow },
  pressed: { opacity: 0.85 },
  vTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  vId: { color: colors.navy, fontSize: 13, fontWeight: '800' },
  badge: { backgroundColor: colors.navyTint, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: colors.navySoft, fontSize: 11, fontWeight: '700' },
  vName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  vSub: { color: colors.textSecondary, fontSize: 12 },
});
