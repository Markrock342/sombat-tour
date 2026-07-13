<?php
// Shared helpers — compatible with PHP 5.6 (425store.com host)
error_reporting(E_ALL);
ini_set('display_errors', 0);

function cors_headers($methods = array('GET', 'POST', 'OPTIONS')) {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: ' . implode(', ', $methods));
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
  header('Content-Type: application/json; charset=utf-8');
}

/**
 * Recursively drop/replace bytes that are not valid UTF-8, so json_encode()
 * never silently fails (PHP <7.2 has no JSON_INVALID_UTF8_* flags). Some
 * legacy tables on this host store Thai text as TIS-620 / Windows-874,
 * which is invalid UTF-8 and would otherwise make json_encode() return
 * false with zero output.
 */
function utf8_clean($value) {
  if (is_array($value)) {
    $out = array();
    foreach ($value as $k => $v) {
      $out[$k] = utf8_clean($v);
    }
    return $out;
  }
  if (is_string($value)) {
    if (function_exists('mb_check_encoding') && mb_check_encoding($value, 'UTF-8')) {
      return $value;
    }
    $converted = null;
    if (function_exists('iconv')) {
      $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $value);
    }
    if ($converted === null || $converted === false) {
      $converted = function_exists('mb_convert_encoding')
        ? @mb_convert_encoding($value, 'UTF-8', 'UTF-8')
        : preg_replace('/[\x80-\xFF]/', '?', $value);
    }
    return $converted;
  }
  return $value;
}

function out($data, $code = 200) {
  http_response_code($code);
  $flags = defined('JSON_UNESCAPED_UNICODE') ? JSON_UNESCAPED_UNICODE : 0;
  $json = json_encode($data, $flags);
  if ($json === false) {
    $json = json_encode(utf8_clean($data), $flags);
  }
  if ($json === false) {
    $json = json_encode(array('ok' => false, 'error' => 'ENCODING_ERROR', 'json_error' => json_last_error_msg()));
  }
  echo $json;
  exit;
}

/**
 * Echo JSON and flush to the client without exiting, so slow work (curl push)
 * can continue after the browser already received the response.
 */
function out_flush($data, $code = 200) {
  ignore_user_abort(true);
  @set_time_limit(45);
  http_response_code($code);
  header('Connection: close');
  $flags = defined('JSON_UNESCAPED_UNICODE') ? JSON_UNESCAPED_UNICODE : 0;
  $json = json_encode($data, $flags);
  if ($json === false) {
    $json = json_encode(utf8_clean($data), $flags);
  }
  if ($json === false) {
    $json = '{"ok":false,"error":"ENCODING_ERROR"}';
  }
  header('Content-Length: ' . strlen($json));
  echo $json;
  if (function_exists('fastcgi_finish_request')) {
    @fastcgi_finish_request();
  } else {
    while (ob_get_level() > 0) {
      @ob_end_flush();
    }
    @flush();
  }
}

function read_json_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return array();
  $data = json_decode($raw, true);
  return is_array($data) ? $data : array();
}

function req_method() {
  return isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
}

function arr_get($arr, $key, $default = '') {
  return isset($arr[$key]) ? $arr[$key] : $default;
}

function pick($arr, $keys, $default = '') {
  foreach ((array)$keys as $k) {
    if (isset($arr[$k]) && $arr[$k] !== '' && $arr[$k] !== null) {
      return $arr[$k];
    }
  }
  return $default;
}

function bearer_token() {
  $hdr = '';
  if (isset($_SERVER['HTTP_AUTHORIZATION'])) $hdr = $_SERVER['HTTP_AUTHORIZATION'];
  elseif (isset($_SERVER['HTTP_X_AUTH_TOKEN'])) $hdr = $_SERVER['HTTP_X_AUTH_TOKEN'];
  if (preg_match('/Bearer\s+(\S+)/i', $hdr, $m)) return $m[1];
  if ($hdr && strpos($hdr, ' ') === false) return $hdr;
  return isset($_GET['token']) ? trim($_GET['token']) : '';
}

function make_token($bytes = 24) {
  if (function_exists('random_bytes')) {
    return bin2hex(random_bytes($bytes));
  }
  return bin2hex(openssl_random_pseudo_bytes($bytes));
}

/**
 * Compact LIKE pattern — "euro5" matches "EURO 5" / "euro-5".
 * Returns null when compact form equals the raw query (no extra OR needed).
 */
function like_compact($q) {
  $raw = trim((string)$q);
  if ($raw === '') return null;
  $c = preg_replace('/[\s\-_]+/u', '', $raw);
  if ($c === '' || $c === $raw) return null;
  return '%' . $c . '%';
}

/** SQL expr with spaces/hyphens/underscores removed (MySQL). */
function sql_compact_expr($expr) {
  return "REPLACE(REPLACE(REPLACE(COALESCE($expr,''), ' ', ''), '-', ''), '_', '')";
}

/**
 * Append LIKE + optional compact-LIKE OR parts for a text column.
 */
function search_add_text_or(&$parts, &$params, $expr, $like, $likeC) {
  $parts[] = $expr . ' LIKE ?';
  $params[] = $like;
  if ($likeC !== null) {
    $parts[] = sql_compact_expr($expr) . ' LIKE ?';
    $params[] = $likeC;
  }
}

/**
 * Detect image MIME + extension without requiring ext-fileinfo (disabled on
 * some PHP 5.6 cPanel hosts — finfo_open() fatals and kills uploads).
 * Returns array(mime => '...', ext => 'jpg'|...) or null if not an image.
 */
function detect_image_type($tmpPath) {
  $mime = '';
  if (function_exists('finfo_open')) {
    $finfo = @finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
      $mime = (string)@finfo_file($finfo, $tmpPath);
      finfo_close($finfo);
    }
  }
  if ($mime === '' && function_exists('mime_content_type')) {
    $mime = (string)@mime_content_type($tmpPath);
  }
  if ($mime === '' || strpos($mime, 'image/') !== 0) {
    $info = @getimagesize($tmpPath);
    if (is_array($info) && !empty($info['mime'])) {
      $mime = (string)$info['mime'];
    }
  }
  // Magic bytes fallback (PHP 5.6 without GD webp / fileinfo)
  if ($mime === '' || strpos($mime, 'image/') !== 0) {
    $fh = @fopen($tmpPath, 'rb');
    $head = $fh ? @fread($fh, 12) : '';
    if ($fh) fclose($fh);
    if (strlen($head) >= 3 && substr($head, 0, 3) === "\xFF\xD8\xFF") $mime = 'image/jpeg';
    elseif (strlen($head) >= 8 && substr($head, 0, 8) === "\x89PNG\r\n\x1a\n") $mime = 'image/png';
    elseif (strlen($head) >= 6 && (substr($head, 0, 6) === 'GIF87a' || substr($head, 0, 6) === 'GIF89a')) $mime = 'image/gif';
    elseif (strlen($head) >= 12 && substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') $mime = 'image/webp';
  }
  $allowed = array(
    'image/jpeg' => 'jpg',
    'image/jpg' => 'jpg',
    'image/pjpeg' => 'jpg',
    'image/png' => 'png',
    'image/x-png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
  );
  if (!isset($allowed[$mime])) return null;
  return array('mime' => $mime, 'ext' => $allowed[$mime]);
}

function base64url_encode($data) {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
  return base64_decode(strtr($data, '-_', '+/'));
}

/**
 * Secret used to sign session tokens. Derived from the DB password (already
 * a per-install secret in config.php) so no new storage is needed — the API
 * DB user on this host (cp021446_Test01) has write access only to the
 * original tables, so sessions cannot be persisted in a new table.
 */
function session_secret() {
  if (!empty($GLOBALS['DB_PASS'])) {
    return 'sombat_session_v1::' . $GLOBALS['DB_PASS'];
  }
  return 'sombat_session_v1::fallback_static_key_change_me';
}

/**
 * Load push_lib.php safely. Detects wrong uploads (e.g. endpoint file saved as push_lib.php).
 */
function require_push_lib() {
  static $loaded = false;
  if ($loaded) return;
  $path = __DIR__ . '/push_lib.php';
  if (!is_file($path)) {
    out(array(
      'ok' => false,
      'error' => 'MISSING_PUSH_LIB',
      'message' => 'ไม่พบ push_lib.php — อัปจากโฟลเดอร์ api-upload',
    ), 500);
  }
  $raw = @file_get_contents($path);
  if ($raw === false || strpos($raw, 'function push_ensure_table') === false || strpos($raw, 'auth_user') !== false) {
    out(array(
      'ok' => false,
      'error' => 'BAD_PUSH_LIB',
      'message' => 'ไฟล์ push_lib.php บนเซิร์ฟเวอร์ผิดชื่อ/ผิดเนื้อหา — ลบแล้วอัปใหม่จาก api-upload/push_lib.php (ขนาดประมาณ 4–5 KB ไม่ใช่ไฟล์ subscribe)',
    ), 500);
  }
  require_once $path;
  if (!function_exists('push_ensure_table') || !defined('SOMBAT_PUSH_LIB')) {
    out(array(
      'ok' => false,
      'error' => 'BAD_PUSH_LIB',
      'message' => 'โหลด push_lib.php ไม่สำเร็จ — อัปไฟล์ใหม่จาก api-upload',
    ), 500);
  }
  $loaded = true;
}

/**
 * Verify PIN against a user row. Checks the detected pin column (from the
 * schema map) plus common fallbacks, and supports plain / bcrypt / md5 / sha1.
 */
function verify_user_pin($pin, $row, $pinCol = null) {
  if (!$row) return false;
  $pin = (string)$pin;

  $candidates = array();
  if ($pinCol && isset($row[$pinCol])) $candidates[] = $row[$pinCol];
  foreach (array('pin_hash', 'pin', 'password', 'pass', 'pwd', 'pincode') as $c) {
    if (isset($row[$c])) $candidates[] = $row[$c];
  }

  foreach ($candidates as $stored) {
    if ($stored === null) continue;
    $stored = (string)$stored;
    if ($stored === '') continue;

    // bcrypt / modern password_hash (any variant: $2y$, $2a$, $2b$, $2x$)
    if (function_exists('password_verify') && strpos($stored, '$2') === 0) {
      if (password_verify($pin, $stored)) return true;
      continue;
    }
    // plain
    if ($stored === $pin) return true;
    // md5 (32 hex) / sha1 (40 hex)
    if (strlen($stored) === 32 && ctype_xdigit($stored) && strtolower($stored) === md5($pin)) return true;
    if (strlen($stored) === 40 && ctype_xdigit($stored) && strtolower($stored) === sha1($pin)) return true;
  }
  return false;
}

function users_table_name(PDO $pdo) {
  static $name = null;
  if ($name !== null) return $name;
  foreach (array('app_users', 'users', 'user', 'member', 'members') as $t) {
    try {
      $pdo->query("SELECT 1 FROM `$t` LIMIT 1");
      $name = $t;
      return $name;
    } catch (Exception $e) {
      /* try next */
    }
  }
  $name = 'app_users';
  return $name;
}

/**
 * Map real user-table columns (existing DB may not use "username").
 */
function users_column_map(PDO $pdo, $table = null) {
  static $cache = array();
  if ($table === null) $table = users_table_name($pdo);
  if (isset($cache[$table])) return $cache[$table];

  $cols = array();
  try {
    $cols = $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
  } catch (Exception $e) {
    $cols = array();
  }
  $colSet = array_flip($cols);

  $loginCandidates = array(
    'username', 'user_name', 'u_name', 'name', 'login', 'user', 'member',
    'member_name', 'code', 'user_code', 'm_user', 'account', 'email', 'mobile', 'phone',
  );
  $pinCandidates = array(
    'pin', 'pin_hash', 'password', 'pass', 'pwd', 'pincode', 'u_pin', 'm_pin', 'm_pass',
  );
  $idCandidates = array('id', 'user_id', 'u_id', 'member_id', 'm_id');
  $roleCandidates = array('role', 'user_role', 'u_role', 'level', 'type', 'm_level', 'm_status');
  $deptCandidates = array('department', 'dept', 'branch', 'section', 'm_dpr', 'm_branch');

  $map = array(
    'table' => $table,
    'login' => null,
    'pin' => null,
    'id' => null,
    'role' => null,
    'department' => null,
    'columns' => $cols,
  );

  foreach ($loginCandidates as $c) {
    if (isset($colSet[$c])) { $map['login'] = $c; break; }
  }
  foreach ($pinCandidates as $c) {
    if (isset($colSet[$c])) { $map['pin'] = $c; break; }
  }
  foreach ($idCandidates as $c) {
    if (isset($colSet[$c])) { $map['id'] = $c; break; }
  }
  foreach ($roleCandidates as $c) {
    if (isset($colSet[$c])) { $map['role'] = $c; break; }
  }
  foreach ($deptCandidates as $c) {
    if (isset($colSet[$c])) { $map['department'] = $c; break; }
  }

  $cache[$table] = $map;
  return $map;
}

function find_user_by_login(PDO $pdo, $loginValue) {
  $table = users_table_name($pdo);
  $map = users_column_map($pdo, $table);
  if (!$map['login']) {
    throw new Exception('USER_LOGIN_COLUMN_NOT_FOUND');
  }
  $sql = "SELECT * FROM `$table` WHERE `{$map['login']}` = ? LIMIT 1";
  $st = $pdo->prepare($sql);
  $st->execute(array($loginValue));
  $row = $st->fetch();
  if ($row) return array('row' => $row, 'map' => $map);
  return null;
}

function map_member_role($rawRole) {
  $rawRole = (string)$rawRole;
  if ($rawRole === 'admin' || $rawRole === 'staff' || $rawRole === 'technician' || $rawRole === 'viewer') {
    return $rawRole;
  }
  if (is_numeric($rawRole)) {
    $n = (int)$rawRole;
    if ($n >= 99) return 'admin';
    if ($n >= 90) return 'staff';
    if ($n > 0) return 'technician';
    return 'viewer';
  }
  return $rawRole !== '' ? 'technician' : 'viewer';
}

function normalize_user_row($row, $map) {
  $idCol = $map['id'] ? $map['id'] : 'id';
  $loginCol = $map['login'];
  $roleCol = $map['role'];
  $deptCol = $map['department'];

  $rawRole = ($roleCol && isset($row[$roleCol]) && $row[$roleCol] !== '') ? (string)$row[$roleCol] : '';
  $role = map_member_role($rawRole);

  $user = array(
    'id' => isset($row[$idCol]) ? (int)$row[$idCol] : 0,
    'username' => isset($row[$loginCol]) ? (string)$row[$loginCol] : '',
    'role' => $role,
    'level' => $rawRole,
    'department' => ($deptCol && isset($row[$deptCol])) ? (string)$row[$deptCol] : '',
  );

  // Extra display fields kept for parity with the original login.php profile
  foreach (array('fname' => 'm_fname', 'lname' => 'm_lname', 'job' => 'm_job') as $key => $col) {
    if (isset($row[$col])) $user[$key] = (string)$row[$col];
  }

  return $user;
}

/**
 * Ensure helper tables exist. Only CREATEs new tables — never ALTERs any
 * existing table (user table and repair table are left untouched).
 */
function ensure_schema(PDO $pdo) {
  $stmts = array(
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
    "CREATE TABLE IF NOT EXISTS repair_public_meta (
      r_id INT NOT NULL PRIMARY KEY,
      track_token VARCHAR(64) NOT NULL,
      reporter_name VARCHAR(128) NOT NULL DEFAULT '',
      reporter_phone VARCHAR(32) DEFAULT '',
      public_status VARCHAR(32) NOT NULL DEFAULT 'submitted',
      client_ip VARCHAR(45) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY (track_token),
      INDEX (public_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    "CREATE TABLE IF NOT EXISTS repair_status_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      r_id INT NOT NULL,
      status VARCHAR(32) NOT NULL,
      note TEXT,
      by_user VARCHAR(128) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (r_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
  );

  foreach ($stmts as $sql) {
    try {
      $pdo->exec($sql);
    } catch (Exception $e) {
      /* continue */
    }
  }
}

function repair_has_column(PDO $pdo, $col) {
  $set = repair_column_set($pdo);
  return isset($set[$col]);
}

/**
 * Next job number — CAST to number so VARCHAR job nums don't stick at 100000
 * (string MAX prefers values starting with 9 over 100000).
 */
function next_repair_job_num(PDO $pdo) {
  try {
    $n = (int)$pdo->query(
      'SELECT COALESCE(MAX(CAST(r_job_num AS UNSIGNED)), 0) + 1 FROM repair'
    )->fetchColumn();
    if ($n > 0) return $n;
  } catch (Exception $e) { /* fall through */ }
  try {
    $n = (int)$pdo->query(
      'SELECT COALESCE(MAX(r_id), 0) + 1 FROM repair'
    )->fetchColumn();
    if ($n > 0) return $n;
  } catch (Exception $e) { /* fall through */ }
  return (int)(time() % 1000000);
}

/**
 * Stateless session token: base64url(json payload) + '.' + HMAC-SHA256 signature.
 * Requires zero database writes, so it works even though the API's DB user
 * cannot write to new tables.
 */
function session_create($pdo, $user, $ttlSeconds = 2592000) {
  $payload = array(
    'id' => isset($user['id']) ? (int)$user['id'] : 0,
    'username' => isset($user['username']) ? $user['username'] : '',
    'role' => isset($user['role']) ? $user['role'] : 'viewer',
    'department' => isset($user['department']) ? $user['department'] : '',
    'job' => isset($user['job']) ? $user['job'] : '',
    'fname' => isset($user['fname']) ? $user['fname'] : '',
    'lname' => isset($user['lname']) ? $user['lname'] : '',
    'exp' => time() + $ttlSeconds,
  );
  $payloadB64 = base64url_encode(json_encode($payload));
  $sig = hash_hmac('sha256', $payloadB64, session_secret());
  $token = $payloadB64 . '.' . $sig;
  return array('token' => $token, 'expires' => date('Y-m-d H:i:s', $payload['exp']));
}

function verify_session_token($token) {
  if (!$token || strpos($token, '.') === false) return null;
  list($payloadB64, $sig) = explode('.', $token, 2);
  $expected = hash_hmac('sha256', $payloadB64, session_secret());
  if (!hash_equals($expected, $sig)) return null;
  $payload = json_decode(base64url_decode($payloadB64), true);
  if (!is_array($payload)) return null;
  if (!isset($payload['exp']) || (int)$payload['exp'] < time()) return null;
  return $payload;
}

function auth_user($pdo, $required = true) {
  $token = bearer_token();
  $payload = $token !== '' ? verify_session_token($token) : null;
  if (!$payload) {
    if ($required) out(array('ok' => false, 'error' => 'UNAUTHORIZED'), 401);
    return null;
  }
  return array(
    'id' => isset($payload['id']) ? (int)$payload['id'] : 0,
    'username' => isset($payload['username']) ? $payload['username'] : '',
    'role' => map_member_role(isset($payload['role']) ? $payload['role'] : ''),
    'department' => isset($payload['department']) ? $payload['department'] : '',
    'job' => isset($payload['job']) ? (string)$payload['job'] : '',
    'fname' => isset($payload['fname']) ? (string)$payload['fname'] : '',
    'lname' => isset($payload['lname']) ? (string)$payload['lname'] : '',
  );
}

function require_roles($user, $roles) {
  $role = isset($user['role']) ? (string)$user['role'] : '';
  if (!in_array($role, $roles, true)) {
    out(array('ok' => false, 'error' => 'FORBIDDEN'), 403);
  }
}

function repair_column_set(PDO $pdo) {
  static $set = null;
  if ($set !== null) return $set;
  try {
    $cols = $pdo->query("SHOW COLUMNS FROM repair")->fetchAll(PDO::FETCH_COLUMN);
    $set = array_flip($cols);
  } catch (Exception $e) {
    $set = array();
  }
  return $set;
}

function repair_select_cols($pdo = null) {
  $base = array(
    'r_id', 'r_job_num', 'r_dt_rec', 'r_close', 'r_technician',
    'r_v_name', 'r_v_plate', 'r_v_chassis', 'r_v_brand', 'r_v_model', 'r_mile',
    'r_repair_list', 'r_v_company', 'r_inv_com',
  );
  $optional = array(
    'r_technician_id', 'r_type', 'r_tank_m',
    'r_job_subtype_id', 'r_job_type', 'r_dt_close', 'r_close_dt',
    'r_recorder', 'r_work_report', 'r_v_metr',
  );
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

function client_ip() {
  if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    return trim($parts[0]);
  }
  return isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : '';
}

function public_repair_statuses() {
  return array('submitted', 'received', 'assigned', 'in_progress', 'waiting_parts', 'done', 'closed');
}

function public_repair_status_label($status) {
  $map = array(
    'submitted' => 'แจ้งแล้ว',
    'received' => 'รับเรื่องแล้ว',
    'assigned' => 'มอบหมายช่างแล้ว',
    'in_progress' => 'กำลังซ่อม',
    'waiting_parts' => 'รออะไหล่',
    'done' => 'ซ่อมเสร็จ',
    'closed' => 'ปิดงาน',
  );
  $status = (string)$status;
  return isset($map[$status]) ? $map[$status] : $status;
}

function log_repair_status(PDO $pdo, $rId, $status, $note, $byUser) {
  try {
    $st = $pdo->prepare('INSERT INTO repair_status_log (r_id, status, note, by_user) VALUES (?,?,?,?)');
    $st->execute(array((int)$rId, (string)$status, (string)$note, (string)$byUser));
  } catch (Exception $e) { /* ignore */ }
}

function get_repair_public_meta(PDO $pdo, $rId) {
  try {
    $st = $pdo->prepare('SELECT * FROM repair_public_meta WHERE r_id = ? LIMIT 1');
    $st->execute(array((int)$rId));
    return $st->fetch();
  } catch (Exception $e) {
    return null;
  }
}

function get_repair_status_log(PDO $pdo, $rId) {
  try {
    $st = $pdo->prepare('SELECT id, r_id, status, note, by_user, created_at FROM repair_status_log WHERE r_id = ? ORDER BY id ASC');
    $st->execute(array((int)$rId));
    return $st->fetchAll();
  } catch (Exception $e) {
    return array();
  }
}

function public_rate_limit_ok(PDO $pdo, $ip, $maxPerHour = 8) {
  if ($ip === '') return true;
  try {
    $st = $pdo->prepare("SELECT COUNT(*) FROM repair_public_meta WHERE client_ip = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    $st->execute(array($ip));
    return (int)$st->fetchColumn() < (int)$maxPerHour;
  } catch (Exception $e) {
    return true;
  }
}
