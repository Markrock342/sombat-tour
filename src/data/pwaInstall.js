import { Platform } from 'react-native';

let _deferredInstallPrompt = null;
let _listeners = [];

export function initPwaInstallCapture() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (window.__sombatPwaInstallBound) return;
  window.__sombatPwaInstallBound = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    _listeners.forEach((fn) => {
      try {
        fn(true);
      } catch (_) {}
    });
  });

  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    _listeners.forEach((fn) => {
      try {
        fn(false);
      } catch (_) {}
    });
  });
}

export function onInstallPromptChange(fn) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((x) => x !== fn);
  };
}

export function canPromptInstall() {
  return !!_deferredInstallPrompt;
}

export function isRunningAsPwa() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return !!(mq || iosStandalone);
}

export function isIosDevice() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isIosSafari() {
  if (!isIosDevice()) return false;
  const ua = navigator.userAgent || '';
  const webkit = /WebKit/.test(ua);
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Firefox|Edg/.test(ua);
  return webkit && !other;
}

/** Human-friendly device detection for install UI */
export function detectInstallTarget() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (isIosDevice()) {
    return {
      os: 'ios',
      label: 'iPhone / iPad',
      browser: isIosSafari() ? 'Safari' : 'เบราว์เซอร์อื่นบน iOS',
      canAutoInstall: false,
      preferSafari: !isIosSafari(),
    };
  }
  if (isAndroidDevice()) {
    const chrome = /Chrome/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);
    return {
      os: 'android',
      label: 'Android',
      browser: chrome ? 'Chrome' : /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : 'เบราว์เซอร์นี้',
      canAutoInstall: !!_deferredInstallPrompt,
      preferChrome: !chrome,
    };
  }
  return {
    os: 'desktop',
    label: 'คอมพิวเตอร์',
    browser: /Edg/i.test(ua) ? 'Edge' : /Chrome/i.test(ua) ? 'Chrome' : 'เบราว์เซอร์นี้',
    canAutoInstall: !!_deferredInstallPrompt,
    preferChrome: false,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait briefly for Chrome to fire beforeinstallprompt after user gesture chain */
export async function waitForInstallPrompt(timeoutMs = 1800) {
  if (_deferredInstallPrompt) return true;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (_deferredInstallPrompt) return true;
    await sleep(120);
  }
  return !!_deferredInstallPrompt;
}

/**
 * Smart install: auto-prompt on Android/Desktop Chrome when the browser allows it.
 * iOS has no install API — returns needs_guide.
 */
export async function installAppSmart() {
  initPwaInstallCapture();
  const target = detectInstallTarget();

  if (isRunningAsPwa()) {
    return { ok: true, reason: 'already_installed', target };
  }

  if (_deferredInstallPrompt || (await waitForInstallPrompt(target.os === 'android' ? 2000 : 800))) {
    const ev = _deferredInstallPrompt;
    _deferredInstallPrompt = null;
    try {
      ev.prompt();
      const choice = await ev.userChoice;
      _listeners.forEach((fn) => {
        try {
          fn(false);
        } catch (_) {}
      });
      return {
        ok: choice.outcome === 'accepted',
        reason: choice.outcome,
        target,
        auto: true,
      };
    } catch (_) {
      return { ok: false, reason: 'prompt_failed', target, needsGuide: true };
    }
  }

  return {
    ok: false,
    reason: target.os === 'ios' ? 'ios_manual' : 'no_prompt',
    target,
    needsGuide: true,
  };
}

/** @deprecated use installAppSmart */
export async function promptPwaInstall() {
  const res = await installAppSmart();
  return { ok: res.ok, reason: res.reason };
}
