<?php
// GET /api/breakdown_list.php — roadside / mid-route breakdowns
require_once __DIR__ . '/bootstrap.php';
cors_headers(['GET', 'OPTIONS']);

try {
  require_once __DIR__ . '/db.php';
  ensure_schema($pdo);

  $q = isset($_GET['q']) ? trim($_GET['q']) : '';
  $limit = isset($_GET['limit']) ? max(1, min(300, (int)$_GET['limit'])) : 100;
  $status = isset($_GET['status']) ? strtolower(trim($_GET['status'])) : '';

  $hasType = repair_has_column($pdo, 'r_type');
  $hasTank = repair_has_column($pdo, 'r_tank_m');

  if ($hasType) {
    $where = ["(COALESCE(r_type,'') IN ('breakdown','roadside') OR r_repair_list LIKE '%เสียกลางทาง%')"];
  } else {
    $where = ["(r_repair_list LIKE '%เสียกลางทาง%')"];
  }
  $params = [];

  if ($q !== '') {
    $like = '%' . $q . '%';
    $parts = [
      'CAST(r_id AS CHAR) LIKE ?',
      'CAST(r_job_num AS CHAR) LIKE ?',
      'r_v_name LIKE ?',
      'r_v_plate LIKE ?',
      'r_v_brand LIKE ?',
      'r_v_model LIKE ?',
      'r_technician LIKE ?',
      'r_repair_list LIKE ?',
    ];
    $params = array_merge($params, array_fill(0, count($parts), $like));
    if ($hasTank) {
      $parts[] = "COALESCE(r_tank_m,'') LIKE ?";
      $params[] = $like;
    }
    $where[] = '(' . implode(' OR ', $parts) . ')';
  }
  if ($status === 'open') $where[] = 'COALESCE(r_close, 0) = 0';
  if ($status === 'closed') $where[] = 'COALESCE(r_close, 0) <> 0';

  $sql = 'SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE ' . implode(' AND ', $where)
    . ' ORDER BY r_dt_rec DESC LIMIT ' . (int)$limit;
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll();

  out(['ok' => true, 'total' => count($rows), 'rows' => $rows]);
} catch (Exception $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
