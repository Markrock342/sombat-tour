<?php
// POST /api/repair_create.php — create repair job (auth required)
require_once __DIR__ . '/bootstrap.php';
cors_headers(['POST', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, ['admin', 'staff', 'technician']);

  $b = read_json_body();
  $repairList = trim((string)pick($b, array('r_repair_list', 'repair_list')));
  if ($repairList === '') out(['ok' => false, 'error' => 'MISSING_REPAIR_LIST'], 400);

  $vId = isset($b['v_id']) ? (int)$b['v_id'] : 0;
  $vName = trim((string)pick($b, array('r_v_name', 'v_name')));
  $vPlate = trim((string)pick($b, array('r_v_plate', 'v_plate')));
  $vChassis = trim((string)pick($b, array('r_v_chassis', 'v_chassis')));
  $vBrand = trim((string)pick($b, array('r_v_brand', 'v_brand')));
  $vModel = trim((string)pick($b, array('r_v_model', 'v_model')));
  $vCompany = trim((string)pick($b, array('r_v_company', 'v_company')));
  $invCom = trim((string)pick($b, array('r_inv_com', 'inv_company')));
  $mile = isset($b['r_mile']) ? (int)$b['r_mile'] : (isset($b['mile']) ? (int)$b['mile'] : 0);
  $techName = trim((string)pick($b, array('r_technician', 'technician')));
  $techId = isset($b['r_technician_id']) ? (int)$b['r_technician_id'] : (isset($b['technician_id']) ? (int)$b['technician_id'] : 0);
  $type = trim((string)pick($b, array('r_type', 'type'), 'normal'));
  if (!in_array($type, ['normal', 'breakdown', 'roadside'], true)) $type = 'normal';
  if ($type === 'roadside') $type = 'breakdown';
  $tankM = trim((string)pick($b, array('r_tank_m', 'tank_m')));

  // Enrich from vehicle table if v_id given
  if ($vId > 0) {
    $st = $pdo->prepare("SELECT * FROM vihicle WHERE v_id = ? LIMIT 1");
    $st->execute([$vId]);
    $v = $st->fetch();
    if ($v) {
      if ($vName === '') $vName = (string)((isset($v['v_name']) ? $v['v_name'] : ''));
      if ($vPlate === '') $vPlate = (string)((isset($v['v_plate']) ? $v['v_plate'] : ''));
      if ($vChassis === '') $vChassis = (string)((isset($v['v_chassis']) ? $v['v_chassis'] : ''));
      if ($vBrand === '') $vBrand = (string)((isset($v['v_brand']) ? $v['v_brand'] : ''));
      if ($vModel === '') $vModel = (string)((isset($v['v_model']) ? $v['v_model'] : ''));
      if ($vCompany === '') $vCompany = (string)((isset($v['v_company']) ? $v['v_company'] : ''));
      if ($invCom === '') $invCom = (string)((isset($v['inv_company']) ? $v['inv_company'] : ''));
      if ($tankM === '' && isset($v['v_metr'])) $tankM = (string)$v['v_metr'];
    }
  }

  // Resolve technician name from id if needed
  if ($techId > 0 && $techName === '') {
    try {
      $st = $pdo->prepare("SELECT name FROM technician WHERE id = ? LIMIT 1");
      $st->execute([$techId]);
      $t = $st->fetch();
      if ($t) $techName = $t['name'];
    } catch (Exception $e) { /* table name may differ */ }
  }

  $jobNum = isset($b['r_job_num']) ? (int)$b['r_job_num'] : 0;
  if ($jobNum <= 0) {
    $jobNum = next_repair_job_num($pdo);
  }

  $dt = date('Y-m-d H:i:s');

  // Try insert with extended columns; fall back to core columns
  try {
    $st = $pdo->prepare("
      INSERT INTO repair (
        r_job_num, r_dt_rec, r_close, r_technician, r_technician_id,
        r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
        r_repair_list, r_v_company, r_inv_com, r_type, r_tank_m
      ) VALUES (?,?,0,?,?, ?,?,?,?,?,?, ?,?,?,?,?)
    ");
    $st->execute([
      $jobNum, $dt, $techName, $techId ?: null,
      $vName, $vPlate, $vChassis, $vBrand, $vModel, $mile,
      $repairList, $vCompany, $invCom, $type, $tankM !== '' ? $tankM : null,
    ]);
  } catch (Exception $e) {
    $st = $pdo->prepare("
      INSERT INTO repair (
        r_job_num, r_dt_rec, r_close, r_technician,
        r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
        r_repair_list, r_v_company, r_inv_com
      ) VALUES (?,?,0,?, ?,?,?,?,?,?, ?,?,?)
    ");
    $st->execute([
      $jobNum, $dt, $techName,
      $vName, $vPlate, $vChassis, $vBrand, $vModel, $mile,
      $repairList, $vCompany, $invCom,
    ]);
  }

  $rId = (int)$pdo->lastInsertId();

  out_flush(array(
    'ok' => true,
    'r_id' => $rId,
    'r_job_num' => $jobNum,
    'created_by' => $user['username'],
  ));

  if ($type === 'breakdown') {
    try {
      require_push_lib();
      $label = $vPlate !== '' ? $vPlate : ($vName !== '' ? $vName : ('#' . $jobNum));
      push_notify_staff($pdo, array(
        'title' => 'สมบัติทัวร์ · เสียกลางทาง',
        'body' => $label . ' · ' . $techName,
        'url' => 'https://425service.vercel.app/',
      ));
    } catch (Exception $e) { /* ignore */ }
  }
  exit;
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
