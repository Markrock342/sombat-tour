<?php
// POST /api/push_subscribe.php — desk staff opt-in (admin/staff only)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
require_push_lib();

try {
  $user = auth_user($pdo, true);
  // เฉพาะรับเรื่อง/จัดการ — ไม่รวมช่าง
  require_roles($user, array('admin', 'staff'));
  push_ensure_table($pdo);

  $b = read_json_body();
  $endpoint = trim((string)pick($b, array('endpoint')));
  if ($endpoint === '') out(array('ok' => false, 'error' => 'MISSING_ENDPOINT'), 400);

  $keys = isset($b['keys']) && is_array($b['keys']) ? $b['keys'] : array();
  $p256dh = isset($keys['p256dh']) ? trim((string)$keys['p256dh']) : '';
  $auth = isset($keys['auth']) ? trim((string)$keys['auth']) : '';
  $ua = isset($_SERVER['HTTP_USER_AGENT']) ? substr((string)$_SERVER['HTTP_USER_AGENT'], 0, 250) : '';
  $hash = sha1($endpoint);
  $now = date('Y-m-d H:i:s');
  $role = isset($user['role']) ? (string)$user['role'] : 'staff';

  $okInsert = false;
  try {
    $st = $pdo->prepare(
      'INSERT INTO push_subscription (endpoint_hash, endpoint, p256dh, auth_key, username, role, user_agent, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE p256dh=VALUES(p256dh), auth_key=VALUES(auth_key), username=VALUES(username),
         role=VALUES(role), user_agent=VALUES(user_agent), updated_at=VALUES(updated_at), endpoint=VALUES(endpoint)'
    );
    $st->execute(array($hash, $endpoint, $p256dh, $auth, $user['username'], $role, $ua, $now, $now));
    $okInsert = true;
  } catch (Exception $e) {
    // Schema may lack role column — fall back
    try {
      $pdo->prepare('DELETE FROM push_subscription WHERE endpoint_hash = ?')->execute(array($hash));
      $st2 = $pdo->prepare(
        'INSERT INTO push_subscription (endpoint_hash, endpoint, p256dh, auth_key, username, user_agent, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)'
      );
      $st2->execute(array($hash, $endpoint, $p256dh, $auth, $user['username'], $ua, $now, $now));
      $okInsert = true;
    } catch (Exception $e2) {
      out(array('ok' => false, 'error' => 'DB_ERROR', 'message' => $e2->getMessage()), 500);
    }
  }

  if (!$okInsert) {
    out(array('ok' => false, 'error' => 'DB_ERROR'), 500);
  }

  out(array(
    'ok' => true,
    'vapid_public' => vapid_public_key(),
    'username' => $user['username'],
    'role' => $role,
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
