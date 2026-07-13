import { Alert, Platform } from 'react-native';

/**
 * Web-safe dialogs. RN Alert.alert with buttons often fails on react-native-web.
 */

export function showAlert(title, message = '') {
  const text = message ? `${title}\n${message}` : title;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(text);
    return;
  }
  Alert.alert(title, message || undefined);
}

/**
 * Confirm OK / Cancel. Returns Promise<boolean>.
 */
export function confirmDialog(title, message = '', { confirmText = 'ตกลง', cancelText = 'ยกเลิก' } = {}) {
  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(text));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message || undefined, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Multi-choice after an action. On web: sequential confirms / first matching confirm.
 * buttons: [{ text, onPress, style?, primary? }] — cancel-style skipped on web unless only option
 */
export async function chooseAction(title, message, buttons = []) {
  const opts = (buttons || []).filter(Boolean);
  if (!opts.length) {
    showAlert(title, message);
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const cancel = opts.find((b) => b.style === 'cancel');
    const actions = opts.filter((b) => b.style !== 'cancel');
    const body = message ? `${title}\n\n${message}` : title;

    if (actions.length === 0) {
      window.alert(body);
      return;
    }

    if (actions.length === 1) {
      const ok = window.confirm(body + `\n\n→ ${actions[0].text}`);
      if (ok && actions[0].onPress) actions[0].onPress();
      else if (!ok && cancel?.onPress) cancel.onPress();
      return;
    }

    // Multiple actions: ask for each until one accepted
    for (const action of actions) {
      const ok = window.confirm(`${body}\n\nเลือก: ${action.text}?`);
      if (ok) {
        if (action.onPress) action.onPress();
        return;
      }
    }
    if (cancel?.onPress) cancel.onPress();
    return;
  }

  Alert.alert(title, message || undefined, opts);
}
