<?php
// งานประจำวันแต่ละช่าง — จำนวนงาน (repair) ต่อช่าง ตามวันที่
// GET /api/technicians.php?date=YYYY-MM-DD   (ไม่ส่ง date = ใช้วันล่าสุดที่มีข้อมูล)
require __DIR__ . '/db.php';

try {
  $pdo = db();

  $date = $_GET['date'] ?? null;
  if (!$date) {
    $date = $pdo->query("SELECT DATE(MAX(r_dt_rec)) FROM repair")->fetchColumn();
  }

  $stmt = $pdo->prepare("
    SELECT t.t_id AS id,
           t.t_name AS name,
           COUNT(r.r_id) AS today
    FROM technician t
    LEFT JOIN repair r
      ON r.r_t_id = t.t_id AND DATE(r.r_dt_rec) = :d
    WHERE t.t_hide = 0
    GROUP BY t.t_id, t.t_name, t.t_sort
    ORDER BY today DESC, t.t_sort ASC
  ");
  $stmt->execute([':d' => $date]);
  $rows = $stmt->fetchAll();

  // cast ตัวเลขให้เป็น int
  $techs = array_map(function ($r) {
    return ['id' => (string)$r['id'], 'name' => $r['name'], 'today' => (int)$r['today']];
  }, $rows);

  $total = array_sum(array_column($techs, 'today'));
  $active = count(array_filter($techs, fn($t) => $t['today'] > 0));

  send_json([
    'date' => $date,
    'total' => $total,
    'active' => $active,
    'technicians' => $techs,
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  send_json(['error' => $e->getMessage()]);
}
