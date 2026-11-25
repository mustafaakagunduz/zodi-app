// Yasaklı kelimeler. Hepsini küçük harfle yaz.
//
// STARTS_WITH: kelime bununla başlıyorsa yasak (ekli halleri de yakalanır).
// Masum bir kelimenin başlangıcı olabilecekleri buraya EKLEME.
export const STARTS_WITH = [
  'orospu', 'orosbu', 'oruspu', 'siktir', 'siktiğ', 'sikeyim', 'sikerim', 'sikicem', 'sikik',
  'yarrak', 'yarrağ', 'yarak', 'amcık', 'amcik', 'amınako', 'aminako', 'götveren',
  'götlek', 'ibne', 'kahpe', 'pezevenk', 'pezeveng', 'gavat', 'yavşak', 'yavsak', 'şerefsiz',
  'serefsiz', 'sexting', 'seksting', 'puşt', 'piç', 'taşak', 'taşşak', 'kaltak', 'sürtük', 'fahişe',
];

// EXACT: yalnızca kelimenin tamamı eşleşirse yasak ("göt" yasak, "götür" serbest).
export const EXACT = [
  'amk', 'amq', 'aq', 'oç', 'sik', 'siki', 'sikim', 'sikin', 'göt', 'götü', 'götün', 'götüne',
  'amına', 'amını', 'pic',
];

// İngilizce kelimeler Türkçe küçük harf kuralı uygulanmadan kontrol edilir.
export const ENGLISH_STARTS_WITH = ['fuck', 'bitch', 'motherfuck', 'sexting', 'seksting'];
