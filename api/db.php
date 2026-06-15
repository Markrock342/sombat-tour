<?php
// ---- กรอกค่าจาก cPanel → MySQL Databases ----
// ชื่อ database เห็นแล้วว่า cp021446_425store
// ต้องมี user ที่มีสิทธิ์ ALL PRIVILEGES บน database นี้ (สร้าง/ผูกใน MySQL Databases)
const DB_HOST = 'localhost';
const DB_NAME = 'cp021446_425store';
const DB_USER = 'cp021446_xxxx';   // <-- แก้
const DB_PASS = 'xxxx';            // <-- แก้

function db() {
  static $pdo = null;
  if ($pdo === null) {
    $pdo = new PDO(
      'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
      DB_USER, DB_PASS,
      [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      ]
    );
  }
  return $pdo;
}

// ส่ง header สำหรับให้แอป (Vercel) เรียกข้ามโดเมนได้
function send_json($data) {
  header('Access-Control-Allow-Origin: *');
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
}
