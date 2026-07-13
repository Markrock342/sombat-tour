<?php
// GET /api/repair_images.php?r_id=
require_once __DIR__ . '/bootstrap.php';
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
