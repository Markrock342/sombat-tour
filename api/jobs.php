<?php
// รายการแจ้งซ่อมของช่างคนหนึ่ง ตามวันที่
// GET /api/jobs.php?tech=<t_id>&date=YYYY-MM-DD  (ไม่ส่ง date = วันล่าสุดที่มีข้อมูล)
require __DIR__ . '/db.php';

try {
  $pdo = db();

  $tech = $_GET['tech'] ?? null;
  if ($tech === null || $tech === '') {
    http_response_code(400);
    send_json(['error' => 'missing tech']);
    exit;
  }

  $date = $_GET['date'] ?? null;
  if (!$date) {
    $date = $pdo->query("SELECT DATE(MAX(r_dt_rec)) FROM repair")->fetchColumn();
  }

  $stmt = $pdo->prepare("
    SELECT r_id, r_job_num, r_dt_rec, r_job_type, r_job_subtype,
           r_v_plate, r_v_brand, r_v_model, r_repair_list, r_requestor
    FROM repair
    WHERE r_t_id = :t AND DATE(r_dt_rec) = :d
    ORDER BY r_dt_rec DESC
  ");
  $stmt->execute([':t' => $tech, ':d' => $date]);
  $rows = $stmt->fetchAll();

  $jobs = array_map(function ($r, $i) {
    $vehicle = trim(($r['r_v_plate'] ?? '') . ' ' . ($r['r_v_brand'] ?? '') . ' ' . ($r['r_v_model'] ?? ''));
    return [
      'id' => $i + 1,
      'code' => $r['r_job_num'] ?: ('JOB-' . $r['r_id']),
      'title' => $r['r_job_type'] ?: 'งานแจ้งซ่อม',
      'status' => $r['r_job_subtype'] ?: '-',
      'detail' => trim(($r['r_repair_list'] ?: 'รายละเอียด Job') . ' · ' . $vehicle),
      'datetime' => $r['r_dt_rec'],
    ];
  }, $rows, array_keys($rows));

  send_json(['date' => $date, 'tech' => $tech, 'count' => count($jobs), 'jobs' => $jobs]);
} catch (Throwable $e) {
  http_response_code(500);
  send_json(['error' => $e->getMessage()]);
}
