import { ageOf, MAX_AGE, MIN_AGE } from './age.js';
import { CITIES } from './data/cities.js';
import { GENDERS, GENDER_PREFS, LOCATION_PREFS, REASONS, SIGNS } from './data/constants.js';
import { AppError } from './errors.js';
import { assertClean } from './moderation.js';

export function text(value, label, { min = 0, max }) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length < min) throw new AppError(`${label} en az ${min} karakter olmalı.`);
  if (result.length > max) throw new AppError(`${label} en fazla ${max} karakter olabilir.`);
  return result;
}

function oneOf(value, options, label) {
  if (!options.includes(value)) throw new AppError(`${label} seçmelisin.`);
  return value;
}

const ids = (list) => list.map((item) => item.id);

// Seçilenler her zaman listedeki sırayla saklanır; tekrarlar atılır.
function parseReasons(value) {
  const known = ids(REASONS);
  if (!Array.isArray(value) || !value.length || !value.every((id) => known.includes(id))) {
    throw new AppError('En az bir kayıt nedeni seçmelisin.');
  }
  return known.filter((id) => value.includes(id)).join(',');
}

export function parseProfile(body = {}) {
  return {
    name: assertClean(text(body.name, 'İsim', { min: 2, max: 30 }), 'İsim'),
    gender: oneOf(body.gender, ids(GENDERS), 'Cinsiyet'),
    city: oneOf(body.city, CITIES, 'Şehir'),
    job: assertClean(text(body.job, 'Meslek', { max: 50 }), 'Meslek'),
    reason: parseReasons(body.reasons),
    sign: oneOf(body.sign, ids(SIGNS), 'Burç'),
    location_pref: oneOf(body.locationPref, ids(LOCATION_PREFS), 'Konum tercihi'),
    gender_pref: oneOf(body.genderPref, ids(GENDER_PREFS), 'Konuşmak istediğin cinsiyet'),
    bio: assertClean(text(body.bio, 'Biyografi', { max: 300 }), 'Biyografi'),
  };
}

export function requireConsent(body = {}) {
  if (body.isAdult !== true) throw new AppError('18 yaşından büyük olduğunu onaylamalısın.');
  if (body.acceptTerms !== true) {
    throw new AppError('Kullanım koşullarını ve aydınlatma metnini onaylamalısın.');
  }
  if (body.explicitConsent !== true) throw new AppError('Açık rıza onayı gerekli.');
}

export function parseUsername(value) {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
    throw new AppError('Kullanıcı adı 3-20 karakter olmalı: İngilizce harf, rakam, nokta ya da alt çizgi.');
  }
  return assertClean(username, 'Kullanıcı adı');
}

export function parsePassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8 || password.length > 72) {
    throw new AppError('Şifre 8-72 karakter olmalı.');
  }
  return password;
}

export const parseCredentials = (body = {}) => ({
  username: parseUsername(body.username),
  password: parsePassword(body.password),
});

export function parseEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;".]{2,}$/.test(email)) {
    throw new AppError('Geçerli bir e-posta adresi gir.');
  }
  return email;
}

// E-posta isteğe bağlı: boşsa null (veritabanında birden fazla boş kayıt olabilir).
export const parseOptionalEmail = (value) =>
  value === undefined || value === null || String(value).trim() === '' ? null : parseEmail(value);

export function parseBirthYear(value) {
  const year = /^\d{4}$/.test(String(value)) ? Number(value) : NaN;
  if (Number.isNaN(year) || ageOf(year) > MAX_AGE) throw new AppError('Geçerli bir doğum yılı gir.');
  if (ageOf(year) < MIN_AGE) throw new AppError('Siteyi yalnızca 18 yaş ve üzeri kullanabilir.');
  return year;
}

// Aday listesi filtreleri. Geçersiz değerler yok sayılır.
export function parseFilters(query = {}) {
  const age = (value, fallback) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= MIN_AGE && n <= MAX_AGE ? n : fallback;
  };
  let minAge = age(query.minAge, MIN_AGE);
  let maxAge = age(query.maxAge, MAX_AGE);
  if (minAge > maxAge) [minAge, maxAge] = [maxAge, minAge];
  return {
    minAge,
    maxAge,
    flex: query.flex === '1', // aralığı iki uçtan birer yaş esnet
    online: query.online === '1',
    fullOnly: query.fullOnly === '1',
    place: ['same', 'neighbor'].includes(query.place) ? query.place : 'all',
    reason: ids(REASONS).includes(query.reason) ? query.reason : '',
  };
}

function handle(value, pattern, label) {
  const result = typeof value === 'string' ? value.trim().replace(/^@/, '') : '';
  if (result && !pattern.test(result)) throw new AppError(`${label} kullanıcı adı geçersiz.`);
  return result;
}

export function parseSocials(body = {}) {
  const instagram = handle(body.instagram, /^[A-Za-z0-9._]{1,30}$/, 'Instagram');
  const twitter = handle(body.twitter, /^[A-Za-z0-9_]{1,15}$/, 'Twitter');
  if (!instagram && !twitter) throw new AppError('En az bir hesap yazmalısın.');
  return { instagram, twitter };
}
