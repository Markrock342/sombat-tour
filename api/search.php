<?php
// GET /api/search.php?q=&type=all|repair|vehicle&status=open|closed&sort=&limit=&offset=
// PHP 5.6 compatible — never reference columns that do not exist
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));

try {
  require_once __DIR__ . '/db.php';
  try {
    ensure_schema($pdo);
  } catch (Exception $e) {
    /* ignore privilege / create failures */
  }

  $q = isset($_GET['q']) ? trim($_GET['q']) : '';
  $type = isset($_GET['type']) ? strtolower(trim($_GET['type'])) : 'all';
  if (!in_array($type, array('all', 'repair', 'vehicle'), true)) $type = 'all';

  $dateStart = isset($_GET['date_start']) ? trim($_GET['date_start']) : '';
  $dateEnd = isset($_GET['date_end']) ? trim($_GET['date_end']) : '';
  $techId = isset($_GET['technician_id']) ? trim($_GET['technician_id']) : '';
  $techName = isset($_GET['technician']) ? trim($_GET['technician']) : '';
  $status = isset($_GET['status']) ? strtolower(trim($_GET['status'])) : '';
  $jobKind = isset($_GET['job_kind']) ? strtolower(trim($_GET['job_kind'])) : ''; // breakdown|normal|''
  $sort = isset($_GET['sort']) ? strtolower(trim($_GET['sort'])) : 'date_desc';
  $limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 50;
  $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

  $repairs = array();
  $vehicles = array();
  $colSet = repair_column_set($pdo);
  $hasType = isset($colSet['r_type']);
  $hasTechId = isset($colSet['r_technician_id']);

  $repairOrder = 'r_dt_rec DESC';
  if ($sort === 'date_asc') $repairOrder = 'r_dt_rec ASC';
  elseif ($sort === 'job_num') $repairOrder = 'r_job_num DESC, r_id DESC';
  elseif ($sort === 'plate') $repairOrder = 'r_v_plate ASC, r_dt_rec DESC';
  elseif ($sort === 'tech') $repairOrder = 'r_technician ASC, r_dt_rec DESC';
  else $repairOrder = 'r_dt_rec DESC';

  $vehicleOrder = 'v_id DESC';
  if ($sort === 'plate') $vehicleOrder = 'v_plate ASC, v_id DESC';
  elseif ($sort === 'name') $vehicleOrder = 'v_name ASC, v_id DESC';
  elseif ($sort === 'date_asc') $vehicleOrder = 'v_id ASC';

  if ($type === 'all' || $type === 'repair') {
    $where = array('1=1');
    $params = array();

    if ($q !== '') {
      $like = '%' . $q . '%';
      $likeC = like_compact($q);
      $parts = array();
      $params = array();
      $parts[] = 'CAST(r_id AS CHAR) LIKE ?';
      $params[] = $like;
      $parts[] = 'CAST(r_job_num AS CHAR) LIKE ?';
      $params[] = $like;
      search_add_text_or($parts, $params, 'r_v_name', $like, $likeC);
      search_add_text_or($parts, $params, 'r_v_plate', $like, $likeC);
      search_add_text_or($parts, $params, 'r_v_chassis', $like, $likeC);
      search_add_text_or($parts, $params, 'r_v_brand', $like, $likeC);
      search_add_text_or($parts, $params, 'r_v_model', $like, $likeC);
      search_add_text_or($parts, $params, 'r_repair_list', $like, $likeC);
      search_add_text_or($parts, $params, 'r_technician', $like, $likeC);
      search_add_text_or($parts, $params, 'r_v_company', $like, $likeC);
      if ($likeC !== null) {
        // brand+model glued: "scaniaeuro5" → SCANIA + EURO 5
        $parts[] = sql_compact_expr("CONCAT(COALESCE(r_v_brand,''), COALESCE(r_v_model,''))") . ' LIKE ?';
        $params[] = $likeC;
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

    // Prefer r_type when present; otherwise match structured text / legacy phrases
    if ($jobKind === 'breakdown') {
      if ($hasType) {
        $where[] = "(r_type = 'breakdown' OR r_type = 'roadside')";
      } else {
        $where[] = "(r_repair_list LIKE ? OR r_repair_list LIKE ?)";
        $params[] = '%เสียกลางทาง%';
        $params[] = '%ประเภท: เสียกลางทาง%';
      }
    } elseif ($jobKind === 'normal' && $hasType) {
      $where[] = "(r_type IS NULL OR r_type = '' OR r_type = 'normal')";
    }

    $sql = 'SELECT ' . repair_select_cols($pdo) . ' FROM repair WHERE ' . implode(' AND ', $where)
      . ' ORDER BY ' . $repairOrder . ' LIMIT ' . (int)$limit . ' OFFSET ' . (int)$offset;
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $repairs = $st->fetchAll();
  }

  if ($type === 'all' || $type === 'vehicle') {
    $vCols = array();
    try {
      $vCols = $pdo->query('SHOW COLUMNS FROM vihicle')->fetchAll(PDO::FETCH_COLUMN);
    } catch (Exception $e) {
      $vCols = array();
    }
    $vSet = array_flip($vCols);
    $selectV = array('v_id', 'v_name', 'v_plate', 'v_brand', 'v_model', 'v_chassis');
    foreach (array('v_metr', 'v_route', 'v_class', 'v_engine', 'v_company', 'inv_company', 'v_register', 'v_note') as $c) {
      if (isset($vSet[$c])) $selectV[] = $c;
    }
    $selectSql = implode(', ', $selectV);

    if ($q !== '') {
      $like = '%' . $q . '%';
      $likeC = like_compact($q);
      $whereV = array();
      $paramsV = array();
      $whereV[] = 'CAST(v_id AS CHAR) LIKE ?';
      $paramsV[] = $like;
      search_add_text_or($whereV, $paramsV, 'v_name', $like, $likeC);
      search_add_text_or($whereV, $paramsV, 'v_plate', $like, $likeC);
      search_add_text_or($whereV, $paramsV, 'v_brand', $like, $likeC);
      search_add_text_or($whereV, $paramsV, 'v_model', $like, $likeC);
      search_add_text_or($whereV, $paramsV, 'v_chassis', $like, $likeC);
      if (isset($vSet['v_note'])) {
        search_add_text_or($whereV, $paramsV, "COALESCE(v_note,'')", $like, $likeC);
      }
      if (isset($vSet['v_class'])) {
        search_add_text_or($whereV, $paramsV, 'v_class', $like, $likeC);
      }
      if (isset($vSet['v_engine'])) {
        search_add_text_or($whereV, $paramsV, 'v_engine', $like, $likeC);
      }
      if (isset($vSet['v_company'])) {
        search_add_text_or($whereV, $paramsV, 'v_company', $like, $likeC);
      }
      if ($likeC !== null) {
        $whereV[] = sql_compact_expr("CONCAT(COALESCE(v_brand,''), COALESCE(v_model,''))") . ' LIKE ?';
        $paramsV[] = $likeC;
      }
      $st = $pdo->prepare("
        SELECT " . $selectSql . "
        FROM vihicle
        WHERE " . implode(' OR ', $whereV) . "
        ORDER BY " . $vehicleOrder . "
        LIMIT " . (int)$limit . " OFFSET " . (int)$offset
      );
      $st->execute($paramsV);
      $vehicles = $st->fetchAll();
    } elseif ($type === 'vehicle') {
      $st = $pdo->query("
        SELECT " . $selectSql . "
        FROM vihicle ORDER BY " . $vehicleOrder . " LIMIT " . (int)$limit . " OFFSET " . (int)$offset
      );
      $vehicles = $st->fetchAll();
    }
  }

  out(array(
    'ok' => true,
    'q' => $q,
    'type' => $type,
    'sort' => $sort,
    'repairs' => $repairs,
    'vehicles' => $vehicles,
    'total' => count($repairs) + count($vehicles),
  ));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
