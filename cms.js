/* Admin panelində edilən dəyişiklikləri (Supabase: site cədvəli – settings, content) sayta tətbiq edir. */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTitle = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\r?\n/g, '<br>');
const okUrl = u => /^https?:\/\//i.test(u || '');
const telHref = p => { const d = String(p).replace(/\D/g, ''); return d ? 'tel:+' + (d.startsWith('994') ? d : d.startsWith('0') ? '994' + d.slice(1) : d) : ''; };

export async function applySite(sb) {
  try {
    const r = await sb.from('site').select('doc,data'); if (r.error) throw r.error;
    const m = Object.fromEntries((r.data || []).map(x => [x.doc, x.data || {}]));
    const st = m.settings || {}, ct = m.content || {};
    window.RARE_SETTINGS = st;

    document.querySelectorAll('[data-cms]').forEach(n => { const v = ct[n.dataset.cms]; if (typeof v === 'string' && v.trim()) n.textContent = v; });

    if (typeof CONFIG !== 'undefined') {
      if (okUrl(st.videoUrl)) CONFIG.videoUrl = st.videoUrl;
      if (st.email) CONFIG.contactEmail = st.email;
      if (st.whatsapp) CONFIG.whatsappNumber = String(st.whatsapp).replace(/\D/g, '');
    }
    if (st.phone && telHref(st.phone)) document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      a.href = telHref(st.phone);
      const t = [...a.childNodes].reverse().find(x => x.nodeType === 3 && x.textContent.trim()); if (t) t.textContent = st.phone;
    });

    const links = { telegram: st.telegramUrl, youtube: st.youtubeUrl, instagram: st.instagramUrl, exam: st.examUrl };
    document.querySelectorAll('[data-link]').forEach(a => { const u = links[a.dataset.link]; if (okUrl(u)) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
    document.addEventListener('click', e => {                       // köhnə "tezliklə" bildirişini əvəz edir
      const a = e.target.closest('[data-link]'); if (!a || !okUrl(links[a.dataset.link])) return;
      e.preventDefault(); e.stopImmediatePropagation(); window.open(links[a.dataset.link], '_blank', 'noopener,noreferrer');
    }, true);

    if (Array.isArray(st.programs) && st.programs.some(p => String(p).trim())) ['program', 'confirmProgram'].forEach(id => {
      const sel = document.getElementById(id); if (!sel) return; const cur = sel.value;
      sel.replaceChildren(new Option('Seçin', ''));
      st.programs.forEach(p => { p = String(p).trim(); if (p) sel.append(new Option(p, p)); });
      sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
    });

    if (Array.isArray(st.slides) && typeof slides !== 'undefined') {
      st.slides.forEach((x, i) => { if (x && slides[i]) { if (x.t && x.t.trim()) slides[i][0] = fmtTitle(x.t.trim()); if (x.s && x.s.trim()) slides[i][1] = x.s.trim(); } });
      try { show(si); } catch (e) {}
    }

    const an = st.announcement;
    if (an && an.on && String(an.text || '').trim() && !sessionStorage.getItem('rare_annc_x')) {
      const bar = document.createElement('div'); bar.className = 'annc'; bar.setAttribute('role', 'status');
      const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Bağla'); x.textContent = '×';
      x.onclick = () => { bar.remove(); try { sessionStorage.setItem('rare_annc_x', '1'); } catch (e) {} };
      bar.append(document.createTextNode(String(an.text).trim()), x); document.body.prepend(bar);
    }
  } catch (e) { console.info('[RARE] sayt ayarları yüklənmədi'); }
}
