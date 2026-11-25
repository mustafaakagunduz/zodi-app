// Kayıt nedenleri veritabanında "sohbet,flort" biçiminde tek sütunda tutulur.
export const reasonsOf = (user) => user.reason.split(',');
