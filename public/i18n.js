// Worker-facing strings. Supervisor and first-aider consoles are English-only in this prototype.
window.I18N = {
  langs: { en: 'English', hi: 'हिन्दी', ar: 'العربية', ur: 'اردو' },
  rtl: ['ar', 'ur'],
  voice: { en: 'en-IN', hi: 'hi-IN', ar: 'ar-AE', ur: 'ur-PK' },
  en: {
    startShift: 'Start shift', task: 'Your work today', light: 'Light (signalling, driving)', moderate: 'Moderate (carrying, fixing)',
    heavy: 'Heavy (rebar, shovelling)', veryheavy: 'Very heavy (digging, fast lifting)', clothing: 'What you are wearing',
    standard: 'Normal work clothes', polyolefin: 'Disposable coverall', doublelayer: 'Double-layer coverall', vapourbarrier: 'Sealed chemical suit',
    days: 'Days working in this heat', consent: 'Share my symptoms with the site first-aider only',
    privacy: 'No GPS. Your supervisor never sees your symptoms. Not used for pay or discipline.',
    b_green: 'SAFE', b_yellow: 'CAUTION', b_orange: 'TAKE BREAKS', b_red: 'STOP',
    a_green: 'Normal work. Drink water regularly.', a_yellow: 'Work with a buddy. Drink 1 cup of water every 15–20 minutes.',
    a_orange: 'Follow the work/rest plan. Rest in shade. 1 cup of water every 15 minutes.', a_red: 'Stop this task now. Move to shade or a cool room. Only light work.',
    ban: 'Midday break ({start}–{end}): no outdoor work.', plan: 'This hour', work: 'Work', rest: 'Rest in shade', min: 'min',
    rise: 'From {time} risk rises to {band}. Finish heavy work before then.', acclim: 'You are new to this heat (day {d}). Keep heat exposure to {p}% of your shift.',
    next: 'Next check-in in', ok: "I'm OK", unwell: 'I feel unwell', areyouok: 'Are you OK?',
    tapok: 'Tap the button. If you do not answer, your supervisor will come to check.', symTitle: 'What do you feel?', send: 'Send', cancel: 'Cancel',
    s_headache: 'Headache', s_dizzy: 'Dizzy', s_cramps: 'Muscle cramps', s_nausea: 'Feel sick', s_thirst: 'Very thirsty', s_heavysweat: 'Heavy sweating',
    s_confused: 'Confused', s_fainted: 'Fainted / nearly fainted', s_hotdry: 'Hot, dry skin', s_vomit: 'Vomiting',
    emTitle: 'Emergency: help is coming', emBody: 'Stop work. Move to shade. Pour water on skin and fan. Call {n}.', call: 'Call {n}',
    restTitle: 'Rest now', restBody: 'Sit in shade for 15 minutes and drink water. The first-aider has been told.',
    offline: 'Offline: using your saved plan. Check-ins will send when you reconnect.', endShift: 'End shift', close: 'Close',
    notMedical: 'Decision support, not a medical device.',
  },
  hi: {
    startShift: 'शिफ्ट शुरू करें', task: 'आज का काम', light: 'हल्का (सिग्नल, ड्राइविंग)', moderate: 'मध्यम (सामान उठाना, फिटिंग)',
    heavy: 'भारी (सरिया, फावड़ा)', veryheavy: 'बहुत भारी (खुदाई, तेज़ उठाना)', clothing: 'आपने क्या पहना है',
    standard: 'सामान्य काम के कपड़े', polyolefin: 'डिस्पोज़ेबल कवरऑल', doublelayer: 'दो परत वाला कवरऑल', vapourbarrier: 'बंद केमिकल सूट',
    days: 'इस गर्मी में कितने दिन से काम कर रहे हैं', consent: 'मेरे लक्षण सिर्फ़ साइट के प्राथमिक उपचारकर्ता के साथ साझा करें',
    privacy: 'कोई GPS नहीं। आपका सुपरवाइज़र आपके लक्षण कभी नहीं देखता। वेतन या सज़ा के लिए इस्तेमाल नहीं होता।',
    b_green: 'सुरक्षित', b_yellow: 'सावधान', b_orange: 'ब्रेक लें', b_red: 'रुकें',
    a_green: 'सामान्य काम। नियमित पानी पिएँ।', a_yellow: 'साथी के साथ काम करें। हर 15–20 मिनट में 1 कप पानी पिएँ।',
    a_orange: 'काम/आराम योजना मानें। छाँव में आराम करें। हर 15 मिनट 1 कप पानी।', a_red: 'यह काम अभी रोकें। छाँव या ठंडे कमरे में जाएँ। सिर्फ़ हल्का काम।',
    ban: 'दोपहर का ब्रेक ({start}–{end}): बाहर काम नहीं।', plan: 'इस घंटे', work: 'काम', rest: 'छाँव में आराम', min: 'मिनट',
    rise: '{time} से जोखिम बढ़कर {band} होगा। भारी काम उससे पहले खत्म करें।', acclim: 'आप इस गर्मी में नए हैं (दिन {d})। गर्मी में काम शिफ्ट का {p}% ही रखें।',
    next: 'अगला चेक-इन', ok: 'मैं ठीक हूँ', unwell: 'मेरी तबीयत ठीक नहीं', areyouok: 'क्या आप ठीक हैं?',
    tapok: 'बटन दबाएँ। जवाब न देने पर आपका सुपरवाइज़र देखने आएगा।', symTitle: 'आपको क्या महसूस हो रहा है?', send: 'भेजें', cancel: 'रद्द करें',
    s_headache: 'सिरदर्द', s_dizzy: 'चक्कर', s_cramps: 'मांसपेशियों में ऐंठन', s_nausea: 'जी मिचलाना', s_thirst: 'बहुत प्यास', s_heavysweat: 'बहुत पसीना',
    s_confused: 'उलझन / भ्रम', s_fainted: 'बेहोशी / लगभग बेहोश', s_hotdry: 'गर्म, सूखी त्वचा', s_vomit: 'उल्टी',
    emTitle: 'आपातकाल: मदद आ रही है', emBody: 'काम रोकें। छाँव में जाएँ। त्वचा पर पानी डालें और हवा करें। {n} पर कॉल करें।', call: '{n} पर कॉल करें',
    restTitle: 'अभी आराम करें', restBody: '15 मिनट छाँव में बैठें और पानी पिएँ। प्राथमिक उपचारकर्ता को बता दिया गया है।',
    offline: 'ऑफ़लाइन: सेव की गई योजना चल रही है। नेटवर्क आने पर चेक-इन भेजे जाएँगे।', endShift: 'शिफ्ट खत्म करें', close: 'बंद करें',
    notMedical: 'निर्णय में मदद, मेडिकल डिवाइस नहीं।',
  },
  ar: {
    startShift: 'ابدأ المناوبة', task: 'عملك اليوم', light: 'خفيف (إشارات، قيادة)', moderate: 'متوسط (حمل، تركيب)',
    heavy: 'ثقيل (حديد تسليح، جرف)', veryheavy: 'ثقيل جدًا (حفر، رفع سريع)', clothing: 'ماذا ترتدي',
    standard: 'ملابس عمل عادية', polyolefin: 'بدلة واقية للاستعمال مرة واحدة', doublelayer: 'بدلة بطبقتين', vapourbarrier: 'بدلة كيميائية مغلقة',
    days: 'كم يومًا تعمل في هذا الحر', consent: 'شارك أعراضي مع مسعف الموقع فقط',
    privacy: 'لا يوجد تتبع للموقع. مشرفك لا يرى أعراضك أبدًا. لا يُستخدم للأجر أو العقوبات.',
    b_green: 'آمن', b_yellow: 'انتباه', b_orange: 'خذ فترات راحة', b_red: 'توقف',
    a_green: 'عمل عادي. اشرب الماء بانتظام.', a_yellow: 'اعمل مع زميل. اشرب كوبًا من الماء كل 15–20 دقيقة.',
    a_orange: 'اتبع خطة العمل والراحة. استرح في الظل. كوب ماء كل 15 دقيقة.', a_red: 'أوقف هذه المهمة الآن. انتقل إلى الظل أو غرفة باردة. عمل خفيف فقط.',
    ban: 'استراحة الظهيرة ({start}–{end}): لا عمل في الخارج.', plan: 'هذه الساعة', work: 'عمل', rest: 'راحة في الظل', min: 'دقيقة',
    rise: 'من الساعة {time} يرتفع الخطر إلى {band}. أنهِ العمل الثقيل قبل ذلك.', acclim: 'أنت جديد على هذا الحر (اليوم {d}). اجعل التعرض للحر {p}% من نوبتك فقط.',
    next: 'التسجيل التالي بعد', ok: 'أنا بخير', unwell: 'أشعر بتعب', areyouok: 'هل أنت بخير؟',
    tapok: 'اضغط الزر. إذا لم تجب، سيأتي مشرفك للاطمئنان عليك.', symTitle: 'بماذا تشعر؟', send: 'إرسال', cancel: 'إلغاء',
    s_headache: 'صداع', s_dizzy: 'دوخة', s_cramps: 'تشنج عضلي', s_nausea: 'غثيان', s_thirst: 'عطش شديد', s_heavysweat: 'تعرّق شديد',
    s_confused: 'ارتباك', s_fainted: 'إغماء أو شبه إغماء', s_hotdry: 'جلد حار وجاف', s_vomit: 'قيء',
    emTitle: 'طوارئ: المساعدة في الطريق', emBody: 'أوقف العمل. انتقل إلى الظل. اسكب الماء على الجلد وهوِّ عليه. اتصل بـ {n}.', call: 'اتصل بـ {n}',
    restTitle: 'استرح الآن', restBody: 'اجلس في الظل 15 دقيقة واشرب الماء. تم إبلاغ المسعف.',
    offline: 'غير متصل: نستخدم خطتك المحفوظة. سيتم إرسال التسجيلات عند عودة الاتصال.', endShift: 'إنهاء المناوبة', close: 'إغلاق',
    notMedical: 'أداة دعم للقرار، وليست جهازًا طبيًا.',
  },
  ur: {
    startShift: 'شفٹ شروع کریں', task: 'آج کا کام', light: 'ہلکا (سگنل، ڈرائیونگ)', moderate: 'درمیانہ (سامان اٹھانا، فٹنگ)',
    heavy: 'بھاری (سریا، بیلچہ)', veryheavy: 'بہت بھاری (کھدائی، تیز اٹھانا)', clothing: 'آپ نے کیا پہنا ہے',
    standard: 'عام کام کے کپڑے', polyolefin: 'ڈسپوزایبل کورآل', doublelayer: 'دو تہوں والا کورآل', vapourbarrier: 'بند کیمیکل سوٹ',
    days: 'اس گرمی میں کتنے دن سے کام کر رہے ہیں', consent: 'میری علامات صرف سائٹ کے فرسٹ ایڈر کے ساتھ شیئر کریں',
    privacy: 'کوئی GPS نہیں۔ آپ کا سپروائزر آپ کی علامات کبھی نہیں دیکھتا۔ تنخواہ یا سزا کے لیے استعمال نہیں ہوتا۔',
    b_green: 'محفوظ', b_yellow: 'احتیاط', b_orange: 'وقفے لیں', b_red: 'رکیں',
    a_green: 'معمول کا کام۔ باقاعدگی سے پانی پیئیں۔', a_yellow: 'ساتھی کے ساتھ کام کریں۔ ہر 15–20 منٹ میں 1 کپ پانی پیئیں۔',
    a_orange: 'کام/آرام کا منصوبہ مانیں۔ سائے میں آرام کریں۔ ہر 15 منٹ 1 کپ پانی۔', a_red: 'یہ کام ابھی روکیں۔ سائے یا ٹھنڈے کمرے میں جائیں۔ صرف ہلکا کام۔',
    ban: 'دوپہر کا وقفہ ({start}–{end}): باہر کام نہیں۔', plan: 'اس گھنٹے', work: 'کام', rest: 'سائے میں آرام', min: 'منٹ',
    rise: '{time} سے خطرہ بڑھ کر {band} ہوگا۔ بھاری کام اس سے پہلے ختم کریں۔', acclim: 'آپ اس گرمی میں نئے ہیں (دن {d})۔ گرمی میں کام شفٹ کا صرف {p}% رکھیں۔',
    next: 'اگلا چیک اِن', ok: 'میں ٹھیک ہوں', unwell: 'میری طبیعت ٹھیک نہیں', areyouok: 'کیا آپ ٹھیک ہیں؟',
    tapok: 'بٹن دبائیں۔ جواب نہ دینے پر آپ کا سپروائزر دیکھنے آئے گا۔', symTitle: 'آپ کو کیا محسوس ہو رہا ہے؟', send: 'بھیجیں', cancel: 'منسوخ',
    s_headache: 'سر درد', s_dizzy: 'چکر', s_cramps: 'پٹھوں میں اینٹھن', s_nausea: 'متلی', s_thirst: 'بہت پیاس', s_heavysweat: 'بہت پسینہ',
    s_confused: 'الجھن', s_fainted: 'بے ہوشی / قریب بے ہوش', s_hotdry: 'گرم، خشک جلد', s_vomit: 'الٹی',
    emTitle: 'ایمرجنسی: مدد آ رہی ہے', emBody: 'کام روکیں۔ سائے میں جائیں۔ جلد پر پانی ڈالیں اور ہوا کریں۔ {n} پر کال کریں۔', call: '{n} پر کال کریں',
    restTitle: 'ابھی آرام کریں', restBody: '15 منٹ سائے میں بیٹھیں اور پانی پیئیں۔ فرسٹ ایڈر کو بتا دیا گیا ہے۔',
    offline: 'آف لائن: محفوظ منصوبہ چل رہا ہے۔ نیٹ ورک آنے پر چیک اِن بھیجے جائیں گے۔', endShift: 'شفٹ ختم کریں', close: 'بند کریں',
    notMedical: 'فیصلے میں مدد، طبی آلہ نہیں۔',
  },
};

// Research-based additions: hydration self-check (Armstrong urine colour chart) and wearable heat strain (PSI).
Object.assign(I18N.en, {
  hyd: 'Hydration check', hydAsk: 'Tap the colour closest to your urine.', hyd_ok: 'Good. Keep drinking 1 cup every 15–20 minutes.',
  hyd_mid: 'Drink 2 cups of water now, then 1 cup every 15 minutes.', hyd_bad: 'You are dehydrated. Stop, rest in shade and drink water. Tell your supervisor if you feel dizzy.',
  hydNote: 'Stays on your phone. Not sent to anyone.', wearTitle: 'Heart-rate sensor (optional)', wearConnect: 'Connect Bluetooth sensor', wearDemo: 'Demo',
  strain: 'Heat strain', psi_low: 'Low', psi_moderate: 'Moderate', psi_high: 'High: stop and cool down', psi_veryhigh: 'Very high: get help now',
  coreTemp: 'Est. body temp', wearNote: 'Heart rate stays on your phone. Only a high-strain alert is sent.',
});
Object.assign(I18N.hi, {
  hyd: 'पानी की जाँच', hydAsk: 'अपने पेशाब के रंग के सबसे करीब वाला रंग दबाएँ।', hyd_ok: 'अच्छा। हर 15–20 मिनट में 1 कप पानी पीते रहें।',
  hyd_mid: 'अभी 2 कप पानी पिएँ, फिर हर 15 मिनट में 1 कप।', hyd_bad: 'आपके शरीर में पानी की कमी है। रुकें, छाँव में आराम करें और पानी पिएँ। चक्कर आए तो सुपरवाइज़र को बताएँ।',
  hydNote: 'यह सिर्फ़ आपके फ़ोन पर रहता है। किसी को नहीं भेजा जाता।', wearTitle: 'हृदय गति सेंसर (वैकल्पिक)', wearConnect: 'ब्लूटूथ सेंसर जोड़ें', wearDemo: 'डेमो',
  strain: 'गर्मी का दबाव', psi_low: 'कम', psi_moderate: 'मध्यम', psi_high: 'ज़्यादा: रुकें और शरीर ठंडा करें', psi_veryhigh: 'बहुत ज़्यादा: अभी मदद लें',
  coreTemp: 'अनुमानित शरीर तापमान', wearNote: 'हृदय गति आपके फ़ोन पर ही रहती है। सिर्फ़ ज़्यादा दबाव का अलर्ट भेजा जाता है।',
});
Object.assign(I18N.ar, {
  hyd: 'فحص الترطيب', hydAsk: 'اضغط على اللون الأقرب إلى لون بولك.', hyd_ok: 'جيد. استمر بشرب كوب كل 15–20 دقيقة.',
  hyd_mid: 'اشرب كوبين من الماء الآن، ثم كوبًا كل 15 دقيقة.', hyd_bad: 'لديك جفاف. توقف واسترح في الظل واشرب الماء. أخبر مشرفك إذا شعرت بدوخة.',
  hydNote: 'يبقى على هاتفك فقط. لا يُرسل لأحد.', wearTitle: 'حساس نبض القلب (اختياري)', wearConnect: 'توصيل حساس بلوتوث', wearDemo: 'عرض تجريبي',
  strain: 'الإجهاد الحراري', psi_low: 'منخفض', psi_moderate: 'متوسط', psi_high: 'مرتفع: توقف وبرّد جسمك', psi_veryhigh: 'مرتفع جدًا: اطلب المساعدة الآن',
  coreTemp: 'حرارة الجسم المقدرة', wearNote: 'يبقى نبض القلب على هاتفك. يُرسل تنبيه الإجهاد المرتفع فقط.',
});
Object.assign(I18N.ur, {
  hyd: 'پانی کی جانچ', hydAsk: 'اپنے پیشاب کے رنگ سے قریب ترین رنگ دبائیں۔', hyd_ok: 'اچھا۔ ہر 15–20 منٹ میں 1 کپ پانی پیتے رہیں۔',
  hyd_mid: 'ابھی 2 کپ پانی پیئیں، پھر ہر 15 منٹ میں 1 کپ۔', hyd_bad: 'آپ کے جسم میں پانی کی کمی ہے۔ رکیں، سائے میں آرام کریں اور پانی پیئیں۔ چکر آئے تو سپروائزر کو بتائیں۔',
  hydNote: 'یہ صرف آپ کے فون پر رہتا ہے۔ کسی کو نہیں بھیجا جاتا۔', wearTitle: 'دل کی دھڑکن کا سینسر (اختیاری)', wearConnect: 'بلوٹوتھ سینسر جوڑیں', wearDemo: 'ڈیمو',
  strain: 'گرمی کا دباؤ', psi_low: 'کم', psi_moderate: 'درمیانہ', psi_high: 'زیادہ: رکیں اور جسم ٹھنڈا کریں', psi_veryhigh: 'بہت زیادہ: ابھی مدد لیں',
  coreTemp: 'اندازاً جسم کا درجہ حرارت', wearNote: 'دل کی دھڑکن آپ کے فون پر ہی رہتی ہے۔ صرف زیادہ دباؤ کا الرٹ بھیجا جاتا ہے۔',
});

// Rest-break cycle, country WBGT stop rule, and the supervisor's morning briefing.
Object.assign(I18N.en, {
  restNow: 'Rest break now', restBtn: "I'm resting in the shade", resting: 'Resting ✓', nextRest: 'Next rest break in',
  ruleStop: 'WBGT is {w} °C, above the legal limit of {lim} °C: outdoor work must stop.',
  br_title: 'Heat safety briefing', br_peak: "Today's peak heat: {w} °C WBGT at {time}.", br_window: 'Heavy work: do it between {a} and {b}.',
  br_nowindow: 'There is no safe time for heavy work today. Only light tasks in the hot hours.', br_stop: 'Heavy work stops from {time}.',
  br_ban: 'No outdoor work from {start} to {end} (midday break).', br_water: 'Drink 1 cup of water every 15–20 minutes, even if you are not thirsty.',
  br_rest: 'Take every rest break in the shade. Your phone will tell you when.', br_new: 'New workers in their first week: less time in the heat. Tell your supervisor.',
  br_buddy: 'Watch your buddy. Confusion, fainting or hot dry skin is an emergency: call {n}.', br_app: "Answer 'Are you OK?' on your phone. Say you feel unwell early, not late.",
});
Object.assign(I18N.hi, {
  restNow: 'अभी आराम का ब्रेक', restBtn: 'मैं छाँव में आराम कर रहा/रही हूँ', resting: 'आराम कर रहे हैं ✓', nextRest: 'अगला आराम ब्रेक',
  ruleStop: 'WBGT {w} °C है, कानूनी सीमा {lim} °C से ज़्यादा: बाहर का काम रोकना होगा।',
  br_title: 'गर्मी से सुरक्षा ब्रीफ़िंग', br_peak: 'आज सबसे ज़्यादा गर्मी: {time} बजे {w} °C WBGT।', br_window: 'भारी काम: {a} से {b} के बीच करें।',
  br_nowindow: 'आज भारी काम के लिए कोई सुरक्षित समय नहीं है। गर्म घंटों में सिर्फ़ हल्का काम।', br_stop: '{time} से भारी काम बंद।',
  br_ban: '{start} से {end} तक बाहर कोई काम नहीं (दोपहर का ब्रेक)।', br_water: 'हर 15–20 मिनट में 1 कप पानी पिएँ, प्यास न लगे तब भी।',
  br_rest: 'हर आराम का ब्रेक छाँव में लें। आपका फ़ोन बताएगा कब।', br_new: 'पहले हफ़्ते वाले नए कर्मचारी: गर्मी में कम समय। अपने सुपरवाइज़र को बताएँ।',
  br_buddy: 'अपने साथी का ध्यान रखें। उलझन, बेहोशी या गर्म सूखी त्वचा आपातकाल है: {n} पर कॉल करें।', br_app: "फ़ोन पर 'क्या आप ठीक हैं?' का जवाब दें। तबीयत खराब लगे तो जल्दी बताएँ, देर से नहीं।",
});
Object.assign(I18N.ar, {
  restNow: 'استراحة الآن', restBtn: 'أنا أستريح في الظل', resting: 'في استراحة ✓', nextRest: 'الاستراحة التالية بعد',
  ruleStop: 'مؤشر WBGT ‏{w} °م، فوق الحد القانوني {lim} °م: يجب إيقاف العمل في الخارج.',
  br_title: 'إحاطة السلامة من الحرارة', br_peak: 'ذروة الحرارة اليوم: {w} °م WBGT عند الساعة {time}.', br_window: 'العمل الثقيل: بين الساعة {a} والساعة {b}.',
  br_nowindow: 'لا يوجد وقت آمن للعمل الثقيل اليوم. أعمال خفيفة فقط في الساعات الحارة.', br_stop: 'يتوقف العمل الثقيل من الساعة {time}.',
  br_ban: 'لا عمل في الخارج من {start} إلى {end} (استراحة الظهيرة).', br_water: 'اشرب كوب ماء كل 15–20 دقيقة حتى لو لم تشعر بالعطش.',
  br_rest: 'خذ كل فترة راحة في الظل. سينبهك هاتفك.', br_new: 'العمال الجدد في أسبوعهم الأول: وقت أقل في الحر. أخبر مشرفك.',
  br_buddy: 'راقب زميلك. الارتباك أو الإغماء أو الجلد الحار الجاف حالة طارئة: اتصل بـ {n}.', br_app: "أجب على سؤال 'هل أنت بخير؟' في هاتفك. أخبرنا بتعبك مبكرًا لا متأخرًا.",
});
Object.assign(I18N.ur, {
  restNow: 'ابھی آرام کا وقفہ', restBtn: 'میں سائے میں آرام کر رہا/رہی ہوں', resting: 'آرام کر رہے ہیں ✓', nextRest: 'اگلا آرام کا وقفہ',
  ruleStop: 'WBGT ‏{w} °C ہے، قانونی حد {lim} °C سے زیادہ: باہر کا کام روکنا ہوگا۔',
  br_title: 'گرمی سے حفاظت کی بریفنگ', br_peak: 'آج سب سے زیادہ گرمی: {time} بجے {w} °C WBGT۔', br_window: 'بھاری کام: {a} سے {b} کے درمیان کریں۔',
  br_nowindow: 'آج بھاری کام کے لیے کوئی محفوظ وقت نہیں۔ گرم گھنٹوں میں صرف ہلکا کام۔', br_stop: '{time} سے بھاری کام بند۔',
  br_ban: '{start} سے {end} تک باہر کوئی کام نہیں (دوپہر کا وقفہ)۔', br_water: 'ہر 15–20 منٹ میں 1 کپ پانی پیئیں، پیاس نہ لگے تب بھی۔',
  br_rest: 'ہر آرام کا وقفہ سائے میں لیں۔ آپ کا فون بتائے گا کب۔', br_new: 'پہلے ہفتے والے نئے کارکن: گرمی میں کم وقت۔ اپنے سپروائزر کو بتائیں۔',
  br_buddy: 'اپنے ساتھی کا خیال رکھیں۔ الجھن، بے ہوشی یا گرم خشک جلد ایمرجنسی ہے: {n} پر کال کریں۔', br_app: "فون پر 'کیا آپ ٹھیک ہیں؟' کا جواب دیں۔ طبیعت خراب لگے تو جلدی بتائیں، دیر سے نہیں۔",
});

// Perceived exertion ("how hard does it feel?") for the existing four languages.
Object.assign(I18N.en, { exAsk: 'How hard does your work feel?', ex_easy: 'Easy', ex_hard: 'Hard', ex_veryhard: 'Very hard', exRest: 'Take 10 minutes in the shade and drink water. Tell your supervisor if it does not get easier.' });
Object.assign(I18N.hi, { exAsk: 'काम कितना कठिन लग रहा है?', ex_easy: 'आसान', ex_hard: 'कठिन', ex_veryhard: 'बहुत कठिन', exRest: '10 मिनट छाँव में आराम करें और पानी पिएँ। आसान न लगे तो सुपरवाइज़र को बताएँ।' });
Object.assign(I18N.ar, { exAsk: 'ما مدى صعوبة عملك الآن؟', ex_easy: 'سهل', ex_hard: 'صعب', ex_veryhard: 'صعب جدًا', exRest: 'استرح 10 دقائق في الظل واشرب الماء. أخبر مشرفك إذا لم يصبح أسهل.' });
Object.assign(I18N.ur, { exAsk: 'کام کتنا مشکل لگ رہا ہے؟', ex_easy: 'آسان', ex_hard: 'مشکل', ex_veryhard: 'بہت مشکل', exRest: '10 منٹ سائے میں آرام کریں اور پانی پیئیں۔ آسان نہ لگے تو سپروائزر کو بتائیں۔' });

// Four more worker languages common on Gulf sites. Core worker screens only; anything missing falls back to English.
// Written for the prototype: needs review by native speakers before use with workers.
Object.assign(I18N.langs, { bn: 'বাংলা', ml: 'മലയാളം', ne: 'नेपाली', tl: 'Tagalog' });
Object.assign(I18N.voice, { bn: 'bn-IN', ml: 'ml-IN', ne: 'ne-NP', tl: 'fil-PH' });
I18N.bn = {
  startShift: 'শিফট শুরু করুন', task: 'আজকের কাজ', light: 'হালকা (সিগন্যাল, গাড়ি চালানো)', moderate: 'মাঝারি (মাল বহন, ফিটিং)',
  heavy: 'ভারী (রড বাঁধা, বেলচা)', veryheavy: 'খুব ভারী (খনন, দ্রুত তোলা)', clothing: 'আপনি কী পরে আছেন',
  standard: 'সাধারণ কাজের পোশাক', polyolefin: 'ডিসপোজেবল কভারঅল', doublelayer: 'দুই স্তরের কভারঅল', vapourbarrier: 'বন্ধ কেমিক্যাল স্যুট',
  days: 'এই গরমে কত দিন কাজ করছেন', consent: 'আমার উপসর্গ শুধু সাইটের প্রাথমিক চিকিৎসকের সাথে শেয়ার করুন',
  privacy: 'কোনো GPS নেই। আপনার সুপারভাইজার কখনো আপনার উপসর্গ দেখেন না। বেতন বা শাস্তির জন্য ব্যবহার হয় না।',
  b_green: 'নিরাপদ', b_yellow: 'সাবধান', b_orange: 'বিরতি নিন', b_red: 'থামুন',
  a_green: 'স্বাভাবিক কাজ। নিয়মিত পানি পান করুন।', a_yellow: 'সঙ্গীর সাথে কাজ করুন। প্রতি 15–20 মিনিটে 1 কাপ পানি পান করুন।',
  a_orange: 'কাজ/বিশ্রামের পরিকল্পনা মানুন। ছায়ায় বিশ্রাম নিন। প্রতি 15 মিনিটে 1 কাপ পানি।', a_red: 'এই কাজ এখনই বন্ধ করুন। ছায়ায় বা ঠান্ডা ঘরে যান। শুধু হালকা কাজ।',
  ban: 'দুপুরের বিরতি ({start}–{end}): বাইরে কোনো কাজ নয়।', plan: 'এই ঘণ্টায়', work: 'কাজ', rest: 'ছায়ায় বিশ্রাম', min: 'মিনিট',
  rise: '{time} থেকে ঝুঁকি বেড়ে {band} হবে। তার আগে ভারী কাজ শেষ করুন।', acclim: 'আপনি এই গরমে নতুন (দিন {d})। গরমে কাজ শিফটের {p}% এর মধ্যে রাখুন।',
  next: 'পরবর্তী চেক-ইন', ok: 'আমি ঠিক আছি', unwell: 'আমার শরীর খারাপ লাগছে', areyouok: 'আপনি কি ঠিক আছেন?',
  tapok: 'বোতাম চাপুন। উত্তর না দিলে আপনার সুপারভাইজার দেখতে আসবেন।', symTitle: 'আপনার কেমন লাগছে?', send: 'পাঠান', cancel: 'বাতিল',
  s_headache: 'মাথাব্যথা', s_dizzy: 'মাথা ঘোরা', s_cramps: 'পেশিতে টান', s_nausea: 'বমি বমি ভাব', s_thirst: 'খুব পিপাসা', s_heavysweat: 'খুব ঘাম',
  s_confused: 'বিভ্রান্তি', s_fainted: 'অজ্ঞান / প্রায় অজ্ঞান', s_hotdry: 'গরম, শুকনো ত্বক', s_vomit: 'বমি',
  emTitle: 'জরুরি অবস্থা: সাহায্য আসছে', emBody: 'কাজ থামান। ছায়ায় যান। ত্বকে পানি ঢালুন ও বাতাস করুন। {n} নম্বরে কল করুন।', call: '{n} নম্বরে কল করুন',
  restTitle: 'এখন বিশ্রাম নিন', restBody: '15 মিনিট ছায়ায় বসুন এবং পানি পান করুন। প্রাথমিক চিকিৎসককে জানানো হয়েছে।',
  offline: 'অফলাইন: সংরক্ষিত পরিকল্পনা চলছে। নেটওয়ার্ক ফিরলে চেক-ইন পাঠানো হবে।', endShift: 'শিফট শেষ করুন', close: 'বন্ধ করুন',
  notMedical: 'সিদ্ধান্তে সহায়তা, চিকিৎসা যন্ত্র নয়।',
  hyd: 'পানির পরীক্ষা', hydAsk: 'আপনার প্রস্রাবের রঙের সবচেয়ে কাছের রঙটি চাপুন।', hyd_ok: 'ভালো। প্রতি 15–20 মিনিটে 1 কাপ পানি পান করতে থাকুন।',
  hyd_mid: 'এখনই 2 কাপ পানি পান করুন, তারপর প্রতি 15 মিনিটে 1 কাপ।', hyd_bad: 'আপনার শরীরে পানির অভাব। থামুন, ছায়ায় বিশ্রাম নিন এবং পানি পান করুন। মাথা ঘুরলে সুপারভাইজারকে জানান।',
  hydNote: 'এটি শুধু আপনার ফোনে থাকে। কাউকে পাঠানো হয় না।',
  restNow: 'এখন বিশ্রামের বিরতি', restBtn: 'আমি ছায়ায় বিশ্রাম নিচ্ছি', resting: 'বিশ্রাম নিচ্ছেন ✓', nextRest: 'পরবর্তী বিশ্রাম',
  exAsk: 'কাজ কতটা কঠিন লাগছে?', ex_easy: 'সহজ', ex_hard: 'কঠিন', ex_veryhard: 'খুব কঠিন', exRest: '10 মিনিট ছায়ায় বিশ্রাম নিন এবং পানি পান করুন। সহজ না হলে সুপারভাইজারকে জানান।',
};
I18N.ml = {
  startShift: 'ഷിഫ്റ്റ് തുടങ്ങുക', task: 'ഇന്നത്തെ ജോലി', light: 'ലഘു (സിഗ്നൽ, ഡ്രൈവിംഗ്)', moderate: 'ഇടത്തരം (ചുമക്കൽ, ഫിറ്റിംഗ്)',
  heavy: 'കനത്തത് (കമ്പി കെട്ടൽ, കോരൽ)', veryheavy: 'വളരെ കനത്തത് (കുഴിക്കൽ, വേഗത്തിൽ ഉയർത്തൽ)', clothing: 'നിങ്ങൾ എന്താണ് ധരിച്ചിരിക്കുന്നത്',
  standard: 'സാധാരണ ജോലി വസ്ത്രം', polyolefin: 'ഡിസ്പോസബിൾ കവറോൾ', doublelayer: 'രണ്ട് പാളി കവറോൾ', vapourbarrier: 'അടച്ച കെമിക്കൽ സ്യൂട്ട്',
  days: 'ഈ ചൂടിൽ എത്ര ദിവസമായി ജോലി ചെയ്യുന്നു', consent: 'എന്റെ ലക്ഷണങ്ങൾ സൈറ്റിലെ പ്രഥമശുശ്രൂഷകനുമായി മാത്രം പങ്കിടുക',
  privacy: 'GPS ഇല്ല. നിങ്ങളുടെ സൂപ്പർവൈസർ നിങ്ങളുടെ ലക്ഷണങ്ങൾ ഒരിക്കലും കാണില്ല. ശമ്പളത്തിനോ ശിക്ഷയ്ക്കോ ഉപയോഗിക്കില്ല.',
  b_green: 'സുരക്ഷിതം', b_yellow: 'ശ്രദ്ധിക്കുക', b_orange: 'ഇടവേള എടുക്കുക', b_red: 'നിർത്തുക',
  a_green: 'സാധാരണ ജോലി. പതിവായി വെള്ളം കുടിക്കുക.', a_yellow: 'ഒരു കൂട്ടുകാരനോടൊപ്പം ജോലി ചെയ്യുക. ഓരോ 15–20 മിനിറ്റിലും 1 കപ്പ് വെള്ളം കുടിക്കുക.',
  a_orange: 'ജോലി/വിശ്രമ പദ്ധതി പാലിക്കുക. തണലിൽ വിശ്രമിക്കുക. ഓരോ 15 മിനിറ്റിലും 1 കപ്പ് വെള്ളം.', a_red: 'ഈ ജോലി ഇപ്പോൾ നിർത്തുക. തണലിലേക്കോ തണുത്ത മുറിയിലേക്കോ പോകുക. ലഘു ജോലി മാത്രം.',
  ban: 'ഉച്ച വിശ്രമം ({start}–{end}): പുറത്ത് ജോലി ഇല്ല.', plan: 'ഈ മണിക്കൂർ', work: 'ജോലി', rest: 'തണലിൽ വിശ്രമം', min: 'മിനിറ്റ്',
  rise: '{time} മുതൽ അപകടസാധ്യത {band} ആയി ഉയരും. അതിനുമുമ്പ് കനത്ത ജോലി തീർക്കുക.', acclim: 'നിങ്ങൾ ഈ ചൂടിൽ പുതിയതാണ് (ദിവസം {d}). ചൂടിലെ ജോലി ഷിഫ്റ്റിന്റെ {p}% ആയി പരിമിതപ്പെടുത്തുക.',
  next: 'അടുത്ത ചെക്ക്-ഇൻ', ok: 'എനിക്ക് കുഴപ്പമില്ല', unwell: 'എനിക്ക് സുഖമില്ല', areyouok: 'നിങ്ങൾക്ക് കുഴപ്പമില്ലേ?',
  tapok: 'ബട്ടൺ അമർത്തുക. മറുപടി നൽകിയില്ലെങ്കിൽ സൂപ്പർവൈസർ നോക്കാൻ വരും.', symTitle: 'നിങ്ങൾക്ക് എന്ത് അനുഭവപ്പെടുന്നു?', send: 'അയയ്ക്കുക', cancel: 'റദ്ദാക്കുക',
  s_headache: 'തലവേദന', s_dizzy: 'തലകറക്കം', s_cramps: 'പേശിവലിവ്', s_nausea: 'ഓക്കാനം', s_thirst: 'കടുത്ത ദാഹം', s_heavysweat: 'അമിതമായ വിയർപ്പ്',
  s_confused: 'ആശയക്കുഴപ്പം', s_fainted: 'ബോധക്ഷയം / ഏതാണ്ട് ബോധക്ഷയം', s_hotdry: 'ചൂടുള്ള, വരണ്ട ചർമ്മം', s_vomit: 'ഛർദ്ദി',
  emTitle: 'അടിയന്തരാവസ്ഥ: സഹായം വരുന്നു', emBody: 'ജോലി നിർത്തുക. തണലിലേക്ക് മാറുക. ചർമ്മത്തിൽ വെള്ളം ഒഴിച്ച് വീശുക. {n} എന്ന നമ്പറിൽ വിളിക്കുക.', call: '{n} വിളിക്കുക',
  restTitle: 'ഇപ്പോൾ വിശ്രമിക്കുക', restBody: '15 മിനിറ്റ് തണലിൽ ഇരുന്ന് വെള്ളം കുടിക്കുക. പ്രഥമശുശ്രൂഷകനെ അറിയിച്ചിട്ടുണ്ട്.',
  offline: 'ഓഫ്‌ലൈൻ: സേവ് ചെയ്ത പദ്ധതി ഉപയോഗിക്കുന്നു. നെറ്റ്‌വർക്ക് തിരികെ വരുമ്പോൾ ചെക്ക്-ഇന്നുകൾ അയയ്ക്കും.', endShift: 'ഷിഫ്റ്റ് അവസാനിപ്പിക്കുക', close: 'അടയ്ക്കുക',
  notMedical: 'തീരുമാനത്തിനുള്ള സഹായം, മെഡിക്കൽ ഉപകരണം അല്ല.',
  hyd: 'ജലാംശ പരിശോധന', hydAsk: 'നിങ്ങളുടെ മൂത്രത്തിന്റെ നിറത്തോട് ഏറ്റവും അടുത്ത നിറം അമർത്തുക.', hyd_ok: 'നല്ലത്. ഓരോ 15–20 മിനിറ്റിലും 1 കപ്പ് വെള്ളം കുടിക്കുന്നത് തുടരുക.',
  hyd_mid: 'ഇപ്പോൾ 2 കപ്പ് വെള്ളം കുടിക്കുക, പിന്നെ ഓരോ 15 മിനിറ്റിലും 1 കപ്പ്.', hyd_bad: 'നിങ്ങൾക്ക് നിർജ്ജലീകരണമുണ്ട്. നിർത്തുക, തണലിൽ വിശ്രമിച്ച് വെള്ളം കുടിക്കുക. തലകറക്കം തോന്നിയാൽ സൂപ്പർവൈസറെ അറിയിക്കുക.',
  hydNote: 'ഇത് നിങ്ങളുടെ ഫോണിൽ മാത്രം. ആർക്കും അയയ്ക്കില്ല.',
  restNow: 'ഇപ്പോൾ വിശ്രമ ഇടവേള', restBtn: 'ഞാൻ തണലിൽ വിശ്രമിക്കുന്നു', resting: 'വിശ്രമിക്കുന്നു ✓', nextRest: 'അടുത്ത വിശ്രമം',
  exAsk: 'ജോലി എത്ര കഠിനമായി തോന്നുന്നു?', ex_easy: 'എളുപ്പം', ex_hard: 'കഠിനം', ex_veryhard: 'വളരെ കഠിനം', exRest: '10 മിനിറ്റ് തണലിൽ വിശ്രമിച്ച് വെള്ളം കുടിക്കുക. എളുപ്പമായില്ലെങ്കിൽ സൂപ്പർവൈസറെ അറിയിക്കുക.',
};
I18N.ne = {
  startShift: 'सिफ्ट सुरु गर्नुहोस्', task: 'आजको काम', light: 'हल्का (सिग्नल, ड्राइभिङ)', moderate: 'मध्यम (सामान बोक्ने, फिटिङ)',
  heavy: 'भारी (डन्डी बाँध्ने, बेल्चा)', veryheavy: 'धेरै भारी (खन्ने, छिटो उचाल्ने)', clothing: 'तपाईंले के लगाउनुभएको छ',
  standard: 'साधारण कामको लुगा', polyolefin: 'एक पटक प्रयोग हुने कभरअल', doublelayer: 'दुई तहको कभरअल', vapourbarrier: 'बन्द केमिकल सुट',
  days: 'यो गर्मीमा कति दिनदेखि काम गर्दै हुनुहुन्छ', consent: 'मेरा लक्षणहरू साइटको प्राथमिक उपचारकर्तासँग मात्र साझा गर्नुहोस्',
  privacy: 'GPS छैन। तपाईंको सुपरभाइजरले तपाईंका लक्षण कहिल्यै देख्दैनन्। तलब वा सजायका लागि प्रयोग हुँदैन।',
  b_green: 'सुरक्षित', b_yellow: 'सावधान', b_orange: 'विश्राम लिनुहोस्', b_red: 'रोक्नुहोस्',
  a_green: 'सामान्य काम। नियमित पानी पिउनुहोस्।', a_yellow: 'साथीसँग काम गर्नुहोस्। हरेक 15–20 मिनेटमा 1 कप पानी पिउनुहोस्।',
  a_orange: 'काम/विश्राम योजना पालना गर्नुहोस्। छायाँमा आराम गर्नुहोस्। हरेक 15 मिनेटमा 1 कप पानी।', a_red: 'यो काम अहिले नै रोक्नुहोस्। छायाँ वा चिसो कोठामा जानुहोस्। हल्का काम मात्र।',
  ban: 'दिउँसोको विश्राम ({start}–{end}): बाहिर काम छैन।', plan: 'यो घण्टा', work: 'काम', rest: 'छायाँमा आराम', min: 'मिनेट',
  rise: '{time} देखि जोखिम बढेर {band} हुनेछ। त्यसअघि भारी काम सक्नुहोस्।', acclim: 'तपाईं यो गर्मीमा नयाँ हुनुहुन्छ (दिन {d})। गर्मीमा काम सिफ्टको {p}% मात्र राख्नुहोस्।',
  next: 'अर्को चेक-इन', ok: 'म ठीक छु', unwell: 'मलाई सन्चो छैन', areyouok: 'के तपाईं ठीक हुनुहुन्छ?',
  tapok: 'बटन थिच्नुहोस्। जवाफ नदिए तपाईंको सुपरभाइजर हेर्न आउनुहुनेछ।', symTitle: 'तपाईंलाई कस्तो महसुस भइरहेको छ?', send: 'पठाउनुहोस्', cancel: 'रद्द गर्नुहोस्',
  s_headache: 'टाउको दुखाइ', s_dizzy: 'रिँगटा', s_cramps: 'मांसपेशी बाउँडिने', s_nausea: 'वाकवाकी', s_thirst: 'धेरै तिर्खा', s_heavysweat: 'धेरै पसिना',
  s_confused: 'अलमल', s_fainted: 'बेहोस / लगभग बेहोस', s_hotdry: 'तातो, सुक्खा छाला', s_vomit: 'बान्ता',
  emTitle: 'आपतकाल: सहायता आउँदैछ', emBody: 'काम रोक्नुहोस्। छायाँमा जानुहोस्। छालामा पानी खन्याएर हावा लगाउनुहोस्। {n} मा फोन गर्नुहोस्।', call: '{n} मा फोन गर्नुहोस्',
  restTitle: 'अहिले आराम गर्नुहोस्', restBody: '15 मिनेट छायाँमा बसेर पानी पिउनुहोस्। प्राथमिक उपचारकर्तालाई जानकारी दिइएको छ।',
  offline: 'अफलाइन: सुरक्षित गरिएको योजना चलिरहेको छ। नेटवर्क आएपछि चेक-इन पठाइनेछ।', endShift: 'सिफ्ट सक्नुहोस्', close: 'बन्द गर्नुहोस्',
  notMedical: 'निर्णयमा सहयोग, चिकित्सा उपकरण होइन।',
  hyd: 'पानीको जाँच', hydAsk: 'तपाईंको पिसाबको रङसँग सबैभन्दा मिल्ने रङ थिच्नुहोस्।', hyd_ok: 'राम्रो। हरेक 15–20 मिनेटमा 1 कप पानी पिइरहनुहोस्।',
  hyd_mid: 'अहिले 2 कप पानी पिउनुहोस्, त्यसपछि हरेक 15 मिनेटमा 1 कप।', hyd_bad: 'तपाईंको शरीरमा पानीको कमी छ। रोक्नुहोस्, छायाँमा आराम गरेर पानी पिउनुहोस्। रिँगटा लागे सुपरभाइजरलाई भन्नुहोस्।',
  hydNote: 'यो तपाईंको फोनमा मात्र रहन्छ। कसैलाई पठाइँदैन।',
  restNow: 'अहिले आरामको समय', restBtn: 'म छायाँमा आराम गर्दैछु', resting: 'आराम गर्दै ✓', nextRest: 'अर्को आराम',
  exAsk: 'काम कत्तिको गाह्रो लागिरहेको छ?', ex_easy: 'सजिलो', ex_hard: 'गाह्रो', ex_veryhard: 'धेरै गाह्रो', exRest: '10 मिनेट छायाँमा आराम गरेर पानी पिउनुहोस्। सजिलो नभए सुपरभाइजरलाई भन्नुहोस्।',
};
I18N.tl = {
  startShift: 'Simulan ang shift', task: 'Trabaho mo ngayon', light: 'Magaan (signal, pagmamaneho)', moderate: 'Katamtaman (pagbubuhat, pagkakabit)',
  heavy: 'Mabigat (rebar, pagpapala)', veryheavy: 'Napakabigat (paghuhukay, mabilis na pagbubuhat)', clothing: 'Ano ang suot mo',
  standard: 'Karaniwang damit pantrabaho', polyolefin: 'Disposable na coverall', doublelayer: 'Dobleng-patong na coverall', vapourbarrier: 'Selyadong chemical suit',
  days: 'Ilang araw ka nang nagtatrabaho sa init na ito', consent: 'Ibahagi ang aking mga sintomas sa first-aider ng site lamang',
  privacy: 'Walang GPS. Hindi kailanman makikita ng supervisor mo ang iyong mga sintomas. Hindi ginagamit para sa sahod o parusa.',
  b_green: 'LIGTAS', b_yellow: 'MAG-INGAT', b_orange: 'MAGPAHINGA', b_red: 'TUMIGIL',
  a_green: 'Normal na trabaho. Uminom ng tubig nang regular.', a_yellow: 'Magtrabaho kasama ang kapareha. Uminom ng 1 tasang tubig bawat 15–20 minuto.',
  a_orange: 'Sundin ang plano ng trabaho at pahinga. Magpahinga sa lilim. 1 tasang tubig bawat 15 minuto.', a_red: 'Itigil na ang gawaing ito. Pumunta sa lilim o malamig na kuwarto. Magaan na trabaho lang.',
  ban: 'Pahinga sa tanghali ({start}–{end}): bawal ang trabaho sa labas.', plan: 'Ngayong oras', work: 'Trabaho', rest: 'Pahinga sa lilim', min: 'min',
  rise: 'Mula {time}, tataas ang panganib sa {band}. Tapusin ang mabigat na trabaho bago iyon.', acclim: 'Bago ka pa sa init na ito (araw {d}). Limitahan ang trabaho sa init sa {p}% ng iyong shift.',
  next: 'Susunod na check-in sa', ok: 'Okay lang ako', unwell: 'Masama ang pakiramdam ko', areyouok: 'Okay ka lang ba?',
  tapok: 'Pindutin ang button. Kapag hindi ka sumagot, pupuntahan ka ng supervisor mo.', symTitle: 'Ano ang nararamdaman mo?', send: 'Ipadala', cancel: 'Kanselahin',
  s_headache: 'Sakit ng ulo', s_dizzy: 'Nahihilo', s_cramps: 'Pulikat', s_nausea: 'Naduduwal', s_thirst: 'Sobrang uhaw', s_heavysweat: 'Sobrang pawis',
  s_confused: 'Nalilito', s_fainted: 'Nahimatay / halos mahimatay', s_hotdry: 'Mainit at tuyong balat', s_vomit: 'Pagsusuka',
  emTitle: 'Emergency: may darating na tulong', emBody: 'Itigil ang trabaho. Pumunta sa lilim. Buhusan ng tubig ang balat at paypayan. Tumawag sa {n}.', call: 'Tumawag sa {n}',
  restTitle: 'Magpahinga ngayon', restBody: 'Umupo sa lilim nang 15 minuto at uminom ng tubig. Nasabihan na ang first-aider.',
  offline: 'Offline: ginagamit ang naka-save mong plano. Maipapadala ang mga check-in kapag may koneksyon na.', endShift: 'Tapusin ang shift', close: 'Isara',
  notMedical: 'Gabay sa pagpapasya, hindi medical device.',
  hyd: 'Pagsusuri ng tubig sa katawan', hydAsk: 'Pindutin ang kulay na pinakamalapit sa kulay ng iyong ihi.', hyd_ok: 'Mabuti. Patuloy na uminom ng 1 tasa bawat 15–20 minuto.',
  hyd_mid: 'Uminom ng 2 tasang tubig ngayon, tapos 1 tasa bawat 15 minuto.', hyd_bad: 'Dehydrated ka. Tumigil, magpahinga sa lilim at uminom ng tubig. Sabihan ang supervisor kung nahihilo ka.',
  hydNote: 'Nasa telepono mo lang ito. Hindi ipinapadala kanino man.',
  restNow: 'Oras ng pahinga', restBtn: 'Nagpapahinga ako sa lilim', resting: 'Nagpapahinga ✓', nextRest: 'Susunod na pahinga sa',
  exAsk: 'Gaano kabigat ang pakiramdam ng trabaho mo?', ex_easy: 'Magaan', ex_hard: 'Mabigat', ex_veryhard: 'Napakabigat', exRest: 'Magpahinga ng 10 minuto sa lilim at uminom ng tubig. Sabihan ang supervisor kung hindi gumaan.',
};

// Buddy checks and SMS fallback.
Object.assign(I18N.en, { buddyTitle: 'Check on {name} now', buddyBody: 'They have not answered their phone. Go and see them.', buddyOk: "I see them, they're OK", buddyHelp: 'They need help', yourBuddy: 'Your buddy: {name}', smsReply: 'Reply 1 = I am OK, 2 = I feel unwell.', smsStart: 'Shift started. We will text you when to rest. Reply STOP to end the shift.', smsEnd: 'Shift ended. Rest and drink water.' });
Object.assign(I18N.hi, { buddyTitle: '{name} को अभी देखें', buddyBody: 'उन्होंने फ़ोन का जवाब नहीं दिया है। जाकर उन्हें देखें।', buddyOk: 'मैंने देखा, वे ठीक हैं', buddyHelp: 'उन्हें मदद चाहिए', yourBuddy: 'आपका साथी: {name}', smsReply: 'जवाब दें 1 = मैं ठीक हूँ, 2 = तबीयत ठीक नहीं।', smsStart: 'शिफ्ट शुरू। आराम का समय होने पर हम मैसेज करेंगे। शिफ्ट खत्म करने के लिए STOP भेजें।', smsEnd: 'शिफ्ट खत्म। आराम करें और पानी पिएँ।' });
Object.assign(I18N.ar, { buddyTitle: 'اطمئن على {name} الآن', buddyBody: 'لم يرد على هاتفه. اذهب وتفقده.', buddyOk: 'رأيته، هو بخير', buddyHelp: 'يحتاج إلى مساعدة', yourBuddy: 'زميلك: {name}', smsReply: 'أرسل 1 = أنا بخير، 2 = أشعر بتعب.', smsStart: 'بدأت المناوبة. سنرسل لك رسالة عند وقت الراحة. أرسل STOP لإنهاء المناوبة.', smsEnd: 'انتهت المناوبة. استرح واشرب الماء.' });
Object.assign(I18N.ur, { buddyTitle: '{name} کو ابھی دیکھیں', buddyBody: 'انہوں نے فون کا جواب نہیں دیا۔ جا کر انہیں دیکھیں۔', buddyOk: 'میں نے دیکھا، وہ ٹھیک ہیں', buddyHelp: 'انہیں مدد چاہیے', yourBuddy: 'آپ کا ساتھی: {name}', smsReply: 'جواب دیں 1 = میں ٹھیک ہوں، 2 = طبیعت ٹھیک نہیں۔', smsStart: 'شفٹ شروع۔ آرام کا وقت ہونے پر ہم میسج کریں گے۔ شفٹ ختم کرنے کے لیے STOP بھیجیں۔', smsEnd: 'شفٹ ختم۔ آرام کریں اور پانی پیئیں۔' });
Object.assign(I18N.bn, { buddyTitle: 'এখনই {name}-কে দেখুন', buddyBody: 'তিনি ফোনের উত্তর দেননি। গিয়ে তাকে দেখুন।', buddyOk: 'আমি দেখেছি, তিনি ঠিক আছেন', buddyHelp: 'তার সাহায্য দরকার', yourBuddy: 'আপনার সঙ্গী: {name}', smsReply: 'উত্তর দিন 1 = আমি ঠিক আছি, 2 = শরীর খারাপ লাগছে।', smsStart: 'শিফট শুরু হয়েছে। বিশ্রামের সময় হলে আমরা মেসেজ করব। শিফট শেষ করতে STOP পাঠান।', smsEnd: 'শিফট শেষ। বিশ্রাম নিন এবং পানি পান করুন।' });
Object.assign(I18N.ml, { buddyTitle: '{name}-നെ ഇപ്പോൾ നോക്കുക', buddyBody: 'അവർ ഫോണിന് മറുപടി നൽകിയിട്ടില്ല. പോയി അവരെ നോക്കുക.', buddyOk: 'ഞാൻ കണ്ടു, അവർക്ക് കുഴപ്പമില്ല', buddyHelp: 'അവർക്ക് സഹായം വേണം', yourBuddy: 'നിങ്ങളുടെ കൂട്ടുകാരൻ: {name}', smsReply: 'മറുപടി 1 = എനിക്ക് കുഴപ്പമില്ല, 2 = എനിക്ക് സുഖമില്ല.', smsStart: 'ഷിഫ്റ്റ് തുടങ്ങി. വിശ്രമിക്കേണ്ട സമയത്ത് ഞങ്ങൾ മെസേജ് അയയ്ക്കും. ഷിഫ്റ്റ് അവസാനിപ്പിക്കാൻ STOP അയയ്ക്കുക.', smsEnd: 'ഷിഫ്റ്റ് അവസാനിച്ചു. വിശ്രമിച്ച് വെള്ളം കുടിക്കുക.' });
Object.assign(I18N.ne, { buddyTitle: '{name} लाई अहिले हेर्नुहोस्', buddyBody: 'उहाँले फोनको जवाफ दिनुभएको छैन। गएर हेर्नुहोस्।', buddyOk: 'मैले देखेँ, उहाँ ठीक हुनुहुन्छ', buddyHelp: 'उहाँलाई मद्दत चाहिन्छ', yourBuddy: 'तपाईंको साथी: {name}', smsReply: 'जवाफ दिनुहोस् 1 = म ठीक छु, 2 = मलाई सन्चो छैन।', smsStart: 'सिफ्ट सुरु भयो। आराम गर्ने समयमा हामी म्यासेज गर्नेछौं। सिफ्ट सक्न STOP पठाउनुहोस्।', smsEnd: 'सिफ्ट सकियो। आराम गर्नुहोस् र पानी पिउनुहोस्।' });
Object.assign(I18N.tl, { buddyTitle: 'Puntahan si {name} ngayon', buddyBody: 'Hindi siya sumasagot sa telepono. Puntahan mo siya.', buddyOk: 'Nakita ko siya, okay siya', buddyHelp: 'Kailangan niya ng tulong', yourBuddy: 'Kapareha mo: {name}', smsReply: 'Sumagot ng 1 = Okay ako, 2 = Masama ang pakiramdam ko.', smsStart: 'Nagsimula na ang shift. Magte-text kami kapag oras na ng pahinga. Sumagot ng STOP para tapusin ang shift.', smsEnd: 'Tapos na ang shift. Magpahinga at uminom ng tubig.' });

// Acclimatisation protection, dust/UV, cooling, personal limits, background alerts.
Object.assign(I18N.en, {
  newWorker: 'New to the heat: day {d} of 5. Your safe heat time today is {m} min.', returning: 'Welcome back after {a} days away: day {d} of 4. Your safe heat time today is {m} min.',
  expBar: 'Heat time used today', capUsed: 'Your safe heat time for today is used up. Light work in the shade only.',
  dust_y: 'Dust in the air: wear a mask if you have asthma or breathing problems.', dust_o: 'Dusty air: wear an FFP2/N95 mask outdoors.',
  dust_r: 'Dust storm: stop heavy outdoor work, go indoors, wear an FFP2/N95 mask.', uvHigh: 'Very strong sun (UV {u}): cover your skin, wear a hat and use sunscreen.',
  coolVest: 'Wear a cooling vest during rest breaks.', coolSpot: 'Cooling point: {where}', personal: 'Your plan is {c} °C more cautious, learned from your own check-ins.',
  pushOn: 'Turn on alerts', pushOk: 'Alerts are on, even when the app is closed.', pushNo: 'Alerts are blocked. Allow notifications for this app in your phone settings.',
});
Object.assign(I18N.hi, {
  newWorker: 'गर्मी में नए हैं: दिन {d} / 5। आज आपका सुरक्षित गर्मी समय {m} मिनट है।', returning: '{a} दिन बाद वापसी: दिन {d} / 4। आज आपका सुरक्षित गर्मी समय {m} मिनट है।',
  expBar: 'आज इस्तेमाल हुआ गर्मी समय', capUsed: 'आज का आपका सुरक्षित गर्मी समय पूरा हो गया। सिर्फ़ छाँव में हल्का काम।',
  dust_y: 'हवा में धूल: अस्थमा या साँस की तकलीफ़ हो तो मास्क पहनें।', dust_o: 'धूल भरी हवा: बाहर FFP2/N95 मास्क पहनें।',
  dust_r: 'धूल भरी आँधी: भारी बाहरी काम रोकें, अंदर जाएँ, FFP2/N95 मास्क पहनें।', uvHigh: 'बहुत तेज़ धूप (UV {u}): त्वचा ढकें, टोपी पहनें और सनस्क्रीन लगाएँ।',
  coolVest: 'आराम के ब्रेक में कूलिंग वेस्ट पहनें।', coolSpot: 'ठंडा करने की जगह: {where}', personal: 'आपकी योजना {c} °C ज़्यादा सावधान है, आपके अपने चेक-इन से सीखी गई।',
  pushOn: 'अलर्ट चालू करें', pushOk: 'अलर्ट चालू हैं, ऐप बंद होने पर भी।', pushNo: 'अलर्ट बंद हैं। फ़ोन की सेटिंग में इस ऐप के नोटिफ़िकेशन की अनुमति दें।',
});
Object.assign(I18N.ar, {
  newWorker: 'جديد على الحر: اليوم {d} من 5. وقتك الآمن في الحر اليوم {m} دقيقة.', returning: 'عودة بعد غياب {a} يومًا: اليوم {d} من 4. وقتك الآمن في الحر اليوم {m} دقيقة.',
  expBar: 'وقت الحر المستخدم اليوم', capUsed: 'انتهى وقتك الآمن في الحر لهذا اليوم. عمل خفيف في الظل فقط.',
  dust_y: 'غبار في الهواء: ارتدِ كمامة إذا كان لديك ربو أو مشاكل في التنفس.', dust_o: 'هواء مغبر: ارتدِ كمامة FFP2/N95 في الخارج.',
  dust_r: 'عاصفة غبارية: أوقف العمل الثقيل في الخارج، ادخل إلى مكان مغلق، وارتدِ كمامة FFP2/N95.', uvHigh: 'شمس قوية جدًا (UV {u}): غطِّ جلدك وارتدِ قبعة واستخدم واقي الشمس.',
  coolVest: 'ارتدِ سترة تبريد أثناء فترات الراحة.', coolSpot: 'نقطة التبريد: {where}', personal: 'خطتك أكثر حذرًا بمقدار {c} °م، تعلّمناها من تسجيلاتك.',
  pushOn: 'تفعيل التنبيهات', pushOk: 'التنبيهات مفعّلة حتى عند إغلاق التطبيق.', pushNo: 'التنبيهات محظورة. اسمح بإشعارات هذا التطبيق من إعدادات هاتفك.',
});
Object.assign(I18N.ur, {
  newWorker: 'گرمی میں نئے ہیں: دن {d} / 5۔ آج آپ کا محفوظ گرمی کا وقت {m} منٹ ہے۔', returning: '{a} دن بعد واپسی: دن {d} / 4۔ آج آپ کا محفوظ گرمی کا وقت {m} منٹ ہے۔',
  expBar: 'آج استعمال ہونے والا گرمی کا وقت', capUsed: 'آج کا آپ کا محفوظ گرمی کا وقت پورا ہو گیا۔ صرف سائے میں ہلکا کام۔',
  dust_y: 'ہوا میں دھول: دمہ یا سانس کی تکلیف ہو تو ماسک پہنیں۔', dust_o: 'دھول بھری ہوا: باہر FFP2/N95 ماسک پہنیں۔',
  dust_r: 'ریت کا طوفان: بھاری بیرونی کام روکیں، اندر جائیں، FFP2/N95 ماسک پہنیں۔', uvHigh: 'بہت تیز دھوپ (UV {u}): جلد ڈھانپیں، ٹوپی پہنیں اور سن اسکرین لگائیں۔',
  coolVest: 'آرام کے وقفے میں کولنگ ویسٹ پہنیں۔', coolSpot: 'ٹھنڈا ہونے کی جگہ: {where}', personal: 'آپ کا منصوبہ {c} °C زیادہ محتاط ہے، آپ کے اپنے چیک اِن سے سیکھا گیا۔',
  pushOn: 'الرٹ آن کریں', pushOk: 'الرٹ آن ہیں، ایپ بند ہونے پر بھی۔', pushNo: 'الرٹ بند ہیں۔ فون کی سیٹنگز میں اس ایپ کے نوٹیفکیشن کی اجازت دیں۔',
});
Object.assign(I18N.bn, {
  newWorker: 'গরমে নতুন: দিন {d} / 5। আজ আপনার নিরাপদ গরমের সময় {m} মিনিট।', returning: '{a} দিন পর ফিরেছেন: দিন {d} / 4। আজ আপনার নিরাপদ গরমের সময় {m} মিনিট।',
  expBar: 'আজ ব্যবহৃত গরমের সময়', capUsed: 'আজকের নিরাপদ গরমের সময় শেষ। শুধু ছায়ায় হালকা কাজ।',
  dust_y: 'বাতাসে ধুলো: হাঁপানি বা শ্বাসকষ্ট থাকলে মাস্ক পরুন।', dust_o: 'ধুলোময় বাতাস: বাইরে FFP2/N95 মাস্ক পরুন।',
  dust_r: 'ধুলিঝড়: ভারী বাইরের কাজ বন্ধ করুন, ভেতরে যান, FFP2/N95 মাস্ক পরুন।', uvHigh: 'খুব কড়া রোদ (UV {u}): ত্বক ঢাকুন, টুপি পরুন এবং সানস্ক্রিন লাগান।',
  coolVest: 'বিশ্রামের বিরতিতে কুলিং ভেস্ট পরুন।', coolSpot: 'ঠান্ডা হওয়ার জায়গা: {where}', personal: 'আপনার পরিকল্পনা {c} °C বেশি সতর্ক, আপনার নিজের চেক-ইন থেকে শেখা।',
  pushOn: 'অ্যালার্ট চালু করুন', pushOk: 'অ্যালার্ট চালু আছে, অ্যাপ বন্ধ থাকলেও।', pushNo: 'অ্যালার্ট বন্ধ। ফোনের সেটিংসে এই অ্যাপের নোটিফিকেশন চালু করুন।',
});
Object.assign(I18N.ml, {
  newWorker: 'ചൂടിൽ പുതിയത്: ദിവസം {d} / 5. ഇന്ന് നിങ്ങളുടെ സുരക്ഷിത ചൂട് സമയം {m} മിനിറ്റ്.', returning: '{a} ദിവസത്തിന് ശേഷം തിരിച്ചെത്തി: ദിവസം {d} / 4. ഇന്ന് നിങ്ങളുടെ സുരക്ഷിത ചൂട് സമയം {m} മിനിറ്റ്.',
  expBar: 'ഇന്ന് ഉപയോഗിച്ച ചൂട് സമയം', capUsed: 'ഇന്നത്തെ സുരക്ഷിത ചൂട് സമയം തീർന്നു. തണലിൽ ലഘു ജോലി മാത്രം.',
  dust_y: 'വായുവിൽ പൊടി: ആസ്ത്മയോ ശ്വാസതടസ്സമോ ഉണ്ടെങ്കിൽ മാസ്ക് ധരിക്കുക.', dust_o: 'പൊടി നിറഞ്ഞ വായു: പുറത്ത് FFP2/N95 മാസ്ക് ധരിക്കുക.',
  dust_r: 'പൊടിക്കാറ്റ്: കനത്ത പുറംജോലി നിർത്തുക, അകത്തേക്ക് പോകുക, FFP2/N95 മാസ്ക് ധരിക്കുക.', uvHigh: 'വളരെ ശക്തമായ വെയിൽ (UV {u}): ചർമ്മം മൂടുക, തൊപ്പി ധരിക്കുക, സൺസ്ക്രീൻ പുരട്ടുക.',
  coolVest: 'വിശ്രമ ഇടവേളകളിൽ കൂളിംഗ് വെസ്റ്റ് ധരിക്കുക.', coolSpot: 'തണുക്കാനുള്ള സ്ഥലം: {where}', personal: 'നിങ്ങളുടെ പദ്ധതി {c} °C കൂടുതൽ ജാഗ്രതയുള്ളതാണ്, നിങ്ങളുടെ ചെക്ക്-ഇന്നുകളിൽ നിന്ന് പഠിച്ചത്.',
  pushOn: 'അലേർട്ടുകൾ ഓണാക്കുക', pushOk: 'ആപ്പ് അടച്ചാലും അലേർട്ടുകൾ ഓണാണ്.', pushNo: 'അലേർട്ടുകൾ തടഞ്ഞിരിക്കുന്നു. ഫോൺ ക്രമീകരണങ്ങളിൽ ഈ ആപ്പിന് അറിയിപ്പുകൾ അനുവദിക്കുക.',
});
Object.assign(I18N.ne, {
  newWorker: 'गर्मीमा नयाँ: दिन {d} / 5। आज तपाईंको सुरक्षित गर्मी समय {m} मिनेट।', returning: '{a} दिनपछि फर्कनुभयो: दिन {d} / 4। आज तपाईंको सुरक्षित गर्मी समय {m} मिनेट।',
  expBar: 'आज प्रयोग भएको गर्मी समय', capUsed: 'आजको सुरक्षित गर्मी समय सकियो। छायाँमा हल्का काम मात्र।',
  dust_y: 'हावामा धुलो: दम वा सास फेर्न गाह्रो भए मास्क लगाउनुहोस्।', dust_o: 'धुलो भएको हावा: बाहिर FFP2/N95 मास्क लगाउनुहोस्।',
  dust_r: 'धुलोको आँधी: भारी बाहिरी काम रोक्नुहोस्, भित्र जानुहोस्, FFP2/N95 मास्क लगाउनुहोस्।', uvHigh: 'धेरै कडा घाम (UV {u}): छाला ढाक्नुहोस्, टोपी लगाउनुहोस् र सनस्क्रिन लगाउनुहोस्।',
  coolVest: 'आरामको समयमा कुलिङ भेस्ट लगाउनुहोस्।', coolSpot: 'चिसो हुने ठाउँ: {where}', personal: 'तपाईंको योजना {c} °C बढी सावधान छ, तपाईंकै चेक-इनबाट सिकिएको।',
  pushOn: 'अलर्ट खोल्नुहोस्', pushOk: 'एप बन्द हुँदा पनि अलर्ट खुला छन्।', pushNo: 'अलर्ट बन्द छन्। फोनको सेटिङमा यो एपको सूचना अनुमति दिनुहोस्।',
});
Object.assign(I18N.tl, {
  newWorker: 'Bago sa init: araw {d} ng 5. Ang ligtas mong oras sa init ngayon ay {m} min.', returning: 'Bumalik pagkatapos ng {a} araw: araw {d} ng 4. Ang ligtas mong oras sa init ngayon ay {m} min.',
  expBar: 'Oras sa init na nagamit ngayon', capUsed: 'Ubos na ang ligtas mong oras sa init ngayon. Magaan na trabaho lang sa lilim.',
  dust_y: 'May alikabok sa hangin: magsuot ng mask kung may hika o hirap huminga.', dust_o: 'Maalikabok na hangin: magsuot ng FFP2/N95 mask sa labas.',
  dust_r: 'Bagyo ng alikabok: itigil ang mabigat na trabaho sa labas, pumasok sa loob, magsuot ng FFP2/N95 mask.', uvHigh: 'Napakatinding araw (UV {u}): takpan ang balat, magsuot ng sombrero at gumamit ng sunscreen.',
  coolVest: 'Magsuot ng cooling vest habang nagpapahinga.', coolSpot: 'Lugar para magpalamig: {where}', personal: 'Mas maingat nang {c} °C ang plano mo, natutunan mula sa sarili mong mga check-in.',
  pushOn: 'I-on ang mga alerto', pushOk: 'Naka-on ang mga alerto, kahit sarado ang app.', pushNo: 'Naka-block ang mga alerto. Payagan ang notifications ng app na ito sa settings ng telepono.',
});

// "Cool first, transport second": instructions for the buddy or bystanders at a suspected heat stroke.
Object.assign(I18N.en, { cfts: 'Start cooling now: shade, soak them with cold water and fan, ice on the neck and armpits. The first-aider is coming. Cool first, transport second.' });
Object.assign(I18N.hi, { cfts: 'अभी ठंडा करना शुरू करें: छाँव में ले जाएँ, ठंडे पानी से भिगोएँ और हवा करें, गर्दन और बगल पर बर्फ़ रखें। प्राथमिक उपचारकर्ता आ रहे हैं। पहले ठंडा करें, फिर अस्पताल ले जाएँ।' });
Object.assign(I18N.ar, { cfts: 'ابدأ التبريد الآن: انقله إلى الظل، بلّله بالماء البارد وهوِّ عليه، ضع الثلج على الرقبة والإبطين. المسعف في الطريق. التبريد أولًا ثم النقل.' });
Object.assign(I18N.ur, { cfts: 'ابھی ٹھنڈا کرنا شروع کریں: سائے میں لے جائیں، ٹھنڈے پانی سے بھگوئیں اور ہوا کریں، گردن اور بغلوں پر برف رکھیں۔ فرسٹ ایڈر آ رہا ہے۔ پہلے ٹھنڈا کریں، پھر اسپتال لے جائیں۔' });
Object.assign(I18N.bn, { cfts: 'এখনই ঠান্ডা করা শুরু করুন: ছায়ায় নিন, ঠান্ডা পানিতে ভিজিয়ে বাতাস করুন, ঘাড় ও বগলে বরফ দিন। প্রাথমিক চিকিৎসক আসছেন। আগে ঠান্ডা করুন, তারপর হাসপাতালে নিন।' });
Object.assign(I18N.ml, { cfts: 'ഇപ്പോൾ തണുപ്പിക്കാൻ തുടങ്ങുക: തണലിലേക്ക് മാറ്റുക, തണുത്ത വെള്ളത്തിൽ നനച്ച് വീശുക, കഴുത്തിലും കക്ഷത്തിലും ഐസ് വയ്ക്കുക. പ്രഥമശുശ്രൂഷകൻ വരുന്നു. ആദ്യം തണുപ്പിക്കുക, പിന്നെ ആശുപത്രിയിലേക്ക്.' });
Object.assign(I18N.ne, { cfts: 'अहिले नै चिसो पार्न सुरु गर्नुहोस्: छायाँमा लैजानुहोस्, चिसो पानीले भिजाएर हावा लगाउनुहोस्, घाँटी र काखीमा बरफ राख्नुहोस्। प्राथमिक उपचारकर्ता आउँदै हुनुहुन्छ। पहिले चिसो पार्नुहोस्, त्यसपछि अस्पताल लैजानुहोस्।' });
Object.assign(I18N.tl, { cfts: 'Simulan nang palamigin: dalhin sa lilim, basain ng malamig na tubig at paypayan, yelo sa leeg at kili-kili. Parating na ang first-aider. Palamigin muna, saka dalhin sa ospital.' });
