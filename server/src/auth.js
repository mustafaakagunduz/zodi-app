import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64)).toString('hex')}`;
}

// Kullanıcı bulunamadığında da aynı süre harcansın.
const DUMMY = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

export async function verifyPassword(password, stored) {
  const [salt, hash] = (stored ?? DUMMY).split(':');
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex')) && Boolean(stored);
}

export async function createSession(db, userId) {
  const token = newToken();
  await db.run('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)', [
    hashToken(token), userId, Date.now(),
  ]);
  return token;
}
