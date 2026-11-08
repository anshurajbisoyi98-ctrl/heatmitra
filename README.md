# HeatMitra

Heat-stress early warning and escalation for outdoor and industrial workers.
Entry for the **Future Health Digital Innovation Challenge**, Challenge 07: *Climate-Resilient Worker Health*.

HeatMitra turns the site's weather forecast, each worker's task, clothing and acclimatisation into a plain instruction for this hour ("work 25 min, rest 35 min in shade"). It warns hours ahead when risk will rise, checks in with workers in their own language, and escalates to the supervisor and then the first-aider if someone stops responding. Individual health information never reaches the supervisor.

> Decision support, not a medical device. Not clinically validated.

## Run it

Needs Node 20 or newer. There are no dependencies to install.

```bash
npm start            # http://localhost:3000, demo mode (compressed timers)
npm test             # risk-engine unit tests
npm run backtest     # re-run the 2025 Abu Dhabi back-test (needs internet)
DEMO=0 npm start     # real-time timers, demo sign-in disabled
```

Deploy: `Dockerfile` and `render.yaml` are included (single process, `PORT` env var).
- State is saved to `data/cache/state.json` every 10 s and restored at start (`STATE_FILE` to move it, e.g. onto a mounted volume).
- Push keys come from `VAPID_SEED` (Render generates it once), so subscriptions survive redeploys.
- Gateways (optional): `SMS_WEBHOOK_URL` for outgoing SMS, WhatsApp and sign-in codes; `VOICE_WEBHOOK_URL` for outgoing voice calls (TwiML); `SMS_SECRET` protects the inbound webhooks; `PUBLIC_URL` is used in voice-call callbacks.
- `.github/workflows/keep-awake.yml` pings the live demo every 10 minutes until 12 Dec 2026. GitHub doesn't guarantee scheduled runs, so an external uptime monitor is more reliable.

## Demo tour

Open the worker in one tab and the supervisor in another (sign-in is per tab). Timers are compressed: one check-in minute is 2 seconds.

**Worker (low effort by design)**
1. **Sign in with a phone number:** type `+971 50 000 0101` under "Sign in with your phone number" and enter the code (the demo shows it instead of texting it). You're Ravi, in Hindi. Or use the name picker below.
2. **One tap to start:** the task and clothing are set by the supervisor. Tap **Start shift**.
3. **One screen, three buttons:** the band (STOP), this hour's work/rest, the rest break, **I'm OK** and **I feel unwell**. Everything else is under **More**. Switch language at the top (eight languages).
4. **The rest break is the check-in:** about every 2 minutes (an hour in demo time) "Rest break now" pops up; **I'm resting in the shade** answers it. Ignore it and you get one reminder before it goes to the buddy and the supervisor.
5. **Emergency:** tap **I feel unwell** → *Confused*. The worker gets cooling steps and a call button; the first-aider gets the cool-first protocol with a clock; the supervisor sees "emergency" but no symptoms.
6. **Under More:** scan the rest-station QR (or type **4271**), **+1 cup** of water, hours in high heat this season with a kidney-check prompt (Ravi has 135 h), the optional heart-rate sensor, **🔔 Turn on alerts** (check-ins then have **I'm OK** on the lock screen), and **📣 Report a problem (anonymous)**.

**Supervisor**
7. **Today tab:** the day in four lines, **Crew check**, alerts, crew and readiness. Press **Add simulated crew**, untick someone, then **✓ All resting in the shade**: everyone ticked is checked in at once.
8. **Buddy check:** **Simulate going silent** on Mohammed (Ravi's buddy). About 30 s later Ravi's phone shows "Check on Mohammed now".
9. **Crew setup tab:** the join QR for the gate, CSV import (`name, phone, language, task, clothing, buddy`; leave the phone empty for a worker with no phone), and the crew table: task, clothing, buddy and how each person is reached (App, SMS, WhatsApp, Voice call, No phone). **Start shift** for Rajesh, who has no phone, then cover him with Crew check.
10. **Basic phones:** on Insights, the phone panel stands in for Abdul's phone. Tap **START**, then **1** or **2**. Switch him to **WhatsApp** or **Voice call** in Crew setup to see the other channels (calls are answered with keypad 1/2).
11. **Insights tab:** work/rest planner (with dust and UV), next 3 days, H3 heat map (**▶ Play the day**), task scheduler, water and shade, break check (**Audit** a station, **🖨 QR posters**), anonymous worker reports, safety measures, back-test, summer heat calendar and the audit log.
12. **Header:** **Replay day** (try 2025-08-01 for the hottest day, 2025-07-07 for a dust storm), **Live**, the Gulf rule selector, **📋 Morning briefing**, **📄 Report** (print or CSV), and **Calibrate** with an on-site WBGT reading.

**First-aider:** symptoms appear only with consent. Run the cooling protocol (**Cooling started**, **Ambulance called**) and close each case with an outcome.

The research behind these features is in `docs/RESEARCH.md`.

## Layout

```
server.js            API, role checks, escalation sweeper, audit log
src/weather.js       Open-Meteo forecast + ERA5 replay, disk cache, stale fallback
public/heat.js       risk engine (shared by server and phone, works offline)
public/              worker app + supervisor / first-aider consoles (no build step)
scripts/backtest.js  2025 Abu Dhabi back-test -> docs/BACKTEST.md
scripts/calendar.js  summer 2025 weather for the heat calendar -> public/heatcalendar.json
data/fallback/       saved real weather days used if Open-Meteo is unreachable
docs/SUBMISSION.md   technical documentation, assumptions, limitations
SYSTEM_PROMPT.md     build brief used for this one-day build
```

Weather data: [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
