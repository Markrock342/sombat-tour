<?php
// POST /api/repair_delete.php — { r_id } — admin/staff only (hard delete)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  // เฉพาะรับเรื่อง/จัดการ — ช่างลบงานไม่ได้
  require_roles($user, array('admin', 'staff'));

  $b = read_json_body();
  $rId = (int)pick($b, array('r_id', 'id'));
  if ($rId <= 0) out(array('ok' => false, 'error' => 'MISSING_ID'), 400);

  $st = $pdo->prepare('SELECT r_id, r_job_num, r_repair_list, r_v_plate, r_v_name FROM repair WHERE r_id = ? LIMIT 1');
  $st->execute(array($rId));
  $row = $st->fetch();
  if (!$row) out(array('ok' => false, 'error' => 'NOT_FOUND', 'message' => 'ไม่พบงานนี้'), 404);

  // Delete image files on disk (best effort)
  try {
    $imgs = $pdo->prepare('SELECT id, path FROM repair_image WHERE r_id = ?');
    $imgs->execute(array($rId));
    while ($img = $imgs->fetch()) {
      $relPath = str_replace('\\', '/', (string)$img['path']);
      if ($relPath === '' || strpos($relPath, '..') !== false) continue;
      if (strpos($relPath, 'uploads/repair/') !== 0) continue;
      $candidates = array(
        dirname(__DIR__) . '/' . $relPath,
        __DIR__ . '/../' . $relPath,
        __DIR__ . '/' . $relPath,
      );
      foreach ($candidates as $abs) {
        if (is_file($abs)) {
          @unlink($abs);
          break;
        }
      }
    }
  } catch (Exception $e) { /* ignore */ }

  $pdo->beginTransaction();
  try {
    try { $pdo->prepare('DELETE FROM repair_status_log WHERE r_id = ?')->execute(array($rId)); } catch (Exception $e) {}
    try { $pdo->prepare('DELETE FROM repair_public_meta WHERE r_id = ?')->execute(array($rId)); } catch (Exception $e) {}
    try { $pdo->prepare('DELETE FROM repair_image WHERE r_id = ?')->execute(array($rId)); } catch (Exception $e) {}
    $pdo->prepare('DELETE FROM repair WHERE r_id = ?')->execute(array($rId));
    $pdo->commit();
  } catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }

  out(array(
    'ok' => true,
    'deleted' => true,
    'r_id' => $rId,
    'r_job_num' => isset($row['r_job_num']) ? $row['r_job_num'] : null,
    'by' => $user['username'],
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
