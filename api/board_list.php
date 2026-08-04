<?php
// Board whiteboard CRUD
// GET  /api/board_list.php
// POST /api/board_create.php | board_update.php | board_delete.php
// Compatible with PHP 5.6
require_once __DIR__ . '/bootstrap.php';

$script = basename(isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : 'board_list.php');

function board_db_error_message($e) {
  $msg = $e->getMessage();
  if (stripos($msg, '1142') !== false || stripos($msg, 'denied') !== false) {
    return array(
      'error' => 'DB_PRIVILEGE',
      'message' => 'ฐานข้อมูลยังไม่อนุญาตเข้าถึงตาราง board — ไป cPanel → MySQL Databases → กด Repair Privileges ให้ user ของ API',
    );
  }
  if (stripos($msg, "doesn't exist") !== false || stripos($msg, 'Unknown table') !== false) {
    return array(
      'error' => 'TABLE_MISSING',
      'message' => 'ยังไม่มีตาราง board บนเซิร์ฟเวอร์ — สร้างตารางใน phpMyAdmin หรือรัน schema แล้วกด Repair Privileges',
    );
  }
  return array('error' => 'SERVER_ERROR', 'message' => $msg);
}

if ($script === 'board_list.php' || req_method() === 'GET') {
  cors_headers(array('GET', 'OPTIONS'));
  try {
    require_once __DIR__ . '/db.php';
    try {
      ensure_schema($pdo);
    } catch (Exception $e) {
      /* CREATE may be denied — continue and try SELECT */
    }
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
    unset($r);
    out(array('ok' => true, 'rows' => $rows));
  } catch (Exception $e) {
    $info = board_db_error_message($e);
    out(array('ok' => false, 'error' => $info['error'], 'message' => $info['message']), 500);
  }
}

cors_headers(array('POST', 'OPTIONS'));
try {
  require_once __DIR__ . '/db.php';
  try {
    ensure_schema($pdo);
  } catch (Exception $e) {
    /* ignore */
  }

  $user = auth_user($pdo, true);
  require_roles($user, array('admin', 'staff', 'technician'));
  $b = read_json_body();

  if ($script === 'board_create.php') {
    $title = trim((string)arr_get($b, 'title', ''));
    if ($title === '') out(array('ok' => false, 'error' => 'MISSING_TITLE'), 400);
    $body = (string)arr_get($b, 'body', '');
    $department = trim((string)arr_get($b, 'department', arr_get($user, 'department', '')));
    $color = trim((string)arr_get($b, 'color', '#FFF59D'));
    $pin = !empty($b['pin']) ? 1 : 0;
    $st = $pdo->prepare('INSERT INTO board (title, body, department, color, pin, created_by) VALUES (?,?,?,?,?,?)');
    $st->execute(array($title, $body, $department, $color, $pin, $user['username']));
    out(array('ok' => true, 'id' => (int)$pdo->lastInsertId()));
  }

  if ($script === 'board_update.php') {
    $id = (int)arr_get($b, 'id', 0);
    if ($id <= 0) out(array('ok' => false, 'error' => 'MISSING_ID'), 400);
    $fields = array();
    $params = array();
    foreach (array('title', 'body', 'department', 'color') as $col) {
      if (array_key_exists($col, $b)) {
        $fields[] = "$col = ?";
        $params[] = $b[$col];
      }
    }
    if (array_key_exists('pin', $b)) {
      $fields[] = 'pin = ?';
      $params[] = !empty($b['pin']) ? 1 : 0;
    }
    if (!$fields) out(array('ok' => false, 'error' => 'NO_FIELDS'), 400);
    $params[] = $id;
    $st = $pdo->prepare('UPDATE board SET ' . implode(', ', $fields) . ' WHERE id = ?');
    $st->execute($params);
    out(array('ok' => true, 'id' => $id));
  }

  if ($script === 'board_delete.php') {
    require_roles($user, array('admin', 'staff'));
    $id = (int)arr_get($b, 'id', 0);
    if ($id <= 0) out(array('ok' => false, 'error' => 'MISSING_ID'), 400);
    $st = $pdo->prepare('DELETE FROM board WHERE id = ?');
    $st->execute(array($id));
    out(array('ok' => true, 'id' => $id));
  }

  out(array('ok' => false, 'error' => 'UNKNOWN'), 400);
} catch (Exception $e) {
  $info = board_db_error_message($e);
  out(array('ok' => false, 'error' => $info['error'], 'message' => $info['message']), 500);
}
