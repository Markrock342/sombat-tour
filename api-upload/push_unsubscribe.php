<?php
// POST /api/push_unsubscribe.php — staff opt-out (auth)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
require_push_lib();

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));
  push_ensure_table($pdo);

  $b = read_json_body();
  $endpoint = trim((string)pick($b, array('endpoint')));
  if ($endpoint === '') {
    // remove all for this user
    $st = $pdo->prepare('DELETE FROM push_subscription WHERE username = ?');
    $st->execute(array($user['username']));
    out(array('ok' => true, 'removed' => 'user'));
  }
  $hash = sha1($endpoint);
  $st = $pdo->prepare('DELETE FROM push_subscription WHERE endpoint_hash = ?');
  $st->execute(array($hash));
  out(array('ok' => true, 'removed' => 'endpoint'));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
