'use strict';
/*
 * Back-test: Abu Dhabi (Mussafah), 1 Jun to 30 Sep 2025, working hours 06:00 to 17:59.
 *   "forecast" = Open-Meteo historical forecast API (model output as issued)
 *   "observed" = Open-Meteo historical weather API (ERA5 reanalysis)
 * The HeatMitra engine (public/heat.js) runs unchanged on both, and the decisions are compared.
 * Writes docs/BACKTEST.md and public/backtest.json.
 */
const fs = require('fs');
const path = require('path');
const Heat = require('../public/heat.js');

const SITE = { name: 'Abu Dhabi (Mussafah)', lat: 24.36, lon: 54.5, tz: 'Asia/Dubai' };
const START = '2025-06-01';
const END = '2025-09-30';
const HEAVY = { workload: 'heavy', clothing: 'standard', daysOnSite: 30 };
const MODERATE = { workload: 'moderate', clothing: 'standard', daysOnSite: 30 };
const VARS = 'temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m';

async function get(base, extra = {}) {
  const q = new URLSearchParams({ latitude: SITE.lat, longitude: SITE.lon, hourly: VARS, timezone: SITE.tz, start_date: START, end_date: END, ...extra });
  const r = await fetch(`${base}?${q}`);
  if (!r.ok) throw new Error(`${base} HTTP ${r.status}`);
  const h = (await r.json()).hourly;
  const out = new Map();
  h.time.forEach((t, i) => {
    if (h.temperature_2m[i] == null || h.relative_humidity_2m[i] == null) return;
    out.set(t, { time: t, t: h.temperature_2m[i], rh: h.relative_humidity_2m[i], sw: h.shortwave_radiation[i], wind: h.wind_speed_10m[i] });
  });
  return out;
}

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const R = (o, p, time) => Heat.assess({ ...p, t: o.t, rh: o.rh, sw: o.sw, wind: o.wind, time });

async function main() {
  const [fc, ob] = await Promise.all([
    get('https://historical-forecast-api.open-meteo.com/v1/forecast'),
    get('https://archive-api.open-meteo.com/v1/archive', { models: 'era5' }), // pure ERA5: the default blend reuses the forecast model
  ]);
  const c = { hours: 0, hit: 0, miss: 0, fa: 0, same: 0, under: 0, over: 0, minErr: 0, modDanger: 0, modOutsideBan: 0, heavyRed: 0 };
  const days = new Map();
  const bandCount = { green: 0, yellow: 0, orange: 0, red: 0 };
  let hottest = { wbgt: -1 };
  for (const [time, o] of ob) {
    const f = fc.get(time);
    const h = Number(time.slice(11, 13));
    if (!f || h < 6 || h > 17) continue;
    c.hours++;
    const ho = R(o, HEAVY, time), hf = R(f, HEAVY, time), mo = R(o, MODERATE, time);
    bandCount[ho.band]++;
    const ro = ho.band === 'red', rf = hf.band === 'red';
    if (ro && rf) c.hit++; else if (ro) c.miss++; else if (rf) c.fa++;
    if (ro) c.heavyRed++;
    const d = Heat.BANDS.indexOf(hf.band) - Heat.BANDS.indexOf(ho.band);
    if (d === 0) c.same++; else if (d < 0) c.under++; else c.over++;
    c.minErr += Math.abs(hf.workMin - ho.workMin);
    if (mo.margin > 0) { c.modDanger++; if (!Heat.inMiddayBan(time)) c.modOutsideBan++; }
    if (ho.wbgt > hottest.wbgt) hottest = { wbgt: ho.wbgt, time };
    const key = time.slice(0, 10);
    const day = days.get(key) || { firstObsRed: null, firstFcRed: null, maxWbgt: 0 };
    if (ro && day.firstObsRed == null) day.firstObsRed = h;
    if (rf && day.firstFcRed == null) day.firstFcRed = h;
    day.maxWbgt = Math.max(day.maxWbgt, ho.wbgt);
    days.set(key, day);
  }
  const both = [...days.values()].filter((d) => d.firstObsRed != null && d.firstFcRed != null);
  const res = {
    site: SITE.name,
    period: `${START} to ${END}, 06:00–18:00`,
    hours: c.hours,
    days: days.size,
    heavyBandShare: Object.fromEntries(Object.entries(bandCount).map(([k, v]) => [k, pct(v, c.hours)])),
    pod: pct(c.hit, c.hit + c.miss),
    far: pct(c.fa, c.hit + c.fa),
    bandMatch: pct(c.same, c.hours),
    underWarn: pct(c.under, c.hours),
    overWarn: pct(c.over, c.hours),
    workMinMAE: Math.round((c.minErr / c.hours) * 10) / 10,
    outsideBanPct: pct(c.modOutsideBan, c.modDanger),
    moderateDangerHoursPerDay: Math.round((c.modDanger / days.size) * 10) / 10,
    heavyStopHoursPerDay: Math.round((c.heavyRed / days.size) * 10) / 10,
    leadMedianH: median(both.map((d) => d.firstFcRed - 6)),
    stopTimingErrorMedianH: median(both.map((d) => Math.abs(d.firstFcRed - d.firstObsRed))),
    hottest,
    note: 'Forecast = Open-Meteo historical forecast (short-range model output as issued); observed = ERA5 reanalysis, not on-site sensors. This checks the warning against weather conditions, not against health outcomes.',
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'backtest.json'), JSON.stringify(res, null, 2));
  const b = res.heavyBandShare;
  const md = `# Back-test: does HeatMitra make the right call?

**Site:** ${res.site} · **Period:** ${res.period} (${res.hours} working hours over ${res.days} days) · **Engine:** \`public/heat.js\`, unchanged

We ran the engine on the forecast as it was issued and on observed (ERA5) weather for the same hours, then compared the decisions it would have given a heavy-work crew (acclimatised, normal clothes).

| Measure | Result |
|---|---|
| STOP hours for heavy work the forecast caught (hit rate) | ${res.pod}% |
| STOP warnings where observed conditions did not need a stop (false-alarm ratio) | ${res.far}% |
| Hours where forecast and observed gave the same band | ${res.bandMatch}% |
| Hours the forecast **under-warned** (gave a milder band than observed) | ${res.underWarn}% |
| Hours the forecast over-warned | ${res.overWarn}% |
| Mean error in recommended work minutes per hour | ${res.workMinMAE} min |
| Median lead from the 06:00 briefing to the first STOP hour | ${res.leadMedianH} h |
| Median error in when the first STOP hour starts | ${res.stopTimingErrorMedianH} h |
| Observed heavy-work bands (green / yellow / orange / red) | ${b.green}% / ${b.yellow}% / ${b.orange}% / ${b.red}% |
| Heavy-work STOP hours per day (observed) | ${res.heavyStopHoursPerDay} |
| Hours above the moderate-work limit **outside** the 12:30–15:00 midday ban | ${res.outsideBanPct}% (${res.moderateDangerHoursPerDay} such hours per day overall) |
| Hottest hour (est. WBGT) | ${res.hottest.wbgt} °C at ${res.hottest.time} |

**What this shows.** The fixed midday ban covers 2.5 hours a day, but ${res.outsideBanPct}% of the hours above the NIOSH limit for moderate work fall outside it. A task-specific work/rest plan driven by the forecast covers those hours, and the 06:00 briefing gives supervisors a median ${res.leadMedianH} h of notice before heavy work has to stop.

**Method.** For every working hour we estimate WBGT (ISO 7243 outdoor formula, Stull wet bulb, simplified sun and wind globe term) from temperature, humidity, solar radiation and wind in each data set, then apply the NIOSH REL with time-weighted work/rest. Hit rate = hits / (hits + misses); false-alarm ratio = false alarms / (hits + false alarms).

**Limitations.** ${res.note} The historical-forecast archive is made by joining the first hours of successive model runs, so it is closer to a same-day forecast than a day-ahead one, and real day-ahead skill will be lower. The globe-temperature term is a heuristic, not the Liljegren model. Re-run with \`npm run backtest\`.
`;
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'BACKTEST.md'), md);
  console.log(JSON.stringify(res, null, 2));
}

fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
main().catch((e) => { console.error(e); process.exit(1); });
