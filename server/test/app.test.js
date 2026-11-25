import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { io as connect } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { CITIES, RAW_NEIGHBORS, areNeighbors } from '../src/data/cities.js';
import { signAspect, SIGNS, COMPATIBLE } from '../src/data/constants.js';
import { createDb } from '../src/db.js';
import { ICEBREAKERS, STATS_MIN_MEMBERS } from '../src/data/constants.js';
import { containsBannedWord } from '../src/moderation.js';
import { createPush } from '../src/push.js';

const dir = mkdtempSync(path.join(tmpdir(), 'mini-site-'));
let db, app, base;
const sockets = [];
const pushed = []; // telefona gönderilen bildirimler
const mails = []; // gönderilen e-postalar

before(async () => {
  db = await createDb({ url: `file:${path.join(dir, 'test.db')}` });
  const push = await createPush(db, {
    send: async (subscription, payload) => {
      if (subscription.endpoint.endsWith('/gone')) throw Object.assign(new Error(), { statusCode: 410 });
      pushed.push({ endpoint: subscription.endpoint, ...JSON.parse(payload) });
    },
  });
  const mailer = { send: async (mail) => mails.push(mail) };
  app = createApp({ db, push, mailer, registerLimit: 100, statsMinMembers: 0 });
  await new Promise((resolve) => app.server.listen(0, resolve));
  base = `http://localhost:${app.server.address().port}`;
});

after(async () => {
  sockets.forEach((s) => s.close());
  await new Promise((resolve) => app.io.close(resolve));
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

async function api(url, { token, method = 'GET', body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json()) };
}

let userCount = 100;
const bornYearsAgo = (age) => new Date().getFullYear() - age;

const profile = (over) => ({
  name: 'Test', gender: 'erkek', city: 'İstanbul', job: '', reasons: ['sohbet'], sign: 'koc',
  locationPref: 'farketmez', genderPref: 'kadin', bio: 'Merhaba, ben bir test.', username: `u${++userCount}`, password: 'sifre-12345',
  email: `u${userCount}@ornek.test`, birthYear: bornYearsAgo(25), isAdult: true, acceptTerms: true, explicitConsent: true, ...over,
});

async function join(over) {
  const { token, user, status } = await api('/api/register', { method: 'POST', body: profile(over) });
  assert.equal(status, 201);
  const socket = connect(base, { auth: { token }, transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  const act = (event, payload) => socket.timeout(3000).emitWithAck(event, payload);
  const next = (event) => new Promise((resolve) => socket.once(event, resolve));
  const candidates = async () => (await api('/api/candidates', { token })).candidates.map((c) => c.id);
  return { token, id: user.id, socket, act, next, candidates };
}

const woman = (over) => join({ gender: 'kadin', genderPref: 'erkek', sign: 'yay', ...over });

async function match(a, b) {
  const incoming = b.next('request:new');
  assert.equal((await a.act('request:send', { userId: b.id })).ok, true);
  const request = await incoming;
  const accepted = a.next('request:accepted');
  const result = await b.act('request:respond', { requestId: request.id, accept: true });
  assert.equal(result.ok, true);
  assert.equal((await accepted).chatId, result.chatId);
  return result.chatId;
}

describe('şehirler', () => {
  test('81 il var, komşuluklar tutarlı', () => {
    assert.equal(CITIES.length, 81);
    for (const [city, list] of Object.entries(RAW_NEIGHBORS)) {
      for (const other of list) {
        assert.ok(CITIES.includes(other), `${city}: bilinmeyen il ${other}`);
        assert.ok(RAW_NEIGHBORS[other].includes(city), `${other} listesinde ${city} eksik`);
      }
    }
    assert.ok(areNeighbors('İstanbul', 'Kocaeli'));
    assert.ok(!areNeighbors('İstanbul', 'Ankara'));
  });
});

describe('burç uyumu', () => {
  test('Koç için tam, kısmi ve uyumsuz burçlar', () => {
    assert.deepEqual(COMPATIBLE.koc, { full: ['aslan', 'yay'], partial: ['ikizler', 'terazi', 'kova'] });
    for (const other of ['koc', 'boga', 'yengec', 'basak', 'akrep', 'oglak', 'balik']) {
      assert.equal(signAspect('koc', other), null, other);
    }
  });

  test('uyum iki yönlüdür', () => {
    for (const a of SIGNS) {
      for (const b of SIGNS) assert.equal(signAspect(a.id, b.id), signAspect(b.id, a.id));
    }
  });
});

describe('yasaklı kelimeler', () => {
  test('farklı yazımlar yakalanır', () => {
    for (const text of [
      'orospu', 'OROSPU çocuğu', '0r0spu', 'siiiktir git', 'a m k', 'a.m.k', 'sen bir piçsin',
      'or\u200bospu', 'Şerefsiz!', 'FUCK you', 'götveren', 'amk ya',
      'sexting yapalım mı', 'SEXTING', 'Sextingi sever misin', 'seksting', 'SEKSTİNG', 's e x t i n g',
    ]) {
      assert.ok(containsBannedWord(text), text);
    }
  });

  test('masum kelimeler engellenmez', () => {
    for (const text of [
      'sıkıntı yok', 'SIKINTI YOK', 'çok sıkıldım', 'SIKIŞIK TRAFİK', 'seni eve götürürüm',
      'amin', 'ama ben', 'sikke koleksiyonu', 'piknik yapalım', 'yara bandı', 'amcam geldi',
      '1500 TL', 'sürtünme kuvveti', 'Gavur dağı', ...ICEBREAKERS,
    ]) {
      assert.ok(!containsBannedWord(text), text);
    }
  });
});

describe('uygulama', () => {
  test('geçersiz kayıt ve yetkisiz erişim reddedilir', async () => {
    const bad = await api('/api/register', { method: 'POST', body: profile({ city: 'Paris' }) });
    assert.equal(bad.status, 400);
    assert.equal((await api('/api/candidates', { token: 'yanlis' })).status, 401);
  });

  test('adaylar burç, cinsiyet ve konuma göre iki yönlü filtrelenir', async () => {
    const me = await join({ sign: 'boga', locationPref: 'komsu' });
    const near = await woman({ sign: 'basak', city: 'Kocaeli' });
    const far = await woman({ sign: 'basak', city: 'Ankara' });
    const wrongSign = await woman({ sign: 'yay' });
    const wrongPref = await woman({ sign: 'oglak', genderPref: 'kadin' });
    const picky = await woman({ sign: 'oglak', city: 'Kocaeli', locationPref: 'ayni' });
    const ids = await me.candidates();
    assert.ok(ids.includes(near.id));
    for (const other of [far, wrongSign, wrongPref, picky]) assert.ok(!ids.includes(other.id));
    assert.equal((await me.act('request:send', { userId: far.id })).ok, false);
  });

  test('istek, sohbet, ice-breaker ve yetki', async () => {
    const a = await join();
    const b = await woman();
    const stranger = await woman();
    const chatId = await match(a, b);
    assert.ok(!(await a.candidates()).includes(b.id));

    const received = b.next('message:new');
    assert.equal((await a.act('message:send', { chatId, body: 'Selam' })).ok, true);
    assert.equal((await received).body, 'Selam');
    const question = await a.act('message:send', { chatId, icebreakerIndex: 0 });
    assert.equal(question.message.kind, 'icebreaker');

    assert.equal((await stranger.act('message:send', { chatId, body: 'x' })).ok, false);
    assert.equal((await api(`/api/chats/${chatId}`, { token: stranger.token })).status, 404);
  });

  test('sosyal hesaplar ancak iki taraf da paylaşınca görünür', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    const view = async (u) => (await api(`/api/chats/${chatId}`, { token: u.token })).chat.social;

    const notified = b.next('social:shared');
    assert.equal((await a.act('social:share', { chatId, instagram: '@gizli.hesap' })).ok, true);
    await notified;
    const before = await api(`/api/chats/${chatId}`, { token: b.token });
    assert.equal(before.chat.social.partnerShared, true);
    assert.equal(before.chat.social.partner, null);
    assert.ok(!JSON.stringify(before).includes('gizli.hesap'));

    await b.act('social:share', { chatId, twitter: 'b_hesap' });
    assert.equal((await view(b)).partner.instagram, 'gizli.hesap');
    assert.equal((await view(a)).partner.twitter, 'b_hesap');

    await a.act('chat:delete', { chatId });
    assert.equal((await view(b)).partner, null);
  });

  test('ayrılınca sohbet biter, tekrar istek gönderilebilir', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    assert.equal((await a.act('chat:delete', { chatId })).ok, true);
    assert.equal((await api(`/api/chats/${chatId}`, { token: a.token })).status, 404);
    assert.equal((await b.act('message:send', { chatId, body: 'orada mısın' })).ok, false);
    assert.ok((await a.candidates()).includes(b.id));
    await match(a, b);
  });

  test('engellenen kişiler birbirine bir daha görünmez', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    assert.equal((await a.act('user:block', { chatId })).ok, true);
    assert.ok(!(await a.candidates()).includes(b.id));
    assert.ok(!(await b.candidates()).includes(a.id));
    assert.equal((await b.act('request:send', { userId: a.id })).ok, false);
    assert.equal((await b.act('message:send', { chatId, body: 'x' })).ok, false);
  });

  test('reddedilen istek tekrarlanamaz, karşılıklı istek eşleştirir', async () => {
    const a = await join();
    const b = await woman();
    const incoming = b.next('request:new');
    await a.act('request:send', { userId: b.id });
    await b.act('request:respond', { requestId: (await incoming).id, accept: false });
    assert.equal((await a.act('request:send', { userId: b.id })).ok, false);

    const c = await join();
    const d = await woman();
    const [first, second] = await Promise.all([
      c.act('request:send', { userId: d.id }),
      d.act('request:send', { userId: c.id }),
    ]);
    assert.ok(first.ok && second.ok);
    assert.ok(first.chatId || second.chatId);
    const inbox = await api('/api/inbox', { token: c.token });
    assert.equal(inbox.chats.length, 1);
    assert.equal(inbox.requests.length, 0);
  });

  test('onay vermeden kayıt olunamaz, onaysız eski hesap kullanamaz', async () => {
    for (const key of ['isAdult', 'acceptTerms', 'explicitConsent']) {
      const res = await api('/api/register', { method: 'POST', body: profile({ [key]: false }) });
      assert.equal(res.status, 400);
    }
    const a = await join();
    await db.run('UPDATE users SET consent_at = NULL WHERE id = ?', [a.id]);
    assert.equal((await api('/api/me', { token: a.token })).user.needsConsent, true);
    assert.equal((await api('/api/inbox', { token: a.token })).status, 403);
    const consent = { isAdult: true, acceptTerms: true, explicitConsent: true };
    await api('/api/setup', { token: a.token, method: 'POST', body: consent });
    assert.equal((await api('/api/inbox', { token: a.token })).status, 200);
  });

  test('okunmamış mesajlar sayılır ve okununca sıfırlanır', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    await a.act('message:send', { chatId, body: 'bir' });
    const { message } = await a.act('message:send', { chatId, body: 'iki' });
    const unread = async (u) => (await api('/api/inbox', { token: u.token })).chats[0].unread;
    assert.equal(await unread(b), 2);
    assert.equal(await unread(a), 0);
    await b.act('chat:read', { chatId, messageId: message.id });
    assert.equal(await unread(b), 0);
    await b.act('chat:read', { chatId, messageId: 0 });
    assert.equal(await unread(b), 0);
  });

  test('bildirim yalnızca abone olan ve ekranı kapalı kullanıcıya gider', async () => {
    const a = await join();
    const b = await woman();
    const subscribe = (user, endpoint) => api('/api/push', {
      token: user.token, method: 'POST',
      body: { endpoint, keys: { p256dh: 'p'.repeat(80), auth: 'a'.repeat(22) } },
    });
    assert.equal((await subscribe(b, 'https://ornek.com/x')).status, 400);
    assert.equal((await subscribe(b, 'http://fcm.googleapis.com/x')).status, 400);
    const endpoint = `https://fcm.googleapis.com/${b.id}`;
    assert.equal((await subscribe(b, endpoint)).status, 200);
    await subscribe(b, 'https://fcm.googleapis.com/gone');

    const chatId = await match(a, b);
    const mine = () => pushed.filter((p) => p.endpoint === endpoint);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    await settle();
    assert.equal(mine().length, 1); // istek bildirimi

    await a.act('message:send', { chatId, body: 'gizli mesaj' });
    await settle();
    assert.equal(mine().length, 2);
    assert.ok(!JSON.stringify(mine()).includes('gizli mesaj'));
    const rows = await db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', [b.id]);
    assert.equal(rows.length, 1); // süresi dolan abonelik silindi

    b.socket.emit('presence', { visible: true });
    await settle();
    await a.act('message:send', { chatId, body: 'ekran açık' });
    await settle();
    assert.equal(mine().length, 2);

    b.socket.emit('presence', { visible: false });
    await settle();
    await api('/api/push', { token: b.token, method: 'DELETE', body: { endpoint } });
    await a.act('message:send', { chatId, body: 'abonelik yok' });
    await settle();
    assert.equal(mine().length, 2);
  });

  test('adaylar uyum skoruna göre sıralanır', async () => {
    const me = await join({ sign: 'boga', reasons: ['evlilik'], city: 'Sivas', locationPref: 'komsu' });
    const best = await woman({ sign: 'basak', reasons: ['evlilik'], city: 'Sivas' });
    const mid = await woman({ sign: 'yengec', reasons: ['ciddi'], city: 'Tokat' });
    const low = await woman({ sign: 'akrep', reasons: ['sohbet'], city: 'Tokat' });
    const same = await woman({ sign: 'boga', city: 'Sivas' });
    const { candidates } = await api('/api/candidates', { token: me.token });
    const mine = candidates.filter((c) => [best.id, mid.id, low.id, same.id].includes(c.id));
    assert.deepEqual(mine.map((c) => [c.id, c.score.total]), [[best.id, 100], [mid.id, 77], [low.id, 50]]);
  });

  test('hesap silinince tüm veriler kaldırılır', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    await a.act('message:send', { chatId, body: 'silinecek' });
    await b.act('social:share', { chatId, instagram: 'b' });
    const gone = new Promise((resolve) => a.socket.once('account:deleted', resolve));
    assert.equal((await api('/api/me', { token: a.token, method: 'DELETE' })).status, 200);
    await gone;
    assert.equal((await api('/api/me', { token: a.token })).status, 401);
    assert.equal((await api('/api/inbox', { token: b.token })).chats.length, 0);
    assert.ok(!(await b.candidates()).includes(a.id));
    for (const [table, column, value] of [
      ['messages', 'chat_id', chatId], ['social_shares', 'chat_id', chatId],
      ['chats', 'user_a', a.id], ['requests', 'from_id', a.id], ['users', 'id', a.id],
    ]) {
      assert.equal((await db.all(`SELECT * FROM ${table} WHERE ${column} = ?`, [value])).length, 0, table);
    }
  });

  test('sohbet iki taraf da silince kalıcı olarak kaldırılır', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    await a.act('message:send', { chatId, body: 'iz' });
    const count = async () =>
      (await db.all('SELECT * FROM messages WHERE chat_id = ?', [chatId])).length;

    assert.equal((await a.act('chat:delete', { chatId })).ok, true);
    assert.equal((await api('/api/inbox', { token: a.token })).chats.length, 0);
    assert.equal((await api('/api/inbox', { token: b.token })).chats[0].status, 'ended');
    assert.equal(await count(), 1);

    assert.equal((await b.act('chat:delete', { chatId })).ok, true);
    assert.equal(await count(), 0);
    assert.equal((await db.all('SELECT * FROM chats WHERE id = ?', [chatId])).length, 0);
  });

  test('yalnızca kendi metin mesajın düzenlenebilir', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    const { message } = await a.act('message:send', { chatId, body: 'yalnış' });
    const question = (await a.act('message:send', { chatId, icebreakerIndex: 1 })).message;
    const edit = (user, messageId, body) => user.act('message:edit', { chatId, messageId, body });

    assert.equal((await edit(b, message.id, 'ele geçirdim')).ok, false);
    assert.equal((await edit(a, question.id, 'değiştim')).ok, false);
    assert.equal((await edit(a, message.id, '  ')).ok, false);
    const updated = b.next('message:updated');
    assert.equal((await edit(a, message.id, 'yanlış')).ok, true);
    assert.equal((await updated).body, 'yanlış');
    const view = await api(`/api/chats/${chatId}`, { token: b.token });
    assert.equal(view.messages[0].body, 'yanlış');
    assert.ok(view.messages[0].editedAt);
    assert.equal(view.messages[1].editedAt, null);
  });

  test('mesaj yanıtlanır, başka sohbetin mesajı alıntılanamaz', async () => {
    const a = await join();
    const b = await woman();
    const c = await woman();
    const chatId = await match(a, b);
    const otherChat = await match(a, c);
    const original = (await a.act('message:send', { chatId, body: 'soru' })).message;
    const foreign = (await a.act('message:send', { chatId: otherChat, body: 'özel' })).message;

    const reply = await b.act('message:send', { chatId, body: 'cevap', replyTo: original.id });
    assert.deepEqual(reply.message.replyTo, { id: original.id, senderId: a.id, body: 'soru', deleted: false });
    const leak = await b.act('message:send', { chatId, body: 'x', replyTo: foreign.id });
    assert.equal(leak.ok, false);

    await a.act('message:edit', { chatId, messageId: original.id, body: 'yeni soru' });
    const view = await api(`/api/chats/${chatId}`, { token: b.token });
    assert.equal(view.messages[1].replyTo.body, 'yeni soru');
  });

  test('kendi mesajını silince içerik iki taraftan ve sunucudan kalkar', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    const { message } = await a.act('message:send', { chatId, body: 'silinecek-metin' });
    await b.act('message:send', { chatId, body: 'cevap', replyTo: message.id });
    const remove = (user) => user.act('message:delete', { chatId, messageId: message.id });

    assert.equal((await remove(b)).ok, false);
    const updated = b.next('message:updated');
    assert.equal((await remove(a)).ok, true);
    assert.ok((await updated).deletedAt);
    assert.equal((await remove(a)).ok, false);

    const view = await api(`/api/chats/${chatId}`, { token: b.token });
    assert.ok(!JSON.stringify(view).includes('silinecek-metin'));
    assert.equal(view.messages[1].replyTo.deleted, true);
    assert.equal((await api('/api/inbox', { token: b.token })).chats[0].unread, 0);
    for (const [event, extra] of [
      ['message:edit', { messageId: message.id, body: 'geri' }],
      ['message:send', { replyTo: message.id, body: 'x' }],
    ]) {
      assert.equal((await a.act(event, { chatId, ...extra })).ok, false, event);
    }
  });

  test('yasaklı kelime mesajda, düzenlemede ve profilde reddedilir', async () => {
    const res = await api('/api/register', { method: 'POST', body: profile({ bio: 'ben bir şerefsizim' }) });
    assert.equal(res.status, 400);
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    assert.equal((await a.act('message:send', { chatId, body: 'siktir git' })).ok, false);
    const { message } = await a.act('message:send', { chatId, body: 'merhaba' });
    const edit = await a.act('message:edit', { chatId, messageId: message.id, body: 'amk' });
    assert.equal(edit.ok, false);
    const view = await api(`/api/chats/${chatId}`, { token: b.token });
    assert.deepEqual(view.messages.map((m) => m.body), ['merhaba']);
  });

  test('kullanıcı adı ve şifreyle giriş, çıkış', async () => {
    const post = (url, body, token) => api(url, { method: 'POST', body, token });
    const body = profile({ username: 'Ayse.K', password: 'cok-gizli-1' });
    assert.equal((await post('/api/register', body)).status, 201);
    assert.equal((await post('/api/register', { ...body, username: 'ayse.k' })).status, 400);
    for (const bad of [{ username: 'a b' }, { password: 'kisa' }, { birthYear: bornYearsAgo(17) }, { birthYear: '2000-01-01' }, { email: 'bozuk' }]) {
      assert.equal((await post('/api/register', profile(bad))).status, 400);
    }
    assert.equal((await post('/api/login', { username: 'ayse.k', password: 'yanlis-sifre' })).status, 400);
    assert.equal((await post('/api/login', { username: 'yok', password: 'cok-gizli-1' })).status, 400);

    const first = await post('/api/login', { username: 'AYSE.K', password: 'cok-gizli-1' });
    const second = await post('/api/login', { username: 'ayse.k', password: 'cok-gizli-1' });
    assert.equal(first.status, 200);
    await post('/api/logout', {}, first.token);
    assert.equal((await api('/api/me', { token: first.token })).status, 401);
    assert.equal((await api('/api/me', { token: second.token })).status, 200);
    const stored = await db.get("SELECT password_hash FROM users WHERE username = 'ayse.k'");
    assert.ok(!stored.password_hash.includes('cok-gizli-1'));
  });

  test('üst üste en fazla 5 mesaj; cevap gelince hak yenilenir', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    const say = (u) => u.act('message:send', { chatId, body: 'selam' });
    const sent = [];
    for (let i = 0; i < 5; i += 1) sent.push(await say(a));
    assert.ok(sent.every((r) => r.ok));
    assert.equal((await say(a)).ok, false);
    assert.equal((await a.act('message:send', { chatId, icebreakerIndex: 0 })).ok, false);
    // Silmek ya da oyun başlatmak hak kazandırmaz.
    await a.act('message:delete', { chatId, messageId: sent[0].message.id });
    await a.act('game:start', { chatId, type: 'xox' });
    assert.equal((await say(a)).ok, false);
    assert.equal((await say(b)).ok, true);
    assert.equal((await say(a)).ok, true);
  });

  test('yazıyor ve görüldü bilgisi karşı tarafa iletilir', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    const typing = b.next('typing');
    a.socket.emit('typing', { chatId });
    assert.equal((await typing).chatId, chatId);
    const { message } = await a.act('message:send', { chatId, body: 'selam' });
    const seen = a.next('chat:read');
    await b.act('chat:read', { chatId, messageId: message.id });
    assert.equal((await seen).messageId, message.id);
    const view = await api(`/api/chats/${chatId}`, { token: a.token });
    assert.equal(view.chat.partnerReadId, message.id);
    assert.equal(view.chat.partner.online, true);
    assert.equal(view.chat.match.why.length, 3);
  });

  test('yaş filtresi yalnızca istenirse ±1 esner', async () => {
    const me = await join({ sign: 'yengec', city: 'Rize' });
    const ids = {};
    for (const age of [21, 22, 23, 27, 28, 29]) {
      ids[(await woman({ sign: 'akrep', city: 'Rize', birthYear: bornYearsAgo(age) })).id] = age;
    }
    const ages = async (query) =>
      (await api(`/api/candidates?${query}`, { token: me.token })).candidates
        .filter((c) => ids[c.id]).map((c) => c.age).sort();
    assert.deepEqual(await ages('minAge=23&maxAge=27'), [23, 27]);
    assert.deepEqual(await ages('minAge=23&maxAge=27&flex=1'), [22, 23, 27, 28]);
    assert.deepEqual(await ages('online=1&minAge=29'), [29]);
    assert.deepEqual(await ages('place=same&reason=evlilik'), []);
  });

  test('engel kaldırılınca kişi yeniden görünür', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    await a.act('user:block', { chatId });
    const blocked = async () => (await api('/api/blocks', { token: a.token })).blocked.map((u) => u.id);
    assert.deepEqual(await blocked(), [b.id]);
    await b.act('user:unblock', { userId: a.id }); // engellenen kaldıramaz
    assert.deepEqual(await blocked(), [b.id]);
    await a.act('user:unblock', { userId: b.id });
    assert.deepEqual(await blocked(), []);
    assert.ok((await a.candidates()).includes(b.id));
  });

  test('oyunlar: cevaplar iki taraf yanıtlayınca açılır, XOX sırayla oynanır', async () => {
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    const games = async (u) => (await api(`/api/chats/${chatId}`, { token: u.token })).chat.games;

    await a.act('game:start', { chatId, type: 'thisthat' });
    assert.equal((await a.act('game:start', { chatId, type: 'thisthat' })).ok, false);
    assert.equal((await a.act('game:answer', { chatId, answers: [0, 1] })).ok, false);
    await a.act('game:answer', { chatId, answers: [0, 1, 0, 1, 0] });
    let [view] = await games(b);
    assert.equal(view.partnerDone, true);
    assert.equal(view.partner, null);
    await b.act('game:answer', { chatId, answers: [1, 1, 1, 1, 1] });
    [view] = await games(b);
    assert.deepEqual(view.partner, [0, 1, 0, 1, 0]);
    await a.act('game:close', { chatId, type: 'thisthat' });

    await a.act('game:start', { chatId, type: 'xox' });
    const play = async (u, cell) => (await u.act('game:move', { chatId, cell })).ok;
    assert.equal(await play(b, 0), false);
    assert.equal(await play(a, 0), true);
    assert.equal(await play(b, 0), false);
    for (const [u, cell] of [[b, 3], [a, 1], [b, 4], [a, 2]]) assert.equal(await play(u, cell), true);
    [view] = await games(b);
    assert.equal(view.result, 'lose');
    assert.equal(await play(b, 5), false);
  });

  test('şifremi unuttum: kodla şifre yenilenir, eski oturumlar kapanır', async () => {
    const post = (url, body) => api(url, { method: 'POST', body });
    const body = profile({ username: 'unutkan', email: 'Unutkan@Ornek.test' });
    const { token } = await post('/api/register', body);
    const duplicate = profile({ email: 'unutkan@ornek.test' });
    assert.equal((await post('/api/register', duplicate)).status, 400);

    // Kayıtlı olmayan adres de aynı yanıtı alır, e-posta gitmez.
    assert.equal((await post('/api/forgot', { email: 'yok@ornek.test' })).status, 200);
    assert.equal(mails.length, 0);
    assert.equal((await post('/api/forgot', { email: 'unutkan@ornek.test' })).status, 200);
    assert.equal(mails.at(-1).to, 'unutkan@ornek.test');
    assert.ok(mails.at(-1).text.includes('unutkan'));
    const code = mails.at(-1).text.match(/kodun: (\d{6})/)[1];

    const reset = (value) => post('/api/reset', {
      email: 'unutkan@ornek.test', code: value, password: 'yepyeni-sifre',
    });
    assert.equal((await reset(code === '000000' ? '111111' : '000000')).status, 400);
    const done = await reset(code);
    assert.equal(done.status, 200);
    assert.equal((await api('/api/me', { token })).status, 401);
    assert.equal((await api('/api/me', { token: done.token })).status, 200);
    assert.equal((await reset(code)).status, 400); // tek kullanımlık
    const login = (password) => post('/api/login', { username: 'unutkan', password });
    assert.equal((await login('sifre-12345')).status, 400);
    assert.equal((await login('yepyeni-sifre')).status, 200);
  });

  test('şifre kodu 5 yanlış denemeden sonra ve süresi dolunca geçersizdir', async () => {
    const post = (url, body) => api(url, { method: 'POST', body });
    const attempt = async (email, wrongTries, expired) => {
      await post('/api/register', profile({ email }));
      await post('/api/forgot', { email });
      const code = mails.at(-1).text.match(/kodun: (\d{6})/)[1];
      if (expired) await db.run('UPDATE password_resets SET expires_at = 0');
      const send = (value) => post('/api/reset', { email, code: value, password: 'yepyeni-sifre' });
      for (let i = 0; i < wrongTries; i += 1) await send(code === '000000' ? '111111' : '000000');
      return (await send(code)).status;
    };
    assert.equal(await attempt('dort@ornek.test', 4, false), 200);
    assert.equal(await attempt('bes@ornek.test', 5, false), 400);
    assert.equal(await attempt('sure@ornek.test', 0, true), 400);
  });

  test('örnek profiller gibi girişsiz profillere de istek gönderilebilir', async () => {
    const a = await join();
    const b = await woman();
    await db.run('UPDATE users SET username = NULL, email = NULL WHERE id = ?', [b.id]);
    assert.ok((await a.candidates()).includes(b.id));
    assert.equal((await a.act('request:send', { userId: b.id })).ok, true);
  });

  test('üye ve çevrimiçi sayısı girişsiz görülür', async () => {
    const stats = () => api('/api/stats');
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    const before = await stats();
    const a = await join();
    await settle();
    const joined = await stats();
    assert.equal(joined.total, before.total + 1);
    assert.equal(joined.online, before.online + 1);
    // Aynı kişinin ikinci bağlantısı sayıyı artırmaz.
    const tab = connect(base, { auth: { token: a.token }, transports: ['websocket'], forceNew: true });
    sockets.push(tab);
    await new Promise((resolve) => tab.once('connect', resolve));
    assert.equal((await stats()).online, joined.online);
    tab.close();
    a.socket.close();
    await settle();
    const left = await stats();
    assert.equal(left.online, before.online);
    assert.equal(left.total, joined.total);
    await db.run("INSERT INTO users (id, token_hash, name, gender, city, reason, sign, location_pref, gender_pref, bio, created_at) VALUES ('seed-test', 'seed-test', 'x', 'kadin', 'Rize', 'sohbet', 'koc', 'farketmez', 'erkek', 'x', 0)");
    assert.equal((await stats()).total, joined.total);
  });

  test('sayılar yalnızca üye eşiği aşılınca döner', async () => {
    assert.equal(STATS_MIN_MEMBERS, 100);
    const { total } = await api('/api/stats');
    const read = async (statsMinMembers) => {
      const other = createApp({ db, push: {}, registerLimit: 1, statsMinMembers });
      await new Promise((resolve) => other.server.listen(0, resolve));
      const res = await fetch(`http://localhost:${other.server.address().port}/api/stats`);
      const body = await res.json();
      await new Promise((resolve) => other.io.close(resolve));
      return body;
    };
    assert.deepEqual(await read(total + 1), { visible: false });
    assert.deepEqual(await read(total), { visible: true, total, online: 0 });
  });

  test('birden fazla kayıt nedeni uyum skorunu etkiler', async () => {
    const me = await join({ sign: 'boga', city: 'Bartın', reasons: ['flort', 'sohbet', 'sohbet'] });
    const mine = (await api('/api/me', { token: me.token })).user;
    assert.deepEqual(mine.reasons, ['sohbet', 'flort']);
    const add = (reasons) => woman({ sign: 'basak', city: 'Bartın', reasons });
    const same = await add(['sohbet', 'flort']);
    const partial = await add(['sohbet']);
    const extra = await add(['sohbet', 'flort', 'evlilik']);
    const apart = await add(['evlilik']);
    const list = async (query = '') => (await api(`/api/candidates?${query}`, { token: me.token })).candidates;
    const all = await list();
    const points = (u) => all.find((c) => c.id === u.id).score.reason;
    assert.equal(points(same), 25);
    // partial: (25 + 12) / 2 = 18,5 ile 25'in ortalaması
    assert.equal(points(partial), 22);
    // extra: karşılıksız 'evlilik' puanı düşürür: ((25 + 25 + 5) / 3 ile 25) ortalaması
    assert.equal(points(extra), 22);
    assert.equal(points(apart), 5);
    const filtered = (await list('reason=evlilik')).map((c) => c.id);
    assert.ok(filtered.includes(extra.id) && filtered.includes(apart.id));
    assert.ok(!filtered.includes(same.id));

    for (const reasons of [[], ['yok'], 'sohbet', undefined]) {
      const res = await api('/api/register', { method: 'POST', body: profile({ reasons }) });
      assert.equal(res.status, 400);
    }
  });

  test('e-posta ve biyografi isteğe bağlıdır', async () => {
    for (const email of ['', '   ', undefined]) {
      const res = await api('/api/register', { method: 'POST', body: profile({ email, bio: '' }) });
      assert.equal(res.status, 201);
      assert.equal(res.user.email, null);
      assert.equal(res.user.bio, '');
      assert.equal((await api('/api/inbox', { token: res.token })).status, 200);
    }
    const long = profile({ bio: 'x'.repeat(301) });
    assert.equal((await api('/api/register', { method: 'POST', body: long })).status, 400);
  });

  test('profildeki tüm seçimler, doğum yılı dahil, güncellenebilir', async () => {
    const a = await join();
    const put = (body) => api('/api/me', { token: a.token, method: 'PUT', body });
    const next = profile({
      name: 'Yeni', gender: 'kadin', sign: 'balik', city: 'Van', job: 'Aşçı', reasons: ['flort'],
      genderPref: 'erkek', locationPref: 'ayni', bio: 'yeni', birthYear: bornYearsAgo(40),
    });
    const { user } = await put(next);
    for (const key of ['name', 'gender', 'sign', 'city', 'job', 'genderPref', 'locationPref', 'bio', 'birthYear']) {
      assert.equal(user[key], next[key], key);
    }
    assert.equal(user.age, 40);
    assert.equal((await put({ ...next, birthYear: bornYearsAgo(15) })).status, 400);
    // Profil güncellemesi giriş bilgilerini değiştiremez.
    assert.equal(user.username, (await put({ ...next, username: 'baskasi' })).user.username);
  });

  test('hesap ayarları mevcut şifreyle değişir, diğer oturumlar kapanır', async () => {
    const body = profile({ username: 'ayarci' });
    const first = await api('/api/register', { method: 'POST', body });
    const login = (username, password) =>
      api('/api/login', { method: 'POST', body: { username, password } });
    const other = await login('ayarci', body.password);
    const taken = await join();
    const takenName = (await api('/api/me', { token: taken.token })).user.username;
    const update = (changes) => api('/api/me/account', {
      token: first.token,
      method: 'PUT',
      body: { username: 'ayarci', email: body.email, currentPassword: body.password, ...changes },
    });

    assert.equal((await update({ currentPassword: 'yanlis-sifre', username: 'calinti' })).status, 400);
    assert.equal((await update({ username: takenName })).status, 400);
    assert.equal((await update({ newPassword: 'kisa' })).status, 400);

    const renamed = await update({ username: 'Yeni.Ad', email: '' });
    assert.equal(renamed.user.username, 'yeni.ad');
    assert.equal(renamed.user.email, null);
    assert.equal((await api('/api/me', { token: other.token })).status, 200);

    assert.equal((await update({ username: 'yeni.ad', newPassword: 'degisen-sifre' })).status, 200);
    assert.equal((await api('/api/me', { token: other.token })).status, 401);
    assert.equal((await api('/api/me', { token: first.token })).status, 200);
    assert.equal((await login('yeni.ad', body.password)).status, 400);
    assert.equal((await login('yeni.ad', 'degisen-sifre')).status, 200);
  });

  test('gelen istek, gönderenin uyum bilgisiyle listelenir', async () => {
    const a = await join();
    const b = await woman();
    await a.act('request:send', { userId: b.id });
    const [request] = (await api('/api/inbox', { token: b.token })).requests;
    assert.equal(request.from.id, a.id);
    assert.equal(request.score.why.length, 3);
    assert.ok(request.score.total > 0);
  });

  test('engelleyenin sohbet listesinde engellenen kişi görünmez', async () => {
    const chats = async (u) => (await api('/api/inbox', { token: u.token })).chats;
    // Açık sohbetten engelleme
    const a = await join();
    const b = await woman();
    const chatId = await match(a, b);
    await a.act('user:block', { chatId });
    assert.equal((await chats(a)).length, 0);
    assert.equal((await chats(b))[0].status, 'ended');
    // Engel kaldırılsa da eski sohbet geri gelmez
    await a.act('user:unblock', { userId: b.id });
    assert.equal((await chats(a)).length, 0);
    // Karşı taraf sohbeti bitirdikten sonra engelleme
    const c = await join();
    const d = await woman();
    const ended = await match(c, d);
    await d.act('chat:delete', { chatId: ended });
    assert.equal((await chats(c)).length, 1);
    await c.act('user:block', { chatId: ended });
    assert.equal((await chats(c)).length, 0);
  });
});
