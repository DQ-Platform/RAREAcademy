/* =====================================================================
   RARE Academy – Firebase: Google ilə giriş, e-poçt kodu ilə təsdiq,
   qeydiyyat müraciətləri, "90 gün xatırla". Quraşdırma: SETUP.md
   Konfiqurasiya dəyərləri ictimaidir (təhlükəsizliyi firestore.rules təmin edir).
   ===================================================================== */
import { FIREBASE_CONFIG, FUNCTIONS_REGION, CEO_EMAIL } from './firebase-config.js';
import { applySite } from './cms.js';
const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';

const ready = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
const $id = id => document.getElementById(id);
const NO_REG = 'Sizin aktiv qeydiyyatınız yoxdur. Əvvəlcə qeydiyyatdan keçin.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneOk = v => String(v).replace(/\D/g, '').length >= 9;
let user = null, profile = null, A = null, F = null, auth = null, db = null, sendCode = null, verifyCode = null;
let isAdmin = false;
let mode = 'register', emailCtx = null, resendT = null;

if (!ready) console.info('[RARE] Mərkəzi baza qoşulmayıb (firebase-config.js → FIREBASE_CONFIG). Köhnə rejim işləyir.');
else {
  const [app, au, fs, fn] = await Promise.all(['app', 'auth', 'firestore', 'functions'].map(n => import(FB + 'firebase-' + n + '.js')));
  A = au; F = fs;
  const fbApp = app.initializeApp(FIREBASE_CONFIG);
  auth = A.getAuth(fbApp); auth.languageCode = 'az'; db = F.getFirestore(fbApp);
  const fns = fn.getFunctions(fbApp, FUNCTIONS_REGION);
  sendCode = fn.httpsCallable(fns, 'sendEmailCode'); verifyCode = fn.httpsCallable(fns, 'verifyEmailCode');
  A.getRedirectResult(auth).catch(() => {});
  applySite(db, F);                                   // admin paneldəki sayt ayarlarını tətbiq edir
}

/* ---- Yaddaş: axın (sessionStorage) və "90 gün xatırla" (localStorage) ---- */
const FLOW = 'rare_flow', REM = 'rare_remember';
const getFlow = () => { try { return JSON.parse(sessionStorage.getItem(FLOW)); } catch (e) { return null; } };
const setFlow = o => { try { sessionStorage.setItem(FLOW, JSON.stringify(o)); } catch (e) {} };
const clearFlow = () => { try { sessionStorage.removeItem(FLOW); } catch (e) {} };
const rawRem = () => { try { return JSON.parse(localStorage.getItem(REM)); } catch (e) { return null; } };
const getRem = () => { const r = rawRem(); return r && r.until > Date.now() ? r : null; };
const setRem = d => { try { localStorage.setItem(REM, JSON.stringify({ ...d, until: Date.now() + 90 * 864e5 })); } catch (e) {} };
const clearRem = () => { try { localStorage.removeItem(REM); } catch (e) {} };
const consentOk = () => !(window.RARE_CONSENT && window.RARE_CONSENT.level === 'none');
const applyRemember = (on, name, program) => (on && consentOk() && user) ? setRem({ name, program, email: user.email }) : clearRem();
window.addEventListener('rare:consent', e => {            // "Rədd et" → saxlanmış məlumatlar silinir
  if (e.detail.level === 'none') { const r = rawRem(); if (r) { try { localStorage.setItem(REM, JSON.stringify({ until: r.until })); } catch (x) {} } }
  syncRemember();
});

const fullName = () => (profile && profile.fullName) || (user && (user.displayName || user.email)) || '';
const firstName = () => fullName().split(/\s+/)[0] || '';
const msg = (e, d = 'Xəta baş verdi. Bir az sonra yenidən cəhd edin.') =>
  e && String(e.code).startsWith('functions/') && e.message && !/^[A-Z_ ]+$/.test(e.message) ? e.message : d;
const fail = (el, text, input) => { el.textContent = text; if (input) input.focus(); };

/* ---- Menyu ---- */
function renderAuth() {
  const inLi = $id('acctIn'), menuLi = $id('acctMenu');
  if (!inLi || !menuLi) return;
  inLi.hidden = !!user; menuLi.hidden = !user;
  if ($id('adminLi')) $id('adminLi').hidden = !isAdmin;
  if (!user) return;
  $id('acctName').textContent = firstName();
  const av = $id('acctAv'), url = user.photoURL || ''; av.textContent = '';
  if (/^https:\/\//.test(url)) {
    const img = document.createElement('img');
    img.src = url; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.width = img.height = 30; av.appendChild(img);
  } else av.textContent = (firstName()[0] || '?').toUpperCase();
}
async function checkAdmin() {
  isAdmin = false; if (!user) return;
  if ((user.email || '').toLowerCase() === CEO_EMAIL && user.emailVerified) { isAdmin = true; return; }
  try { isAdmin = (await F.getDoc(F.doc(db, 'admins', user.uid))).exists(); } catch (_) {}
}
async function loadProfile() {
  const ref = F.doc(db, 'users', user.uid);
  let snap = await F.getDoc(ref);
  if (!snap.exists()) {
    await F.setDoc(ref, { email: user.email || '', fullName: user.displayName || null, phone: null, photoURL: user.photoURL || null,
      role: 'student', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() });
    snap = await F.getDoc(ref);
  }
  profile = snap.data();
}

/* ---- Dialoq: addımlar ---- */
const dlg = () => $id('register');
function showStep(n) {
  dlg().querySelectorAll('[data-step]').forEach(s => { s.hidden = s.dataset.step !== String(n); });
  $id('rememberRow').hidden = !ready || !(n === 1 || n === 3);
  if (n === 2) setTimeout(() => $id('codeForm').code.focus(), 60);
}
function setMode(m) {
  mode = m;
  dlg().classList.toggle('login', m === 'login'); dlg().classList.toggle('legacy', !ready);
  $id('regTitle').textContent = m === 'login' ? 'Daxil ol' : 'Qeydiyyat';
  $id('regLead').textContent = m === 'login' ? 'Qeydiyyatdan keçdiyiniz ad və Gmail ünvanını yazın – təsdiq kodu göndərəcəyik. Və ya Google ilə daxil olun.'
    : ready ? 'Məlumatlarınızı yazın və e-poçtunuzu təsdiqləyin – komandamız tezliklə sizinlə əlaqə saxlayacaq.'
            : 'Məlumatlarınızı yazın, komandamız tezliklə sizinlə əlaqə saxlayacaq.';
  $id('sendLabel').textContent = ready ? 'Kod göndər' : 'Göndər';
  $id('haveText').textContent = m === 'login' ? 'Qeydiyyatım yoxdur' : 'Qeydiyyatım var';
  $id('switchBtn').textContent = m === 'login' ? 'Qeydiyyatdan keç' : 'Daxil ol';
}
function syncRemember() {
  const c = $id('remember'), ok = consentOk();
  c.disabled = !ok; if (!ok) c.checked = false; $id('rememberHint').hidden = ok;
}
function fillConfirm(fl) {
  const f = $id('confirmForm'), rem = getRem() || {};
  f.name.value = (profile && profile.fullName) || user.displayName || (fl && fl.name) || rem.name || '';
  f.program.value = (fl && fl.program) || $id('program').value || rem.program || '';
  $id('confirmEmail').textContent = user.email || ''; $id('confirmErr').textContent = '';
}
function openFlow(m) {
  if (!ready && m === 'login') return toast('Giriş sistemi tezliklə aktiv olacaq.');
  if (m === 'register' && window.RARE_SETTINGS && window.RARE_SETTINGS.registrationOpen === false) {
    if (dlg().open) closeDialog(dlg());
    return toast('Qeydiyyat müvəqqəti dayandırılıb. Zəhmət olmasa daha sonra yenidən cəhd edin.');
  }
  setMode(m);
  ['regErr', 'codeErr', 'confirmErr'].forEach(i => { $id(i).textContent = ''; });
  const f = $id('emailForm'), rem = getRem();
  if (rem && !f.name.value) f.name.value = rem.name || '';
  if (rem && !f.program.value) f.program.value = rem.program || '';
  if (rem && !f.email.value) f.email.value = rem.email || '';
  $id('remember').checked = !!rem && consentOk(); syncRemember();
  if (user && m === 'register') { fillConfirm(null); showStep(3); } else showStep(1);
  if (!dlg().open) openDialog(dlg());
}
function showDone(text, title) {
  $id('doneTitle').textContent = title || 'Müraciətiniz qəbul olundu'; $id('doneMsg').textContent = text; showStep(4);
}
function startResend() {
  clearInterval(resendT); let n = 60; const b = $id('resendBtn'); b.disabled = true;
  const tick = () => { b.textContent = n > 0 ? `Kodu yenidən göndər (${n})` : 'Kodu yenidən göndər'; if (n <= 0) { b.disabled = false; clearInterval(resendT); } n--; };
  tick(); resendT = setInterval(tick, 1000);
}

/* ---- 1) E-poçt kodu ilə ---- */
$id('emailForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $id('regErr'), btn = $id('sendBtn'); err.textContent = '';
  const name = f.name.value.trim(), program = f.program.value, email = f.email.value.trim().toLowerCase();
  if (name.length < 3) return fail(err, 'Ad və soyadı daxil edin.', f.name);
  if (mode === 'register' && !program) return fail(err, 'İstiqaməti seçin.', f.program);
  if (!EMAIL_RE.test(email)) return fail(err, 'Düzgün e-poçt ünvanı daxil edin.', f.email);
  btn.disabled = true;
  try {
    if (!ready) {                                           // baza qoşulmayıbsa köhnə rejim
      const r = await legacySubmit('RARE Academy – yeni qeydiyyat', { Ad: name, İstiqamət: program, Email: email });
      showDone(r === 'whatsapp' ? 'WhatsApp açıldı – hazır mesajı göndərin.' : r === 'mailto' ? 'Email proqramınız açıldı – mesajı göndərin.' : 'Tezliklə sizinlə əlaqə saxlayacağıq.');
      f.reset();
    } else {
      emailCtx = { mode, name, program, email, remember: $id('remember').checked && consentOk() };
      await sendCode({ email, mode, name });
      $id('codeTo').textContent = email; $id('codeForm').code.value = ''; $id('codeErr').textContent = '';
      showStep(2); startResend();
    }
  } catch (x) { err.textContent = msg(x); }
  btn.disabled = false;
});
$id('codeForm').code.addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value.length === 6) e.target.form.requestSubmit();
});
$id('codeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $id('codeErr'), btn = $id('codeBtn'), code = f.code.value.trim(); err.textContent = '';
  if (!/^\d{6}$/.test(code)) return fail(err, '6 rəqəmli kodu daxil edin.', f.code);
  btn.disabled = true;
  try {
    const { data } = await verifyCode({ email: emailCtx.email, code, name: emailCtx.name });
    await A.setPersistence(auth, emailCtx.remember ? A.browserLocalPersistence : A.browserSessionPersistence);
    setFlow({ mode: emailCtx.mode, via: 'email', name: emailCtx.name, program: emailCtx.program, remember: emailCtx.remember });
    await A.signInWithCustomToken(auth, data.token);        // davamı onAuthStateChanged → handleFlow
  } catch (x) { clearFlow(); err.textContent = msg(x, 'Təsdiq alınmadı. Yenidən cəhd edin.'); f.code.select(); }
  btn.disabled = false;
});
$id('resendBtn').addEventListener('click', async () => {
  const err = $id('codeErr'); err.textContent = '';
  try { await sendCode({ email: emailCtx.email, mode: emailCtx.mode, name: emailCtx.name }); startResend(); toast('Yeni kod göndərildi.'); } catch (x) { err.textContent = msg(x); }
});
$id('switchBtn').addEventListener('click', () => openFlow(mode === 'login' ? 'register' : 'login'));
$id('backBtn').addEventListener('click', () => { clearInterval(resendT); showStep(1); });

/* ---- 2) Google ilə ---- */
$id('googleBtn').addEventListener('click', async () => {
  if (!ready) return;
  const err = $id('regErr'), btn = $id('googleBtn'); err.textContent = ''; btn.disabled = true;
  const remember = $id('remember').checked && consentOk();
  const provider = new A.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await A.setPersistence(auth, remember ? A.browserLocalPersistence : A.browserSessionPersistence);
    setFlow({ mode, via: 'google', program: $id('program').value, name: $id('emailForm').name.value.trim(), remember });
    await A.signInWithPopup(auth, provider);
  } catch (x) {
    if (x.code === 'auth/popup-blocked' || x.code === 'auth/operation-not-supported-in-this-environment') {
      try { return await A.signInWithRedirect(auth, provider); } catch (_) {}
    }
    clearFlow();
    if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(x.code))
      err.textContent = x.code === 'auth/unauthorized-domain' ? 'Bu domen Firebase-də icazəli deyil (Authorized domains).'
        : x.code === 'auth/account-exists-with-different-credential' ? 'Bu e-poçt başqa üsulla qeydiyyatdan keçib – e-poçt kodu ilə daxil olun.'
        : 'Google ilə giriş alınmadı. Bir az sonra yenidən cəhd edin.';
  }
  btn.disabled = false;
});
$id('confirmForm').addEventListener('submit', async e => {          // Google-dan sonra təsdiq addımı
  e.preventDefault();
  const f = e.target, err = $id('confirmErr'), btn = $id('confirmBtn'), name = f.name.value.trim(), program = f.program.value; err.textContent = '';
  if (name.length < 3) return fail(err, 'Ad və soyadı daxil edin.', f.name);
  if (!program) return fail(err, 'İstiqaməti seçin.', f.program);
  btn.disabled = true;
  try { await saveRegistration(name, program); applyRemember($id('remember').checked, name, program); clearFlow(); }
  catch (x) { err.textContent = 'Müraciət göndərilmədi. Bir az sonra yenidən cəhd edin.'; }
  btn.disabled = false;
});

/* ---- Qeydiyyatın yazılması ---- */
async function saveRegistration(name, program) {
  await F.addDoc(F.collection(db, 'registrations'), { fullName: name, email: user.email, program, source: 'website',
    status: 'new', userId: user.uid, createdAt: F.serverTimestamp() });
  if (name !== (profile && profile.fullName)) {
    try { await F.updateDoc(F.doc(db, 'users', user.uid), { fullName: name, updatedAt: F.serverTimestamp() }); await loadProfile(); } catch (_) {}
  }
  renderAuth();
  showDone(`Təşəkkür edirik, ${name.split(/\s+/)[0]}! E-poçt ünvanınız təsdiqləndi, komandamız tezliklə sizinlə əlaqə saxlayacaq.`);
}
async function handleFlow() {
  const fl = getFlow(); if (!fl) return;
  try {
    if (fl.mode === 'login') {
      clearFlow();
      if (fl.via === 'google') {                           // Google ilə girişdə qeydiyyat yoxlanılır
        const q = await F.getDocs(F.query(F.collection(db, 'registrations'), F.where('userId', '==', user.uid)));
        if (!q.docs.some(d => d.data().status !== 'rejected')) {
          await A.signOut(auth); setMode('login'); showStep(1); $id('regErr').textContent = NO_REG;
          if (!dlg().open) openDialog(dlg()); return;
        }
      }
      applyRemember(fl.remember, fullName(), (getRem() || {}).program || '');
      closeDialog(dlg()); toast('Xoş gəldiniz, ' + firstName() + '!'); return;
    }
    if (fl.via === 'email') {
      clearFlow(); await saveRegistration(fl.name, fl.program); applyRemember(fl.remember, fl.name, fl.program); return;
    }
    setMode('register'); fillConfirm(fl); $id('remember').checked = !!fl.remember; syncRemember(); showStep(3);   // Google → təsdiq
    if (!dlg().open) openDialog(dlg());
  } catch (x) {
    clearFlow(); showStep(1); $id('regErr').textContent = fl.mode === 'login' ? 'Giriş alınmadı. Bir az sonra yenidən cəhd edin.' : 'Müraciət göndərilmədi. Bir az sonra yenidən cəhd edin.';
    if (!dlg().open) openDialog(dlg());
  }
}
dlg().addEventListener('close', () => { clearInterval(resendT); clearFlow(); });
$id('confirmProgram').innerHTML = $id('program').innerHTML;

/* ---- Profil ---- */
function openProfile() {
  if (!user) return openFlow('login');
  const f = $id('profileForm');
  f.name.value = fullName() === user.email ? '' : fullName();
  f.phone.value = (profile && profile.phone) || '';
  $id('profEmail').textContent = user.email || ''; $id('profErr').textContent = '';
  openDialog($id('profile'));
}
$id('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $id('profErr'), name = f.name.value.trim(), phone = f.phone.value.trim(); err.textContent = '';
  if (name.length < 3) return fail(err, 'Ad və soyadı daxil edin.', f.name);
  if (phone && !phoneOk(phone)) return fail(err, 'Düzgün mobil nömrə daxil edin.', f.phone);
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    await F.updateDoc(F.doc(db, 'users', user.uid), { fullName: name, phone: phone || null, updatedAt: F.serverTimestamp() });
    await loadProfile(); renderAuth(); closeDialog($id('profile')); toast('Profil yeniləndi.');
  } catch (_) { err.textContent = 'Yadda saxlamaq alınmadı. Yenidən cəhd edin.'; }
  btn.disabled = false;
});

/* ---- Düymələr ---- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-auth]'); if (!b) return;
  e.preventDefault();
  const a = b.dataset.auth;
  if (a === 'login') openFlow('login');
  else if (a === 'profile') openProfile();
  else if (a === 'logout' && ready) A.signOut(auth).then(() => toast('Hesabdan çıxdınız.'));
  else if (a === 'cabinet') user ? openProfile() : openFlow('login');
});
document.querySelectorAll('[data-open="register"]').forEach(b => b.addEventListener('click', () => openFlow('register')));

/* ---- Sessiya ---- */
if (ready) {
  A.onAuthStateChanged(auth, async u => {
    user = u;
    const r = rawRem();
    if (u && r && r.until <= Date.now()) { clearRem(); await A.signOut(auth); return; }   // 90 gün bitdi
    renderAuth();
    if (!u) { profile = null; isAdmin = false; renderAuth(); return; }
    try { await loadProfile(); } catch (_) {}
    await checkAdmin(); renderAuth(); await handleFlow();
  });
}

/* ---- Xəbər abunəliyi ---- */
const legacySubmit = window.submitData;
window.submitData = async function (subject, fields) {
  if (!ready || !fields.Email) return legacySubmit(subject, fields);
  const email = fields.Email.trim().toLowerCase();
  try { await F.setDoc(F.doc(db, 'newsletter', email), { email, createdAt: F.serverTimestamp() }); }
  catch (e) { if (e.code !== 'permission-denied') throw e; }     // artıq abunə olan e-poçt təkrar yazıla bilmir
  return 'sent';
};
