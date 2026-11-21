/* =====================================================================
   RARE Academy – Supabase: e-poçt kodu ilə təsdiq, Google ilə giriş (istəyə bağlı),
   qeydiyyat müraciətləri, "90 gün xatırla". Quraşdırma: SUPABASE-SETUP.md
   Konfiqurasiya dəyərləri ictimaidir (təhlükəsizliyi supabase/schema.sql-dəki RLS qaydaları təmin edir).
   ===================================================================== */
import { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_ENABLED, CEO_EMAIL } from './supabase-config.js';
import { applySite } from './cms.js';
const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

let ready = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const $id = id => document.getElementById(id);
const NO_REG = 'Sizin aktiv qeydiyyatınız yoxdur. Əvvəlcə qeydiyyatdan keçin.';
const NO_ACTIVE = 'Sizin aktiv qeydiyyatınız yoxdur. Ad, soyad və Gmail qeydiyyatdakı kimi yazılmalıdır, ya da əvvəlcə qeydiyyatdan keçin.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneOk = v => String(v).replace(/\D/g, '').length >= 9;
let user = null, profile = null, sb = null;
let isAdmin = false;
let mode = 'register', emailCtx = null, resendT = null;

/* Sessiya yaddaşı: "90 gün xatırla" seçilibsə localStorage, əks halda sessionStorage (brauzer bağlananda çıxış) */
let useLocal = false;
try {
  useLocal = Object.keys(localStorage).some(k => k.startsWith('sb-'));
  const f = JSON.parse(sessionStorage.getItem('rare_flow')); if (f && f.remember) useLocal = true;
} catch (e) {}
const storage = {
  getItem: k => { try { const v = sessionStorage.getItem(k); return v !== null ? v : localStorage.getItem(k); } catch (e) { return null; } },
  setItem: (k, v) => { try { const a = useLocal ? localStorage : sessionStorage, b = useLocal ? sessionStorage : localStorage; a.setItem(k, v); b.removeItem(k); } catch (e) {} },
  removeItem: k => { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) {} }
};
const setPersist = on => { useLocal = !!on; };

if (!ready) console.info('[RARE] Mərkəzi baza qoşulmayıb (supabase-config.js). Köhnə rejim işləyir.');
else {
  try {
    const { createClient } = await import(SB_CDN);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
    applySite(sb);                                    // admin paneldəki sayt ayarlarını tətbiq edir
  } catch (e) { ready = false; console.error('[RARE] Supabase yüklənmədi', e); }
}
if (!GOOGLE_ENABLED || !ready) {                      // Google qoşulmayıbsa düymə və "və ya" gizlədilir
  const g = $id('googleBtn'); if (g) g.style.display = 'none';
  const o = document.querySelector('#register .or'); if (o) o.style.display = 'none';
}
const norm = u => u ? { uid: u.id, email: u.email || '', emailVerified: !!u.email_confirmed_at,
  displayName: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || '',
  photoURL: (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || '' } : null;
const userErr = t => { const e = new Error(t); e.user = true; return e; };

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
  e && e.user ? e.message
  : e && (e.status === 429 || /rate limit|only request this after/i.test(e.message || '')) ? 'Çox tez-tez cəhd edildi. Bir az gözləyib yenidən cəhd edin.' : d;
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
  try { const r = await sb.from('admins').select('user_id').eq('user_id', user.uid).maybeSingle(); isAdmin = !!r.data; } catch (_) {}
}
async function loadProfile() {
  let r = await sb.from('profiles').select('*').eq('id', user.uid).maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) {                                       // adətən qeydiyyatda trigger yaradır; yoxdursa özümüz yazırıq
    const ins = await sb.from('profiles').insert({ id: user.uid, email: user.email, full_name: user.displayName || null, photo_url: user.photoURL || null });
    if (ins.error && ins.error.code !== '23505') throw ins.error;
    r = await sb.from('profiles').select('*').eq('id', user.uid).maybeSingle();
  }
  profile = r.data ? { fullName: r.data.full_name, phone: r.data.phone, role: r.data.role } : null;
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
  $id('regLead').textContent = m === 'login' ? 'Qeydiyyatdan keçdiyiniz ad və Gmail ünvanını yazın – təsdiq kodu göndərəcəyik.' + (GOOGLE_ENABLED ? ' Və ya Google ilə daxil olun.' : '')
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
async function sendCode({ email, mode, name }) {
  if (mode === 'login') {
    const r = await sb.rpc('has_active_registration', { p_email: email, p_name: name });
    if (r.error) throw userErr('Yoxlama alınmadı. Bir az sonra yenidən cəhd edin.');
    if (!r.data) throw userErr(NO_ACTIVE);
  }
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { full_name: name } } });
  if (error) {
    console.error('[RARE] signInWithOtp xətası', error);
    if (error.status === 429) throw error;
    throw userErr('E-poçt göndərilmədi. Bir az sonra yenidən cəhd edin. (' + (error.code || error.status || 'xəta') + ': ' + String(error.message || '').slice(0, 90) + ')');
  }
}
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
    setPersist(emailCtx.remember);
    setFlow({ mode: emailCtx.mode, via: 'email', name: emailCtx.name, program: emailCtx.program, remember: emailCtx.remember });
    const { data, error } = await sb.auth.verifyOtp({ email: emailCtx.email, token: code, type: 'email' });
    if (error || !data || !data.user) throw error || new Error('verify');
    if (user && user.uid === data.user.id) await handleFlow();   // eyni hesab: hadisə təkrar işə düşməyə bilər
  } catch (x) { clearFlow(); err.textContent = msg(x, 'Kod səhvdir və ya vaxtı bitib. Yenidən yoxlayın və ya yeni kod istəyin.'); f.code.select(); }
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
  try {
    setPersist(remember);
    setFlow({ mode, via: 'google', program: $id('program').value, name: $id('emailForm').name.value.trim(), remember });
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
    if (error) throw error;
    return;                                                // brauzer Google səhifəsinə yönləndirilir
  } catch (x) {
    clearFlow();
    err.textContent = /not enabled|Unsupported provider/i.test(x.message || '') ? 'Google girişi hələ aktiv deyil. E-poçt kodu ilə davam edin.' : 'Google ilə giriş alınmadı. Bir az sonra yenidən cəhd edin.';
    console.error('[RARE] Google giriş xətası', x);
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
  const ins = await sb.from('registrations').insert({ full_name: name, email: user.email.toLowerCase(), program, user_id: user.uid });
  if (ins.error) throw ins.error;
  if (name !== (profile && profile.fullName)) {
    try { await sb.from('profiles').update({ full_name: name, updated_at: new Date().toISOString() }).eq('id', user.uid); await loadProfile(); } catch (_) {}
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
        const q = await sb.from('registrations').select('status').eq('user_id', user.uid);
        if (q.error) throw q.error;
        if (!(q.data || []).some(d => d.status !== 'rejected')) {
          await sb.auth.signOut(); setMode('login'); showStep(1); $id('regErr').textContent = NO_REG;
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
    const up = await sb.from('profiles').update({ full_name: name, phone: phone || null, updated_at: new Date().toISOString() }).eq('id', user.uid);
    if (up.error) throw up.error;
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
  else if (a === 'logout' && ready) sb.auth.signOut().then(() => toast('Hesabdan çıxdınız.'));
  else if (a === 'cabinet') user ? openProfile() : openFlow('login');
});
document.querySelectorAll('[data-open="register"]').forEach(b => b.addEventListener('click', () => openFlow('register')));

/* ---- Sessiya ---- */
async function onSession(u) {
  const same = !!(u && user && u.uid === user.uid);
  user = u;
  const r = rawRem();
  if (u && r && r.until <= Date.now()) { clearRem(); await sb.auth.signOut(); return; }   // 90 gün bitdi
  if (!u) { profile = null; isAdmin = false; renderAuth(); return; }
  if (!same) { try { await loadProfile(); } catch (_) {} await checkAdmin(); }
  renderAuth(); await handleFlow();
}
if (ready) {
  let chain = Promise.resolve();
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED' || ev === 'PASSWORD_RECOVERY') return;
    setTimeout(() => { chain = chain.then(() => onSession(norm(session && session.user))).catch(e => console.error(e)); }, 0);
  });
}

/* ---- Xəbər abunəliyi ---- */
const legacySubmit = window.submitData;
window.submitData = async function (subject, fields) {
  if (!ready || !fields.Email) return legacySubmit(subject, fields);
  const email = fields.Email.trim().toLowerCase();
  const r = await sb.from('newsletter').insert({ email });
  if (r.error && r.error.code !== '23505') throw r.error;          // 23505 = artıq abunə olan e-poçt
  return 'sent';
};
