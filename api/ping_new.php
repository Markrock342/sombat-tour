<?php
// Simple health check for new API deploy
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$out = [
  'ok' => true,
  'php' => PHP_VERSION,
  'bootstrap' => false,
  'db' => false,
  'message' => '',
];

try {
  require_once __DIR__ . '/bootstrap.php';
  $out['bootstrap'] = true;
} catch (Exception $e) {
  $out['ok'] = false;
  $out['message'] = 'bootstrap: ' . $e->getMessage();
  echo json_encode($out, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  require_once __DIR__ . '/db.php';
  $pdo->query('SELECT 1');
  $out['db'] = true;
  ensure_schema($pdo);
  $out['schema'] = true;
} catch (Exception $e) {
  $out['ok'] = false;
  $out['message'] = 'db: ' . $e->getMessage();
  echo json_encode($out, JSON_UNESCAPED_UNICODE);
  exit;
}

$out['message'] = 'ready';
echo json_encode($out, JSON_UNESCAPED_UNICODE);
