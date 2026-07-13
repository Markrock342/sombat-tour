<?php
// POST /api/auth.php  { action: login|logout|me, username, pin }
// GET  /api/auth.php?action=me  (with token)
// Reads the existing user table (read-only) and stores tokens in app_sessions.
// Does NOT modify the existing user table.
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'POST', 'OPTIONS'));
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $body = read_json_body();
  $action = arr_get($body, 'action', arr_get($_GET, 'action', 'login'));

  if ($action === 'me') {
    $user = auth_user($pdo, true);
    out(array('ok' => true, 'user' => $user));
  }

  if ($action === 'logout') {
    // Tokens are stateless (signed, not stored server-side); the client
    // just discards it. Nothing to delete on the server.
    out(array('ok' => true));
  }

  if ($action === 'login') {
    $loginValue = trim((string)pick($body, array('username', 'user', 'name', 'login', 'code')));
    $pin = (string)pick($body, array('pin', 'password', 'pass', 'pwd'));
    if ($loginValue === '' || $pin === '') {
      out(array('ok' => false, 'error' => 'MISSING_CREDENTIALS'), 400);
    }

    $map = users_column_map($pdo);
    if (!$map['login']) {
      out(array(
        'ok' => false,
        'error' => 'USER_SCHEMA_MISMATCH',
        'message' => 'ไม่พบคอลัมน์ชื่อผู้ใช้ในตาราง ' . $map['table'],
        'columns' => $map['columns'],
      ), 500);
    }

    $found = find_user_by_login($pdo, $loginValue);
    $row = $found ? $found['row'] : null;

    if (!$row) {
      out(array('ok' => false, 'error' => 'INVALID_CREDENTIALS'), 401);
    }

    // Same suspension check as the original login.php (member.m_status = 'ON')
    if (isset($row['m_status']) && $row['m_status'] !== '' && $row['m_status'] !== 'ON') {
      out(array('ok' => false, 'error' => 'SUSPENDED', 'message' => 'บัญชีถูกระงับการใช้งาน'), 403);
    }

    if (!verify_user_pin($pin, $row, $map['pin'])) {
      out(array('ok' => false, 'error' => 'INVALID_CREDENTIALS'), 401);
    }

    $user = normalize_user_row($row, $map);
    if ($user['id'] <= 0) {
      out(array('ok' => false, 'error' => 'USER_ID_NOT_FOUND'), 500);
    }

    $sess = session_create($pdo, $user);

    out(array(
      'ok' => true,
      'token' => $sess['token'],
      'expires' => $sess['expires'],
      'user' => $user,
    ));
  }

  out(array('ok' => false, 'error' => 'UNKNOWN_ACTION'), 400);
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
