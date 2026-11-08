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
  ? { checkinScale: 2, workerStage: 20, buddyStage: 20, supervisorStage: 25, heartbeatTimeout: 30, heartbeatEvery: 10 }
  : { checkinScale: 60, workerStage: 90, buddyStage: 120, supervisorStage: 120, heartbeatTimeout: 120, heartbeatEvery: 30 };

// Worker-language strings on the server too, for SMS to basic phones.
const I18N = (() => {
  const ctx = require('node:vm').createContext({});
  ctx.window = ctx;
  require('node:vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, 'public', 'i18n.js'), 'utf8'), ctx);
  return ctx.I18N;
})();
function tr(lang, key, vars) {
  const L = I18N[lang] || I18N.en;
  let s = L[key] ?? I18N.en[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}
const RETAIN_MS = 24 * 3600 * 1000;

const sites = Object.fromEntries(seed.sites.map((s) => [s.id, { ...s, replayDate: seed.defaultReplay[s.id] || null }]));
const users = Object.fromEntries(seed.users.map((u) => [u.id, u]));
// Demo heat history: daysOnSite consecutive days in the heat, ending awayDays before today.
for (const u of Object.values(users)) {
  if (u.role !== 'worker') continue;
  const away = u.awayDays ?? 1;
  u.heatDates = Array.from({ length: u.daysOnSite || 0 }, (_, i) => new Date(Date.now() - (away + i) * 864e5).toISOString().slice(0, 10));
}
const tokens = new Map();
const shifts = new Map(); // workerId -> shift
const consent = new Map(); // workerId -> { symptoms: bool }
const alerts = [];
const checkins = [];
const audit = [];
const restTotals = { due: 0, taken: 0, verified: 0, cups: 0, cupsDue: 0 }; // from shifts that have ended
// Break check: station audits by the supervisor (Adelante's structured checklist).
const AUDIT_ITEMS = ['shade', 'near', 'water', 'electrolytes', 'space'];
const AUDIT_EVERY_MIN = 120; // an audit counts for 2 (scaled) hours
const CUPS_PER_HOUR = 3; // NIOSH: 1 cup every 15-20 min in the heat
function stationAudit(site, st) {
  const a = (site.audits || {})[st.id];
  const fresh = a && now() - a.at < AUDIT_EVERY_MIN * T.checkinScale * 1000;
  return { id: st.id, name: st.name, lastAt: a ? a.at : null, by: a ? a.by : null, items: a ? a.items : null, fresh: Boolean(fresh), ok: Boolean(fresh && AUDIT_ITEMS.every((k) => a.items[k])) };
}
function breakCheck(site) {
  const live = [...shifts.values()].filter((x) => x.siteId === site.id);
  const sum = (f) => live.reduce((t, x) => t + (f(x) || 0), 0);
  const stations = (site.stations || []).map((st) => stationAudit(site, st));
  const c = Heat.complianceScore({
    restDue: restTotals.due + sum((x) => x.restsDue), restTaken: restTotals.taken + sum((x) => x.restsTaken), restVerified: restTotals.verified + sum((x) => x.restsVerified),
    cups: restTotals.cups + sum((x) => x.cups), cupsDue: Math.floor(restTotals.cupsDue + sum((x) => x.cupsDue)),
    auditsDue: stations.length, auditsOk: stations.filter((x) => x.ok).length,
  });
  return { ...c, stations };
}
const OUTCOMES = { cramps: 'heat cramps', exhaustion: 'heat exhaustion', stroke: 'suspected heat stroke', notheat: 'not heat-related', falsealarm: 'false alarm, worker fine' };

// Work/rest cycle for this hour: work first, then rest, repeating every (scaled) hour.
function restInfo(sh) {
  const cyc = 60 * T.checkinScale * 1000;
  const el = now() - sh.startedAt;
  const ci = Math.floor(el / cyc);
  const cycleStart = sh.startedAt + ci * cyc;
  if (sh.workMin >= 60) return { phase: 'work', endsAt: null };
  const restAt = cycleStart + sh.workMin * T.checkinScale * 1000;
  if (now() < restAt) return { phase: 'work', endsAt: restAt };
  return { phase: 'rest', endsAt: cycleStart + cyc, acked: sh.restAckCycle === ci, full: sh.workMin === 0 };
}

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

// Next three days for heavy work (acclimatised, normal clothes): peak heat, STOP hours, best window.
function outlookFor(site, fc, today) {
  const dates = [...new Set(fc.hourly.map((r) => r.time.slice(0, 10)))].filter((d) => d > today).slice(0, 3);
  return dates.map((d) => {
    const hrs = fc.hourly.filter((r) => { const h = Number(r.time.slice(11, 13)); return r.time.startsWith(d) && h >= 5 && h <= 19; });
    if (hrs.length < 10) return null;
    const plan = Heat.assessDay(hrs, { workload: 'heavy', clothing: 'standard', daysOnSite: 30, calib: site.calib || 0 }, site.middayBan);
    const peak = plan.reduce((b, p) => (p.wbgt > b.wbgt ? p : b), plan[0]);
    return {
      date: d, peak: peak.wbgt, peakTime: peak.time.slice(11, 16), stopHours: plan.filter((p) => p.band === 'red').length,
      window: Heat.bestWindow(plan), bands: plan.map((p) => p.band),
    };
  }).filter(Boolean);
}

const SHIFT_MIN = 480; // usual shift length, for the acclimatisation exposure cap
const READY_ITEMS = ['shade', 'water', 'tub', 'firstaider', 'vests', 'restarea', 'route'];
const CRITICAL_ITEMS = ['shade', 'water', 'tub', 'firstaider'];
function readyToday(site) {
  return site.readiness && site.readiness.date === localParts(site.tz).date ? site.readiness.items : {};
}

function acclimFor(workerId) {
  const w = users[workerId];
  return Heat.acclimPlan(w.heatDates, localParts(sites[w.siteId].tz).date);
}

function profileOf(sh) {
  const acc = acclimFor(sh.workerId);
  sh.acc = acc;
  return {
    workload: sh.workload, clothing: sh.clothing, acclimatised: acc.acclimatised, exposureCap: acc.cap,
    personal: Heat.personalOffset(users[sh.workerId].personal),
  };
}

async function workerView(sh) {
  const site = sites[sh.siteId];
  const sn = await siteNow(site);
  const plan = Heat.assessDay(sn.day, { ...profileOf(sh), calib: site.calib || 0 }, site.middayBan);
  let current = plan[sn.idx];
  sh.margin0 = current.margin - current.personal; // margin before personal tightening, for learning
  if (sh.capUsed) current = { ...current, band: 'red', workMin: 0, restMin: 60, checkinMin: Heat.CHECKIN_MIN.red, capUsed: true };
  sh.band = current.band;
  sh.checkinMin = current.checkinMin;
  sh.workMin = current.workMin;
  return { site, sn, plan, current, rise: Heat.nextRise(plan, sn.idx) };
}

// Learn this worker's tighten-only personal limit from a check-in label (1 = struggled, 0 = fine).
function learn(sh, y) {
  const w = users[sh.workerId];
  const before = Heat.personalOffset(w.personal);
  w.personal = Heat.personalUpdate(w.personal, sh.margin0 ?? 0, y);
  if (Heat.personalOffset(w.personal) > before) log('system', 'personal_limit', 'a worker\'s personal limit was tightened (details stay with the worker)');
}

// Background alerts: Web Push to the worker's phone; SMS if they have no push subscription but a phone number.
const push = require('./src/push.js');
const pushSubs = new Map(); // workerId -> subscriptions
const latestNotice = new Map(); // workerId -> what the service worker shows
let noticesSent = 0;
function notify(workerId, body, tag, urgent = false) {
  const w = users[workerId];
  if (!w || w.channel === 'sms') return; // basic phones get their own SMS flow
  latestNotice.set(workerId, { title: 'HeatMitra', body, tag, urgent, at: now() });
  const subs = pushSubs.get(workerId) || [];
  if (subs.length) {
    noticesSent++;
    for (const s of subs) {
      push.send(s).then((st) => {
        if (DEMO) console.log(`[push] ${users[workerId].name} "${tag}" -> push service HTTP ${st}`);
        if (st === 404 || st === 410) pushSubs.set(workerId, (pushSubs.get(workerId) || []).filter((x) => x.endpoint !== s.endpoint));
      }).catch(() => {});
    }
  } else if (w.phone) { noticesSent++; sendSms(workerId, `HeatMitra: ${body}`); }
}

// The worker's buddy, if they are on shift, reachable and not in trouble themselves.
function buddyFor(sh) {
  const bid = users[sh.workerId].buddy;
  const b = bid && shifts.get(bid);
  if (!b || b.silent || users[bid].channel === 'sms') return null;
  if (now() - b.lastHeartbeat > T.heartbeatTimeout * 1000 || openAlertFor(bid)) return null;
  return b;
}

// SMS for workers with basic phones. Logged in an outbox; also POSTed to SMS_WEBHOOK_URL if set (gateway bridge).
const outbox = [];
function sendSms(workerId, text) {
  const w = users[workerId];
  if (!w || !w.phone) return;
  outbox.push({ phone: w.phone, text, at: now(), dir: 'out' });
  if (outbox.length > 300) outbox.shift();
  if (process.env.SMS_WEBHOOK_URL) {
    fetch(process.env.SMS_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: w.phone, text }) }).catch(() => {});
  }
}

function endShift(workerId, by) {
  const ended = shifts.get(workerId);
  if (ended) {
    restTotals.due += ended.restsDue; restTotals.taken += ended.restsTaken; restTotals.verified += ended.restsVerified || 0;
    restTotals.cups += ended.cups || 0; restTotals.cupsDue += ended.cupsDue || 0;
  }
  shifts.delete(workerId);
  const a = openAlertFor(workerId);
  if (a && a.stage !== 'medic') resolve(a, by, 'shift ended');
  log(by, 'shift_ended', users[workerId].name);
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
  if (reason === 'checkin_due') {
    const LW = users[sh.workerId].lang;
    notify(sh.workerId, `${tr(LW, 'areyouok')} ${tr(LW, 'tapok')}`, 'checkin', true);
  }
  if (reason === 'no_signal' && stage === 'buddy') {
    const bid = users[sh.workerId].buddy;
    notify(bid, `${tr(users[bid].lang, 'buddyTitle', { name: users[sh.workerId].name })}. ${tr(users[bid].lang, 'buddyBody')}`, 'buddy', true);
  }
  if (reason === 'checkin_due' && users[sh.workerId].channel === 'sms') {
    const L = users[sh.workerId].lang;
    sendSms(sh.workerId, `HeatMitra: ${tr(L, 'areyouok')} ${tr(L, 'smsReply')}`);
  }
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

function recordCheckin(sh, status, symptoms, by, exertion = null) {
  sh.lastCheckin = now();
  sh.lastHeartbeat = now();
  const allowed = (symptoms || []).filter((s) => Heat.SYMPTOMS.includes(s));
  checkins.push({ workerId: sh.workerId, at: now(), status, by, exertion });
  if (!sh.simulated) {
    if (status === 'unwell') learn(sh, 1);
    else if (exertion) learn(sh, { veryhard: 1, hard: 0.3, easy: 0 }[exertion]);
  }
  const open = openAlertFor(sh.workerId);
  if (status === 'ok') {
    if (open && open.stage !== 'medic') resolve(open, users[sh.workerId].name, 'worker confirmed OK');
    // Perceived exertion (Tikuisis et al. 2002): "very hard" gets rest advice; twice in a row asks the supervisor to check.
    const twice = exertion === 'veryhard' && sh.lastExertion === 'veryhard';
    if (exertion) sh.lastExertion = exertion;
    if (twice && !openAlertFor(sh.workerId)) openAlert(sh, 'exertion', 'supervisor');
    return { action: exertion === 'veryhard' ? 'exertion' : 'continue' };
  }
  const red = allowed.some((s) => Heat.RED_FLAGS.includes(s));
  const severity = red ? 'emergency' : 'review';
  const markEmergency = (al) => { if (red && !al.emergencyAt) al.emergencyAt = now(); };
  const shared = consent.get(sh.workerId)?.symptoms ? allowed : null; // nothing stored without consent
  if (open) {
    open.severity = severity;
    markEmergency(open);
    open.symptoms = shared;
    if (!open.firstHumanAt) open.firstHumanAt = now();
    if (open.stage !== 'medic') advance(open, 'medic', users[sh.workerId].name, 'worker reported feeling unwell');
  } else {
    markEmergency(openAlert(sh, 'reported_unwell', 'medic', { severity, symptoms: shared }));
  }
  return { action: red ? 'emergency' : 'rest', emergency: sites[sh.siteId].emergency };
}

async function sweep() {
  const t = now();
  for (const sh of shifts.values()) {
    const isSms = users[sh.workerId].channel === 'sms';
    if ((sh.simulated && !sh.silent) || isSms) sh.lastHeartbeat = t; // basic phones have no app heartbeat
    let open = openAlertFor(sh.workerId);
    if (!open && t - sh.lastHeartbeat > T.heartbeatTimeout * 1000) {
      openAlert(sh, 'no_signal', buddyFor(sh) ? 'buddy' : 'supervisor');
      continue;
    }
    const prevBand = sh.band;
    try { await workerView(sh); } catch { continue; }
    const L = users[sh.workerId].lang;
    // Acclimatisation: count minutes worked in the heat (not resting, not green) against today's cap.
    const dtMin = (t - (sh.lastTick || t)) / (T.checkinScale * 1000);
    sh.lastTick = t;
    if (sh.acc && sh.acc.cap < 100 && !sh.capUsed) {
      if (sh.band !== 'green' && restInfo(sh).phase === 'work') sh.heatMin = (sh.heatMin || 0) + dtMin;
      if (sh.heatMin >= Math.round((SHIFT_MIN * sh.acc.cap) / 100)) {
        sh.capUsed = true;
        log('system', 'exposure_cap_reached', `${users[sh.workerId].name}: safe heat time for today used up (${sh.acc.kind}, day ${sh.acc.day})`);
        notify(sh.workerId, tr(L, 'capUsed'), 'cap', true);
        await workerView(sh);
      }
    }
    // Tell the worker's phone when risk rises (only rises: fewer, more meaningful alerts).
    // Water due in the heat (any band above green); simulated workers drink most of it.
    if (sh.band !== 'green') {
      const before = Math.floor(sh.cupsDue || 0);
      sh.cupsDue = (sh.cupsDue || 0) + (dtMin * CUPS_PER_HOUR) / 60;
      if (sh.simulated && !sh.silent && Math.floor(sh.cupsDue) > before && Math.random() < 0.8) sh.cups = (sh.cups || 0) + 1;
    }
    if (!sh.simulated && prevBand && Heat.BANDS.indexOf(sh.band) > Heat.BANDS.indexOf(prevBand)) {
      notify(sh.workerId, `${tr(L, `b_${sh.band}`)}. ${tr(L, `a_${sh.band}`)}`, 'band', sh.band === 'red');
    }
    if (isSms && sh.smsBand !== sh.band) { // tell basic-phone workers when their risk changes
      sh.smsBand = sh.band;
      const L = users[sh.workerId].lang;
      sendSms(sh.workerId, `HeatMitra: ${tr(L, `b_${sh.band}`)}. ${tr(L, `a_${sh.band}`)}`);
    }
    // Count each rest break the plan calls for; simulated workers take most of them.
    const cyc = 60 * T.checkinScale * 1000;
    const ci = Math.floor((t - sh.startedAt) / cyc);
    if (sh.workMin < 60 && (t - sh.startedAt) % cyc >= sh.workMin * T.checkinScale * 1000 && sh.restDueCycle !== ci) {
      sh.restDueCycle = ci;
      sh.restsDue++;
      if (sh.simulated && !sh.silent && Math.random() < 0.85) {
        sh.restAckCycle = ci; sh.restsTaken++;
        if (Math.random() < 0.75) { sh.verifiedCycle = ci; sh.restsVerified = (sh.restsVerified || 0) + 1; }
      }
      if (!sh.simulated) notify(sh.workerId, `${tr(L, 'restNow')}. ${tr(L, 'rest')}.`, 'rest');
    }
    if (!sh.checkinMin) continue;
    const due = sh.lastCheckin + sh.checkinMin * T.checkinScale * 1000;
    if (t < due) continue;
    if (sh.simulated && !sh.silent) { recordCheckin(sh, 'ok', [], 'simulated'); continue; }
    if (!open) openAlert(sh, 'checkin_due', 'worker');
  }
  for (const a of alerts) {
    if (a.status !== 'open') continue;
    const el = (t - a.stageAt) / 1000;
    if (a.stage === 'worker' && el > T.workerStage) {
      const sh = shifts.get(a.workerId);
      const b = sh && buddyFor(sh);
      if (b) {
        advance(a, 'buddy', 'system', `no response from worker; asking buddy ${users[b.workerId].name}`);
        const LB = users[b.workerId].lang;
        notify(b.workerId, `${tr(LB, 'buddyTitle', { name: users[a.workerId].name })}. ${tr(LB, 'buddyBody')}`, 'buddy', true);
      }
      else advance(a, 'supervisor', 'system', 'no response from worker');
    } else if (a.stage === 'buddy') {
      const bsh = shifts.get(users[a.workerId].buddy);
      if (bsh && bsh.simulated && !bsh.silent && el > 6) resolve(a, users[bsh.workerId].name, 'buddy checked: worker OK');
      else if (el > T.buddyStage) advance(a, 'supervisor', 'system', 'no response from buddy');
    } else if (a.stage === 'supervisor' && el > T.supervisorStage) advance(a, 'medic', 'system', 'no response from supervisor');
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
    startedAt: now(), lastHeartbeat: now(), lastCheckin: now(), simulated, silent: false, band: null, checkinMin: null,
    workMin: 60, restsDue: 0, restsTaken: 0, restDueCycle: -1, restAckCycle: -1, heatMin: 0, capUsed: false,
  };
  const today = localParts(sites[w.siteId].tz).date; // today counts as a day in the heat
  if (!users[w.id].heatDates.includes(today)) users[w.id].heatDates.push(today);
  shifts.set(w.id, sh);
  log(simulated ? 'demo' : w.name, 'shift_started', `${w.name} ${sh.workload}`);
  return sh;
}

function alertPublic(a, withClinical) {
  const out = {
    emergencyAt: a.emergencyAt || null, coolingAt: a.coolingAt || null, ambulanceAt: a.ambulanceAt || null, cooledAt: a.cooledAt || null,
    id: a.id, worker: users[a.workerId].name, workerId: a.workerId, reason: a.reason, stage: a.stage, status: a.status,
    severity: a.severity, band: a.band, openedAt: a.openedAt, stageAt: a.stageAt, history: a.history,
  };
  if (withClinical) {
    out.symptoms = a.symptoms;
    out.strain = a.strain || null;
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
    byReason: Object.fromEntries(['checkin_due', 'no_signal', 'reported_unwell', 'high_strain', 'exertion'].map((r) => [r, alerts.filter((a) => a.reason === r).length])),
    buddyChecks: alerts.filter((a) => a.history.some((h) => h.stage === 'buddy')).length,
    checkinPromptResponseRate: prompted.length ? Math.round((answered.length / prompted.length) * 100) : null,
    coolingCases: alerts.filter((a) => a.coolingAt).length,
    medianTimeToCoolingSec: (() => { const v = alerts.filter((a) => a.coolingAt).map((a) => (a.coolingAt - (a.emergencyAt || a.openedAt)) / 1000).sort((x, y) => x - y); return v.length ? Math.round(v[Math.floor(v.length / 2)]) : null; })(),
    medianResponseSec: resp.length ? Math.round(resp[Math.floor(resp.length / 2)]) : null,
    checkins: checkins.length,
    personalisedWorkers: [...shifts.values()].filter((s) => Heat.personalOffset(users[s.workerId].personal) > 0).length,
    newOrReturning: [...shifts.values()].filter((s) => s.acc && s.acc.kind !== 'acclimatised').length,
    pushSubscribed: [...pushSubs.values()].filter((l) => l.length).length,
    noticesSent,
    breakScore: (() => { const site = [...shifts.values()][0] ? sites[[...shifts.values()][0].siteId] : null; return site ? breakCheck(site).score : null; })(),
    restAdherence: (() => {
      const live = [...shifts.values()];
      const due = restTotals.due + live.reduce((s, x) => s + x.restsDue, 0);
      const taken = restTotals.taken + live.reduce((s, x) => s + x.restsTaken, 0);
      return due ? Math.round((taken / due) * 100) : null;
    })(),
    veryHardPct: (() => {
      const rated = checkins.filter((c) => c.exertion);
      return rated.length ? Math.round((rated.filter((c) => c.exertion === 'veryhard').length / rated.length) * 100) : null;
    })(),
    outcomes: Object.fromEntries(Object.keys(OUTCOMES).map((k) => [k, alerts.filter((a) => a.outcome === k).length])),
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
    req.on('end', () => {
      try {
        if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return ok(Object.fromEntries(new URLSearchParams(s)));
        ok(s ? JSON.parse(s) : {});
      } catch { fail(new Error('bad json')); }
    });
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

  // Station codes are printed on posters at the site; they are not given out in the public config.
  if (m === 'GET' && p === '/api/config') return send(res, 200, { demo: DEMO, timing: T, sites: Object.values(sites).map((x) => ({ ...x, stations: (x.stations || []).map(({ id, name }) => ({ id, name })) })) });
  if (m === 'GET' && p === '/api/users') {
    if (!DEMO) return send(res, 404, { error: 'demo only' });
    return send(res, 200, seed.users.map(({ id, role, name, lang, channel, phone }) => ({ id, role, name, lang, channel: channel || 'app', phone })));
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
    return send(res, 200, {
      site, mode: sn.fc.mode, source: sn.fc.source, stale: sn.fc.stale, fetchedAt: sn.fc.fetchedAt, nowTime: sn.time, hourly: sn.day,
      outlook: outlookFor(site, sn.fc, sn.time.slice(0, 10)),
    });
  }

  if (m === 'GET' && p === '/api/heatmap') {
    const site = sites[url.searchParams.get('site')];
    if (!site) return send(res, 404, { error: 'no such site' });
    let g;
    const raw = url.searchParams.get('pts');
    if (raw) {
      // H3 hexagon centres from the browser: at most 100, all within 0.6° of the site.
      const coords = raw.split(';').slice(0, 101).map((s) => s.split(',').map(Number));
      const ok = coords.length <= 100 && coords.every((c) => c.length === 2 && c.every(Number.isFinite)
        && Math.abs(c[0] - site.lat) <= 0.6 && Math.abs(c[1] - site.lon) <= 0.6);
      if (!ok) return send(res, 400, { error: 'pts must be up to 100 "lat,lon" pairs within 0.6° of the site' });
      g = await weather.points(site, site.replayDate, coords.map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]));
    } else g = await weather.grid(site, site.replayDate);
    const work = (r) => { const h = Number(r.time.slice(11, 13)); return h >= 5 && h <= 19; };
    return send(res, 200, {
      site: { id: site.id, name: site.name, lat: site.lat, lon: site.lon, middayBan: site.middayBan },
      mode: g.mode, date: g.date, source: g.source, stale: g.stale, n: g.n, step: g.step,
      points: g.points.map((pt) => ({ lat: pt.lat, lon: pt.lon, hourly: pt.hourly.filter(work) })),
    });
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
      buddy: u.buddy ? { name: users[u.buddy].name } : null,
      buddyTask: (() => { const ba = u.buddy && openAlertFor(u.buddy); return ba && ba.stage === 'buddy' ? { id: ba.id, name: users[u.buddy].name } : null; })(),
      alert: a ? { id: a.id, stage: a.stage, reason: a.reason, severity: a.severity } : null,
      rest: { ...restInfo(sh), verified: sh.verifiedCycle === Math.floor((now() - sh.startedAt) / (60 * T.checkinScale * 1000)) },
      water: { cups: sh.cups || 0, due: Math.floor(sh.cupsDue || 0) },
      acclim: { ...sh.acc, heatMin: Math.round(sh.heatMin || 0), capMin: Math.round((SHIFT_MIN * (sh.acc ? sh.acc.cap : 100)) / 100) },
      personal: { offset: Heat.personalOffset(users[u.id].personal), n: users[u.id].personal ? users[u.id].personal.n : 0 },
      cooling: { spot: v.site.coolSpot || null, vests: Boolean(readyToday(v.site).vests) },
      push: { subscribed: (pushSubs.get(u.id) || []).length > 0 },
      serverTime: now(),
    });
  }
  if (p === '/api/shift/start' && m === 'POST') { need(u, 'worker'); startShift(u, await body(req)); return send(res, 200, { ok: true }); }
  if (p === '/api/shift/end' && m === 'POST') {
    need(u, 'worker');
    endShift(u.id, u.name);
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
    const ex = ['easy', 'hard', 'veryhard'].includes(b.exertion) ? b.exertion : null;
    return send(res, 200, recordCheckin(sh, b.status === 'unwell' ? 'unwell' : 'ok', b.symptoms, u.name, ex));
  }
  // Worker confirms they are taking the rest break the plan calls for.
  // Break check: the worker scans the QR (or types the code) at a rest station.
  if (p === '/api/rest/verify' && m === 'POST') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    if (!sh) return send(res, 409, { error: 'no active shift' });
    const b = await body(req);
    const code = String(b.code || '').replace(/\D/g, '').slice(0, 8);
    const st = (sites[sh.siteId].stations || []).find((x) => x.code === code);
    if (!st) return send(res, 404, { error: 'not a rest station on this site' });
    sh.lastHeartbeat = now();
    const ci = Math.floor((now() - sh.startedAt) / (60 * T.checkinScale * 1000));
    const r = restInfo(sh);
    if (r.phase !== 'rest') return send(res, 200, { verified: false, station: st.name });
    if (sh.restAckCycle !== ci) {
      if (sh.restDueCycle !== ci) { sh.restDueCycle = ci; sh.restsDue++; }
      sh.restAckCycle = ci; sh.restsTaken++;
    }
    if (sh.verifiedCycle !== ci) { sh.verifiedCycle = ci; sh.restsVerified = (sh.restsVerified || 0) + 1; }
    return send(res, 200, { verified: true, station: st.name });
  }
  if (p === '/api/water' && m === 'POST') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    if (!sh) return send(res, 409, { error: 'no active shift' });
    sh.cups = Math.min(60, (sh.cups || 0) + 1);
    sh.lastHeartbeat = now();
    return send(res, 200, { cups: sh.cups });
  }
  // Supervisor: break-check score, station audits and poster codes.
  if (p === '/api/breakcheck' && m === 'GET') {
    need(u, 'supervisor');
    const site = sites[url.searchParams.get('site') || u.siteId];
    if (!site) return send(res, 404, { error: 'no such site' });
    return send(res, 200, { ...breakCheck(site), codes: Object.fromEntries((site.stations || []).map((x) => [x.id, x.code])), auditItems: AUDIT_ITEMS, auditEveryMin: AUDIT_EVERY_MIN });
  }
  if (p === '/api/station/audit' && m === 'POST') {
    need(u, 'supervisor');
    const b = await body(req);
    const site = sites[b.siteId];
    const st = site && (site.stations || []).find((x) => x.id === b.stationId);
    if (!st) return send(res, 404, { error: 'no such station' });
    const items = Object.fromEntries(AUDIT_ITEMS.map((k) => [k, Boolean(b.items && b.items[k])]));
    site.audits = { ...(site.audits || {}), [st.id]: { at: now(), by: u.name, items } };
    const fails = AUDIT_ITEMS.filter((k) => !items[k]);
    log(u.name, 'station_audit', `${site.id}/${st.name}: ${fails.length ? `problems: ${fails.join(', ')}` : 'all OK'}`);
    return send(res, 200, breakCheck(site));
  }
  if (p === '/api/rest' && m === 'POST') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    if (!sh) return send(res, 409, { error: 'no active shift' });
    const ci = Math.floor((now() - sh.startedAt) / (60 * T.checkinScale * 1000));
    if (restInfo(sh).phase === 'rest' && sh.restAckCycle !== ci) {
      if (sh.restDueCycle !== ci) { sh.restDueCycle = ci; sh.restsDue++; }
      sh.restAckCycle = ci;
      sh.restsTaken++;
    }
    sh.lastHeartbeat = now();
    return send(res, 200, restInfo(sh));
  }
  // Wearable strain: the phone computes PSI from heart rate and only reports it when it is high.
  if (p === '/api/strain' && m === 'POST') {
    need(u, 'worker');
    const sh = shifts.get(u.id);
    if (!sh) return send(res, 409, { error: 'no active shift' });
    const b = await body(req);
    const psi = Number(b.psi), ct = Number(b.ct);
    if (!(psi >= 0 && psi <= 10) || !(ct > 34 && ct < 43)) return send(res, 400, { error: 'bad strain values' });
    sh.lastHeartbeat = now();
    if (psi < 7) return send(res, 200, { action: 'continue' });
    learn(sh, 1);
    const shared = consent.get(u.id)?.symptoms ? { psi, ct: Math.round(ct * 10) / 10 } : null;
    let a = openAlertFor(u.id);
    if (!a) a = openAlert(sh, 'high_strain', 'supervisor', { severity: psi >= 9 ? 'emergency' : 'urgent' });
    a.strain = shared;
    if (psi >= 9) { a.severity = 'emergency'; a.emergencyAt = a.emergencyAt || now(); if (a.stage !== 'medic') advance(a, 'medic', u.name, 'very high heat strain from wearable'); }
    return send(res, 200, { action: psi >= 9 ? 'emergency' : 'stop', emergency: sites[sh.siteId].emergency });
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
        acclim: s.acc && s.acc.kind !== 'acclimatised' ? { kind: s.acc.kind, day: s.acc.day, of: s.acc.of } : null,
        heatPct: s.acc && s.acc.cap < 100 ? Math.min(100, Math.round(((s.heatMin || 0) / ((SHIFT_MIN * s.acc.cap) / 100)) * 100)) : null,
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
  // Buddy answers a "check on your buddy" request. Buddies see no clinical detail.
  const bud = p.match(/^\/api\/alerts\/([a-f0-9]+)\/buddy$/);
  if (bud && m === 'POST') {
    need(u, 'worker');
    const a = alerts.find((x) => x.id === bud[1] && x.status === 'open');
    if (!a || a.stage !== 'buddy' || users[a.workerId].buddy !== u.id) return send(res, 404, { error: 'no buddy check for you' });
    const b = await body(req);
    if (!a.firstHumanAt) a.firstHumanAt = now();
    if (b.result === 'help') {
      a.severity = 'emergency';
      a.emergencyAt = a.emergencyAt || now();
      advance(a, 'medic', u.name, 'buddy says the worker needs help: possible heat stroke');
      return send(res, 200, { ok: true, action: 'cfts' });
    }
    resolve(a, u.name, 'buddy checked: worker OK');
    return send(res, 200, { ok: true });
  }

  // SMS gateway webhook (Twilio-style From/Body, JSON or form-encoded). Commands: START, STOP, 1 = OK, 2 = unwell.
  if (p === '/api/sms/inbound' && m === 'POST') {
    if (!DEMO && (!process.env.SMS_SECRET || req.headers['x-sms-secret'] !== process.env.SMS_SECRET)) return send(res, 403, { error: 'bad gateway secret' });
    const b = await body(req);
    const from = String(b.From || b.from || '');
    const text = String(b.Body || b.body || '').trim();
    const w = Object.values(users).find((x) => x.phone && x.phone === from);
    if (!w) return send(res, 404, { error: 'unknown number' });
    outbox.push({ phone: from, text: text.slice(0, 160), at: now(), dir: 'in' });
    const L = w.lang;
    const cmd = text.toUpperCase();
    const sh = shifts.get(w.id);
    if (cmd === 'START') { if (!sh) startShift(w, {}); sendSms(w.id, `HeatMitra: ${tr(L, 'smsStart')}`); }
    else if (cmd === 'STOP') { if (sh) endShift(w.id, `${w.name} (SMS)`); sendSms(w.id, `HeatMitra: ${tr(L, 'smsEnd')}`); }
    else if (!sh) sendSms(w.id, 'HeatMitra: START');
    else if (cmd === '1') { recordCheckin(sh, 'ok', [], `${w.name} (SMS)`); sendSms(w.id, `HeatMitra: ✓ ${tr(L, `a_${sh.band || 'green'}`)}`); }
    else if (cmd === '2') { recordCheckin(sh, 'unwell', [], `${w.name} (SMS)`); sendSms(w.id, `HeatMitra: ${tr(L, 'restTitle')}. ${tr(L, 'restBody')}`); }
    else sendSms(w.id, `HeatMitra: ${tr(L, 'smsReply')}`);
    return send(res, 200, { ok: true });
  }
  if (DEMO && p === '/api/sms/thread' && m === 'GET') {
    need(u, 'supervisor');
    const phone = url.searchParams.get('phone');
    return send(res, 200, outbox.filter((x) => x.phone === phone).slice(-30));
  }

  const ack = p.match(/^\/api\/alerts\/([a-f0-9]+)\/(ack|escalate|attend|resolve|cooling|ambulance|cooled)$/);
  if (ack && m === 'POST') {
    const a = alerts.find((x) => x.id === ack[1]);
    if (!a || a.status !== 'open') return send(res, 404, { error: 'no open alert' });
    const act = ack[2];
    if (act === 'ack' || act === 'escalate') need(u, 'supervisor');
    else need(u, 'medic');
    if (!a.firstHumanAt) a.firstHumanAt = now();
    if (act === 'ack') resolve(a, u.name, 'supervisor checked on worker: OK');
    if (act === 'escalate') advance(a, 'medic', u.name, 'supervisor requested first-aider');
    const COOL = { cooling: ['coolingAt', 'cooling started on site'], ambulance: ['ambulanceAt', 'ambulance called: cooling on site first'], cooled: ['cooledAt', 'cooling finished, handed to ambulance'] };
    if (COOL[act]) {
      const [field, note] = COOL[act];
      if (!a[field]) { a[field] = now(); a.history.push({ stage: 'medic', at: now(), by: u.name, note }); log(u.name, `cfts_${act}`, `${a.id}${act === 'cooling' ? ` (${Math.round((a.coolingAt - (a.emergencyAt || a.openedAt)) / 1000)} s after the alert)` : ''}`); }
    }
    if (act === 'attend') { a.history.push({ stage: 'medic', at: now(), by: u.name, note: 'first-aider attending' }); log(u.name, 'alert_attending', a.id); }
    if (act === 'resolve') {
      const b2 = await body(req);
      a.outcome = OUTCOMES[b2.outcome] ? b2.outcome : null;
      resolve(a, u.name, a.outcome ? `first-aider closed: ${OUTCOMES[a.outcome]}` : 'first-aider closed the case');
    }
    return send(res, 200, alertPublic(a, u.role === 'medic'));
  }
  if (p === '/api/audit' && m === 'GET') { need(u, 'supervisor', 'medic'); return send(res, 200, audit.slice(-60).reverse()); }
  // On-site WBGT meter reading: store the offset between measured and modelled WBGT for this hour
  // and apply it to every plan at the site (ISO 7243 prefers measured WBGT).
  if (p === '/api/site/calibrate' && m === 'POST') {
    need(u, 'supervisor');
    const b = await body(req);
    const site = sites[b.siteId];
    if (!site) return send(res, 404, { error: 'no such site' });
    if (b.wbgt == null || b.wbgt === '') { site.calib = 0; log(u.name, 'site_calibration_cleared', site.id); return send(res, 200, site); }
    const meas = Number(b.wbgt);
    if (!(meas >= 10 && meas <= 45)) return send(res, 400, { error: 'WBGT reading must be between 10 and 45 °C' });
    const sn = await siteNow(site);
    const r = sn.day[sn.idx];
    const model = Heat.wbgt(r.t, r.rh, r.sw, r.wind);
    site.calib = Math.max(-6, Math.min(6, Math.round((meas - model) * 10) / 10));
    log(u.name, 'site_calibrated', `${site.id}: sensor ${meas} °C vs model ${model.toFixed(1)} °C -> offset ${site.calib}`);
    return send(res, 200, site);
  }
  // Morning site-readiness check (shade, water, cold-water tub, first-aider...): signed by the supervisor, audited.
  if (p === '/api/site/readiness' && m === 'POST') {
    need(u, 'supervisor');
    const b = await body(req);
    const site = sites[b.siteId];
    if (!site) return send(res, 404, { error: 'no such site' });
    const items = Object.fromEntries(READY_ITEMS.map((k) => [k, Boolean(b.items && b.items[k])]));
    site.readiness = { date: localParts(site.tz).date, items, by: u.name, at: now() };
    if (typeof b.coolSpot === 'string') site.coolSpot = b.coolSpot.trim().slice(0, 80);
    const missing = CRITICAL_ITEMS.filter((k) => !items[k]);
    log(u.name, 'site_readiness', `${site.id}: ${READY_ITEMS.filter((k) => items[k]).length}/${READY_ITEMS.length} ready${missing.length ? `; missing: ${missing.join(', ')}` : ''}`);
    return send(res, 200, site);
  }
  // Background alerts: VAPID key, subscribe, and the notice a woken service worker shows.
  if (p === '/api/push/key' && m === 'GET') return send(res, 200, { key: push.publicKey });
  if (p === '/api/push/subscribe' && m === 'POST') {
    need(u, 'worker');
    const b = await body(req);
    const s = b.subscription;
    if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint)) return send(res, 400, { error: 'bad subscription' });
    const list = (pushSubs.get(u.id) || []).filter((x) => x.endpoint !== s.endpoint);
    list.push({ endpoint: s.endpoint });
    pushSubs.set(u.id, list.slice(-3));
    log(u.name, 'push_subscribed', u.name);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/push/latest' && m === 'POST') {
    const b = await body(req);
    const owner = [...pushSubs].find(([, l]) => l.some((x) => x.endpoint === b.endpoint));
    const n = owner && latestNotice.get(owner[0]);
    return send(res, 200, n || { title: 'HeatMitra', body: 'Open HeatMitra', tag: 'heatmitra' });
  }
  if (p === '/api/site/rule' && m === 'POST') {
    need(u, 'supervisor');
    const b = await body(req);
    const site = sites[b.siteId];
    if (!site) return send(res, 404, { error: 'no such site' });
    site.middayBan = Heat.RULES[b.rule] ? b.rule : false;
    log(u.name, 'site_rules', `${site.id} -> ${site.middayBan ? Heat.RULES[site.middayBan].name : 'no midday ban'}`);
    return send(res, 200, site);
  }
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
    seed.users.filter((w) => w.role === 'worker' && w.channel !== 'sms' && w.siteId === u.siteId && !shifts.has(w.id)).forEach((w) => startShift(w, {}, true));
    return send(res, 200, { ok: true });
  }
  const tst = p.match(/^\/api\/demo\/notify\/(\w+)$/);
  if (DEMO && tst && m === 'POST') { // demo: send a test background alert to a worker's phone
    need(u, 'supervisor');
    const w = users[tst[1]];
    if (!w || w.role !== 'worker') return send(res, 404, { error: 'no such worker' });
    notify(w.id, `${tr(w.lang, 'areyouok')} ${tr(w.lang, 'tapok')}`, 'test', true);
    log(u.name, 'test_alert', w.name);
    return send(res, 200, { ok: true, subscribed: (pushSubs.get(w.id) || []).length > 0 });
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

// ---------- Persistence: snapshot state to disk, restore at start ----------
// Survives process restarts on any host with a disk (or a mounted volume). Render's free plan has no
// persistent disk, so a redeploy there still starts fresh; a production deployment would use a database.
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, 'data', 'cache', 'state.json');
function snapshot() {
  return {
    v: 1, at: now(),
    shifts: [...shifts.values()], alerts, checkins, audit, outbox,
    consent: [...consent], tokens: [...tokens].map(([t, u]) => [t, u.id]),
    workers: Object.fromEntries(Object.values(users).filter((u) => u.role === 'worker').map((u) => [u.id, { heatDates: u.heatDates, personal: u.personal || null }])),
    pushSubs: [...pushSubs], latestNotice: [...latestNotice], restTotals, noticesSent,
    sites: Object.fromEntries(Object.values(sites).map((x) => [x.id, { replayDate: x.replayDate, calib: x.calib, middayBan: x.middayBan, readiness: x.readiness, coolSpot: x.coolSpot, audits: x.audits }])),
  };
}
function restore() {
  let j;
  try { j = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return; }
  if (!j || j.v !== 1 || now() - j.at > RETAIN_MS) return; // older than the retention window: start fresh
  const t = now();
  for (const sh of j.shifts || []) if (users[sh.workerId]) shifts.set(sh.workerId, { ...sh, lastHeartbeat: t, lastTick: t }); // grace after restart
  alerts.push(...(j.alerts || []));
  checkins.push(...(j.checkins || []));
  audit.push(...(j.audit || []));
  outbox.push(...(j.outbox || []));
  for (const [k, v] of j.consent || []) consent.set(k, v);
  for (const [tok, id] of j.tokens || []) if (users[id]) tokens.set(tok, users[id]);
  for (const [id, w] of Object.entries(j.workers || {})) if (users[id]) Object.assign(users[id], w);
  for (const [k, v] of j.pushSubs || []) pushSubs.set(k, v);
  for (const [k, v] of j.latestNotice || []) latestNotice.set(k, v);
  Object.assign(restTotals, j.restTotals || {});
  noticesSent = j.noticesSent || 0;
  for (const [id, v] of Object.entries(j.sites || {})) if (sites[id]) Object.assign(sites[id], v);
  log('system', 'state_restored', `${shifts.size} shifts, ${alerts.length} alerts, saved ${Math.round((t - j.at) / 1000)} s ago`);
}
let lastSaved = '';
function save(sync = false) {
  const json = JSON.stringify(snapshot());
  if (json === lastSaved) return;
  lastSaved = json;
  const tmp = `${STATE_FILE}.tmp`;
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    if (sync) { fs.writeFileSync(tmp, json); fs.renameSync(tmp, STATE_FILE); } else fs.writeFile(tmp, json, (e) => { if (!e) fs.rename(tmp, STATE_FILE, () => {}); });
  } catch (e) { console.error('[save]', e.message); }
}
restore();
setInterval(() => save(), 10000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { save(true); process.exit(0); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  try { await api(req, res, url); } catch (e) { send(res, e.code || 500, { error: e.message }); }
}).listen(PORT, () => console.log(`HeatMitra on http://localhost:${PORT} (demo mode: ${DEMO})`));
