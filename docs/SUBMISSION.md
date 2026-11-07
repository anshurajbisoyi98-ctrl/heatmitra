# HeatMitra: technical documentation

**Challenge:** 07, Climate-Resilient Worker Health (Population Health)
**Team:** Anshu (founder of MargMitra)
**Maturity:** working prototype, built during the challenge. Not piloted, not clinically validated.

## 1. The problem

Heat strain in construction and logistics builds quietly and can turn into heat stroke within an hour. Supervisors mostly work from one rule (the UAE midday break, 12:30–15:00, 15 Jun to 15 Sep) and general thresholds. But the same weather affects a new worker in a coverall doing heavy lifting very differently from an acclimatised signaller. Our back-test of summer 2025 in Abu Dhabi found that **77% of the working hours above the NIOSH limit for moderate work fall outside the midday ban** (docs/BACKTEST.md).

## 2. What HeatMitra does

| Challenge requirement | How HeatMitra meets it |
|---|---|
| Dynamic heat-risk assessment | Hourly site forecast (temperature, humidity, solar radiation, wind) → estimated WBGT → NIOSH limit for this worker's task, clothing and acclimatisation → band and work/rest minutes |
| Clear, graded, multilingual warnings | Four bands (Safe / Caution / Take breaks / Stop) shown with colour, an icon, words and voice. English, Hindi, Arabic and Urdu. Every band has a concrete action: water, buddy, work/rest plan, stop and move to shade, emergency |
| Earlier warning | Advance notice of the next rise ("from 11:00 risk rises to STOP, finish heavy work before then"). The supervisor planner shows the whole day at the 06:00 briefing |
| Worker-first governance | Consent screen; symptoms go only to the first-aider and only with consent; no GPS; supervisors see bands and check-in status, never symptoms; no endpoint returns one worker's history; 24 h retention; audit log |
| Field-ready, safe fallback | The risk engine runs on the phone too; the last plan is cached; check-ins queue offline; red-flag advice and the emergency call button work with no network. The server serves cached weather if Open-Meteo is down. If a phone goes silent, the server escalates |
| Supervisor decision support | Hour-by-hour planner per task type, best window for heavy work, crew board with counts by band, alerts to acknowledge |
| Regional heat map | Uber's **H3 hexagonal grid** at resolution 6: 61 equal-area hexagons (≈ 36 km² each) around the site. Each hexagon samples forecast or replayed weather at its own centre, all fetched in one request, and is coloured by estimated WBGT. Hexagons avoid a square grid's directional bias. Their H3 indices let the map join other H3-indexed data later (incident reports, sensors, crew check-ins). Detail is still bounded by the weather model's ~9–11 km resolution. If the H3 library can't load, the map falls back to a 7×7 square grid. Red outlines show where the chosen task must stop. An hour slider and "play the day" animation show how heat moves between the coast and inland, so contractors can move crews or shift start times |
| Smart task scheduler | The supervisor lists the day's tasks (type and hours of work). HeatMitra gives the heaviest task the hours where it can work the most, builds in the rest breaks, and flags work that can't be done safely today (split it, start earlier, or move it to a night shift) |
| Summer heat calendar | Every working hour of summer 2025 at the site (ERA5) as a day × hour heatmap for any task type, with the midday ban outlined. For heavy work, 55% of hours were STOP, and only 17% of the hours that needed breaks or a stop fell inside the ban |
| Wearable heat strain (optional, consented) | Any standard Bluetooth heart-rate sensor (GATT Heart Rate Service, via Web Bluetooth). The phone estimates core temperature from heart rate (Buller et al. 2013 Kalman filter) and computes the Physiological Strain Index (Moran et al. 1998). Heart rate stays on the phone. PSI 7 or above alerts the supervisor; 9 or above goes to the first-aider as an emergency. Values are shown only to the first-aider, and only with consent. A demo mode simulates a rising heart rate |
| Hydration self-check | Armstrong 8-colour urine chart: tap a colour, get advice in your language, read aloud. Never leaves the phone |
| On-site sensor calibration | The supervisor enters a WBGT meter reading. The offset from the model (capped at ±6 °C) corrects every plan at the site. Audited. See `docs/RESEARCH.md` |
| Safety and productivity measures | Live: alerts, prompt response rate, median time to a human response, cases that reached the first-aider, signal-lost alerts, emergencies. Back-test: hit rate, false alarms, under-warning, lead time, stop hours per day |

### Escalation ladder

```
check-in due ─► worker "Are you OK?" ─(20 s demo / 90 s real)─► supervisor ─(25 s / 120 s)─► first-aider
phone silent ─────────────────────────────────────────────────► supervisor ─────────────► first-aider
red-flag symptom (confused, fainted, hot dry skin, vomiting) ──────────────────────────► first-aider (emergency)
```

Check-in frequency follows the band: every 60 min in Caution, every 30 min in Take breaks, every 20 min in Stop. A server-side sweeper moves alerts up the ladder, so escalation still happens when the phone is dead, lost or out of coverage. This design comes from MargMitra's guardian escalation (traveller → guardian → emergency contacts).

## 3. The science

| Step | Method | Source |
|---|---|---|
| Wet-bulb temperature | Stull (2011) empirical formula from air temperature and RH | Stull, *J. Appl. Meteor. Climatol.* 2011 |
| Outdoor WBGT | `0.7·Tnw + 0.2·Tg + 0.1·Ta` | ISO 7243 |
| Globe temperature | `Tg = Ta + 0.015·S / (1 + 0.25·u₂)`; `Tnw ≈ Tw + 0.1·(Tg − Ta)` | Simplified heuristic (≈ +10 °C globe excess in full sun, light wind). See limitations |
| Clothing | +0 normal, +1 polyolefin coverall, +3 double-layer, +11 vapour barrier | ACGIH clothing adjustment factors |
| Limits | Acclimatised: `REL = 56.7 − 11.5·log₁₀M`; new workers (< 7 days): `RAL = 59.9 − 14.1·log₁₀M` | NIOSH Criteria for a Recommended Standard: Occupational Exposure to Heat and Hot Environments (2016) |
| Metabolic rate | Light 180 W, moderate 300 W, heavy 415 W, very heavy 520 W, rest 115 W | ACGIH / ISO 8996 examples |
| Work/rest | Largest work share f per hour with `f·M + (1−f)·115 ≤ 10^((A − WBGT)/B)` | NIOSH time-weighted approach |
| Bands | Safe if 2 °C or more under the limit; Caution if within 2 °C; Take breaks if over the limit and at least 15 min/h of work is allowed; Stop otherwise | HeatMitra rule |
| Acclimatisation | New workers' heat exposure capped at 20% on day 1, +20% per day | NIOSH acclimatisation schedule |
| Water | 1 cup (≈250 ml) every 15–20 min from Caution upwards | NIOSH |

The decision logic is deliberately rule-based and explainable: every number the worker or supervisor sees can be traced to a formula and a source. There is no black-box model in the safety path.

## 4. Architecture

```
 Phone (PWA)                         Server (Node, no dependencies)              Data
 ───────────                         ─────────────────────────────              ────
 worker app ── heat.js (offline) ─►  /api/me, /api/checkin, /api/heartbeat  ─►  Open-Meteo forecast
 supervisor console ──────────────►  /api/crew, /api/alerts (no clinical)    ─►  Open-Meteo ERA5 archive (replay)
 first-aider console ─────────────►  /api/alerts (clinical, consented only)      disk cache (stale fallback)
                                     escalation sweeper (every 2 s)
                                     role checks · audit log · 24 h retention
```

- `public/heat.js` is one risk engine shared by the server, the browser and the back-test, so the phone gives the same answer offline as the server does online.
- Roles are enforced on the server: a worker cannot read alerts (403), and supervisors receive alert objects with no symptom field at all.
- **Scaling path:** the prototype keeps state in memory. Production would move shifts and alerts to Postgres and the sweeper's timers to Redis keys with TTLs (the pattern MargMitra already uses). It would also add SMS/WhatsApp/IVR channels for workers without smartphones, and an optional on-site WBGT sensor feed that replaces the gridded estimate.

## 5. Back-test (summary)

Abu Dhabi (Mussafah), 1 Jun to 30 Sep 2025, 06:00–18:00. Forecast as issued (Open-Meteo historical forecast) vs ERA5 reanalysis, same engine on both. Full table in `docs/BACKTEST.md`.

- STOP hours for heavy work caught by the forecast: **93.1%**; false-alarm ratio **6.8%**.
- Same band in forecast and observed: **88.2%** of hours; under-warned **6.1%**, over-warned 5.7%.
- Mean error in work minutes per hour: **3.3 min**.
- 06:00 briefing gives a median **4 h** of notice before heavy work must stop.
- **77.2%** of hours above the moderate-work limit fall outside the midday ban.

## 6. Data sources

| Source | Use | Licence |
|---|---|---|
| Open-Meteo Forecast API | Live hourly site weather | CC BY 4.0 |
| Open-Meteo Historical Weather API (ERA5) | Replaying past days; "observed" side of the back-test | CC BY 4.0 |
| Open-Meteo Historical Forecast API | "Forecast" side of the back-test | CC BY 4.0 |
| `data/seed.json` | Fictional demo workers and sites | Ours |

No personal data was collected. The organisers provided no data.

## 7. Assumptions

- WBGT can be estimated from gridded weather for a site; the site's emergency number is configured per site (998 in the UAE, 112 in India).
- Workers can use a basic smartphone during breaks; supervisors and first-aiders have a phone or tablet.
- Task, clothing and days on site are self-reported at shift start (the employer can pre-fill them).
- Demo mode compresses timers (one check-in minute = 2 s) and uses passwordless sign-in.

## 8. Limitations (read these)

- **Not clinically validated** and not a medical device. HeatMitra supports decisions; it does not diagnose. Abnormal or urgent cases always go to people.
- WBGT is **estimated** from ~10 km gridded weather, not measured on site. The globe-temperature term is a heuristic, not the Liljegren model, and does not account for local radiant sources (asphalt, steel, machinery).
- The back-test checks the warning against **weather**, not health outcomes. ERA5 is reanalysis, not a station. The historical-forecast archive is close to same-day, so true day-ahead skill will be lower.
- No wearable or physiological signals yet. Personal risk uses task, clothing and acclimatisation only.
- Translations are short, simple phrases written for the prototype. They need review by native speakers before use with workers. Voice depends on the device's text-to-speech voices.
- In-memory storage, demo sign-in, no rate limiting: this is a prototype, not production.
- Frequent check-ins in the Stop band could cause alert fatigue; the intervals need tuning with workers.

## 9. Built during the challenge vs reused

All code in this repository was written for this challenge. From MargMitra (our women's-safety navigation project) we reused **designs, not code**: the server-side escalation ladder that works when the phone is off, consent-based access (only people the user chose can see sensitive data), and scoring risk from location-based data.

## 10. Path to a pilot

- **Buyer:** HSE managers at construction, logistics and facilities contractors in the UAE, who already have to manage heat exposure and the midday break.
- **Pilot:** one site, 50–100 workers, 6 weeks of summer. Add an on-site WBGT meter to calibrate the estimate.
- **What we'd measure:** how many check-in prompts workers answer, time to a human response, adherence to rest breaks, heat-related first-aid cases against the previous season, and false-alarm feedback from workers. We'd also check that results are fair across languages and nationalities.
- **Model (assumption):** per-worker monthly subscription for the employer; free for workers.
- **Next:** SMS/IVR channel, wearable heart-rate input with consent, an independent clinical review of thresholds and wording, and adaptation for India's heatwave season (Delhi is already a configured site).
