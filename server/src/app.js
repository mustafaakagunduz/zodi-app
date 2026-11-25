import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { createActions } from './actions.js';
import { createSession, hashPassword, hashToken, newToken, verifyPassword } from './auth.js';
import { CITIES } from './data/cities.js';
import * as constants from './data/constants.js';
import { AppError, rateLimiter } from './errors.js';
import {
  getChatFor, getGames, getInbox, getSocial, getUser, isComplete, listBlocked, listCandidates,
  listMessages, ownUser, publicUser,
} from './queries.js';
import { matchScore } from './matching.js';
import { passwordResetRoutes } from './password-reset.js';
import {
  parseBirthYear, parseCredentials, parseFilters, parseOptionalEmail, parsePassword, parseProfile,
  parseUsername, requireConsent,
} from './validate.js';

export function createApp({
  db, push, mailer, staticDir, registerLimit = 20,
  statsMinMembers = constants.STATS_MIN_MEMBERS,
}) {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 10_000 });

  const online = new Map(); // userId → açık bağlantılar
  const isOnline = (id) => online.has(id);
  const emit = (userId, event, data) => io.to(`user:${userId}`).emit(event, data);
  // Uygulama ekranda açıksa telefona bildirim gönderilmez.
  const notify = (userId, payload) => {
    const visible = [...(online.get(userId) ?? [])].some((s) => s.data.visible);
    if (!visible) push.notify(userId, payload);
  };
  const { events, deleteAccount, typing } = createActions({ db, emit, isOnline, notify });

  const userByToken = (token) =>
    typeof token === 'string' && token
      ? db.get(
          `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
          [hashToken(token)],
        )
      : undefined;
  const bearer = (req) => req.get('authorization')?.replace(/^Bearer /, '');

  // Çevrimiçi durumu değişince açık sohbetteki karşı tarafların listesi yenilenir.
  async function announcePresence(userId) {
    const partners = await db.all(
      `SELECT CASE WHEN user_a = ?1 THEN user_b ELSE user_a END AS id FROM chats
       WHERE status = 'active' AND (user_a = ?1 OR user_b = ?1)`,
      [userId],
    );
    partners.forEach((p) => emit(p.id, 'sync'));
  }
  const reportPresence = (userId) =>
    announcePresence(userId).catch((error) => console.error(error.message));

  async function ensureUsernameFree(username, exceptId = '') {
    if (await db.get('SELECT 1 FROM users WHERE username = ? AND id != ?', [username, exceptId])) {
      throw new AppError('Bu kullanıcı adı alınmış.');
    }
  }
  async function ensureEmailFree(email, exceptId = '') {
    if (await db.get('SELECT 1 FROM users WHERE email = ? AND id != ?', [email, exceptId])) {
      throw new AppError('Bu e-posta adresi zaten kayıtlı.');
    }
  }
  // İki istek aynı anda aynı değeri alırsa veritabanı kısıtı devreye girer.
  const alreadyTaken = (error) => {
    const message = String(error.message);
    if (message.includes('UNIQUE constraint failed: users.username')) {
      throw new AppError('Bu kullanıcı adı alınmış.');
    }
    if (message.includes('UNIQUE constraint failed: users.email')) {
      throw new AppError('Bu e-posta adresi zaten kayıtlı.');
    }
    throw error;
  };

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10kb' }));

  const limitRegister = rateLimiter(registerLimit, 60 * 60_000);
  // Şifre denemelerini sınırla: hem hesap hem IP başına.
  const limitLogin = rateLimiter(10, 15 * 60_000);
  const limitLoginIp = rateLimiter(100, 15 * 60_000);
  const limitAccount = rateLimiter(10, 15 * 60_000);

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Giriş yapmadan da görülür; yalnızca sayı döner. Örnek profiller sayılmaz.
  app.get('/api/stats', async (req, res) => {
    const { total } = await db.get(`SELECT COUNT(*) AS total FROM users WHERE id NOT LIKE 'seed-%'`);
    // Eşiğin altında sayılar istemciye hiç gönderilmez.
    if (Number(total) < statsMinMembers) return res.json({ visible: false });
    res.json({ visible: true, total: Number(total), online: online.size });
  });

  app.get('/api/meta', (req, res) => {
    res.json({
      cities: CITIES,
      signs: constants.SIGNS,
      compatible: constants.COMPATIBLE,
      genders: constants.GENDERS,
      genderPrefs: constants.GENDER_PREFS,
      locationPrefs: constants.LOCATION_PREFS,
      reasons: constants.REASONS,
      icebreakers: constants.ICEBREAKERS,
      messageLimit: constants.MESSAGE_LIMIT,
      pushPublicKey: push.publicKey,
    });
  });

  app.post('/api/register', async (req, res) => {
    const profile = parseProfile(req.body);
    const { username, password } = parseCredentials(req.body);
    const email = parseOptionalEmail(req.body?.email);
    const birthYear = parseBirthYear(req.body?.birthYear);
    requireConsent(req.body);
    limitRegister(req.ip);
    await ensureUsernameFree(username);
    if (email) await ensureEmailFree(email);
    const id = randomUUID();
    const now = Date.now();
    const row = {
      id,
      token_hash: newToken(), // eski sütun; oturumlar "sessions" tablosunda
      ...profile,
      username,
      password_hash: await hashPassword(password),
      email,
      birth_year: birthYear,
      created_at: now,
      consent_at: now,
    };
    const columns = Object.keys(row);
    await db
      .run(
        `INSERT INTO users (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
        Object.values(row),
      )
      .catch(alreadyTaken);
    res.status(201).json({ token: await createSession(db, id), user: ownUser(row) });
  });

  app.post('/api/login', async (req, res) => {
    const username = String(req.body?.username ?? '').trim().toLowerCase().slice(0, 20);
    const password = String(req.body?.password ?? '').slice(0, 72);
    limitLoginIp(req.ip);
    limitLogin(`${req.ip} ${username}`);
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!(await verifyPassword(password, user?.password_hash))) {
      throw new AppError('Kullanıcı adı ya da şifre hatalı.', 400);
    }
    res.json({ token: await createSession(db, user.id), user: ownUser(user) });
  });

  app.use(
    '/api',
    passwordResetRoutes({
      db,
      mailer,
      onReset: (userId) => {
        emit(userId, 'password:reset');
        io.in(`user:${userId}`).disconnectSockets();
      },
    }),
  );

  const auth = async (req, res, next) => {
    const user = await userByToken(bearer(req));
    if (!user) throw new AppError('Oturum bulunamadı.', 401);
    req.user = user;
    next();
  };

  const complete = (req, res, next) => {
    if (!isComplete(req.user)) throw new AppError('Devam etmek için hesabını tamamlamalısın.', 403);
    next();
  };

  app.post('/api/logout', auth, async (req, res) => {
    const hash = hashToken(bearer(req));
    await db.run('DELETE FROM sessions WHERE token_hash = ?', [hash]);
    for (const socket of online.get(req.user.id) ?? []) {
      if (socket.data.session === hash) socket.disconnect(true);
    }
    res.json({ ok: true });
  });

  // Eski hesapların eksik bilgilerini tamamlar.
  app.post('/api/setup', auth, async (req, res) => {
    const changes = {};
    if (!req.user.consent_at) {
      requireConsent(req.body);
      changes.consent_at = Date.now();
    }
    if (!req.user.birth_year) changes.birth_year = parseBirthYear(req.body?.birthYear);
    const email = req.user.email ? null : parseOptionalEmail(req.body?.email);
    if (email) {
      await ensureEmailFree(email, req.user.id);
      changes.email = email;
    }
    if (!req.user.username) {
      const { username, password } = parseCredentials(req.body);
      await ensureUsernameFree(username, req.user.id);
      changes.username = username;
      changes.password_hash = await hashPassword(password);
    }
    const columns = Object.keys(changes);
    if (columns.length) {
      await db
        .run(`UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
          ...Object.values(changes), req.user.id,
        ])
        .catch(alreadyTaken);
    }
    res.json({ user: ownUser(await getUser(db, req.user.id)) });
  });

  app.post('/api/push', auth, complete, async (req, res) => {
    await push.subscribe(req.user.id, req.body);
    res.json({ ok: true });
  });

  app.delete('/api/push', auth, async (req, res) => {
    await push.unsubscribe(req.user.id, req.body?.endpoint);
    res.json({ ok: true });
  });

  app.get('/api/me', auth, (req, res) => res.json({ user: ownUser(req.user) }));

  app.put('/api/me', auth, async (req, res) => {
    const profile = parseProfile(req.body);
    if (req.body.birthYear !== undefined) profile.birth_year = parseBirthYear(req.body.birthYear);
    const columns = Object.keys(profile);
    await db.run(
      `UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(profile), req.user.id],
    );
    res.json({ user: ownUser(await getUser(db, req.user.id)) });
  });

  // Kullanıcı adı, e-posta ve şifre. Mevcut şifre doğrulanmadan değiştirilemez.
  app.put('/api/me/account', auth, complete, async (req, res) => {
    limitAccount(req.user.id);
    const current = String(req.body?.currentPassword ?? '').slice(0, 72);
    if (!(await verifyPassword(current, req.user.password_hash))) {
      throw new AppError('Mevcut şifren hatalı.');
    }
    const changes = {
      username: parseUsername(req.body.username),
      email: parseOptionalEmail(req.body.email),
    };
    await ensureUsernameFree(changes.username, req.user.id);
    if (changes.email) await ensureEmailFree(changes.email, req.user.id);
    const { newPassword } = req.body;
    if (newPassword) changes.password_hash = await hashPassword(parsePassword(newPassword));

    const columns = Object.keys(changes);
    await db
      .run(`UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
        ...Object.values(changes), req.user.id,
      ])
      .catch(alreadyTaken);

    // Eski adrese gönderilmiş sıfırlama kodu geçersiz olur.
    if (newPassword || changes.email !== req.user.email) {
      await db.run('DELETE FROM password_resets WHERE user_id = ?', [req.user.id]);
    }
    if (newPassword) {
      // Bu oturum dışındaki her yerden çıkış yapılır.
      const session = hashToken(bearer(req));
      await db.batch([
        ['DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', [req.user.id, session]],
        ['DELETE FROM push_subscriptions WHERE user_id = ?', [req.user.id]],
      ]);
      for (const socket of online.get(req.user.id) ?? []) {
        if (socket.data.session !== session) socket.disconnect(true);
      }
    }
    res.json({ user: ownUser(await getUser(db, req.user.id)) });
  });

  app.delete('/api/me', auth, async (req, res) => {
    await deleteAccount(req.user.id);
    // Aynı hesabın açık diğer sekmeleri de çıkış yapsın.
    emit(req.user.id, 'account:deleted');
    io.in(`user:${req.user.id}`).disconnectSockets();
    res.json({ ok: true });
  });

  app.get('/api/candidates', auth, complete, async (req, res) => {
    const filters = parseFilters(req.query);
    res.json({ candidates: await listCandidates(db, req.user, isOnline, filters) });
  });

  app.get('/api/inbox', auth, complete, async (req, res) => {
    res.json(await getInbox(db, req.user, isOnline));
  });

  app.get('/api/blocks', auth, complete, async (req, res) => {
    res.json({ blocked: await listBlocked(db, req.user.id) });
  });

  app.get('/api/chats/:id', auth, complete, async (req, res) => {
    const chat = await getChatFor(db, req.params.id, req.user.id);
    const partner = await getUser(db, chat.partnerId);
    res.json({
      chat: {
        id: chat.id,
        status: chat.status,
        partner: publicUser(partner, chat.status === 'active' ? isOnline : () => false),
        social: await getSocial(db, chat, req.user.id),
        games: await getGames(db, chat, req.user.id),
        partnerReadId: chat.status === 'active' ? chat.partnerReadId : 0,
        // Profiller sonradan değiştiyse uyum bilgisi olmayabilir.
        match: constants.signAspect(req.user.sign, partner.sign) ? matchScore(req.user, partner) : null,
      },
      messages: await listMessages(db, chat.id),
    });
  });

  app.use('/api', () => {
    throw new AppError('Bulunamadı.', 404);
  });

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((error, req, res, _next) => {
    const status = error.status ?? 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? 'Bir şeyler ters gitti.' : error.message });
  });

  io.use(async (socket, next) => {
    try {
      const user = await userByToken(socket.handshake.auth?.token);
      if (!user) return next(new Error('unauthorized'));
      if (!isComplete(user)) return next(new Error('incomplete'));
      socket.data.userId = user.id;
      socket.data.session = hashToken(socket.handshake.auth.token);
      next();
    } catch (error) {
      console.error(error);
      next(new Error('server'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(`user:${userId}`);
    const cameOnline = !online.has(userId);
    if (cameOnline) online.set(userId, new Set());
    online.get(userId).add(socket);
    if (cameOnline) reportPresence(userId);
    socket.on('typing', (payload) => {
      typing(userId, payload?.chatId).catch(() => {});
    });
    socket.on('presence', (payload) => { socket.data.visible = payload?.visible === true; });

    for (const [event, action] of Object.entries(events)) {
      socket.on(event, async (payload, ack) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
          reply({ ok: true, ...(await action(userId, payload)) });
        } catch (error) {
          if (!(error instanceof AppError)) console.error(error);
          reply({ ok: false, error: error instanceof AppError ? error.message : 'Bir şeyler ters gitti.' });
        }
      });
    }

    socket.on('disconnect', () => {
      online.get(userId).delete(socket);
      if (online.get(userId).size === 0) {
        online.delete(userId);
        reportPresence(userId);
      }
    });
  });

  return { app, server, io };
}
