'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const push = require('../src/push.js');

test('VAPID JWT is a valid ES256 signature over the push service origin', () => {
  const jwt = push.vapidJwt('https://fcm.googleapis.com');
  const [h, p, s] = jwt.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url'));
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  assert.strictEqual(header.alg, 'ES256');
  assert.strictEqual(payload.aud, 'https://fcm.googleapis.com');
  assert.ok(payload.exp > Date.now() / 1000 && payload.exp <= Date.now() / 1000 + 24 * 3600, 'expires within 24 h');
  const raw = Buffer.from(push.publicKey, 'base64url');
  assert.strictEqual(raw.length, 65, 'uncompressed P-256 public key');
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
});
