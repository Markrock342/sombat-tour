import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { useAuth } from '../auth/AuthContext';

const CARD_MAX = 360;

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      // AuthGate สลับไป Dashboard ให้อัตโนมัติหลัง login สำเร็จ
    } catch (e) {
      const code = e.code || '';
      const msg =
        code === 'NO_USER'
          ? 'ไม่มีชื่อผู้ใช้นี้'
          : code === 'BAD_PASSWORD' || code === 'INVALID_CREDENTIALS'
            ? 'รหัสผ่านไม่ถูกต้อง'
            : code === 'SUSPENDED'
              ? 'บัญชีถูกระงับการใช้งาน'
              : code === 'UNAUTHORIZED'
                ? 'ไม่สามารถเข้าสู่ระบบได้'
                : e.message || 'เข้าสู่ระบบไม่สำเร็จ';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.center}>
            <Image source={require('../../assets/sombatlogobg.png')} style={styles.logo} />
            <Text style={styles.title}>เข้าสู่ระบบ</Text>
            <Text style={styles.sub}>ใช้บัญชีสมาชิกเดียวกับระบบ 425store</Text>

            <View style={styles.card}>
              <Text style={[styles.label, styles.labelFirst]}>ชื่อผู้ใช้</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ชื่อผู้ใช้"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>รหัสผ่าน</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="รหัสผ่าน"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={onSubmit}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                style={[
                  styles.btn,
                  (loading || !username.trim() || !password) && styles.btnDisabled,
                ]}
                onPress={onSubmit}
                disabled={loading || !username.trim() || !password}
              >
                <Text style={styles.btnText}>
                  {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  body: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  center: {
    width: '100%',
    maxWidth: CARD_MAX,
    alignSelf: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  title: {
    color: colors.onNavy,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  labelFirst: { marginTop: 0 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  error: {
    color: '#E5544B',
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  btn: {
    marginTop: spacing.lg,
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.onNavy, fontWeight: '800', fontSize: 15 },
  cancel: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '700',
  },
});
