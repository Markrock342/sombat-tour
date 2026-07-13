-- รันใน phpMyAdmin บนฐาน cp021446_425store (ครั้งเดียว)
-- สำหรับแจ้งซ่อม public + QR ติดตามสถานะ

CREATE TABLE IF NOT EXISTS repair_public_meta (
  r_id INT NOT NULL PRIMARY KEY,
  track_token VARCHAR(64) NOT NULL,
  reporter_name VARCHAR(128) NOT NULL DEFAULT '',
  reporter_phone VARCHAR(32) DEFAULT '',
  public_status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  client_ip VARCHAR(45) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (track_token),
  INDEX (public_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS repair_status_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  r_id INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  note TEXT,
  by_user VARCHAR(128) DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (r_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
