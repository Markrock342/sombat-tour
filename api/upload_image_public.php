<?php
// POST multipart /api/upload_image_public.php — upload photo with track token (no login)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $rId = isset($_POST['r_id']) ? (int)$_POST['r_id'] : 0;
  $trackToken = isset($_POST['track_token']) ? trim((string)$_POST['track_token']) : '';
  if ($rId <= 0 || $trackToken === '') out(array('ok' => false, 'error' => 'MISSING_PARAMS'), 400);

  $st = $pdo->prepare('SELECT r_id FROM repair_public_meta WHERE r_id = ? AND track_token = ? LIMIT 1');
  $st->execute(array($rId, $trackToken));
  if (!$st->fetch()) out(array('ok' => false, 'error' => 'FORBIDDEN'), 403);

  if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    out(array('ok' => false, 'error' => 'MISSING_IMAGE'), 400);
  }

  $file = $_FILES['image'];
  if ($file['error'] !== UPLOAD_ERR_OK) out(array('ok' => false, 'error' => 'UPLOAD_ERROR', 'code' => $file['error']), 400);
  if ($file['size'] > 8 * 1024 * 1024) out(array('ok' => false, 'error' => 'FILE_TOO_LARGE'), 400);

  $detected = detect_image_type($file['tmp_name']);
  if (!$detected) out(array('ok' => false, 'error' => 'INVALID_TYPE'), 400);

  $relDir = 'uploads/repair/' . $rId;
  $absDir = dirname(__DIR__) . '/' . $relDir;
  if (!is_dir($absDir)) {
    if (!@mkdir($absDir, 0755, true) && !is_dir($absDir)) {
      $absDir = __DIR__ . '/uploads/repair/' . $rId;
      @mkdir($absDir, 0755, true);
      $relDir = 'api/uploads/repair/' . $rId;
    }
  }
  if (!is_dir($absDir) || !is_writable($absDir)) {
    out(array(
      'ok' => false,
      'error' => 'UPLOAD_DIR',
      'message' => 'สร้าง/เขียนโฟลเดอร์ uploads/repair ไม่ได้ — ตรวจ chmod บน cPanel',
      'path' => $absDir,
    ), 500);
  }

  $name = make_token(8) . '.' . $detected['ext'];
  $absPath = rtrim($absDir, '/') . '/' . $name;
  $relPath = $relDir . '/' . $name;

  if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    out(array('ok' => false, 'error' => 'MOVE_FAILED'), 500);
  }

  $reporter = 'public';
  $st = $pdo->prepare('SELECT reporter_name FROM repair_public_meta WHERE r_id = ? LIMIT 1');
  $st->execute(array($rId));
  $m = $st->fetch();
  if ($m && !empty($m['reporter_name'])) $reporter = (string)$m['reporter_name'];

  $st = $pdo->prepare('INSERT INTO repair_image (r_id, path, uploaded_by) VALUES (?, ?, ?)');
  $st->execute(array($rId, $relPath, $reporter));
  $id = (int)$pdo->lastInsertId();

  $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . ((isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '425store.com'));

  out(array(
    'ok' => true,
    'id' => $id,
    'path' => $relPath,
    'url' => $base . '/' . $relPath,
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
