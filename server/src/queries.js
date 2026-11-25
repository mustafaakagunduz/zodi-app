import { ageOf, MIN_AGE } from './age.js';
import { areNeighbors } from './data/cities.js';
import { COMPATIBLE, signAspect } from './data/constants.js';
import { AppError } from './errors.js';
import { viewGame } from './games.js';
import { isMatch, matchScore } from './matching.js';
import { reasonsOf } from './reasons.js';

// Başkalarına gösterilebilecek alanlar. Token ve sosyal hesaplar burada yer almaz.
export const publicUser = (u, isOnline) => ({
  id: u.id,
  name: u.name,
  age: u.birth_year ? ageOf(u.birth_year) : null,
  gender: u.gender,
  city: u.city,
  job: u.job,
  reasons: reasonsOf(u),
  sign: u.sign,
  bio: u.bio,
  online: isOnline(u.id),
});

export const ownUser = (u) => ({
  ...publicUser(u, () => true),
  locationPref: u.location_pref,
  genderPref: u.gender_pref,
  username: u.username,
  email: u.email,
  birthYear: u.birth_year ? Number(u.birth_year) : null,
  needsConsent: !u.consent_at,
  needsCredentials: !u.username,
  needsBirthYear: !u.birth_year,
});

// Hesap kullanılabilir mi? (onay, giriş bilgileri ve doğum yılı)
export const isComplete = (u) => Boolean(u?.consent_at && u.username && u.birth_year);

// Başkalarına aday olarak gösterilebilir mi? listCandidates sorgusuyla aynı kural.
export const isListable = (u) => Boolean(u?.consent_at && u.birth_year);

export const getUser = (db, id) => db.get('SELECT * FROM users WHERE id = ?', [id]);

export async function isBlocked(db, a, b) {
  return Boolean(
    await db.get(
      `SELECT 1 FROM blocks
       WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
      [a, b, b, a],
    ),
  );
}

export const activeChatBetween = (db, a, b) =>
  db.get(
    `SELECT * FROM chats WHERE status = 'active'
     AND ((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))`,
    [a, b, b, a],
  );

function passes(me, other, filters, isOnline) {
  if (!filters) return true;
  const slack = filters.flex ? 1 : 0;
  const age = ageOf(other.birth_year);
  if (age < Math.max(MIN_AGE, filters.minAge - slack) || age > filters.maxAge + slack) return false;
  if (filters.online && !isOnline(other.id)) return false;
  if (filters.reason && !reasonsOf(other).includes(filters.reason)) return false;
  if (filters.place === 'same' && other.city !== me.city) return false;
  if (filters.place === 'neighbor' && other.city !== me.city && !areNeighbors(me.city, other.city)) {
    return false;
  }
  return !filters.fullOnly || COMPATIBLE[me.sign].full.includes(other.sign);
}

export async function listCandidates(db, me, isOnline, filters) {
  const { full, partial } = COMPATIBLE[me.sign];
  const signs = [...full, ...partial];
  const users = await db.all(
    `SELECT * FROM users u
     WHERE u.id != ?
       AND u.consent_at IS NOT NULL
       AND u.birth_year IS NOT NULL
       AND u.sign IN (${signs.map(() => '?').join(',')})
       AND NOT EXISTS (SELECT 1 FROM blocks b
         WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
            OR (b.blocker_id = u.id AND b.blocked_id = ?))
       AND NOT EXISTS (SELECT 1 FROM chats c WHERE c.status = 'active'
         AND ((c.user_a = ? AND c.user_b = u.id) OR (c.user_a = u.id AND c.user_b = ?)))
     ORDER BY u.created_at DESC`,
    [me.id, ...signs, me.id, me.id, me.id, me.id],
  );

  const requests = await db.all(
    `SELECT * FROM requests WHERE status IN ('pending', 'rejected') AND (from_id = ? OR to_id = ?)`,
    [me.id, me.id],
  );
  const relationWith = (id) => {
    const received = requests.find((r) => r.from_id === id && r.status === 'pending');
    if (received) return { relation: 'received', requestId: received.id };
    const sent = requests.find((r) => r.from_id === me.id && r.to_id === id);
    if (sent) return { relation: sent.status === 'pending' ? 'sent' : 'rejected' };
    return { relation: 'none' };
  };

  return users
    .filter((u) => isMatch(me, u) && passes(me, u, filters, isOnline))
    .map((u) => {
      const user = publicUser(u, isOnline);
      // Yalnızca esnetme sayesinde listeye giren adaylar işaretlenir.
      const stretched = Boolean(filters) && (user.age < filters.minAge || user.age > filters.maxAge);
      return { ...user, ...relationWith(u.id), stretched, score: matchScore(me, u) };
    })
    .sort((a, b) => b.score.total - a.score.total || Number(b.online) - Number(a.online))
    .slice(0, 100);
}

export async function getInbox(db, me, isOnline) {
  const requests = await db.all(
    `SELECT r.id AS request_id, r.created_at AS requested_at, u.*
     FROM requests r JOIN users u ON u.id = r.from_id
     WHERE r.to_id = ? AND r.status = 'pending' ORDER BY r.created_at DESC`,
    [me.id],
  );
  const chats = await db.all(
    `SELECT c.id AS chat_id, c.status AS chat_status,
            m.kind AS last_kind, m.body AS last_body, m.sender_id AS last_sender,
            m.deleted_at AS last_deleted,
            COALESCE(m.created_at, c.created_at) AS last_at,
            (SELECT COUNT(*) FROM messages n WHERE n.chat_id = c.id AND n.sender_id != ?1
               AND n.deleted_at IS NULL
               AND n.id > CASE WHEN c.user_a = ?1 THEN c.read_a ELSE c.read_b END) AS unread,
            u.*
     FROM chats c
     JOIN users u ON u.id = CASE WHEN c.user_a = ?1 THEN c.user_b ELSE c.user_a END
     LEFT JOIN messages m ON m.id = (SELECT MAX(id) FROM messages WHERE chat_id = c.id)
     WHERE (c.user_a = ?1 AND c.hidden_a = 0) OR (c.user_b = ?1 AND c.hidden_b = 0)
     ORDER BY last_at DESC`,
    [me.id],
  );
  return {
    requests: requests.map((r) => ({
      id: r.request_id,
      from: publicUser(r, isOnline),
      // İstekten sonra profiller değiştiyse uyum bilgisi olmayabilir.
      score: signAspect(me.sign, r.sign) ? matchScore(me, r) : null,
    })),
    chats: chats.map((c) => ({
      id: c.chat_id,
      status: c.chat_status,
      unread: Number(c.unread),
      // Sona ermiş sohbetlerde karşı tarafın çevrimiçi durumu gösterilmez.
      partner: publicUser(c, c.chat_status === 'active' ? isOnline : () => false),
      last: c.last_kind
        ? {
            kind: c.last_kind,
            body: c.last_body,
            mine: c.last_sender === me.id,
            deleted: Boolean(c.last_deleted),
          }
        : null,
    })),
  };
}

// Kullanıcının üyesi olduğu ve listesinden kaldırmadığı sohbeti döner.
export const listBlocked = (db, userId) =>
  db.all(
    `SELECT u.id, u.name, u.city FROM blocks b JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = ? ORDER BY b.created_at DESC`,
    [userId],
  );

export async function getGames(db, chat, userId) {
  if (chat.status !== 'active') return [];
  const rows = await db.all('SELECT * FROM games WHERE chat_id = ? ORDER BY type', [chat.id]);
  return rows.map((r) => viewGame(r.type, JSON.parse(r.state), userId, chat.partnerId));
}

export async function getChatFor(db, chatId, userId) {
  const chat = await db.get('SELECT * FROM chats WHERE id = ?', [String(chatId ?? '')]);
  const side = chat?.user_a === userId ? 'a' : chat?.user_b === userId ? 'b' : null;
  if (!side || chat[`hidden_${side}`]) throw new AppError('Sohbet bulunamadı.', 404);
  return {
    ...chat,
    side,
    partnerId: side === 'a' ? chat.user_b : chat.user_a,
    partnerReadId: Number(side === 'a' ? chat.read_b : chat.read_a),
  };
}

const toMessage = (m) => ({
  id: Number(m.id),
  chatId: m.chat_id,
  senderId: m.sender_id,
  kind: m.kind,
  body: m.body,
  createdAt: Number(m.created_at),
  editedAt: m.edited_at ? Number(m.edited_at) : null,
  deletedAt: m.deleted_at ? Number(m.deleted_at) : null,
  replyTo: m.reply_sender
    ? {
        id: Number(m.reply_to),
        senderId: m.reply_sender,
        body: m.reply_body,
        deleted: Boolean(m.reply_deleted),
      }
    : null,
});

// Yanıtlanan mesajın güncel hali her sorguda birlikte okunur.
const MESSAGE_SELECT = `SELECT m.*, r.sender_id AS reply_sender, r.body AS reply_body,
  r.deleted_at AS reply_deleted
  FROM messages m LEFT JOIN messages r ON r.id = m.reply_to`;

export const getMessage = async (db, id) =>
  toMessage(await db.get(`${MESSAGE_SELECT} WHERE m.id = ?`, [id]));

export async function listMessages(db, chatId) {
  const rows = await db.all(
    `${MESSAGE_SELECT} WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 200`,
    [chatId],
  );
  return rows.reverse().map(toMessage);
}

// Karşı tarafın hesapları yalnızca İKİ taraf da paylaştıysa istemciye gönderilir.
export async function getSocial(db, chat, userId) {
  const rows =
    chat.status === 'active'
      ? await db.all('SELECT * FROM social_shares WHERE chat_id = ?', [chat.id])
      : [];
  const pick = (r) => (r ? { instagram: r.instagram, twitter: r.twitter } : null);
  const mine = rows.find((r) => r.user_id === userId);
  const theirs = rows.find((r) => r.user_id !== userId);
  return {
    mine: pick(mine),
    partnerShared: Boolean(theirs),
    partner: mine && theirs ? pick(theirs) : null,
  };
}
