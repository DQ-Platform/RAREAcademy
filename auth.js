/* =====================================================================
   RARE Academy – mərkəzi baza (Firebase Firestore) + "Google ilə davam et"
   Quraşdırma: SETUP.md. Konfiqurasiya dəyərləri ictimaidir (təhlükəsizliyi firestore.rules təmin edir).
   Firebase konsolu → Project settings → Your apps → Web app → firebaseConfig
   ===================================================================== */
const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',      // məs: 'rare-academy.firebaseapp.com'
  projectId: '',
  appId: ''
};
const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';

const ready = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
const el = id => document.getElementById(id);
const phoneOk = v => String(v).replace(/\D/g, '').length >= 9;
let user = null, profile = null, A = null, F = null, auth = null, db = null;

if (!ready) console.info('[RARE] Mərkəzi baza qoşulmayıb (auth.js → FIREBASE_CONFIG). Köhnə rejim işləyir.');
else {
  const [app, au, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  A = au; F = fs;
  const fbApp = app.initializeApp(FIREBASE_CONFIG);
  auth = A.getAuth(fbApp); auth.languageCode = 'az';
  db = F.getFirestore(fbApp);
}

const fullName = () => (profile && profile.fullName) || (user && (user.displayName || user.email)) || '';
const firstName = () => fullName().split(/\s+/)[0] || '';
const avatarUrl = () => (user && user.photoURL) || '';

/* ---- Görünüş ---- */
function renderAuth() {
  const inLi = el('acctIn'), menuLi = el('acctMenu');
  if (!inLi || !menuLi) return;
  inLi.hidden = !!user; menuLi.hidden = !user;
  if (!user) return;
  el('acctName').textContent = firstName();
  const av = el('acctAv'), url = avatarUrl(); av.textContent = '';
  if (/^https:\/\//.test(url)) {
    const img = document.createElement('img');
    img.src = url; img.alt = ''; img.referrerPolicy = 'no-referrer'; img.width = img.height = 30;
    av.appendChild(img);
  } else av.textContent = (firstName()[0] || '?').toUpperCase();
}

async function loadProfile() {
  const ref = F.doc(db, 'users', user.uid);
  let snap = await F.getDoc(ref);
  if (!snap.exists()) {                                   // ilk giriş → profil yaradılır
    await F.setDoc(ref, {
      email: user.email || '', fullName: user.displayName || null, phone: null,
      photoURL: user.photoURL || null, role: 'student',
      createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp()
    });
    snap = await F.getDoc(ref);
  }
  profile = snap.data();
}

/* ---- Giriş / çıxış ---- */
function openLogin() {
  if (!ready) return toast('Giriş sistemi tezliklə aktiv olacaq.');
  el('loginErr').textContent = '';
  openDialog(el('login'));
}
async function googleLogin() {
  const btn = el('googleBtn'), err = el('loginErr'); err.textContent = ''; btn.disabled = true;
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    sessionStorage.setItem('rare_login', '1');
    await A.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      try { return await A.signInWithRedirect(auth, provider); } catch (_) {}
    }
    sessionStorage.removeItem('rare_login');
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request')
      err.textContent = e.code === 'auth/unauthorized-domain'
        ? 'Bu domen Firebase-də icazəli deyil (Authorized domains).'
        : 'Google ilə giriş alınmadı. Bir az sonra yenidən cəhd edin.';
  }
  btn.disabled = false;
}
async function logout() { await A.signOut(auth); toast('Hesabdan çıxdınız.'); }

/* ---- Profil ---- */
function openProfile() {
  if (!user) return openLogin();
  const f = el('profileForm');
  f.name.value = fullName() === user.email ? '' : fullName();
  f.phone.value = (profile && profile.phone) || '';
  el('profEmail').textContent = user.email || '';
  el('profErr').textContent = '';
  openDialog(el('profile'));
}
async function saveProfile(e) {
  e.preventDefault();
  const f = e.target, err = el('profErr'), name = f.name.value.trim(), phone = f.phone.value.trim();
  err.textContent = '';
  if (name.length < 3) { err.textContent = 'Ad və soyadı daxil edin.'; return f.name.focus(); }
  if (phone && !phoneOk(phone)) { err.textContent = 'Düzgün mobil nömrə daxil edin.'; return f.phone.focus(); }
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    await F.updateDoc(F.doc(db, 'users', user.uid), { fullName: name, phone: phone || null, updatedAt: F.serverTimestamp() });
    await loadProfile(); renderAuth(); closeDialog(el('profile')); toast('Profil yeniləndi.');
  } catch (_) { err.textContent = 'Yadda saxlamaq alınmadı. Yenidən cəhd edin.'; }
  btn.disabled = false;
}

/* ---- Düymələr ---- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-auth]'); if (!b) return;
  e.preventDefault();
  const a = b.dataset.auth;
  if (a === 'login') openLogin();
  else if (a === 'profile') openProfile();
  else if (a === 'logout' && ready) logout();
  else if (a === 'cabinet') user ? openProfile() : openLogin();
});
if (el('googleBtn')) el('googleBtn').addEventListener('click', googleLogin);
if (el('profileForm')) el('profileForm').addEventListener('submit', saveProfile);

/* ---- Sessiya ---- */
if (ready) {
  A.onAuthStateChanged(auth, async u => {
    user = u; renderAuth();
    if (!u) { profile = null; return; }
    try { await loadProfile(); } catch (_) {}
    renderAuth();
    if (sessionStorage.getItem('rare_login')) {
      sessionStorage.removeItem('rare_login'); closeDialog(el('login')); el('googleBtn').disabled = false;
      toast('Xoş gəldiniz, ' + firstName() + '!');
    }
  });
}

/* ---- Formlar → mərkəzi baza ---- */
const legacySubmit = window.submitData;
window.submitData = async function (subject, fields) {
  if (!ready) return legacySubmit(subject, fields);
  if (fields.Email) {                                     // xəbər abunəliyi
    const email = fields.Email.trim().toLowerCase();
    try { await F.setDoc(F.doc(db, 'newsletter', email), { email, createdAt: F.serverTimestamp() }); }
    catch (e) { if (e.code !== 'permission-denied') throw e; }   // artıq abunə olan e-poçt təkrar yazıla bilmir
    return 'sent';
  }
  const prog = fields['İstiqamət'];                       // qeydiyyat müraciəti
  await F.addDoc(F.collection(db, 'registrations'), {
    fullName: fields.Ad, phone: fields.Telefon,
    program: prog && prog !== 'Seçilməyib' ? prog : null,
    source: 'website', status: 'new', userId: user ? user.uid : null,
    createdAt: F.serverTimestamp()
  });
  return 'sent';
};
document.querySelectorAll('[data-open="register"]').forEach(b => b.addEventListener('click', () => {
  const f = el('regForm'); if (!f || !user) return;
  if (!f.name.value) f.name.value = fullName() === user.email ? '' : fullName();
  if (!f.phone.value && profile && profile.phone) f.phone.value = profile.phone;
}));
