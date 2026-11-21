# RARE Academy

Statik sayt (HTML + CSS + JS), build tələb olunmur. **Render:** New > Static Site, Publish directory: `.`

## Quruluş
- `index.html`, `style.css`, `script.js` – səhifə
- `auth.js` – Supabase: e-poçt kodu ilə təsdiq, (istəyə bağlı) Google girişi, qeydiyyat müraciətləri
- `supabase-config.js` – Supabase URL və ictimai (anon) açar
- `supabase/schema.sql` – cədvəllər və təhlükəsizlik qaydaları (SQL Editor-də bir dəfə işə salınır)
- `supabase/email-template.html` – kod məktubunun şablonu
- `admin.html`, `admin.js` – Admin/CEO paneli; `cms.js` – panel ayarlarını sayta tətbiq edir
- `consent.js` – kuki icazəsi paneli
- `SUPABASE-SETUP.md` – quraşdırma təlimatı

`script.js`-in əvvəlindəki `CONFIG` obyektində sınaq platforması, sosial şəbəkə, video linkləri və form endpoint-i yazılır.
