<?php
// POST /api/repair_update.php — update / close repair
require_once __DIR__ . '/bootstrap.php';
cors_headers(['POST', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, ['admin', 'staff', 'technician']);

  $b = read_json_body();
  $rId = isset($b['r_id']) ? (int)$b['r_id'] : 0;
  if ($rId <= 0) out(['ok' => false, 'error' => 'MISSING_R_ID'], 400);

  $fields = [];
  $params = [];

  $map = [
    'r_repair_list' => 'r_repair_list',
    'repair_list' => 'r_repair_list',
    'r_technician' => 'r_technician',
    'technician' => 'r_technician',
    'r_technician_id' => 'r_technician_id',
    'technician_id' => 'r_technician_id',
    'r_mile' => 'r_mile',
    'mile' => 'r_mile',
    'r_close' => 'r_close',
    'close' => 'r_close',
    'r_type' => 'r_type',
    'type' => 'r_type',
    'r_tank_m' => 'r_tank_m',
    'tank_m' => 'r_tank_m',
  ];

  $seen = [];
  foreach ($map as $in => $col) {
    if (!array_key_exists($in, $b)) continue;
    if (isset($seen[$col])) continue;
    $seen[$col] = true;
    $fields[] = "$col = ?";
    $params[] = $b[$in];
  }

  if (!$fields) out(['ok' => false, 'error' => 'NO_FIELDS'], 400);

  $params[] = $rId;
  $sql = 'UPDATE repair SET ' . implode(', ', $fields) . ' WHERE r_id = ?';
  $st = $pdo->prepare($sql);
  $st->execute($params);

  $st2 = $pdo->prepare('SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE r_id = ? LIMIT 1');
  $st2->execute([$rId]);
  $row = $st2->fetch();

  out(['ok' => true, 'row' => $row, 'updated_by' => $user['username']]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
