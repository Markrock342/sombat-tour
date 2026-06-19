<?php
// public_html/api/used_parts.php
// รายการเบิกอะไหล่ของงานซ่อม 1 ใบ
//   GET /api/used_parts.php?job_id=120516   → { ok, job_id, total, rows:[...] }
// กรองด้วยคอลัมน์ up_job_id (= r_id ของตาราง repair)
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
  if (isset($_GET['health'])) out(array('ok' => true, 'msg' => 'alive'));

  $jobId = isset($_GET['job_id']) ? trim($_GET['job_id']) : '';
  if ($jobId === '' || !preg_match('/^\d+$/', $jobId)) {
    out(array('ok' => false, 'error' => 'BAD_JOB_ID', 'message' => 'job_id ต้องเป็นตัวเลข'), 400);
  }

  // SELECT * เพื่อให้ทนต่อชื่อคอลัมน์ (ฝั่งแอป map ฟิลด์ที่ต้องใช้เอง)
  // ถ้า up_id ไม่มีจริงในตาราง ให้เปลี่ยน ORDER BY เป็นคอลัมน์ PK ที่ถูกต้อง
  $st = $pdo->prepare("SELECT * FROM used_parts WHERE up_job_id = ? ORDER BY up_id ASC");
  $st->execute(array($jobId));
  $rows = $st->fetchAll();

  out(array('ok' => true, 'job_id' => $jobId, 'total' => count($rows), 'rows' => $rows));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
