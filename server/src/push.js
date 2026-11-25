import { generateVAPIDKeys, sendNotification } from 'web-push';
import { AppError } from './errors.js';

const MAX_DEVICES = 5;

// Sunucu bu adrese istek atacağı için yalnızca bilinen push servisleri kabul edilir.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /\.push\.services\.mozilla\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

function parseSubscription(body) {
  const { endpoint, keys } = body ?? {};
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    url = null;
  }
  const valid =
    url?.protocol === 'https:' &&
    PUSH_HOSTS.some((host) => host.test(url.hostname)) &&
    endpoint.length <= 1000 &&
    [keys?.p256dh, keys?.auth].every((k) => typeof k === 'string' && /^[\w+/=-]{10,200}$/.test(k));
  if (!valid) throw new AppError('Bildirim aboneliği geçersiz.');
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

// Ortam değişkeni yoksa anahtarlar bir kez üretilip veritabanında saklanır.
async function loadKeys(db, keys) {
  if (keys?.publicKey && keys?.privateKey) return keys;
  await db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('vapid', ?)`, [
    JSON.stringify(generateVAPIDKeys()),
  ]);
  const row = await db.get(`SELECT value FROM settings WHERE key = 'vapid'`);
  return JSON.parse(row.value);
}

export async function createPush(db, {
  keys, subject = 'mailto:iletisim@example.com', send = sendNotification,
} = {}) {
  const { publicKey, privateKey } = await loadKeys(db, keys);
  const options = { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60 * 24, timeout: 10_000 };

  return {
    publicKey,

    async subscribe(userId, body) {
      const { endpoint, p256dh, auth } = parseSubscription(body);
      await db.batch([
        [
          `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id,
             p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at`,
          [endpoint, userId, p256dh, auth, Date.now()],
        ],
        [
          `DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN
             (SELECT endpoint FROM push_subscriptions WHERE user_id = ?1
              ORDER BY created_at DESC LIMIT ${MAX_DEVICES})`,
          [userId],
        ],
      ]);
    },

    unsubscribe: (userId, endpoint) =>
      db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [
        userId,
        String(endpoint ?? ''),
      ]),

    // Hata fırlatmaz: bildirim gönderilemese de asıl işlem tamamlanmış sayılır.
    async notify(userId, payload) {
      try {
        const rows = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
        await Promise.all(
          rows.map(async ({ endpoint, p256dh, auth }) => {
            try {
              await send({ endpoint, keys: { p256dh, auth } }, JSON.stringify(payload), options);
            } catch (error) {
              if (error.statusCode === 404 || error.statusCode === 410) {
                await this.unsubscribe(userId, endpoint);
              } else {
                console.error('Bildirim gönderilemedi:', error.statusCode ?? error.message);
              }
            }
          }),
        );
      } catch (error) {
        console.error('Bildirim gönderilemedi:', error.message);
      }
    },
  };
}
