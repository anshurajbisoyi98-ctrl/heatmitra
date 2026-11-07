'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Heat = require('../public/heat.js');

test('NIOSH limits for moderate work (300 W)', () => {
  assert.ok(Math.abs(Heat.limit(300, true) - 28.2) < 0.1, 'REL ≈ 28.2 °C');
  assert.ok(Math.abs(Heat.limit(300, false) - 25.0) < 0.1, 'RAL ≈ 25.0 °C');
});

test('Stull wet bulb and ISO 7243 outdoor WBGT', () => {
  assert.ok(Math.abs(Heat.wetBulb(20, 50) - 13.7) < 0.2, 'Stull reference value');
  assert.ok(Math.abs(Heat.wbgt(35, 50, 0, 10) - 29.1) < 0.2, 'shade: 0.7·Tw + 0.3·Ta');
  assert.ok(Heat.wbgt(40, 60, 0, 10) > Heat.wbgt(40, 20, 0, 10), 'humidity raises WBGT');
  const sun = Heat.wbgt(38, 40, 850, 5) - Heat.wbgt(38, 40, 0, 5);
  assert.ok(sun > 2 && sun < 4, `full sun adds 2-4 °C WBGT (got ${sun.toFixed(2)})`);
  assert.ok(Heat.wbgt(38, 40, 850, 30) < Heat.wbgt(38, 40, 850, 5), 'wind lowers the sun load');
});

test('bands get worse with heat, workload, clothing and no acclimatisation', () => {
  const base = { t: 33, rh: 45, workload: 'moderate', clothing: 'standard', daysOnSite: 30 };
  const rank = (o) => Heat.BANDS.indexOf(Heat.assess(o).band);
  assert.ok(rank({ ...base, t: 24 }) <= rank(base));
  assert.ok(rank({ ...base, workload: 'veryheavy' }) >= rank(base));
  assert.ok(rank({ ...base, clothing: 'vapourbarrier' }) >= rank(base));
  assert.ok(rank({ ...base, daysOnSite: 1 }) >= rank(base));
  assert.strictEqual(Heat.assess({ ...base, t: 20, rh: 40 }).band, 'green');
  assert.strictEqual(Heat.assess({ ...base, t: 42, rh: 60, workload: 'heavy' }).band, 'red');
});

test('work fraction falls as WBGT rises and stays in [0, 1]', () => {
  let prev = 1;
  for (let w = 24; w <= 36; w += 0.5) {
    const f = Heat.workFraction(w, 415, true);
    assert.ok(f >= 0 && f <= 1);
    assert.ok(f <= prev + 1e-9);
    prev = f;
  }
});

test('UAE midday ban: 15 Jun to 15 Sep, 12:00 to 14:59 slots', () => {
  assert.ok(Heat.inMiddayBan('2025-07-10T13:00'));
  assert.ok(!Heat.inMiddayBan('2025-07-10T15:00'));
  assert.ok(!Heat.inMiddayBan('2025-10-10T13:00'));
  const a = Heat.assess({ t: 25, rh: 30, workload: 'light', clothing: 'standard', daysOnSite: 30, time: '2025-07-10T12:00', middayBan: true });
  assert.strictEqual(a.band, 'red');
  assert.strictEqual(a.middayBan, true);
});

test('core temperature from heart rate (Buller 2013) and PSI (Moran 1998)', () => {
  let s = null;
  for (let i = 0; i < 60; i++) s = Heat.coreTempStep(s, 83);
  assert.ok(Math.abs(s.ct - 37.1) < 0.1, `resting HR keeps core temp near 37.1 (got ${s.ct.toFixed(2)})`);
  let hot = null;
  for (let i = 0; i < 120; i++) hot = Heat.coreTempStep(hot, 160);
  assert.ok(hot.ct > 38 && hot.ct < 40, `sustained HR 160 raises core temp (got ${hot.ct.toFixed(2)})`);
  assert.strictEqual(Heat.psi(37.1, 70), 0);
  assert.strictEqual(Heat.psi(39.5, 180), 10);
  assert.strictEqual(Heat.psiBand(7.5), 'high');
});

test('on-site sensor calibration shifts WBGT', () => {
  const o = { t: 35, rh: 50, sw: 600, wind: 10, workload: 'moderate', clothing: 'standard', daysOnSite: 30 };
  assert.ok(Math.abs(Heat.assess({ ...o, calib: 2 }).wbgt - Heat.assess(o).wbgt - 2) < 0.11);
});

test('country rule packs: ban windows and Qatar WBGT stop rule', () => {
  assert.ok(Heat.inMiddayBan('2025-06-05T10:00', 'QAT'), 'Qatar starts 1 Jun at 10:00');
  assert.ok(!Heat.inMiddayBan('2025-06-05T10:00', 'UAE'), 'UAE starts 15 Jun');
  assert.ok(Heat.inMiddayBan('2025-07-10T15:00', 'KWT'), 'Kuwait runs to 16:00');
  assert.ok(!Heat.inMiddayBan('2025-07-10T15:00', 'KSA'), 'Saudi ends at 15:00');
  const cool = { t: 30, rh: 40, sw: 0, wind: 10, workload: 'light', clothing: 'standard', daysOnSite: 30, time: '2025-11-01T08:00' };
  assert.strictEqual(Heat.assess({ ...cool, middayBan: 'QAT' }).band, 'green');
  const humid = { ...cool, t: 36, rh: 70, sw: 700 };
  const q = Heat.assess({ ...humid, middayBan: 'QAT' });
  assert.ok(q.wbgt >= 32.1 && q.ruleStop && q.band === 'red', 'WBGT ≥ 32.1 °C stops work in Qatar');
});

test('acclimatisation plan: new, returning, weekend gap, long absence', () => {
  const days = (start, n) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 864e5).toISOString().slice(0, 10));
  assert.deepStrictEqual(Heat.acclimPlan([], '2025-07-10'), { kind: 'new', day: 1, of: 5, cap: 20, acclimatised: false, awayDays: null });
  assert.strictEqual(Heat.acclimPlan(days('2025-07-08', 2), '2025-07-10').cap, 60, 'day 3 of a new worker = 60%');
  const back = Heat.acclimPlan(days('2025-06-01', 20), '2025-07-02'); // last heat day 20 Jun, 12 days away
  assert.strictEqual(back.kind, 'returning');
  assert.strictEqual(back.cap, 50);
  assert.strictEqual(back.awayDays, 12);
  const weekend = Heat.acclimPlan([...days('2025-06-01', 12), '2025-06-15'], '2025-06-16'); // 2-day gaps don't reset
  assert.strictEqual(weekend.kind, 'acclimatised');
  assert.strictEqual(Heat.acclimPlan(days('2025-01-01', 30), '2025-07-01').kind, 'new', '6+ weeks away = new again');
});

test('dust and UV: PM10 bands, hazardous dust stops work', () => {
  assert.strictEqual(Heat.airAssess(100, 5).dust, 'green');
  assert.strictEqual(Heat.airAssess(300, 5).dust, 'orange');
  assert.strictEqual(Heat.airAssess(500, 11).uvHigh, true);
  const a = Heat.assess({ t: 25, rh: 30, workload: 'light', clothing: 'standard', daysOnSite: 30, pm10: 600 });
  assert.strictEqual(a.band, 'red');
  assert.strictEqual(a.dustStop, true);
});

test('personal limits only ever tighten', () => {
  let s = null;
  for (let i = 0; i < 4; i++) s = Heat.personalUpdate(s, -2, 1); // struggling well below the limit
  const tight = Heat.personalOffset(s);
  assert.ok(tight > 0.5 && tight <= 3, `struggles tighten the limit (got ${tight})`);
  let easy = null;
  for (let i = 0; i < 10; i++) easy = Heat.personalUpdate(easy, 1, 0); // fine even above the limit
  assert.strictEqual(Heat.personalOffset(easy), 0, 'never looser than the population limit');
  const o = { t: 34, rh: 40, sw: 600, wind: 10, workload: 'moderate', clothing: 'standard', daysOnSite: 30 };
  assert.ok(Heat.assess({ ...o, personal: 2 }).limit < Heat.assess(o).limit);
});

test('break-check compliance score', () => {
  const full = Heat.complianceScore({ restDue: 10, restTaken: 10, restVerified: 10, cupsDue: 30, cups: 30, auditsDue: 2, auditsOk: 2 });
  assert.strictEqual(full.score, 100);
  assert.strictEqual(full.flag, false);
  const selfOnly = Heat.complianceScore({ restDue: 10, restTaken: 10, restVerified: 0, cupsDue: 0, cups: 0, auditsDue: 0, auditsOk: 0 });
  assert.strictEqual(selfOnly.rest, 50, 'self-reported rest counts half');
  assert.strictEqual(selfOnly.water, null);
  const poor = Heat.complianceScore({ restDue: 10, restTaken: 4, restVerified: 2, cupsDue: 30, cups: 10, auditsDue: 2, auditsOk: 0 });
  assert.ok(poor.flag && poor.score < 80, `poor delivery is flagged (got ${poor.score})`);
  assert.strictEqual(Heat.complianceScore({ restDue: 0, restTaken: 0, restVerified: 0, cupsDue: 0, cups: 0, auditsDue: 0, auditsOk: 0 }).score, null);
});

test('advance warning finds the next rise', () => {
  const plan = ['green', 'green', 'yellow', 'red'].map((band, i) => ({ band, time: `2025-07-10T0${i + 6}:00` }));
  assert.deepStrictEqual(Heat.nextRise(plan, 0), { time: '2025-07-10T08:00', band: 'yellow', hoursAhead: 2 });
  assert.strictEqual(Heat.nextRise(plan, 3), null);
});
