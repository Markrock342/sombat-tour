import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'sombat_session';

export async function getSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveSession(user) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
