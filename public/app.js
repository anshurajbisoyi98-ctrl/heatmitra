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
  const STAGES = ['worker', 'buddy', 'supervisor', 'medic'];
  const STAGE_LABEL = { worker: 'Worker', buddy: 'Buddy', supervisor: 'Supervisor', medic: 'First-aider' };
  const OUTCOME_LABEL = { '': 'Outcome…', cramps: 'Heat cramps', exhaustion: 'Heat exhaustion', stroke: 'Suspected heat stroke', notheat: 'Not heat-related', falsealarm: 'False alarm / fine' };
  const REASON = { checkin_due: 'Check-in due', no_signal: 'Phone signal lost', reported_unwell: 'Reported feeling unwell', high_strain: 'High heat strain (wearable)', exertion: 'Says work feels very hard (twice in a row)' };

  function t(key, vars) {
    const L = I18N[S.lang] || I18N.en;
    let s = L[key] ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  }
  const dir = () => (I18N.rtl.includes(S.lang) ? 'rtl' : 'ltr');

  function say(text, lang = S.lang) {
    if (!text || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = I18N.voice[lang] || 'en-IN';
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

  function closeModal() {
    if (typeof stopCamera === 'function') stopCamera(); overlay.hidden = true; overlay.innerHTML = ''; W.modal = null; }
  function modal(kind, html) { W.modal = kind; overlay.innerHTML = html; overlay.hidden = false; }

  // ---------------- login ----------------
  async function renderLogin() {
    clearTimers();
    setTop(true);
    let users = [];
    try { users = await api('/api/users'); } catch {}
    const g = (r) => users.filter((u) => u.role === r && u.channel !== 'sms')
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
    // Heartbeat, with whether the app is on screen: when it's put away (phone locked), the server stops
    // treating silence as a lost phone and reaches the worker by push instead.
    const beat = () => { if (W.me && W.me.shift && !W.offline) api('/api/heartbeat', { method: 'POST', body: { visible: document.visibilityState === 'visible' } }).catch(() => {}); };
    S.timers.push(setInterval(beat, 10000));
    document.onvisibilitychange = beat;
    S.timers.push(setInterval(tick, 1000));
  }

  async function flushQueue() {
    const q = local.get('hm_queue', []);
    if (!q.length) return;
    for (const c of q) await api('/api/checkin', { method: 'POST', body: c });
    local.del('hm_queue');
  }

  // Break check: scan the station QR in the app (BarcodeDetector), type the code, or open the QR link from the camera app.
  const qs = new URLSearchParams(location.search).get('s');
  if (qs) { local.set('hm_station', qs); history.replaceState(null, '', location.pathname); }
  async function verifyStation(code) {
    const out = $('#scanOut');
    try {
      const r = await api('/api/rest/verify', { method: 'POST', body: { code } });
      const msg = r.verified ? t('verified', { station: r.station }) : t('visitOnly', { station: r.station });
      if (out) { out.textContent = msg; out.style.color = r.verified ? 'var(--green)' : ''; } else showNote(msg);
      say(msg);
      stopCamera();
      setTimeout(() => { if (W.modal === 'scan') closeModal(); pollWorker(); }, 1800);
    } catch (e) { if (out) { out.textContent = t('badCode'); out.style.color = 'var(--red)'; } }
  }
  function showNote(msg) { modal('note', `<div class="modal" dir="${dir()}"><p style="font-size:18px">${esc(msg)}</p><button class="btn" data-w="close">${t('close')}</button></div>`); }
  let camStream = null;
  function stopCamera() { if (camStream) { camStream.getTracks().forEach((x) => x.stop()); camStream = null; } }
  async function openScan() {
    modal('scan', `<div class="modal" dir="${dir()}"><h1>📍 ${t('scanStation')}</h1>
      <video id="scanVideo" playsinline muted style="width:100%;border-radius:12px;background:#111;display:none"></video>
      <label class="field"><span>${t('stationCode')}</span><input id="scanCode" inputmode="numeric" maxlength="8" style="font-size:22px;letter-spacing:4px" /></label>
      <p id="scanOut" style="font-size:17px"></p>
      <div class="row"><button class="btn primary" data-w="scanSend">${t('send')}</button><button class="btn" data-w="close">${t('close')}</button></div></div>`);
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices) return;
    try {
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = $('#scanVideo');
      if (!v) return stopCamera();
      v.srcObject = camStream; v.style.display = 'block'; await v.play();
      const loop = async () => {
        if (!camStream || W.modal !== 'scan') return stopCamera();
        const codes = await det.detect(v).catch(() => []);
        if (codes.length) {
          const raw = codes[0].rawValue;
          let code = raw;
          try { code = new URL(raw).searchParams.get('s') || raw; } catch {}
          return verifyStation(code);
        }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { stopCamera(); }
  }

  async function pollWorker() {
    try {
      await flushQueue();
      const me = await api('/api/me');
      W.me = me; W.offline = false;
      W.offset = me.serverTime ? me.serverTime - Date.now() : 0;
      if (me.shift) local.set('hm_plan', { plan: me.plan, site: me.site, shift: me.shift, consent: me.consent, savedAt: Date.now() });
      const pending = local.get('hm_station', null);
      if (me.shift && pending) { local.del('hm_station'); verifyStation(pending); }
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
    const fmt = (at) => { const s = Math.max(0, Math.round((at - (Date.now() + W.offset)) / 1000)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };
    const el = $('#cdown');
    if (el && W.me && W.me.nextCheckinAt) el.textContent = fmt(W.me.nextCheckinAt);
    const rc = $('#restCd');
    if (rc && W.me && W.me.rest && W.me.rest.endsAt) rc.textContent = fmt(W.me.rest.endsAt);
  }

  // New or returning to the heat: today's safe heat time and how much is used (NIOSH acclimatisation schedule).
  function acclimHtml(me) {
    const a = me.acclim;
    if (!a || a.kind === 'acclimatised' || a.cap >= 100) return '';
    const used = Math.min(100, Math.round((a.heatMin / Math.max(1, a.capMin)) * 100));
    const head = a.kind === 'returning' ? t('returning', { a: a.awayDays, d: a.day, m: a.capMin }) : t('newWorker', { d: a.day, m: a.capMin });
    return `<div class="notice info">${head}<div class="psi"><span class="p-${used >= 100 ? 'veryhigh' : used >= 75 ? 'high' : 'low'}" style="width:${used}%"></span></div>
      <div class="small" dir="ltr">${t('expBar')}: ${a.heatMin} / ${a.capMin} ${t('min')}</div></div>`;
  }

  // Dust (PM10), strong UV and cooling-vest advice for this hour.
  function hazardHtml(c, me) {
    const out = [];
    const air = c.air || {};
    if (air.dust && air.dust !== 'green') out.push(`<div class="notice ${air.dust === 'red' ? 'rise' : 'off'}">😷 ${t(`dust_${air.dust[0]}`)} <span class="muted small" dir="ltr">PM10 ${air.pm10} µg/m³</span></div>`);
    if (air.uvHigh) out.push(`<div class="notice off">☀️ ${t('uvHigh', { u: air.uv })}</div>`);
    if (me.cooling && me.cooling.vests && (c.band === 'orange' || c.band === 'red')) out.push(`<div class="notice info">🧊 ${t('coolVest')}</div>`);
    return out.join('');
  }

  // Background alerts: Web Push, so prompts reach the phone even when the app is closed.
  function pushHtml(me) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return '';
    if (me.push && me.push.subscribed) return `<p class="small muted">🔔 ${t('pushOk')} ${t('pushSpam')}</p>`;
    if (window.Notification && Notification.permission === 'denied') return `<p class="small muted">🔕 ${t('pushNo')}</p>`;
    return `<button class="btn" data-w="push" style="width:100%;margin-bottom:12px">🔔 ${t('pushOn')}</button>`;
  }
  async function enablePush(ask = true) {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (Notification.permission !== 'granted') {
        if (!ask) return;
        if ((await Notification.requestPermission()) !== 'granted') return drawWorker();
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const { key } = await api('/api/push/key');
        const raw = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
      }
      await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
      pollWorker();
    } catch (e) { console.warn('push', e); }
  }

  // Work/rest cycle from the plan: tells the worker when to rest and lets them confirm it.
  function drawShiftForm(me) {
    const u = S.user;
    const opt = (keys, sel) => keys.map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t(k)}</option>`).join('');
    // The supervisor assigns task and clothing; the worker only taps Start (and can change it if it's wrong).
    app.innerHTML = `<div class="worker" dir="${dir()}"><div class="card"><h2>${esc(u.name)}</h2>
      <p class="assigned">🛠 ${t('task')}: <b>${t(u.workload)}</b><br>👕 ${t('clothing')}: <b>${t(u.clothing)}</b></p>
      <details class="change"><summary>${t('change')}</summary>
        <label class="field"><span>${t('task')}</span><select id="fWork">${opt(['light', 'moderate', 'heavy', 'veryheavy'], u.workload)}</select></label>
        <label class="field"><span>${t('clothing')}</span><select id="fCloth">${opt(['standard', 'polyolefin', 'doublelayer', 'vapourbarrier'], u.clothing)}</select></label></details>
      <button class="btn big primary" id="fStart">${t('startShift')}</button>
      <label class="check"><input type="checkbox" id="fConsent" ${me.consent && me.consent.symptoms ? 'checked' : ''} /><span>${t('consent')}</span></label>
      <p class="muted small">${t('privacy')}</p></div></div>`;
    $('#fStart').onclick = async () => {
      await api('/api/consent', { method: 'POST', body: { symptoms: $('#fConsent').checked } });
      await api('/api/shift/start', { method: 'POST', body: { workload: $('#fWork').value, clothing: $('#fCloth').value } });
      enablePush(false);
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
    const r = me.rest || {};
    const air = c.air || {};
    const a = me.acclim;
    if (r.phase === 'rest' && !r.acked && W.restSaid !== r.endsAt) { // rest break starts: speak and buzz once
      W.restSaid = r.endsAt;
      if (!(me.alert && me.alert.rest)) say(t('restNow')); // the rest prompt speaks for itself
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    }
    const pushTop = me.push && !me.push.subscribed && !(window.Notification && Notification.permission === 'denied');
    const acclimLine = a && a.kind !== 'acclimatised' && a.cap < 100 ? `<div class="notice info">${a.kind === 'returning' ? t('returning', { a: a.awayDays, d: a.day, m: a.capMin }) : t('newWorker', { d: a.day, m: a.capMin })}</div>` : '';
    // Simple by default: what to do now, rest when it's time, two big buttons. Everything else is under "More".
    app.innerHTML = `<div class="worker simple" dir="${dir()}">
      ${W.offline ? `<div class="notice off">${t('offline')}</div>` : ''}
      ${medic ? `<div class="notice rise"><b>${t('emTitle')}</b></div>` : ''}
      <div class="band b-${b}">
        <div class="row"><span class="icon">${BAND_ICON[b]}</span><span class="label">${t(`b_${b}`)}</span></div>
        <div class="act">${t(`a_${b}`)}</div>
        ${c.middayBan ? `<div class="act"><b>${t('ban', { start: c.banStart, end: c.banEnd })}</b></div>` : ''}
        ${c.ruleStop ? `<div class="act"><b>${t('ruleStop', { w: c.wbgt, lim: c.ruleLimit })}</b></div>` : ''}
        ${c.capUsed ? `<div class="act"><b>${t('capUsed')}</b></div>` : ''}
        ${c.restMin ? `<div class="hour">${t('plan')}: <b>${c.workMin}</b> ${t('work')} · <b>${c.restMin}</b> ${t('rest')} <span class="small">(${t('min')})</span></div>` : ''}
      </div>
      ${r.phase === 'rest' ? `<div class="card rest-now"><div class="row" style="justify-content:space-between"><b>⏸ ${t('restNow')}</b><span class="timer" id="restCd" dir="ltr"></span></div>
        ${r.acked ? `<div><b>${t('resting')}</b></div>` : `<button class="btn big ok" data-w="rest" style="margin-top:8px">🌴 ${t('restBtn')}</button>`}</div>` : ''}
      ${air.dust === 'red' ? `<div class="notice rise">😷 ${t('dust_r')}</div>` : ''}
      ${acclimLine}
      ${pushTop ? pushHtml(me) : ''}
      <div class="row" style="flex-direction:column;gap:10px;align-items:stretch">
        ${r.phase === 'rest' && !r.acked ? '' : `<button class="btn big ok" data-w="ok">${t('ok')}</button>`}
        <button class="btn big warn" data-w="unwell">${t('unwell')}</button></div>
      ${me.buddy ? `<p class="small">🤝 ${t('yourBuddy', { name: esc(me.buddy.name) })}</p>` : ''}
      <details class="more" id="more" ${W.more ? 'open' : ''}><summary>${t('more')}</summary>
        <div class="meter" dir="ltr" aria-hidden="true"><span style="left:${Math.max(0, Math.min(100, ((c.wbgtEff - c.limit + 6) / 12) * 100))}%"></span></div>
        <div class="meta small muted" dir="ltr">WBGT ≈ ${c.wbgtEff}°C · limit ${c.limit}°C · ${esc((c.time || '').slice(11))} ${replay} ${stale}</div>
        ${r.phase === 'rest' && !r.verified ? `<button class="btn" data-w="scan" style="width:100%;margin:8px 0">📍 ${t('scanStation')}</button>` : r.verified ? '<div class="small" style="color:var(--green)"><b>📍 ✓</b></div>' : ''}
        ${r.phase !== 'rest' && r.endsAt ? `<div class="card row" style="justify-content:space-between"><span>⏸ ${t('nextRest')}</span><span class="timer" id="restCd" dir="ltr"></span></div>` : ''}
        <div class="row" style="margin-bottom:12px"><button class="btn" data-w="hyd" style="flex:1">💧 ${t('hyd')}</button>
          <button class="btn" data-w="cup" style="flex:1">🥤 ${t('cup')}</button></div>
        ${me.water ? `<p class="small muted" style="margin-top:-6px">${t('cups', { n: me.water.cups })}${me.water.due ? ` / ${me.water.due}` : ''}</p>` : ''}
        ${me.rise ? `<div class="notice rise">${t('rise', { time: me.rise.time.slice(11), band: t(`b_${me.rise.band}`) })}</div>` : ''}
        ${air.dust === 'red' ? '' : hazardHtml(c, me)}
        ${acclimHtml(me)}
        ${me.personal && me.personal.offset > 0 ? `<div class="notice info">🧠 ${t('personal', { c: me.personal.offset })}</div>` : ''}
        ${pushTop ? '' : pushHtml(me)}
        ${me.nextCheckinAt ? `<div class="card row" style="justify-content:space-between"><span>${t('next')}</span><span class="timer" id="cdown" dir="ltr"></span></div>` : ''}
        ${wearHtml()}
        <p class="muted small">${t('privacy')} ${t('notMedical')}</p>
        <label class="check small"><input type="checkbox" id="consentT" ${me.consent && me.consent.symptoms ? 'checked' : ''} /><span>${t('consent')}</span></label>
        <button class="btn" data-w="end">${t('endShift')}</button>
      </details></div>`;
    $('#more').ontoggle = (e) => { W.more = e.target.open; };
    $('#consentT').onchange = (e) => api('/api/consent', { method: 'POST', body: { symptoms: e.target.checked } }).catch(() => {});
    tick();
    const prompt = me.alert && me.alert.stage !== 'medic';
    const pkey = prompt ? me.alert.id + (me.alert.reminded ? ':r' : '') : null;
    if (prompt && (!W.modal || (W.modal === 'prompt' && W.spoken !== pkey))) showPrompt(me.alert);
    if (!prompt && W.modal === 'prompt') closeModal();
    if (!prompt && me.buddyTask && !W.modal) showBuddy(me.buddyTask);
    if (!me.buddyTask && W.modal === 'buddy') closeModal();
  }

  // "Check on your buddy": only the name and that they are not answering. Nothing clinical.
  function showBuddy(task) {
    modal('buddy', `<div class="modal alarm" dir="${dir()}"><h1>🤝 ${t('buddyTitle', { name: esc(task.name) })}</h1><p style="font-size:18px">${t('buddyBody')}</p>
      <div class="row" style="flex-direction:column;gap:10px;align-items:stretch">
        <button class="btn big ok" data-bud="ok" data-id="${task.id}">${t('buddyOk')}</button>
        <button class="btn big warn" data-bud="help" data-id="${task.id}">${t('buddyHelp')}</button></div></div>`);
    if (W.budSaid !== task.id) {
      W.budSaid = task.id;
      say(`${t('buddyTitle', { name: task.name })}. ${t('buddyBody')}`);
      if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
    }
  }

  function showPrompt(a) {
    const key = a.id + (a.reminded ? ':r' : '');
    if (a.rest) {
      modal('prompt', `<div class="modal alarm" dir="${dir()}"><h1>⏸ ${t('restNow')}</h1><p style="font-size:20px">${t('rest')}</p>
        <div class="row" style="flex-direction:column;gap:10px;align-items:stretch">
        <button class="btn big ok" data-w="rest">🌴 ${t('restBtn')}</button>
        <button class="btn big warn" data-w="unwell">${t('unwell')}</button></div></div>`);
      if (W.spoken !== key) { W.spoken = key; say(`${t('restNow')}. ${t('rest')}`); if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); }
      return;
    }
    modal('prompt', `<div class="modal alarm" dir="${dir()}"><h1>${t('areyouok')}</h1><p>${t('tapok')}</p>
      <div class="row" style="flex-direction:column;gap:10px;align-items:stretch">
      <button class="btn big ok" data-w="ok">${t('ok')}</button>
      <div><b>${t('exAsk')}</b><div class="row ex-row" style="margin-top:6px">${['easy', 'hard', 'veryhard'].map((e, i) => `<button class="btn ex-${e}" data-ex="${e}">${['🙂', '😓', '🥵'][i]} ${t(`ex_${e}`)}</button>`).join('')}</div></div>
      <button class="btn big warn" data-w="unwell">${t('unwell')}</button></div></div>`);
    if (W.spoken !== key) { W.spoken = key; say(`${t('areyouok')} ${t('tapok')}`); if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); }
  }

  function openSymptoms() {
    const chips = Heat.SYMPTOMS.map((s) => `<button class="chip ${Heat.RED_FLAGS.includes(s) ? 'redflag' : ''}" data-sym="${s}">${t(`s_${s}`)}</button>`).join('');
    modal('symptoms', `<div class="modal" dir="${dir()}"><h1>${t('symTitle')}</h1><div class="chips">${chips}</div>
      <div class="row"><button class="btn big warn" data-w="sendSym">${t('send')}</button><button class="btn" data-w="close">${t('cancel')}</button></div></div>`);
  }

  // For the buddy or bystanders at a suspected heat stroke: start cooling before anything else.
  function showCfts() {
    modal('cfts', `<div class="modal alarm" dir="${dir()}"><h1>🧊 ${t('emTitle')}</h1><p style="font-size:18px"><b>${t('cfts')}</b></p>
      ${W.me && W.me.cooling && W.me.cooling.spot ? `<p style="font-size:17px">${t('coolSpot', { where: esc(W.me.cooling.spot) })}</p>` : ''}<button class="btn big" data-w="close">${t('close')}</button></div>`);
    say(t('cfts'));
  }

  function showEmergency(n) {
    const spot = W.me && W.me.cooling && W.me.cooling.spot;
    modal('emergency', `<div class="modal alarm" dir="${dir()}"><h1>${t('emTitle')}</h1><p style="font-size:18px">${t('emBody', { n: esc(n) })}</p>
      <p class="small"><b>${t('cfts')}</b></p>
      ${spot ? `<p style="font-size:17px"><b>🧊 ${t('coolSpot', { where: esc(spot) })}</b></p>` : ''}
      <a class="btn big ok" style="display:block;text-align:center;text-decoration:none" href="tel:${esc(n)}">${t('call', { n: esc(n) })}</a>
      <p><button class="btn" data-w="close">${t('close')}</button></p></div>`);
    say(`${t('emTitle')}. ${t('emBody', { n })}`);
  }

  function showRest() {
    modal('rest', `<div class="modal" dir="${dir()}"><h1>${t('restTitle')}</h1><p style="font-size:18px">${t('restBody')}</p><button class="btn big" data-w="close">${t('close')}</button></div>`);
    say(`${t('restTitle')}. ${t('restBody')}`);
  }

  function showExRest() {
    modal('rest', `<div class="modal" dir="${dir()}"><h1>🥵 ${t('restTitle')}</h1><p style="font-size:18px">${t('exRest')}</p><button class="btn big" data-w="close">${t('close')}</button></div>`);
    say(`${t('restTitle')}. ${t('exRest')}`);
  }

  async function checkin(status, symptoms = [], exertion = null) {
    closeModal();
    const emergencyNo = (W.me && W.me.site && W.me.site.emergency) || '998';
    try {
      const r = await api('/api/checkin', { method: 'POST', body: { status, symptoms, exertion } });
      if (r.action === 'emergency') showEmergency(r.emergency);
      else if (r.action === 'rest') showRest();
      else if (r.action === 'exertion') showExRest();
    } catch (e) {
      if (e.http) return;
      const q = local.get('hm_queue', []);
      q.push({ status, symptoms, exertion, at: Date.now() });
      if (status === 'ok' && exertion === 'veryhard') showExRest();
      local.set('hm_queue', q);
      // Red-flag advice works with no network at all.
      if (status === 'unwell') { if (symptoms.some((s) => Heat.RED_FLAGS.includes(s))) showEmergency(emergencyNo); else showRest(); }
    }
    pollWorker();
  }

  // ---------------- wearable heat strain (heart rate -> core temp -> PSI) ----------------
  // Heart rate never leaves the phone. Core temperature: Buller et al. 2013 Kalman filter.
  // Strain: Moran et al. 1998 PSI. Only PSI >= 7 is reported, as an alert.
  W.wear = null;
  function wearHtml() {
    const w = W.wear;
    const body = w && w.psi != null
      ? (() => {
        const band = Heat.psiBand(w.psi);
        return `<div class="row" style="justify-content:space-between" dir="ltr"><span>♥ <b>${w.hr}</b> bpm</span><span>${t('coreTemp')} <b>${w.state.ct.toFixed(1)} °C</b></span></div>
          <div class="psi"><span style="width:${w.psi * 10}%" class="p-${band}"></span></div>
          <div><b>${t('strain')}: ${w.psi}/10</b> · ${t(`psi_${band}`)}</div>`;
      })()
      : `<div class="row"><button class="btn sm" data-w="wearBle">${t('wearConnect')}</button><button class="btn sm" data-w="wearDemo">${t('wearDemo')}</button></div>`;
    return `<div class="card" id="wearCard"><h2>${t('wearTitle')}${w ? ` <span class="tag">${w.src === 'ble' ? 'Bluetooth' : 'demo'}</span>` : ''}</h2>${body}<p class="muted small">${t('wearNote')}</p></div>`;
  }
  function updateWear() {
    const el = $('#wearCard');
    if (el) el.outerHTML = wearHtml();
  }
  async function stepWear(hr) {
    const w = W.wear;
    if (!w) return;
    w.hr = hr;
    w.state = Heat.coreTempStep(w.state, hr);
    w.psi = Heat.psi(w.state.ct, hr);
    updateWear();
    if (w.psi >= 7 && Date.now() - w.lastSent > 30000) {
      w.lastSent = Date.now();
      say(`${t('strain')}: ${t(`psi_${Heat.psiBand(w.psi)}`)}`);
      try {
        const r = await api('/api/strain', { method: 'POST', body: { psi: w.psi, ct: w.state.ct } });
        if (r.action === 'emergency') showEmergency(r.emergency); else if (r.action === 'stop') showRest();
      } catch {}
    }
  }
  function startDemoWear() {
    W.wear = { src: 'demo', state: null, hr: null, psi: null, t0: Date.now(), lastSent: 0 };
    const timer = setInterval(() => {
      if (!W.wear || W.wear.src !== 'demo') return clearInterval(timer);
      const s = (Date.now() - W.wear.t0) / 1000;
      const hr = Math.round(Math.min(168, 88 + s * 2.4) + (Math.random() * 4 - 2));
      for (let i = 0; i < 3; i++) stepWear(hr); // demo: 3 simulated minutes per second
    }, 1000);
    S.timers.push(timer);
    updateWear();
  }
  // Standard Bluetooth Heart Rate Service (0x180D): chest straps and many watches in broadcast mode.
  async function connectWear() {
    if (!navigator.bluetooth) { alert('This browser has no Web Bluetooth. Use Chrome on Android or desktop, or try the demo.'); return; }
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
      const ch = await (await (await dev.gatt.connect()).getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
      W.wear = { src: 'ble', state: null, hr: null, psi: null, buf: [], lastStep: 0, lastSent: 0 };
      ch.addEventListener('characteristicvaluechanged', (e) => {
        const d = e.target.value;
        const hr = d.getUint8(0) & 1 ? d.getUint16(1, true) : d.getUint8(1);
        const w = W.wear;
        if (!w || w.src !== 'ble') return;
        w.buf.push(hr);
        if (Date.now() - w.lastStep >= 60000) { // the filter expects 1-minute means
          const mean = Math.round(w.buf.reduce((a, b) => a + b, 0) / w.buf.length);
          w.buf = []; w.lastStep = Date.now();
          stepWear(mean);
        }
      });
      await ch.startNotifications();
      updateWear();
    } catch (err) { console.warn(err); }
  }

  // Urine colour self-check (Armstrong et al. 1994, 8-colour chart). Result stays on the phone.
  const URINE = ['#fbfbe3', '#f8f3b5', '#f4e98a', '#efd85c', '#e3c03b', '#d2a52a', '#b5861f', '#8c6514'];
  function openHydration() {
    modal('hyd', `<div class="modal" dir="${dir()}"><h1>💧 ${t('hyd')}</h1><p>${t('hydAsk')}</p>
      <div class="urine">${URINE.map((c, i) => `<button class="swatch" style="background:${c}" data-hyd="${i + 1}" aria-label="${i + 1}">${i + 1}</button>`).join('')}</div>
      <p id="hydOut" style="font-size:18px"></p><p class="muted small">${t('hydNote')}</p><button class="btn" data-w="close">${t('close')}</button></div>`);
  }
  function pickHydration(n) {
    const key = n <= 3 ? 'hyd_ok' : n <= 5 ? 'hyd_mid' : 'hyd_bad';
    const out = $('#hydOut');
    if (out) { out.textContent = t(key); out.style.color = n <= 3 ? 'var(--green)' : n <= 5 ? '#9a4300' : 'var(--red)'; }
    say(t(key));
  }

  // ---------------- supervisor + first-aider ----------------
  const V = { site: null, fc: null, crew: null, alerts: [], audit: [], bt: null, config: null, outcomes: {} };
  document.addEventListener('change', (e) => {
    const d = e.target.dataset || {};
    if (d.outcomeFor) V.outcomes[d.outcomeFor] = e.target.value;
    if (d.crewchk) { if (e.target.checked) V.unseen.delete(d.crewchk); else V.unseen.add(d.crewchk); }
  });

  async function renderConsole() {
    clearTimers();
    setTop(false);
    V.config = await api('/api/config');
    V.site = S.user.siteId;
    if (S.user.role === 'supervisor') {
      // Today: what a foreman needs on site. Insights: planning and analytics for HSE managers. Crew setup: roster.
      V.tab = V.tab || local.get('hm_tab', 'today');
      V.unseen = V.unseen || new Set();
      app.innerHTML = `<div id="sv-head"></div>
        <nav class="tabs" id="sv-tabs">${[['today', 'Today'], ['insights', 'Insights'], ['setup', 'Crew setup']].map(([k, l]) => `<button class="${V.tab === k ? 'on' : ''}" data-c="tab" data-tab-go="${k}">${l}</button>`).join('')}</nav>
        <div class="grid" id="sv-grid" data-show="${V.tab}">
        <div class="card" style="grid-column:1/-1" data-tab="today" id="sv-today"></div>
        <div class="card" data-tab="today" id="sv-alerts"></div><div class="card" data-tab="today" id="sv-crew"></div>
        <div class="card" data-tab="today" id="sv-ready"></div>
        <div class="card" style="grid-column:1/-1" data-tab="insights" id="sv-plan"></div>
        <div class="card" style="grid-column:1/-1" data-tab="insights" id="sv-outlook"></div>
        <div class="card" style="grid-column:1/-1" data-tab="insights" id="sv-map"></div>
        <div class="card" data-tab="insights" id="sv-sched"></div><div class="card" data-tab="insights" id="sv-logi"></div>
        <div class="card" data-tab="insights" id="sv-breaks"></div><div class="card" data-tab="insights" id="sv-sms"></div>
        <div class="card" style="grid-column:1/-1" data-tab="insights" id="sv-metrics"></div>
        <div class="card" style="grid-column:1/-1" data-tab="insights" id="sv-cal"></div>
        <div class="card" data-tab="insights" id="sv-audit"></div>
        <div class="card" style="grid-column:1/-1" data-tab="setup" id="sv-setup"></div></div>`;
      V.map = null; V.mapSite = null; V.hmPlay = null;
      drawSmsShell();
      drawReadiness();
      drawMapShell();
      drawSchedShell();
      drawLogiShell();
      loadCalendar();
      await loadForecast();
      fetch('/backtest.json').then((r) => (r.ok ? r.json() : null)).then((j) => { V.bt = j; drawMetrics(); }).catch(() => {});
      S.timers.push(setInterval(() => loadForecast(), 60000));
    } else {
      app.innerHTML = `<div class="grid"><div class="card" id="md-alerts"></div>
        <div class="card"><h2>Heat stroke: first aid</h2><ol class="small">
          ${(() => { const s = site(); const r = readyItems(s); return `<li style="list-style:none;margin-left:-18px">${r.tub ? '✅ Cold-water tub and ice confirmed ready today' : '⚠️ <b>Cold-water tub and ice NOT confirmed today</b>: check now'}${s.coolSpot ? ` · cooling point: ${esc(s.coolSpot)}` : ''}</li>`; })()}
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
    drawLogi();
    drawOutlook();
    loadHeatmap();
  }

  // ---------------- break check: proof that rest, water and shade happened ----------------
  // Adelante (Glaser 2020; Hansson 2025): kidney injury fell from 21% to 1%, and the gains tracked how well
  // rest, water and shade were actually delivered. So HeatMitra checks delivery, not just the plan.
  const AUDIT_LABEL = { shade: 'Shade covers everyone resting at once', near: 'Within 50 m of the work', water: 'Cool drinking water available', electrolytes: 'Electrolytes available', space: 'Not crowded; seating available' };
  async function loadBreaks() {
    try { V.breaks = await api(`/api/breakcheck?site=${V.site}`); } catch { return; }
    drawBreaks();
  }
  function bar(label, v) {
    const c = v == null ? '#bbb' : v >= 80 ? 'var(--green)' : v >= 60 ? 'var(--orange)' : 'var(--red)';
    return `<div class="small" style="margin:6px 0 2px">${label} <b>${v == null ? '–' : `${v}%`}</b></div><div class="psi"><span style="width:${v || 0}%;background:${c}"></span></div>`;
  }
  function drawBreaks() {
    const el = $('#sv-breaks');
    const b = V.breaks;
    if (!el || !b) return;
    const col = b.score == null ? 'var(--muted)' : b.score >= 80 ? 'var(--green)' : b.score >= 60 ? 'var(--orange)' : 'var(--red)';
    const ago = (at) => { const x = Math.round((Date.now() - at) / 1000); return x < 60 ? `${x}s ago` : `${Math.round(x / 60)}m ago`; };
    el.innerHTML = `<div class="row" style="justify-content:space-between"><h2 style="margin:0">Break check: rest, water, shade</h2><button class="btn sm" data-c="posters">🖨 QR posters</button></div>
      <div class="row" style="gap:14px;margin:8px 0"><div style="font-size:40px;font-weight:800;color:${col}">${b.score ?? '–'}</div>
        <div class="small muted">Crew score out of 100. ${b.flag ? '<b style="color:var(--red)">Below 80: rest, water or shade is not being delivered as planned.</b>' : 'Whole crew only, never per worker.'}</div></div>
      ${bar('Rest breaks taken (confirmed at a station counts fully)', b.rest)}${bar('Water drunk vs due', b.water)}${bar('Stations audited and passing', b.audit)}
      <table class="list" style="margin-top:8px">${b.stations.map((st) => `<tr><td><b>${esc(st.name)}</b><br><span class="small muted">code ${esc(b.codes[st.id] || '')}</span></td>
        <td class="small">${st.lastAt ? `${st.ok ? '✅' : '⚠️'} ${ago(st.lastAt)}${st.fresh ? '' : ' · <b style="color:var(--red)">overdue</b>'}${st.items && !st.ok ? `<br>${Object.entries(st.items).filter(([, v]) => !v).map(([k]) => esc(AUDIT_LABEL[k])).join('; ')}` : ''}` : '<b style="color:var(--red)">not audited</b>'}</td>
        <td><button class="btn sm" data-c="audit" data-st="${st.id}">Audit</button></td></tr>`).join('')}</table>
      <p class="muted small">Workers scan the station QR when a rest break starts. Adelante: kidney injury fell from 21% to 1% where rest, water and shade were really delivered (Glaser 2020; Hansson 2025).</p>`;
  }
  function openAudit(stId) {
    const st = V.breaks.stations.find((x) => x.id === stId);
    modal('audit', `<div class="modal"><h1>Audit: ${esc(st.name)}</h1>
      ${V.breaks.auditItems.map((k) => `<label class="check"><input type="checkbox" data-audit="${k}" checked /><span>${esc(AUDIT_LABEL[k])}</span></label>`).join('')}
      <div class="row"><button class="btn primary" data-c="auditSave" data-st="${stId}">Save audit</button><button class="btn" data-w="close">Cancel</button></div>
      <p class="muted small">Untick anything that is not right now. Audits count for 2 hours.</p></div>`);
  }
  async function saveAudit(stId) {
    const items = Object.fromEntries([...overlay.querySelectorAll('[data-audit]')].map((x) => [x.dataset.audit, x.checked]));
    V.breaks = { ...V.breaks, ...(await api('/api/station/audit', { method: 'POST', body: { siteId: V.site, stationId: stId, items } })) };
    closeModal();
    drawBreaks();
  }
  function openPosters() {
    const b = V.breaks;
    const lines = [I18N.en.scanStation, I18N.hi.scanStation, I18N.ar.scanStation, I18N.ur.scanStation];
    modal('posters', `<div class="modal brief"><div class="row noprint" style="justify-content:space-between"><b>Rest-station QR posters</b>
        <span class="row"><button class="btn sm" data-c="brPrint">🖨 Print</button><button class="btn sm" data-w="close">✕</button></span></div>
      ${b.stations.map((st) => `<div class="poster"><div class="qr" data-qr="${location.origin}/?s=${b.codes[st.id]}"></div>
        <div><h2 style="margin:0 0 6px">${esc(st.name)}</h2><div style="font-size:30px;font-weight:800;letter-spacing:6px">${esc(b.codes[st.id])}</div>
          ${lines.map((l) => `<div>${esc(l)}</div>`).join('')}<div class="muted small">HeatMitra · scan when your rest break starts</div></div></div>`).join('')}</div>`);
    overlay.querySelectorAll('[data-qr]').forEach((d) => {
      if (window.QRCode) new QRCode(d, { text: d.dataset.qr, width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M });
      else d.textContent = d.dataset.qr;
    });
  }

  // ---------------- site readiness and cooling ----------------
  // [key, label, critical]. Critical items are what heat-stroke survival depends on: cooling at once, water, shade, a first-aider.
  const READY = [
    ['shade', 'Shade for everyone who must rest at once', true],
    ['water', 'Cool drinking water at every work area', true],
    ['tub', 'Cold-water immersion tub and ice ready (heat stroke: cool first, transport second)', true],
    ['firstaider', 'First-aider on site, phone charged', true],
    ['vests', 'Cooling vests or wet towels for rest breaks', false],
    ['restarea', 'Rest area with fans or air conditioning', false],
    ['route', 'Emergency route and number posted', false],
  ];
  function todayAt(s) { return new Intl.DateTimeFormat('en-CA', { timeZone: s.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function readyItems(s) { return s.readiness && s.readiness.date === todayAt(s) ? { ...s.readiness.items, _done: true, _by: s.readiness.by, _at: s.readiness.at } : {}; }
  function drawReadiness() {
    const el = $('#sv-ready');
    if (!el) return;
    const s = site();
    const r = readyItems(s);
    const missing = READY.filter(([k, , crit]) => crit && !r[k]);
    el.innerHTML = `<h2>Site readiness for today's heat</h2>
      ${!r._done ? '<div class="notice rise"><b>Not checked today.</b> Confirm before the first shift.</div>'
        : missing.length ? `<div class="notice rise"><b>Not ready:</b> ${missing.map(([, l]) => esc(l.split(' (')[0])).join(' · ')}</div>`
          : `<div class="notice info">✅ Ready: checked by ${esc(r._by)} at ${new Date(r._at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`}
      ${READY.map(([k, label, crit]) => `<label class="check small"><input type="checkbox" data-ready="${k}" ${r[k] ? 'checked' : ''} /><span>${esc(label)}${crit ? ' <b style="color:var(--red)">*</b>' : ''}</span></label>`).join('')}
      <label class="field small"><span>Cooling point shown on workers' emergency screen</span><input id="coolSpot" class="btn sm" style="width:100%" maxlength="80" value="${esc(s.coolSpot || '')}" /></label>
      <button class="btn sm primary" data-c="saveReady">Sign off readiness</button>
      <p class="muted small">* critical. Cooling vests reduced heart rate and body temperature in a 140-worker field study (Chan et al., PolyU). Workers get cooling-vest advice when vests are ticked and risk is high.</p>`;
  }
  async function saveReadiness() {
    const items = Object.fromEntries([...document.querySelectorAll('[data-ready]')].map((x) => [x.dataset.ready, x.checked]));
    const s = await api('/api/site/readiness', { method: 'POST', body: { siteId: V.site, items, coolSpot: $('#coolSpot').value } });
    V.config.sites = V.config.sites.map((x) => (x.id === s.id ? s : x));
    drawReadiness();
    pollConsole();
  }

  // ---------------- SMS fallback simulator (stands in for a basic phone) ----------------
  async function drawSmsShell() {
    const el = $('#sv-sms');
    let users = [];
    try { users = await api('/api/users'); } catch {}
    const w = users.find((u) => u.channel === 'sms');
    if (!w) { el.remove(); return; }
    V.smsPhone = w.phone;
    el.innerHTML = `<h2>📱 SMS fallback: ${esc(w.name)} (basic phone)</h2>
      <p class="muted small">Demo: this panel stands in for ${esc(w.name)}'s own phone. Real deployments connect an SMS gateway to <code>/api/sms/inbound</code> (Twilio-style From/Body). Messages are in the worker's language (${esc(I18N.langs[w.lang] || w.lang)}).</p>
      <div class="phone"><div id="smsThread" class="thread"></div>
        <div class="row" style="margin-top:8px">${['START', '1', '2', 'STOP'].map((c) => `<button class="btn sm" data-sms="${c}">${c}</button>`).join('')}
          <input id="smsText" class="btn sm" style="flex:1;min-width:60px" maxlength="160" placeholder="Reply…" aria-label="SMS reply" /><button class="btn sm primary" data-c="smsSend">Send</button></div></div>`;
    loadSms();
  }
  async function loadSms() {
    const el = $('#smsThread');
    if (!el || !V.smsPhone) return;
    let msgs;
    try { msgs = await api(`/api/sms/thread?phone=${encodeURIComponent(V.smsPhone)}`); } catch { return; }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    el.innerHTML = msgs.map((m) => `<div class="bubble ${m.dir}">${esc(m.text)}<span>${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>`).join('')
      || '<p class="muted small">No messages yet. Text START to begin the shift.</p>';
    if (atBottom) el.scrollTop = el.scrollHeight;
  }
  async function sendSmsDemo(text) {
    await api('/api/sms/inbound', { method: 'POST', body: { From: V.smsPhone, Body: text } }).catch(() => {});
    await loadSms();
    const el = $('#smsThread'); if (el) el.scrollTop = el.scrollHeight;
    pollConsole();
  }

  // ---------------- HSE / regulator report: crew-level only, small counts suppressed ----------------
  const sup = (n) => (n == null ? '–' : n > 0 && n < 5 ? '<5' : String(n));
  function reportRows() {
    const s = site();
    const m = (V.crew && V.crew.metrics) || {};
    const hours = V.fc ? V.fc.hourly.filter((r) => { const h = Number(r.time.slice(11, 13)); return h >= 5 && h <= 19; }) : [];
    const rows = [
      ['Site', s.name], ['Date', V.fc ? V.fc.nowTime.slice(0, 10) : ''], ['Weather source', V.fc ? V.fc.source : ''],
      ['Country rules', Heat.RULES[s.middayBan] ? Heat.RULES[s.middayBan].name : 'none'], ['On-site sensor calibration (°C)', s.calib || 0],
    ];
    for (const wl of ['light', 'moderate', 'heavy']) {
      const c = { green: 0, yellow: 0, orange: 0, red: 0 };
      Heat.assessDay(hours, { workload: wl, clothing: 'standard', daysOnSite: 30, calib: s.calib || 0 }, s.middayBan).forEach((p) => c[p.band]++);
      rows.push([`${WORK_LABEL[wl]}: hours normal / caution / work-rest / STOP (05:00–19:59)`, `${c.green} / ${c.yellow} / ${c.orange} / ${c.red}`]);
    }
    rows.push(
      ...(V.breaks ? [['Break-check score (rest 50%, water 30%, station audits 20%)', V.breaks.score ?? '–'], ['Rest breaks taken (confirmed at a station counts fully, self-reported half), %', V.breaks.rest ?? '–'],
        ['Water drunk vs due (3 cups per hour in the heat), %', V.breaks.water ?? '–'], ['Rest stations with a passed audit in the last 2 h, %', V.breaks.audit ?? '–']] : []),
      ['Site readiness today', (() => { const r = readyItems(s); const n = READY.filter(([k]) => r[k]).length; return r._done ? `${n}/${READY.length} ready${READY.filter(([k, , crit]) => crit && !r[k]).length ? ' (critical items missing)' : ''}` : 'not checked'; })()],
      ['New or returning workers on a ramp-up', sup(m.newOrReturning)], ['Workers on stricter personal limits', sup(m.personalisedWorkers)],
      ['Workers on shift now', sup(V.crew ? V.crew.crew.length : null)], ['Alerts opened', sup(m.alertsOpened)],
      ...Object.entries(m.byReason || {}).map(([r, n]) => [`  of which: ${REASON[r] || r}`, sup(n)]),
      ['Alerts handled by a buddy', sup(m.buddyChecks)], ['Reached first-aider', sup(m.reachedFirstAider)], ['Emergencies', sup(m.emergencies)],
      ['Emergencies cooled on site', sup(m.coolingCases)], ['Median time from emergency to cooling start (s)', m.medianTimeToCoolingSec ?? '–'],
      ['Median time to a human response (s)', m.medianResponseSec ?? '–'], ['Check-in prompts answered by worker (%)', m.checkinPromptResponseRate ?? '–'],
      ['Rest breaks taken, whole crew (%)', m.restAdherence ?? '–'], ['Check-ins where work felt very hard (%)', m.veryHardPct ?? '–'],
      ...Object.entries(m.outcomes || {}).map(([k, n]) => [`Cases closed as: ${OUTCOME_LABEL[k]}`, sup(n)]),
    );
    return rows;
  }
  function openReport() {
    const rows = reportRows();
    modal('report', `<div class="modal brief"><div class="row noprint" style="justify-content:space-between"><b>HSE report</b>
        <span class="row"><button class="btn sm" data-c="reportCsv">⬇ Download CSV</button><button class="btn sm" data-c="brPrint">🖨 Print</button><button class="btn sm" data-w="close">✕</button></span></div>
      <h1>Heat-stress report</h1>
      <table class="list">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>
      <p class="muted small">Crew-level figures only: no names and no individual health data. Counts from 1 to 4 are shown as "&lt;5" so individuals can't be identified. Prototype data from this session; heat figures use the HeatMitra engine (ISO 7243 estimate, NIOSH limits).</p></div>`);
  }
  function downloadReport() {
    const csv = reportRows().map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`Measure,Value\n${csv}\n`], { type: 'text/csv' }));
    a.download = `heatmitra-report-${V.site}-${V.fc ? V.fc.nowTime.slice(0, 10) : 'today'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------- 3-day outlook ----------------
  const dayName = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' });
  function drawOutlook() {
    const el = $('#sv-outlook');
    if (!el) return;
    const o = (V.fc && V.fc.outlook) || [];
    if (!o.length) { el.innerHTML = '<h2>Next 3 days</h2><p class="muted small">No outlook for this day (the site is running on saved data).</p>'; return; }
    const worst = o.reduce((b, d) => (d.stopHours > b.stopHours ? d : b), o[0]);
    const win = (w) => (w ? `${w.start.slice(11, 16)}–${pad2(Number(w.end.slice(11, 13)) + 1)}:00` : 'none');
    el.innerHTML = `<h2>Next 3 days: heavy work</h2>
      ${worst.stopHours >= 6 ? `<div class="notice rise">Heavy work must stop for <b>${worst.stopHours} hours</b> on ${dayName(worst.date)} ${worst.date.slice(5)}. Plan an early or night shift, or move heavy tasks to another day.</div>` : ''}
      <div class="outlook">${o.map((d) => `<div class="day">
        <div class="row" style="justify-content:space-between"><b>${dayName(d.date)}</b><span class="muted small">${d.date.slice(5)}</span></div>
        <div style="margin:6px 0"><span class="pill" style="background:${wbgtColor(d.peak)}">${d.peak.toFixed(1)} °C</span> <span class="small muted">peak WBGT, ${d.peakTime}</span></div>
        <div class="strip" title="05:00 to 19:00">${d.bands.map((b) => `<i class="c-${b}"></i>`).join('')}</div>
        <div class="small muted strip-l"><span>05</span><span>12</span><span>19</span></div>
        <div class="small"><b>${d.stopHours} h</b> STOP · best window ${win(d.window)}</div></div>`).join('')}</div>`;
  }

  function site() { return V.config.sites.find((s) => s.id === V.site); }

  function drawHead() {
    const s = site(); const fc = V.fc;
    $('#sv-head').innerHTML = `<div class="card"><div class="row" style="justify-content:space-between">
      <div><h2 style="margin:0">${esc(s.name)}</h2><div class="muted small">${esc(fc ? fc.source : '')}
        ${fc && fc.mode === 'replay' ? `<span class="tag replay">replaying ${esc(s.replayDate)} at today's clock time</span>` : '<span class="tag">live forecast</span>'}
        ${fc && fc.stale ? '<span class="tag stale">network down: cached weather</span>' : ''}
        ${s.calib ? `<span class="tag" style="background:#e6f4ea">calibrated ${s.calib > 0 ? '+' : ''}${s.calib} °C from site sensor</span>` : ''}</div></div>
      <div class="row">
        <select id="siteSel" class="btn sm">${V.config.sites.map((x) => `<option value="${x.id}" ${x.id === V.site ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <input type="date" id="replayDate" class="btn sm" style="width:auto" value="${esc(s.replayDate || '2025-06-10')}" min="2024-01-01" />
        <select id="ruleSel" class="btn sm" aria-label="Country rules">${[['', 'No midday ban']].concat(Object.entries(Heat.RULES).map(([k, r]) => [k, r.name])).map(([k, n]) => `<option value="${k}" ${String(s.middayBan || '') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <button class="btn sm" data-c="replay">Replay day</button><button class="btn sm" data-c="live">Live</button>
        <button class="btn sm" data-c="brief">📋 Morning briefing</button>
        <button class="btn sm" data-c="report">📄 Report</button>
        <input type="number" id="calWbgt" class="btn sm" style="width:118px" step="0.1" min="10" max="45" placeholder="Sensor WBGT °C" aria-label="On-site WBGT meter reading" />
        <button class="btn sm" data-c="calib" title="Enter a reading from an on-site WBGT meter; leave empty to clear">Calibrate</button>
        ${V.config.demo ? '<button class="btn sm primary" data-c="crew">Add simulated crew</button>' : ''}
      </div></div></div>`;
    $('#siteSel').onchange = (e) => { V.site = e.target.value; loadForecast(); pollConsole(); drawReadiness(); };
    $('#ruleSel').onchange = async (e) => {
      const ns = await api('/api/site/rule', { method: 'POST', body: { siteId: V.site, rule: e.target.value } });
      V.config.sites = V.config.sites.map((x) => (x.id === ns.id ? ns : x));
      loadForecast();
    };
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
    const plans = rows.map(([label, prof]) => [label, Heat.assessDay(hours, { ...prof, calib: s.calib || 0 }, s.middayBan)]);
    const win = Heat.bestWindow(plans[2][1]);
    const cell = (p) => `<td class="c-${p.band} ${p.time === fc.nowTime ? 'now' : ''}" title="WBGT ${p.wbgtEff}°C vs limit ${p.limit}°C${p.middayBan ? ' · midday ban' : ''}">${p.band === 'red' ? 'STOP' : p.workMin === 60 ? '60' : `${p.workMin}/${p.restMin}`}</td>`;
    el.innerHTML = `<h2>Work/rest planner</h2>
      <p class="small">${win ? `Best window for heavy work: <b>${win.start.slice(11)}–${pad2(Number(win.end.slice(11, 13)) + 1)}:00</b>.` : '<b>No safe window for heavy work today.</b> Reschedule or switch to light tasks.'}
      ${ruleText(s.middayBan)}</p>
      <div class="planner"><table>
        <tr><th>Hour</th>${hours.map((h) => `<th class="${h.time === fc.nowTime ? 'now' : ''}">${h.time.slice(11, 13)}</th>`).join('')}</tr>
        <tr><td>Est. WBGT °C</td>${hours.map((h) => `<td>${(Heat.wbgt(h.t, h.rh, h.sw, h.wind) + (s.calib || 0)).toFixed(1)}</td>`).join('')}</tr>
        <tr><td>Air °C / RH %</td>${hours.map((h) => `<td>${Math.round(h.t)}/${Math.round(h.rh)}</td>`).join('')}</tr>
        ${hours.some((h) => h.pm10 != null) ? `<tr><td>Dust PM10 µg/m³</td>${hours.map((h) => { const a = Heat.airAssess(h.pm10, h.uv); return `<td class="${a.dust && a.dust !== 'green' ? `c-${a.dust}` : ''}">${a.pm10 ?? '–'}</td>`; }).join('')}</tr>
        <tr><td>UV index</td>${hours.map((h) => `<td class="${h.uv >= 8 ? 'c-orange' : ''}">${h.uv == null ? '–' : Math.round(h.uv)}</td>`).join('')}</tr>` : ''}
        ${plans.map(([l, p]) => `<tr><td>${l}</td>${p.map(cell).join('')}</tr>`).join('')}
      </table></div>
      <p class="muted small">Cells show minutes of work/rest per hour from the NIOSH time-weighted limit (acclimatised crew in normal clothes unless the row says otherwise). STOP = stop this task, light work in shade only. Hover a cell for WBGT and the limit. The outlined column is now.</p>`;
  }

  const dm = (md) => new Date(`2025-${md}T00:00`).toLocaleString('en', { day: 'numeric', month: 'short' });
  function ruleText(key) {
    const r = Heat.RULES[key];
    if (!r) return 'No legal midday ban is configured for this site.';
    return `${esc(r.name)}: no outdoor work ${r.start}–${r.end}, ${dm(r.from)} to ${dm(r.to)}${r.wbgtStop ? `; work also stops whenever WBGT reaches ${r.wbgtStop} °C` : ''}. Check current rules with the labour ministry.`;
  }

  // ---------------- water and shade logistics ----------------
  function drawLogiShell() {
    const opt = (sel) => Array.from({ length: 15 }, (_, i) => i + 5).map((h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${pad2(h)}:00</option>`).join('');
    $('#sv-logi').innerHTML = `<h2>Water and shade for today</h2>
      <div class="row small"><label>Crew <input id="lgCrew" type="number" min="1" max="2000" value="20" class="btn sm" style="width:72px" /></label>
        <label>From <select id="lgFrom" class="btn sm">${opt(6)}</select></label><label>to <select id="lgTo" class="btn sm">${opt(14)}</select></label></div>
      <div id="logiOut" style="margin-top:10px"></div>
      <p class="muted small">Moderate work, acclimatised crew. Water: about 0.9 L per worker per hour in Caution or worse (1 cup every 15–20 min, NIOSH), 0.5 L otherwise. Shade: everyone who must rest at the same time in the worst hour.</p>`;
    ['lgCrew', 'lgFrom', 'lgTo'].forEach((id) => { $(`#${id}`).oninput = drawLogi; $(`#${id}`).onchange = drawLogi; });
  }
  function drawLogi() {
    const el = $('#logiOut');
    if (!el || !V.fc) return;
    const s = site();
    const crew = Math.max(1, Math.min(2000, Number($('#lgCrew').value) || 1));
    const from = Number($('#lgFrom').value), to = Number($('#lgTo').value);
    const hours = V.fc.hourly.filter((r) => { const h = Number(r.time.slice(11, 13)); return h >= from && h < to; });
    if (!hours.length) { el.innerHTML = '<p class="muted small">Pick a shift of at least one hour.</p>'; return; }
    const plan = Heat.assessDay(hours, { workload: 'moderate', clothing: 'standard', daysOnSite: 30, calib: s.calib || 0 }, s.middayBan);
    const litres = Math.ceil(crew * plan.reduce((sum, p) => sum + (p.band === 'green' ? 0.5 : 0.9), 0));
    const worst = plan.reduce((b, p) => (p.restMin > b.restMin ? p : b), plan[0]);
    const stops = plan.filter((p) => p.band === 'red').length;
    el.innerHTML = `<div class="kpis"><div><b>${litres} L</b>cool drinking water</div><div><b>${Math.ceil(litres / 19)}</b>19-litre water jugs</div>
      <div><b>${Math.ceil((crew * worst.restMin) / 60)}</b>shade places at once (worst hour ${worst.time.slice(11, 16)})</div><div><b>${stops} h</b>where moderate work must stop</div></div>`;
  }

  // ---------------- morning toolbox-talk briefing ----------------
  function tl(lang, key, vars) {
    const L = I18N[lang] || I18N.en;
    let s = L[key] ?? I18N.en[key] ?? key;
    if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
    return s;
  }
  function briefingLines(lang) {
    const s = site();
    if (!V.fc) return [];
    const hours = V.fc.hourly.filter((r) => { const h = Number(r.time.slice(11, 13)); return h >= 5 && h <= 19; });
    const heavy = Heat.assessDay(hours, { workload: 'heavy', clothing: 'standard', daysOnSite: 30, calib: s.calib || 0 }, s.middayBan);
    const peak = heavy.reduce((b, p) => (p.wbgt > b.wbgt ? p : b), heavy[0]);
    const win = Heat.bestWindow(heavy);
    const stop = heavy.find((p) => p.band === 'red' && !p.middayBan) || heavy.find((p) => p.band === 'red');
    const rule = Heat.RULES[s.middayBan];
    return [
      tl(lang, 'br_peak', { w: peak.wbgt, time: peak.time.slice(11, 16) }),
      win ? tl(lang, 'br_window', { a: win.start.slice(11, 16), b: `${pad2(Number(win.end.slice(11, 13)) + 1)}:00` }) : tl(lang, 'br_nowindow'),
      stop ? tl(lang, 'br_stop', { time: stop.time.slice(11, 16) }) : null,
      rule && heavy.some((p) => p.middayBan) ? tl(lang, 'br_ban', { start: rule.start, end: rule.end }) : null,
      tl(lang, 'br_water'), tl(lang, 'br_rest'), tl(lang, 'br_new'), tl(lang, 'br_buddy', { n: s.emergency }), tl(lang, 'br_app'),
    ].filter(Boolean);
  }
  function openBriefing(lang = V.brLang || 'en') {
    V.brLang = lang;
    const langs = Object.entries(I18N.langs).filter(([k]) => I18N[k] && I18N[k].br_title)
      .map(([k, v]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${v}</option>`).join('');
    modal('brief', `<div class="modal brief" dir="${I18N.rtl.includes(lang) ? 'rtl' : 'ltr'}">
      <div class="row noprint" style="justify-content:space-between"><select id="brLang" class="btn sm" aria-label="Briefing language">${langs}</select>
        <span class="row"><button class="btn sm" data-c="brSay">🔊 Read aloud</button><button class="btn sm" data-c="brPrint">🖨 Print</button><button class="btn sm" data-w="close">✕</button></span></div>
      <h1>☀ ${tl(lang, 'br_title')}</h1><div class="muted small" dir="ltr">${esc(site().name)} · ${esc((V.fc ? V.fc.nowTime : '').slice(0, 10))}</div>
      <ol class="brief-list">${briefingLines(lang).map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div>`);
    $('#brLang').onchange = (e) => openBriefing(e.target.value);
  }

  async function pollConsole() {
    try {
      const [crew, alerts, audit] = await Promise.all([api(`/api/crew?site=${V.site}`), api('/api/alerts'), api('/api/audit')]);
      V.crew = crew; V.alerts = alerts; V.audit = audit;
    } catch { return; }
    if (S.user.role === 'supervisor') { drawToday(); drawCrew(); drawAlerts('#sv-alerts', 'supervisor'); drawMetrics(); loadSms(); loadBreaks(); }
    else drawAlerts('#md-alerts', 'medic');
    drawAudit();
  }

  // Today: the day in four lines, and the foreman's crew check. One tap after walking the crew counts as each
  // ticked worker's check-in (and rest break), so workers don't have to answer on their phones.
  function drawToday() {
    const el = $('#sv-today');
    if (!el) return;
    const crew = (V.crew && V.crew.crew) || [];
    const lines = briefingLines('en').slice(0, 4).filter(Boolean);
    const waiting = crew.filter((w) => w.alert && w.alert.reason === 'checkin_due').length;
    el.innerHTML = `<div class="today-grid"><div><h2>Today</h2><ul class="today">${lines.map((l) => `<li>${esc(l)}</li>`).join('') || '<li class="muted">Loading the forecast…</li>'}</ul></div>
      <div><h2>👷 Crew check${waiting ? ` <span class="tag">${waiting} waiting</span>` : ''}</h2>
      <p class="small muted">Walk the crew, untick anyone you didn't see, then tap once. It counts as each person's check-in, so workers don't have to answer on their phones. Works for workers with no phone too.</p>
      ${crew.length ? `<div class="crewchk">${crew.map((w) => `<label class="check"><input type="checkbox" data-crewchk="${w.workerId}" ${V.unseen.has(w.workerId) ? '' : 'checked'} /> ${esc(w.name)}${w.alert && w.alert.reason === 'checkin_due' ? ' <span class="tag">waiting</span>' : ''}</label>`).join('')}</div>
        <div class="row"><button class="btn ok" data-c="crewRest">✓ All resting in the shade</button><button class="btn" data-c="crewOk">✓ Everyone seen, OK</button></div>
        ${V.crewMsg ? `<p class="small" style="color:var(--green)">${esc(V.crewMsg)}</p>` : ''}`
        : '<p class="muted small">No one on shift yet. Workers start their shift on their phone, or you start it for workers with no phone in Crew setup.</p>'}</div></div>`;
  }
  async function crewCheck(rest) {
    const ids = ((V.crew && V.crew.crew) || []).map((w) => w.workerId).filter((id) => !V.unseen.has(id));
    const r = await api('/api/crew/check', { method: 'POST', body: { siteId: V.site, workerIds: ids, rest } });
    V.crewMsg = `${r.checked} checked ${rest ? '(resting in the shade)' : '(seen, OK)'} at ${new Date().toTimeString().slice(0, 5)}`;
    return pollConsole();
  }

  function drawSetup() { const el = $('#sv-setup'); if (el && !el.innerHTML) el.innerHTML = '<h2>Crew setup</h2><p class="muted small">Loading…</p>'; }

  function drawCrew() {
    const c = V.crew; const el = $('#sv-crew');
    if (!el) return;
    const ago = (s) => (s < 60 ? `${s}s` : `${Math.round(s / 60)}m`);
    el.innerHTML = `<h2>Crew on shift (${c.crew.length})</h2>
      <div class="counts">${['green', 'yellow', 'orange', 'red'].map((b) => `<div class="c-${b}"><b>${c.counts[b]}</b>${b}</div>`).join('')}</div>
      ${c.crew.length ? `<table class="list"><tr><th>Worker</th><th>Task</th><th>Check-in</th><th>Signal</th><th></th></tr>
        ${c.crew.map((w) => `<tr><td><span class="dot d-${w.band}"></span>${esc(w.name)}${w.simulated ? ' <span class="tag">sim</span>' : ''}${w.acclim ? ` <span class="tag new">${w.acclim.kind === 'returning' ? 'Back' : 'New'} · day ${w.acclim.day}${w.acclim.of ? `/${w.acclim.of}` : ''}${w.heatPct != null ? ` · heat time ${w.heatPct}%` : ''}</span>` : ''}</td>
          <td>${w.workload}</td><td>${ago(w.lastCheckinSec)} ago</td><td>${w.signal === 'lost' ? '<b style="color:var(--red)">lost</b>' : w.signal === 'push' ? '<span title="App closed; alerts go by push">📱 push</span>' : 'ok'}</td>
          <td>${w.alert ? `<span class="tag">${STAGE_LABEL[w.alert.stage]}</span>` : V.config.demo && w.simulated ? `<button class="btn sm" data-silent="${w.workerId}">Simulate going silent</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="muted small">No one on shift. Sign a worker in from another tab, or add the simulated crew.</p>'}
      <p class="muted small">Band comes from site weather, task, clothing and acclimatisation. Symptoms and health history are never shown here.</p>`;
  }

  function alertCard(a, role) {
    const ci = STAGES.indexOf(a.stage);
    const done = a.status === 'resolved';
    const visited = (s) => a.history.some((h) => h.stage === s);
    const cls = (s, i) => (i === ci && !done ? 'cur' : visited(s) ? 'done' : i < ci || done ? 'skip' : '');
    const ladder = `<div class="ladder">${STAGES.map((s, i) => `<span class="${cls(s, i)}">${STAGE_LABEL[s]}</span>`).join('')}${done ? '<span class="done">Closed</span>' : ''}</div>`;
    const age = Math.max(0, Math.round((Date.now() - a.openedAt) / 1000));
    let actions = '';
    if (!done && role === 'supervisor' && a.stage !== 'medic') actions = `<button class="btn sm ok" data-act="ack" data-id="${a.id}">Checked: worker OK</button><button class="btn sm warn" data-act="escalate" data-id="${a.id}">Call first-aider</button>`;
    if (!done && role === 'medic') actions = `<button class="btn sm" data-act="attend" data-id="${a.id}">Attending</button>
      <select class="btn sm" data-outcome-for="${a.id}" aria-label="Case outcome">${Object.entries(OUTCOME_LABEL).map(([k, v]) => `<option value="${k}" ${(V.outcomes[a.id] || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <button class="btn sm ok" data-act="resolve" data-id="${a.id}">Close case</button>`;
    let clinical = '';
    if (role === 'medic') {
      if (a.symptoms && a.symptoms.length) clinical = `<div class="small">Symptoms: <b>${a.symptoms.map((s) => esc(I18N.en[`s_${s}`] || s)).join(', ')}</b></div>`;
      else if (a.reason === 'reported_unwell') clinical = '<div class="small muted">Symptoms not shared: the worker has not consented.</div>';
      if (a.strain) clinical += `<div class="small">Wearable: strain index <b>${a.strain.psi}/10</b>, estimated core temperature <b>${a.strain.ct} °C</b></div>`;
      else if (a.reason === 'high_strain') clinical += '<div class="small muted">Strain values not shared: the worker has not consented.</div>';
    }
    return `<div class="alert ${a.severity === 'emergency' ? 'emergency' : ''} ${done ? 'resolved' : ''}">
      <div class="row" style="justify-content:space-between"><b>${esc(a.worker)}</b><span class="small muted">${REASON[a.reason] || a.reason} · ${a.severity} · ${age}s ago</span></div>
      ${ladder}${clinical}${cftsHtml(a, role)}<div class="row">${actions}</div>
      <div class="small muted">${a.history.slice(-3).map((h) => esc(h.note)).join(' → ')}</div></div>`;
  }

  // "Cool first, transport second": guided on-site cooling for suspected heat stroke, with a time-to-cooling clock.
  // Evidence: no deaths when cooling was fast enough, across 521 cases (Filep 2020); 274 consecutive survivors with
  // on-site cold-water immersion (Demartini 2015); higher worker deaths where EMS protocols lack it (Tishukaj 2024).
  const mmss = (ms) => { const x = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(x / 60)}:${pad2(x % 60)}`; };
  function cftsHtml(a, role) {
    if (a.severity !== 'emergency') return '';
    const t0 = a.emergencyAt || a.openedAt;
    const status = a.coolingAt ? `🧊 cooling started ${mmss(a.coolingAt - t0)} after the alert${a.cooledAt ? ' · finished' : ''}` : `⏱ ${mmss(Date.now() - t0)} since the alert · cooling not started`;
    if (role !== 'medic') return `<div class="small cfts-line ${a.coolingAt ? '' : 'late'}">${status}</div>`;
    if (a.status === 'resolved') return `<div class="small cfts-line">${status}</div>`;
    const s = site();
    const tub = readyItems(s).tub;
    const step = (done, text, act, label) => `<li class="${done ? 'done' : ''}">${text}${!done && act ? ` <button class="btn sm ${act === 'cooling' ? 'ok' : ''}" data-act="${act}" data-id="${a.id}">${label}</button>` : done ? ' ✓' : ''}</li>`;
    return `<div class="cfts"><div class="row" style="justify-content:space-between"><b>🧊 Cool first, transport second</b><span class="cfts-clock ${a.coolingAt ? '' : 'late'}">${status}</span></div>
      <ol>
        ${step(a.coolingAt, `<b>Cool now, on site.</b> ${tub ? 'Cold-water immersion up to the neck (tub confirmed ready today).' : 'No tub confirmed today: tarp or ice-water sheets, cold-water soaked towels rotated every 2–3 min, ice at neck, armpits and groin.'}`, 'cooling', 'Cooling started')}
        ${step(a.ambulanceAt, `<b>Call ${esc(s.emergency)}</b> at the same time: "suspected exertional heat stroke, cooling on site".`, 'ambulance', 'Ambulance called')}
        <li>Keep cooling until the worker is alert, or core temperature is about 39 °C if you can measure it. Nothing by mouth if confused; protect the airway.</li>
        ${step(a.cooledAt, 'Then hand over to the ambulance, with the time cooling started.', a.coolingAt ? 'cooled' : null, 'Cooling finished')}
      </ol>
      <div class="muted small">Target: cooling within 5 minutes of the alert. No deaths when cooling was fast enough (Filep 2020, 521 cases).</div></div>`;
  }

  function drawAlerts(sel, role) {
    const el = $(sel);
    if (!el) return;
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return; // don't close an open picker
    let list = role === 'medic' ? V.alerts.filter((a) => a.stage === 'medic' || a.status === 'resolved') : V.alerts;
    // Routine missed check-ins: one list, not one alarm per person (fewer, clearer alerts for the supervisor).
    let group = '';
    if (role === 'supervisor') {
      const routine = list.filter((a) => a.status === 'open' && a.reason === 'checkin_due' && a.severity === 'routine' && a.stage === 'supervisor');
      list = list.filter((a) => !routine.includes(a) && (a.status === 'open' || a.severity !== 'routine'));
      if (routine.length) group = `<div class="alert group"><b>Not answering their check-in (${routine.length})</b><div class="small muted">Walk over, or use Crew check above. Goes to the first-aider if no one confirms.</div>
        ${routine.map((a) => `<div class="row" style="justify-content:space-between;margin-top:6px"><span>${esc(a.worker)}${a.rest ? ' · rest break' : ''} · ${Math.max(1, Math.round((Date.now() - a.openedAt) / 60000))} min</span><button class="btn sm ok" data-act="ack" data-id="${a.id}">Seen: OK</button></div>`).join('')}</div>`;
    }
    el.innerHTML = `<h2>${role === 'medic' ? 'Cases for the first-aider' : 'Alerts'}</h2>${group}${list.length ? list.map((a) => alertCard(a, role)).join('') : group ? '' : '<p class="muted small">No alerts.</p>'}`;
  }

  function drawMetrics() {
    const el = $('#sv-metrics');
    if (!el) return;
    const m = V.crew && V.crew.metrics;
    const k = (v, unit) => (v == null ? '–' : `${v}${unit || ''}`);
    el.innerHTML = `<h2>Safety measures (this session)</h2>
      ${m ? `<div class="kpis"><div><b>${m.alertsOpened}</b>alerts</div><div><b>${k(m.checkinPromptResponseRate, '%')}</b>prompts answered by worker</div>
        <div><b>${k(m.medianResponseSec, 's')}</b>median time to a human response</div><div><b>${m.reachedFirstAider}</b>reached first-aider</div>
        <div><b>${m.signalLost}</b>signal-lost alerts</div><div><b>${m.emergencies}</b>emergencies</div>
        <div><b>${k(m.restAdherence, '%')}</b>rest breaks taken (whole crew, never per worker)</div>
        <div><b>${k(m.veryHardPct, '%')}</b>check-ins where work felt very hard</div>
        <div><b>${m.newOrReturning ?? 0}</b>new or returning workers on a ramp-up</div>
        <div><b>${m.personalisedWorkers ?? 0}</b>workers on stricter personal limits</div>
        <div><b>${m.pushSubscribed ?? 0}</b>phones with background alerts</div>
        <div><b>${k(m.medianTimeToCoolingSec != null ? mmss(m.medianTimeToCoolingSec * 1000) : null)}</b>median time from emergency to cooling</div>
        <div><b>${k(m.breakScore)}</b>break-check score (rest, water, shade)</div></div>
        ${m.outcomes && Object.values(m.outcomes).some(Boolean) ? `<p class="small">Cases closed by the first-aider: ${Object.entries(m.outcomes).filter(([, n]) => n).map(([key, n]) => `${OUTCOME_LABEL[key]} <b>${n}</b>`).join(' · ')}</p>` : ''}` : ''}
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
  function schedule(tasks, hours, ban, calib = 0) {
    const used = new Set();
    const order = tasks.map((task, idx) => ({ task, idx })).sort((a, b) => Heat.WORKLOAD[b.task.workload] - Heat.WORKLOAD[a.task.workload]);
    return order.map(({ task, idx }) => {
      const plan = Heat.assessDay(hours, { workload: task.workload, clothing: 'standard', daysOnSite: 30, calib }, ban);
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
    const res = schedule(V.tasks, hours, site().middayBan, site().calib || 0);
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
      const c0 = b.dataset.c;
      if (b.dataset.ex) return checkin('ok', [], b.dataset.ex);
      if (w === 'ok') return checkin('ok');
      if (w === 'unwell') return openSymptoms();
      if (w === 'close') return closeModal();
      if (w === 'hyd') return openHydration();
      if (w === 'scan') return openScan();
      if (w === 'scanSend') return verifyStation($('#scanCode').value);
      if (w === 'cup') { try { const r = await api('/api/water', { method: 'POST' }); if (W.me && W.me.water) W.me.water.cups = r.cups; } catch {} return drawWorker(); }
      if (c0 === 'audit') return openAudit(b.dataset.st);
      if (c0 === 'auditSave') return saveAudit(b.dataset.st);
      if (c0 === 'posters') return openPosters();
      if (b.dataset.hyd) return pickHydration(Number(b.dataset.hyd));
      if (w === 'wearDemo') return startDemoWear();
      if (w === 'wearBle') return connectWear();
      if (c0 === 'calib') { const s = await api('/api/site/calibrate', { method: 'POST', body: { siteId: V.site, wbgt: $('#calWbgt').value } }); V.config.sites = V.config.sites.map((x) => (x.id === s.id ? s : x)); return loadForecast(); }
      if (w === 'sendSym') return checkin('unwell', [...overlay.querySelectorAll('.chip.on')].map((x) => x.dataset.sym));
      if (w === 'end') { await api('/api/shift/end', { method: 'POST' }).catch(() => {}); local.del('hm_plan'); W.view = null; W.me = null; return pollWorker(); }
      if (b.dataset.act) { await api(`/api/alerts/${b.dataset.id}/${b.dataset.act}`, { method: 'POST', body: { outcome: V.outcomes[b.dataset.id] || '' } }); return pollConsole(); }
      if (w === 'push') return enablePush(true);
      if (c0 === 'saveReady') return saveReadiness();
      if (w === 'rest') { if (W.modal === 'prompt') closeModal(); try { const r = await api('/api/rest', { method: 'POST' }); if (W.me) W.me.rest = r; } catch {} return pollWorker(); }
      if (c0 === 'brief') return openBriefing();
      if (b.dataset.bud) {
        await api(`/api/alerts/${b.dataset.id}/buddy`, { method: 'POST', body: { result: b.dataset.bud } }).catch(() => {});
        closeModal();
        if (b.dataset.bud === 'help') showCfts();
        return pollWorker();
      }
      if (b.dataset.sms) return sendSmsDemo(b.dataset.sms);
      if (c0 === 'smsSend') { const v = $('#smsText').value.trim(); $('#smsText').value = ''; return v && sendSmsDemo(v); }
      if (c0 === 'report') return openReport();
      if (c0 === 'reportCsv') return downloadReport();
      if (c0 === 'brSay') return say(briefingLines(V.brLang || 'en').join(' '), V.brLang || 'en');
      if (c0 === 'brPrint') return window.print();
      if (b.dataset.silent) { await api(`/api/demo/silent/${b.dataset.silent}`, { method: 'POST' }); return pollConsole(); }
      if (b.dataset.deltask) { V.tasks.splice(Number(b.dataset.deltask), 1); local.set('hm_tasks', V.tasks); return drawSched(); }
      const c = b.dataset.c;
      if (c === 'play') return togglePlay();
      if (c === 'tab') {
        V.tab = b.dataset.tabGo; local.set('hm_tab', V.tab);
        $('#sv-grid').dataset.show = V.tab;
        document.querySelectorAll('#sv-tabs button').forEach((x) => x.classList.toggle('on', x === b));
        if (V.tab === 'insights' && V.map) setTimeout(() => V.map.invalidateSize(), 60); // map was hidden
        if (V.tab === 'setup') drawSetup();
        return;
      }
      if (c === 'crewRest') return crewCheck(true);
      if (c === 'crewOk') return crewCheck(false);
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
