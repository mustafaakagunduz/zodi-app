// Geliştirme için örnek veri ekler: giriş yapılamayan örnek profiller ve iki demo hesabı.
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { createDb } from './db.js';
import { DEMO_PASSWORD, seedDemo } from './seed-demo.js';

// Demo hesaplarının şifresi bellidir; canlıda asla oluşturulmamalı.
if (process.env.TURSO_DATABASE_URL || process.env.NODE_ENV === 'production') {
  console.error('Seed yalnızca lokal veritabanında çalışır.');
  process.exit(1);
}

const db = await createDb({ url: config.databaseUrl });
const people = [
  ['Elif (örnek)', 'kadin', 'İstanbul', 'Grafik tasarımcı', 'sohbet', 'yay', 'erkek'],
  ['Zeynep (örnek)', 'kadin', 'Kocaeli', '', 'ciddi', 'aslan', 'erkek'],
  ['Deniz (örnek)', 'kadin', 'Ankara', 'Öğretmen', 'arkadaslik', 'koc', 'farketmez'],
  ['Mert (örnek)', 'erkek', 'İstanbul', 'Mühendis', 'flort', 'aslan', 'kadin'],
  ['Can (örnek)', 'erkek', 'İzmir', '', 'astroloji', 'yay', 'kadin'],
  ['Ayşe (örnek)', 'kadin', 'İzmir', 'Hemşire', 'evlilik', 'balik', 'erkek'],
];

for (const [index, [name, gender, city, job, reason, sign, genderPref]] of people.entries()) {
  const id = `seed-${index}`;
  await db.run(
    `INSERT OR IGNORE INTO users
     (id, token_hash, name, gender, city, job, reason, sign, location_pref, gender_pref, bio, created_at, consent_at, birth_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'farketmez', ?, ?, ?, ?, ?)`,
    [id, randomUUID(), name, gender, city, job, reason, sign, genderPref,
      'Bu, arayüzü denemek için eklenmiş örnek bir profil.', Date.now(), Date.now(), new Date().getFullYear() - 23 - index],
  );
}
await db.run(`UPDATE users SET consent_at = created_at WHERE id LIKE 'seed-%' AND consent_at IS NULL`);
for (const [index] of people.entries()) {
  await db.run('UPDATE users SET birth_year = ? WHERE id = ? AND birth_year IS NULL', [
    new Date().getFullYear() - 23 - index, `seed-${index}`,
  ]);
}
console.log(`${people.length} örnek profil hazır.`);
await seedDemo(db);
console.log(`Demo hesapları: demo ve demo2 · şifre: ${DEMO_PASSWORD}`);
db.close();
