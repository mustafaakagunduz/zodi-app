// YAYINA ALMADAN ÖNCE: aşağıdaki iki bilgiyi doldur ve metinleri bir hukukçuya kontrol ettir.
const OPERATOR = '[Veri sorumlusunun adı soyadı / unvanı]';
const CONTACT = '[iletişim e-posta adresi]';
const UPDATED = '25 Kasım 2026';

export const LEGAL = {
  privacy: {
    title: 'Gizlilik ve KVKK Aydınlatma Metni',
    intro: `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu: ${OPERATOR}. Son güncelleme: ${UPDATED}.`,
    sections: [
      ['Hangi veriler işlenir?', [
        'Hesap bilgileri: kullanıcı adın ve şifrenin geri döndürülemez özeti (şifren düz metin olarak saklanmaz). Doğum yılın ve, eklersen, e-posta adresin.',
        'Profil bilgileri: isim, cinsiyet, burç, şehir, meslek (isteğe bağlı), kayıt nedeni, eşleşme tercihleri ve biyografi.',
        'Kullanım verileri: görüşme istekleri, sohbetler, mesajlar ve engelleme kayıtları.',
        'Sohbette paylaşmayı seçersen Instagram ve Twitter / X kullanıcı adların.',
        'Bildirimleri açarsan cihazının bildirim abonelik bilgileri.',
        'Onay tarihin. IP adresin kötüye kullanımı sınırlamak için geçici olarak işlenir; barındırma sağlayıcısı ayrıca erişim kaydı tutabilir.',
      ]],
      ['Neden ve hangi hukuki sebeple?', [
        'Hesabını oluşturmak, eşleşme ve sohbet hizmetini sunmak, şifreni sıfırlayabilmek (KVKK m.5/2-c).',
        'Güvenliği sağlamak ve kötüye kullanımı önlemek (KVKK m.5/2-f).',
        'Cinsiyet tercihin gibi cinsel hayatına ilişkin çıkarım yapılabilecek bilgiler açık rızana dayanarak işlenir (KVKK m.6).',
        'Telefon bildirimleri yalnızca sen açarsan gönderilir.',
      ]],
      ['Kimler görebilir?', [
        'Sana uygun adaylar ve sohbet ettiğin kişiler profil bilgilerini, yaşını ve çevrimiçi durumunu görür. Doğum yılın, e-posta adresin ve kullanıcı adın gösterilmez.',
        'Sohbette karşı taraf yazmakta olduğunu ve mesajlarını görüp görmediğini bilir; oynadığınız oyunlardaki cevapların onunla paylaşılır.',
        'Sosyal medya hesapların yalnızca sohbetteki iki kişi de paylaşırsa karşı tarafa gösterilir. Paylaşım yaptığın bilgisi karşı tarafa iletilir.',
        'Mesajlar uçtan uca şifreli değildir; sunucuda saklanır ve hizmeti yöneten kişi teknik olarak erişebilir.',
      ]],
      ['Kimlere aktarılır?', [
        'Şifre sıfırlama e-postasını ileten e-posta hizmeti sağlayıcısına (e-posta adresin, adın ve kullanıcı adın).',
        'Barındırma ve veritabanı hizmeti sağlayıcılarına. Bu sağlayıcıların sunucuları yurt dışında olabilir.',
        'Bildirimleri açarsan, bildirimler tarayıcının bildirim servisi (Apple, Google, Mozilla veya Microsoft) üzerinden iletilir. Bildirimde gönderenin adı yer alır, mesaj içeriği yer almaz.',
        'Yasal zorunluluk halinde yetkili kamu kurumlarına. Verilerin reklam amacıyla satılmaz.',
      ]],
      ['Ne kadar saklanır?', [
        'Veriler, hesabını silene veya hizmet kapanana kadar saklanır.',
        'Profil sayfasındaki “Hesabımı sil” ile profilin, sohbetlerin, mesajların, isteklerin, engel kayıtların ve bildirim aboneliklerin sunucudan silinir. Barındırma sağlayıcısının yedekleri varsa kendi saklama süreleri sonunda silinir.',
        'Bir sohbeti sildiğinde ya da engellediğinde o sohbette paylaşılan sosyal medya adları silinir. Mesajlar, iki taraf da sohbeti listesinden kaldırınca sunucudan silinir.',
        'Düzenlediğin mesajın eski hali saklanmaz. Sildiğin mesajın içeriği sunucudan kaldırılır.',
        'Oturum anahtarın tarayıcında saklanır. Reklam veya izleme çerezi kullanılmaz.',
      ]],
      ['Hakların', [
        'KVKK m.11 uyarınca verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini veya silinmesini isteme, aktarıldığı kişileri öğrenme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsin.',
        `Hesabını profil sayfasından silebilirsin. Açık rızanı geri almak ve diğer başvuruların için ${CONTACT} adresine yazabilirsin. Başvurular en geç 30 gün içinde yanıtlanır.`,
      ]],
    ],
  },
  terms: {
    title: 'Kullanım Koşulları',
    intro: `Son güncelleme: ${UPDATED}.`,
    sections: [
      ['Kimler kullanabilir?', ['Yalnızca 18 yaşını doldurmuş kişiler. Başkasının adına veya sahte bilgiyle hesap açılamaz.']],
      ['Yasak davranışlar', [
        'Taciz, tehdit, hakaret ve nefret söylemi.',
        'Küfür ve uygunsuz kelimeler; bunları içeren mesaj ve profil bilgileri otomatik olarak reddedilir.',
        'Müstehcen veya yasa dışı içerik paylaşmak.',
        'Para istemek, dolandırıcılık, reklam ve spam.',
        '18 yaşından küçüklerle iletişim kurmaya çalışmak.',
        'Başkalarının bilgilerini veya sohbetlerini izinsiz yaymak.',
      ]],
      ['Sorumluluk', [
        'Burç uyumu eğlence amaçlıdır; bir ilişki ya da sonuç garantisi vermez.',
        'Diğer kullanıcıların kimliği doğrulanmaz. Paylaştıklarından ve buluşma kararlarından sen sorumlusun.',
        'Kurallara uymayan hesaplar kaldırılabilir.',
      ]],
      ['İletişim', [CONTACT]],
    ],
  },
  safety: {
    title: 'Güvenlik İpuçları',
    intro: 'Buradaki kişilerin kimliği doğrulanmıyor. Kendini korumak için:',
    sections: [
      ['Sohbette', [
        'Adres, kimlik numarası, IBAN ve kart bilgisi, şifre ve doğrulama kodu paylaşma.',
        'Para, hediye kartı veya kripto isteyen kimseye gönderme.',
        'Bilmediğin bağlantılara tıklama.',
        'Karşındaki kişi ahlaki sınırları aşan şeyler söylerse onu engelle (sohbetin sağ üstündeki engelle simgesi).',
        'Karşı taraf mesajlarını düzenleyebilir veya silebilir; kanıt gerekiyorsa ekran görüntüsü al.',
      ]],
      ['Buluşmadan önce', [
        'İlk buluşmayı kalabalık, halka açık bir yerde yap.',
        'Bir yakınına nereye ve kiminle gittiğini söyle.',
        'Ulaşımını kendin ayarla, içeceğini gözetimsiz bırakma.',
      ]],
      ['Bir sorun yaşarsan', [
        'Acil durumda 112’yi ara.',
        'Tehdit, şantaj veya dolandırıcılıkta ekran görüntüsü al ve kolluk kuvvetlerine ya da savcılığa başvur.',
        `18 yaşından küçük olduğunu düşündüğün birini veya kural ihlalini ${CONTACT} adresine bildir.`,
      ]],
    ],
  },
};
