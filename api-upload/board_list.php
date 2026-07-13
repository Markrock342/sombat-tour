<?php
// Board whiteboard CRUD
// GET  /api/board_list.php
// POST /api/board_create.php | board_update.php | board_delete.php
require_once __DIR__ . '/bootstrap.php';

$script = basename((isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : 'board_list.php'));

if ($script === 'board_list.php' || req_method() === 'GET') {
  cors_headers(['GET', 'OPTIONS']);
  require_once __DIR__ . '/db.php';
  ensure_schema($pdo);
  try {
    $rows = $pdo->query("
      SELECT id, title, body, department, color, pin, created_by, created_at, updated_at
      FROM board
      ORDER BY pin DESC, updated_at DESC
      LIMIT 200
    ")->fetchAll();
    foreach ($rows as &$r) {
      $r['pin'] = (int)$r['pin'];
      $r['id'] = (int)$r['id'];
    }
    out(['ok' => true, 'rows' => $rows]);
  } catch (Exception $e) {
    out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
  }
}

cors_headers(['POST', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $user = auth_user($pdo, true);
  require_roles($user, ['admin', 'staff', 'technician']);
  $b = read_json_body();

  if ($script === 'board_create.php') {
    $title = trim((string)((isset($b['title']) ? $b['title'] : '')));
    if ($title === '') out(['ok' => false, 'error' => 'MISSING_TITLE'], 400);
    $body = (string)((isset($b['body']) ? $b['body'] : ''));
    $department = trim((string)pick($b, 'department', arr_get($user, 'department', '')));
    $color = trim((string)((isset($b['color']) ? $b['color'] : '#FFF59D')));
    $pin = !empty($b['pin']) ? 1 : 0;
    $st = $pdo->prepare("INSERT INTO board (title, body, department, color, pin, created_by) VALUES (?,?,?,?,?,?)");
    $st->execute([$title, $body, $department, $color, $pin, $user['username']]);
    out(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
  }

  if ($script === 'board_update.php') {
    $id = (int)((isset($b['id']) ? $b['id'] : 0));
    if ($id <= 0) out(['ok' => false, 'error' => 'MISSING_ID'], 400);
    $fields = [];
    $params = [];
    foreach (['title', 'body', 'department', 'color'] as $col) {
      if (array_key_exists($col, $b)) {
        $fields[] = "$col = ?";
        $params[] = $b[$col];
      }
    }
    if (array_key_exists('pin', $b)) {
      $fields[] = 'pin = ?';
      $params[] = !empty($b['pin']) ? 1 : 0;
    }
    if (!$fields) out(['ok' => false, 'error' => 'NO_FIELDS'], 400);
    $params[] = $id;
    $st = $pdo->prepare('UPDATE board SET ' . implode(', ', $fields) . ' WHERE id = ?');
    $st->execute($params);
    out(['ok' => true, 'id' => $id]);
  }

  if ($script === 'board_delete.php') {
    require_roles($user, ['admin', 'staff']);
    $id = (int)((isset($b['id']) ? $b['id'] : 0));
    if ($id <= 0) out(['ok' => false, 'error' => 'MISSING_ID'], 400);
    $st = $pdo->prepare('DELETE FROM board WHERE id = ?');
    $st->execute([$id]);
    out(['ok' => true, 'id' => $id]);
  }

  out(['ok' => false, 'error' => 'UNKNOWN'], 400);
} catch (Exception $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
