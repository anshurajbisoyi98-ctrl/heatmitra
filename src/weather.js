'use strict';
/*
 * Weather for a site from Open-Meteo (CC BY 4.0).
 *   live:   forecast API, next 2 days, refreshed every 30 min
 *   replay: ERA5 archive for a past date, so a demo can re-run a real summer day
 * Every good response is also written to disk. If the network fails we serve the
 * last good copy marked stale, so the warning keeps working through an outage.
 */
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const FALLBACK_DIR = path.join(__dirname, '..', 'data', 'fallback');
const HOURLY = 'temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m';
const LIVE_TTL = 30 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

fs.mkdirSync(CACHE_DIR, { recursive: true });

function toRows(j) {
  const h = j.hourly;
  return h.time
    .map((time, i) => ({
      time,
      t: h.temperature_2m[i],
      rh: h.relative_humidity_2m[i],
      sw: h.shortwave_radiation ? h.shortwave_radiation[i] : null,
      wind: h.wind_speed_10m ? h.wind_speed_10m[i] : null,
    }))
    .filter((r) => r.t != null && r.rh != null);
}

async function fetchSite(site, replayDate) {
  const q = new URLSearchParams({ latitude: site.lat, longitude: site.lon, hourly: HOURLY, timezone: site.tz });
  let base = 'https://api.open-meteo.com/v1/forecast';
  if (replayDate) { // the replay day plus the next 3, for the outlook
    base = 'https://archive-api.open-meteo.com/v1/archive';
    q.set('start_date', replayDate);
    q.set('end_date', new Date(Date.parse(`${replayDate}T00:00:00Z`) + 3 * 864e5).toISOString().slice(0, 10));
  } else q.set('forecast_days', '4');
  let r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 429) { // shared hosting IPs get rate-limited; one polite retry
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(8000) });
  }
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const rows = toRows(await r.json());
  if (!rows.length) throw new Error('Open-Meteo returned no rows');
  // Dust (PM10) and UV from the Open-Meteo air-quality API (CAMS). Optional: the plan works without it.
  try {
    const aq = new URLSearchParams({ latitude: site.lat, longitude: site.lon, hourly: 'pm10,uv_index', timezone: site.tz });
    if (replayDate) { aq.set('start_date', q.get('start_date')); aq.set('end_date', q.get('end_date')); } else aq.set('forecast_days', '4');
    const a = (await getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${aq}`)).hourly;
    const byTime = new Map(a.time.map((t, i) => [t, i]));
    for (const row of rows) {
      const i = byTime.get(row.time);
      if (i != null) { row.pm10 = a.pm10[i]; row.uv = a.uv_index[i]; }
    }
  } catch { /* air quality unavailable: heat plan only */ }
  return {
    siteId: site.id,
    mode: replayDate ? 'replay' : 'live',
    date: replayDate || rows[0].time.slice(0, 10),
    source: replayDate ? 'Open-Meteo historical weather (ERA5 reanalysis)' : 'Open-Meteo forecast',
    fetchedAt: Date.now(),
    stale: false,
    hourly: rows,
  };
}

async function forecast(site, replayDate) {
  const key = `${site.id}_${replayDate || 'live'}`;
  const file = path.join(CACHE_DIR, `${key}.json`);
  const hit = cache.get(key);
  if (hit && !hit.stale && (replayDate || Date.now() - hit.fetchedAt < LIVE_TTL)) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = fetchSite(site, replayDate)
    .then((out) => {
      cache.set(key, out);
      fs.writeFile(file, JSON.stringify(out), () => {});
      return out;
    })
    .catch((err) => {
      if (hit) return { ...hit, stale: true };
      if (fs.existsSync(file)) {
        const old = { ...JSON.parse(fs.readFileSync(file, 'utf8')), stale: true };
        cache.set(key, old);
        return old;
      }
      // Last resort: a real ERA5 day for this site that ships with the app, clearly labelled.
      const bundled = path.join(FALLBACK_DIR, `${site.id}.json`);
      if (fs.existsSync(bundled)) {
        const fb = JSON.parse(fs.readFileSync(bundled, 'utf8'));
        return { ...fb, stale: true, source: `Saved ERA5 day ${fb.date} (weather service unavailable: ${err.message})` };
      }
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function getJson(url) {
  let r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (r.status === 429) {
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  }
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  return r.json();
}

// An n×n grid of points around the site, for the regional heat map. One request for all points.
async function grid(site, replayDate, n = 7, step = 0.08) {
  const key = `grid_${site.id}_${replayDate || 'live'}`;
  const file = path.join(CACHE_DIR, `${key}.json`);
  const hit = cache.get(key);
  if (hit && !hit.stale && (replayDate || Date.now() - hit.fetchedAt < LIVE_TTL)) return hit;
  const lats = [], lons = [];
  const half = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      lats.push(Number((site.lat + (half - i) * step).toFixed(3)));
      lons.push(Number((site.lon + (j - half) * step).toFixed(3)));
    }
  }
  const q = new URLSearchParams({ latitude: lats.join(','), longitude: lons.join(','), hourly: HOURLY, timezone: site.tz });
  let base = 'https://api.open-meteo.com/v1/forecast';
  if (replayDate) {
    base = 'https://archive-api.open-meteo.com/v1/archive';
    q.set('start_date', replayDate);
    q.set('end_date', replayDate);
  } else q.set('forecast_days', '1');
  try {
    const j = await getJson(`${base}?${q}`);
    const arr = Array.isArray(j) ? j : [j];
    const points = arr.map((p, k) => ({ lat: lats[k], lon: lons[k], hourly: toRows(p) }));
    const out = {
      siteId: site.id, mode: replayDate ? 'replay' : 'live', date: replayDate || points[0].hourly[0].time.slice(0, 10),
      source: replayDate ? 'Open-Meteo historical weather (ERA5 reanalysis)' : 'Open-Meteo forecast',
      n, step, fetchedAt: Date.now(), stale: false, points,
    };
    cache.set(key, out);
    fs.writeFile(file, JSON.stringify(out), () => {});
    return out;
  } catch (err) {
    if (hit) return { ...hit, stale: true };
    if (fs.existsSync(file)) return { ...JSON.parse(fs.readFileSync(file, 'utf8')), stale: true };
    const bundled = path.join(FALLBACK_DIR, `grid-${site.id}.json`);
    if (fs.existsSync(bundled)) {
      const fb = JSON.parse(fs.readFileSync(bundled, 'utf8'));
      return { ...fb, stale: true, source: `Saved ERA5 day ${fb.date} (weather service unavailable: ${err.message})` };
    }
    throw err;
  }
}

// Weather at arbitrary points near a site (the browser sends H3 hexagon centres).
// If Open-Meteo is unavailable, each point takes the nearest point of the saved square grid.
async function points(site, replayDate, coords) {
  const sig = coords.map(([a, b]) => `${a},${b}`).join(';');
  const key = `pts_${site.id}_${replayDate || 'live'}_${require('crypto').createHash('sha1').update(sig).digest('hex').slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit && !hit.stale && (replayDate || Date.now() - hit.fetchedAt < LIVE_TTL)) return hit;
  const q = new URLSearchParams({ latitude: coords.map((c) => c[0]).join(','), longitude: coords.map((c) => c[1]).join(','), hourly: HOURLY, timezone: site.tz });
  let base = 'https://api.open-meteo.com/v1/forecast';
  if (replayDate) {
    base = 'https://archive-api.open-meteo.com/v1/archive';
    q.set('start_date', replayDate);
    q.set('end_date', replayDate);
  } else q.set('forecast_days', '1');
  try {
    const j = await getJson(`${base}?${q}`);
    const arr = Array.isArray(j) ? j : [j];
    const pts = arr.map((p, k) => ({ lat: coords[k][0], lon: coords[k][1], hourly: toRows(p) }));
    const out = {
      siteId: site.id, mode: replayDate ? 'replay' : 'live', date: replayDate || pts[0].hourly[0].time.slice(0, 10),
      source: replayDate ? 'Open-Meteo historical weather (ERA5 reanalysis)' : 'Open-Meteo forecast',
      fetchedAt: Date.now(), stale: false, points: pts,
    };
    cache.set(key, out);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return out;
  } catch (err) {
    if (hit) return { ...hit, stale: true };
    const g = await grid(site, replayDate); // may itself be the saved fallback
    const near = (lat, lon) => g.points.reduce((b, p) => ((p.lat - lat) ** 2 + (p.lon - lon) ** 2 < (b.lat - lat) ** 2 + (b.lon - lon) ** 2 ? p : b));
    return {
      ...g, stale: true, source: `${g.source} · nearest saved grid point per hexagon (${err.message})`,
      points: coords.map(([lat, lon]) => ({ lat, lon, hourly: near(lat, lon).hourly })),
    };
  }
}

module.exports = { forecast, grid, points };
