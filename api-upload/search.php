<?php
// GET /api/search.php?q=...&type=all|repair|vehicle&date_start=&date_end=&technician_id=&status=&limit=&offset=
require_once __DIR__ . '/bootstrap.php';
cors_headers(['GET', 'OPTIONS']);

try {
  require_once __DIR__ . '/db.php';
  ensure_schema($pdo);

  $q = isset($_GET['q']) ? trim($_GET['q']) : '';
  $type = isset($_GET['type']) ? strtolower(trim($_GET['type'])) : 'all';
  if (!in_array($type, ['all', 'repair', 'vehicle'], true)) $type = 'all';
  $dateStart = isset($_GET['date_start']) ? trim($_GET['date_start']) : '';
  $dateEnd = isset($_GET['date_end']) ? trim($_GET['date_end']) : '';
  $techId = isset($_GET['technician_id']) ? trim($_GET['technician_id']) : '';
  $techName = isset($_GET['technician']) ? trim($_GET['technician']) : '';
  $status = isset($_GET['status']) ? strtolower(trim($_GET['status'])) : ''; // open|closed|''
  $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 50;
  $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

  $repairs = [];
  $vehicles = [];
  $hasType = repair_has_column($pdo, 'r_type');
  $hasTechId = repair_has_column($pdo, 'r_technician_id');

  if ($type === 'all' || $type === 'repair') {
    $where = ['1=1'];
    $params = [];

    if ($q !== '') {
      $like = '%' . $q . '%';
      $parts = [
        'CAST(r_id AS CHAR) LIKE ?',
        'CAST(r_job_num AS CHAR) LIKE ?',
        'r_v_name LIKE ?',
        'r_v_plate LIKE ?',
        'r_v_chassis LIKE ?',
        'r_v_brand LIKE ?',
        'r_v_model LIKE ?',
        'r_repair_list LIKE ?',
        'r_technician LIKE ?',
        'r_v_company LIKE ?',
      ];
      $params = array_merge($params, array_fill(0, count($parts), $like));
      if ($hasType) {
        $parts[] = "COALESCE(r_type,'') LIKE ?";
        $params[] = $like;
      }
      $where[] = '(' . implode(' OR ', $parts) . ')';
    }
    if ($dateStart !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStart)) {
      $where[] = 'DATE(r_dt_rec) >= ?';
      $params[] = $dateStart;
    }
    if ($dateEnd !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateEnd)) {
      $where[] = 'DATE(r_dt_rec) <= ?';
      $params[] = $dateEnd;
    }
    if ($techId !== '' && ctype_digit($techId) && $hasTechId) {
      $where[] = 'r_technician_id = ?';
      $params[] = (int)$techId;
    } elseif ($techName !== '') {
      $where[] = 'r_technician = ?';
      $params[] = $techName;
    }
    if ($status === 'open') {
      $where[] = 'COALESCE(r_close, 0) = 0';
    } elseif ($status === 'closed') {
      $where[] = 'COALESCE(r_close, 0) <> 0';
    }

    $sql = 'SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE ' . implode(' AND ', $where)
      . ' ORDER BY r_dt_rec DESC LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $repairs = $st->fetchAll();
  }

  if ($type === 'all' || $type === 'vehicle') {
    if ($q !== '') {
      $like = '%' . $q . '%';
      $st = $pdo->prepare("
        SELECT v_id, v_name, v_plate, v_brand, v_model, v_chassis, v_metr, v_route,
               v_class, v_engine, v_company, inv_company, v_register, v_note
        FROM vihicle
        WHERE CAST(v_id AS CHAR) LIKE ?
           OR v_name LIKE ? OR v_plate LIKE ? OR v_brand LIKE ?
           OR v_model LIKE ? OR v_chassis LIKE ? OR COALESCE(v_note,'') LIKE ?
        ORDER BY v_id DESC
        LIMIT " . (int)$limit . " OFFSET " . (int)$offset
      );
      $st->execute([$like, $like, $like, $like, $like, $like, $like]);
      $vehicles = $st->fetchAll();
    } elseif ($type === 'vehicle') {
      $st = $pdo->query("
        SELECT v_id, v_name, v_plate, v_brand, v_model, v_chassis, v_metr, v_route,
               v_class, v_engine, v_company, inv_company, v_register, v_note
        FROM vihicle ORDER BY v_id DESC LIMIT " . (int)$limit . " OFFSET " . (int)$offset
      );
      $vehicles = $st->fetchAll();
    }
  }

  out([
    'ok' => true,
    'q' => $q,
    'type' => $type,
    'repairs' => $repairs,
    'vehicles' => $vehicles,
    'total' => count($repairs) + count($vehicles),
  ]);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
