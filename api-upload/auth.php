<?php
// POST /api/auth.php  { action: login|logout|me, username, pin }
// GET  /api/auth.php?action=me  (with token)
require_once __DIR__ . '/bootstrap.php';
cors_headers(['GET', 'POST', 'OPTIONS']);
require_once __DIR__ . '/db.php';
ensure_schema($pdo);

try {
  $body = read_json_body();
  $action = $body['action'] ?? ($_GET['action'] ?? 'login');

  if ($action === 'me') {
    $user = auth_user($pdo, true);
    out(['ok' => true, 'user' => $user]);
  }

  if ($action === 'logout') {
    $token = bearer_token();
    if ($token) {
      $st = $pdo->prepare("UPDATE app_users SET token = NULL, token_expires = NULL WHERE token = ?");
      $st->execute([$token]);
    }
    out(['ok' => true]);
  }

  if ($action === 'login') {
    $username = trim((string)($body['username'] ?? ''));
    $pin = (string)($body['pin'] ?? '');
    if ($username === '' || $pin === '') {
      out(['ok' => false, 'error' => 'MISSING_CREDENTIALS'], 400);
    }
    $st = $pdo->prepare("SELECT id, username, pin_hash, role, department FROM app_users WHERE username = ? LIMIT 1");
    $st->execute([$username]);
    $row = $st->fetch();
    if (!$row || !password_verify($pin, $row['pin_hash'])) {
      out(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
    }
    $token = bin2hex(random_bytes(24));
    $expires = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 30);
    $up = $pdo->prepare("UPDATE app_users SET token = ?, token_expires = ? WHERE id = ?");
    $up->execute([$token, $expires, $row['id']]);
    out([
      'ok' => true,
      'token' => $token,
      'expires' => $expires,
      'user' => [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'role' => $row['role'],
        'department' => $row['department'],
      ],
    ]);
  }

  out(['ok' => false, 'error' => 'UNKNOWN_ACTION'], 400);
} catch (Throwable $e) {
  out(['ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()], 500);
}
