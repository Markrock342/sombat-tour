<?php
// GET /api/vehicle_history.php?vehicle=... | v_id=... | v_name=... | v_plate=...
// PHP 5.6 compatible (425store.com)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/db.php';

try {
  try {
    ensure_schema($pdo);
  } catch (Exception $e) {
    /* CREATE may be denied */
  }

  $vehicle = isset($_GET['vehicle']) ? trim($_GET['vehicle']) : '';
  $vId = isset($_GET['v_id']) ? trim($_GET['v_id']) : '';
  $vName = isset($_GET['v_name']) ? trim($_GET['v_name']) : '';
  $vPlate = isset($_GET['v_plate']) ? trim($_GET['v_plate']) : '';
  $limit = isset($_GET['limit']) ? max(1, min(500, (int)$_GET['limit'])) : 100;

  if ($vehicle !== '') {
    if (ctype_digit($vehicle)) $vId = $vehicle;
    else $vName = $vehicle;
  }

  $v = null;
  if ($vId !== '' && ctype_digit($vId)) {
    $st = $pdo->prepare('SELECT * FROM vihicle WHERE v_id = ? LIMIT 1');
    $st->execute(array((int)$vId));
    $v = $st->fetch();
  } elseif ($vName !== '') {
    $st = $pdo->prepare('SELECT * FROM vihicle WHERE v_name = ? LIMIT 1');
    $st->execute(array($vName));
    $v = $st->fetch();
  } elseif ($vPlate !== '') {
    $st = $pdo->prepare('SELECT * FROM vihicle WHERE v_plate = ? LIMIT 1');
    $st->execute(array($vPlate));
    $v = $st->fetch();
  }

  if ($v) {
    if (!empty($v['v_name'])) $vName = (string)$v['v_name'];
    if (!empty($v['v_plate'])) $vPlate = (string)$v['v_plate'];
  }

  if ($vName === '' && $vPlate === '' && !($vId !== '' && ctype_digit($vId))) {
    out(array('ok' => false, 'error' => 'MISSING_VEHICLE'), 400);
  }

  $where = array();
  $params = array();
  if ($vName !== '') {
    $where[] = 'r_v_name = ?';
    $params[] = $vName;
  }
  if ($vPlate !== '') {
    $where[] = 'r_v_plate = ?';
    $params[] = $vPlate;
  }

  if (empty($where)) {
    out(array(
      'ok' => true,
      'vehicle' => $v,
      'total' => 0,
      'rows' => array(),
      'message' => 'รถไม่มีชื่อ/ทะเบียนให้จับคู่ประวัติ',
    ));
  }

  $clause = '(' . implode(' OR ', $where) . ')';
  $sql = 'SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE ' . $clause
    . ' ORDER BY r_dt_rec DESC LIMIT ' . (int)$limit;
  $st = $pdo->prepare($sql);
  if (!$st) {
    out(array('ok' => false, 'error' => 'PREPARE_FAILED'), 500);
  }
  $st->execute($params);
  $rows = $st->fetchAll();
  if (!is_array($rows)) $rows = array();

  out(array(
    'ok' => true,
    'vehicle' => $v,
    'total' => count($rows),
    'rows' => $rows,
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
