<?php
// ค้นหารถจาก ID รถ (r_v_id) หรือ เบอร์รถ (r_v_name) — ไม่ใช้ทะเบียน
//   GET /api/vehicle.php?q=332         → รายการรถที่ตรง (จัดกลุ่มตาม r_v_id)
//   GET /api/vehicle.php?id=332        → ข้อมูลรถ + ประวัติแจ้งซ่อมของคันนั้น
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
  // ---- ประวัติของรถคันเดียว ----
  if (isset($_GET['id']) && $_GET['id'] !== '') {
    $id = (int)$_GET['id'];
    $st = $pdo->prepare("
      SELECT r_id, r_job_num, r_dt_rec, r_close, r_v_id, r_v_name, r_v_plate,
             r_v_brand, r_v_model, r_v_chassis, r_repair_list, r_technician,
             r_v_company, r_inv_com
      FROM repair
      WHERE r_v_id = ?
      ORDER BY r_dt_rec DESC
      LIMIT 1000
    ");
    $st->execute([$id]);
    $rows = $st->fetchAll();
    $first = isset($rows[0]) ? $rows[0] : null;
    $vehicle = $first ? [
      'id'      => $first['r_v_id'],
      'name'    => $first['r_v_name'],
      'plate'   => $first['r_v_plate'],
      'brand'   => $first['r_v_brand'],
      'model'   => $first['r_v_model'],
      'chassis' => $first['r_v_chassis'],
    ] : null;
    out(['ok' => true, 'vehicle' => $vehicle, 'total' => count($rows), 'rows' => $rows]);
  }

  // ---- ค้นหารถ ----
  $q = isset($_GET['q']) ? trim($_GET['q']) : '';
  if ($q === '') out(['ok' => true, 'rows' => []]);

  $st = $pdo->prepare("
    SELECT r_v_id,
           MAX(r_v_name)  AS name,
           MAX(r_v_plate) AS plate,
           MAX(r_v_brand) AS brand,
           MAX(r_v_model) AS model,
           COUNT(*)       AS jobs,
           MAX(r_dt_rec)  AS last_dt
    FROM repair
    WHERE r_v_id = ? OR r_v_name LIKE ?
    GROUP BY r_v_id
    ORDER BY last_dt DESC
    LIMIT 50
  ");
  $st->execute([(int)$q, '%' . $q . '%']);
  $rows = array_map(function ($r) {
    return [
      'r_v_id' => $r['r_v_id'],
      'name'   => $r['name'],
      'plate'  => $r['plate'],
      'brand'  => $r['brand'],
      'model'  => $r['model'],
      'jobs'   => (int)$r['jobs'],
      'last_dt'=> $r['last_dt'],
    ];
  }, $st->fetchAll());

  out(['ok' => true, 'rows' => $rows]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
