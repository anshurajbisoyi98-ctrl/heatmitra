'use strict';
/*
 * HeatMitra server: API, role-based access, escalation sweeper, audit log.
 * Zero dependencies. Run: node server.js   (DEMO=0 for real-time timers)
 *
 * Escalation ladder (adapted from MargMitra's guardian escalation):
 *   check-in due -> worker prompt -> supervisor -> first-aider
 *   heartbeat lost -> supervisor -> first-aider
 *   red-flag symptom -> first-aider (emergency) straight away
 * The sweeper runs on the server, so escalation still happens when the phone is dead.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Heat = require('./public/heat.js');
const weather = require('./src/weather.js');
const seed = require('./data/seed.json');

const PORT = Number(process.env.PORT || 3000);
const DEMO = process.env.DEMO !== '0';
// Seconds. In demo mode one check-in minute lasts 2 s, so a red-band 20-min check-in comes every 40 s.
const T = DEMO
  ? { checkinScale: 2, workerStage: 20, supervisorStage: 25, heartbeatTimeout: 30, heartbeatEvery: 10 }
  : { checkinScale: 60, workerStage: 90, supervisorStage: 120, heartbeatTimeout: 120, heartbeatEvery: 30 };
const RETAIN_MS = 24 * 3600 * 1000;

const sites = Object.fromEntries(seed.sites.map((s) => [s.id, { ...s, replayDate: seed.defaultReplay[s.id] || null }]));
const users = Object.fromEntries(seed.users.map((u) => [u.id, u]));
const tokens = new Map();
const shifts = new Map(); // workerId -> shift
const consent = new Map(); // workerId -> { symptoms: bool }
const alerts = [];
const checkins = [];
const audit = [];

const now = () => Date.now();
const id = () => crypto.randomBytes(6).toString('hex');
const pad = (n) => String(n).padStart(2, '0');

function log(actor, action, detail) {
  audit.push({ at: now(), actor, action, detail });
  if (audit.length > 500) audit.shift();
}

function localParts(tz) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')), minute: Number(g('minute')) };
}

// The site's weather for "now". In replay mode, the same clock hour on the replay date.
async function siteNow(site) {
  const fc = await weather.forecast(site, site.replayDate);
  const lp = localParts(site.tz);
  const date = site.replayDate || lp.date;
  const time = `${date}T${pad(lp.hour)}:00`;
  let day = fc.hourly.filter((r) => r.time.startsWith(date));
  if (!day.length) day = fc.hourly.filter((r) => r.time.startsWith(fc.date)); // saved fallback day
  let idx = day.findIndex((r) => r.time === time);
  if (idx < 0) idx = Math.min(lp.hour, day.length - 1);
  return { fc, day, idx, time: day[idx].time, minute: lp.minute };
}

function profileOf(sh) {
  return { workload: sh.workload, clothing: sh.clothing, daysOnSite: sh.daysOnSite };
}

async function workerView(sh) {
  const site = sites[sh.siteId];
  const sn = await siteNow(site);
  const plan = Heat.assessDay(sn.day, profileOf(sh), site.middayBan);
  const current = plan[sn.idx];
  sh.band = current.band;
  sh.checkinMin = current.checkinMin;
  return { site, sn, plan, current, rise: Heat.nextRise(plan, sn.idx) };
}

function openAlertFor(workerId) {
  return alerts.find((a) => a.workerId === workerId && a.status === 'open');
}

function openAlert(sh, reason, stage, extra = {}) {
  const a = {
    id: id(), workerId: sh.workerId, siteId: sh.siteId, reason, stage, status: 'open',
    severity: extra.severity || (reason === 'no_signal' ? 'urgent' : 'routine'),
    symptoms: extra.symptoms || null, band: sh.band || null,
    openedAt: now(), stageAt: now(), firstHumanAt: null, history: [{ stage, at: now(), by: 'system', note: reason }],
  };
  alerts.push(a);
  log('system', 'alert_opened', `${a.id} ${users[sh.workerId].name} ${reason} -> ${stage}`);
  return a;
}

function advance(a, stage, by, note) {
  a.stage = stage;
  a.stageAt = now();
  a.history.push({ stage, at: now(), by, note });
  log(by, 'alert_escalated', `${a.id} -> ${stage} (${note})`);
}

function resolve(a, by, note) {
  a.status = 'resolved';
  a.resolvedAt = now();
  if (!a.firstHumanAt && by !== 'system') a.firstHumanAt = now();
  a.history.push({ stage: 'resolved', at: now(), by, note });
  log(by, 'alert_resolved', `${a.id} (${note})`);
}

function recordCheckin(sh, status, symptoms, by) {
  sh.lastCheckin = now();
  sh.lastHeartbeat = now();
  const allowed = (symptoms || []).filter((s) => Heat.SYMPTOMS.includes(s));
  checkins.push({ workerId: sh.workerId, at: now(), status, by });
  const open = openAlertFor(sh.workerId);
  if (status === 'ok') {
    if (open && open.stage !== 'medic') resolve(open, users[sh.workerId].name, 'worker confirmed OK');
    return { action: 'continue' };
  }
  const red = allowed.some((s) => Heat.RED_FLAGS.includes(s));
  const severity = red ? 'emergency' : 'review';
  const shared = consent.get(sh.workerId)?.symptoms ? allowed : null; // nothing stored without consent
  if (open) {
    open.severity = severity;
    open.symptoms = shared;
    if (!open.firstHumanAt) open.firstHumanAt = now();
    if (open.stage !== 'medic') advance(open, 'medic', users[sh.workerId].name, 'worker reported feeling unwell');
  } else {
    openAlert(sh, 'reported_unwell', 'medic', { severity, symptoms: shared });
  }
  return { action: red ? 'emergency' : 'rest', emergency: sites[sh.siteId].emergency };
}

async function sweep() {
  const t = now();
  for (const sh of shifts.values()) {
    if (sh.simulated && !sh.silent) sh.lastHeartbeat = t;
    let open = openAlertFor(sh.workerId);
    if (!open && t - sh.lastHeartbeat > T.heartbeatTimeout * 1000) {
      openAlert(sh, 'no_signal', 'supervisor');
      continue;
    }
    try { await workerView(sh); } catch { continue; }
    if (!sh.checkinMin) continue;
    const due = sh.lastCheckin + sh.checkinMin * T.checkinScale * 1000;
    if (t < due) continue;
    if (sh.simulated && !sh.silent) { recordCheckin(sh, 'ok', [], 'simulated'); continue; }
    if (!open) openAlert(sh, 'checkin_due', 'worker');
  }
  for (const a of alerts) {
    if (a.status !== 'open') continue;
    const el = (t - a.stageAt) / 1000;
    if (a.stage === 'worker' && el > T.workerStage) advance(a, 'supervisor', 'system', 'no response from worker');
    else if (a.stage === 'supervisor' && el > T.supervisorStage) advance(a, 'medic', 'system', 'no response from supervisor');
  }
  const cutoff = t - RETAIN_MS; // retention: drop everything older than 24 h
  while (checkins.length && checkins[0].at < cutoff) checkins.shift();
  for (let i = alerts.length - 1; i >= 0; i--) if (alerts[i].status === 'resolved' && alerts[i].resolvedAt < cutoff) alerts.splice(i, 1);
}
setInterval(() => sweep().catch((e) => console.error('[sweep]', e.message)), 2000);

function startShift(w, body = {}, simulated = false) {
  const sh = {
    workerId: w.id, siteId: w.siteId,
    workload: Heat.WORKLOAD[body.workload] ? body.workload : w.workload,
    clothing: Heat.CLOTHING[body.clothing] != null ? body.clothing : w.clothing,
    daysOnSite: Number.isFinite(Number(body.daysOnSite)) ? Math.max(0, Number(body.daysOnSite)) : w.daysOnSite,
    startedAt: now(), lastHeartbeat: now(), lastCheckin: now(), simulated, silent: false, band: null, checkinMin: null,
  };
  shifts.set(w.id, sh);
  log(simulated ? 'demo' : w.name, 'shift_started', `${w.name} ${sh.workload}`);
  return sh;
}

function alertPublic(a, withClinical) {
  const out = {
    id: a.id, worker: users[a.workerId].name, workerId: a.workerId, reason: a.reason, stage: a.stage, status: a.status,
    severity: a.severity, band: a.band, openedAt: a.openedAt, stageAt: a.stageAt, history: a.history,
  };
  if (withClinical) {
    out.symptoms = a.symptoms;
    out.consented = Boolean(consent.get(a.workerId)?.symptoms);
  }
  return out;
}

function metrics() {
  const ended = alerts.filter((a) => a.firstHumanAt || a.resolvedAt);
  const resp = ended.map((a) => ((a.firstHumanAt || a.resolvedAt) - a.openedAt) / 1000).sort((x, y) => x - y);
  const prompted = alerts.filter((a) => a.reason === 'checkin_due');
  const answered = prompted.filter((a) => a.history.some((h) => h.note === 'worker confirmed OK'));
  return {
    alertsOpened: alerts.length,
    open: alerts.filter((a) => a.status === 'open').length,
    reachedFirstAider: alerts.filter((a) => a.history.some((h) => h.stage === 'medic')).length,
    emergencies: alerts.filter((a) => a.severity === 'emergency').length,
    signalLost: alerts.filter((a) => a.reason === 'no_signal').length,
    checkinPromptResponseRate: prompted.length ? Math.round((answered.length / prompted.length) * 100) : null,
    medianResponseSec: resp.length ? Math.round(resp[Math.floor(resp.length / 2)]) : null,
    checkins: checkins.length,
  };
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const PUBLIC = path.join(__dirname, 'public');

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function body(req) {
  return new Promise((ok, fail) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 10000) { fail(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { fail(new Error('bad json')); } });
  });
}

function who(req) {
  const tok = (req.headers.authorization || '').replace(/^Bearer /, '');
  return tokens.get(tok) || null;
}

function need(user, ...roles) {
  if (!user) throw Object.assign(new Error('sign in first'), { code: 401 });
  if (!roles.includes(user.role)) throw Object.assign(new Error('not allowed for this role'), { code: 403 });
}

async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  const u = who(req);

  if (m === 'GET' && p === '/api/config') return send(res, 200, { demo: DEMO, timing: T, sites: Object.values(sites) });
  if (m === 'GET' && p === '/api/users') {
    if (!DEMO) return send(res, 404, { error: 'demo only' });
    return send(res, 200, seed.users.map(({ id, role, name, lang }) => ({ id, role, name, lang })));
  }
  if (m === 'POST' && p === '/api/login') {
    const b = await body(req);
    const user = users[b.userId];
    if (!user || !DEMO) return send(res, 401, { error: 'unknown user' });
    const tok = crypto.randomBytes(16).toString('hex');
    tokens.set(tok, user);
    return send(res, 200, { token: tok, user });
  }
  if (m === 'GET' && p === '/api/forecast') {
    const site = sites[url.searchParams.get('site')];
    if (!site) return send(res, 404, { error: 'no such site' });
    const sn = await siteNow(site);
    return send(res, 200, { site, mode: sn.fc.mode, source: sn.fc.source, stale: sn.fc.stale, fetchedAt: sn.fc.fetchedAt, nowTime: sn.time, hourly: sn.day });
  }

  // ----- worker -----
  if (p === '/api/me' && m === 'GET') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    const c = consent.get(u.id) || { symptoms: false };
    if (!sh) return send(res, 200, { user: u, shift: null, consent: c, timing: T });
    const v = await workerView(sh);
    const a = openAlertFor(u.id);
    return send(res, 200, {
      user: u, consent: c, timing: T,
      shift: { workload: sh.workload, clothing: sh.clothing, daysOnSite: sh.daysOnSite, startedAt: sh.startedAt },
      site: { id: v.site.id, name: v.site.name, emergency: v.site.emergency, replayDate: v.site.replayDate },
      source: v.sn.fc.source, stale: v.sn.fc.stale, nowTime: v.sn.time,
      current: v.current, rise: v.rise, plan: v.plan,
      nextCheckinAt: v.current.checkinMin ? sh.lastCheckin + v.current.checkinMin * T.checkinScale * 1000 : null,
      alert: a ? { id: a.id, stage: a.stage, reason: a.reason, severity: a.severity } : null,
      serverTime: now(),
    });
  }
  if (p === '/api/shift/start' && m === 'POST') { need(u, 'worker'); startShift(u, await body(req)); return send(res, 200, { ok: true }); }
  if (p === '/api/shift/end' && m === 'POST') {
    need(u, 'worker');
    shifts.delete(u.id);
    const a = openAlertFor(u.id);
    if (a && a.stage !== 'medic') resolve(a, u.name, 'shift ended');
    log(u.name, 'shift_ended', u.name);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/heartbeat' && m === 'POST') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    if (sh) sh.lastHeartbeat = now();
    return send(res, 200, { ok: true });
  }
  if (p === '/api/checkin' && m === 'POST') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    if (!sh) return send(res, 409, { error: 'no active shift' });
    const b = await body(req);
    return send(res, 200, recordCheckin(sh, b.status === 'unwell' ? 'unwell' : 'ok', b.symptoms, u.name));
  }
  if (p === '/api/consent' && m === 'POST') {
    need(u, 'worker');
    const b = await body(req);
    consent.set(u.id, { symptoms: Boolean(b.symptoms), at: now() });
    log(u.name, 'consent_changed', `symptom sharing with first-aider: ${Boolean(b.symptoms)}`);
    return send(res, 200, consent.get(u.id));
  }

  // ----- supervisor: crew-level, no clinical detail -----
  if (p === '/api/crew' && m === 'GET') {
    need(u, 'supervisor', 'medic');
    const t = now();
    const list = [...shifts.values()].filter((s) => s.siteId === (url.searchParams.get('site') || u.siteId)).map((s) => {
      const a = openAlertFor(s.workerId);
      return {
        workerId: s.workerId, name: users[s.workerId].name, workload: s.workload, band: s.band, simulated: s.simulated,
        lastCheckinSec: Math.round((t - s.lastCheckin) / 1000), signal: t - s.lastHeartbeat > T.heartbeatTimeout * 1000 ? 'lost' : 'ok',
        alert: a ? { id: a.id, stage: a.stage, reason: a.reason, severity: a.severity } : null,
      };
    });
    const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
    list.forEach((w) => { if (w.band) counts[w.band]++; });
    return send(res, 200, { crew: list, counts, metrics: metrics() });
  }
  if (p === '/api/alerts' && m === 'GET') {
    need(u, 'supervisor', 'medic');
    const clinical = u.role === 'medic';
    const list = alerts.filter((a) => a.status === 'open' || now() - (a.resolvedAt || 0) < 3600e3).slice(-40).reverse();
    if (clinical && list.some((a) => a.symptoms)) log(u.name, 'viewed_symptoms', `${list.filter((a) => a.symptoms).length} alert(s)`);
    return send(res, 200, list.map((a) => alertPublic(a, clinical)));
  }
  const ack = p.match(/^\/api\/alerts\/([a-f0-9]+)\/(ack|escalate|attend|resolve)$/);
  if (ack && m === 'POST') {
    const a = alerts.find((x) => x.id === ack[1]);
    if (!a || a.status !== 'open') return send(res, 404, { error: 'no open alert' });
    const act = ack[2];
    if (act === 'ack' || act === 'escalate') need(u, 'supervisor');
    else need(u, 'medic');
    if (!a.firstHumanAt) a.firstHumanAt = now();
    if (act === 'ack') resolve(a, u.name, 'supervisor checked on worker: OK');
    if (act === 'escalate') advance(a, 'medic', u.name, 'supervisor requested first-aider');
    if (act === 'attend') { a.history.push({ stage: 'medic', at: now(), by: u.name, note: 'first-aider attending' }); log(u.name, 'alert_attending', a.id); }
    if (act === 'resolve') resolve(a, u.name, (await body(req)).note || 'first-aider closed the case');
    return send(res, 200, alertPublic(a, u.role === 'medic'));
  }
  if (p === '/api/audit' && m === 'GET') { need(u, 'supervisor', 'medic'); return send(res, 200, audit.slice(-60).reverse()); }
  if (p === '/api/site/mode' && m === 'POST') {
    need(u, 'supervisor');
    const b = await body(req);
    const site = sites[b.siteId];
    if (!site) return send(res, 404, { error: 'no such site' });
    site.replayDate = /^\d{4}-\d{2}-\d{2}$/.test(b.replayDate || '') ? b.replayDate : null;
    log(u.name, 'site_mode', `${site.id} -> ${site.replayDate ? 'replay ' + site.replayDate : 'live'}`);
    return send(res, 200, site);
  }

  // ----- demo helpers -----
  if (DEMO && p === '/api/demo/crew' && m === 'POST') {
    need(u, 'supervisor');
    seed.users.filter((w) => w.role === 'worker' && w.siteId === u.siteId && !shifts.has(w.id)).forEach((w) => startShift(w, {}, true));
    return send(res, 200, { ok: true });
  }
  const sil = p.match(/^\/api\/demo\/silent\/(\w+)$/);
  if (DEMO && sil && m === 'POST') {
    need(u, 'supervisor');
    const sh = shifts.get(sil[1]);
    if (!sh || !sh.simulated) return send(res, 404, { error: 'not a simulated worker' });
    sh.silent = true;
    log('demo', 'simulated_silence', users[sh.workerId].name);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  if (url.pathname === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  try { await api(req, res, url); } catch (e) { send(res, e.code || 500, { error: e.message }); }
}).listen(PORT, () => console.log(`HeatMitra on http://localhost:${PORT} (demo mode: ${DEMO})`));
