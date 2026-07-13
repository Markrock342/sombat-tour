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

export function isIosSafari() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chrome = /CriOS|Chrome|Firefox|Edg/.test(ua);
  return iOS && webkit && !chrome;
}

/** Returns true if installed / prompt shown successfully */
export async function promptPwaInstall() {
  if (!_deferredInstallPrompt) return { ok: false, reason: 'no_prompt' };
  const ev = _deferredInstallPrompt;
  _deferredInstallPrompt = null;
  ev.prompt();
  const choice = await ev.userChoice;
  return { ok: choice.outcome === 'accepted', reason: choice.outcome };
}
