<?php
// POST /api/repair_status.php — staff updates public repair status
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));

  $b = read_json_body();
  $rId = isset($b['r_id']) ? (int)$b['r_id'] : 0;
  if ($rId <= 0) out(array('ok' => false, 'error' => 'MISSING_R_ID'), 400);

  $status = trim((string)pick($b, array('status', 'public_status')));
  if (!in_array($status, public_repair_statuses(), true)) {
    out(array('ok' => false, 'error' => 'INVALID_STATUS'), 400);
  }

  $note = trim((string)pick($b, array('note', 'message')));
  $byUser = isset($user['username']) ? (string)$user['username'] : 'staff';

  $meta = get_repair_public_meta($pdo, $rId);
  if (!$meta) out(array('ok' => false, 'error' => 'NOT_PUBLIC_REPORT'), 404);

  $st = $pdo->prepare('UPDATE repair_public_meta SET public_status = ? WHERE r_id = ?');
  $st->execute(array($status, $rId));

  log_repair_status($pdo, $rId, $status, $note, $byUser);

  if ($status === 'closed') {
    try {
      $st = $pdo->prepare('UPDATE repair SET r_close = 1 WHERE r_id = ?');
      $st->execute(array($rId));
    } catch (Exception $e) { /* ignore */ }
  } elseif ($status !== 'closed') {
    try {
      $st = $pdo->prepare('UPDATE repair SET r_close = 0 WHERE r_id = ?');
      $st->execute(array($rId));
    } catch (Exception $e) { /* ignore */ }
  }

  $st = $pdo->prepare('SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE r_id = ? LIMIT 1');
  $st->execute(array($rId));
  $row = $st->fetch();

  out(array(
    'ok' => true,
    'public_status' => $status,
    'public_status_label' => public_repair_status_label($status),
    'timeline' => get_repair_status_log($pdo, $rId),
    'row' => $row,
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
