'use strict';
/* ===== Sayt parametrləri: boş qalan link kliklənəndə "tezliklə" bildirişi göstərilir ===== */
const CONFIG = {
  examUrl: '',        // Sınaq platformasının ünvanı, məs: 'https://exam.rareacademy.az'
  cabinetUrl: '',     // Şəxsi kabinet ünvanı
  telegramUrl: '',    // https://t.me/...
  youtubeUrl: '',     // https://youtube.com/@...
  instagramUrl: '',   // https://instagram.com/...
  videoUrl: '',       // YouTube embed (https://www.youtube.com/embed/ID) və ya .mp4 faylı
  contactEmail: 'info@rareacademy.az',
  formEndpoint: ''    // Formspree və s.: boşdursa məlumat email proqramı ilə göndərilir
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Bildiriş */
const toastEl = $('#toast'); let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3200); }

/* Xarici linklər */
const linkMap = { exam: CONFIG.examUrl, cabinet: CONFIG.cabinetUrl, telegram: CONFIG.telegramUrl, youtube: CONFIG.youtubeUrl, instagram: CONFIG.instagramUrl };
$$('[data-link]').forEach(a => {
  const url = linkMap[a.dataset.link];
  if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  else a.addEventListener('click', e => { e.preventDefault(); toast('Bu bölmə tezliklə aktiv olacaq.'); });
});

/* Slayder */
const slides = [
  ['Biliklə daha güclü,<br>hədəflərə <em>daha yaxın!</em>', 'Peşəkar tədris, innovativ yanaşma və uğura aparan düzgün istiqamət – hamısı bir platformada!'],
  ['Sınaqlarla <em>hazırlığını</em><br>real imtahan formatında yoxla', 'Hər mövzu üzrə təhlil, nəticə və fərdi inkişaf planı.'],
  ['Peşəkar müəllimlərlə<br><em>uğura</em> birlikdə!', 'Dövlət qulluğundan magistraturaya qədər 9 istiqamət.']
];
const hero = $('#home'), title = $('#slideTitle'), text = $('#slideText');
let si = 0, timer, paused = false;
function show(i) {
  si = (i + slides.length) % slides.length;
  const apply = () => { title.innerHTML = slides[si][0]; text.textContent = slides[si][1]; hero.classList.remove('fade'); };
  if (reduce) return apply();
  hero.classList.add('fade'); setTimeout(apply, 300);
}
function start() { clearInterval(timer); if (!reduce) timer = setInterval(() => { if (!paused && !document.hidden) show(si + 1); }, 7000); }
$('.arrow.l').onclick = () => { show(si - 1); start(); };
$('.arrow.r').onclick = () => { show(si + 1); start(); };
hero.addEventListener('mouseenter', () => paused = true); hero.addEventListener('mouseleave', () => paused = false);
hero.addEventListener('focusin', () => paused = true); hero.addEventListener('focusout', () => paused = false);
start();

/* Rəqəm animasiyası */
$$('[data-n]').forEach(el => {
  const n = +el.dataset.n, s = el.dataset.s || '';
  const fmt = v => Math.round(v).toLocaleString('en-US').replace(/,/g, '.') + s;
  if (reduce || !('IntersectionObserver' in window)) return;
  el.textContent = fmt(0);
  new IntersectionObserver((e, o) => {
    if (!e[0].isIntersecting) return; o.disconnect();
    const st = performance.now();
    (function f(now) { const p = Math.min((now - st) / 1400, 1); el.textContent = fmt(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(st);
  }).observe(el);
});

/* Dekorativ taymer (yalnız ekranda görünəndə işləyir) */
const tm = $('#timer'); let sec = 29 * 60 + 45;
if (tm && !reduce) {
  setInterval(() => {
    if (document.hidden) return;
    sec = sec > 0 ? sec - 1 : 29 * 60 + 45;
    tm.textContent = '00:' + String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }, 1000);
}

/* Menyu */
const burger = $('.burger'), menu = $('#menu');
const closeMenu = () => { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Menyunu aç'); $$('.dd', menu).forEach(d => { d.classList.remove('open'); $('button', d).setAttribute('aria-expanded', 'false'); }); };
burger.onclick = () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); burger.setAttribute('aria-label', o ? 'Menyunu bağla' : 'Menyunu aç'); };
$$('.dd > button', menu).forEach(b => b.onclick = e => {
  e.stopPropagation();
  const dd = b.parentElement, o = !dd.classList.contains('open');
  $$('.dd', menu).forEach(d => { d.classList.remove('open'); $('button', d).setAttribute('aria-expanded', 'false'); });
  dd.classList.toggle('open', o); b.setAttribute('aria-expanded', o);
});
$$('a', menu).forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('click', e => { if (!e.target.closest('.nav')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

/* Aktiv menyu bəndi */
const navLinks = $$('.menu > li > a[href^="#"]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['home', 'exam', 'contact'].forEach(id => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* Dialoqlar */
function openDialog(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
function closeDialog(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
$$('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) closeDialog(d); });
  d.addEventListener('close', () => { const vb = $('#vbox'); if (d.id === 'video') vb.innerHTML = ''; });
});
$$('[data-open]').forEach(b => b.addEventListener('click', () => {
  closeMenu();
  if (b.dataset.open === 'video') {
    if (!CONFIG.videoUrl) return toast('Təqdimat videosu tezliklə əlavə olunacaq.');
    $('#vbox').innerHTML = /\.mp4($|\?)/i.test(CONFIG.videoUrl)
      ? `<video src="${CONFIG.videoUrl}" controls autoplay playsinline></video>`
      : `<iframe src="${CONFIG.videoUrl}" title="Təqdimat videosu" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  }
  if (b.dataset.program) $('#program').value = b.dataset.program;
  openDialog($('#' + b.dataset.open));
}));

/* Göndərmə (endpoint varsa fetch, yoxsa email proqramı) */
async function submitData(subject, fields) {
  if (CONFIG.formEndpoint) {
    const r = await fetch(CONFIG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ subject, ...fields }) });
    if (!r.ok) throw new Error('send');
    return 'sent';
  }
  const body = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
  location.href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return 'mailto';
}
const phoneOk = v => v.replace(/\D/g, '').length >= 9;

$('#regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('#regErr'), name = f.name, phone = f.phone;
  [name, phone].forEach(i => i.removeAttribute('aria-invalid')); err.textContent = '';
  if (name.value.trim().length < 3) { name.setAttribute('aria-invalid', 'true'); err.textContent = 'Ad və soyadı daxil edin.'; return name.focus(); }
  if (!phoneOk(phone.value)) { phone.setAttribute('aria-invalid', 'true'); err.textContent = 'Düzgün mobil nömrə daxil edin.'; return phone.focus(); }
  const btn = $('button[type=submit]', f); btn.disabled = true;
  try {
    const mode = await submitData('RARE Academy – yeni qeydiyyat', { Ad: name.value.trim(), Telefon: phone.value.trim(), İstiqamət: f.program.value || 'Seçilməyib' });
    closeDialog($('#register')); f.reset();
    toast(mode === 'sent' ? 'Müraciətiniz qəbul olundu. Tezliklə sizinlə əlaqə saxlayacağıq.' : 'Email proqramınız açıldı – mesajı göndərin.');
  } catch { err.textContent = 'Göndərmək alınmadı. Zəhmət olmasa 050 430 51 62 nömrəsinə zəng edin.'; }
  btn.disabled = false;
});

/* Xəbər abunəliyi */
$('#newsletter').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, msg = $('#newsMsg'), em = f.email.value.trim();
  msg.className = '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { msg.classList.add('bad'); msg.textContent = 'Düzgün email ünvanı daxil edin.'; return f.email.focus(); }
  try { const mode = await submitData('RARE Academy – xəbər abunəliyi', { Email: em }); msg.textContent = mode === 'sent' ? 'Abunə olduğunuz üçün təşəkkürlər!' : 'Email proqramınız açıldı – mesajı göndərin.'; f.reset(); }
  catch { msg.classList.add('bad'); msg.textContent = 'Xəta baş verdi, bir az sonra yenidən cəhd edin.'; }
});

$('#year').textContent = new Date().getFullYear();

;(function(){try{
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var els=document.querySelectorAll('.sec-head,.cards li,.why-in>div,.why-grid li,.exam-in>*,.foot>div');
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  els.forEach(function(el,i){el.classList.add('rv');el.style.transitionDelay=((i%5)*70)+'ms';io.observe(el)});
}catch(e){}})();
