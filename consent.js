/* RARE Academy – kuki icazəsi (Rədd et / Qismən icazə ver / İcazə ver)
   Seçim 180 gün saxlanılır. Digər skriptlər üçün:
     RARE_CONSENT.allows('preferences')  → "Qismən" və "İcazə ver" zamanı true
     RARE_CONSENT.allows('analytics')    → yalnız "İcazə ver" zamanı true (üçüncü tərəf)
     window.addEventListener('rare:consent', e => e.detail.level)  */
(function () {
  const KEY = 'rare_consent', TTL = 180 * 864e5, bar = document.getElementById('cookieBar');
  if (!bar) return;
  let level = null;
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && ['none', 'partial', 'all'].includes(r.level) && Date.now() - r.at < TTL) level = r.level; } catch (e) {}
  const api = window.RARE_CONSENT = {
    level,
    allows: c => c === 'necessary' || (c === 'preferences' && api.level !== 'none') || (c === 'analytics' && api.level === 'all')
  };
  const show = () => bar.classList.add('show');
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-consent]'); if (!b) return;
    api.level = b.dataset.consent;
    try { localStorage.setItem(KEY, JSON.stringify({ level: api.level, at: Date.now() })); } catch (e) {}
    bar.classList.remove('show');
    window.dispatchEvent(new CustomEvent('rare:consent', { detail: { level: api.level } }));
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-cookie-settings]')) { e.preventDefault(); show(); } });
  if (!level) setTimeout(show, 700);
})();
