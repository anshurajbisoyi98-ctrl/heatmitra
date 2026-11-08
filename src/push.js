'use strict';
/*
 * Web Push with VAPID (RFC 8292), using Node's crypto only.
 * Pushes carry no payload, so no message encryption is needed: when a push arrives, the service
 * worker asks the server for that worker's latest notice and shows it as a notification.
 * Keys: VAPID_PUBLIC + VAPID_PRIVATE_PEM env vars, or generated once and kept in data/cache/vapid.json.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'cache', 'vapid.json');
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Same key pair from the same seed, so push subscriptions survive redeploys. On Render the seed is
// generated once and kept by the platform (render.yaml: generateValue), so no one handles a private key.
function keysFromSeed(seed) {
  let d = crypto.createHash('sha256').update(`heatmitra-vapid:${seed}`).digest();
  const ecdh = crypto.createECDH('prime256v1');
  for (let i = 0; i < 4; i++) {
    try { ecdh.setPrivateKey(d); break; } catch { d = crypto.createHash('sha256').update(d).digest(); } // out of range: rehash
  }
  const pub = ecdh.getPublicKey();
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' });
  return { publicKey: b64u(pub), privatePem: key.export({ type: 'pkcs8', format: 'pem' }) };
}

function loadKeys() {
  if (process.env.VAPID_SEED) return keysFromSeed(process.env.VAPID_SEED);
  if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE_PEM) {
    return { publicKey: process.env.VAPID_PUBLIC, privatePem: process.env.VAPID_PRIVATE_PEM.replace(/\\n/g, '\n') };
  }
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  const keys = { publicKey: b64u(raw), privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(keys)); } catch {}
  return keys;
}

const KEYS = loadKeys();
const SUBJECT = process.env.VAPID_SUBJECT || 'https://github.com/anshurajbisoyi98-ctrl/heatmitra';

// ES256-signed JWT that proves to the push service that this server owns the VAPID key.
function vapidJwt(audience, expSec = 12 * 3600) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + expSec, sub: SUBJECT }));
  const data = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: KEYS.privatePem, dsaEncoding: 'ieee-p1363' });
  return `${data}.${b64u(sig)}`;
}

// Returns the push service's HTTP status (201 = accepted; 404/410 = subscription gone).
async function send(subscription, { ttl = 600, urgency = 'high' } = {}) {
  const audience = new URL(subscription.endpoint).origin;
  const r = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: { TTL: String(ttl), Urgency: urgency, Authorization: `vapid t=${vapidJwt(audience)}, k=${KEYS.publicKey}`, 'Content-Length': '0' },
    signal: AbortSignal.timeout(8000),
  });
  return r.status;
}

module.exports = { publicKey: KEYS.publicKey, vapidJwt, send, keysFromSeed };
