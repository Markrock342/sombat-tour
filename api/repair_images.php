<?php
// GET /api/repair_images.php?r_id=
// PHP 5.6 compatible (425store.com)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $rId = isset($_GET['r_id']) ? (int)$_GET['r_id'] : 0;
  if ($rId <= 0) out(array('ok' => false, 'error' => 'MISSING_R_ID'), 400);

  $st = $pdo->prepare(
    'SELECT id, r_id, path, uploaded_by, created_at FROM repair_image WHERE r_id = ? ORDER BY id DESC'
  );
  $st->execute(array($rId));
  $rows = $st->fetchAll();
  $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '425store.com');
  foreach ($rows as &$r) {
    $r['url'] = $base . '/' . ltrim($r['path'], '/');
  }
  unset($r);
  out(array('ok' => true, 'rows' => $rows));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
