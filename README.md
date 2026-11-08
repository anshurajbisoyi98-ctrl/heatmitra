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
- `.github/workflows/keep-awake.yml` pings the live demo every 10 minutes until 12 Dec 2026, so Render's free plan doesn't put it to sleep.

## 3-minute demo

1. **Tab 1:** sign in as **Ravi Kumar** (worker, Hindi). Tick consent, start the shift. You see the band (STOP), this hour's work/rest plan, an advance warning and the check-in timer. Switch language at the top: eight worker languages (English, हिन्दी, العربية, اردو, বাংলা, മലയാളം, नेपाली, Tagalog).
2. **Tab 2:** sign in as **Site supervisor**. The planner shows every hour of the day by task type, and the best window for heavy work. The site replays 10 Jun 2025 (real ERA5 weather) at today's clock time; press **Live** for today's forecast.
3. Press **Add simulated crew**, then **Simulate going silent** on Mohammed. About 30 s later a "phone signal lost" alert appears. If nobody acknowledges it, it moves to the first-aider on its own.
4. Back in tab 1, wait for **"Are you OK?"** (about 40 s in the red band). Tap **I feel unwell**, then pick *Confused*. The worker gets the emergency screen with a call button. The supervisor sees "emergency" but no symptoms.
5. **Tab 3:** sign in as **Site first-aider**. Ravi's symptoms are visible because he consented; Mohammed's case shows none. Press *Attending*, then *Resolve*. Every step is in the audit log.
6. Turn off the network in tab 1 (dev tools → Offline). The app keeps showing the saved plan, and red-flag advice still works.
7. In the supervisor console, scroll down:
   - **Regional heat map** (Uber H3 hexagons): press **Play the day** to watch heat move across the area hour by hour. Red outlines mark where the chosen task must stop.
   - **Smart task scheduler:** gives the heaviest tasks the coolest hours and flags work that can't be done safely today.
   - **Summer heat calendar:** every hour of summer 2025, with the midday-ban window outlined. Switch the task type to compare.
   - **Calibrate:** type an on-site WBGT meter reading (e.g. 33) in the header. Every plan at the site corrects itself.
8. In the worker app:
   - **Heart-rate sensor → Demo** simulates a rising heart rate. HeatMitra estimates core temperature and the strain index, and at a strain index of 7 it tells the worker to stop and alerts the supervisor. **Connect Bluetooth sensor** works with real chest straps in Chrome.
   - **Hydration check** is the urine-colour self-check.

   - **Rest break now:** when the plan calls for rest, the worker gets a countdown and taps **I'm resting in the shade**.
9. Back in the supervisor console:
   - **Morning briefing** creates the 06:00 safety talk in four languages, to read aloud or print.
   - **Water and shade** works out the litres of water and shade places the crew needs.
   - The **rule selector** switches between Gulf country rules. Pick the **Lusail (Qatar)** site to see Qatar's 10:00–15:30 window and the 32.1 °C stop rule.
10. **First-aider:** close each case with an outcome (cramps, exhaustion, suspected heat stroke…). Outcomes, and the crew's rest-break adherence, appear in the supervisor's safety measures.

11. When "Are you OK?" appears, answer **🥵 Very hard** twice: the worker gets rest advice and the supervisor gets a "work feels very hard" alert.
12. The supervisor's **Next 3 days** card shows heavy-work STOP hours and best windows ahead, and flags hard days.

13. **Buddy check:** sign Ravi in, start his shift, then in the supervisor tab add the simulated crew and press **Simulate going silent** on Mohammed (Ravi's buddy). About 30 s later Ravi's phone shows "Check on Mohammed now".
14. **SMS fallback:** in the supervisor console's phone panel, tap **START**, then **1** or **2**. Abdul gets every message in Bengali, and "2" alerts the first-aider.
15. **📄 Report** in the supervisor header gives the crew-level HSE report: print it or download it as CSV.

16. **New and returning workers:** sign in as **Bikash** (day 1: 20% safe heat time) or look for the **Back · day 1/4** badge on Suresh. The heat-time bar fills while he works; when it's full he's moved to light work in the shade.
17. **Cool first, transport second:** as a worker, report *Fainted*. The first-aider gets the cooling protocol with a clock; tap **Cooling started** and **Ambulance called**. Time-to-cooling appears in the safety measures and the report.
18. **Site readiness:** the supervisor signs off shade, water, tub and ice, first-aider and cooling vests. Missing critical items are flagged, and the first-aider sees whether the tub is ready.
19. **Dust and UV:** the planner shows PM10 and UV rows. Replay **2025-07-07** for a real dust event (PM10 up to 415 µg/m³).
20. **Background alerts:** in Chrome (or the installed app), tap **🔔 Turn on alerts**. A supervisor can send a test alert through `POST /api/demo/notify/<workerId>`.
21. **Personal limits:** answer **🥵 Very hard** a few times at low heat, and the worker's plan becomes stricter ("1 °C more cautious, learned from your check-ins").

22. **Break check:** when Ravi's **Rest break now** card appears, tap **📍 Scan the rest-station QR** (or type **4271**, Rest cabin B) to confirm the break, and tap **🥤 +1 cup** to log water. The supervisor's **Break check** card shows the crew score. **Audit** a station (untick anything wrong), and **🖨 QR posters** prints the station posters.

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
