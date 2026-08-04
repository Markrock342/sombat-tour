<?php
// POST /api/location_delete.php
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));
  $b = read_json_body();
  $id = (int)pick($b, array('id'));
  if ($id <= 0) out(array('ok' => false, 'error' => 'MISSING_ID'), 400);
  $st = $pdo->prepare('DELETE FROM vehicle_location WHERE id = ?');
  $st->execute(array($id));
  out(array('ok' => true));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
