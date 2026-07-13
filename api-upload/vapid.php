<?php
/**
 * VAPID keys for Web Push (PWA staff alerts).
 * Public key is also in src/data/pushConfig.js
 */
function vapid_public_key() {
  return 'BFAywr6R71ilf8y0sbag9qFmiDjj7I5D4EMPDBJ8ndy4wOXmLrcnvptrsDN5wpGksAj3zGwwfAUqcE3tUmoITGk';
}

function vapid_private_pem() {
  return "-----BEGIN EC PRIVATE KEY-----\n"
    . "MHcCAQEEINCv4nUBNzELMedmLj11BVYQhb6dD1zvhOJALNcrDd9CoAoGCCqGSM49\n"
    . "AwEHoUQDQgAEUDLCvpHvWKV/zLSxtqD2oWaIOOPsjkPgQw8MEnyd3LjA5eYutye+\n"
    . "m2uwM3nCkaSwCPfMbDB8BSpwTe1SaghMaQ==\n"
    . "-----END EC PRIVATE KEY-----\n";
}

function vapid_subject() {
  return 'mailto:notify@425store.com';
}
