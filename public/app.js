(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const overlay = $('#overlay');
  const topRight = $('#topRight');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pad2 = (n) => String(n).padStart(2, '0');
  const mk = (area) => ({
    get(k, d) { try { const v = area.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { area.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { area.removeItem(k); } catch {} },
  });
  const local = mk(window.localStorage);
  const tab = mk(window.sessionStorage); // per-tab sign-in, so one browser can run worker + supervisor side by side

  const S = { token: tab.get('hm_token', null), user: tab.get('hm_user', null), lang: local.get('hm_lang', 'en'), timers: [] };
  const BAND_ICON = { green: '✓', yellow: '!', orange: '⏸', red: '✋' };
  const STAGES = ['worker', 'supervisor', 'medic'];
  const STAGE_LABEL = { worker: 'Worker', supervisor: 'Supervisor', medic: 'First-aider' };
  const REASON = { checkin_due: 'Check-in due', no_signal: 'Phone signal lost', reported_unwell: 'Reported feeling unwell' };

  function t(key, vars) {
    const L = I18N[S.lang] || I18N.en;
    let s = L[key] ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  }
  const dir = () => (I18N.rtl.includes(S.lang) ? 'rtl' : 'ltr');

  function say(text) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = I18N.voice[S.lang] || 'en-IN';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {}
  }

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'content-type': 'application/json', ...(S.token ? { authorization: `Bearer ${S.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && S.token) { logout(); throw Object.assign(new Error('signed out'), { http: 401 }); }
    if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { http: r.status });
    return j;
  }

  function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }
  function setLang(l) { S.lang = l; local.set('hm_lang', l); document.documentElement.lang = l; }
  function logout() {
    clearTimers();
    S.token = null; S.user = null; tab.del('hm_token'); tab.del('hm_user');
    closeModal(); W.view = null; W.me = null;
    renderLogin();
  }

  function setTop(withLang) {
    const langs = Object.entries(I18N.langs).map(([k, v]) => `<option value="${k}" ${k === S.lang ? 'selected' : ''}>${v}</option>`).join('');
    topRight.innerHTML = `${withLang ? `<select id="langSel" class="btn sm" aria-label="Language">${langs}</select>` : ''}
      ${S.user ? `<span class="small">${esc(S.user.name)} · ${S.user.role === 'medic' ? 'first-aider' : S.user.role}</span><button class="btn sm" id="outBtn">Sign out</button>` : ''}`;
    const ls = $('#langSel');
    if (ls) ls.onchange = (e) => { setLang(e.target.value); if (!S.user) return; W.view = null; drawWorker(); };
    const ob = $('#outBtn');
    if (ob) ob.onclick = logout;
  }

  function closeModal() { overlay.hidden = true; overlay.innerHTML = ''; W.modal = null; }
  function modal(kind, html) { W.modal = kind; overlay.innerHTML = html; overlay.hidden = false; }

  // ---------------- login ----------------
  async function renderLogin() {
    clearTimers();
    setTop(true);
    let users = [];
    try { users = await api('/api/users'); } catch {}
    const g = (r) => users.filter((u) => u.role === r)
      .map((u) => `<button class="btn" data-login="${u.id}">${esc(u.name)} ${r === 'worker' ? `<span class="muted small">· ${I18N.langs[u.lang] || ''}</span>` : ''}</button>`).join('');
    app.innerHTML = `
      <div class="card"><h2>Try the prototype</h2>
        <p class="muted small">Demo sign-in with no passwords. A real deployment would use phone OTP for workers and company SSO for staff.
        Open a worker in one tab and the supervisor in another to watch the escalation ladder work. Sign-in is per tab.</p></div>
      <div class="roles">
        <div class="card who"><h2>Worker app</h2>${g('worker')}</div>
        <div class="card who"><h2>Supervisor console</h2>${g('supervisor')}<p class="muted small">Crew-level view. Never sees symptoms.</p></div>
        <div class="card who"><h2>First-aider console</h2>${g('medic')}<p class="muted small">Sees symptoms only when the worker has consented.</p></div>
      </div>`;
  }

  async function login(userId) {
    const r = await api('/api/login', { method: 'POST', body: { userId } });
    S.token = r.token; S.user = r.user;
    tab.set('hm_token', r.token); tab.set('hm_user', r.user);
    if (r.user.role === 'worker' && r.user.lang) setLang(r.user.lang);
    route();
  }

  // ---------------- worker ----------------
  const W = { me: null, offline: false, lastBand: null, spoken: null, offset: 0, modal: null, view: null };

  function renderWorker() {
    clearTimers();
    setTop(true);
    W.view = null;
    pollWorker();
    S.timers.push(setInterval(pollWorker, 3000));
    S.timers.push(setInterval(() => { if (W.me && W.me.shift && !W.offline) api('/api/heartbeat', { method: 'POST' }).catch(() => {}); }, 10000));
    S.timers.push(setInterval(tick, 1000));
  }

  async function flushQueue() {
    const q = local.get('hm_queue', []);
    if (!q.length) return;
    for (const c of q) await api('/api/checkin', { method: 'POST', body: c });
    local.del('hm_queue');
  }

  async function pollWorker() {
    try {
      await flushQueue();
      const me = await api('/api/me');
      W.me = me; W.offline = false;
      W.offset = me.serverTime ? me.serverTime - Date.now() : 0;
      if (me.shift) local.set('hm_plan', { plan: me.plan, site: me.site, shift: me.shift, consent: me.consent, savedAt: Date.now() });
    } catch (e) {
      if (e.http) return;
      W.offline = true; // network down: fall back to the last plan this phone saved
      const c = local.get('hm_plan', null);
      if (c) {
        const h = new Date().getHours();
        let idx = c.plan.findIndex((p) => Number(p.time.slice(11, 13)) === h);
        if (idx < 0) idx = 0;
        W.me = { ...(W.me || { user: S.user, consent: c.consent }), shift: c.shift, site: c.site, plan: c.plan, current: c.plan[idx], rise: Heat.nextRise(c.plan, idx), alert: null, nextCheckinAt: null, stale: true };
      }
    }
    drawWorker();
  }

  function tick() {
    const el = $('#cdown');
    if (!el || !W.me || !W.me.nextCheckinAt) return;
    const s = Math.max(0, Math.round((W.me.nextCheckinAt - (Date.now() + W.offset)) / 1000));
    el.textContent = `${Math.floor(s / 60)}:${pad2(s % 60)}`;
  }

  function drawShiftForm(me) {
    const u = S.user;
    const opt = (keys, sel) => keys.map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t(k)}</option>`).join('');
    app.innerHTML = `<div class="worker" dir="${dir()}"><div class="card"><h2>${esc(u.name)}</h2>
      <label class="field"><span>${t('task')}</span><select id="fWork">${opt(['light', 'moderate', 'heavy', 'veryheavy'], u.workload)}</select></label>
      <label class="field"><span>${t('clothing')}</span><select id="fCloth">${opt(['standard', 'polyolefin', 'doublelayer', 'vapourbarrier'], u.clothing)}</select></label>
      <label class="field"><span>${t('days')}</span><input type="number" id="fDays" min="0" max="365" value="${Number(u.daysOnSite) || 0}" /></label>
      <label class="check"><input type="checkbox" id="fConsent" ${me.consent && me.consent.symptoms ? 'checked' : ''} /><span>${t('consent')}</span></label>
      <p class="muted small">${t('privacy')}</p>
      <button class="btn big primary" id="fStart">${t('startShift')}</button></div></div>`;
    $('#fStart').onclick = async () => {
      await api('/api/consent', { method: 'POST', body: { symptoms: $('#fConsent').checked } });
      await api('/api/shift/start', { method: 'POST', body: { workload: $('#fWork').value, clothing: $('#fCloth').value, daysOnSite: Number($('#fDays').value) } });
      W.view = null; W.lastBand = null;
      pollWorker();
    };
  }

  function drawWorker() {
    const me = W.me;
    if (!me) return;
    if (!me.shift) {
      if (W.view !== 'form') { W.view = 'form'; drawShiftForm(me); }
      return;
    }
    W.view = 'shift';
    const c = me.current;
    if (!c) return;
    const b = c.band;
    if (W.lastBand && W.lastBand !== b) say(`${t(`b_${b}`)}. ${t(`a_${b}`)}`);
    W.lastBand = b;
    const replay = me.site && me.site.replayDate ? `<span class="tag replay">replay ${esc(me.site.replayDate)}</span>` : '';
    const stale = me.stale ? '<span class="tag stale">saved plan</span>' : '';
    const medic = me.alert && me.alert.stage === 'medic';
    app.innerHTML = `<div class="worker" dir="${dir()}">
      ${W.offline ? `<div class="notice off">${t('offline')}</div>` : ''}
      ${medic ? `<div class="notice rise"><b>${t('emTitle')}</b></div>` : ''}
      <div class="band b-${b}">
        <div class="row"><span class="icon">${BAND_ICON[b]}</span><span class="label">${t(`b_${b}`)}</span></div>
        <div class="act">${t(`a_${b}`)}</div>
        ${c.middayBan ? `<div class="act"><b>${t('ban')}</b></div>` : ''}
        <div class="meta" dir="ltr">WBGT ≈ ${c.wbgtEff}°C · limit ${c.limit}°C · ${esc((c.time || '').slice(11))} ${replay} ${stale}</div>
      </div>
      <div class="card"><h2>${t('plan')}</h2><div class="split">
        <div class="box"><div class="num">${c.workMin}</div>${t('work')} (${t('min')})</div>
        <div class="box"><div class="num">${c.restMin}</div>${t('rest')} (${t('min')})</div></div></div>
      ${me.rise ? `<div class="notice rise">${t('rise', { time: me.rise.time.slice(11), band: t(`b_${me.rise.band}`) })}</div>` : ''}
      ${!c.acclimatised ? `<div class="notice info">${t('acclim', { d: Math.max(1, me.shift.daysOnSite), p: c.exposureCap })}</div>` : ''}
      ${me.nextCheckinAt ? `<div class="card row" style="justify-content:space-between"><span>${t('next')}</span><span class="timer" id="cdown" dir="ltr"></span></div>` : ''}
      <div class="row" style="flex-direction:column;gap:10px;align-items:stretch">
        <button class="btn big ok" data-w="ok">${t('ok')}</button>
        <button class="btn big warn" data-w="unwell">${t('unwell')}</button></div>
      <p class="muted small">${t('privacy')} ${t('notMedical')}</p>
      <label class="check small"><input type="checkbox" id="consentT" ${me.consent && me.consent.symptoms ? 'checked' : ''} /><span>${t('consent')}</span></label>
      <button class="btn" data-w="end">${t('endShift')}</button></div>`;
    $('#consentT').onchange = (e) => api('/api/consent', { method: 'POST', body: { symptoms: e.target.checked } }).catch(() => {});
    tick();
    const prompt = me.alert && me.alert.stage !== 'medic';
    if (prompt && !W.modal) showPrompt(me.alert);
    if (!prompt && W.modal === 'prompt') closeModal();
  }

  function showPrompt(a) {
    modal('prompt', `<div class="modal alarm" dir="${dir()}"><h1>${t('areyouok')}</h1><p>${t('tapok')}</p>
      <div class="row" style="flex-direction:column;gap:10px;align-items:stretch">
      <button class="btn big ok" data-w="ok">${t('ok')}</button><button class="btn big warn" data-w="unwell">${t('unwell')}</button></div></div>`);
    if (W.spoken !== a.id) { W.spoken = a.id; say(`${t('areyouok')} ${t('tapok')}`); if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); }
  }

  function openSymptoms() {
    const chips = Heat.SYMPTOMS.map((s) => `<button class="chip ${Heat.RED_FLAGS.includes(s) ? 'redflag' : ''}" data-sym="${s}">${t(`s_${s}`)}</button>`).join('');
    modal('symptoms', `<div class="modal" dir="${dir()}"><h1>${t('symTitle')}</h1><div class="chips">${chips}</div>
      <div class="row"><button class="btn big warn" data-w="sendSym">${t('send')}</button><button class="btn" data-w="close">${t('cancel')}</button></div></div>`);
  }

  function showEmergency(n) {
    modal('emergency', `<div class="modal alarm" dir="${dir()}"><h1>${t('emTitle')}</h1><p style="font-size:18px">${t('emBody', { n: esc(n) })}</p>
      <a class="btn big ok" style="display:block;text-align:center;text-decoration:none" href="tel:${esc(n)}">${t('call', { n: esc(n) })}</a>
      <p><button class="btn" data-w="close">${t('close')}</button></p></div>`);
    say(`${t('emTitle')}. ${t('emBody', { n })}`);
  }

  function showRest() {
    modal('rest', `<div class="modal" dir="${dir()}"><h1>${t('restTitle')}</h1><p style="font-size:18px">${t('restBody')}</p><button class="btn big" data-w="close">${t('close')}</button></div>`);
    say(`${t('restTitle')}. ${t('restBody')}`);
  }

  async function checkin(status, symptoms = []) {
    closeModal();
    const emergencyNo = (W.me && W.me.site && W.me.site.emergency) || '998';
    try {
      const r = await api('/api/checkin', { method: 'POST', body: { status, symptoms } });
      if (r.action === 'emergency') showEmergency(r.emergency);
      else if (r.action === 'rest') showRest();
    } catch (e) {
      if (e.http) return;
      const q = local.get('hm_queue', []);
      q.push({ status, symptoms, at: Date.now() });
      local.set('hm_queue', q);
      // Red-flag advice works with no network at all.
      if (status === 'unwell') { if (symptoms.some((s) => Heat.RED_FLAGS.includes(s))) showEmergency(emergencyNo); else showRest(); }
    }
    pollWorker();
  }

  // ---------------- supervisor + first-aider ----------------
  const V = { site: null, fc: null, crew: null, alerts: [], audit: [], bt: null, config: null };

  async function renderConsole() {
    clearTimers();
    setTop(false);
    V.config = await api('/api/config');
    V.site = S.user.siteId;
    if (S.user.role === 'supervisor') {
      app.innerHTML = `<div id="sv-head"></div><div class="grid">
        <div class="card" style="grid-column:1/-1" id="sv-plan"></div>
        <div class="card" style="grid-column:1/-1" id="sv-map"></div>
        <div class="card" id="sv-crew"></div><div class="card" id="sv-alerts"></div>
        <div class="card" id="sv-sched"></div><div class="card" id="sv-metrics"></div>
        <div class="card" style="grid-column:1/-1" id="sv-cal"></div>
        <div class="card" id="sv-audit"></div></div>`;
      V.map = null; V.mapSite = null; V.hmPlay = null;
      drawMapShell();
      drawSchedShell();
      loadCalendar();
      await loadForecast();
      fetch('/backtest.json').then((r) => (r.ok ? r.json() : null)).then((j) => { V.bt = j; drawMetrics(); }).catch(() => {});
      S.timers.push(setInterval(() => loadForecast(), 60000));
    } else {
      app.innerHTML = `<div class="grid"><div class="card" id="md-alerts"></div>
        <div class="card"><h2>Heat stroke: first aid</h2><ol class="small">
          <li>Call the site emergency number. Stay with the worker.</li>
          <li>Move them to shade or a cool room. Remove outer clothing and PPE.</li>
          <li>Cool immediately: cold-water immersion if available, otherwise soak with cold water and fan; ice packs at neck, armpits, groin.</li>
          <li>Give sips of cool water only if they are fully alert. Nothing by mouth if confused or vomiting.</li>
          <li>Keep cooling until help arrives. Record what happened when the case is closed.</li></ol>
          <p class="muted small">Heat exhaustion (headache, dizziness, heavy sweating, cramps): rest in shade, cool, fluids, reassess in 15 minutes; escalate if not improving.</p></div>
        <div class="card" id="sv-audit"></div></div>`;
    }
    pollConsole();
    S.timers.push(setInterval(pollConsole, 3000));
  }

  async function loadForecast() {
    try { V.fc = await api(`/api/forecast?site=${V.site}`); } catch { return; }
    drawHead();
    drawPlan();
    drawSched();
    loadHeatmap();
  }

  function site() { return V.config.sites.find((s) => s.id === V.site); }

  function drawHead() {
    const s = site(); const fc = V.fc;
    $('#sv-head').innerHTML = `<div class="card"><div class="row" style="justify-content:space-between">
      <div><h2 style="margin:0">${esc(s.name)}</h2><div class="muted small">${esc(fc ? fc.source : '')}
        ${fc && fc.mode === 'replay' ? `<span class="tag replay">replaying ${esc(s.replayDate)} at today's clock time</span>` : '<span class="tag">live forecast</span>'}
        ${fc && fc.stale ? '<span class="tag stale">network down: cached weather</span>' : ''}</div></div>
      <div class="row">
        <select id="siteSel" class="btn sm">${V.config.sites.map((x) => `<option value="${x.id}" ${x.id === V.site ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <input type="date" id="replayDate" class="btn sm" style="width:auto" value="${esc(s.replayDate || '2025-06-10')}" min="2024-01-01" />
        <button class="btn sm" data-c="replay">Replay day</button><button class="btn sm" data-c="live">Live</button>
        ${V.config.demo ? '<button class="btn sm primary" data-c="crew">Add simulated crew</button>' : ''}
      </div></div></div>`;
    $('#siteSel').onchange = (e) => { V.site = e.target.value; loadForecast(); pollConsole(); };
  }

  async function setMode(replayDate) {
    const s = await api('/api/site/mode', { method: 'POST', body: { siteId: V.site, replayDate } });
    V.config.sites = V.config.sites.map((x) => (x.id === s.id ? s : x));
    loadForecast();
  }

  function drawPlan() {
    const fc = V.fc; const el = $('#sv-plan');
    if (!fc || !el) return;
    const s = site();
    const hours = fc.hourly.filter((r) => { const h = Number(r.time.slice(11, 13)); return h >= 5 && h <= 19; });
    const rows = [
      ['Light', { workload: 'light', clothing: 'standard', daysOnSite: 30 }],
      ['Moderate', { workload: 'moderate', clothing: 'standard', daysOnSite: 30 }],
      ['Heavy', { workload: 'heavy', clothing: 'standard', daysOnSite: 30 }],
      ['Very heavy', { workload: 'veryheavy', clothing: 'standard', daysOnSite: 30 }],
      ['Moderate, new worker', { workload: 'moderate', clothing: 'standard', daysOnSite: 2 }],
      ['Heavy, double-layer coverall', { workload: 'heavy', clothing: 'doublelayer', daysOnSite: 30 }],
    ];
    const plans = rows.map(([label, prof]) => [label, Heat.assessDay(hours, prof, s.middayBan)]);
    const win = Heat.bestWindow(plans[2][1]);
    const cell = (p) => `<td class="c-${p.band} ${p.time === fc.nowTime ? 'now' : ''}" title="WBGT ${p.wbgtEff}°C vs limit ${p.limit}°C${p.middayBan ? ' · midday ban' : ''}">${p.band === 'red' ? 'STOP' : p.workMin === 60 ? '60' : `${p.workMin}/${p.restMin}`}</td>`;
    el.innerHTML = `<h2>Work/rest planner</h2>
      <p class="small">${win ? `Best window for heavy work: <b>${win.start.slice(11)}–${pad2(Number(win.end.slice(11, 13)) + 1)}:00</b>.` : '<b>No safe window for heavy work today.</b> Reschedule or switch to light tasks.'}
      ${s.middayBan ? 'From 15 Jun to 15 Sep, 12:00–14:59 slots also carry the UAE midday outdoor work ban.' : ''}</p>
      <div class="planner"><table>
        <tr><th>Hour</th>${hours.map((h) => `<th class="${h.time === fc.nowTime ? 'now' : ''}">${h.time.slice(11, 13)}</th>`).join('')}</tr>
        <tr><td>Est. WBGT °C</td>${hours.map((h) => `<td>${Heat.wbgt(h.t, h.rh, h.sw, h.wind).toFixed(1)}</td>`).join('')}</tr>
        <tr><td>Air °C / RH %</td>${hours.map((h) => `<td>${Math.round(h.t)}/${Math.round(h.rh)}</td>`).join('')}</tr>
        ${plans.map(([l, p]) => `<tr><td>${l}</td>${p.map(cell).join('')}</tr>`).join('')}
      </table></div>
      <p class="muted small">Cells show minutes of work/rest per hour from the NIOSH time-weighted limit (acclimatised crew in normal clothes unless the row says otherwise). STOP = stop this task, light work in shade only. Hover a cell for WBGT and the limit. The outlined column is now.</p>`;
  }

  async function pollConsole() {
    try {
      const [crew, alerts, audit] = await Promise.all([api(`/api/crew?site=${V.site}`), api('/api/alerts'), api('/api/audit')]);
      V.crew = crew; V.alerts = alerts; V.audit = audit;
    } catch { return; }
    if (S.user.role === 'supervisor') { drawCrew(); drawAlerts('#sv-alerts', 'supervisor'); drawMetrics(); }
    else drawAlerts('#md-alerts', 'medic');
    drawAudit();
  }

  function drawCrew() {
    const c = V.crew; const el = $('#sv-crew');
    if (!el) return;
    const ago = (s) => (s < 60 ? `${s}s` : `${Math.round(s / 60)}m`);
    el.innerHTML = `<h2>Crew on shift (${c.crew.length})</h2>
      <div class="counts">${['green', 'yellow', 'orange', 'red'].map((b) => `<div class="c-${b}"><b>${c.counts[b]}</b>${b}</div>`).join('')}</div>
      ${c.crew.length ? `<table class="list"><tr><th>Worker</th><th>Task</th><th>Check-in</th><th>Signal</th><th></th></tr>
        ${c.crew.map((w) => `<tr><td><span class="dot d-${w.band}"></span>${esc(w.name)}${w.simulated ? ' <span class="tag">sim</span>' : ''}</td>
          <td>${w.workload}</td><td>${ago(w.lastCheckinSec)} ago</td><td>${w.signal === 'lost' ? '<b style="color:var(--red)">lost</b>' : 'ok'}</td>
          <td>${w.alert ? `<span class="tag">${STAGE_LABEL[w.alert.stage]}</span>` : V.config.demo && w.simulated ? `<button class="btn sm" data-silent="${w.workerId}">Simulate going silent</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="muted small">No one on shift. Sign a worker in from another tab, or add the simulated crew.</p>'}
      <p class="muted small">Band comes from site weather, task, clothing and acclimatisation. Symptoms and health history are never shown here.</p>`;
  }

  function alertCard(a, role) {
    const ci = STAGES.indexOf(a.stage);
    const done = a.status === 'resolved';
    const ladder = `<div class="ladder">${STAGES.map((s, i) => `<span class="${done || i < ci ? 'done' : i === ci ? 'cur' : ''}">${STAGE_LABEL[s]}</span>`).join('')}${done ? '<span class="done">Closed</span>' : ''}</div>`;
    const age = Math.max(0, Math.round((Date.now() - a.openedAt) / 1000));
    let actions = '';
    if (!done && role === 'supervisor' && a.stage !== 'medic') actions = `<button class="btn sm ok" data-act="ack" data-id="${a.id}">Checked: worker OK</button><button class="btn sm warn" data-act="escalate" data-id="${a.id}">Call first-aider</button>`;
    if (!done && role === 'medic') actions = `<button class="btn sm" data-act="attend" data-id="${a.id}">Attending</button><button class="btn sm ok" data-act="resolve" data-id="${a.id}">Resolve</button>`;
    let clinical = '';
    if (role === 'medic') {
      if (a.symptoms && a.symptoms.length) clinical = `<div class="small">Symptoms: <b>${a.symptoms.map((s) => esc(I18N.en[`s_${s}`] || s)).join(', ')}</b></div>`;
      else if (a.reason === 'reported_unwell') clinical = '<div class="small muted">Symptoms not shared: the worker has not consented.</div>';
    }
    return `<div class="alert ${a.severity === 'emergency' ? 'emergency' : ''} ${done ? 'resolved' : ''}">
      <div class="row" style="justify-content:space-between"><b>${esc(a.worker)}</b><span class="small muted">${REASON[a.reason] || a.reason} · ${a.severity} · ${age}s ago</span></div>
      ${ladder}${clinical}<div class="row">${actions}</div>
      <div class="small muted">${a.history.slice(-3).map((h) => esc(h.note)).join(' → ')}</div></div>`;
  }

  function drawAlerts(sel, role) {
    const el = $(sel);
    if (!el) return;
    const list = role === 'medic' ? V.alerts.filter((a) => a.stage === 'medic' || a.status === 'resolved') : V.alerts;
    el.innerHTML = `<h2>${role === 'medic' ? 'Cases for the first-aider' : 'Alerts'}</h2>${list.length ? list.map((a) => alertCard(a, role)).join('') : '<p class="muted small">No alerts.</p>'}`;
  }

  function drawMetrics() {
    const el = $('#sv-metrics');
    if (!el) return;
    const m = V.crew && V.crew.metrics;
    const k = (v, unit) => (v == null ? '–' : `${v}${unit || ''}`);
    el.innerHTML = `<h2>Safety measures (this session)</h2>
      ${m ? `<div class="kpis"><div><b>${m.alertsOpened}</b>alerts</div><div><b>${k(m.checkinPromptResponseRate, '%')}</b>prompts answered by worker</div>
        <div><b>${k(m.medianResponseSec, 's')}</b>median time to a human response</div><div><b>${m.reachedFirstAider}</b>reached first-aider</div>
        <div><b>${m.signalLost}</b>signal-lost alerts</div><div><b>${m.emergencies}</b>emergencies</div></div>` : ''}
      ${V.bt ? `<h2 style="margin-top:14px">Back-test: ${esc(V.bt.site)}, ${esc(V.bt.period)}</h2>
        <div class="kpis"><div><b>${V.bt.pod}%</b>danger hours warned (hit rate)</div><div><b>${V.bt.far}%</b>false-alarm ratio</div>
        <div><b>${V.bt.outsideBanPct}%</b>danger hours outside the midday ban</div><div><b>${V.bt.leadMedianH} h</b>median lead from the 06:00 briefing</div></div>
        <p class="muted small">${esc(V.bt.note)}</p>` : ''}`;
  }

  function drawAudit() {
    const el = $('#sv-audit');
    if (!el) return;
    el.innerHTML = `<h2>Audit log</h2><div class="audit">${V.audit.map((a) => `<div>${new Date(a.at).toLocaleTimeString()} · ${esc(a.actor)} · ${esc(a.action)} · ${esc(a.detail)}</div>`).join('') || '<span class="muted">Nothing yet.</span>'}</div>`;
  }

  // ---------------- regional heat map ----------------
  const WORK_LABEL = { light: 'Light work', moderate: 'Moderate work', heavy: 'Heavy work', veryheavy: 'Very heavy work' };
  const workOpts = (sel) => Object.keys(WORK_LABEL).map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${WORK_LABEL[k]}</option>`).join('');
  const WBGT_STOPS = [[24, [44, 123, 182]], [27, [171, 217, 233]], [29, [255, 255, 191]], [31, [253, 174, 97]], [33, [215, 25, 28]], [36, [110, 0, 20]]];
  function wbgtColor(w) {
    if (w <= WBGT_STOPS[0][0]) return `rgb(${WBGT_STOPS[0][1]})`;
    for (let i = 1; i < WBGT_STOPS.length; i++) {
      const [w1, c1] = WBGT_STOPS[i];
      const [w0, c0] = WBGT_STOPS[i - 1];
      if (w <= w1) { const f = (w - w0) / (w1 - w0); return `rgb(${c0.map((c, k) => Math.round(c + f * (c1[k] - c))).join(',')})`; }
    }
    return `rgb(${WBGT_STOPS[WBGT_STOPS.length - 1][1]})`;
  }
  const H3_RES = 6; // ≈ 36 km² hexagons
  const H3_K = 4; // rings around the site's hexagon: 61 hexagons in all
  V.hmHour = Math.min(19, Math.max(5, new Date().getHours()));
  V.hmWork = 'heavy';
  V.calWork = 'heavy';

  function drawMapShell() {
    $('#sv-map').innerHTML = `<div class="row" style="justify-content:space-between">
        <h2 style="margin:0">Regional heat map</h2>
        <div class="row small"><select id="hmWork" class="btn sm" aria-label="Task type">${workOpts(V.hmWork)}</select>
          <button class="btn sm" data-c="play" id="hmPlayBtn">▶ Play the day</button>
          <input type="range" id="hmHour" min="5" max="19" step="1" value="${V.hmHour}" aria-label="Hour" style="width:150px" />
          <b id="hmHourLbl" style="min-width:44px"></b></div></div>
      <div id="map" class="map"></div>
      <div class="row small" style="justify-content:space-between;margin-top:8px">
        <div class="legend"><span>24</span><i></i><span>36 °C WBGT</span><span class="muted">· red outline = STOP for this task</span></div>
        <span class="muted" id="hmNote"></span></div>
      <p class="muted small">Uber H3 hexagonal grid, resolution ${H3_RES} (about 36 km² per hexagon, ${3 * H3_K * (H3_K + 1) + 1} hexagons around the site). Each hexagon samples the weather model at its own centre. Hexagons have equal area and equal-distance neighbours, and the H3 index lets this join other H3 data later (incidents, sensors, crew locations). Detail is still limited by the weather model's ~9–11 km grid. Hover a hexagon for details.</p>`;
    $('#hmHour').oninput = (e) => { V.hmHour = Number(e.target.value); renderHeatmap(); };
    $('#hmWork').onchange = (e) => { V.hmWork = e.target.value; renderHeatmap(); };
    renderHeatmap();
  }

  // H3 hexagons around the site; falls back to the server's square grid if the H3 library is missing.
  async function loadHeatmap() {
    let q = `/api/heatmap?site=${V.site}`;
    let cells = null;
    if (window.h3) {
      try {
        const s = site();
        cells = h3.gridDisk(h3.latLngToCell(s.lat, s.lon, H3_RES), H3_K);
        q += `&pts=${cells.map((c) => { const [a, b] = h3.cellToLatLng(c); return `${a.toFixed(3)},${b.toFixed(3)}`; }).join(';')}`;
      } catch { cells = null; q = `/api/heatmap?site=${V.site}`; }
    }
    try { V.hm = await api(q); } catch {
      const n = $('#hmNote'); if (n) n.textContent = 'Heat map unavailable right now.';
      return;
    }
    V.hm.cells = cells && cells.length === V.hm.points.length ? cells : null;
    renderHeatmap();
  }

  function renderHeatmap() {
    const lbl = $('#hmHourLbl');
    if (lbl) lbl.textContent = `${pad2(V.hmHour)}:00`;
    const hm = V.hm;
    if (!hm || !$('#map')) return;
    if (!window.L) { $('#map').innerHTML = '<p class="muted pad">The map library could not load (no internet?). The planner above still works.</p>'; return; }
    if (!V.map) {
      V.map = L.map('map', { scrollWheelZoom: false, zoomSnap: 0.25 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 14, attribution: '© OpenStreetMap contributors' }).addTo(V.map);
      V.layer = L.layerGroup().addTo(V.map);
      setTimeout(() => V.map && V.map.invalidateSize(), 200);
    }
    const hex = Boolean(hm.cells && window.h3);
    const half = (hm.step || 0.08) / 2;
    const shape = (p, i) => (hex ? h3.cellToBoundary(hm.cells[i])
      : [[p.lat - half, p.lon - half], [p.lat - half, p.lon + half], [p.lat + half, p.lon + half], [p.lat + half, p.lon - half]]);
    const shapes = hm.points.map(shape);
    const viewKey = `${hm.site.id}:${hex ? 'h3' : 'sq'}`;
    if (V.mapSite !== viewKey) {
      V.mapSite = viewKey;
      const bounds = L.latLngBounds(shapes.flat());
      V.map.fitBounds(bounds);
      setTimeout(() => { if (V.map) { V.map.invalidateSize(); V.map.fitBounds(bounds); } }, 300);
    }
    V.layer.clearLayers();
    let stop = 0, lo = 99, hi = -99;
    hm.points.forEach((p, i) => {
      const r = p.hourly.find((x) => Number(x.time.slice(11, 13)) === V.hmHour);
      if (!r) return;
      const a = Heat.assess({ workload: V.hmWork, clothing: 'standard', daysOnSite: 30, t: r.t, rh: r.rh, sw: r.sw, wind: r.wind, time: r.time, middayBan: hm.site.middayBan });
      if (a.band === 'red') stop++;
      lo = Math.min(lo, a.wbgt); hi = Math.max(hi, a.wbgt);
      const plan = a.band === 'red' ? 'STOP' : a.workMin === 60 ? 'normal work' : `${a.workMin} min work / ${a.restMin} min rest`;
      L.polygon(shapes[i], {
        color: a.band === 'red' ? '#7a0000' : '#ffffff', weight: a.band === 'red' ? 2 : 0.6, opacity: a.band === 'red' ? 1 : 0.5,
        fillColor: wbgtColor(a.wbgt), fillOpacity: 0.72,
      }).bindTooltip(`<b>${a.wbgt.toFixed(1)} °C WBGT</b> · ${Math.round(r.t)} °C, ${Math.round(r.rh)}% RH<br>${WORK_LABEL[V.hmWork]}: ${plan}${a.middayBan ? ' (midday ban)' : ''}${hex ? `<br><span style="opacity:.7">H3 ${hm.cells[i]}</span>` : ''}`).addTo(V.layer);
    });
    L.circleMarker([hm.site.lat, hm.site.lon], { radius: 7, color: '#111', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(esc(hm.site.name)).addTo(V.layer);
    const n = $('#hmNote');
    const unit = hex ? `H3 r${H3_RES} hexagons` : 'squares';
    if (n && lo < 99) n.textContent = `${hm.mode === 'replay' ? `Replay ${hm.date}` : 'Live forecast'}${hm.stale ? ' (saved data)' : ''} · ${stop} of ${hm.points.length} ${unit} STOP · ${lo.toFixed(1)}–${hi.toFixed(1)} °C`;
  }

  function togglePlay() {
    const btn = $('#hmPlayBtn');
    if (V.hmPlay) { clearInterval(V.hmPlay); V.hmPlay = null; if (btn) btn.textContent = '▶ Play the day'; return; }
    if (btn) btn.textContent = '❚❚ Pause';
    V.hmPlay = setInterval(() => {
      V.hmHour = V.hmHour >= 19 ? 5 : V.hmHour + 1;
      const s = $('#hmHour'); if (s) s.value = V.hmHour;
      renderHeatmap();
    }, 800);
    S.timers.push(V.hmPlay);
  }

  // ---------------- summer heat calendar ----------------
  async function loadCalendar() {
    try { const r = await fetch('/heatcalendar.json'); V.cal = r.ok ? await r.json() : null; } catch { V.cal = null; }
    drawCalendar();
  }

  function drawCalendar() {
    const el = $('#sv-cal');
    if (!el) return;
    if (!V.cal) { el.innerHTML = '<h2>Summer heat calendar</h2><p class="muted small">Calendar data not available.</p>'; return; }
    const cw = 7, ch = 13, left = 34, top = 18, H = V.cal.firstHour, days = V.cal.days, rows = days[0].h.length;
    const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
    let cells = '', need = 0, outside = 0;
    days.forEach((d, i) => d.h.forEach(([t, rh, sw, wind], k) => {
      const hr = H + k;
      const time = `${d.date}T${pad2(hr)}:00`;
      const a = Heat.assess({ workload: V.calWork, clothing: 'standard', daysOnSite: 30, t, rh, sw, wind, time });
      counts[a.band]++;
      if (a.band === 'red' || a.band === 'orange') { need++; if (!Heat.inMiddayBan(time)) outside++; }
      cells += `<rect class="f-${a.band}" x="${left + i * cw}" y="${top + k * ch}" width="${cw - 1}" height="${ch - 1}"><title>${d.date} ${pad2(hr)}:00 · WBGT ${a.wbgt} °C · ${a.band === 'red' ? 'STOP' : `${a.workMin} min work per hour`}</title></rect>`;
    }));
    const bi = days.findIndex((d) => d.date.slice(5) >= '06-15');
    const bj = days.map((d) => d.date.slice(5) <= '09-15').lastIndexOf(true);
    const ban = bi >= 0 ? `<rect x="${left + bi * cw - 1}" y="${top + (12 - H) * ch - 1}" width="${(bj - bi + 1) * cw + 1}" height="${3 * ch + 1}" fill="none" stroke="#111" stroke-width="2" stroke-dasharray="5 3" />` : '';
    const months = days.map((d, i) => (d.date.endsWith('-01') ? `<text x="${left + i * cw}" y="11" class="cal-t">${new Date(`${d.date}T00:00`).toLocaleString('en', { month: 'short' })}</text>` : '')).join('');
    const hours = Array.from({ length: rows }, (_, k) => (k % 2 === 0 ? `<text x="${left - 5}" y="${top + k * ch + 10}" text-anchor="end" class="cal-t">${pad2(H + k)}</text>` : '')).join('');
    const total = days.length * rows;
    const p = (n) => Math.round((n / total) * 100);
    el.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="margin:0">Summer heat calendar: ${esc(V.cal.site)}, Jun–Sep 2025</h2>
        <select id="calWork" class="btn sm" aria-label="Task type">${workOpts(V.calWork)}</select></div>
      <div class="planner" style="margin-top:8px"><svg width="${left + days.length * cw + 4}" height="${top + rows * ch + 4}" role="img" aria-label="Heat calendar">${months}${hours}${cells}${ban}</svg></div>
      <div class="row small" style="margin:6px 0"><span><span class="dot d-green"></span>normal</span><span><span class="dot d-yellow"></span>caution</span><span><span class="dot d-orange"></span>work/rest cycles</span><span><span class="dot d-red"></span>STOP</span><span>▭ dashed = UAE midday ban</span></div>
      <p class="small">${WORK_LABEL[V.calWork]}: <b>${p(counts.red)}%</b> of working hours were STOP and ${p(counts.orange)}% needed work/rest cycles. Only <b>${need ? Math.round(((need - outside) / need) * 100) : 0}%</b> of the hours that needed breaks or a stop were inside the midday ban.</p>
      <p class="muted small">Each column is a day, each row an hour (05:00–19:00). Hover for details. ${esc(V.cal.source)}, run through the same engine as the live plan.</p>`;
    $('#calWork').onchange = (e) => { V.calWork = e.target.value; drawCalendar(); };
  }

  // ---------------- smart task scheduler ----------------
  V.tasks = local.get('hm_tasks', null) || [
    { name: 'Concrete pour', workload: 'veryheavy', hours: 2 },
    { name: 'Rebar tying', workload: 'heavy', hours: 3 },
    { name: 'Formwork', workload: 'moderate', hours: 3 },
    { name: 'Site survey', workload: 'light', hours: 2 },
  ];
  const fmtMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

  // One crew, tasks one after another. Heaviest task first gets the hours where it can work the most.
  function schedule(tasks, hours, ban) {
    const used = new Set();
    const order = tasks.map((task, idx) => ({ task, idx })).sort((a, b) => Heat.WORKLOAD[b.task.workload] - Heat.WORKLOAD[a.task.workload]);
    return order.map(({ task, idx }) => {
      const plan = Heat.assessDay(hours, { workload: task.workload, clothing: 'standard', daysOnSite: 30 }, ban);
      const need = Math.round(task.hours * 60);
      const cand = plan.map((p, i) => ({ p, i })).filter((x) => !used.has(x.i) && x.p.workMin > 0)
        .sort((a, b) => b.p.workMin - a.p.workMin || a.i - b.i);
      let got = 0;
      const chosen = [];
      for (const c of cand) { if (got >= need) break; chosen.push(c); got += c.p.workMin; }
      chosen.sort((a, b) => a.i - b.i);
      chosen.forEach((c) => used.add(c.i));
      const segs = [];
      chosen.forEach((c) => { const last = segs[segs.length - 1]; if (last && last.end === c.i - 1) last.end = c.i; else segs.push({ start: c.i, end: c.i }); });
      const from = (i) => plan[i].time.slice(11, 16);
      const to = (i) => `${pad2(Number(plan[i].time.slice(11, 13)) + 1)}:00`;
      return { task, idx, ok: got >= need, got: Math.min(got, need), rest: chosen.reduce((s, c) => s + c.p.restMin, 0), segments: segs.map((g) => `${from(g.start)}–${to(g.end)}`) };
    }).sort((a, b) => a.idx - b.idx);
  }

  function drawSchedShell() {
    $('#sv-sched').innerHTML = `<h2>Smart task scheduler</h2>
      <p class="muted small">List today's tasks for one crew. HeatMitra gives the heaviest work the coolest hours, builds in the rest breaks, and flags work that cannot be done safely today.</p>
      <div id="schedList"></div>
      <div class="row" style="margin-top:10px"><input id="tName" placeholder="Task name" class="btn sm" style="flex:1;min-width:110px" maxlength="40" />
        <select id="tWork" class="btn sm" aria-label="Task type">${workOpts('heavy')}</select>
        <input id="tHours" type="number" min="0.5" max="10" step="0.5" value="2" class="btn sm" style="width:64px" aria-label="Hours of work" />
        <button class="btn sm primary" data-c="addTask">Add</button></div>`;
  }

  function drawSched() {
    const el = $('#schedList');
    if (!el || !V.fc) return;
    const hours = V.fc.hourly.filter((r) => { const h = Number(r.time.slice(11, 13)); return h >= 5 && h <= 19; });
    const res = schedule(V.tasks, hours, site().middayBan);
    el.innerHTML = res.length ? res.map((r) => `<div class="sched ${r.ok ? '' : 'bad'}">
        <div class="row" style="justify-content:space-between"><b>${esc(r.task.name)}</b><button class="btn sm" data-deltask="${r.idx}" aria-label="Remove task">✕</button></div>
        <div class="small">${WORK_LABEL[r.task.workload]}, ${fmtMin(Math.round(r.task.hours * 60))} → <b>${r.segments.length ? r.segments.join(', ') : 'no safe hours left'}</b></div>
        <div class="small ${r.ok ? 'muted' : ''}">${r.ok ? `${r.rest} min of rest breaks built in` : `Only ${fmtMin(r.got)} fits safely today. Split it across days, start earlier, or move it to a night shift.`}</div></div>`).join('')
      : '<p class="muted small">No tasks yet.</p>';
  }

  // ---------------- one click handler for everything ----------------
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button, .chip');
    if (!b) return;
    try {
      if (b.dataset.login) return login(b.dataset.login);
      if (b.dataset.sym) return b.classList.toggle('on');
      const w = b.dataset.w;
      if (w === 'ok') return checkin('ok');
      if (w === 'unwell') return openSymptoms();
      if (w === 'close') return closeModal();
      if (w === 'sendSym') return checkin('unwell', [...overlay.querySelectorAll('.chip.on')].map((x) => x.dataset.sym));
      if (w === 'end') { await api('/api/shift/end', { method: 'POST' }).catch(() => {}); local.del('hm_plan'); W.view = null; W.me = null; return pollWorker(); }
      if (b.dataset.act) { await api(`/api/alerts/${b.dataset.id}/${b.dataset.act}`, { method: 'POST', body: {} }); return pollConsole(); }
      if (b.dataset.silent) { await api(`/api/demo/silent/${b.dataset.silent}`, { method: 'POST' }); return pollConsole(); }
      if (b.dataset.deltask) { V.tasks.splice(Number(b.dataset.deltask), 1); local.set('hm_tasks', V.tasks); return drawSched(); }
      const c = b.dataset.c;
      if (c === 'play') return togglePlay();
      if (c === 'addTask') {
        const name = $('#tName').value.trim() || 'Task';
        const hours = Math.min(10, Math.max(0.5, Number($('#tHours').value) || 1));
        V.tasks.push({ name: name.slice(0, 40), workload: $('#tWork').value, hours });
        local.set('hm_tasks', V.tasks);
        $('#tName').value = '';
        return drawSched();
      }
      if (c === 'replay') return setMode($('#replayDate').value);
      if (c === 'live') return setMode(null);
      if (c === 'crew') { await api('/api/demo/crew', { method: 'POST' }); return pollConsole(); }
    } catch (err) { console.warn(err); }
  });

  function route() {
    if (!S.token || !S.user) return renderLogin();
    if (S.user.role === 'worker') return renderWorker();
    return renderConsole();
  }

  setLang(S.lang);
  route();
})();
