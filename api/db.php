<?php
// db.php — สร้าง $pdo จาก config.php ให้ API ทุกตัวใช้ร่วมกัน
// (config.php กำหนด $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS)
require_once __DIR__ . '/config.php';

$pdo = new PDO(
  "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
  $DB_USER,
  $DB_PASS,
  [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]
);
