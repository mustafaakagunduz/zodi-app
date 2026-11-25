import { areNeighbors } from './data/cities.js';
import {
  LOCATION_POINTS, REASON_BASE_POINTS, REASON_MAX_POINTS, REASON_PAIRS, REASONS, SIGN_REASONS,
  SIGNS, signAspect,
} from './data/constants.js';
import { reasonsOf } from './reasons.js';

const wantsGender = (a, b) => a.gender_pref === 'farketmez' || a.gender_pref === b.gender;

function acceptsLocation(a, b) {
  if (a.location_pref === 'farketmez') return true;
  if (a.city === b.city) return true;
  return a.location_pref === 'komsu' && areNeighbors(a.city, b.city);
}

// Eşleşme iki yönlüdür: iki tarafın da cinsiyet ve konum tercihi tutmalı.
export function isMatch(me, other) {
  return (
    me.id !== other.id &&
    signAspect(me.sign, other.sign) !== null &&
    wantsGender(me, other) &&
    wantsGender(other, me) &&
    acceptsLocation(me, other) &&
    acceptsLocation(other, me)
  );
}

// 100 üzerinden uyum skoru: burç (60) + kayıt nedeni (25) + konum (15).
// Yalnızca isMatch'ten geçen çiftler için çağrılır.
export function matchScore(me, other) {
  const sign = signAspect(me.sign, other.sign);
  const reason = reasonPoints(reasonsOf(me), reasonsOf(other));
  const place =
    me.city === other.city ? 'same' : areNeighbors(me.city, other.city) ? 'neighbor' : 'other';
  const location = LOCATION_POINTS[place];
  return {
    total: sign.points + reason + location,
    signLevel: sign.level,
    sign: sign.points,
    reason,
    location,
    why: [signText(me, other, sign), reasonText(me, other, reason), placeText(me, other, place)],
  };
}

const pairPoints = (a, b) =>
  a === b ? REASON_MAX_POINTS : REASON_PAIRS[[a, b].sort().join('+')] ?? REASON_BASE_POINTS;

// Her seçimin karşı taraftaki en yakın karşılığı bulunur, iki tarafın ortalaması alınır.
// Aynı seçimler tam puan verir; karşılığı olmayan ek seçimler puanı düşürür.
function reasonPoints(mine, theirs) {
  const coverage = (from, to) =>
    from.reduce((sum, a) => sum + Math.max(...to.map((b) => pairPoints(a, b))), 0) / from.length;
  return Math.round((coverage(mine, theirs) + coverage(theirs, mine)) / 2);
}

function signText(me, other, aspect) {
  const element = (user) => SIGNS.find((s) => s.id === user.sign).element;
  if (aspect.level === 'full') return SIGN_REASONS[element(me)];
  const pair = [element(me), element(other)].sort((a, b) => a.localeCompare(b));
  return SIGN_REASONS[pair.join('+')] && aspect.points === 45
    ? SIGN_REASONS[pair.join('+')]
    : SIGN_REASONS.opposite;
}

function reasonText(me, other, points) {
  const mine = reasonsOf(me);
  const theirs = reasonsOf(other);
  const names = (list) => list.map((id) => REASONS.find((r) => r.id === id).name).join(', ');
  const shared = mine.filter((id) => theirs.includes(id));
  if (shared.length) {
    return shared.length === mine.length && shared.length === theirs.length
      ? `İkiniz de “${names(shared)}” için buradasınız.`
      : `Ortak amaçlarınız: ${names(shared)}.`;
  }
  const both = `sen “${names(mine)}”, karşı taraf “${names(theirs)}”`;
  return points > REASON_BASE_POINTS
    ? `Beklentileriniz yakın: ${both}.`
    : `Beklentileriniz farklı (${both}); baştan konuşmak iyi olur.`;
}

function placeText(me, other, place) {
  if (place === 'same') return `Aynı şehirdesiniz: ${me.city}.`;
  const label = place === 'neighbor' ? 'Komşu şehirlerdesiniz' : 'Farklı şehirlerdesiniz';
  return `${label}: ${me.city} ve ${other.city}.`;
}
