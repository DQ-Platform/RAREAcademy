# RARE Academy

Statik sayt (HTML + CSS + JS), build tələb olunmur.

**Render:** New > Static Site, Publish directory: `.`

## Quruluş
- `index.html` – səhifə
- `style.css`, `script.js`
- `auth.js` – Firebase (Firestore) mərkəzi baza + Google ilə giriş
- `firestore.rules` – verilənlər bazasının təhlükəsizlik qaydaları
- `SETUP.md` – quraşdırma təlimatı
- `assets/` – şəkillər (hero.jpg, p1–p9.jpg, rare-symbol.png, favicon.png)

## Tənzimləmə
`script.js`-in əvvəlindəki `CONFIG` obyektində sınaq platforması, şəxsi kabinet, sosial şəbəkə, video linkləri və form endpoint-i yazılır. Boş qalan link kliklənəndə “tezliklə” bildirişi göstərilir.

- `consent.js` – kuki icazəsi paneli
- `functions/` – e-poçt kodu (Cloud Functions), `firebase.json`
- `admin.html`, `admin.js` – Admin/CEO paneli; `cms.js` – panel ayarlarını sayta tətbiq edir; `firebase-config.js` – Firebase konfiqurasiyası
