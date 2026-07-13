<?php
// POST /api/delete_image.php — { id } or { image_id } (auth)
// PHP 5.6 compatible (425store.com)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));

  $b = read_json_body();
  $id = (int)pick($b, array('id', 'image_id'));
  if ($id <= 0 && isset($_POST['id'])) $id = (int)$_POST['id'];
  if ($id <= 0) out(array('ok' => false, 'error' => 'MISSING_ID'), 400);

  $st = $pdo->prepare('SELECT id, r_id, path FROM repair_image WHERE id = ? LIMIT 1');
  $st->execute(array($id));
  $row = $st->fetch();
  if (!$row) out(array('ok' => false, 'error' => 'NOT_FOUND'), 404);

  $relPath = str_replace('\\', '/', (string)$row['path']);
  // Only allow deleting files under uploads/repair/
  if ($relPath === '' || strpos($relPath, '..') !== false || strpos($relPath, 'uploads/repair/') !== 0) {
    out(array('ok' => false, 'error' => 'BAD_PATH'), 400);
  }

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

  $del = $pdo->prepare('DELETE FROM repair_image WHERE id = ?');
  $del->execute(array($id));

  out(array(
    'ok' => true,
    'id' => $id,
    'r_id' => (int)$row['r_id'],
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
