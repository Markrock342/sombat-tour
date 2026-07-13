<?php
// GET /api/vehicle_history.php?vehicle=... | v_id=... | v_name=... | v_plate=...
require_once __DIR__ . '/bootstrap.php';
cors_headers(['GET', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $vehicle = isset($_GET['vehicle']) ? trim($_GET['vehicle']) : '';
  $vId = isset($_GET['v_id']) ? trim($_GET['v_id']) : '';
  $vName = isset($_GET['v_name']) ? trim($_GET['v_name']) : '';
  $vPlate = isset($_GET['v_plate']) ? trim($_GET['v_plate']) : '';
  $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;

  if ($vehicle !== '') {
    if (ctype_digit($vehicle)) $vId = $vehicle;
    else $vName = $vehicle;
  }

  // Resolve vehicle row
  $v = null;
  if ($vId !== '' && ctype_digit($vId)) {
    $st = $pdo->prepare("SELECT * FROM vihicle WHERE v_id = ? LIMIT 1");
    $st->execute([(int)$vId]);
    $v = $st->fetch();
  } elseif ($vName !== '') {
    $st = $pdo->prepare("SELECT * FROM vihicle WHERE v_name = ? LIMIT 1");
    $st->execute([$vName]);
    $v = $st->fetch();
  } elseif ($vPlate !== '') {
    $st = $pdo->prepare("SELECT * FROM vihicle WHERE v_plate = ? LIMIT 1");
    $st->execute([$vPlate]);
    $v = $st->fetch();
  }

  if ($v) {
    $vName = (string)((isset($v['v_name']) ? $v['v_name'] : $vName));
    $vPlate = (string)((isset($v['v_plate']) ? $v['v_plate'] : $vPlate));
  }

  if ($vName === '' && $vPlate === '') {
    out(['ok' => false, 'error' => 'MISSING_VEHICLE'], 400);
  }

  $where = [];
  $params = [];
  if ($vName !== '') {
    $where[] = 'r_v_name = ?';
    $params[] = $vName;
  }
  if ($vPlate !== '') {
    $where[] = 'r_v_plate = ?';
    $params[] = $vPlate;
  }
  $clause = '(' . implode(' OR ', $where) . ')';

  $sql = 'SELECT ' . repair_select_cols($pdo) . " FROM repair WHERE $clause ORDER BY r_dt_rec DESC LIMIT " . (int)$limit;
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll();

  out(['ok' => true, 'vehicle' => $v, 'total' => count($rows), 'rows' => $rows]);
} catch (Exception $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
