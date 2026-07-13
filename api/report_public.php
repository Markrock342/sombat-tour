<?php
// POST /api/report_public.php — public repair report (no login)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $b = read_json_body();

  // Honeypot — bots fill hidden fields
  $trap = trim((string)pick($b, array('_website', 'website')));
  if ($trap !== '') out(array('ok' => false, 'error' => 'FORBIDDEN'), 403);

  $ip = client_ip();
  if (!public_rate_limit_ok($pdo, $ip, 8)) {
    out(array('ok' => false, 'error' => 'RATE_LIMIT', 'message' => 'แจ้งบ่อยเกินไป กรุณารอสักครู่'), 429);
  }

  $reporterName = trim((string)pick($b, array('reporter_name', 'r_reporter_name')));
  if ($reporterName === '') out(array('ok' => false, 'error' => 'MISSING_REPORTER'), 400);

  $reporterPhone = preg_replace('/\D+/', '', trim((string)pick($b, array('reporter_phone', 'r_reporter_phone'))));
  if (strlen($reporterPhone) > 10) $reporterPhone = substr($reporterPhone, 0, 10);
  $repairList = trim((string)pick($b, array('r_repair_list', 'repair_list')));
  if ($repairList === '') out(array('ok' => false, 'error' => 'MISSING_REPAIR_LIST'), 400);

  $prefix = '[แจ้งโดย ' . $reporterName . ']';
  if (strpos($repairList, $prefix) !== 0) {
    $repairList = $prefix . "\n" . $repairList;
  }

  $vId = isset($b['v_id']) ? (int)$b['v_id'] : 0;
  $vName = trim((string)pick($b, array('r_v_name', 'v_name')));
  $vPlate = trim((string)pick($b, array('r_v_plate', 'v_plate')));
  $vChassis = trim((string)pick($b, array('r_v_chassis', 'v_chassis')));
  $vBrand = trim((string)pick($b, array('r_v_brand', 'v_brand')));
  $vModel = trim((string)pick($b, array('r_v_model', 'v_model')));
  $vCompany = trim((string)pick($b, array('r_v_company', 'v_company')));
  $invCom = trim((string)pick($b, array('r_inv_com', 'inv_company')));
  $mile = isset($b['r_mile']) ? (int)$b['r_mile'] : (isset($b['mile']) ? (int)$b['mile'] : 0);
  $type = trim((string)pick($b, array('r_type', 'type'), 'normal'));
  if (!in_array($type, array('normal', 'breakdown', 'roadside'), true)) $type = 'normal';
  if ($type === 'roadside') $type = 'breakdown';
  $tankM = trim((string)pick($b, array('r_tank_m', 'tank_m')));

  if ($vId > 0) {
    $st = $pdo->prepare('SELECT * FROM vihicle WHERE v_id = ? LIMIT 1');
    $st->execute(array($vId));
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

  $jobNum = next_repair_job_num($pdo);

  $dt = date('Y-m-d H:i:s');
  $recorder = $reporterName;

  try {
    if (repair_has_column($pdo, 'r_recorder')) {
      $st = $pdo->prepare('
        INSERT INTO repair (
          r_job_num, r_dt_rec, r_close, r_technician, r_recorder,
          r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
          r_repair_list, r_v_company, r_inv_com, r_type, r_tank_m
        ) VALUES (?,?,0,?,?, ?,?,?,?,?,?, ?,?,?,?,?)
      ');
      $st->execute(array(
        $jobNum, $dt, '', $recorder,
        $vName, $vPlate, $vChassis, $vBrand, $vModel, $mile,
        $repairList, $vCompany, $invCom, $type, $tankM !== '' ? $tankM : null,
      ));
    } else {
      throw new Exception('fallback');
    }
  } catch (Exception $e) {
    try {
      $st = $pdo->prepare('
        INSERT INTO repair (
          r_job_num, r_dt_rec, r_close, r_technician,
          r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
          r_repair_list, r_v_company, r_inv_com, r_type, r_tank_m
        ) VALUES (?,?,0,?, ?,?,?,?,?,?, ?,?,?,?,?)
      ');
      $st->execute(array(
        $jobNum, $dt, '',
        $vName, $vPlate, $vChassis, $vBrand, $vModel, $mile,
        $repairList, $vCompany, $invCom, $type, $tankM !== '' ? $tankM : null,
      ));
    } catch (Exception $e2) {
      $st = $pdo->prepare('
        INSERT INTO repair (
          r_job_num, r_dt_rec, r_close, r_technician,
          r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
          r_repair_list, r_v_company, r_inv_com
        ) VALUES (?,?,0,?, ?,?,?,?,?,?, ?,?,?)
      ');
      $st->execute(array(
        $jobNum, $dt, '',
        $vName, $vPlate, $vChassis, $vBrand, $vModel, $mile,
        $repairList, $vCompany, $invCom,
      ));
    }
  }

  $rId = (int)$pdo->lastInsertId();
  $trackToken = make_token(24);

  $st = $pdo->prepare('INSERT INTO repair_public_meta (r_id, track_token, reporter_name, reporter_phone, public_status, client_ip) VALUES (?,?,?,?,?,?)');
  $st->execute(array($rId, $trackToken, $reporterName, $reporterPhone, 'submitted', $ip));

  log_repair_status($pdo, $rId, 'submitted', 'แจ้งซ่อมออนไลน์', $reporterName);

  ignore_user_abort(true);
  out_flush(array(
    'ok' => true,
    'r_id' => $rId,
    'r_job_num' => $jobNum,
    'track_token' => $trackToken,
    'public_status' => 'submitted',
    'public_status_label' => public_repair_status_label('submitted'),
  ));

  // After client already got response — notify desk staff (best effort)
  try {
    require_push_lib();
    $kind = ($type === 'breakdown' || $type === 'roadside') ? 'เสียกลางทาง' : 'แจ้งซ่อม';
    $label = $vPlate !== '' ? $vPlate : ($vName !== '' ? $vName : ('#' . $jobNum));
    push_notify_staff($pdo, array(
      'title' => 'สมบัติทัวร์ · ' . $kind,
      'body' => $label . ' · ' . $reporterName,
      'url' => 'https://425service.vercel.app/',
    ));
  } catch (Exception $e) { /* ignore */ }
  exit;
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
