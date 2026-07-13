<?php
// POST /api/push_test.php — send test push to current staff device(s)
// Keep this fast: 1 subscription, short curl timeouts (avoids browser "Failed to fetch").
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';

if (!function_exists('require_push_lib')) {
  out(array(
    'ok' => false,
    'error' => 'OLD_BOOTSTRAP',
    'message' => 'อัป bootstrap.php ขึ้น cPanel ก่อน แล้วอัป push_test.php ใหม่',
  ), 500);
}
require_push_lib();

@set_time_limit(25);
@ini_set('max_execution_time', '25');

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff'));
  push_ensure_table($pdo);

  $st = $pdo->prepare('SELECT id, endpoint FROM push_subscription WHERE username = ? ORDER BY id DESC LIMIT 3');
  $st->execute(array($user['username']));
  $rows = $st->fetchAll();
  if (!$rows) {
    out(array(
      'ok' => false,
      'error' => 'NO_SUBSCRIPTION',
      'message' => 'ยังไม่ได้เปิดรับแจ้งเตือนบนเครื่องนี้ — กดเปิดรับก่อน',
    ), 400);
  }

  if (!function_exists('curl_init')) {
    out(array(
      'ok' => false,
      'error' => 'NO_CURL',
      'message' => 'เซิร์ฟเวอร์ไม่มี curl — ติดต่อโฮสต์',
    ), 500);
  }

  $public = vapid_public_key();
  $sent = 0;
  $failed = 0;
  $gone = array();
  $lastCode = 0;
  $jwtFail = 0;
  $lastCurlErr = '';

  foreach ($rows as $row) {
    $endpoint = (string)$row['endpoint'];
    if ($endpoint === '') {
      $failed++;
      continue;
    }
    $parts = parse_url($endpoint);
    if (empty($parts['scheme']) || empty($parts['host'])) {
      $failed++;
      continue;
    }
    $aud = $parts['scheme'] . '://' . $parts['host'];
    $jwt = push_vapid_jwt($aud);
    if (!$jwt) {
      $jwtFail++;
      $failed++;
      continue;
    }

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
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
    $cerr = curl_error($ch);
    curl_close($ch);
    $lastCode = $code;

    if ($code >= 200 && $code < 300) {
      $sent++;
      break; // one success is enough for test
    }
    if ($code === 404 || $code === 410) {
      $gone[] = (int)$row['id'];
      $failed++;
    } else {
      $failed++;
      if ($cerr !== '') {
        // keep going; report last curl error below if all fail
        $lastCurlErr = $cerr;
      }
    }
  }

  if ($gone) {
    try {
      $in = implode(',', array_map('intval', $gone));
      if ($in !== '') $pdo->exec('DELETE FROM push_subscription WHERE id IN (' . $in . ')');
    } catch (Exception $e) { /* ignore */ }
  }

  if ($sent <= 0) {
    $msg = 'ส่งไม่ถึงอุปกรณ์ — ลองปิดแล้วเปิดแจ้งเตือนใหม่';
    if ($jwtFail > 0) $msg = 'สร้างลายเซ็นแจ้งเตือนไม่สำเร็จ (VAPID/openssl) — ตรวจ vapid.php';
    elseif ($lastCode > 0) $msg = 'บริการแจ้งเตือนตอบรหัส ' . $lastCode . ' — ลองปิดแล้วเปิดแจ้งเตือนใหม่';
    elseif (!empty($lastCurlErr)) $msg = 'เชื่อมต่อไปบริการแจ้งเตือนไม่ได้: ' . $lastCurlErr;
    out(array(
      'ok' => false,
      'error' => 'SEND_FAILED',
      'message' => $msg,
      'failed' => $failed,
      'http' => $lastCode,
    ), 500);
  }

  out(array('ok' => true, 'sent' => $sent, 'failed' => $failed));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
