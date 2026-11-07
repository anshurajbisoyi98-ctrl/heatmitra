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

test('advance warning finds the next rise', () => {
  const plan = ['green', 'green', 'yellow', 'red'].map((band, i) => ({ band, time: `2025-07-10T0${i + 6}:00` }));
  assert.deepStrictEqual(Heat.nextRise(plan, 0), { time: '2025-07-10T08:00', band: 'yellow', hoursAhead: 2 });
  assert.strictEqual(Heat.nextRise(plan, 3), null);
});
