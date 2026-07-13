<?php
/**
 * POST /api/push_test.php
 * Body: { "mode": "ping" | "send" }  (default send)
 *
 * ping  = auth + subscription + JWT only (fast, no outbound curl)
 * send  = reply JSON immediately, then curl push in background if possible
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

@set_time_limit(30);
@ini_set('max_execution_time', '30');
ignore_user_abort(true);

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff'));
  push_ensure_table($pdo);

  $b = read_json_body();
  $mode = strtolower(trim((string)pick($b, array('mode', 'action'), 'send')));
  if ($mode === '') $mode = 'send';

  $st = $pdo->prepare('SELECT id, endpoint FROM push_subscription WHERE username = ? ORDER BY id DESC LIMIT 1');
  $st->execute(array($user['username']));
  $row = $st->fetch();
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

  if ($mode === 'ping' || $mode === 'check') {
    out(array(
      'ok' => true,
      'mode' => 'ping',
      'username' => $user['username'],
      'audience' => $aud,
      'jwt_ok' => true,
      'curl' => function_exists('curl_init'),
    ));
  }

  // ---- send: respond first so browser never hits Failed to fetch ----
  if (!function_exists('out_flush')) {
    out(array(
      'ok' => false,
      'error' => 'OLD_BOOTSTRAP',
      'message' => 'อัป bootstrap.php ชุดใหม่ (ต้องมี out_flush)',
    ), 500);
  }

  out_flush(array(
    'ok' => true,
    'mode' => 'send',
    'queued' => true,
    'username' => $user['username'],
    'message' => 'รับคำสั่งแล้ว กำลังยิงไปที่เครื่อง',
  ));

  // After client already got JSON — try real push (best effort)
  if (!function_exists('curl_init')) {
    exit;
  }

  $public = vapid_public_key();
  $ch = curl_init($endpoint);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, '');
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
  curl_setopt($ch, CURLOPT_TIMEOUT, 6);
  if (defined('CURL_SSLVERSION_TLSv1_2')) {
    curl_setopt($ch, CURLOPT_SSLVERSION, CURL_SSLVERSION_TLSv1_2);
  }
  curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'TTL: 60',
    'Urgency: high',
    'Content-Length: 0',
    'Authorization: vapid t=' . $jwt . ', k=' . $public,
  ));
  curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($code === 404 || $code === 410) {
    try {
      $pdo->prepare('DELETE FROM push_subscription WHERE id = ?')->execute(array((int)$row['id']));
    } catch (Exception $e) { /* ignore */ }
  }

  exit;
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
