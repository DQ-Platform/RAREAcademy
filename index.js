/* RARE Academy – e-poçt təsdiq kodu (6 rəqəm).
   sendEmailCode  → kod yaradır, hash-ini Firestore-da (yalnız server) saxlayır, e-poçtla göndərir
   verifyEmailCode → kodu yoxlayır, Firebase hesabı yaradır/tapır və giriş tokeni qaytarır */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');
const REGION = 'europe-west1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TTL = 10 * 60 * 1000, RESEND = 60 * 1000, WINDOW = 60 * 60 * 1000, MAX_SENDS = 5, MAX_TRIES = 5;
const docRef = email => db.collection('emailCodes').doc(crypto.createHash('sha256').update(email).digest('hex'));
const hashCode = (code, salt) => crypto.createHash('sha256').update(salt + ':' + code).digest('hex');
const cleanEmail = v => {
  const e = String(v || '').trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new HttpsError('invalid-argument', 'Düzgün e-poçt ünvanı daxil edin.');
  return e;
};

const normName = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim();
async function hasActiveRegistration(email, name) {
  const snap = await db.collection('registrations').where('email', '==', email).get();
  const n = normName(name);
  return snap.docs.some(d => { const r = d.data(); return r.status !== 'rejected' && normName(r.fullName) === n; });
}

async function sendMail(to, code) {
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() } });
  await t.sendMail({
    from: `"RARE Academy" <${SMTP_USER.value()}>`, to,
    subject: `RARE Academy təsdiq kodu: ${code}`,
    text: `Təsdiq kodunuz: ${code}\nKod 10 dəqiqə ərzində etibarlıdır. Bu kodu siz istəməmisinizsə, məktubu nəzərə almayın.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e3e9f5;border-radius:12px">
      <h2 style="color:#0042AC;margin:0 0 12px">RARE Academy</h2>
      <p>Təsdiq kodunuz:</p>
      <p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:8px 0">${code}</p>
      <p style="color:#555">Kod 10 dəqiqə ərzində etibarlıdır. Bu kodu siz istəməmisinizsə, məktubu nəzərə almayın.</p></div>`
  });
}

exports.sendEmailCode = onCall({ region: REGION, secrets: [SMTP_USER, SMTP_PASS], maxInstances: 5 }, async req => {
  const email = cleanEmail(req.data && req.data.email);
  if (req.data && req.data.mode === 'login' && !(await hasActiveRegistration(email, req.data.name)))
    throw new HttpsError('not-found', 'Sizin aktiv qeydiyyatınız yoxdur. Ad, soyad və Gmail qeydiyyatdakı kimi yazılmalıdır, ya da əvvəlcə qeydiyyatdan keçin.');
  const ref = docRef(email), now = Date.now();
  const code = String(crypto.randomInt(100000, 1000000)), salt = crypto.randomBytes(8).toString('hex');
  await db.runTransaction(async tx => {
    const s = await tx.get(ref), d = s.exists ? s.data() : {};
    if (d.sentAt && now - d.sentAt < RESEND) throw new HttpsError('resource-exhausted', 'Kodu yenidən göndərmək üçün bir az gözləyin.');
    const inWindow = d.windowStart && now - d.windowStart < WINDOW, sends = inWindow ? (d.sends || 0) : 0;
    if (sends >= MAX_SENDS) throw new HttpsError('resource-exhausted', 'Çox sayda cəhd edildi. Bir saatdan sonra yenidən cəhd edin.');
    tx.set(ref, { hash: hashCode(code, salt), salt, expiresAt: now + TTL, tries: 0, sentAt: now,
      windowStart: inWindow ? d.windowStart : now, sends: sends + 1 });
  });
  try { await sendMail(email, code); }
  catch (e) { logger.error('mail failed', e); throw new HttpsError('internal', 'E-poçt göndərilmədi. Bir az sonra yenidən cəhd edin.'); }
  return { ok: true };
});

exports.verifyEmailCode = onCall({ region: REGION, maxInstances: 5 }, async req => {
  const email = cleanEmail(req.data && req.data.email);
  const code = String((req.data && req.data.code) || '').trim();
  const name = String((req.data && req.data.name) || '').trim().slice(0, 120);
  if (!/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', '6 rəqəmli kodu daxil edin.');
  const ref = docRef(email);
  const st = await db.runTransaction(async tx => {
    const s = await tx.get(ref); if (!s.exists) return 'missing';
    const d = s.data();
    if (Date.now() > d.expiresAt || d.tries >= MAX_TRIES) { tx.delete(ref); return 'expired'; }
    const a = Buffer.from(hashCode(code, d.salt)), b = Buffer.from(d.hash);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { tx.update(ref, { tries: d.tries + 1 }); return 'wrong'; }
    tx.delete(ref); return 'ok';
  });
  if (st === 'missing' || st === 'expired') throw new HttpsError('failed-precondition', 'Kodun vaxtı bitib. Yeni kod istəyin.');
  if (st === 'wrong') throw new HttpsError('permission-denied', 'Kod səhvdir. Yenidən yoxlayın.');
  try {
    let u;
    try { u = await admin.auth().getUserByEmail(email); }
    catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      u = await admin.auth().createUser({ email, emailVerified: true, displayName: name.length >= 3 ? name : undefined });
    }
    if (!u.emailVerified) await admin.auth().updateUser(u.uid, { emailVerified: true });
    return { token: await admin.auth().createCustomToken(u.uid) };
  } catch (e) { logger.error('verify failed', e); throw new HttpsError('internal', 'Təsdiq alınmadı. Yenidən cəhd edin.'); }
});
