'use strict';
/*
 * Builds public/heatcalendar.json: hourly ERA5 weather (05:00 to 19:00) for every day of
 * summer 2025 at the Mussafah site. The supervisor console turns it into a day × hour
 * heat calendar with the HeatMitra engine, for any task type.
 */
const fs = require('fs');
const path = require('path');

const SITE = { name: 'Abu Dhabi (Mussafah)', lat: 24.36, lon: 54.5, tz: 'Asia/Dubai' };
const START = '2025-06-01';
const END = '2025-09-30';

async function main() {
  const q = new URLSearchParams({
    latitude: SITE.lat, longitude: SITE.lon, timezone: SITE.tz, start_date: START, end_date: END, models: 'era5',
    hourly: 'temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m',
  });
  const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?${q}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const h = (await r.json()).hourly;
  const days = new Map();
  h.time.forEach((t, i) => {
    const hour = Number(t.slice(11, 13));
    if (hour < 5 || hour > 19 || h.temperature_2m[i] == null) return;
    const d = t.slice(0, 10);
    if (!days.has(d)) days.set(d, []);
    days.get(d).push([h.temperature_2m[i], h.relative_humidity_2m[i], h.shortwave_radiation[i], h.wind_speed_10m[i]]);
  });
  const out = {
    site: SITE.name, source: 'Open-Meteo historical weather (ERA5)', firstHour: 5,
    days: [...days].filter(([, v]) => v.length === 15).map(([date, v]) => ({ date, h: v })),
  };
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'heatcalendar.json'), JSON.stringify(out));
  console.log(`wrote ${out.days.length} days`);
}

main().catch((e) => { console.error(e); process.exit(1); });
