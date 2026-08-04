<?php
/**
 * POST /api/push_test.php
 * Body: { "mode": "ping" | "send", "endpoint": "<optional — test this device>" }
 *
 * ping = auth + subscription + JWT + crypto capability check (no outbound curl)
 * send = encrypted Web Push to this user's device, synchronous, returns the
 *        REAL result (HTTP code from the push service) — no more guessing.
 */
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';

if (!function_exists('require_push_lib')) {
  out(array(
    'ok' => false,
    'error' => 'OLD_BOOTSTRAP',
    'message' => 'อัป bootstrap.php ขึ้น cPanel ก่อน',
  ), 500);
}
require_push_lib();

if (!function_exists('push_capabilities') || !function_exists('push_send_webpush_multi')) {
  out(array(
    'ok' => false,
    'error' => 'OLD_PUSH_LIB',
    'message' => 'push_lib.php บนเซิร์ฟเวอร์ยังเป็นรุ่นเก่า — ลบไฟล์เดิมแล้วอัปใหม่จาก api-upload (ต้องได้ ~22 KB)',
  ), 500);
}

@set_time_limit(45);
@ini_set('max_execution_time', '45');
ignore_user_abort(true);

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff'));
  push_ensure_table($pdo);

  $b = read_json_body();
  $mode = strtolower(trim((string)pick($b, array('mode', 'action'), 'send')));
  if ($mode === '') $mode = 'send';
  $wantEndpoint = trim((string)pick($b, array('endpoint')));

  // Prefer the exact device that pressed the button, else newest for this user
  $row = null;
  if ($wantEndpoint !== '') {
    $st = $pdo->prepare('SELECT id, endpoint, p256dh, auth_key FROM push_subscription WHERE endpoint_hash = ? LIMIT 1');
    $st->execute(array(sha1($wantEndpoint)));
    $row = $st->fetch();
  }
  if (!$row) {
    $st = $pdo->prepare('SELECT id, endpoint, p256dh, auth_key FROM push_subscription WHERE username = ? ORDER BY id DESC LIMIT 1');
    $st->execute(array($user['username']));
    $row = $st->fetch();
  }
  if (!$row) {
    out(array(
      'ok' => false,
      'error' => 'NO_SUBSCRIPTION',
      'message' => 'ยังไม่ได้เปิดรับแจ้งเตือนบนเครื่องนี้ — กดเปิดรับก่อน',
    ), 400);
  }

  $endpoint = (string)$row['endpoint'];
  $parts = parse_url($endpoint);
  if (empty($parts['scheme']) || empty($parts['host'])) {
    out(array(
      'ok' => false,
      'error' => 'BAD_ENDPOINT',
      'message' => 'endpoint แจ้งเตือนเสีย — ปิดแล้วเปิดรับใหม่',
    ), 400);
  }
  $aud = $parts['scheme'] . '://' . $parts['host'];
  $jwt = push_vapid_jwt($aud);
  if (!$jwt) {
    out(array(
      'ok' => false,
      'error' => 'VAPID_SIGN_FAILED',
      'message' => 'สร้างลายเซ็นไม่สำเร็จ — ตรวจ vapid.php / openssl',
    ), 500);
  }

  $caps = push_capabilities();

  if ($mode === 'ping' || $mode === 'check') {
    out(array(
      'ok' => true,
      'mode' => 'ping',
      'username' => $user['username'],
      'audience' => $aud,
      'jwt_ok' => true,
      'caps' => $caps,
      'crypto_selftest' => push_crypto_selftest(),
    ));
  }

  if (!function_exists('curl_init')) {
    out(array(
      'ok' => false,
      'error' => 'NO_CURL',
      'message' => 'โฮสต์ไม่มี curl — ยิงแจ้งเตือนออกไม่ได้',
    ), 500);
  }

  // ---- send: encrypted payload (iPhone needs it), synchronous, real result ----
  $payload = json_encode(array(
    'title' => 'สมบัติทัวร์ · ทดสอบ',
    'body' => 'แจ้งเตือนจากเซิร์ฟเวอร์ถึงเครื่องนี้ทำงานแล้ว ✓',
    'url' => '/',
  ), defined('JSON_UNESCAPED_UNICODE') ? JSON_UNESCAPED_UNICODE : 0);

  $body = null;
  if ($caps['mode'] === 'payload' && !empty($row['p256dh']) && !empty($row['auth_key'])) {
    $body = push_encrypt_payload($row['p256dh'], $row['auth_key'], $payload);
  }

  $results = push_send_webpush_multi(array(array(
    'endpoint' => $endpoint,
    'body' => $body,
  )), 60, 15);
  $code = isset($results[0]['code']) ? (int)$results[0]['code'] : 0;

  if ($code === 404 || $code === 410) {
    try {
      $pdo->prepare('DELETE FROM push_subscription WHERE id = ?')->execute(array((int)$row['id']));
    } catch (Exception $e) { /* ignore */ }
  }

  $sent = ($code >= 200 && $code < 300);
  $hint = '';
  if ($code === 0) $hint = 'ยิงไม่ออกจากโฮสต์ (curl ต่อไม่ได้/หมดเวลา)';
  elseif ($code === 401 || $code === 403) $hint = 'push service ปฏิเสธลายเซ็น VAPID';
  elseif ($code === 404 || $code === 410) $hint = 'การสมัครรับหมดอายุ — ปิดแล้วเปิดรับใหม่บนเครื่องนั้น';
  elseif ($code === 413) $hint = 'payload ใหญ่เกิน';
  elseif (!$sent) $hint = 'push service ตอบ ' . $code;

  out(array(
    'ok' => $sent,
    'mode' => 'send',
    'sent' => $sent ? 1 : 0,
    'code' => $code,
    'push_mode' => $body !== null ? 'payload' : 'empty',
    'crypto' => $caps['bignum'] !== '' ? 'aes128gcm/' . $caps['bignum'] : 'none',
    'host' => $parts['host'],
    'username' => $user['username'],
    'message' => $sent
      ? 'push service รับเรื่องแล้ว (' . $code . ') — แจ้งเตือนควรเด้งภายในไม่กี่วินาที'
      : ($hint !== '' ? $hint : 'ส่งไม่สำเร็จ'),
  ), $sent ? 200 : 502);
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
