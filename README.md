# Zodi

Burç uyumuna göre eşleşen, mobil öncelikli mini sohbet sitesi.

- **client/**: React + Vite
- **server/**: Node.js + Express + Socket.IO
- **Veritabanı**: libSQL (lokalde `server/data.db`, canlıda ücretsiz [Turso](https://turso.tech))

## Çalıştırma (Node 22+)

```bash
npm install
npm run seed   # isteğe bağlı: örnek profiller + demo/demo2 hesapları (şifre: demo12345)
npm run dev    # http://localhost:5173
```

Giriş kullanıcı adı ve şifreyle yapılır.
İki kullanıcıyı denemek için ikinci hesabı **gizli pencerede** ya da başka bir tarayıcıda aç
(normal sekmeler aynı oturumu paylaşır). Telefondan denemek için aynı Wi-Fi'da
Vite'ın yazdığı `Network` adresini aç.

Örnek profiller çevrimdışıdır, isteklere yanıt vermez.

## Şifremi unuttum (e-posta)

E-posta kayıtta isteğe bağlıdır; eklemeyen kullanıcı şifresini sıfırlayamaz.
E-postaya 15 dakika geçerli, 6 haneli bir kod gönderilir. SMTP ayarı yoksa geliştirmede
kod **sunucu terminaline** yazılır. Gerçek e-posta için `server/.env.example` dosyasını
`server/.env` olarak kopyala ve bir SMTP hizmetinin (ör. Brevo, Gmail uygulama şifresi)
bilgilerini gir. Canlıda aynı değişkenleri ve `NODE_ENV=production` tanımla.
Bazı ücretsiz barındırma planları SMTP portlarını engeller; seçmeden önce kontrol et.

## Telefon bildirimleri

- Web Push kullanılır ve **HTTPS** ister. Bilgisayarda `http://localhost` üzerinde çalışır;
  telefondan `http://192.168…` adresiyle denendiğinde çalışmaz.
- iPhone'da (iOS 16.4+) site önce ana ekrana eklenmelidir.
- Anahtarlar ilk açılışta üretilip veritabanında saklanır. İstersen `VAPID_PUBLIC_KEY` ve
  `VAPID_PRIVATE_KEY` ile verebilirsin (`npx web-push generate-vapid-keys`).
- Canlıda `VAPID_SUBJECT=mailto:senin-adresin` tanımla.
- Bildirim, uygulama ekranda açık değilken gönderilir; mesaj içeriği yazılmaz.

## Yayına almadan önce

`client/src/legal.js` içindeki veri sorumlusu ve iletişim bilgilerini doldur,
metinleri bir hukukçuya kontrol ettir.

## Test

```bash
npm test
```

## Canlıya alma

Websocket gerektiği için sürekli çalışan bir Node sunucusu lazım (ör. Render, Railway, Fly.io;
ücretsiz plan koşullarını kontrol et). Sunucu, build edilmiş arayüzü de sunar.

- Build: `npm install && npm run build`
- Start: `npm start`
- Ortam değişkenleri: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

Turso değişkenleri verilmezse lokal dosya kullanılır; diski kalıcı olmayan sunucularda veriler silinir.

Tek sunucu örneği için tasarlandı (çevrimiçi durumu ve hız sınırları bellekte tutulur).

## Sık değiştirilecek yerler

- Burç uyumu, skor puanları, seçenekler, buz kırıcı soruları: `server/src/data/constants.js`
- Yasaklı kelimeler: `server/src/data/banned-words.js`
- Komşu iller: `server/src/data/cities.js`
- Eşleşme kuralları: `server/src/matching.js`
