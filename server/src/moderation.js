import { ENGLISH_STARTS_WITH, EXACT, STARTS_WITH } from './data/banned-words.js';
import { AppError } from './errors.js';

// Harf yerine kullanılan rakam ve semboller (ör. "0r0spu").
const LOOKALIKES = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', '@': 'a', $: 's' };

function words(text) {
  const tokens = (text.match(/[\p{L}\p{N}@$]+/gu) ?? []).map((token) =>
    /\p{L}/u.test(token)
      ? token
          .replace(/[01345@$]/g, (c) => LOOKALIKES[c] ?? c)
          .replace(/(\p{L})\1{2,}/gu, '$1') // "siiiktir" → "siktir"
      : token,
  );
  // Tek tek yazılan harfleri birleştir: "a m k", "a.m.k"
  const joined = [];
  let letters = '';
  for (const token of [...tokens, '']) {
    if (token.length === 1) {
      letters += token;
      continue;
    }
    if (letters) joined.push(letters);
    letters = '';
    if (token) joined.push(token);
  }
  return joined;
}

export function containsBannedWord(text) {
  // Görünmez karakterlerle kelime bölünmesini engelle.
  const clean = text.normalize('NFKC').replace(/\p{Cf}/gu, '');
  const turkish = words(clean.toLocaleLowerCase('tr'));
  return (
    turkish.some((w) => EXACT.includes(w) || STARTS_WITH.some((s) => w.startsWith(s))) ||
    words(clean.toLowerCase()).some((w) => ENGLISH_STARTS_WITH.some((s) => w.startsWith(s)))
  );
}

export function assertClean(text, label) {
  if (containsBannedWord(text)) {
    throw new AppError(`${label} uygunsuz bir kelime içeriyor. Düzeltip tekrar dene.`);
  }
  return text;
}
