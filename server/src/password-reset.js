import { randomInt, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { createSession, hashPassword, hashToken } from './auth.js';
import { AppError, rateLimiter } from './errors.js';
import { ownUser } from './queries.js';
import { parseEmail, parsePassword } from './validate.js';

const LIFETIME = 15 * 60_000;
const MAX_ATTEMPTS = 5;
const INVALID = 'Kod hatalı ya da süresi dolmuş.';

const hashCode = (userId, code) => hashToken(`${userId}:${code}`);

export function passwordResetRoutes({ db, mailer, onReset }) {
  const router = express.Router();
  const limitIp = rateLimiter(20, 60 * 60_000);
  const limitEmail = rateLimiter(3, 15 * 60_000);
  const limitTry = rateLimiter(30, 15 * 60_000);

  router.post('/forgot', async (req, res) => {
    const email = parseEmail(req.body?.email);
    if (!mailer) throw new AppError('Şifre sıfırlama şu an kullanılamıyor.', 400);
    limitIp(req.ip);
    limitEmail(email);
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user) {
      const code = String(randomInt(1_000_000)).padStart(6, '0');
      await db.run(
        `INSERT OR REPLACE INTO password_resets (user_id, code_hash, expires_at, attempts)
         VALUES (?, ?, ?, 0)`,
        [user.id, hashCode(user.id, code), Date.now() + LIFETIME],
      );
      // Beklenmez: yanıt süresinden adresin kayıtlı olup olmadığı anlaşılmasın.
      mailer
        .send({
          to: email,
          subject: 'Zodi şifre sıfırlama kodu',
          text: `Merhaba ${user.name},\n\nKullanıcı adın: ${user.username}\nŞifre sıfırlama kodun: ${code}\n\nKod 15 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
        })
        .catch((error) => console.error('E-posta gönderilemedi:', error.message));
    }
    // Adres kayıtlı olmasa da aynı yanıt verilir.
    res.json({ ok: true });
  });

  router.post('/reset', async (req, res) => {
    const email = parseEmail(req.body?.email);
    const code = String(req.body?.code ?? '').trim();
    const password = parsePassword(req.body?.password);
    limitTry(req.ip);
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    // Deneme hakkı tek sorguda düşülür; eşzamanlı istekler sınırı aşamaz.
    const reset = user && (await db.get(
      `UPDATE password_resets SET attempts = attempts + 1
       WHERE user_id = ? AND expires_at > ? AND attempts < ? RETURNING code_hash`,
      [user.id, Date.now(), MAX_ATTEMPTS],
    ));
    const matches = reset && timingSafeEqual(
      Buffer.from(reset.code_hash), Buffer.from(hashCode(user.id, code)),
    );
    if (!matches) throw new AppError(INVALID);

    // Kod tek kullanımlık: yalnızca onu silebilen istek devam eder.
    const used = await db.run('DELETE FROM password_resets WHERE user_id = ? AND code_hash = ?', [
      user.id, reset.code_hash,
    ]);
    if (used.rowsAffected !== 1) throw new AppError(INVALID);

    // Eski oturumlar ve bildirim abonelikleri kapatılır.
    await db.batch([
      ['UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(password), user.id]],
      ['DELETE FROM sessions WHERE user_id = ?', [user.id]],
      ['DELETE FROM push_subscriptions WHERE user_id = ?', [user.id]],
    ]);
    onReset(user.id);
    res.json({ token: await createSession(db, user.id), user: ownUser(user) });
  });

  return router;
}
