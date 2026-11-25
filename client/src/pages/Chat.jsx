import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import Bubble from '../components/Bubble.jsx';
import { BlockIcon } from '../components/Icons.jsx';
import GameSheet, { waitingForMe } from '../components/GameSheet.jsx';
import MatchInfo from '../components/MatchInfo.jsx';
import SafetyNotice, { hasIban } from '../components/SafetyNotice.jsx';
import Sheet from '../components/Sheet.jsx';
import SocialSheet from '../components/SocialSheet.jsx';
import { find } from '../labels.js';
import { useStore } from '../store.jsx';
import useVisible from '../useVisible.js';

// Aynı mesajın iki kopyasından daha son değiştirilmiş olanı korunur.
const changedAt = (m) => m?.deletedAt ?? m?.editedAt ?? 0;

const merge = (current, incoming) => {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) {
    if (changedAt(byId.get(m.id)) <= changedAt(m)) byId.set(m.id, m);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

const isTalk = (m) => m.kind === 'text' || m.kind === 'icebreaker';

// Karşı taraf cevap yazana kadar kalan mesaj hakkı.
function remainingMessages(messages, myId, limit) {
  let sent = 0;
  for (const m of messages.filter(isTalk).reverse()) {
    if (m.senderId !== myId) break;
    sent += 1;
  }
  return Math.max(0, limit - sent);
}

function ChatView({ id }) {
  const { token, me, meta, socket, connected, version, act, toast } = useStore();
  const visible = useVisible();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  // Yazma alanının modu: yanıtlanan ya da düzenlenen mesaj.
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const bottom = useRef(null);
  const input = useRef(null);
  const [typing, setTyping] = useState(false);
  const [readId, setReadId] = useState(0);
  const typingSentAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api(`/api/chats/${encodeURIComponent(id)}`, { token })
      .then((data) => {
        if (cancelled) return;
        setChat(data.chat);
        setMessages((list) => merge(list, data.messages));
        setError('');
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id, token, version]);

  useEffect(() => {
    if (!socket) return undefined;
    let timer;
    const onMessage = (message) => {
      if (message.chatId !== id) return;
      setMessages((list) => merge(list, [message]));
      if (message.senderId !== me.id) setTyping(false);
    };
    const onTyping = ({ chatId }) => {
      if (chatId !== id) return;
      setTyping(true);
      clearTimeout(timer);
      timer = setTimeout(() => setTyping(false), 3500);
    };
    const onRead = ({ chatId, messageId }) => {
      if (chatId === id) setReadId((current) => Math.max(current, messageId));
    };
    socket.on('typing', onTyping);
    socket.on('chat:read', onRead);
    socket.on('message:new', onMessage);
    socket.on('message:updated', onMessage);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:updated', onMessage);
      socket.off('typing', onTyping);
      socket.off('chat:read', onRead);
      clearTimeout(timer);
    };
  }, [socket, id, me.id]);

  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  // Mesaj ekranda göründüyse okundu olarak işaretle.
  useEffect(() => {
    if (!visible || !connected || !lastId) return;
    act('chat:read', { chatId: id, messageId: lastId }).catch(() => {});
  }, [id, lastId, visible, connected, act]);

  const run = async (event, payload) => {
    setBusy(true);
    try {
      await act(event, payload);
      return true;
    } catch (e) {
      toast({ type: 'error', text: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startReply = (message) => {
    if (editing) setDraft('');
    setEditing(null);
    setReplyTo(message);
    input.current?.focus();
  };

  const startEdit = (message) => {
    setSelected(null);
    setSheet(null);
    setReplyTo(null);
    setEditing(message);
    setDraft(message.body);
    // Pencere kapandıktan sonra yazma alanına odaklan.
    requestAnimationFrame(() => input.current?.focus());
  };

  const deleteMessage = async () => {
    const messageId = selected.id;
    if (!(await run('message:delete', { chatId: id, messageId }))) return;
    if (editing?.id === messageId) cancelMode();
    setSheet(null);
  };

  const cancelMode = () => {
    if (editing) setDraft('');
    setEditing(null);
    setReplyTo(null);
  };

  // Hedef mesajın güncel hali gösterilir; bu arada silindiyse mod kapanır.
  const picked = editing ?? replyTo;
  const current = picked && messages.find((m) => m.id === picked.id);
  const target = current && !current.deletedAt ? current : null;

  const remaining = remainingMessages(messages, me.id, meta.messageLimit);
  // Düzenleme yeni mesaj sayılmaz.
  const blockedByLimit = remaining === 0 && !(editing && target);

  const send = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy || blockedByLimit) return;
    const ok = editing && target
      ? await run('message:edit', { chatId: id, messageId: target.id, body })
      : await run('message:send', { chatId: id, body, replyTo: target?.id });
    if (!ok) return;
    setDraft('');
    setEditing(null);
    setReplyTo(null);
  };

  const type = (e) => {
    setDraft(e.target.value);
    // "Yazıyor…" bilgisi en fazla 2 saniyede bir gönderilir.
    if (!editing && e.target.value && Date.now() - typingSentAt.current > 2000) {
      typingSentAt.current = Date.now();
      socket?.emit('typing', { chatId: id });
    }
  };

  const sendIcebreaker = async (icebreakerIndex) => {
    setSheet(null);
    await run('message:send', { chatId: id, icebreakerIndex });
  };

  const toList = () => navigate('/chats', { replace: true });
  const block = async () => {
    if (await run('user:block', { chatId: id })) toList();
  };

  if (!chat || error) {
    return (
      <div className="splash">
        <p>{error || 'Sohbet açılıyor…'}</p>
        <Link className="button" to="/chats">Sohbetlere dön</Link>
      </div>
    );
  }

  const { partner, social, status } = chat;
  const active = status === 'active';
  const seenUpTo = Math.max(readId, chat.partnerReadId);
  const lastMine = messages.findLast((m) => m.senderId === me.id && isTalk(m) && !m.deletedAt)?.id;
  const presence = typing ? 'yazıyor…' : partner.online ? 'Çevrimiçi' : 'Çevrimdışı';
  const authorOf = (senderId) => (senderId === me.id ? 'Sen' : partner.name);

  return (
    <main className="chat">
      <header className="chat-head">
        <Link to="/chats" className="icon-button" aria-label="Geri">‹</Link>
        <button className="partner" onClick={() => setSheet('profile')}>
          <Avatar user={partner} />
          <span>
            <b>{partner.name}</b>
            <small className={active && (typing || partner.online) ? 'online' : ''} aria-live="polite">
              {active ? presence : `${find(meta.signs, partner.sign).name} · ${partner.city}`}
            </small>
          </span>
        </button>
        <div className="head-actions">
          <button type="button" className="danger-text" onClick={() => setSheet('block')} aria-label="Engelle" title="Engelle">
            <BlockIcon />
          </button>
        </div>
      </header>

      {active && (
        <div className="toolbar">
          <button onClick={() => setSheet('icebreakers')}>Buz kırıcı</button>
          <button onClick={() => setSheet('games')}>
            Oyun
            {chat.games.some(waitingForMe) && <span className="dot" />}
          </button>
          <button onClick={() => setSheet('social')}>
            Sosyal
            {social.partnerShared && <span className="dot" />}
          </button>
        </div>
      )}

      {active && social.partnerShared && (
        <button className="banner" onClick={() => setSheet('social')}>
          {social.partner
            ? 'Hesaplar açıldı — görmek için dokun'
            : `${partner.name} sosyal medyasını paylaştı. Görmek için sen de paylaş.`}
        </button>
      )}

      {active && <SafetyNotice chatId={id} />}

      <div className="messages">
        {messages.length === 0 && <p className="empty">Sohbeti başlat ya da bir buz kırıcı seç.</p>}
        {messages.map((m) => {
          const mine = m.senderId === me.id;
          if (m.kind === 'game') {
            return (
              <button
                key={m.id}
                type="button"
                className="notice"
                disabled={!active}
                onClick={() => setSheet('games')}
              >
                🎮 {mine ? 'Oyun başlattın' : `${partner.name} oyun başlattı`}: {m.body}
              </button>
            );
          }
          if (m.kind === 'social') {
            return (
              <p key={m.id} className="notice">
                {mine ? 'Sosyal medyanı paylaştın' : `${partner.name} sosyal medyasını paylaştı`}
              </p>
            );
          }
          return (
            <Fragment key={m.id}>
              <Bubble
                message={m}
                mine={mine}
                seen={m.id <= seenUpTo}
                showSeen={m.id === lastMine}
                quoteAuthor={m.replyTo && authorOf(m.replyTo.senderId)}
                onSwipe={active && !mine && !m.deletedAt ? () => startReply(m) : undefined}
                onSelect={
                  active && mine && !m.deletedAt
                    ? () => { setSelected(m); setSheet('message'); }
                    : undefined
                }
              />
              {!mine && hasIban(m.body) && (
                <p className="warning">
                  ⚠️ Bu mesajda IBAN var. Para gönderme; şüpheleniyorsan kişiyi engelle.
                </p>
              )}
            </Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      {active && hasIban(draft) && (
        <p className="warning" role="alert">⚠️ IBAN bilgini paylaşmanı önermiyoruz.</p>
      )}

      {active && target && (
        <div className="compose-mode">
          <div>
            <b>{editing ? 'Mesajı düzenliyorsun' : `${authorOf(target.senderId)} kişisine yanıt`}</b>
            <span className="ellipsis">{target.body}</span>
          </div>
          <button type="button" className="icon-button" onClick={cancelMode} aria-label="Vazgeç">✕</button>
        </div>
      )}

      {active && remaining <= 2 && !(editing && target) && (
        <p className="warning" role="status">
          {remaining === 0
            ? `Üst üste ${meta.messageLimit} mesaj attın. ${partner.name} cevap yazınca devam edebilirsin.`
            : `${remaining} mesaj hakkın kaldı.`}
        </p>
      )}

      {active ? (
        <form className="composer" onSubmit={send}>
          <input
            ref={input}
            value={draft}
            onChange={type}
            maxLength={1000}
            placeholder="Mesaj yaz…"
            aria-label="Mesaj"
            enterKeyHint="send"
          />
          {/* preventDefault: gönder'e basınca klavye kapanmasın */}
          <button className="button" disabled={!draft.trim() || busy || blockedByLimit} onPointerDown={(e) => e.preventDefault()}>
            {editing && target ? 'Kaydet' : 'Gönder'}
          </button>
        </form>
      ) : (
        <div className="ended">
          <p>Bu sohbet sona erdi.</p>
          <button className="button danger" disabled={busy} onClick={() => setSheet('block')}>Engelle</button>
        </div>
      )}

      {sheet === 'message' && active && selected && (
        <Sheet title="Mesaj" onClose={() => setSheet(null)}>
          <p className="muted clamp">{selected.body}</p>
          <div className="actions">
            {selected.kind === 'text' && (
              <button type="button" className="button ghost" onClick={() => startEdit(selected)}>Düzenle</button>
            )}
            <button type="button" className="button danger" onClick={() => setSheet('delete-message')}>Sil</button>
          </div>
        </Sheet>
      )}
      {sheet === 'delete-message' && active && selected && (
        <Sheet title="Mesajı sil" onClose={() => setSheet(null)}>
          <p className="muted clamp">{selected.body}</p>
          <p>Mesaj iki taraftan da silinecek. Yerinde “Bu mesaj silindi” yazısı kalacak.</p>
          <div className="actions">
            <button className="button ghost" onClick={() => setSheet(null)}>Vazgeç</button>
            <button className="button danger" disabled={busy} onClick={deleteMessage}>Sil</button>
          </div>
        </Sheet>
      )}
      {sheet === 'icebreakers' && active && (
        <Sheet title="Buz kırıcılar" onClose={() => setSheet(null)}>
          <p className="muted">
            {remaining === 0
              ? 'Mesaj hakkın doldu; karşı taraf cevap yazınca gönderebilirsin.'
              : 'Seçtiğin soru hemen mesaj olarak gönderilir.'}
          </p>
          <ul className="options">
            {meta.icebreakers.map((question, index) => (
              <li key={question}>
                <button disabled={busy || remaining === 0} onClick={() => sendIcebreaker(index)}>{question}</button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {sheet === 'games' && active && <GameSheet chat={chat} onClose={() => setSheet(null)} />}
      {sheet === 'social' && active && <SocialSheet chat={chat} onClose={() => setSheet(null)} />}
      {sheet === 'profile' && (
        <Sheet title={`${partner.name}, ${partner.age ?? ''}`} onClose={() => setSheet(null)}>
          <p className="muted">{find(meta.signs, partner.sign).name} · {partner.city}</p>
          {chat.match && <MatchInfo score={chat.match} />}
          {partner.bio && <p className="bio">{partner.bio}</p>}
          <div className="tags">
            {partner.reasons.map((id) => <span key={id}>{find(meta.reasons, id).name}</span>)}
            {partner.job && <span>{partner.job}</span>}
          </div>
        </Sheet>
      )}
      {sheet === 'block' && (
        <Sheet title="Engelle" onClose={() => setSheet(null)}>
          <p>{partner.name} ile bir daha birbirinizin karşısına çıkmayacaksınız. Bu işlem geri alınamaz.</p>
          <div className="actions">
            <button className="button ghost" onClick={() => setSheet(null)}>Vazgeç</button>
            <button className="button danger" disabled={busy} onClick={block}>Engelle</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

// key: başka bir sohbete geçildiğinde ekran durumu sıfırlansın.
export default function Chat() {
  const { id } = useParams();
  return <ChatView key={id} id={id} />;
}
