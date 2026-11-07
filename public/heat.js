/*
 * HeatMitra risk engine. Shared by the server and the browser (offline mode),
 * so the worker's phone gives the same answer as the server with no network.
 *
 * Estimated WBGT: ISO 7243 outdoor formula, Stull wet bulb, simplified sun/wind globe term.
 * Limits: NIOSH 2016 REL (acclimatised) / RAL (unacclimatised) as a function of metabolic rate.
 * Clothing: ACGIH clothing adjustment factors.
 * Decision support only. Not a medical device.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Heat = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const M_REST = 115;
  const WORKLOAD = { light: 180, moderate: 300, heavy: 415, veryheavy: 520 };
  const CLOTHING = { standard: 0, polyolefin: 1, doublelayer: 3, vapourbarrier: 11 };
  const REL = { a: 56.7, b: 11.5 };
  const RAL = { a: 59.9, b: 14.1 };
  const BANDS = ['green', 'yellow', 'orange', 'red'];
  const CHECKIN_MIN = { green: null, yellow: 60, orange: 30, red: 20 };
  const RED_FLAGS = ['confused', 'fainted', 'hotdry', 'vomit'];
  const SYMPTOMS = ['headache', 'dizzy', 'cramps', 'nausea', 'thirst', 'heavysweat', 'confused', 'fainted', 'hotdry', 'vomit'];
  const ACCLIMATISED_DAYS = 7;

  const round1 = (x) => Math.round(x * 10) / 10;

  // Psychrometric wet-bulb temperature, Stull (2011). Valid for RH 5-99 %, T -20 to 50 °C.
  function wetBulb(t, rh) {
    const r = Math.min(99, Math.max(5, rh));
    return t * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) + Math.atan(t + r) - Math.atan(r - 1.676331)
      + 0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) - 4.686035;
  }

  // Outdoor WBGT, ISO 7243: 0.7·Tnw + 0.2·Tg + 0.1·Ta.
  // Globe-temperature excess from sun, cut by wind: dTg = 0.015·S / (1 + 0.25·u2), where S is
  // shortwave radiation (W/m²) and u2 the wind at about 2 m (m/s, taken as 0.75 × 10 m wind).
  // That gives about +10 °C globe excess in full sun and light wind. It is a simplified
  // heuristic; production would use the Liljegren model. Tnw ≈ Tw + 0.1·dTg.
  function wbgt(t, rh, sw, windKmh) {
    const s = Math.max(0, sw || 0);
    const u2 = Math.max(0.5, ((windKmh == null ? 5 : windKmh) / 3.6) * 0.75);
    const dTg = (0.015 * s) / (1 + 0.25 * u2);
    const tw = wetBulb(t, rh);
    return 0.7 * (tw + 0.1 * dTg) + 0.2 * (t + dTg) + 0.1 * t;
  }

  function coeffs(acclimatised) {
    return acclimatised ? REL : RAL;
  }

  function limit(m, acclimatised) {
    const k = coeffs(acclimatised);
    return k.a - k.b * Math.log10(m);
  }

  // Largest share of each hour that can be spent working so the hour's
  // time-weighted metabolic rate stays under the limit for this WBGT.
  function workFraction(wbgtEff, mWork, acclimatised) {
    const k = coeffs(acclimatised);
    const mMax = Math.pow(10, (k.a - wbgtEff) / k.b);
    if (mMax >= mWork) return 1;
    return Math.max(0, Math.min(1, (mMax - M_REST) / (mWork - M_REST)));
  }

  // Country rule packs (summer midday outdoor-work bans, plus Qatar's WBGT stop rule).
  // From GCC law-firm guides, June 2026; sources differ on some hours, so verify with each ministry.
  const RULES = {
    UAE: { name: 'UAE midday break', from: '06-15', to: '09-15', start: '12:30', end: '15:00' },
    KSA: { name: 'Saudi Arabia midday break', from: '06-15', to: '09-15', start: '12:00', end: '15:00' },
    QAT: { name: 'Qatar summer hours + WBGT 32.1 °C stop', from: '06-01', to: '09-15', start: '10:00', end: '15:30', wbgtStop: 32.1 },
    KWT: { name: 'Kuwait midday break', from: '06-01', to: '08-31', start: '11:00', end: '16:00' },
    OMN: { name: 'Oman midday break', from: '06-01', to: '08-31', start: '12:30', end: '15:30' },
    BHR: { name: 'Bahrain midday break', from: '06-15', to: '09-15', start: '12:00', end: '16:00' },
  };
  const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const resolveRule = (r) => (r === true ? RULES.UAE : typeof r === 'string' ? RULES[r] || null : r || null);

  // time: 'YYYY-MM-DDTHH:MM' in site-local time. An hour slot that overlaps the ban window is flagged.
  function inMiddayBan(time, rule = RULES.UAE) {
    const r = resolveRule(rule);
    if (!r) return false;
    const md = time.slice(5, 10);
    const h = Number(time.slice(11, 13));
    return md >= r.from && md <= r.to && h * 60 < toMin(r.end) && (h + 1) * 60 > toMin(r.start);
  }

  // Dust (hourly PM10, µg/m³) against US EPA PM10 AQI breakpoints (24-h values used as hourly guidance):
  // < 155 good/moderate · 155–254 unhealthy for sensitive groups · 255–424 unhealthy to very unhealthy · ≥ 425 hazardous.
  function airAssess(pm10, uv) {
    const dust = pm10 == null ? null : pm10 < 155 ? 'green' : pm10 < 255 ? 'yellow' : pm10 < 425 ? 'orange' : 'red';
    return { pm10: pm10 == null ? null : Math.round(pm10), dust, uv: uv == null ? null : Math.round(uv * 10) / 10, uvHigh: uv != null && uv >= 8 };
  }

  function assess(o) {
    const acclimatised = o.acclimatised != null ? Boolean(o.acclimatised) : (o.daysOnSite || 0) >= ACCLIMATISED_DAYS;
    const m = WORKLOAD[o.workload] || WORKLOAD.moderate;
    const base = wbgt(o.t, o.rh, o.sw, o.wind) + (o.calib || 0); // calib: on-site sensor offset
    const eff = base + (CLOTHING[o.clothing] || 0);
    const personal = Math.max(0, o.personal || 0); // learned, tighten-only: lowers this worker's limit
    const lim = limit(m, acclimatised) - personal;
    const margin = eff - lim;
    const f = workFraction(eff + personal, m, acclimatised);
    let band = margin <= -2 ? 'green' : margin <= 0 ? 'yellow' : f >= 0.25 ? 'orange' : 'red';
    const rule = resolveRule(o.middayBan);
    const ban = Boolean(rule && o.time && inMiddayBan(o.time, rule));
    const ruleStop = Boolean(rule && rule.wbgtStop && base >= rule.wbgtStop);
    const air = airAssess(o.pm10, o.uv);
    const dustStop = air.dust === 'red';
    if (ban || ruleStop || dustStop) band = 'red';
    let workMin = band === 'orange' ? Math.floor((f * 60) / 5) * 5 : band === 'red' ? 0 : 60;
    const days = o.daysOnSite || 0;
    const exposureCap = o.exposureCap != null ? o.exposureCap : acclimatised ? 100 : Math.min(100, 20 * Math.max(1, days));
    return {
      personal,
      air,
      dustStop,
      time: o.time || null,
      t: o.t,
      rh: o.rh,
      wbgt: round1(base),
      wbgtEff: round1(eff),
      limit: round1(lim),
      margin: round1(margin),
      workFraction: Math.round(f * 100) / 100,
      band,
      workMin,
      restMin: 60 - workMin,
      checkinMin: CHECKIN_MIN[band],
      water: band !== 'green',
      middayBan: ban,
      banStart: rule ? rule.start : null,
      banEnd: rule ? rule.end : null,
      ruleStop,
      ruleLimit: rule && rule.wbgtStop ? rule.wbgtStop : null,
      acclimatised,
      exposureCap,
      basis: acclimatised ? 'NIOSH REL (acclimatised)' : 'NIOSH RAL (not yet acclimatised)',
    };
  }

  function assessDay(hourly, profile, middayBan) {
    return hourly.map((r) => assess({ ...profile, t: r.t, rh: r.rh, sw: r.sw, wind: r.wind, pm10: r.pm10, uv: r.uv, time: r.time, middayBan }));
  }

  // Acclimatisation from the dates a worker was in the heat (NIOSH 2016):
  // new workers 20% of the usual exposure on day 1, +20% a day; full acclimatisation takes about 7 days.
  // After 7+ days away: 50%, 60%, 80%, 100% over 4 days. After 6+ weeks away: start again as new.
  function acclimPlan(dates, today) {
    const DAY = 864e5;
    const t = Date.parse(`${today}T00:00:00Z`);
    const ds = [...new Set(dates || [])].map((d) => Date.parse(`${d}T00:00:00Z`)).filter((x) => x <= t).sort((a, b) => b - a);
    if (!ds.length || ds[0] !== t) ds.unshift(t); // today counts
    let i = 1;
    while (i < ds.length && (ds[i - 1] - ds[i]) / DAY < 7) i++;
    const run = i;
    const awayDays = i < ds.length ? Math.round((ds[i - 1] - ds[i]) / DAY) : null;
    const returning = awayDays != null && awayDays < 42;
    if (returning && run <= 4) return { kind: 'returning', day: run, of: 4, cap: [50, 60, 80, 100][run - 1], acclimatised: run >= 4, awayDays };
    if (returning || run >= 7) return { kind: 'acclimatised', day: run, of: null, cap: 100, acclimatised: true, awayDays };
    if (run >= 5) return { kind: 'new', day: run, of: 7, cap: 100, acclimatised: false, awayDays };
    return { kind: 'new', day: run, of: 5, cap: Math.min(100, 20 * run), acclimatised: false, awayDays };
  }

  // Break check (water-rest-shade compliance). Adelante (Glaser 2020; Hansson 2025): the fall in kidney injury
  // tracked how well rest, water and shade were actually delivered. Rest confirmed at a station counts fully,
  // self-reported rest half; weights rest 50%, water 30%, station audits 20%. Below 80 is flagged.
  function complianceScore(c) {
    const pct = (n, d) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : null);
    const rest = c.restDue > 0 ? Math.min(100, Math.round(((c.restVerified + 0.5 * Math.max(0, c.restTaken - c.restVerified)) / c.restDue) * 100)) : null;
    const water = pct(c.cups, c.cupsDue);
    const audit = pct(c.auditsOk, c.auditsDue);
    const parts = [[rest, 0.5], [water, 0.3], [audit, 0.2]].filter(([v]) => v != null);
    const w = parts.reduce((s, [, k]) => s + k, 0);
    const score = w ? Math.round(parts.reduce((s, [v, k]) => s + v * k, 0) / w) : null;
    return { score, rest, water, audit, flag: score != null && score < 80 };
  }

  // Personal limits that can only get stricter. One parameter per worker (the intercept of a logistic model of
  // "struggled" vs margin to the limit), updated online from that worker's check-ins and wearable; the shift in the
  // intercept, converted to °C, lowers their limit. Prior: 20% chance of struggling exactly at the limit.
  const PERSONAL = { a0: Math.log(0.2 / 0.8), b: 1.0, lr: 0.5, l2: 0.1, max: 3 };
  function personalUpdate(state, margin, y) {
    const s = state || { a: PERSONAL.a0, n: 0, struggles: 0 };
    const p = 1 / (1 + Math.exp(-(s.a + PERSONAL.b * margin)));
    const a = s.a + PERSONAL.lr * (y - p) - PERSONAL.lr * PERSONAL.l2 * (s.a - PERSONAL.a0);
    return { a, n: s.n + 1, struggles: s.struggles + (y >= 0.99 ? 1 : 0) };
  }
  function personalOffset(state) {
    if (!state) return 0;
    return Math.min(PERSONAL.max, Math.max(0, Math.round(((state.a - PERSONAL.a0) / PERSONAL.b) * 10) / 10));
  }

  // First later hour where the band gets worse than it is now: the advance warning.
  function nextRise(plan, fromIndex) {
    const now = plan[fromIndex];
    if (!now) return null;
    const rank = BANDS.indexOf(now.band);
    for (let i = fromIndex + 1; i < plan.length; i++) {
      if (BANDS.indexOf(plan[i].band) > rank) return { time: plan[i].time, band: plan[i].band, hoursAhead: i - fromIndex };
    }
    return null;
  }

  // Longest run of consecutive hours (05:00 to 19:00) where heavy work is green or yellow.
  function bestWindow(plan) {
    let best = null, cur = null;
    for (const p of plan) {
      const h = Number(p.time.slice(11, 13));
      const ok = h >= 5 && h <= 19 && (p.band === 'green' || p.band === 'yellow');
      if (ok) {
        cur = cur ? { ...cur, end: p.time } : { start: p.time, end: p.time };
        if (!best || hoursOf(cur) > hoursOf(best)) best = cur;
      } else cur = null;
    }
    return best;
  }
  function hoursOf(w) {
    return Number(w.end.slice(11, 13)) - Number(w.start.slice(11, 13)) + 1;
  }

  // Core temperature from heart rate: Buller et al. 2013, Physiol Meas 34:781 (extended Kalman
  // filter, one step per 1-minute mean heart rate). Published parameters.
  const ECT = { a: 1, gamma: 0.022 * 0.022, b0: -7887.1, b1: 384.4286, b2: -4.5714, sigma: 18.88 * 18.88 };
  function coreTempStep(state, hr) {
    const s = state || { ct: 37.1, v: 0 };
    const ctHat = ECT.a * s.ct;
    const vHat = ECT.a * ECT.a * s.v + ECT.gamma;
    const c = 2 * ECT.b2 * ctHat + ECT.b1;
    const k = (vHat * c) / (c * c * vHat + ECT.sigma);
    const ct = ctHat + k * (hr - (ECT.b2 * ctHat * ctHat + ECT.b1 * ctHat + ECT.b0));
    return { ct, v: (1 - k * c) * vHat };
  }

  // Physiological Strain Index, Moran et al. 1998, Am J Physiol: 0 (none) to 10 (very high).
  function psi(ct, hr, ct0 = 37.1, hr0 = 70) {
    const v = (5 * (ct - ct0)) / (39.5 - ct0) + (5 * (hr - hr0)) / (180 - hr0);
    return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  }
  const psiBand = (p) => (p < 5 ? 'low' : p < 7 ? 'moderate' : p < 9 ? 'high' : 'veryhigh');

  return {
    coreTempStep, psi, psiBand, RULES, airAssess, acclimPlan, personalUpdate, personalOffset, complianceScore,
    WORKLOAD, CLOTHING, BANDS, CHECKIN_MIN, RED_FLAGS, SYMPTOMS, ACCLIMATISED_DAYS,
    wetBulb, wbgt, limit, workFraction, inMiddayBan, assess, assessDay, nextRise, bestWindow,
  };
});
