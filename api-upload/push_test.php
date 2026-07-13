<?php
// POST /api/push_test.php — send test push to current staff device(s)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
require_push_lib();

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));
  push_ensure_table($pdo);

  $st = $pdo->prepare('SELECT id, endpoint FROM push_subscription WHERE username = ? ORDER BY id DESC LIMIT 20');
  $st->execute(array($user['username']));
  $rows = $st->fetchAll();
  if (!$rows) {
    out(array(
      'ok' => false,
      'error' => 'NO_SUBSCRIPTION',
      'message' => 'ยังไม่ได้เปิดรับแจ้งเตือนบนเครื่องนี้',
    ), 400);
  }

  $public = vapid_public_key();
  $sent = 0;
  $failed = 0;
  $gone = array();

  foreach ($rows as $row) {
    $endpoint = (string)$row['endpoint'];
    if ($endpoint === '') continue;
    $parts = parse_url($endpoint);
    if (empty($parts['scheme']) || empty($parts['host'])) continue;
    $aud = $parts['scheme'] . '://' . $parts['host'];
    $jwt = push_vapid_jwt($aud);
    if (!$jwt || !function_exists('curl_init')) {
      $failed++;
      continue;
    }
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
      'TTL: 60',
      'Urgency: high',
      'Content-Length: 0',
      'Authorization: vapid t=' . $jwt . ', k=' . $public,
    ));
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code >= 200 && $code < 300) $sent++;
    elseif ($code === 404 || $code === 410) {
      $gone[] = (int)$row['id'];
      $failed++;
    } else {
      $failed++;
    }
  }

  if ($gone) {
    try {
      $in = implode(',', array_map('intval', $gone));
      if ($in !== '') $pdo->exec('DELETE FROM push_subscription WHERE id IN (' . $in . ')');
    } catch (Exception $e) { /* ignore */ }
  }

  if ($sent <= 0) {
    out(array(
      'ok' => false,
      'error' => 'SEND_FAILED',
      'message' => 'ส่งไม่ถึงอุปกรณ์ — ลองปิดแล้วเปิดแจ้งเตือนใหม่',
      'failed' => $failed,
    ), 500);
  }

  out(array('ok' => true, 'sent' => $sent, 'failed' => $failed));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
