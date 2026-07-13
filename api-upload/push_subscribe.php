<?php
// POST /api/push_subscribe.php — staff opt-in (auth)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/push_lib.php';

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));
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

  $st = $pdo->prepare(
    'INSERT INTO push_subscription (endpoint_hash, endpoint, p256dh, auth_key, username, user_agent, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE p256dh=VALUES(p256dh), auth_key=VALUES(auth_key), username=VALUES(username),
       user_agent=VALUES(user_agent), updated_at=VALUES(updated_at), endpoint=VALUES(endpoint)'
  );
  // MySQL ON DUPLICATE may fail on old versions without — fallback delete+insert
  try {
    $st->execute(array($hash, $endpoint, $p256dh, $auth, $user['username'], $ua, $now, $now));
  } catch (Exception $e) {
    $pdo->prepare('DELETE FROM push_subscription WHERE endpoint_hash = ?')->execute(array($hash));
    $st2 = $pdo->prepare(
      'INSERT INTO push_subscription (endpoint_hash, endpoint, p256dh, auth_key, username, user_agent, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)'
    );
    $st2->execute(array($hash, $endpoint, $p256dh, $auth, $user['username'], $ua, $now, $now));
  }

  out(array(
    'ok' => true,
    'vapid_public' => vapid_public_key(),
    'username' => $user['username'],
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
