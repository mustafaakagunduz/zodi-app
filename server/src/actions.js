import { randomUUID } from 'node:crypto';
import { ICEBREAKERS, MESSAGE_LIMIT } from './data/constants.js';
import { PURGE_DELETED_CHATS } from './db.js';
import { AppError, rateLimiter } from './errors.js';
import { answer, GAMES, isFinished, move, newGame } from './games.js';
import { isMatch } from './matching.js';
import { assertClean } from './moderation.js';
import {
  activeChatBetween, getChatFor, getMessage, getUser, isBlocked, isListable, publicUser,
} from './queries.js';
import { parseSocials, text } from './validate.js';

// Yazma işlemlerini sıraya koyar; aynı anda gelen istekler birbirini ezemez.
function createQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
}

export function createActions({ db, emit, isOnline, notify }) {
  const queue = createQueue();
  const limitMessages = rateLimiter(20, 10_000);
  const limitRequests = rateLimiter(20, 60_000);
  const limitGames = rateLimiter(6, 60_000);

  const sync = (...userIds) => userIds.forEach((id) => emit(id, 'sync'));

  async function insertMessage(chat, senderId, kind, body, replyTo = null) {
    const row = await db.get(
      `INSERT INTO messages (chat_id, sender_id, kind, body, reply_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [chat.id, senderId, kind, body, replyTo, Date.now()],
    );
    const message = await getMessage(db, row.id);
    const sender = await getUser(db, senderId);
    const payload = { ...message, senderName: sender.name };
    emit(chat.user_a, 'message:new', payload);
    emit(chat.user_b, 'message:new', payload);
    // Kilit ekranında mesaj içeriği görünmesin diye yalnızca gönderenin adı yazılır.
    notify(senderId === chat.user_a ? chat.user_b : chat.user_a, {
      title: sender.name,
      body:
        kind === 'social' ? 'Sosyal medyasını paylaştı'
          : kind === 'game' ? `${body} oyunu başlattı`
            : 'Sana yeni bir mesaj gönderdi',
      url: `/chat/${chat.id}`,
      tag: `chat-${chat.id}`,
    });
    return message;
  }

  async function broadcastUpdate(chat, messageId) {
    const message = await getMessage(db, messageId);
    emit(chat.user_a, 'message:updated', message);
    emit(chat.user_b, 'message:updated', message);
  }

  // Karşı tarafın son cevabından sonra atılan (silinenler dahil) mesaj sayısı.
  async function assertMessageLimit(chat, userId) {
    const { count } = await db.get(
      `SELECT COUNT(*) AS count FROM messages
       WHERE chat_id = ?1 AND sender_id = ?2 AND kind IN ('text', 'icebreaker')
         AND id > COALESCE((SELECT MAX(id) FROM messages
           WHERE chat_id = ?1 AND sender_id != ?2 AND kind IN ('text', 'icebreaker')), 0)`,
      [chat.id, userId],
    );
    if (Number(count) >= MESSAGE_LIMIT) {
      throw new AppError(`Üst üste ${MESSAGE_LIMIT} mesaj attın. Karşı tarafın cevabını bekle.`);
    }
  }

  const chatChanged = (chat) =>
    [chat.user_a, chat.user_b].forEach((id) => emit(id, 'chat:updated', { chatId: chat.id }));

  async function updateGame(me, chatId, type, apply) {
    const chat = await activeChat(chatId, me.id);
    const row = await db.get('SELECT state FROM games WHERE chat_id = ? AND type = ?', [chat.id, type]);
    if (!row) throw new AppError('Oyun bulunamadı.');
    await db.run('UPDATE games SET state = ? WHERE chat_id = ? AND type = ?', [
      JSON.stringify(apply(JSON.parse(row.state))), chat.id, type,
    ]);
    chatChanged(chat);
    return {};
  }

  async function activeChat(chatId, userId) {
    const chat = await getChatFor(db, chatId, userId);
    if (chat.status !== 'active') throw new AppError('Bu sohbet sona erdi.');
    return chat;
  }

  async function accept(me, request) {
    const chatId = randomUUID();
    await db.batch([
      [`UPDATE requests SET status = 'accepted' WHERE id = ?`, [request.id]],
      [
        `INSERT INTO chats (id, user_a, user_b, status, created_at) VALUES (?, ?, ?, 'active', ?)`,
        [chatId, request.from_id, me.id, Date.now()],
      ],
    ]);
    emit(request.from_id, 'request:accepted', { chatId, by: publicUser(me, isOnline) });
    sync(request.from_id, me.id);
    notify(request.from_id, {
      title: 'Eşleştiniz 🎉',
      body: `${me.name} ile artık konuşabilirsin`,
      url: `/chat/${chatId}`,
      tag: `chat-${chatId}`,
    });
    return { chatId };
  }

  const handlers = {
    async 'request:send'(me, { userId }) {
      limitRequests(me.id);
      const other = await getUser(db, String(userId ?? ''));
      if (!isListable(other) || (await isBlocked(db, me.id, other.id)) || !isMatch(me, other)) {
        throw new AppError('Bu kişiye istek gönderemezsin.');
      }
      if (await activeChatBetween(db, me.id, other.id)) {
        throw new AppError('Zaten sohbettesiniz.');
      }
      // Karşı taraf zaten istek göndermişse doğrudan eşleştir.
      const incoming = await db.get(
        `SELECT * FROM requests WHERE from_id = ? AND to_id = ? AND status = 'pending'`,
        [other.id, me.id],
      );
      if (incoming) return accept(me, incoming);

      const previous = await db.get(
        `SELECT * FROM requests WHERE from_id = ? AND to_id = ? AND status IN ('pending', 'rejected')`,
        [me.id, other.id],
      );
      if (previous) throw new AppError('Bu kişiye zaten istek gönderdin.');

      const id = randomUUID();
      await db.run(
        `INSERT INTO requests (id, from_id, to_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
        [id, me.id, other.id, Date.now()],
      );
      emit(other.id, 'request:new', { id, from: publicUser(me, isOnline) });
      sync(me.id, other.id);
      notify(other.id, {
        title: 'Yeni görüşme isteği',
        body: `${me.name} seninle konuşmak istiyor`,
        url: '/requests',
        tag: `request-${id}`,
      });
      return {};
    },

    async 'request:respond'(me, { requestId, accept: accepted }) {
      const request = await db.get(
        `SELECT * FROM requests WHERE id = ? AND to_id = ? AND status = 'pending'`,
        [String(requestId ?? ''), me.id],
      );
      if (!request) throw new AppError('Bu istek artık geçerli değil.');
      if (accepted === true) return accept(me, request);
      await db.run(`UPDATE requests SET status = 'rejected' WHERE id = ?`, [request.id]);
      sync(request.from_id, me.id);
      return {};
    },

    async 'message:send'(me, { chatId, body, icebreakerIndex, replyTo }) {
      limitMessages(me.id);
      const chat = await activeChat(chatId, me.id);
      await assertMessageLimit(chat, me.id);
      if (icebreakerIndex !== undefined) {
        const question = Number.isInteger(icebreakerIndex) ? ICEBREAKERS[icebreakerIndex] : null;
        if (!question) throw new AppError('Soru bulunamadı.');
        return { message: await insertMessage(chat, me.id, 'icebreaker', question) };
      }
      const clean = assertClean(text(body, 'Mesaj', { min: 1, max: 1000 }), 'Mesajın');
      if (replyTo !== undefined && replyTo !== null) {
        const target = Number.isSafeInteger(replyTo) && (await db.get(
          `SELECT 1 FROM messages WHERE id = ? AND chat_id = ? AND kind IN ('text', 'icebreaker') AND deleted_at IS NULL`,
          [replyTo, chat.id],
        ));
        if (!target) throw new AppError('Yanıtlanan mesaj bulunamadı.');
      }
      return { message: await insertMessage(chat, me.id, 'text', clean, replyTo ?? null) };
    },

    async 'message:edit'(me, { chatId, messageId, body }) {
      limitMessages(me.id);
      const chat = await activeChat(chatId, me.id);
      // Yalnızca kendi yazdığın metin mesajları düzenlenebilir.
      const current = Number.isSafeInteger(messageId) && (await db.get(
        `SELECT * FROM messages WHERE id = ? AND chat_id = ? AND sender_id = ? AND kind = 'text' AND deleted_at IS NULL`,
        [messageId, chat.id, me.id],
      ));
      if (!current) throw new AppError('Bu mesaj düzenlenemez.');
      const clean = assertClean(text(body, 'Mesaj', { min: 1, max: 1000 }), 'Mesajın');
      if (clean !== current.body) {
        await db.run('UPDATE messages SET body = ?, edited_at = ? WHERE id = ?', [
          clean, Date.now(), messageId,
        ]);
        await broadcastUpdate(chat, messageId);
      }
      return {};
    },

    // Mesaj iki taraf için de silinir: içeriği sunucudan kaldırılır, yerinde bilgi satırı kalır.
    async 'message:delete'(me, { chatId, messageId }) {
      limitMessages(me.id);
      const chat = await activeChat(chatId, me.id);
      const own = Number.isSafeInteger(messageId) && (await db.get(
        `SELECT 1 FROM messages WHERE id = ? AND chat_id = ? AND sender_id = ?
         AND kind IN ('text', 'icebreaker') AND deleted_at IS NULL`,
        [messageId, chat.id, me.id],
      ));
      if (!own) throw new AppError('Bu mesaj silinemez.');
      await db.run(`UPDATE messages SET body = '', deleted_at = ? WHERE id = ?`, [
        Date.now(), messageId,
      ]);
      await broadcastUpdate(chat, messageId);
      return {};
    },

    async 'social:share'(me, payload) {
      const chat = await activeChat(payload.chatId, me.id);
      const { instagram, twitter } = parseSocials(payload);
      const existing = await db.get(
        'SELECT 1 FROM social_shares WHERE chat_id = ? AND user_id = ?',
        [chat.id, me.id],
      );
      await db.run(
        `INSERT INTO social_shares (chat_id, user_id, instagram, twitter) VALUES (?, ?, ?, ?)
         ON CONFLICT (chat_id, user_id) DO UPDATE SET instagram = excluded.instagram, twitter = excluded.twitter`,
        [chat.id, me.id, instagram, twitter],
      );
      // İlk paylaşımda sohbete bilgi satırı düşer (hesap adı içermez).
      if (!existing) {
        await insertMessage(chat, me.id, 'social', '');
        emit(chat.partnerId, 'social:shared', { chatId: chat.id, by: publicUser(me, isOnline) });
      }
      emit(me.id, 'chat:updated', { chatId: chat.id });
      emit(chat.partnerId, 'chat:updated', { chatId: chat.id });
      return {};
    },

    async 'chat:read'(me, { chatId, messageId }) {
      const chat = await getChatFor(db, chatId, me.id);
      if (!Number.isSafeInteger(messageId)) throw new AppError('Geçersiz mesaj.');
      const column = `read_${chat.side}`;
      const { last } = await db.get(
        'SELECT MAX(id) AS last FROM messages WHERE chat_id = ? AND id <= ?',
        [chat.id, messageId],
      );
      if (Number(last ?? 0) > Number(chat[column])) {
        await db.run(`UPDATE chats SET ${column} = ? WHERE id = ?`, [last, chat.id]);
        sync(me.id);
        if (chat.status === 'active') {
          emit(chat.partnerId, 'chat:read', { chatId: chat.id, messageId: Number(last) });
        }
      }
      return {};
    },

    async 'user:unblock'(me, { userId }) {
      await db.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [
        me.id, String(userId ?? ''),
      ]);
      sync(me.id, String(userId ?? ''));
      return {};
    },

    async 'game:start'(me, { chatId, type }) {
      limitGames(me.id);
      const chat = await activeChat(chatId, me.id);
      if (!Object.hasOwn(GAMES, type)) throw new AppError('Oyun bulunamadı.');
      const row = await db.get('SELECT state FROM games WHERE chat_id = ? AND type = ?', [chat.id, type]);
      if (row && !isFinished(type, JSON.parse(row.state))) {
        throw new AppError('Bu oyun zaten devam ediyor.');
      }
      await db.run('INSERT OR REPLACE INTO games (chat_id, type, state) VALUES (?, ?, ?)', [
        chat.id, type, JSON.stringify(newGame(type, me.id, chat.partnerId)),
      ]);
      await insertMessage(chat, me.id, 'game', GAMES[type]);
      chatChanged(chat);
      return {};
    },

    'game:answer': (me, { chatId, answers }) =>
      updateGame(me, chatId, 'thisthat', (state) => answer(state, me.id, answers)),

    'game:move': (me, { chatId, cell }) =>
      updateGame(me, chatId, 'xox', (state) => move(state, me.id, cell)),

    // Yarım kalan oyunu iki oyuncudan biri kapatabilir.
    async 'game:close'(me, { chatId, type }) {
      const chat = await activeChat(chatId, me.id);
      await db.run('DELETE FROM games WHERE chat_id = ? AND type = ?', [chat.id, String(type)]);
      chatChanged(chat);
      return {};
    },

    // Sohbeti kendi listesinden siler; sohbet açıksa karşı taraf için de sona erer.
    // İki taraf da sildiğinde mesajlar kalıcı olarak kaldırılır.
    async 'chat:delete'(me, { chatId }) {
      const chat = await getChatFor(db, chatId, me.id);
      await db.batch([
        [`UPDATE chats SET status = 'ended', hidden_${chat.side} = 1 WHERE id = ?`, [chat.id]],
        ['DELETE FROM social_shares WHERE chat_id = ?', [chat.id]],
        ['DELETE FROM games WHERE chat_id = ?', [chat.id]],
        ...PURGE_DELETED_CHATS.map((sql) => [sql]),
      ]);
      if (chat.status === 'active') emit(chat.partnerId, 'chat:updated', { chatId: chat.id });
      sync(me.id, chat.partnerId);
      return {};
    },

    async 'user:block'(me, { chatId }) {
      const chat = await getChatFor(db, chatId, me.id);
      const other = chat.partnerId;
      const between = '((user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?))';
      const pair = [me.id, other, other, me.id];
      const shared = await db.all(`SELECT id FROM chats WHERE ${between}`, pair);
      await db.batch([
        [
          'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)',
          [me.id, other, Date.now()],
        ],
        [
          `UPDATE requests SET status = 'cancelled' WHERE status = 'pending'
           AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`,
          pair,
        ],
        [
          `UPDATE chats SET status = 'ended',
             hidden_a = CASE WHEN user_a = ? THEN 1 ELSE hidden_a END,
             hidden_b = CASE WHEN user_b = ? THEN 1 ELSE hidden_b END
           WHERE ${between}`,
          [me.id, me.id, ...pair],
        ],
        ...shared.map((c) => ['DELETE FROM social_shares WHERE chat_id = ?', [c.id]]),
        ...shared.map((c) => ['DELETE FROM games WHERE chat_id = ?', [c.id]]),
        ...PURGE_DELETED_CHATS.map((sql) => [sql]),
      ]);
      // Karşı tarafa engellendiği söylenmez; yalnızca sohbetin bittiğini görür.
      shared.forEach((c) => emit(other, 'chat:updated', { chatId: c.id }));
      sync(me.id, other);
      return {};
    },
  };

  async function requireUser(userId) {
    const user = await getUser(db, userId);
    if (!user) throw new AppError('Oturum bulunamadı.', 401);
    return user;
  }

  // Hesabı ve ona bağlı tüm kayıtları kalıcı olarak siler.
  const deleteAccount = (userId) =>
    queue(async () => {
      const partners = await db.all(
        `SELECT user_b AS id FROM chats WHERE user_a = ?1
         UNION SELECT user_a FROM chats WHERE user_b = ?1
         UNION SELECT to_id FROM requests WHERE from_id = ?1
         UNION SELECT from_id FROM requests WHERE to_id = ?1`,
        [userId],
      );
      const ownChats = 'SELECT id FROM chats WHERE user_a = ?1 OR user_b = ?1';
      await db.batch(
        [
          `DELETE FROM messages WHERE chat_id IN (${ownChats})`,
          `DELETE FROM social_shares WHERE chat_id IN (${ownChats})`,
          `DELETE FROM games WHERE chat_id IN (${ownChats})`,
          'DELETE FROM sessions WHERE user_id = ?1',
          'DELETE FROM password_resets WHERE user_id = ?1',
          'DELETE FROM chats WHERE user_a = ?1 OR user_b = ?1',
          'DELETE FROM requests WHERE from_id = ?1 OR to_id = ?1',
          'DELETE FROM blocks WHERE blocker_id = ?1 OR blocked_id = ?1',
          'DELETE FROM push_subscriptions WHERE user_id = ?1',
          'DELETE FROM users WHERE id = ?1',
        ].map((sql) => [sql, [userId]]),
      );
      sync(...partners.map((p) => p.id));
    });

  const events = Object.fromEntries(
    Object.entries(handlers).map(([event, handler]) => [
      event,
      (userId, payload) =>
        queue(async () => handler(await requireUser(userId), payload ?? {})),
    ]),
  );

  // "Yazıyor…" bilgisi: kaydedilmez, sıraya girmeden karşı tarafa iletilir.
  const typing = async (userId, chatId) => {
    const chat = await getChatFor(db, chatId, userId);
    if (chat.status === 'active') emit(chat.partnerId, 'typing', { chatId: chat.id });
  };

  return { events, deleteAccount, typing };
}
