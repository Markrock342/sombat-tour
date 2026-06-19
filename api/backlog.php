<?php
// งานค้างซ่อม (ยังไม่ปิด: r_close = 0) — สะสมข้ามวัน
//   GET /api/backlog.php              → นับงานค้างต่อช่าง  { rows:[{name,pending}], total }
//   GET /api/backlog.php?tech=ช่างหมู  → รายการงานค้างของช่างคนนั้น { rows:[...] }
//   GET /api/backlog.php?tech=        → รายการงานที่ยังไม่ระบุช่าง
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

function out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

try {
  if (isset($_GET['tech'])) {
    $tech = trim($_GET['tech']);
    $limit = isset($_GET['limit']) ? max(1, min(2000, (int)$_GET['limit'])) : 500;

    if ($tech === '') {
      $st = $pdo->prepare("
        SELECT r_id, r_job_num, r_dt_rec, r_close,
               r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
               r_repair_list, r_v_company, r_inv_com
        FROM repair
        WHERE COALESCE(r_close, 0) = 0
          AND (r_technician = '' OR r_technician IS NULL)
        ORDER BY r_dt_rec DESC
        LIMIT $limit
      ");
      $st->execute();
      out(array('ok' => true, 'tech' => '', 'rows' => $st->fetchAll()));
    }

    $st = $pdo->prepare("
      SELECT r_id, r_job_num, r_dt_rec, r_close,
             r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
             r_repair_list, r_v_company, r_inv_com
      FROM repair
      WHERE r_technician = ? AND COALESCE(r_close, 0) = 0
      ORDER BY r_dt_rec DESC
      LIMIT $limit
    ");
    $st->execute(array($tech));
    out(array('ok' => true, 'tech' => $tech, 'rows' => $st->fetchAll()));
  }

  $rows = $pdo->query("
    SELECT r_technician AS name, COUNT(*) AS pending
    FROM repair
    WHERE COALESCE(r_close, 0) = 0
    GROUP BY r_technician
    ORDER BY pending DESC
  ")->fetchAll();

  $rows = array_map(function ($r) {
    return array('name' => $r['name'], 'pending' => (int)$r['pending']);
  }, $rows);
  $total = 0;
  foreach ($rows as $r) { $total += $r['pending']; }

  out(array('ok' => true, 'total' => $total, 'rows' => $rows));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
