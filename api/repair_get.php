<?php
// GET /api/repair_get.php?id=
require_once __DIR__ . '/bootstrap.php';
cors_headers(['GET', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
  if ($id <= 0) out(['ok' => false, 'error' => 'MISSING_ID'], 400);
  $st = $pdo->prepare('SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE r_id = ? LIMIT 1');
  $st->execute([$id]);
  $row = $st->fetch();
  if (!$row) out(['ok' => false, 'error' => 'NOT_FOUND'], 404);
  out(['ok' => true, 'row' => $row]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
