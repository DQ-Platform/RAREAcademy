# RARE Academy – Firebase quraşdırması (≈25 dəq)

Axınlar:
- **E-poçtla:** ad + istiqamət + Gmail → Gmail-ə 6 rəqəmli kod → təsdiq → müraciət bazaya yazılır.
- **Google ilə:** hesab seçilir → ad və istiqamətin təsdiq pəncərəsi → müraciət bazaya yazılır.
- **"Məlumatlarımı 90 gün xatırla"** → sessiya və ad/istiqamət/e-poçt 90 gün saxlanır (seçilməzsə, brauzer bağlananda çıxış olur).
- **Kuki paneli** (Rədd et / Qismən icazə ver / İcazə ver) – `consent.js`; "Rədd et" zamanı xatırlama söndürülür.

## 1. Layihə və Web app
1. console.firebase.google.com → **Add project**.
2. **Project settings → Your apps → Web (</>)** → `firebaseConfig`-dən `apiKey`, `authDomain`, `projectId`, `appId` dəyərlərini **`firebase-config.js`** faylındakı `FIREBASE_CONFIG`-ə yazın.

## 2. Google girişi
**Authentication → Sign-in method → Google → Enable.** **Settings → Authorized domains** → `rareacademy.az` (və `www.`, Render/GitHub Pages domeniniz) əlavə edin.

## 3. Firestore
**Firestore Database → Create database** (Production mode, `eur3`). Qaydalar `firestore.rules` ilə deploy olunur (aşağıda) və ya **Rules** bölməsinə yapışdırın.

## 4. E-poçt kodu (Cloud Functions)
> ⚠ Cloud Functions **Blaze (pay-as-you-go)** planı tələb edir (bank kartı lazımdır; bu həcmdə adətən pulsuz kvota çatır). Büdcə xəbərdarlığı qurun.

1. Kodları göndərəcək ayrıca Gmail açın (məs. `rareacademy.noreply@gmail.com`) → **2 addımlı doğrulamanı** aktiv edin → Google Account → Security → **App passwords** → 16 simvolluq şifrə yaradın.
2. Terminalda (Node 20+):
```
npm i -g firebase-tools
firebase login
firebase use --add            # layihənizi seçin
firebase functions:secrets:set SMTP_USER     # Gmail ünvanı
firebase functions:secrets:set SMTP_PASS     # 16 simvolluq App password
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```
3. Region `functions/index.js`-də `europe-west1`-dir; `firebase-config.js`-dəki `FUNCTIONS_REGION` ilə eyni qalmalıdır.
Qeyd: Gmail SMTP gündə ~500 məktubla məhduddur; çox olarsa Resend/SendGrid-ə keçmək olar.

## Giriş qaydası ("Qeydiyyatım var → Daxil ol")
- **E-poçtla:** ad və Gmail yazılır; server `registrations`-da həmin e-poçt və adla (böyük/kiçik hərf və diakritik fərqi nəzərə alınmır) ləğv edilməmiş müraciət axtarır. Tapılsa kod göndərilir, tapılmasa "Sizin aktiv qeydiyyatınız yoxdur" bildirilir.
- **Google ilə:** hesab seçilir, hesaba bağlı ləğv edilməmiş müraciət yoxdursa eyni bildiriş çıxır və çıxış edilir.
- Müraciətin statusunu `rejected` etsəniz, həmin şəxs daxil ola bilməz.
- Dəyişiklik sonrası yenidən: `firebase deploy --only functions,firestore:rules`

## 5. Admin / CEO paneli
- Panel: `https://rareacademy.az/admin.html`; saytda hesab menyusunda (admin üçün) **"Admin panel"** seçimi də görünür.
- **`rareacademyy@gmail.com`** ilə Google-la daxil olan hesab avtomatik **CEO** olur (əlavə addım yoxdur). Bu e-poçt `firebase-config.js` (`CEO_EMAIL`) və `firestore.rules` (`isCeo`) daxilindədir; dəyişmək istəsəniz hər ikisində dəyişin və rules-u yenidən deploy edin.
- CEO "İstifadəçilər" bölməsindən istənilən istifadəçini **Admin** edə və ya adminlikdən çıxara bilər. Adminlər müraciətləri, istifadəçiləri, abunəçiləri və sayt məzmununu idarə edir, amma digər adminləri təyin edə bilmir.
- **Panel bölmələri:** İdarə paneli (istifadəçi/müraciət/abunə sayları, son 30 gün qrafiki, istiqamət və status statistikası), Müraciətlər (axtarış, status, qeyd, silmə, CSV), İstifadəçilər, Abunəçilər, Sayt idarəsi (əlaqə, linklər, video, elan paneli, qeydiyyatı açıb-bağlama, istiqamətlər siyahısı, ana səhifə sloqanları, səhifə mətnləri).
- Şəkillər, dizayn və səhifə strukturu panelləndən dəyişmir (kod tələb edir).

## 6. Yoxlama
- Kuki paneli ilk girişdə aşağıdan çıxır; seçim 180 gün saxlanır; footerdə "Kuki seçimləri" ilə yenidən açılır.
- "Qeydiyyat" → e-poçt kodu ilə və Google ilə hər iki yolu sınayın; `registrations`-da sənəd yaranmalıdır.

## Təhlükəsizlik
- Kod yalnız hash şəklində, yalnız serverdə (`emailCodes`) saxlanır; 10 dəq etibarlıdır, 5 yanlış cəhddən sonra ləğv olur, eyni ünvana 60 san aralıq və saatda 5 göndəriş limiti var.
- Müraciəti yalnız təsdiqlənmiş hesab yaza bilir; `role` dəyişmək olmaz; oxuyan yalnız `admins`.
- Başqa ünvanlara kütləvi kod göndərilməsinin qarşısı üçün **App Check** (reCAPTCHA) aktiv etmək tövsiyə olunur.
- Üçüncü tərəf skriptləri (analitika və s.) əlavə edəndə `RARE_CONSENT.allows('analytics')` yoxlanmalıdır – hazırda saytda belə skript yoxdur.
