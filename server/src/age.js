export const MIN_AGE = 18;
export const MAX_AGE = 99;

// Yalnızca doğum yılı bilindiği için yaş, yıl farkıdır.
export const ageOf = (birthYear, now = new Date()) => now.getFullYear() - Number(birthYear);
