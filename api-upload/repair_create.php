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
  $repairList = trim((string)($b['r_repair_list'] ?? $b['repair_list'] ?? ''));
  if ($repairList === '') out(['ok' => false, 'error' => 'MISSING_REPAIR_LIST'], 400);

  $vId = isset($b['v_id']) ? (int)$b['v_id'] : 0;
  $vName = trim((string)($b['r_v_name'] ?? $b['v_name'] ?? ''));
  $vPlate = trim((string)($b['r_v_plate'] ?? $b['v_plate'] ?? ''));
  $vChassis = trim((string)($b['r_v_chassis'] ?? $b['v_chassis'] ?? ''));
  $vBrand = trim((string)($b['r_v_brand'] ?? $b['v_brand'] ?? ''));
  $vModel = trim((string)($b['r_v_model'] ?? $b['v_model'] ?? ''));
  $vCompany = trim((string)($b['r_v_company'] ?? $b['v_company'] ?? ''));
  $invCom = trim((string)($b['r_inv_com'] ?? $b['inv_company'] ?? ''));
  $mile = isset($b['r_mile']) ? (int)$b['r_mile'] : (isset($b['mile']) ? (int)$b['mile'] : 0);
  $techName = trim((string)($b['r_technician'] ?? $b['technician'] ?? ''));
  $techId = isset($b['r_technician_id']) ? (int)$b['r_technician_id'] : (isset($b['technician_id']) ? (int)$b['technician_id'] : 0);
  $type = trim((string)($b['r_type'] ?? $b['type'] ?? 'normal'));
  if (!in_array($type, ['normal', 'breakdown', 'roadside'], true)) $type = 'normal';
  if ($type === 'roadside') $type = 'breakdown';
  $tankM = trim((string)($b['r_tank_m'] ?? $b['tank_m'] ?? ''));

  // Enrich from vehicle table if v_id given
  if ($vId > 0) {
    $st = $pdo->prepare("SELECT * FROM vihicle WHERE v_id = ? LIMIT 1");
    $st->execute([$vId]);
    $v = $st->fetch();
    if ($v) {
      if ($vName === '') $vName = (string)($v['v_name'] ?? '');
      if ($vPlate === '') $vPlate = (string)($v['v_plate'] ?? '');
      if ($vChassis === '') $vChassis = (string)($v['v_chassis'] ?? '');
      if ($vBrand === '') $vBrand = (string)($v['v_brand'] ?? '');
      if ($vModel === '') $vModel = (string)($v['v_model'] ?? '');
      if ($vCompany === '') $vCompany = (string)($v['v_company'] ?? '');
      if ($invCom === '') $invCom = (string)($v['inv_company'] ?? '');
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
    } catch (Throwable $e) { /* table name may differ */ }
  }

  $jobNum = isset($b['r_job_num']) ? (int)$b['r_job_num'] : 0;
  if ($jobNum <= 0) {
    try {
      $jobNum = (int)$pdo->query("SELECT COALESCE(MAX(r_job_num), 0) + 1 FROM repair")->fetchColumn();
    } catch (Throwable $e) {
      $jobNum = (int)(time() % 1000000);
    }
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
  } catch (Throwable $e) {
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
  out(['ok' => true, 'r_id' => $rId, 'r_job_num' => $jobNum, 'created_by' => $user['username']]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
