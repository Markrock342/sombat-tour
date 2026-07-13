<?php
// GET /api/repair_tracking.php?r_id= — staff view public meta + timeline
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));

  $rId = isset($_GET['r_id']) ? (int)$_GET['r_id'] : 0;
  if ($rId <= 0) out(array('ok' => false, 'error' => 'MISSING_R_ID'), 400);

  $meta = get_repair_public_meta($pdo, $rId);
  if (!$meta) out(array('ok' => true, 'is_public' => false, 'meta' => null, 'timeline' => array()));

  $timeline = get_repair_status_log($pdo, $rId);
  foreach ($timeline as &$t) {
    $t['status_label'] = public_repair_status_label($t['status']);
  }
  unset($t);

  out(array(
    'ok' => true,
    'is_public' => true,
    'meta' => array(
      'r_id' => (int)$meta['r_id'],
      'track_token' => $meta['track_token'],
      'reporter_name' => $meta['reporter_name'],
      'reporter_phone' => isset($meta['reporter_phone']) ? $meta['reporter_phone'] : '',
      'public_status' => $meta['public_status'],
      'public_status_label' => public_repair_status_label($meta['public_status']),
      'created_at' => isset($meta['created_at']) ? $meta['created_at'] : '',
    ),
    'timeline' => $timeline,
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
