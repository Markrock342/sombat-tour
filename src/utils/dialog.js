import { presentDialog } from '../components/SweetDialog';

/**
 * SweetAlert-style dialogs (custom Modal) — works on web + native.
 */

export async function showAlert(title, message = '', { icon = 'info', confirmText = 'ตกลง' } = {}) {
  await presentDialog({
    mode: 'alert',
    title,
    message,
    icon,
    confirmText,
  });
}

/**
 * Confirm OK / Cancel. Returns Promise<boolean>.
 */
export async function confirmDialog(
  title,
  message = '',
  { confirmText = 'ตกลง', cancelText = 'ยกเลิก', icon = 'question', destructive = false } = {}
) {
  const res = await presentDialog({
    mode: 'confirm',
    title,
    message,
    icon: destructive ? 'danger' : icon,
    confirmText,
    cancelText,
    destructive,
  });
  return !!res?.value;
}

/**
 * Multi-choice. buttons: [{ text, onPress, style? }]
 * style: 'cancel' | 'primary' | 'danger' | 'success'
 */
export async function chooseAction(title, message, buttons = [], { icon = 'question' } = {}) {
  const opts = (buttons || []).filter(Boolean);
  if (!opts.length) {
    await showAlert(title, message, { icon: 'info' });
    return;
  }

  const mapped = opts.map((b) => ({
    text: b.text,
    style: b.style === 'destructive' ? 'danger' : b.style || 'primary',
    onPress: b.onPress,
    value: b.style === 'cancel' ? false : true,
  }));

  await presentDialog({
    mode: 'choose',
    title,
    message,
    icon,
    buttons: mapped,
  });
}
