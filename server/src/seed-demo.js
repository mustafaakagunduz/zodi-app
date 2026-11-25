// Giriş yapılabilen iki demo hesabı ve aralarında hazır bir sohbet.
// Her çalıştırmada demo sohbeti sıfırdan oluşturulur.
import { hashPassword } from './auth.js';
import { answer, newGame } from './games.js';

export const DEMO_PASSWORD = 'demo12345';
const ALI = 'seed-demo-ali';
const SELIN = 'seed-demo-selin';
const CHAT = 'seed-demo-chat';
const MINUTE = 60_000;

export async function seedDemo(db) {
  const now = Date.now();
  const year = new Date().getFullYear();
  const password = await hashPassword(DEMO_PASSWORD);
  const users = [
    [ALI, 'demo', 'Ali (demo)', 'erkek', 'Yazılımcı', 'koc', 'kadin', year - 27,
      'Kahve, bisiklet ve gece yürüyüşleri.', 'sohbet,flort'],
    [SELIN, 'demo2', 'Selin (demo)', 'kadin', 'Mimar', 'aslan', 'erkek', year - 25,
      'Eski binaları ve iyi müziği severim.', 'sohbet,ciddi'],
  ];
  for (const [id, username, name, gender, job, sign, genderPref, birthYear, bio, reason] of users) {
    await db.run(
      `INSERT OR REPLACE INTO users
       (id, token_hash, username, password_hash, name, gender, city, job, reason, sign,
        location_pref, gender_pref, bio, birth_year, created_at, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, 'İstanbul', ?, ?, ?, 'farketmez', ?, ?, ?, ?, ?)`,
      [id, id, username, password, name, gender, job, reason, sign, genderPref, bio, birthYear, now, now],
    );
  }

  await db.batch([
    ...['messages', 'games', 'social_shares'].map((table) => [`DELETE FROM ${table} WHERE chat_id = ?`, [CHAT]]),
    ['DELETE FROM chats WHERE id = ?', [CHAT]],
    ['DELETE FROM blocks WHERE blocker_id IN (?, ?)', [ALI, SELIN]],
    ['DELETE FROM requests WHERE to_id = ?', [ALI]],
    [
      `INSERT INTO chats (id, user_a, user_b, status, created_at) VALUES (?, ?, ?, 'active', ?)`,
      [CHAT, ALI, SELIN, now - 60 * MINUTE],
    ],
  ]);

  const add = async (sender, body, minutesAgo, { kind = 'text', replyTo = null, edited, deleted } = {}) => {
    const at = now - minutesAgo * MINUTE;
    const row = await db.get(
      `INSERT INTO messages (chat_id, sender_id, kind, body, reply_to, created_at, edited_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [CHAT, sender, kind, deleted ? '' : body, replyTo, at, edited ? at : null, deleted ? at : null],
    );
    return Number(row.id);
  };

  const hello = await add(ALI, 'Selam Selin! Burçlarımız tam uyumlu çıkmış 😄', 55);
  await add(SELIN, 'Selam! Evet, Koç ve Aslan. İddialı bir ikili.', 53, { replyTo: hello });
  await add(ALI, 'Hafta sonu için ideal planın ne?', 50, { kind: 'icebreaker' });
  const plan = await add(SELIN, 'Sabah uzun bir kahvaltı, sonra Balat’ta fotoğraf turu.', 47);
  await add(ALI, 'Balat’ı çok severim, güzel bir kahveci biliyorum.', 45, { replyTo: plan, edited: true });
  await add(ALI, 'yanlışlıkla yazdım', 44, { deleted: true });
  await add(SELIN, 'Adını söyle, listeye ekleyeyim ☕', 40);
  await add(ALI, 'Yerin adı uzun, buluşursak gösteririm. Sen en çok hangi semtte vakit geçiriyorsun?', 35);
  const seen = await add(ALI, 'Bu arada bisiklete biner misin?', 34);
  await add(SELIN, 'Moda tarafında. Sahilde yürümeye bayılırım.', 12);
  await add(SELIN, '', 9, { kind: 'social' });
  const lastRead = await add(SELIN, 'Bisiklet de olur, ama yavaş sürersen 🚲', 8);

  // Selin "Bu mu, Şu mu?" oyununu başlatıp yanıtladı; sıra Ali'de.
  await add(SELIN, 'Bu mu, Şu mu?', 5, { kind: 'game' });
  const game = answer(newGame('thisthat', SELIN, ALI), SELIN, [0, 1, 0, 1, 0]);

  await db.batch([
    ['INSERT INTO games (chat_id, type, state) VALUES (?, ?, ?)', [CHAT, 'thisthat', JSON.stringify(game)]],
    [
      'INSERT INTO social_shares (chat_id, user_id, instagram, twitter) VALUES (?, ?, ?, ?)',
      [CHAT, SELIN, 'selin.demo', ''],
    ],
    // Ali son mesajları henüz okumadı; Selin, Ali'nin tüm mesajlarını gördü.
    ['UPDATE chats SET read_a = ?, read_b = ? WHERE id = ?', [seen, lastRead, CHAT]],
    // Ali'ye bekleyen bir görüşme isteği (örnek profil Elif'ten).
    [
      `INSERT INTO requests (id, from_id, to_id, status, created_at)
       VALUES ('seed-demo-request', 'seed-0', ?, 'pending', ?)`,
      [ALI, now - 2 * MINUTE],
    ],
  ]);
}
