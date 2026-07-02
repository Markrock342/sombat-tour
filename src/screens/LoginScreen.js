import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingView from '../components/LoadingView';
import { colors, spacing, radius, shadow } from '../theme';
import { fetchLogin } from '../data/api';
import { useAuth } from '../data/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const user = username.trim().replace(/ /g, '');
    const pass = password;
    if (!user || !pass) {
      setError('กรอกข้อมูลไม่ครบ');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const profile = await fetchLogin(user, pass);
      await login(profile);
    } catch (e) {
      setError(e.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {loading ? <LoadingView overlay message="กำลังเข้าสู่ระบบ..." /> : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.center}>
          <Image source={require('../../assets/sombattourbg.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandSub}>โปรแกรมงานซ่อมบำรุง</Text>

          <View style={styles.card}>
            <Text style={styles.title}>ลงชื่อเข้าใช้</Text>

            <Text style={styles.label}>ชื่อบัญชี</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              onBlur={() => setUsername((v) => v.trim().replace(/ /g, ''))}
            />

            <Text style={styles.label}>รหัสผ่าน</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={onSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.errorSpacer}>&nbsp;</Text>}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={styles.btnText}>เข้าสู่ระบบ</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logo: { width: 220, height: 74, marginBottom: spacing.sm },
  brandSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.navySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  error: {
    color: '#C0392B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    minHeight: 18,
  },
  errorSpacer: { marginBottom: spacing.sm, minHeight: 18 },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.9 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.onNavy, fontWeight: '800', fontSize: 15 },
});
