<?php
// Shared helpers for all sombat-tour API endpoints
error_reporting(E_ALL);
ini_set('display_errors', 0);

function cors_headers(array $methods = ['GET', 'POST', 'OPTIONS']) {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: ' . implode(', ', $methods));
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
  header('Content-Type: application/json; charset=utf-8');
}

function out($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function read_json_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function req_method() {
  return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function bearer_token() {
  $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
  if (preg_match('/Bearer\s+(\S+)/i', $hdr, $m)) return $m[1];
  if ($hdr && strpos($hdr, ' ') === false) return $hdr;
  return isset($_GET['token']) ? trim($_GET['token']) : '';
}

/**
 * Ensure optional tables exist (idempotent). Never throws — safe on every request.
 */
function ensure_schema(PDO $pdo) {
  $stmts = [
    "CREATE TABLE IF NOT EXISTS app_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      pin_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'viewer',
      department VARCHAR(128) DEFAULT '',
      token VARCHAR(64) DEFAULT NULL,
      token_expires DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS repair_image (
      id INT AUTO_INCREMENT PRIMARY KEY,
      r_id INT NOT NULL,
      path VARCHAR(512) NOT NULL,
      uploaded_by VARCHAR(128) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (r_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS board (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      department VARCHAR(128) DEFAULT '',
      color VARCHAR(32) DEFAULT '#FFF59D',
      pin TINYINT(1) DEFAULT 0,
      created_by VARCHAR(128) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS vehicle_location (
      id INT AUTO_INCREMENT PRIMARY KEY,
      v_id INT DEFAULT NULL,
      v_name VARCHAR(128) DEFAULT '',
      title VARCHAR(255) NOT NULL,
      detail TEXT,
      spot VARCHAR(255) DEFAULT '',
      created_by VARCHAR(128) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (v_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  ];

  foreach ($stmts as $sql) {
    try {
      $pdo->exec($sql);
    } catch (Throwable $e) {
      // no CREATE privilege / already exists oddly — continue
    }
  }

  // Optional columns on repair (ignore if already exist / permission denied)
  try {
    $cols = $pdo->query("SHOW COLUMNS FROM repair")->fetchAll(PDO::FETCH_COLUMN);
    $colSet = array_flip($cols);
    if (!isset($colSet['r_technician_id'])) {
      $pdo->exec("ALTER TABLE repair ADD COLUMN r_technician_id INT DEFAULT NULL");
    }
    if (!isset($colSet['r_type'])) {
      $pdo->exec("ALTER TABLE repair ADD COLUMN r_type VARCHAR(32) DEFAULT 'normal'");
    }
    if (!isset($colSet['r_tank_m'])) {
      $pdo->exec("ALTER TABLE repair ADD COLUMN r_tank_m VARCHAR(64) DEFAULT NULL");
    }
  } catch (Throwable $e) {
    // Host may not allow ALTER — continue without
  }

  // Seed default admin if empty (PIN 1234 — change after deploy)
  try {
    $n = (int)$pdo->query("SELECT COUNT(*) FROM app_users")->fetchColumn();
    if ($n === 0) {
      $st = $pdo->prepare("INSERT INTO app_users (username, pin_hash, role, department) VALUES (?, ?, 'admin', 'IT')");
      $st->execute(['admin', password_hash('1234', PASSWORD_DEFAULT)]);
    }
  } catch (Throwable $e) {
    // table missing / no privilege
  }
}

/** Whether a repair column exists (cached). */
function repair_has_column(PDO $pdo, $col) {
  $set = repair_column_set($pdo);
  return isset($set[$col]);
}

/**
 * @return array|null user row or null
 */
function auth_user(PDO $pdo, $required = true) {
  $token = bearer_token();
  if ($token === '') {
    if ($required) out(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
    return null;
  }
  $st = $pdo->prepare("SELECT id, username, role, department FROM app_users WHERE token = ? AND (token_expires IS NULL OR token_expires > NOW()) LIMIT 1");
  $st->execute([$token]);
  $user = $st->fetch();
  if (!$user) {
    if ($required) out(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
    return null;
  }
  return $user;
}

function require_roles(array $user, array $roles) {
  if (!in_array($user['role'], $roles, true)) {
    out(['ok' => false, 'error' => 'FORBIDDEN'], 403);
  }
}

function repair_column_set(PDO $pdo) {
  static $set = null;
  if ($set !== null) return $set;
  try {
    $cols = $pdo->query("SHOW COLUMNS FROM repair")->fetchAll(PDO::FETCH_COLUMN);
    $set = array_flip($cols);
  } catch (Throwable $e) {
    $set = [];
  }
  return $set;
}

function repair_select_cols($pdo = null) {
  $base = [
    'r_id', 'r_job_num', 'r_dt_rec', 'r_close', 'r_technician',
    'r_v_name', 'r_v_plate', 'r_v_chassis', 'r_v_brand', 'r_v_model', 'r_mile',
    'r_repair_list', 'r_v_company', 'r_inv_com',
  ];
  $optional = ['r_technician_id', 'r_type', 'r_tank_m'];
  if ($pdo) {
    $set = repair_column_set($pdo);
    foreach ($optional as $c) {
      if (isset($set[$c])) $base[] = $c;
    }
  } else {
    $base = array_merge($base, $optional);
  }
  return implode(', ', $base);
}
