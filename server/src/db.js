import { createClient } from '@libsql/client';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  city TEXT NOT NULL,
  job TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  sign TEXT NOT NULL,
  location_pref TEXT NOT NULL,
  gender_pref TEXT NOT NULL,
  bio TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS users_sign ON users (sign);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_to ON requests (to_id, status);
CREATE INDEX IF NOT EXISTS requests_from ON requests (from_id);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  status TEXT NOT NULL,
  hidden_a INTEGER NOT NULL DEFAULT 0,
  hidden_b INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chats_a ON chats (user_a);
CREATE INDEX IF NOT EXISTS chats_b ON chats (user_b);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_chat ON messages (chat_id, id);

CREATE TABLE IF NOT EXISTS social_shares (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  instagram TEXT NOT NULL DEFAULT '',
  twitter TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_user ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  user_id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  chat_id TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (chat_id, type)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// İki tarafın da sildiği sohbetler mesajlarıyla birlikte kalıcı olarak kaldırılır.
const BOTH_DELETED = 'SELECT id FROM chats WHERE hidden_a = 1 AND hidden_b = 1';
export const PURGE_DELETED_CHATS = [
  `DELETE FROM messages WHERE chat_id IN (${BOTH_DELETED})`,
  `DELETE FROM social_shares WHERE chat_id IN (${BOTH_DELETED})`,
  `DELETE FROM games WHERE chat_id IN (${BOTH_DELETED})`,
  'DELETE FROM chats WHERE hidden_a = 1 AND hidden_b = 1',
];

// Eski veritabanlarına sonradan eklenen sütunlar.
async function migrate(client) {
  const missing = async (table, column) =>
    !(await client.execute(`PRAGMA table_info(${table})`)).rows.some((r) => r.name === column);

  if (await missing('users', 'consent_at')) {
    await client.execute('ALTER TABLE users ADD COLUMN consent_at INTEGER');
  }
  if (await missing('users', 'username')) {
    // Kullanıcı adı öncesi açılmış oturumlar bir kereye mahsus taşınır.
    await client.batch(
      [
        'ALTER TABLE users ADD COLUMN username TEXT',
        'ALTER TABLE users ADD COLUMN password_hash TEXT',
        'ALTER TABLE users ADD COLUMN birth_date TEXT',
        'CREATE UNIQUE INDEX users_username ON users (username)',
        `INSERT OR IGNORE INTO sessions (token_hash, user_id, created_at)
         SELECT token_hash, id, created_at FROM users`,
      ],
      'write',
    );
  }
  if (await missing('users', 'birth_year')) {
    // Tam doğum tarihi yerine yalnızca yıl saklanır; eski tarihler silinir.
    await client.batch(
      [
        'ALTER TABLE users ADD COLUMN birth_year INTEGER',
        'UPDATE users SET birth_year = CAST(substr(birth_date, 1, 4) AS INTEGER) WHERE birth_date IS NOT NULL',
        'UPDATE users SET birth_date = NULL',
        'ALTER TABLE users ADD COLUMN email TEXT',
        'CREATE UNIQUE INDEX users_email ON users (email)',
      ],
      'write',
    );
  }
  for (const column of ['reply_to', 'edited_at', 'deleted_at']) {
    if (await missing('messages', column)) {
      await client.execute(`ALTER TABLE messages ADD COLUMN ${column} INTEGER`);
    }
  }
  if (await missing('chats', 'read_a')) {
    // Mevcut mesajlar okunmuş sayılır.
    const last = '(SELECT COALESCE(MAX(id), 0) FROM messages WHERE chat_id = chats.id)';
    await client.batch(
      [
        'ALTER TABLE chats ADD COLUMN read_a INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE chats ADD COLUMN read_b INTEGER NOT NULL DEFAULT 0',
        `UPDATE chats SET read_a = ${last}, read_b = ${last}`,
      ],
      'write',
    );
  }
}

export async function createDb({ url, authToken }) {
  const client = createClient({ url, authToken });
  await client.executeMultiple(SCHEMA);
  await migrate(client);
  await client.batch(PURGE_DELETED_CHATS, 'write');

  return {
    all: async (sql, args = []) => (await client.execute({ sql, args })).rows,
    get: async (sql, args = []) => (await client.execute({ sql, args })).rows[0],
    run: (sql, args = []) => client.execute({ sql, args }),
    // Birden fazla yazma işlemini tek transaction içinde çalıştırır.
    batch: (statements) =>
      client.batch(statements.map(([sql, args = []]) => ({ sql, args })), 'write'),
    close: () => client.close(),
  };
}
