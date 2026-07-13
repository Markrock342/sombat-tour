<?php
// ONE-SHOT — ลบงานเทส r_id=124039 (Limitcode / Test)
// เปิด: /api/delete_test_job_124039.php?key=sombat-del-test-once
// แล้วลบไฟล์นี้ออกจากเซิร์ฟเวอร์ทันที
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/db.php';

$rid = 124039;
$key = isset($_GET['key']) ? (string)$_GET['key'] : '';
if ($key !== 'sombat-del-test-once') {
  out(array('ok' => false, 'error' => 'FORBIDDEN', 'hint' => 'add ?key=sombat-del-test-once'), 403);
}

try {
  $st = $pdo->prepare('SELECT r_id, r_job_num, r_repair_list FROM repair WHERE r_id = ? LIMIT 1');
  $st->execute(array($rid));
  $row = $st->fetch();
  if (!$row) {
    out(array('ok' => true, 'deleted' => false, 'message' => 'ไม่พบ r_id=' . $rid . ' (อาจลบไปแล้ว)'));
  }

  $list = (string)$row['r_repair_list'];
  if (stripos($list, 'Limitcode') === false && stripos($list, 'Test') === false) {
    out(array('ok' => false, 'error' => 'REFUSED', 'message' => 'แถวนี้ไม่ใช่งานเทสที่คาดไว้ — ไม่ลบ'), 400);
  }

  $pdo->beginTransaction();
  try { $pdo->prepare('DELETE FROM repair_status_log WHERE r_id = ?')->execute(array($rid)); } catch (Exception $e) {}
  try { $pdo->prepare('DELETE FROM repair_public_meta WHERE r_id = ?')->execute(array($rid)); } catch (Exception $e) {}
  try { $pdo->prepare('DELETE FROM repair_image WHERE r_id = ?')->execute(array($rid)); } catch (Exception $e) {}
  $pdo->prepare('DELETE FROM repair WHERE r_id = ?')->execute(array($rid));
  $pdo->commit();

  out(array(
    'ok' => true,
    'deleted' => true,
    'r_id' => $rid,
    'message' => 'ลบงานเทสแล้ว — ลบไฟล์ delete_test_job_124039.php ออกจากเซิร์ฟเวอร์ทันที',
  ));
} catch (Exception $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
