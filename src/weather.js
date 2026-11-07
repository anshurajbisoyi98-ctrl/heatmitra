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
  if (replayDate) {
    base = 'https://archive-api.open-meteo.com/v1/archive';
    q.set('start_date', replayDate);
    q.set('end_date', replayDate);
  } else q.set('forecast_days', '2');
  let r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 429) { // shared hosting IPs get rate-limited; one polite retry
    await new Promise((ok) => setTimeout(ok, 1500));
    r = await fetch(`${base}?${q}`, { signal: AbortSignal.timeout(8000) });
  }
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const rows = toRows(await r.json());
  if (!rows.length) throw new Error('Open-Meteo returned no rows');
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

module.exports = { forecast };
