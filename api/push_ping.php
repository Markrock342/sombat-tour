<?php
/**
 * GET /api/push_ping.php — no auth; verify push files are the correct ones.
 * Open in browser after upload. Expect ok:true and lib_ok:true.
 */
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));

$info = array(
  'ok' => true,
  'php' => PHP_VERSION,
  'vapid_file' => is_file(__DIR__ . '/vapid.php'),
  'lib_file' => is_file(__DIR__ . '/push_lib.php'),
  'subscribe_file' => is_file(__DIR__ . '/push_subscribe.php'),
  'has_require_push_lib' => function_exists('require_push_lib'),
);

$libPath = __DIR__ . '/push_lib.php';
if (is_file($libPath)) {
  $raw = @file_get_contents($libPath);
  $info['lib_bytes'] = $raw !== false ? strlen($raw) : 0;
  $info['lib_looks_wrong'] = ($raw !== false && (strpos($raw, 'auth_user') !== false || strpos($raw, 'function push_ensure_table') === false));
  $info['lib_head'] = $raw !== false ? substr(preg_replace('/\s+/', ' ', $raw), 0, 160) : '';
}

try {
  require_once __DIR__ . '/vapid.php';
  $info['vapid_ok'] = function_exists('vapid_public_key');
  $info['publicKey_prefix'] = $info['vapid_ok'] ? substr(vapid_public_key(), 0, 16) : '';
} catch (Exception $e) {
  $info['vapid_ok'] = false;
  $info['vapid_error'] = $e->getMessage();
}

if (!empty($info['lib_looks_wrong'])) {
  $info['ok'] = false;
  $info['error'] = 'BAD_PUSH_LIB';
  $info['message'] = 'ไฟล์ push_lib.php บนเซิร์ฟเวอร์ผิด — ลบแล้วอัปใหม่จาก api-upload/push_lib.php (~4–5KB ขึ้นต้นด้วย Web Push helpers)';
  out($info, 500);
}

try {
  if (function_exists('require_push_lib')) {
    require_push_lib();
  } else {
    require_once __DIR__ . '/push_lib.php';
  }
  $info['lib_ok'] = function_exists('push_ensure_table') && defined('SOMBAT_PUSH_LIB');
} catch (Exception $e) {
  $info['lib_ok'] = false;
  $info['lib_error'] = $e->getMessage();
}

if (empty($info['lib_ok'])) {
  $info['ok'] = false;
  $info['error'] = 'BAD_PUSH_LIB';
  $info['message'] = 'โหลด push_lib ไม่ได้ — อัป bootstrap.php + push_lib.php ใหม่';
  out($info, 500);
}

out($info);
