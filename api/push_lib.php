<?php
/**
 * Web Push helpers — VAPID + RFC 8291 encrypted payload (aes128gcm) on PHP 5.6.
 *
 * iPhone/Safari (web.push.apple.com) ทิ้ง push ที่ไม่มี payload เข้ารหัส
 * จึงต้องเข้ารหัสจริง: ECDH P-256 ทำเองผ่าน GMP/bcmath (โฮสต์นี้ไม่มี
 * openssl_pkey_derive) และ AES-128-GCM ประกอบจาก AES-ECB + GHASH
 * (openssl บน PHP 5.6 ไม่รองรับ GCM) ถ้าโฮสต์ไม่มีทั้ง GMP และ bcmath
 * จะถอยไปส่ง push ตัวเปล่าแบบเดิม (Android ยังเด้ง แต่ iPhone จะเงียบ)
 */
require_once __DIR__ . '/vapid.php';

/** Marker so push_ping / endpoints can detect a correct upload */
define('SOMBAT_PUSH_LIB', '2');

function push_b64url_encode($data) {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function push_b64url_decode($data) {
  $data = strtr((string)$data, '-_', '+/');
  $pad = strlen($data) % 4;
  if ($pad) $data .= str_repeat('=', 4 - $pad);
  $out = base64_decode($data, true);
  return $out === false ? '' : $out;
}

/* ---------------------------------------------------------------------------
 * Big integers — GMP when available, else bcmath (both are C extensions;
 * values are opaque: GMP objects or decimal strings).
 * ------------------------------------------------------------------------- */

function push_bi_backend() {
  if (isset($GLOBALS['SOMBAT_PUSH_FORCE_BACKEND'])) {
    return $GLOBALS['SOMBAT_PUSH_FORCE_BACKEND'];
  }
  static $b = null;
  if ($b !== null) return $b;
  if (extension_loaded('gmp')) $b = 'gmp';
  elseif (function_exists('bcadd')) $b = 'bc';
  else $b = '';
  return $b;
}

function push_bi_from_hex($hex) {
  $hex = strtolower(ltrim((string)$hex, '0'));
  if ($hex === '') $hex = '0';
  if (push_bi_backend() === 'gmp') return gmp_init($hex, 16);
  $dec = '0';
  $map = array(
    '0' => '0', '1' => '1', '2' => '2', '3' => '3', '4' => '4', '5' => '5',
    '6' => '6', '7' => '7', '8' => '8', '9' => '9', 'a' => '10', 'b' => '11',
    'c' => '12', 'd' => '13', 'e' => '14', 'f' => '15',
  );
  for ($i = 0; $i < strlen($hex); $i++) {
    if (!isset($map[$hex[$i]])) return '0';
    $dec = bcadd(bcmul($dec, '16', 0), $map[$hex[$i]], 0);
  }
  return $dec;
}

function push_bi_from_bin($bin) {
  return push_bi_from_hex(bin2hex($bin));
}

/** Fixed 32-byte big-endian export. */
function push_bi_to_bin32($x) {
  if (push_bi_backend() === 'gmp') {
    $h = gmp_strval($x, 16);
  } else {
    $h = '';
    $digits = '0123456789abcdef';
    while (bccomp($x, '0') > 0) {
      $r = (int)bcmod($x, '16');
      $h = $digits[$r] . $h;
      $x = bcdiv($x, '16', 0);
    }
    if ($h === '') $h = '0';
  }
  if (strlen($h) % 2) $h = '0' . $h;
  $bin = pack('H*', $h);
  if (strlen($bin) > 32) return null;
  return str_pad($bin, 32, "\x00", STR_PAD_LEFT);
}

function push_bi_addm($a, $b, $m) {
  if (push_bi_backend() === 'gmp') return gmp_mod(gmp_add($a, $b), $m);
  return bcmod(bcadd($a, $b, 0), $m);
}

function push_bi_subm($a, $b, $m) {
  if (push_bi_backend() === 'gmp') return gmp_mod(gmp_sub($a, $b), $m);
  $r = bcmod(bcsub($a, $b, 0), $m);
  if (bccomp($r, '0') < 0) $r = bcadd($r, $m, 0);
  return $r;
}

function push_bi_mulm($a, $b, $m) {
  if (push_bi_backend() === 'gmp') return gmp_mod(gmp_mul($a, $b), $m);
  return bcmod(bcmul($a, $b, 0), $m);
}

function push_bi_powm($a, $e, $m) {
  if (push_bi_backend() === 'gmp') return gmp_powm($a, $e, $m);
  return bcpowmod($a, $e, $m);
}

function push_bi_cmp($a, $b) {
  if (push_bi_backend() === 'gmp') return gmp_cmp($a, $b);
  return bccomp($a, $b);
}

function push_bi_iszero($x) {
  if (push_bi_backend() === 'gmp') return gmp_cmp($x, 0) === 0;
  return bccomp($x, '0') === 0;
}

/* ---------------------------------------------------------------------------
 * NIST P-256 (secp256r1) — Jacobian coordinates, double-and-add.
 * ------------------------------------------------------------------------- */

function push_p256() {
  static $cache = array();
  $k = push_bi_backend();
  if ($k === '') return null;
  if (isset($cache[$k])) return $cache[$k];
  $cache[$k] = array(
    'p' => push_bi_from_hex('ffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    'n' => push_bi_from_hex('ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
    'b' => push_bi_from_hex('5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b'),
    'gx' => push_bi_from_hex('6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
    'gy' => push_bi_from_hex('4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
    'one' => push_bi_from_hex('1'),
    'two' => push_bi_from_hex('2'),
    'three' => push_bi_from_hex('3'),
    'four' => push_bi_from_hex('4'),
    'eight' => push_bi_from_hex('8'),
    'pm2' => push_bi_from_hex('ffffffff00000001000000000000000000000000fffffffffffffffffffffffd'),
  );
  return $cache[$k];
}

/** Jacobian doubling (a = -3). Point = array(X, Y, Z); null = infinity. */
function push_ec_double($pt, $c) {
  if ($pt === null) return null;
  $p = $c['p'];
  list($X, $Y, $Z) = $pt;
  if (push_bi_iszero($Y)) return null;
  $delta = push_bi_mulm($Z, $Z, $p);
  $gamma = push_bi_mulm($Y, $Y, $p);
  $beta = push_bi_mulm($X, $gamma, $p);
  $alpha = push_bi_mulm(
    $c['three'],
    push_bi_mulm(push_bi_subm($X, $delta, $p), push_bi_addm($X, $delta, $p), $p),
    $p
  );
  $X3 = push_bi_subm(push_bi_mulm($alpha, $alpha, $p), push_bi_mulm($c['eight'], $beta, $p), $p);
  $YZ = push_bi_addm($Y, $Z, $p);
  $Z3 = push_bi_subm(push_bi_subm(push_bi_mulm($YZ, $YZ, $p), $gamma, $p), $delta, $p);
  $Y3 = push_bi_subm(
    push_bi_mulm($alpha, push_bi_subm(push_bi_mulm($c['four'], $beta, $p), $X3, $p), $p),
    push_bi_mulm($c['eight'], push_bi_mulm($gamma, $gamma, $p), $p),
    $p
  );
  return array($X3, $Y3, $Z3);
}

/** General Jacobian addition. */
function push_ec_add($P, $Q, $c) {
  if ($P === null) return $Q;
  if ($Q === null) return $P;
  $p = $c['p'];
  list($X1, $Y1, $Z1) = $P;
  list($X2, $Y2, $Z2) = $Q;
  $Z1Z1 = push_bi_mulm($Z1, $Z1, $p);
  $Z2Z2 = push_bi_mulm($Z2, $Z2, $p);
  $U1 = push_bi_mulm($X1, $Z2Z2, $p);
  $U2 = push_bi_mulm($X2, $Z1Z1, $p);
  $S1 = push_bi_mulm(push_bi_mulm($Y1, $Z2, $p), $Z2Z2, $p);
  $S2 = push_bi_mulm(push_bi_mulm($Y2, $Z1, $p), $Z1Z1, $p);
  if (push_bi_cmp($U1, $U2) === 0) {
    if (push_bi_cmp($S1, $S2) !== 0) return null;
    return push_ec_double($P, $c);
  }
  $H = push_bi_subm($U2, $U1, $p);
  $H2 = push_bi_addm($H, $H, $p);
  $I = push_bi_mulm($H2, $H2, $p);
  $J = push_bi_mulm($H, $I, $p);
  $r = push_bi_addm(push_bi_subm($S2, $S1, $p), push_bi_subm($S2, $S1, $p), $p);
  $V = push_bi_mulm($U1, $I, $p);
  $X3 = push_bi_subm(push_bi_subm(push_bi_mulm($r, $r, $p), $J, $p), push_bi_addm($V, $V, $p), $p);
  $S1J2 = push_bi_mulm($c['two'], push_bi_mulm($S1, $J, $p), $p);
  $Y3 = push_bi_subm(push_bi_mulm($r, push_bi_subm($V, $X3, $p), $p), $S1J2, $p);
  $ZZ = push_bi_addm($Z1, $Z2, $p);
  $Z3 = push_bi_mulm(
    push_bi_subm(push_bi_subm(push_bi_mulm($ZZ, $ZZ, $p), $Z1Z1, $p), $Z2Z2, $p),
    $H,
    $p
  );
  return array($X3, $Y3, $Z3);
}

/**
 * Scalar multiply: 32-byte big-endian scalar × affine point (x,y bigints).
 * Returns affine array(x, y) or null.
 */
function push_ec_mul($scalarBin, $ax, $ay) {
  $c = push_p256();
  if (!$c) return null;
  $p = $c['p'];
  $base = array($ax, $ay, $c['one']);
  $R = null;
  for ($i = 0; $i < 32; $i++) {
    $byte = ord($scalarBin[$i]);
    for ($mask = 0x80; $mask; $mask >>= 1) {
      $R = push_ec_double($R, $c);
      if ($byte & $mask) $R = push_ec_add($R, $base, $c);
    }
  }
  if ($R === null) return null;
  list($X, $Y, $Z) = $R;
  if (push_bi_iszero($Z)) return null;
  $zinv = push_bi_powm($Z, $c['pm2'], $p);
  $zinv2 = push_bi_mulm($zinv, $zinv, $p);
  $x = push_bi_mulm($X, $zinv2, $p);
  $y = push_bi_mulm($Y, push_bi_mulm($zinv2, $zinv, $p), $p);
  return array($x, $y);
}

/** y^2 == x^3 - 3x + b (mod p) */
function push_ec_on_curve($x, $y) {
  $c = push_p256();
  if (!$c) return false;
  $p = $c['p'];
  $lhs = push_bi_mulm($y, $y, $p);
  $rhs = push_bi_addm(
    push_bi_subm(
      push_bi_mulm(push_bi_mulm($x, $x, $p), $x, $p),
      push_bi_mulm($c['three'], $x, $p),
      $p
    ),
    $c['b'],
    $p
  );
  return push_bi_cmp($lhs, $rhs) === 0;
}

/** Random scalar in [1, n-1] as 32-byte string. */
function push_ec_random_priv() {
  $c = push_p256();
  if (!$c) return null;
  for ($i = 0; $i < 16; $i++) {
    $bin = openssl_random_pseudo_bytes(32);
    if ($bin === false || strlen($bin) !== 32) return null;
    $d = push_bi_from_bin($bin);
    if (!push_bi_iszero($d) && push_bi_cmp($d, $c['n']) < 0) return $bin;
  }
  return null;
}

/** Public key (uncompressed 65 bytes, 0x04||X||Y) from 32-byte private scalar. */
function push_ec_pub_from_priv($privBin) {
  $c = push_p256();
  if (!$c || strlen($privBin) !== 32) return null;
  $Q = push_ec_mul($privBin, $c['gx'], $c['gy']);
  if ($Q === null) return null;
  $x = push_bi_to_bin32($Q[0]);
  $y = push_bi_to_bin32($Q[1]);
  if ($x === null || $y === null) return null;
  return "\x04" . $x . $y;
}

/** ECDH shared secret (32-byte X coordinate) or null. */
function push_ecdh($privBin, $peerPub65) {
  $c = push_p256();
  if (!$c || strlen($privBin) !== 32) return null;
  if (strlen($peerPub65) !== 65 || $peerPub65[0] !== "\x04") return null;
  $px = push_bi_from_bin(substr($peerPub65, 1, 32));
  $py = push_bi_from_bin(substr($peerPub65, 33, 32));
  if (push_bi_cmp($px, $c['p']) >= 0 || push_bi_cmp($py, $c['p']) >= 0) return null;
  if (!push_ec_on_curve($px, $py)) return null;
  $S = push_ec_mul($privBin, $px, $py);
  if ($S === null) return null;
  return push_bi_to_bin32($S[0]);
}

/* ---------------------------------------------------------------------------
 * AES-128-GCM from AES-ECB (openssl on PHP 5.6 has no GCM) + pure-PHP GHASH.
 * GHASH uses 16-bit limbs so it stays correct on 32-bit PHP builds.
 * ------------------------------------------------------------------------- */

function push_aes_block($key, $block16) {
  $zp = defined('OPENSSL_ZERO_PADDING') ? OPENSSL_ZERO_PADDING : 0;
  $out = openssl_encrypt($block16, 'aes-128-ecb', $key, OPENSSL_RAW_DATA | $zp);
  if ($out === false || strlen($out) < 16) {
    $out = openssl_encrypt($block16, 'aes-128-ecb', $key, OPENSSL_RAW_DATA);
  }
  if ($out === false || strlen($out) < 16) return null;
  return substr($out, 0, 16);
}

/** GF(2^128) multiply of two 16-byte blocks (GCM spec bit order). */
function push_gf_mult($Xb, $Yb) {
  $X = array_values(unpack('n8', $Xb));
  $V = array_values(unpack('n8', $Yb));
  $Z = array(0, 0, 0, 0, 0, 0, 0, 0);
  for ($i = 0; $i < 128; $i++) {
    if (($X[$i >> 4] >> (15 - ($i & 15))) & 1) {
      for ($j = 0; $j < 8; $j++) $Z[$j] ^= $V[$j];
    }
    $lsb = $V[7] & 1;
    for ($j = 7; $j > 0; $j--) {
      $V[$j] = (($V[$j] >> 1) | (($V[$j - 1] & 1) << 15)) & 0xffff;
    }
    $V[0] >>= 1;
    if ($lsb) $V[0] ^= 0xe100;
  }
  return pack('n8', $Z[0], $Z[1], $Z[2], $Z[3], $Z[4], $Z[5], $Z[6], $Z[7]);
}

/** GHASH over data (length must be a multiple of 16). */
function push_ghash($H, $data) {
  $Y = str_repeat("\x00", 16);
  $len = strlen($data);
  for ($i = 0; $i < $len; $i += 16) {
    $Y = push_gf_mult($Y ^ substr($data, $i, 16), $H);
  }
  return $Y;
}

/** AES-128-GCM encrypt (no AAD). Returns ciphertext||tag(16) or null. */
function push_gcm_encrypt($key, $nonce12, $plain) {
  if (strlen($key) !== 16 || strlen($nonce12) !== 12) return null;
  $H = push_aes_block($key, str_repeat("\x00", 16));
  if ($H === null) return null;
  $ct = '';
  $n = strlen($plain);
  $blocks = (int)(($n + 15) / 16);
  for ($i = 0; $i < $blocks; $i++) {
    $ks = push_aes_block($key, $nonce12 . pack('N', $i + 2));
    if ($ks === null) return null;
    $ct .= substr($plain, $i * 16, 16) ^ $ks;
  }
  $pad = (16 - ($n % 16)) % 16;
  $ghin = $ct . str_repeat("\x00", $pad)
    . pack('N', 0) . pack('N', 0)
    . pack('N', 0) . pack('N', $n * 8);
  $S = push_ghash($H, $ghin);
  $J0 = push_aes_block($key, $nonce12 . "\x00\x00\x00\x01");
  if ($J0 === null) return null;
  return $ct . ($S ^ $J0);
}

/** Single-block HKDF-SHA256 (len <= 32). */
function push_hkdf($salt, $ikm, $info, $len) {
  $prk = hash_hmac('sha256', $ikm, $salt, true);
  $t = hash_hmac('sha256', $info . "\x01", $prk, true);
  return substr($t, 0, $len);
}

/* ---------------------------------------------------------------------------
 * RFC 8291 / RFC 8188 aes128gcm message encryption
 * ------------------------------------------------------------------------- */

/**
 * Encrypt $payload for a subscription (p256dh + auth, base64url as stored).
 * Returns the full aes128gcm body (header + ciphertext) or null when the
 * host cannot encrypt — caller then falls back to an empty push.
 * $opts: as_private (32B bin), salt (16B bin) — for the RFC self-test only.
 */
function push_encrypt_payload($p256dhB64, $authB64, $payload, $opts = array()) {
  if ((string)$payload === '' || strlen($payload) > 3000) return null;
  if (push_bi_backend() === '') return null;
  $uaPub = push_b64url_decode($p256dhB64);
  $secret = push_b64url_decode($authB64);
  if (strlen($uaPub) !== 65 || $uaPub[0] !== "\x04" || strlen($secret) !== 16) return null;

  $priv = isset($opts['as_private']) ? $opts['as_private'] : push_ec_random_priv();
  if ($priv === null || strlen($priv) !== 32) return null;
  $asPub = isset($opts['as_public_cache']) ? $opts['as_public_cache'] : push_ec_pub_from_priv($priv);
  if ($asPub === null) return null;
  $ecdh = push_ecdh($priv, $uaPub);
  if ($ecdh === null) return null;

  $salt = isset($opts['salt']) ? $opts['salt'] : openssl_random_pseudo_bytes(16);
  if ($salt === false || strlen($salt) !== 16) return null;

  $ikm = push_hkdf($secret, $ecdh, "WebPush: info\x00" . $uaPub . $asPub, 32);
  $cek = push_hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);
  $nonce = push_hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);

  $ct = push_gcm_encrypt($cek, $nonce, $payload . "\x02");
  if ($ct === null) return null;

  return $salt . pack('N', 4096) . chr(65) . $asPub . $ct;
}

/** Verify the whole pipeline against the RFC 8291 Appendix A vector. */
function push_crypto_selftest() {
  if (push_bi_backend() === '') return false;
  $uaPub = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  $secret = 'BTBZMqHH6r4Tts7J_aSIgg';
  $asPriv = push_b64url_decode('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');
  $asPub = push_b64url_decode('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  $salt = push_b64url_decode('DGv6ra1nlYgDCS1FRnbzlw');
  $plain = push_b64url_decode('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24');
  if (push_ec_pub_from_priv($asPriv) !== $asPub) return false;
  $body = push_encrypt_payload($uaPub, $secret, $plain, array('as_private' => $asPriv, 'salt' => $salt));
  $expected = push_b64url_decode(
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
  ) . push_b64url_decode(
    '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'
  );
  return $body === $expected;
}

/** What this host can do — shown by push_ping.php for post-upload checks. */
function push_capabilities() {
  return array(
    'bignum' => push_bi_backend(),
    'gmp' => extension_loaded('gmp'),
    'bcmath' => function_exists('bcadd'),
    'curl' => function_exists('curl_init'),
    'curl_multi' => function_exists('curl_multi_init'),
    'int_size' => PHP_INT_SIZE,
    'mode' => push_bi_backend() !== '' ? 'payload' : 'empty',
  );
}

/* ---------------------------------------------------------------------------
 * VAPID JWT (unchanged) + subscription table + batch sender
 * ------------------------------------------------------------------------- */

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
 * Send one Web Push per target, in parallel when curl_multi exists.
 * $targets: array of array('endpoint' => ..., 'body' => string|null, ...extra)
 * Returns targets with added 'code' (HTTP status, 0 = not sent) and 'host'.
 */
function push_send_webpush_multi($targets, $ttl = 86400, $deadline = 12) {
  $public = vapid_public_key();
  $jwtCache = array();
  $handles = array();
  $results = array();

  foreach ($targets as $i => $t) {
    $t['code'] = 0;
    $t['host'] = '';
    $endpoint = isset($t['endpoint']) ? (string)$t['endpoint'] : '';
    $parts = $endpoint !== '' ? parse_url($endpoint) : false;
    if (empty($parts['scheme']) || empty($parts['host'])) {
      $results[$i] = $t;
      continue;
    }
    $t['host'] = $parts['host'];
    $aud = $parts['scheme'] . '://' . $parts['host'];
    if (!isset($jwtCache[$aud])) $jwtCache[$aud] = push_vapid_jwt($aud);
    if (!$jwtCache[$aud] || !function_exists('curl_init')) {
      $results[$i] = $t;
      continue;
    }

    $body = isset($t['body']) ? $t['body'] : null;
    $headers = array(
      'TTL: ' . (int)$ttl,
      'Urgency: high',
      'Authorization: vapid t=' . $jwtCache[$aud] . ', k=' . $public,
    );
    if ($body !== null && $body !== '') {
      $headers[] = 'Content-Encoding: aes128gcm';
      $headers[] = 'Content-Type: application/octet-stream';
      $headers[] = 'Content-Length: ' . strlen($body);
    } else {
      $body = '';
      $headers[] = 'Content-Length: 0';
    }

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    if (defined('CURL_SSLVERSION_TLSv1_2')) {
      curl_setopt($ch, CURLOPT_SSLVERSION, CURL_SSLVERSION_TLSv1_2);
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $handles[$i] = $ch;
    $results[$i] = $t;
  }

  if ($handles && function_exists('curl_multi_init')) {
    $mh = curl_multi_init();
    foreach ($handles as $ch) curl_multi_add_handle($mh, $ch);
    $start = time();
    $running = 1;
    do {
      curl_multi_exec($mh, $running);
      if ($running && curl_multi_select($mh, 0.5) === -1) {
        usleep(20000); // old curl returns -1 immediately — avoid busy loop
      }
    } while ($running && (time() - $start) < $deadline);
    foreach ($handles as $i => $ch) {
      $results[$i]['code'] = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_multi_remove_handle($mh, $ch);
      curl_close($ch);
    }
    curl_multi_close($mh);
  } else {
    foreach ($handles as $i => $ch) {
      curl_exec($ch);
      $results[$i]['code'] = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);
    }
  }

  return array_values($results);
}

/**
 * Encrypted Web Push (title/body/url payload) to desk staff subscriptions
 * (admin/staff). Runs synchronously; returns per-endpoint results.
 */
function push_notify_staff(PDO $pdo, $meta = array()) {
  push_ensure_table($pdo);
  try {
    $rows = $pdo->query('SELECT id, endpoint, p256dh, auth_key, username, role FROM push_subscription ORDER BY id DESC LIMIT 100')->fetchAll();
  } catch (Exception $e) {
    // Older schema without role column
    try {
      $rows = $pdo->query('SELECT id, endpoint, p256dh, auth_key, username FROM push_subscription ORDER BY id DESC LIMIT 100')->fetchAll();
    } catch (Exception $e2) {
      return array('ok' => false, 'sent' => 0, 'error' => $e2->getMessage());
    }
  }
  if (!$rows) return array('ok' => true, 'sent' => 0, 'skipped' => 'no_subscribers');

  $payload = json_encode(array(
    'title' => isset($meta['title']) && $meta['title'] !== '' ? (string)$meta['title'] : 'สมบัติทัวร์',
    'body' => isset($meta['body']) && $meta['body'] !== '' ? (string)$meta['body'] : 'มีงานแจ้งซ่อมใหม่ — แตะเพื่อเปิดดู',
    'url' => isset($meta['url']) && $meta['url'] !== '' ? (string)$meta['url'] : '/',
  ), defined('JSON_UNESCAPED_UNICODE') ? JSON_UNESCAPED_UNICODE : 0);
  if ($payload === false) $payload = '{"title":"Sombat Tour","body":"New repair job"}';

  // One ephemeral key pair per batch keeps bcmath hosts fast (salt is
  // fresh per subscription, so keys/nonces never repeat).
  $asPriv = push_ec_random_priv();
  $asPub = $asPriv !== null ? push_ec_pub_from_priv($asPriv) : null;

  $targets = array();
  $skipped = 0;
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

    $body = null;
    if ($asPriv !== null && $asPub !== null && !empty($row['p256dh']) && !empty($row['auth_key'])) {
      $body = push_encrypt_payload($row['p256dh'], $row['auth_key'], $payload, array(
        'as_private' => $asPriv,
        'as_public_cache' => $asPub,
      ));
    }
    $targets[] = array(
      'id' => (int)$row['id'],
      'endpoint' => $endpoint,
      'body' => $body,
      'user' => $username,
      'mode' => $body !== null ? 'payload' : 'empty',
    );
  }

  if (!$targets) {
    return array('ok' => true, 'sent' => 0, 'skipped' => $skipped, 'reason' => 'no_desk_subscribers');
  }

  $sent = 0;
  $failed = 0;
  $gone = array();
  $results = array();
  foreach (push_send_webpush_multi($targets) as $r) {
    if ($r['code'] >= 200 && $r['code'] < 300) {
      $sent++;
    } else {
      $failed++;
      if ($r['code'] === 404 || $r['code'] === 410) $gone[] = (int)$r['id'];
    }
    $results[] = array(
      'user' => $r['user'],
      'host' => $r['host'],
      'mode' => $r['mode'],
      'code' => $r['code'],
    );
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
    'crypto' => push_bi_backend() !== '' ? 'aes128gcm/' . push_bi_backend() : 'empty-only',
    'results' => $results,
    'title' => isset($meta['title']) ? $meta['title'] : '',
  );
}
