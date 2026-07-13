<?php
/**
 * Web Push helpers — empty-body push with VAPID (PHP 5.6 + openssl).
 * Service worker shows a local notification; no encrypted payload required.
 */
require_once __DIR__ . '/vapid.php';

/** Marker so push_ping / endpoints can detect a correct upload */
define('SOMBAT_PUSH_LIB', '1');

function push_b64url_encode($data) {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/** Convert OpenSSL DER ECDSA signature to JOSE raw R||S (P-256). */
function push_ecdsa_der_to_jose($der) {
  $offset = 0;
  if (strlen($der) < 8 || ord($der[$offset++]) !== 0x30) return null;
  $len = ord($der[$offset++]);
  if ($len & 0x80) {
    $n = $len & 0x7f;
    $offset += $n;
  }
  if (ord($der[$offset++]) !== 0x02) return null;
  $rLen = ord($der[$offset++]);
  $r = substr($der, $offset, $rLen);
  $offset += $rLen;
  if (ord($der[$offset++]) !== 0x02) return null;
  $sLen = ord($der[$offset++]);
  $s = substr($der, $offset, $sLen);
  $r = ltrim($r, "\x00");
  $s = ltrim($s, "\x00");
  $r = str_pad($r, 32, "\x00", STR_PAD_LEFT);
  $s = str_pad($s, 32, "\x00", STR_PAD_LEFT);
  if (strlen($r) !== 32 || strlen($s) !== 32) return null;
  return $r . $s;
}

function push_vapid_jwt($audience) {
  $header = push_b64url_encode('{"typ":"JWT","alg":"ES256"}');
  $payload = push_b64url_encode(json_encode(array(
    'aud' => $audience,
    'exp' => time() + 12 * 3600,
    'sub' => vapid_subject(),
  )));
  $data = $header . '.' . $payload;
  $key = openssl_pkey_get_private(vapid_private_pem());
  if (!$key) return null;
  $ok = openssl_sign($data, $signature, $key, OPENSSL_ALGO_SHA256);
  if (function_exists('openssl_free_key')) @openssl_free_key($key);
  if (!$ok) return null;
  $jose = push_ecdsa_der_to_jose($signature);
  if ($jose === null) return null;
  return $data . '.' . push_b64url_encode($jose);
}

function push_ensure_table(PDO $pdo) {
  try {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS push_subscription (
        id INT AUTO_INCREMENT PRIMARY KEY,
        endpoint_hash CHAR(40) NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR(255) DEFAULT '',
        auth_key VARCHAR(255) DEFAULT '',
        username VARCHAR(128) DEFAULT '',
        role VARCHAR(32) DEFAULT '',
        user_agent VARCHAR(255) DEFAULT '',
        created_at DATETIME DEFAULT NULL,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY (endpoint_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8"
    );
  } catch (Exception $e) {
    /* ignore */
  }
  // Existing installs may lack role column
  try {
    $pdo->exec("ALTER TABLE push_subscription ADD COLUMN role VARCHAR(32) DEFAULT '' AFTER username");
  } catch (Exception $e) {
    /* already exists */
  }
}

/** Desk roles that receive new-job alerts (รับเรื่อง / จัดการ) — not technicians. */
function push_is_desk_role($role) {
  $role = (string)$role;
  return ($role === 'admin' || $role === 'staff');
}

/**
 * True if this username is admin/staff (desk). Caches lookups per request.
 */
function push_username_is_desk(PDO $pdo, $username) {
  static $cache = array();
  $username = trim((string)$username);
  if ($username === '') return false;
  if (isset($cache[$username])) return $cache[$username];

  $ok = false;
  try {
    if (function_exists('find_user_by_login') && function_exists('normalize_user_row')) {
      $found = find_user_by_login($pdo, $username);
      if ($found) {
        $u = normalize_user_row($found['row'], $found['map']);
        $ok = push_is_desk_role(isset($u['role']) ? $u['role'] : '');
      }
    }
  } catch (Exception $e) {
    $ok = false;
  }
  $cache[$username] = $ok;
  return $ok;
}

/**
 * Send empty Web Push to desk staff subscriptions only (admin/staff).
 * $meta: title, body, url (optional hints stored for future; SW uses defaults for empty push)
 */
function push_notify_staff(PDO $pdo, $meta = array()) {
  push_ensure_table($pdo);
  try {
    $rows = $pdo->query('SELECT id, endpoint, username, role FROM push_subscription ORDER BY id DESC LIMIT 200')->fetchAll();
  } catch (Exception $e) {
    // Older schema without role column
    try {
      $rows = $pdo->query('SELECT id, endpoint, username FROM push_subscription ORDER BY id DESC LIMIT 200')->fetchAll();
    } catch (Exception $e2) {
      return array('ok' => false, 'sent' => 0, 'error' => $e2->getMessage());
    }
  }
  if (!$rows) return array('ok' => true, 'sent' => 0, 'skipped' => 'no_subscribers');

  $public = vapid_public_key();
  $sent = 0;
  $failed = 0;
  $skipped = 0;
  $gone = array();

  foreach ($rows as $row) {
    $role = isset($row['role']) ? (string)$row['role'] : '';
    $username = isset($row['username']) ? (string)$row['username'] : '';
    $isDesk = push_is_desk_role($role);
    if (!$isDesk) {
      // Fallback: look up member table (covers old rows without role column)
      $isDesk = push_username_is_desk($pdo, $username);
    }
    if (!$isDesk) {
      $skipped++;
      continue;
    }

    $endpoint = (string)$row['endpoint'];
    if ($endpoint === '') continue;
    $parts = parse_url($endpoint);
    if (empty($parts['scheme']) || empty($parts['host'])) continue;
    $aud = $parts['scheme'] . '://' . $parts['host'];
    $jwt = push_vapid_jwt($aud);
    if (!$jwt) {
      $failed++;
      continue;
    }

    if (!function_exists('curl_init')) {
      $failed++;
      continue;
    }
    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    if (defined('CURL_SSLVERSION_TLSv1_2')) {
      curl_setopt($ch, CURLOPT_SSLVERSION, CURL_SSLVERSION_TLSv1_2);
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
      'TTL: 86400',
      'Urgency: high',
      'Content-Length: 0',
      'Authorization: vapid t=' . $jwt . ', k=' . $public,
    ));
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code >= 200 && $code < 300) {
      $sent++;
    } elseif ($code === 404 || $code === 410) {
      $gone[] = (int)$row['id'];
      $failed++;
    } else {
      $failed++;
    }
  }

  if ($gone) {
    try {
      $in = implode(',', array_map('intval', $gone));
      if ($in !== '') $pdo->exec('DELETE FROM push_subscription WHERE id IN (' . $in . ')');
    } catch (Exception $e) { /* ignore */ }
  }

  return array(
    'ok' => true,
    'sent' => $sent,
    'failed' => $failed,
    'skipped' => $skipped,
    'title' => isset($meta['title']) ? $meta['title'] : '',
  );
}
