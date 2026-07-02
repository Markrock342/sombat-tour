<?php
// ล็อกอินสมาชิก — logic เดียวกับ login_ss.php ของระบบเดิม
//   POST /api/login.php  body: inpUser, inpPass
//   ตรวจ m_status = 'ON' และ password_verify (bcrypt)
// หมายเหตุ: เซิร์ฟเวอร์รัน PHP 5.6 — หลีกเลี่ยง Throwable / null coalescing (??)
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

function out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out(array('ok' => false, 'error' => 'METHOD_NOT_ALLOWED'), 405);
  }

  $inpUser = isset($_POST['inpUser']) ? trim($_POST['inpUser']) : '';
  $inpPass = isset($_POST['inpPass']) ? $_POST['inpPass'] : '';

  if ($inpUser === '' || $inpPass === '') {
    out(array('ok' => false, 'error' => 'INVALID_INPUT', 'message' => 'กรอกข้อมูลไม่ครบ'));
  }

  $st = $pdo->prepare('SELECT * FROM member WHERE m_user = ? LIMIT 1');
  $st->execute(array($inpUser));
  $row = $st->fetch();

  if (!$row) {
    out(array('ok' => false, 'error' => 'NO_USER', 'message' => 'ไม่มีชื่อผู้ใช้นี้'));
  }

  $status = isset($row['m_status']) ? $row['m_status'] : '';
  if ($status !== 'ON') {
    out(array('ok' => false, 'error' => 'SUSPENDED', 'message' => 'ระงับการใช้งาน'));
  }

  if (!password_verify($inpPass, $row['m_pass'])) {
    out(array('ok' => false, 'error' => 'BAD_PASSWORD', 'message' => 'รหัสผ่านไม่ถูกต้อง'));
  }

  out(array(
    'ok' => true,
    'user' => array(
      'id' => $row['m_id'],
      'username' => $row['m_user'],
      'level' => $row['m_level'],
      'fname' => $row['m_fname'],
      'lname' => $row['m_lname'],
      'job' => $row['m_job'],
    ),
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
