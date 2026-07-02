<?php
// public_html/api/list_repair.php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// --- CORS ชั่วคราวตอนทดสอบ (โปรดล็อกโดเมนจริงในโปรดักชัน) ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json');

require_once __DIR__ . '/db.php'; // ต้องมี $pdo จากไฟล์นี้

// helper
function out($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  // health check เช่น https://425service.vercel.app/api/list_repair.php?health=1
  if (isset($_GET['health'])) {
    if (!isset($pdo)) throw new Exception('PDO not ready');
    out(array('ok' => true, 'msg' => 'alive'));
  }

  // ใช้เวลาไทยฝั่ง PHP เพื่อคำนวณช่วงวัน
  date_default_timezone_set('Asia/Bangkok');

  // (เลือกใช้) limit สำหรับทดสอบ ถ้าวันไหนข้อมูลเยอะมาก
  $limit = 0;
  if (isset($_GET['limit'])) {
    $limit = max(1, min(10000, (int)$_GET['limit']));
  }

  $sql = "
    SELECT
      r_id,
      r_job_num,
      r_dt_rec,
      r_close,
      r_close_dt AS r_dt_close,
      r_job_type,
      r_job_subtype_id,
      r_v_name,
      r_v_plate,
      r_v_chassis,
      r_v_brand,
      r_v_model,
      r_v_metr,
      r_repair_list,
      r_perform_rep AS r_work_report,
      r_mile,
      r_recorder,
      r_technician,
      r_inv_com,
      r_v_company,
      r_inv_com_id
    FROM repair
    WHERE r_dt_rec >= ? AND r_dt_rec < ?
    ORDER BY r_id DESC
  ";
  if ($limit > 0) {
    $sql .= " LIMIT " . $limit;
  }

  // === ช่วงหลายวัน (เพิ่มใหม่) ?start=YYYY-MM-DD&end=YYYY-MM-DD ===
  $rangeStart = isset($_GET['start']) ? trim($_GET['start']) : '';
  $rangeEnd   = isset($_GET['end'])   ? trim($_GET['end'])   : '';
  if ($rangeStart !== '' && $rangeEnd !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $rangeStart) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $rangeEnd)) {
      out(array('ok'=>false,'error'=>'BAD_DATE','message'=>'start/end ต้องเป็น YYYY-MM-DD'), 400);
    }
    $start = $rangeStart . ' 00:00:00';
    $end   = date('Y-m-d', strtotime($rangeEnd . ' +1 day')) . ' 00:00:00';

    $stmtCnt = $pdo->prepare("
      SELECT COUNT(*)
      FROM repair
      WHERE r_dt_rec >= ? AND r_dt_rec < ?
    ");
    $stmtCnt->execute(array($start, $end));
    $total = (int)$stmtCnt->fetchColumn();

    $stmt = $pdo->prepare($sql);
    $stmt->execute(array($start, $end));
    $rows = $stmt->fetchAll();

    out(array('ok'=>true, 'date'=>$rangeStart.'..'.$rangeEnd, 'total'=>$total, 'rows'=>$rows));
  }

  // === รายวัน (เดิม) ?date=YYYY-MM-DD | today | latest ===
  $date = isset($_GET['date']) ? trim($_GET['date']) : date('Y-m-d');
  if ($date === 'today' || $date === '') $date = date('Y-m-d');
  if ($date === 'latest') {
    $latest = $pdo->query("SELECT DATE(MAX(r_dt_rec)) FROM repair")->fetchColumn();
    $date = $latest ? $latest : date('Y-m-d');
  }
  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    out(array('ok'=>false,'error'=>'BAD_DATE','message'=>'date ต้องเป็น YYYY-MM-DD หรือใช้ today/latest'), 400);
  }

  $start = $date . ' 00:00:00';
  $end   = date('Y-m-d', strtotime($date . ' +1 day')) . ' 00:00:00';

  $stmtCnt = $pdo->prepare("
    SELECT COUNT(*)
    FROM repair
    WHERE r_dt_rec >= ? AND r_dt_rec < ?
  ");
  $stmtCnt->execute(array($start, $end));
  $total = (int)$stmtCnt->fetchColumn();

  $stmt = $pdo->prepare($sql);
  $stmt->execute(array($start, $end));
  $rows = $stmt->fetchAll();

  out(array('ok'=>true, 'date'=>$date, 'total'=>$total, 'rows'=>$rows));
} catch (Exception $e) {
  error_log('list_repair (simple-day) ERROR: '.$e->getMessage());
  out(array('ok'=>false, 'error'=>'SERVER_ERROR', 'message'=>$e->getMessage()), 500);
}
