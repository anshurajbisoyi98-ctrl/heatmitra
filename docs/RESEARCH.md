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

## Found, not built yet (roadmap)

- **Thermal Work Limit (TWL):**
  - Brake & Bates; tested on UAE construction sites, where one study found it more useful than WBGT for well-hydrated, self-paced workers.
  - It needs a heat-balance model and would be a second index alongside WBGT.
- **Perceived exertion:** adding a quick "how hard does it feel?" check-in, as the newer critiques of PSI suggest.

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
