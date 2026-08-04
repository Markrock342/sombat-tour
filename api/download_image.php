<?php
// GET /api/download_image.php?id= — stream repair image for Save (CORS + attachment)
// PHP 5.6 compatible (425store.com)
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
  http_response_code(204);
  exit;
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length');

require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
  if ($id <= 0) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => false, 'error' => 'MISSING_ID'));
    exit;
  }

  $st = $pdo->prepare('SELECT id, r_id, path FROM repair_image WHERE id = ? LIMIT 1');
  $st->execute(array($id));
  $row = $st->fetch();
  if (!$row) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => false, 'error' => 'NOT_FOUND'));
    exit;
  }

  $relPath = str_replace('\\', '/', (string)$row['path']);
  if ($relPath === '' || strpos($relPath, '..') !== false || strpos($relPath, 'uploads/repair/') !== 0) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => false, 'error' => 'BAD_PATH'));
    exit;
  }

  $candidates = array(
    dirname(__DIR__) . '/' . $relPath,
    __DIR__ . '/../' . $relPath,
    __DIR__ . '/' . $relPath,
  );
  $abs = null;
  foreach ($candidates as $p) {
    if (is_file($p)) {
      $abs = $p;
      break;
    }
  }
  if (!$abs) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array('ok' => false, 'error' => 'FILE_MISSING'));
    exit;
  }

  $ext = strtolower(pathinfo($abs, PATHINFO_EXTENSION));
  $mimes = array(
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
  );
  $mime = isset($mimes[$ext]) ? $mimes[$ext] : 'application/octet-stream';
  $filename = 'sombat-repair-' . (int)$row['r_id'] . '-' . (int)$row['id'] . '.' . ($ext ? $ext : 'jpg');

  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($abs));
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  header('Cache-Control: private, max-age=3600');
  readfile($abs);
  exit;
} catch (Exception $e) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()));
  exit;
}
