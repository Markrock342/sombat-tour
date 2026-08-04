<?php
// GET /api/track.php?token= — public status tracking (read-only)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $token = isset($_GET['token']) ? trim((string)$_GET['token']) : '';
  if ($token === '') out(array('ok' => false, 'error' => 'MISSING_TOKEN'), 400);

  try {
    $st = $pdo->prepare('SELECT * FROM repair_public_meta WHERE track_token = ? LIMIT 1');
    $st->execute(array($token));
    $meta = $st->fetch();
  } catch (Exception $e) {
    out(array(
      'ok' => false,
      'error' => 'SCHEMA_MISSING',
      'message' => 'ตาราง repair_public_meta ยังไม่มี — รัน schema_public_report.sql ใน phpMyAdmin',
    ), 503);
  }
  if (!$meta) out(array('ok' => false, 'error' => 'NOT_FOUND'), 404);

  $rId = (int)$meta['r_id'];
  $st = $pdo->prepare('SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE r_id = ? LIMIT 1');
  $st->execute(array($rId));
  $row = $st->fetch();
  if (!$row) out(array('ok' => false, 'error' => 'NOT_FOUND'), 404);

  $timeline = get_repair_status_log($pdo, $rId);
  foreach ($timeline as &$t) {
    $t['status_label'] = public_repair_status_label($t['status']);
  }
  unset($t);

  $images = array();
  try {
    $st = $pdo->prepare('SELECT id, path, created_at FROM repair_image WHERE r_id = ? ORDER BY id DESC');
    $st->execute(array($rId));
    $images = $st->fetchAll();
    $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
      . '://' . ((isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '425store.com'));
    foreach ($images as &$img) {
      $img['url'] = $base . '/' . ltrim($img['path'], '/');
    }
    unset($img);
  } catch (Exception $e) { /* ignore */ }

  $publicRow = array(
    'r_id' => (int)$row['r_id'],
    'r_job_num' => isset($row['r_job_num']) ? $row['r_job_num'] : '',
    'r_dt_rec' => isset($row['r_dt_rec']) ? $row['r_dt_rec'] : '',
    'r_close' => isset($row['r_close']) ? $row['r_close'] : 0,
    'r_v_name' => isset($row['r_v_name']) ? $row['r_v_name'] : '',
    'r_v_plate' => isset($row['r_v_plate']) ? $row['r_v_plate'] : '',
    'r_v_brand' => isset($row['r_v_brand']) ? $row['r_v_brand'] : '',
    'r_v_model' => isset($row['r_v_model']) ? $row['r_v_model'] : '',
    'r_repair_list' => isset($row['r_repair_list']) ? $row['r_repair_list'] : '',
    'r_type' => isset($row['r_type']) ? $row['r_type'] : '',
    'r_technician' => isset($row['r_technician']) ? $row['r_technician'] : '',
  );

  out(array(
    'ok' => true,
    'track_token' => $token,
    'meta' => array(
      'reporter_name' => $meta['reporter_name'],
      'reporter_phone' => isset($meta['reporter_phone']) ? $meta['reporter_phone'] : '',
      'public_status' => $meta['public_status'],
      'public_status_label' => public_repair_status_label($meta['public_status']),
      'created_at' => isset($meta['created_at']) ? $meta['created_at'] : '',
    ),
    'row' => $publicRow,
    'timeline' => $timeline,
    'images' => $images,
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
