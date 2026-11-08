'use strict';
// Every worker language must have the core worker strings, with the same {placeholders} as English.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const ctx = vm.createContext({});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'i18n.js'), 'utf8'), ctx);
const I18N = ctx.I18N;

const CORE = [
  'startShift', 'task', 'light', 'moderate', 'heavy', 'veryheavy', 'clothing', 'standard', 'polyolefin', 'doublelayer', 'vapourbarrier',
  'days', 'consent', 'privacy', 'b_green', 'b_yellow', 'b_orange', 'b_red', 'a_green', 'a_yellow', 'a_orange', 'a_red', 'ban', 'plan',
  'work', 'rest', 'min', 'rise', 'acclim', 'next', 'ok', 'unwell', 'areyouok', 'tapok', 'symTitle', 'send', 'cancel',
  's_headache', 's_dizzy', 's_cramps', 's_nausea', 's_thirst', 's_heavysweat', 's_confused', 's_fainted', 's_hotdry', 's_vomit',
  'emTitle', 'emBody', 'call', 'restTitle', 'restBody', 'offline', 'endShift', 'close', 'notMedical',
  'hyd', 'hydAsk', 'hyd_ok', 'hyd_mid', 'hyd_bad', 'hydNote', 'restNow', 'restBtn', 'resting', 'nextRest',
  'exAsk', 'ex_easy', 'ex_hard', 'ex_veryhard', 'exRest',
  'buddyTitle', 'buddyBody', 'buddyOk', 'buddyHelp', 'yourBuddy', 'smsReply', 'smsStart', 'smsEnd',
  'newWorker', 'returning', 'expBar', 'capUsed', 'dust_y', 'dust_o', 'dust_r', 'uvHigh', 'coolVest', 'coolSpot', 'personal', 'pushOn', 'pushOk', 'pushNo', 'pushSpam', 'more', 'change', 'joinTitle', 'phoneLbl', 'sendCode', 'codeLbl', 'signIn', 'notOnRoster', 'wrongCode', 'codeSent', 'voicePress', 'doseLine', 'kidney', 'reportBtn', 'reportTitle', 'r_water', 'r_shade', 'r_ban', 'r_rest', 'r_cool', 'r_other', 'reportThanks', 'cfts', 'scanStation', 'stationCode', 'verified', 'visitOnly', 'badCode', 'cup', 'cups',
];
const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');

for (const lang of Object.keys(I18N.langs)) {
  test(`${lang}: core worker strings present with matching placeholders`, () => {
    const L = I18N[lang];
    assert.ok(L, `no strings for ${lang}`);
    assert.ok(I18N.voice[lang], `no voice for ${lang}`);
    for (const k of CORE) {
      assert.ok(typeof L[k] === 'string' && L[k].trim(), `${lang}.${k} missing`);
      assert.strictEqual(holes(L[k]), holes(I18N.en[k]), `${lang}.${k} placeholders differ from English`);
    }
  });
}
