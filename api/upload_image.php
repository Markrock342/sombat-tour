<?php
// POST multipart /api/upload_image.php  fields: r_id, image (file)
// GET  /api/repair_images.php?r_id=...
require_once __DIR__ . '/bootstrap.php';

$script = basename((isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : ''));

if ($script === 'repair_images.php') {
  cors_headers(['GET', 'OPTIONS']);
  require_once __DIR__ . '/db.php';
  ensure_schema($pdo);
  try {
    $rId = isset($_GET['r_id']) ? (int)$_GET['r_id'] : 0;
    if ($rId <= 0) out(['ok' => false, 'error' => 'MISSING_R_ID'], 400);
    $st = $pdo->prepare("SELECT id, r_id, path, uploaded_by, created_at FROM repair_image WHERE r_id = ? ORDER BY id DESC");
    $st->execute([$rId]);
    $rows = $st->fetchAll();
    $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
      . '://' . ((isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '425store.com'));
    foreach ($rows as &$r) {
      $r['url'] = $base . '/' . ltrim($r['path'], '/');
    }
    out(['ok' => true, 'rows' => $rows]);
  } catch (Exception $e) {
    out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
  }
}

// upload_image.php
cors_headers(['POST', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, ['admin', 'staff', 'technician', 'viewer']);

  $rId = isset($_POST['r_id']) ? (int)$_POST['r_id'] : 0;
  if ($rId <= 0) out(['ok' => false, 'error' => 'MISSING_R_ID'], 400);
  if (!isset($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
    out(['ok' => false, 'error' => 'MISSING_IMAGE'], 400);
  }

  $file = $_FILES['image'];
  if ($file['error'] !== UPLOAD_ERR_OK) out(['ok' => false, 'error' => 'UPLOAD_ERROR', 'code' => $file['error']], 400);
  if ($file['size'] > 8 * 1024 * 1024) out(['ok' => false, 'error' => 'FILE_TOO_LARGE'], 400);

  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = finfo_file($finfo, $file['tmp_name']);
  finfo_close($finfo);
  $allowed = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
  ];
  if (!isset($allowed[$mime])) out(['ok' => false, 'error' => 'INVALID_TYPE'], 400);

  $relDir = 'uploads/repair/' . $rId;
  $absDir = dirname(__DIR__) . '/' . $relDir;
  if (!is_dir($absDir)) {
    if (!mkdir($absDir, 0755, true) && !is_dir($absDir)) {
      // try under api/
      $absDir = __DIR__ . '/../uploads/repair/' . $rId;
      @mkdir($absDir, 0755, true);
      $relDir = 'uploads/repair/' . $rId;
    }
  }

  $name = make_token(8) . '.' . $allowed[$mime];
  $absPath = rtrim($absDir, '/') . '/' . $name;
  $relPath = $relDir . '/' . $name;

  if (!move_uploaded_file($file['tmp_name'], $absPath)) {
    out(['ok' => false, 'error' => 'MOVE_FAILED'], 500);
  }

  $st = $pdo->prepare("INSERT INTO repair_image (r_id, path, uploaded_by) VALUES (?, ?, ?)");
  $st->execute([$rId, $relPath, $user['username']]);
  $id = (int)$pdo->lastInsertId();

  $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . ((isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '425store.com'));

  out([
    'ok' => true,
    'id' => $id,
    'path' => $relPath,
    'url' => $base . '/' . $relPath,
  ]);
} catch (Exception $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
