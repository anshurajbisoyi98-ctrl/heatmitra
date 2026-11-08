# Research behind HeatMitra's features

A short, time-boxed literature scan, done on the challenge day. Google Scholar blocks automated access, so we searched the open web for the same papers and cite what we could check. Each feature below names its source and its limits.

## Built into the prototype

### 1. Core body temperature from heart rate alone
- **Source:** Buller et al., *Estimation of human core temperature from sequential heart rate observations*, Physiological Measurement 34 (2013) 781–798.
- **Method:** an extended Kalman filter that estimates core temperature minute by minute, using heart rate as its only input. It needs no body measurements, metabolic rate, clothing or weather data.
- **Accuracy:** about 95% of estimates within ±0.63 °C, as reported in secondary sources.
- **Later work:** a 2024 *Frontiers in Public Health* paper calls the Buller model promising for occupational use.
- **In HeatMitra:** `Heat.coreTempStep()` in `public/heat.js`, using the published parameters (a = 1, γ = 0.022², b₀ = −7887.1, b₁ = 384.4286, b₂ = −4.5714, σ = 18.88², starting at 37.1 °C).
- **Limits:**
  - The filter was built on soldiers and athletes, not Gulf construction workers.
  - Medication such as beta-blockers, dehydration and fitness all change the link between heart rate and temperature.
  - It is an estimate, not a measurement.

### 2. Physiological Strain Index (PSI)
- **Source:** Moran, Shitzer & Pandolf, *A physiological strain index to evaluate heat stress*, Am J Physiol 275 (1998).
- **Formula:** `PSI = 5·(Tc − Tc₀)/(39.5 − Tc₀) + 5·(HR − HR₀)/(180 − HR₀)`, on a scale of 0 to 10.
- **Bands:** below 5 low, 5–6 moderate, 7–8 high, 9–10 very high.
- **In HeatMitra:**
  - The phone computes PSI from estimated core temperature and heart rate.
  - Heart rate never leaves the phone.
  - PSI 7 or above sends an alert to the supervisor. PSI 9 or above goes straight to the first-aider as an emergency.
  - The first-aider sees the PSI and core-temperature values only if the worker consented.
- **Real-world fit:** HeatMitra reads any sensor that uses the standard Bluetooth Heart Rate Service (GATT 0x180D), through Web Bluetooth. That covers most chest straps and many watches in broadcast mode, so nothing proprietary is needed.
- **Limits:**
  - We use population baselines (HR₀ = 70, Tc₀ = 37.1 °C), not each worker's own.
  - Recent work questions PSI on its own as a safety index and suggests adding perceived exertion.

### 3. Urine-colour hydration self-check
- **Source:** Armstrong et al. (1994), the first validated 8-colour urine chart. Later studies classify hydration with moderate accuracy (AUC 0.74–0.86). Self-assessment was found valid in college athletes.
- **In HeatMitra:**
  - Eight colour swatches, with advice in four languages that's also read aloud.
  - The result never leaves the phone.
- **Why it fits:** it's visual and needs no reading, which suits a multilingual, mixed-literacy workforce.
- **Limits:**
  - The chart is validated for urine in a cup, not diluted in a toilet bowl. Wardenaar's chart is the validated option for toilets.
  - We found no study validating it specifically for outdoor workers.

### 4. On-site WBGT sensor calibration
- **Rationale:** ISO 7243 is defined on measured WBGT. Our estimate comes from a ~9–11 km weather grid and misses local radiant heat (asphalt, steel, machinery). UAE site studies also disagree about which index fits Gulf conditions best (Bates & Schneider found TWL more useful; Ahmed et al. found WBGT, HSI and TWL all suitable), which argues for checking against on-site readings.
- **In HeatMitra:**
  - The supervisor types in a reading from any WBGT meter.
  - The offset between the reading and the model (capped at ±6 °C) is applied to every plan, schedule and worker screen at that site.
  - The calibration is recorded in the audit log.

### 5. Gulf country rule packs (built)
- **What:** midday bans for the UAE (15 Jun–15 Sep, 12:30–15:00), Saudi Arabia (15 Jun–15 Sep, 12:00–15:00), Qatar (from 1 Jun, 10:00–15:30, plus a stop-work rule at WBGT 32.1 °C), Kuwait (1 Jun–31 Aug, 11:00–16:00), Oman (1 Jun–31 Aug, 12:30–15:30) and Bahrain (15 Jun–15 Sep, 12:00–16:00).
- **Caveat:** sources disagree on some hours (Kuwait, Bahrain), and the search results did not capture Qatar's daily hours, which come from its 2021 resolution. Each rule pack is labelled "check with the labour ministry".
- **In HeatMitra:** `Heat.RULES` in `public/heat.js`, chosen per site.

### 6. Rest-break adherence (built)
- **What:** the challenge asks teams to report "adherence to recommended controls". The worker app runs the NIOSH work/rest cycle and the worker confirms each rest break. The supervisor sees adherence for the whole crew only, never per worker, because individual figures could be used for discipline.

### 7. Perceived exertion (built)
- **Source:** Tikuisis, McLellan & Selkirk, *Perceptual versus physiological heat strain during exercise-heat stress*, Med Sci Sports Exerc 34 (2002), which proposed a perceptual strain index alongside PSI. Recent critiques of PSI also argue for adding perception.
- **In HeatMitra:** a three-face "how hard does your work feel?" answer on each check-in. "Very hard" gets rest advice, and two in a row alert the supervisor. The crew-level share of "very hard" answers is a measure.

### 8. Buddy system (built)
- **Source:** NIOSH's heat-stress recommendations include a buddy system, so co-workers watch each other for signs of heat illness.
- **In HeatMitra:** a "check on your buddy" step sits between the worker and the supervisor. It's usually the fastest physical check on a site, and the buddy sees nothing clinical.

### 9. Cool first, transport second (built, picked independently by both research agents)
- **Filep et al. 2020, *Medicina*** (systematic review, 521 heat-stroke patients): no deaths when cooling was fast enough (> 0.15 °C/min); 23 deaths (4.4%) with slower cooling, and 4.57 times the risk of complications. https://pubmed.ncbi.nlm.nih.gov/33167534/
- **Demartini et al. 2015, *Med Sci Sports Exerc*** (18-year case series, 274 cases): on-site cold-water immersion cooled at 0.22 °C/min, and everyone survived. A 2024 update reports 454 cases, all survived. https://pubmed.ncbi.nlm.nih.gov/24983342/
- **Tishukaj et al. 2024, *J Emerg Med*** (US state EMS guidelines): labourers' odds of dying from heat stroke were 3.7 times higher where guidelines left out "cool first, transport second". Read on Google Scholar; no PMID found.
- **Hosokawa et al. 2017, *Ann Emerg Med*** (lab RCT): tarp-assisted cooling at 0.17 °C/min against 0.04 °C/min passive. https://pubmed.ncbi.nlm.nih.gov/27865532/
- **DeGroot et al. 2023, *J Emerg Med***: ice-sheet cooling, 0.20% mortality across 462 casualties. https://pubmed.ncbi.nlm.nih.gov/36806435/
- **Gulf relevance: Pradhan et al. 2019, *Cardiology*** (Nepali workers in Qatar): cardiovascular deaths were 58% of deaths in the hot season against 22% in the cool season, and up to 200 of 571 were judged preventable. https://pubmed.ncbi.nlm.nih.gov/31302648/

### 10. New and returning workers (built)
- **CDC MMWR 2014 (Arbury et al.)**: 9 of 13 US worker heat deaths happened in the first 3 days on the job, 4 on the first day. https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6331a1.htm
- **NIOSH**: acclimatisation can be lost after a week or more away. https://www.cdc.gov/niosh/heat-stress/recommendations/acclimatization.html

### 11. Cooling vests, dust, background alerts, personal limits (built)
- **Cooling vests**: a 140-worker Hong Kong field study found a vest worn during rest significantly reduced heart rate and body temperature (Chan et al., PolyU). https://research.polyu.edu.hk/en/publications/evaluating-the-effectiveness-and-practicality-of-a-cooling-vest-a/
- **Dust**: during the May 2022 storm, Dubai's city-wide PM10 average was 784.7 µg/m³ (IQAir). https://www.iqair.com/ca/newsroom/2022-dubai-sandstorm
- **Digital programme with outcomes, TEMP cluster RCT (Ding et al. 2025, *Environ Health Perspect*, 528 workers)**: an app with a morning risk score and alerts, plus cooling kit: heat illness 1.80% against 4.82%. The adjusted odds ratio was significant at one follow-up only. https://doi.org/10.1289/EHP14172
- **Personalised models**: ML heat-strain models reach high accuracy on small samples (e.g. 19 workers in Saudi Arabia; 67 workers without wearables, F1 0.79), but none is validated per worker. So HeatMitra's personalisation can only tighten limits.

### 12. Break check: proof that rest, water and shade happened (built)
- **Adelante (Glaser 2020, *Occup Environ Med*; Hansson 2025, 1,044 workers over four harvests)**: kidney injury fell from 21% to 1% (incidence ratio per harvest 0.33), and clinical acute kidney injury fell from 20 to 8 per 1,000 worker-months. The gains tracked how well the programme was put into practice: crews where it was carried out poorly did not improve. https://pubmed.ncbi.nlm.nih.gov/32404530/ · https://doi.org/10.1136/oemed-2025-110128
- **In HeatMitra:** QR check-in at the rest station, a water counter, Adelante-style station audits every 2 hours, and a crew-level score.

### 13. Low effort by design: fewer, meaningful prompts (built)
- **Alarm fatigue (Sendelbach & Funk 2013, *AACN Adv Crit Care* 24(4):378–386):** in hospitals, frequent alarms that mostly need no action desensitise staff, who then respond slowly or miss the real ones. The same risk applies to a worker who gets "Are you OK?" every 20 minutes.
- **In HeatMitra:** check-ins dropped from a median of 24 to 9 per hot shift (summer 2025 calendar, heavy work). They come once an hour at the start of the rest break, so the rest prompt is the check-in, and every 30 min only for workers at higher risk. Answers count from the app, the lock-screen notification, a station QR scan, SMS, WhatsApp, a voice call or the foreman's crew check. Missed check-ins reach the supervisor as one list, not one alarm each. The interval is a judgement call to tune in the pilot (`docs/PILOT.md`).

### 14. Cumulative heat dose and anonymous reporting (built)
- **Kidney health:** repeated heat and dehydration are linked to kidney injury in hot-climate workers (CKDnT; Adelante above). Each worker sees their own hours in high heat this week and season and, past 100 hours, a prompt to ask for a simple kidney check. The threshold is our assumption, to be set with an occupational-health partner.
- **Enforcement gaps:** Human Rights Watch (2026) reports that Gulf heat protections fall short in practice. Workers can report problems (no water, no shade, work during the midday ban, rest refused, no first aid) without their name or the time being stored; counts under 5 show as "<5".

## Found, not built yet (roadmap)
- **Off-shift recovery** (hot housing, short sleep): 29% of 55 workers reached a higher core temperature off work than at work (Krisher 2025); about 5 h of sleep in rooms around 30 °C (Lucas 2025). https://pubmed.ncbi.nlm.nih.gov/40193146/
- **Kidney screening** with occupational-health partners (HeatMitra now prompts workers; the clinic side is still to be set up).
- **Heat-triggered procedures with an inspector-readable log**: California's standard was associated with 15–27% fewer injury claims on hot days (WCRI 2025; not peer-reviewed).

- **Thermal Work Limit (TWL):** (deliberately not approximated: it needs a full heat-balance model, and a safety index we can't verify shouldn't ship)
  - Brake & Bates; tested on UAE construction sites, where one study found it more useful than WBGT for well-hydrated, self-paced workers.
  - It needs a heat-balance model and would be a second index alongside WBGT.

## Sources

- Clyde & Co, GCC midday work ban comparative guide (June 2026): https://www.clydeco.com/en/insights/2026/06/understanding-the-gcc-midday-work-ban
- Morgan Lewis, the GCC midday sun rule (June 2026): https://www.morganlewis.com/blogs/shiftingsandsoflaborlaw/2026/06/the-gcc-midday-sun-rule-what-employers-need-to-know-across-the-gulf
- UAE midday break announcement (Gulf Business, 2023): https://gulfbusiness.com/en/2023/jobs/uae-announces-midday-break-for-outdoor-workers
- Saudi midday ban (Gulf News): https://gulfnews.com/world/gulf/saudi/outdoor-midday-work-ban-starts-in-saudi-arabia-1.2044190
- Bahrain midday ban (Daily Tribune): https://www.newsofbahrain.com/bahrain/91258.html

- Buller et al. 2013, Physiol Meas: https://opact.sdu.edu.tr/vufind/SummonRecord/FETCH-LOGICAL-c408t-ecf24f7ab79f92c4f85b246c328fd25f8e2c140b2368a5a6524a0bd93f3314cc2
- Biphasic Kalman filter follow-up, Frontiers in Public Health 2024: https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2024.1219595/full
- HR-only core temperature models compared (Oxford, 2025): https://ora.ox.ac.uk/objects/uuid:bf948bd9-c40d-4467-abce-f3c0ef36c02a/files/rbc386m388
- Moran et al. 1998 PSI: https://typeset.io/pdf/a-physiological-strain-index-to-evaluate-heat-stress-4zrriemcuu.pdf
- PSI use in real time (Buller, US EPA NRT slides): https://nrt.org/sites/58/files/RT%20PSI%20Assessment%20-%20M.%20Buller.pdf
- Urine colour charts, validity and toilet use (HPRC): https://www.hprc-online.org/nutrition/performance-nutrition/how-accurately-assess-hydration-status-using-urine-color-charts
- Urine colour chart review: https://pmc.ncbi.nlm.nih.gov/articles/PMC8069841
- 8- vs 7-colour chart accuracy: https://www.mdpi.com/1660-4601/18/8/4126/htm
- Self-assessed urine colour in athletes: https://vtechworks.lib.vt.edu/handle/10919/81999
- Heat-stress prevention research in hot climates (ICOH 2012): https://icoh.confex.com/icoh/2012/webprogram/Paper7980.html
- Gulf heat protections (Human Rights Watch, 2026): https://www.hrw.org/news/2026/06/23/gulf-states-migrant-workers-heat-protections-fall-short
- ILO Qatar heat-stress material: https://www.ilo.org/wcmsp5/groups/public/---arabstates/---ro-beirut/---ilo-qatar/documents/presentation/wcms_880719.pdf
