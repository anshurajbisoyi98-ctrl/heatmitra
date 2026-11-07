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

## 3-minute demo

1. **Tab 1:** sign in as **Ravi Kumar** (worker, Hindi). Tick consent, start the shift. You see the band (STOP), this hour's work/rest plan, an advance warning and the check-in timer. Switch language at the top (English, हिन्दी, العربية, اردو).
2. **Tab 2:** sign in as **Site supervisor**. The planner shows every hour of the day by task type, and the best window for heavy work. The site replays 10 Jun 2025 (real ERA5 weather) at today's clock time; press **Live** for today's forecast.
3. Press **Add simulated crew**, then **Simulate going silent** on Mohammed. About 30 s later a "phone signal lost" alert appears. If nobody acknowledges it, it moves to the first-aider on its own.
4. Back in tab 1, wait for **"Are you OK?"** (about 40 s in the red band). Tap **I feel unwell**, then pick *Confused*. The worker gets the emergency screen with a call button. The supervisor sees "emergency" but no symptoms.
5. **Tab 3:** sign in as **Site first-aider**. Ravi's symptoms are visible because he consented; Mohammed's case shows none. Press *Attending*, then *Resolve*. Every step is in the audit log.
6. Turn off the network in tab 1 (dev tools → Offline). The app keeps showing the saved plan, and red-flag advice still works.
7. In the supervisor console, scroll down:
   - **Regional heat map** (Uber H3 hexagons): press **Play the day** to watch heat move across the area hour by hour. Red outlines mark where the chosen task must stop.
   - **Smart task scheduler:** gives the heaviest tasks the coolest hours and flags work that can't be done safely today.
   - **Summer heat calendar:** every hour of summer 2025, with the midday-ban window outlined. Switch the task type to compare.

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
