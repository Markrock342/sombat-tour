<?php
// งานค้างซ่อม (ยังไม่ปิด) — สะสมข้ามวัน
//   GET backlog.php                         → นับต่อช่าง { rows:[{name,pending}], total }
//   GET backlog.php?tech=ช่างหมู            → งานค้างของช่าง
//   GET backlog.php?jobs=1                  → งานค้างทั้งหมด
//   GET backlog.php?jobs=1&none=1           → งานค้างที่ไม่มีชื่อช่าง
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

function out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

$OPEN = "(r_close IS NULL OR r_close = 0 OR r_close = '0')";
$JOB_COLS = "r_id, r_job_num, r_dt_rec, r_close,
  r_job_type, r_job_subtype_id,
  r_v_name, r_v_plate, r_v_chassis, r_v_brand, r_v_model, r_mile,
  r_repair_list, r_technician, r_v_company, r_inv_com";

try {
  $tech = isset($_GET['tech']) ? trim($_GET['tech']) : '';
  $wantJobs = isset($_GET['jobs']) || $tech !== '' || isset($_GET['none']);
  $none = isset($_GET['none']) && $_GET['none'] !== '' && $_GET['none'] !== '0';

  if ($wantJobs && ($tech !== '' || $none || isset($_GET['jobs']))) {
    $limit = isset($_GET['limit']) ? max(1, min(2000, (int)$_GET['limit'])) : 500;
    $where = array($OPEN);
    $params = array();

    if ($none) {
      $where[] = "(r_technician IS NULL OR r_technician = '')";
    } elseif ($tech !== '') {
      $where[] = 'r_technician = ?';
      $params[] = $tech;
    }

    $sql = 'SELECT ' . $JOB_COLS . ' FROM repair WHERE ' . implode(' AND ', $where)
      . ' ORDER BY r_dt_rec DESC LIMIT ' . (int)$limit;
    $st = $pdo->prepare($sql);
    $st->execute($params);
    out(array(
      'ok' => true,
      'tech' => $none ? '' : $tech,
      'rows' => $st->fetchAll(),
    ));
  }

  $rows = $pdo->query("
    SELECT r_technician AS name, COUNT(*) AS pending
    FROM repair
    WHERE $OPEN
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
