<?php
// GET /api/push_vapid.php — public VAPID key for subscribe
require_once __DIR__ . '/bootstrap.php';
cors_headers(array('GET', 'OPTIONS'));
require_once __DIR__ . '/vapid.php';
out(array('ok' => true, 'publicKey' => vapid_public_key()));
