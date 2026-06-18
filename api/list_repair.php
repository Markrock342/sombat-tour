<?php
// งานแจ้งซ่อมรายวัน / ช่วงวันที่
//   GET /api/list_repair.php?date=YYYY-MM-DD
//   GET /api/list_repair.php?date=latest
//   GET /api/list_repair.php?start=YYYY-MM-DD&end=YYYY-MM-DD  (ช่วงวันที่ — 1 query เร็วกว่ายิงทีละวัน)
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

function out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

$cols = 'r_id, r_job_num, r_dt_rec, r_close, r_dt_close,
         r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_v_metr,
         r_repair_list, r_work_report, r_mile, r_recorder, r_technician,
         r_inv_com, r_v_company, r_inv_com_id';

try {
  $start = isset($_GET['start']) ? trim($_GET['start']) : '';
  $end   = isset($_GET['end'])   ? trim($_GET['end'])   : '';
  $date  = isset($_GET['date'])  ? trim($_GET['date'])  : '';

  if ($start !== '' && $end !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
      out(['ok' => false, 'error' => 'INVALID_DATE'], 400);
    }
    $st = $pdo->prepare("
      SELECT $cols
      FROM repair
      WHERE DATE(r_dt_rec) BETWEEN ? AND ?
      ORDER BY r_dt_rec DESC
    ");
    $st->execute([$start, $end]);
    $rows = $st->fetchAll();
    out(['ok' => true, 'date' => "$start..$end", 'total' => count($rows), 'rows' => $rows]);
  }

  if ($date === '' || $date === 'latest') {
    $row = $pdo->query('SELECT DATE(MAX(r_dt_rec)) AS d FROM repair')->fetch();
    $date = $row && $row['d'] ? $row['d'] : date('Y-m-d');
  }

  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    out(['ok' => false, 'error' => 'INVALID_DATE'], 400);
  }

  $st = $pdo->prepare("
    SELECT $cols
    FROM repair
    WHERE DATE(r_dt_rec) = ?
    ORDER BY r_dt_rec DESC
  ");
  $st->execute([$date]);
  $rows = $st->fetchAll();
  out(['ok' => true, 'date' => $date, 'total' => count($rows), 'rows' => $rows]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
