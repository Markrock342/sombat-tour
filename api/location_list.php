<?php
// GET /api/location_list.php — parking spots (PHP 5.6 safe)
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/db.php';

try {
  try {
    ensure_schema($pdo);
  } catch (Exception $e) {
    /* CREATE may be denied — continue and query/verify */
  }

  $hasTable = false;
  try {
    $chk = $pdo->query("SHOW TABLES LIKE 'vehicle_location'");
    $hasTable = $chk && $chk->fetch();
  } catch (Exception $e) {
    $hasTable = false;
  }

  if (!$hasTable) {
    // Try create once more with simpler DDL for older MySQL
    try {
      $pdo->exec(
        "CREATE TABLE IF NOT EXISTS vehicle_location (
          id INT AUTO_INCREMENT PRIMARY KEY,
          v_id INT DEFAULT NULL,
          v_name VARCHAR(128) DEFAULT '',
          title VARCHAR(255) NOT NULL,
          detail TEXT,
          spot VARCHAR(255) DEFAULT '',
          created_by VARCHAR(128) DEFAULT '',
          created_at DATETIME DEFAULT NULL,
          updated_at DATETIME DEFAULT NULL,
          INDEX (v_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8"
      );
      $hasTable = true;
    } catch (Exception $e) {
      out(array(
        'ok' => false,
        'error' => 'NO_TABLE',
        'message' => 'ยังไม่มีตาราง vehicle_location — ให้สิทธิ์ CREATE หรือสร้างตารางใน phpMyAdmin',
        'detail' => $e->getMessage(),
      ), 500);
    }
  }

  $vId = isset($_GET['v_id']) ? (int)$_GET['v_id'] : 0;
  if ($vId > 0) {
    $st = $pdo->prepare('SELECT * FROM vehicle_location WHERE v_id = ? ORDER BY updated_at DESC, id DESC');
    $st->execute(array($vId));
    $rows = $st->fetchAll();
  } else {
    $st = $pdo->query('SELECT * FROM vehicle_location ORDER BY updated_at DESC, id DESC LIMIT 200');
    $rows = $st ? $st->fetchAll() : array();
  }
  if (!is_array($rows)) $rows = array();
  out(array('ok' => true, 'rows' => $rows));
} catch (Exception $e) {
  out(array('ok' => false, 'error' => 'SERVER_ERROR', 'message' => $e->getMessage()), 500);
}
