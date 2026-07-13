<?php
// Vehicle parking location
// GET  /api/location_list.php
// POST /api/location_save.php  (create/update)
// POST /api/location_delete.php
require_once __DIR__ . '/bootstrap.php';

$script = basename($_SERVER['SCRIPT_NAME'] ?? 'location_list.php');

if ($script === 'location_list.php' || req_method() === 'GET') {
  cors_headers(['GET', 'OPTIONS']);
  require_once __DIR__ . '/db.php';
  ensure_schema($pdo);
  try {
    $vId = isset($_GET['v_id']) ? (int)$_GET['v_id'] : 0;
    if ($vId > 0) {
      $st = $pdo->prepare("SELECT * FROM vehicle_location WHERE v_id = ? ORDER BY updated_at DESC");
      $st->execute([$vId]);
      $rows = $st->fetchAll();
    } else {
      $rows = $pdo->query("SELECT * FROM vehicle_location ORDER BY updated_at DESC LIMIT 200")->fetchAll();
    }
    out(['ok' => true, 'rows' => $rows]);
  } catch (Throwable $e) {
    out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
  }
}

cors_headers(['POST', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, ['admin', 'staff', 'technician']);
  $b = read_json_body();

  if ($script === 'location_delete.php') {
    $id = (int)($b['id'] ?? 0);
    if ($id <= 0) out(['ok' => false, 'error' => 'MISSING_ID'], 400);
    $st = $pdo->prepare('DELETE FROM vehicle_location WHERE id = ?');
    $st->execute([$id]);
    out(['ok' => true]);
  }

  // location_save.php
  $id = isset($b['id']) ? (int)$b['id'] : 0;
  $title = trim((string)($b['title'] ?? ''));
  if ($title === '') out(['ok' => false, 'error' => 'MISSING_TITLE'], 400);
  $detail = (string)($b['detail'] ?? '');
  $spot = trim((string)($b['spot'] ?? ''));
  $vId = isset($b['v_id']) ? (int)$b['v_id'] : null;
  $vName = trim((string)($b['v_name'] ?? ''));

  if ($id > 0) {
    $st = $pdo->prepare("UPDATE vehicle_location SET v_id=?, v_name=?, title=?, detail=?, spot=?, created_by=? WHERE id=?");
    $st->execute([$vId ?: null, $vName, $title, $detail, $spot, $user['username'], $id]);
    out(['ok' => true, 'id' => $id]);
  }

  $st = $pdo->prepare("INSERT INTO vehicle_location (v_id, v_name, title, detail, spot, created_by) VALUES (?,?,?,?,?,?)");
  $st->execute([$vId ?: null, $vName, $title, $detail, $spot, $user['username']]);
  out(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
