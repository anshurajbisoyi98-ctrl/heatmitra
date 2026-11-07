# Back-test: does HeatMitra make the right call?

**Site:** Abu Dhabi (Mussafah) · **Period:** 2025-06-01 to 2025-09-30, 06:00–18:00 (1464 working hours over 122 days) · **Engine:** `public/heat.js`, unchanged

We ran the engine on the forecast as it was issued and on observed (ERA5) weather for the same hours, then compared the decisions it would have given a heavy-work crew (acclimatised, normal clothes).

| Measure | Result |
|---|---|
| STOP hours for heavy work the forecast caught (hit rate) | 93.1% |
| STOP warnings where observed conditions did not need a stop (false-alarm ratio) | 6.8% |
| Hours where forecast and observed gave the same band | 88.2% |
| Hours the forecast **under-warned** (gave a milder band than observed) | 6.1% |
| Hours the forecast over-warned | 5.7% |
| Mean error in recommended work minutes per hour | 3.3 min |
| Median lead from the 06:00 briefing to the first STOP hour | 4 h |
| Median error in when the first STOP hour starts | 1 h |
| Observed heavy-work bands (green / yellow / orange / red) | 0.9% / 6.1% / 32.7% / 60.3% |
| Heavy-work STOP hours per day (observed) | 7.2 |
| Hours above the moderate-work limit **outside** the 12:30–15:00 midday ban | 77.2% (10 such hours per day overall) |
| Hottest hour (est. WBGT) | 37 °C at 2025-08-01T14:00 |

**What this shows.** The fixed midday ban covers 2.5 hours a day, but 77.2% of the hours above the NIOSH limit for moderate work fall outside it. A task-specific work/rest plan driven by the forecast covers those hours, and the 06:00 briefing gives supervisors a median 4 h of notice before heavy work has to stop.

**Method.** For every working hour we estimate WBGT (ISO 7243 outdoor formula, Stull wet bulb, simplified sun and wind globe term) from temperature, humidity, solar radiation and wind in each data set, then apply the NIOSH REL with time-weighted work/rest. Hit rate = hits / (hits + misses); false-alarm ratio = false alarms / (hits + false alarms).

**Limitations.** Forecast = Open-Meteo historical forecast (short-range model output as issued); observed = ERA5 reanalysis, not on-site sensors. This checks the warning against weather conditions, not against health outcomes. The historical-forecast archive is made by joining the first hours of successive model runs, so it is closer to a same-day forecast than a day-ahead one, and real day-ahead skill will be lower. The globe-temperature term is a heuristic, not the Liljegren model. Re-run with `npm run backtest`.
