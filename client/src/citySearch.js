// Türkçe karakter yazılmasa da eşleşsin: "sanli" → Şanlıurfa, "IZMIR" → İzmir.
const fold = (text) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

// Adı yazılanla başlayanlar önce, içinde geçenler sonra.
export function searchCities(cities, query) {
  const needle = fold(query);
  if (!needle) return cities;
  const starts = cities.filter((c) => fold(c).startsWith(needle));
  const contains = cities.filter((c) => !starts.includes(c) && fold(c).includes(needle));
  return [...starts, ...contains];
}

// Tam adı yazılmış şehri döner.
export const exactCity = (cities, query) => cities.find((c) => fold(c) === fold(query)) ?? '';
