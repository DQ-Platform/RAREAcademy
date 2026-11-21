/* RARE Academy – Admin / CEO paneli. Giriş: e-poçt kodu (və ya Google). CEO_EMAIL avtomatik tam səlahiyyətlidir. */
import { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_ENABLED, CEO_EMAIL } from './supabase-config.js';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, a = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) n.append(c instanceof Node ? c : document.createTextNode(c == null ? '' : c));
  return n;
};
const STATUS = { new: 'Yeni', contacted: 'Əlaqə saxlanıldı', enrolled: 'Qəbul olundu', rejected: 'Ləğv edildi' };
const SEC = { home: 'Ana bölmə', programs: 'İstiqamətlər', how: 'Necə işləyir', exam: 'Sınaqlar', why: 'Niyə RARE Academy?', contact: 'Əlaqə və footer', page: 'Digər' };
const TAGN = { h2: 'Başlıq', h3: 'Alt başlıq', h4: 'Kiçik başlıq', p: 'Mətn', small: 'Qısa mətn' };
const TITLES = { dash: 'İdarə paneli', regs: 'Müraciətlər', users: 'İstifadəçilər', subs: 'Abunəçilər', site: 'Sayt idarəsi' };
const SLIDE_DEF = ['Biliklə daha güclü,\nhədəflərə *daha yaxın!*', 'Sınaqlarla *hazırlığını*\nreal imtahan formatında yoxla', 'Peşəkar müəllimlərlə\n*uğura* birlikdə!'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDT = d => d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
let tT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('show'), 3000); };
const okUrl = u => !u || /^https?:\/\//i.test(u);

function csv(name, head, rows) {
  const q = v => { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const text = '\ufeff' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })), download: name }); document.body.append(a); a.click(); a.remove();
}
function askText(title, val) {
  return new Promise(res => {
    const d = $('#noteDlg'); $('#noteTitle').textContent = title; $('#noteText').value = val || '';
    d.addEventListener('close', () => res(d.returnValue === 'ok' ? $('#noteText').value.trim() : null), { once: true });
    d.returnValue = ''; d.showModal();
  });
}
function table(head, rows, empty) {
  if (!rows.length) return h('div', { class: 'tw' }, h('div', { class: 'empty' }, empty));
  return h('div', { class: 'tw' }, h('table', {}, h('thead', {}, h('tr', {}, head.map(x => h('th', {}, x)))), h('tbody', {}, rows)));
}

const gate = (msg, denied) => { $('#gate').hidden = false; $('#app').hidden = true; $('#gMsg').textContent = msg || ''; $('#gOut').hidden = !denied; $('#gForms').hidden = !!denied; $('#gLogin').hidden = !!denied || !GOOGLE_ENABLED; };

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) gate('Supabase konfiqurasiyası doldurulmayıb (supabase-config.js).');
else {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const storage = {                                      // saytla eyni sessiya: harada saxlanıbsa, orada davam edir
    getItem: k => { try { const v = sessionStorage.getItem(k); return v !== null ? v : localStorage.getItem(k); } catch (e) { return null; } },
    setItem: k => k, removeItem: k => k };
  storage.setItem = (k, v) => { try { (sessionStorage.getItem(k) !== null ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} };
  storage.removeItem = k => { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) {} };
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  const S = { regs: [], users: [], subs: [], admins: new Map(), counts: {}, settings: {}, content: {}, texts: null };
  let me = null, role = null;
  const isCeo = () => role === 'ceo';
  const chk = r => { if (r.error) throw r.error; return r.data; };
  const mut = async q => { const d = chk(await q.select()); if (!d || !d.length) throw new Error('denied'); return d; };   // RLS səssiz rədd edərsə də xəta verir
  const tm = x => x ? new Date(x) : null;
  const nowIso = () => new Date().toISOString();

  /* ---------- Giriş ---------- */
  let otpEmail = '';
  $('#gForm').onsubmit = async e => {
    e.preventDefault(); const em = $('#gEmail').value.trim().toLowerCase(); $('#gMsg').textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return void ($('#gMsg').textContent = 'Düzgün e-poçt ünvanı daxil edin.');
    const b = $('#gSend'); b.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: true } });
    b.disabled = false;
    if (error) return void ($('#gMsg').textContent = error.status === 429 ? 'Çox tez-tez cəhd edildi. Bir az gözləyin.' : 'Kod göndərilmədi. Bir az sonra yenidən cəhd edin.');
    otpEmail = em; $('#gForm').hidden = true; $('#gCodeForm').hidden = false; $('#gMsg').textContent = 'Kod ' + em + ' ünvanına göndərildi.'; $('#gCode').focus();
  };
  $('#gCodeForm').onsubmit = async e => {
    e.preventDefault(); const code = $('#gCode').value.replace(/\D/g, ''); $('#gMsg').textContent = '';
    if (code.length !== 6) return void ($('#gMsg').textContent = '6 rəqəmli kodu daxil edin.');
    const b = $('#gVerify'); b.disabled = true;
    const { error } = await sb.auth.verifyOtp({ email: otpEmail, token: code, type: 'email' });
    b.disabled = false;
    if (error) $('#gMsg').textContent = 'Kod səhvdir və ya vaxtı bitib.';
  };
  $('#gBack').onclick = () => { $('#gCodeForm').hidden = true; $('#gForm').hidden = false; $('#gMsg').textContent = ''; };
  $('#gLogin').onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
    if (error) $('#gMsg').textContent = 'Google girişi alınmadı. E-poçt kodu ilə daxil olun.';
  };
  $('#gOut').onclick = $('#logout').onclick = () => sb.auth.signOut();

  async function onUser(u) {
    if (u && me && u.id === me.id && role) { me = u; return; }     // sekməyə qayıdanda təkrar yükləmə olmasın
    me = u; role = null;
    if (!u) return gate('');
    if ((u.email || '').toLowerCase() === CEO_EMAIL && u.email_confirmed_at) role = 'ceo';
    else { try { const r = await sb.from('admins').select('user_id').eq('user_id', u.id).maybeSingle(); if (r.data) role = 'admin'; } catch (e) {} }
    if (!role) return gate('Bu hesabın (' + u.email + ') admin icazəsi yoxdur.', true);
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#roleBadge').textContent = isCeo() ? 'CEO' : 'Admin'; $('#meMail').textContent = u.email;
    await loadAll();
  }
  let chain = Promise.resolve();
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED' || ev === 'PASSWORD_RECOVERY') return;
    setTimeout(() => { chain = chain.then(() => onUser(session && session.user)).catch(e => console.error(e)); }, 0);
  });

  /* ---------- Məlumat yükləmə ---------- */
  async function loadAll() {
    $('#refresh').disabled = true;
    try {
      const lim = t => sb.from(t).select('*').order('created_at', { ascending: false }).limit(1000);
      const cnt = t => sb.from(t).select('*', { count: 'exact', head: true });
      const res = await Promise.all([lim('registrations'), lim('profiles'), lim('newsletter'), sb.from('admins').select('*'), sb.from('site').select('doc,data'),
        cnt('registrations'), cnt('profiles'), cnt('newsletter')]);
      res.forEach(r => { if (r.error) throw r.error; });
      const [rs, us, ss, ad, st, cR, cU, cS] = res;
      S.regs = rs.data.map(r => ({ id: r.id, fullName: r.full_name, email: r.email, program: r.program, status: r.status, note: r.note || '', userId: r.user_id, _t: tm(r.created_at) }));
      S.users = us.data.map(u => ({ id: u.id, fullName: u.full_name, email: u.email, phone: u.phone, _t: tm(u.created_at) }));
      S.subs = ss.data.map(x => ({ id: x.email, email: x.email, _t: tm(x.created_at) }));
      S.admins = new Map(ad.data.map(x => [x.user_id, x]));
      const site = Object.fromEntries(st.data.map(x => [x.doc, x.data || {}]));
      S.settings = site.settings || {}; S.content = site.content || {};
      S.counts = { regs: cR.count, users: cU.count, subs: cS.count };
      renderAll();
    } catch (e) { console.error(e); toast('Məlumat yüklənmədi: ' + (e.code || e.message)); }
    $('#refresh').disabled = false;
  }
  $('#refresh').onclick = loadAll;

/* ---------- Naviqasiya ---------- */
  function go(tab) {
    $$('[id^="tab-"]').forEach(s => { s.hidden = s.id !== 'tab-' + tab; });
    $$('.nv').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#pageTitle').textContent = TITLES[tab]; $('#side').classList.remove('open');
    if (tab === 'site') loadTexts();
  }
  $$('.nv').forEach(b => b.onclick = () => go(b.dataset.tab));
  $('#menuBtn').onclick = () => $('#side').classList.toggle('open');

  /* ---------- İdarə paneli ---------- */
  const inDays = (arr, n) => { const t = Date.now() - n * 864e5; return arr.filter(x => x._t && x._t.getTime() >= t).length; };
  function renderDash() {
    const R = S.regs, by = k => R.filter(r => r.status === k).length;
    const total = S.counts.regs, enrolled = by('enrolled');
    const kpi = (l, v, s) => h('div', { class: 'kpi' }, h('span', {}, l), h('b', {}, v), h('small', {}, s || '\u00a0'));
    $('#kpis').replaceChildren(
      kpi('Ümumi istifadəçi', S.counts.users, `Son 30 gün: +${inDays(S.users, 30)}`),
      kpi('Müraciətlər', total, `Bu gün: ${inDays(R, 1)} · 7 gün: ${inDays(R, 7)}`),
      kpi('Yeni (gözləyən)', by('new'), 'Əlaqə saxlanmalıdır'),
      kpi('Qəbul olunanlar', enrolled, R.length ? `Konversiya: ${Math.round(enrolled / R.length * 100)}%` : ''),
      kpi('Abunəçilər', S.counts.subs, `Son 30 gün: +${inDays(S.subs, 30)}`),
      kpi('Adminlər', S.admins.size + 1, 'CEO daxil'));
    const days = [], m = new Map();
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); m.set(ymd(d), 0); }
    R.forEach(r => { if (r._t) { const k = ymd(r._t); if (m.has(k)) m.set(k, m.get(k) + 1); } });
    const max = Math.max(1, ...m.values());
    $('#chart30').replaceChildren(...days.map(d => h('i', { style: `height:${Math.max(2, m.get(ymd(d)) / max * 100)}%`, title: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}: ${m.get(ymd(d))}` })));
    $('#axis30').replaceChildren(...[0, 15, 29].map(i => h('span', {}, `${pad(days[i].getDate())}.${pad(days[i].getMonth() + 1)}`)));
    const hb = (label, v, mx, color) => h('div', { class: 'hbar' }, h('span', {}, label), h('div', { class: 't' }, h('i', { style: `width:${v / mx * 100}%${color ? ';background:' + color : ''}` })), h('em', {}, v));
    const pm = new Map(); R.forEach(r => pm.set(r.program || '—', (pm.get(r.program || '—') || 0) + 1));
    const pe = [...pm].sort((a, b) => b[1] - a[1]);
    $('#byProg').replaceChildren(...(pe.length ? pe.map(([k, v]) => hb(k, v, pe[0][1])) : [h('p', { class: 'mut' }, 'Hələ müraciət yoxdur.')]));
    const colors = { new: '#0042AC', contacted: '#00a6c8', enrolled: '#2e9e44', rejected: '#c62828' };
    $('#byStatus').replaceChildren(...Object.entries(STATUS).map(([k, l]) => hb(l, by(k), Math.max(1, R.length), colors[k])));
    $('#recent').replaceChildren(...(R.length ? R.slice(0, 6).map(r => h('div', { class: 'hbar', style: 'grid-template-columns:1fr auto' }, h('span', {}, `${r.fullName} · ${r.program}`), h('em', { class: 'mut', style: 'font-weight:400' }, fmtDT(r._t)))) : [h('p', { class: 'mut' }, 'Hələ müraciət yoxdur.')]));
    $('#limitNote').textContent = total > R.length ? `Qeyd: cədvəl və qrafiklər ən son ${R.length} müraciətə əsaslanır (cəmi ${total}).` : '';
  }

  /* ---------- Müraciətlər ---------- */
  function renderRegs() {
    const q = $('#rQ').value.trim().toLowerCase(), st = $('#rS').value, pg = $('#rP').value;
    const list = S.regs.filter(r => (!st || r.status === st) && (!pg || r.program === pg) &&
      (!q || [r.fullName, r.email, r.program, r.note].join(' ').toLowerCase().includes(q)));
    S.regsView = list;
    const trs = list.map(r => h('tr', {},
      h('td', { class: 'mut' }, fmtDT(r._t)), h('td', {}, h('b', {}, r.fullName)), h('td', {}, r.email), h('td', {}, r.program),
      h('td', {}, (() => { const s = h('select', { onchange: async e => {
        try { await mut(sb.from('registrations').update({ status: e.target.value, updated_at: nowIso() }).eq('id', r.id)); r.status = e.target.value; renderDash(); toast('Status yeniləndi.'); }
        catch (x) { e.target.value = r.status; toast('Yenilənmədi.'); } } },
        Object.entries(STATUS).map(([k, l]) => h('option', { value: k }, l))); s.value = r.status; return s; })()),
      h('td', {}, h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
        const v = await askText('Qeyd – ' + r.fullName, r.note); if (v === null) return;
        try { await mut(sb.from('registrations').update({ note: v, updated_at: nowIso() }).eq('id', r.id)); r.note = v; renderRegs(); toast('Qeyd saxlanıldı.'); } catch (x) { toast('Saxlanılmadı.'); } } }, r.note ? '✎ ' + (r.note.length > 22 ? r.note.slice(0, 22) + '…' : r.note) : '+ Qeyd')),
      h('td', {}, h('button', { class: 'btn red sm', type: 'button', onclick: async () => {
        if (!confirm(`“${r.fullName}” müraciəti silinsin?`)) return;
        try { await mut(sb.from('registrations').delete().eq('id', r.id)); S.regs = S.regs.filter(x => x !== r); S.counts.regs--; renderAll(); toast('Silindi.'); } catch (x) { toast('Silinmədi.'); } } }, 'Sil'))));
    $('#regsT').replaceChildren(table(['Tarix', 'Ad soyad', 'Gmail', 'İstiqamət', 'Status', 'Qeyd', ''], trs, 'Müraciət tapılmadı.'));
  }
  $('#rS').replaceChildren(h('option', { value: '' }, 'Bütün statuslar'), ...Object.entries(STATUS).map(([k, l]) => h('option', { value: k }, l)));
  ['rQ', 'rS', 'rP'].forEach(i => $('#' + i).addEventListener('input', renderRegs));
  $('#rCsv').onclick = () => csv('muracietler.csv', ['Tarix', 'Ad soyad', 'Gmail', 'İstiqamət', 'Status', 'Qeyd'],
    (S.regsView || S.regs).map(r => [fmtDT(r._t), r.fullName, r.email, r.program, STATUS[r.status] || r.status, r.note || '']));

  /* ---------- İstifadəçilər ---------- */
  const roleOf = u => (u.email || '').toLowerCase() === CEO_EMAIL ? 'ceo' : S.admins.has(u.id) ? 'admin' : 'student';
  function renderUsers() {
    const q = $('#uQ').value.trim().toLowerCase(), rf = $('#uR').value;
    const list = S.users.filter(u => (!q || [u.fullName, u.email].join(' ').toLowerCase().includes(q)) && (!rf || roleOf(u) !== 'student'));
    S.usersView = list;
    $('#uNote').textContent = isCeo() ? 'Siz CEO-sunuz: istifadəçini admin edə və ya adminlikdən çıxara bilərsiniz.' : 'Adminləri yalnız CEO idarə edə bilər.';
    const trs = list.map(u => { const r = roleOf(u);
      return h('tr', {}, h('td', {}, h('b', {}, u.fullName || '—')), h('td', {}, u.email), h('td', {}, u.phone || '—'),
        h('td', {}, h('span', { class: 'st ' + r }, r === 'ceo' ? 'CEO' : r === 'admin' ? 'Admin' : 'Tələbə')), h('td', { class: 'mut' }, fmtDT(u._t)),
        h('td', {}, isCeo() && r !== 'ceo' ? h('button', { class: r === 'admin' ? 'btn red sm' : 'btn ghost sm', type: 'button', onclick: async () => {
          try {
            if (r === 'admin') { await mut(sb.from('admins').delete().eq('user_id', u.id)); S.admins.delete(u.id); }
            else { const d = { user_id: u.id, email: u.email, name: u.fullName || null, added_by: me.email }; await mut(sb.from('admins').insert(d)); S.admins.set(u.id, d); }
            renderUsers(); renderDash(); toast('Rol yeniləndi.');
          } catch (x) { toast('Dəyişmək alınmadı.'); } } }, r === 'admin' ? 'Adminlikdən çıxar' : 'Admin et') : ''));
    });
    $('#usersT').replaceChildren(table(['Ad soyad', 'Gmail', 'Telefon', 'Rol', 'Qeydiyyat', ''], trs, 'İstifadəçi tapılmadı.'));
  }
  ['uQ', 'uR'].forEach(i => $('#' + i).addEventListener('input', renderUsers));
  $('#uCsv').onclick = () => csv('istifadeciler.csv', ['Ad soyad', 'Gmail', 'Telefon', 'Rol', 'Tarix'],
    (S.usersView || S.users).map(u => [u.fullName, u.email, u.phone, roleOf(u), fmtDT(u._t)]));

  /* ---------- Abunəçilər ---------- */
  function renderSubs() {
    const q = $('#sQ').value.trim().toLowerCase(); const list = S.subs.filter(s => !q || (s.email || '').includes(q)); S.subsView = list;
    $('#subsT').replaceChildren(table(['E-poçt', 'Tarix', ''], list.map(s => h('tr', {}, h('td', {}, s.email), h('td', { class: 'mut' }, fmtDT(s._t)),
      h('td', {}, h('button', { class: 'btn red sm', type: 'button', onclick: async () => {
        if (!confirm(s.email + ' abunəliyi silinsin?')) return;
        try { await mut(sb.from('newsletter').delete().eq('email', s.id)); S.subs = S.subs.filter(x => x !== s); S.counts.subs--; renderAll(); toast('Silindi.'); } catch (x) { toast('Silinmədi.'); } } }, 'Sil')))), 'Abunəçi yoxdur.'));
  }
  $('#sQ').addEventListener('input', renderSubs);
  $('#sCsv').onclick = () => csv('abuneler.csv', ['E-poçt', 'Tarix'], (S.subsView || S.subs).map(s => [s.email, fmtDT(s._t)]));
  $('#sCopy').onclick = async () => { try { await navigator.clipboard.writeText((S.subsView || S.subs).map(s => s.email).join(', ')); toast('E-poçtlar kopyalandı.'); } catch (e) { toast('Kopyalamaq alınmadı.'); } };

  /* ---------- Sayt idarəsi ---------- */
  const val = id => $('#' + id).value.trim();
  function fillSite() {
    const s = S.settings;
    ['phone', 'whatsapp', 'email', 'telegramUrl', 'youtubeUrl', 'instagramUrl', 'examUrl', 'videoUrl'].forEach(k => { $('#s_' + k).value = s[k] || ''; });
    $('#s_annOn').checked = !!(s.announcement && s.announcement.on); $('#s_annText').value = (s.announcement && s.announcement.text) || '';
    $('#s_regOpen').checked = s.registrationOpen !== false; $('#s_programs').value = (s.programs || []).join('\n');
    if (!$('#slidesF').children.length) $('#slidesF').replaceChildren(...[0, 1, 2].flatMap(i => [
      h('label', { class: 'f' }, `Slayd ${i + 1} – başlıq`, h('textarea', { id: 's_t' + i, rows: 3, placeholder: SLIDE_DEF[i] })),
      h('label', { class: 'f' }, `Slayd ${i + 1} – alt mətn`, h('textarea', { id: 's_s' + i, rows: 3 }))]));
    [0, 1, 2].forEach(i => { const x = (s.slides || [])[i] || {}; $('#s_t' + i).value = x.t || ''; $('#s_s' + i).value = x.s || ''; });
  }
  async function saveSettings(obj, ok) {
    try { const merged = { ...S.settings, ...obj }; chk(await sb.from('site').upsert({ doc: 'settings', data: merged, updated_at: nowIso() }, { onConflict: 'doc' })); S.settings = merged; toast(ok); }
    catch (e) { toast('Saxlamaq alınmadı: ' + (e.code || '')); }
  }
  async function loadTexts() {
    if (!S.texts) {
      try {
        const html = await (await fetch('index.html', { cache: 'no-cache' })).text();
        const d = new DOMParser().parseFromString(html, 'text/html');
        S.texts = $$('[data-cms]', d).map(n => ({ key: n.dataset.cms, tag: n.tagName.toLowerCase(), def: n.textContent.trim() }));
      } catch (e) { S.texts = []; }
    }
    renderTexts();
  }
  function renderTexts() {
    const q = $('#tQ').value.trim().toLowerCase(), box = $('#textsF');
    const keep = {}; $$('textarea[data-key]', box).forEach(t => { keep[t.dataset.key] = t.value; });
    const list = S.texts.filter(t => !q || t.def.toLowerCase().includes(q) || (keep[t.key] || S.content[t.key] || '').toLowerCase().includes(q));
    box.replaceChildren(...(list.length ? list.map(t => {
      const ta = h('textarea', { 'data-key': t.key, rows: t.def.length > 90 ? 3 : 1, placeholder: t.def }); ta.value = t.key in keep ? keep[t.key] : (S.content[t.key] || '');
      return h('div', { class: 'txt' }, h('label', {}, `${SEC[t.key.split('-')[0]] || 'Digər'} · ${TAGN[t.tag] || t.tag}`), ta);
    }) : [h('div', { class: 'empty' }, 'Mətn tapılmadı.')]));
  }
  $('#tQ').addEventListener('input', renderTexts);
  $$('[data-save]').forEach(b => b.onclick = async () => {
    const k = b.dataset.save;
    if (k === 'contact') {
      const o = {}; ['phone', 'whatsapp', 'email', 'telegramUrl', 'youtubeUrl', 'instagramUrl', 'examUrl', 'videoUrl'].forEach(x => { o[x] = val('s_' + x); });
      if (![o.telegramUrl, o.youtubeUrl, o.instagramUrl, o.examUrl, o.videoUrl].every(okUrl)) return toast('Linklər http:// və ya https:// ilə başlamalıdır.');
      saveSettings(o, 'Əlaqə məlumatları saxlanıldı.');
    } else if (k === 'reg') {
      saveSettings({ announcement: { on: $('#s_annOn').checked, text: val('s_annText') }, registrationOpen: $('#s_regOpen').checked,
        programs: $('#s_programs').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30) }, 'Yadda saxlanıldı.');
    } else if (k === 'slides') {
      saveSettings({ slides: [0, 1, 2].map(i => ({ t: val('s_t' + i), s: val('s_s' + i) })) }, 'Sloqanlar saxlanıldı.');
    } else if (k === 'texts') {
      const all = {}; const cur = {}; $$('textarea[data-key]', $('#textsF')).forEach(t => { cur[t.dataset.key] = t.value.trim(); });
      S.texts.forEach(t => { const v = t.key in cur ? cur[t.key] : (S.content[t.key] || ''); if (v && v !== t.def) all[t.key] = v; });
      try { chk(await sb.from('site').upsert({ doc: 'content', data: all, updated_at: nowIso() }, { onConflict: 'doc' })); S.content = all; toast('Mətnlər saxlanıldı.'); } catch (e) { toast('Saxlamaq alınmadı: ' + (e.code || '')); }
    }
  });

  function renderAll() {
    $('#rP').replaceChildren(h('option', { value: '' }, 'Bütün istiqamətlər'), ...[...new Set(S.regs.map(r => r.program).filter(Boolean))].sort().map(p => h('option', { value: p }, p)));
    renderDash(); renderRegs(); renderUsers(); renderSubs(); fillSite();
  }
}
