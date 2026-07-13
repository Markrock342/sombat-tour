<?php
// POST /api/location_save.php — create/update parking spot (PHP 5.6)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';

try {
  try {
    ensure_schema($pdo);
  } catch (Exception $e) { /* ignore */ }

  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));
  $b = read_json_body();

  $id = isset($b['id']) ? (int)$b['id'] : 0;
  $title = trim((string)pick($b, array('title')));
  if ($title === '') out(array('ok' => false, 'error' => 'MISSING_TITLE'), 400);
  $detail = (string)pick($b, array('detail'));
  $spot = trim((string)pick($b, array('spot')));
  $vId = isset($b['v_id']) ? (int)$b['v_id'] : null;
  $vName = trim((string)pick($b, array('v_name')));
  $now = date('Y-m-d H:i:s');

  // Ensure table (same fallback as list)
  try {
    $chk = $pdo->query("SHOW TABLES LIKE 'vehicle_location'");
    if (!$chk || !$chk->fetch()) {
      $pdo->exec(
        "CREATE TABLE IF NOT EXISTS vehicle_location (
          id INT AUTO_INCREMENT PRIMARY KEY,
          v_id INT DEFAULT NULL,
          v_name VARCHAR(128) DEFAULT '',
          title VARCHAR(255) NOT NULL,
          detail TEXT,
          spot VARCHAR(255) DEFAULT '',
          created_by VARCHAR(128) DEFAULT '',
          created_at DATETIME DEFAULT NULL,
          updated_at DATETIME DEFAULT NULL,
          INDEX (v_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8"
      );
    }
  } catch (Exception $e) {
    out(array('ok' => false, 'error' => 'NO_TABLE', 'message' => $e->getMessage()), 500);
  }

  if ($id > 0) {
    $st = $pdo->prepare(
      'UPDATE vehicle_location SET v_id=?, v_name=?, title=?, detail=?, spot=?, created_by=?, updated_at=? WHERE id=?'
    );
    $st->execute(array($vId ? $vId : null, $vName, $title, $detail, $spot, $user['username'], $now, $id));
    out(array('ok' => true, 'id' => $id));
  }

  $st = $pdo->prepare(
    'INSERT INTO vehicle_location (v_id, v_name, title, detail, spot, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
  );
  $st->execute(array($vId ? $vId : null, $vName, $title, $detail, $spot, $user['username'], $now, $now));
  out(array('ok' => true, 'id' => (int)$pdo->lastInsertId()));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
