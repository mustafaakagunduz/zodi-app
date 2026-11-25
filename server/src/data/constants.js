export const SIGNS = [
  { id: 'koc', name: 'Koç', symbol: '♈', element: 'ates' },
  { id: 'boga', name: 'Boğa', symbol: '♉', element: 'toprak' },
  { id: 'ikizler', name: 'İkizler', symbol: '♊', element: 'hava' },
  { id: 'yengec', name: 'Yengeç', symbol: '♋', element: 'su' },
  { id: 'aslan', name: 'Aslan', symbol: '♌', element: 'ates' },
  { id: 'basak', name: 'Başak', symbol: '♍', element: 'toprak' },
  { id: 'terazi', name: 'Terazi', symbol: '♎', element: 'hava' },
  { id: 'akrep', name: 'Akrep', symbol: '♏', element: 'su' },
  { id: 'yay', name: 'Yay', symbol: '♐', element: 'ates' },
  { id: 'oglak', name: 'Oğlak', symbol: '♑', element: 'toprak' },
  { id: 'kova', name: 'Kova', symbol: '♒', element: 'hava' },
  { id: 'balik', name: 'Balık', symbol: '♓', element: 'su' },
];

// Uyumluluk, astrolojideki güneş burcu açılarına dayanır. Anahtar, iki burcun
// zodyak üzerindeki uzaklığıdır (0 = aynı burç, 6 = karşıt burç). Listede olmayan
// uzaklıklar (aynı burç, komşu, kare, 150°) uyumsuz sayılır ve aday gösterilmez.
// Koç örneği: Aslan ve Yay tam; İkizler, Kova ve Terazi kısmen uyumlu.
export const ASPECTS = {
  4: { level: 'full', points: 60 }, // üçgen: aynı element
  2: { level: 'partial', points: 45 }, // altmışlık: ateş-hava, toprak-su
  6: { level: 'partial', points: 35 }, // karşıt burç: çekim var, çatışma da
};

export function signAspect(a, b) {
  const index = (id) => SIGNS.findIndex((s) => s.id === id);
  const gap = Math.abs(index(a) - index(b));
  return ASPECTS[Math.min(gap, SIGNS.length - gap)] ?? null;
}

export const COMPATIBLE = Object.fromEntries(
  SIGNS.map(({ id }) => {
    const at = (level) => SIGNS.filter((o) => signAspect(id, o.id)?.level === level).map((o) => o.id);
    return [id, { full: at('full'), partial: at('partial') }];
  }),
);

export const GENDERS = [
  { id: 'kadin', name: 'Kadın' },
  { id: 'erkek', name: 'Erkek' },
];

export const GENDER_PREFS = [...GENDERS, { id: 'farketmez', name: 'Fark etmez' }];

export const LOCATION_PREFS = [
  { id: 'ayni', name: 'Aynı şehir' },
  { id: 'komsu', name: 'Aynı ve komşu şehirler' },
  { id: 'farketmez', name: 'Fark etmez' },
];

export const REASONS = [
  { id: 'sohbet', name: 'Öylesine sohbet' },
  { id: 'arkadaslik', name: 'Arkadaşlık' },
  { id: 'flort', name: 'Flört' },
  { id: 'ciddi', name: 'Ciddi ilişki' },
  { id: 'evlilik', name: 'Evlilik' },
  { id: 'astroloji', name: 'Astroloji muhabbeti' },
];

// Uyum skorunda kayıt nedeni puanı (en fazla 25). Birden fazla neden seçilebilir; hesap
// matching.js içindedir. İki nedenin yakınlığı: aynıysa tam puan,
// listede olmayan ikililer REASON_BASE_POINTS alır.
export const REASON_MAX_POINTS = 25;
export const REASON_BASE_POINTS = 5;
export const REASON_PAIRS = {
  'ciddi+evlilik': 22,
  'ciddi+flort': 15,
  'arkadaslik+sohbet': 20,
  'astroloji+sohbet': 18,
  'arkadaslik+astroloji': 16,
  'flort+sohbet': 12,
  'arkadaslik+flort': 10,
  'astroloji+flort': 10,
};

// Konum puanı (en fazla 15).
export const LOCATION_POINTS = { same: 15, neighbor: 10, other: 3 };

// Bir kullanıcı, karşı taraf cevap yazana kadar üst üste en fazla bu kadar mesaj atabilir.
export const MESSAGE_LIMIT = 5;

// "Neden uyumlusunuz?" açıklamaları.
export const SIGN_REASONS = {
  ates: 'İkiniz de ateş grubundansınız: enerji, cesaret ve heyecan ortak diliniz.',
  toprak: 'İkiniz de toprak grubundansınız: güven, sabır ve sağlam adımlar sizi birleştiriyor.',
  hava: 'İkiniz de hava grubundansınız: sohbet, merak ve fikir alışverişi bitmez.',
  su: 'İkiniz de su grubundansınız: sezgi ve empati ortak gücünüz.',
  'ates+hava': 'Hava ateşi körükler: biri fikir üretir, diğeri harekete geçirir.',
  'su+toprak': 'Su toprağı besler: duygusallık ve güven birbirini tamamlar.',
  opposite: 'Zodyakta karşı karşıyasınız: çekim güçlü, farklılıklar ise sabır ister.',
};

export const THIS_OR_THAT = [
  ['Deniz', 'Dağ'], ['Çay', 'Kahve'], ['Kedi', 'Köpek'], ['Sabah', 'Gece'],
  ['Film', 'Dizi'], ['Tatlı', 'Tuzlu'], ['Yaz', 'Kış'], ['Evde akşam', 'Dışarıda akşam'],
  ['Planlı tatil', 'Spontane kaçamak'], ['Mesajlaşmak', 'Telefonda konuşmak'],
  ['Kitap', 'Müzik'], ['Büyük şehir', 'Sakin kasaba'], ['Yemek yapmak', 'Sipariş vermek'],
  ['Erken gitmek', 'Son dakika yetişmek'], ['Konser', 'Sinema'], ['Yürüyüş', 'Uyku'],
  ['Sürpriz', 'Haberli plan'], ['Kalabalık ekip', 'Birkaç yakın dost'],
];

// Üye sayısı bu eşiğe ulaşmadan üye/çevrimiçi sayıları gösterilmez.
export const STATS_MIN_MEMBERS = 100;

export const ICEBREAKERS = [
  'Burcunun seni en iyi anlatan özelliği sence hangisi?',
  'Hafta sonu için ideal planın ne?',
  'Şu sıralar dilinden düşmeyen şarkı hangisi?',
  'Bir günlüğüne istediğin yere ışınlanabilsen nereye giderdin?',
  'Çay mı, kahve mi? Cevabını savun 😄',
  'Defalarca izleyebileceğin film ya da dizi hangisi?',
  'Yaşadığın şehirde en sevdiğin yer neresi?',
  'Sabah insanı mısın, gece kuşu mu?',
  'Son zamanlarda seni en çok ne güldürdü?',
  'Hayatın boyunca tek bir yemek yiyecek olsan hangisini seçerdin?',
  'Çocukken ne olmak istiyordun?',
  'Deniz tatili mi, doğa kampı mı?',
  'Hiç kimsenin tahmin edemeyeceği bir yeteneğin var mı?',
  'Piyangodan büyük ikramiye çıksa ilk ne yapardın?',
  'Seni en çok ne mutlu eder?',
  'Öğrenmek istediğin ama henüz başlayamadığın bir şey var mı?',
  'İlk buluşmada seni etkileyen şey ne olur?',
  'Kedi mi, köpek mi?',
];
