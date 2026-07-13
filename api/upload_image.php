<?php
// POST multipart /api/upload_image.php — fields: r_id, image (file)
// PHP 5.6 compatible (425store.com)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician', 'viewer'));

  $rId = isset($_POST['r_id']) ? (int)$_POST['r_id'] : 0;
  if ($rId <= 0) out(array('ok' => false, 'error' => 'MISSING_R_ID'), 400);
  if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    out(array('ok' => false, 'error' => 'MISSING_IMAGE'), 400);
  }

  $file = $_FILES['image'];
  if ($file['error'] !== UPLOAD_ERR_OK) {
    out(array('ok' => false, 'error' => 'UPLOAD_ERROR', 'code' => $file['error']), 400);
  }
  if ($file['size'] > 8 * 1024 * 1024) {
    out(array('ok' => false, 'error' => 'FILE_TOO_LARGE'), 400);
  }

  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = finfo_file($finfo, $file['tmp_name']);
  finfo_close($finfo);
  $allowed = array(
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
  );
  if (!isset($allowed[$mime])) out(array('ok' => false, 'error' => 'INVALID_TYPE'), 400);

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

  $name = make_token(8) . '.' . $allowed[$mime];
  $absPath = rtrim($absDir, '/') . '/' . $name;
  $relPath = $relDir . '/' . $name;

  if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    out(array('ok' => false, 'error' => 'MOVE_FAILED', 'message' => 'ย้ายไฟล์อัปโหลดไม่สำเร็จ'), 500);
  }

  $st = $pdo->prepare('INSERT INTO repair_image (r_id, path, uploaded_by) VALUES (?, ?, ?)');
  $st->execute(array($rId, $relPath, $user['username']));
  $id = (int)$pdo->lastInsertId();

  $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '425store.com');

  out(array(
    'ok' => true,
    'id' => $id,
    'path' => $relPath,
    'url' => $base . '/' . ltrim($relPath, '/'),
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
