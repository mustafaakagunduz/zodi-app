import { useRef, useState } from 'react';

const TRIGGER = 56; // bu kadar sağa kaydırılırsa yanıt açılır
const LIMIT = 80;

const time = (ms) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

// seen: yalnızca kendi mesajlarında; showSeen son mesajda "Görüldü" yazısını açar.
// onSwipe verilirse balon sağa kaydırılabilir; onSelect verilirse dokunulabilir.
export default function Bubble({ message, mine, seen, showSeen, quoteAuthor, onSwipe, onSelect }) {
  const start = useRef(null);
  const distance = useRef(0);
  const [offset, setOffset] = useState(0);

  const deleted = Boolean(message.deletedAt);

  const reset = () => {
    start.current = null;
    distance.current = 0;
    setOffset(0);
  };

  const swipe = onSwipe && {
    onPointerDown: (e) => {
      if (e.isPrimary && e.button === 0) start.current = { x: e.clientX, y: e.clientY, active: false };
    },
    onPointerMove: (e) => {
      const from = start.current;
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (!from.active) {
        // Dikey hareket sayfayı kaydırır; yalnızca belirgin yatay hareket yakalanır.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) start.current = null;
        if (dx < 10 || dx < Math.abs(dy)) return;
        from.active = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        window.getSelection()?.removeAllRanges();
      }
      distance.current = Math.max(0, Math.min(dx, LIMIT));
      setOffset(distance.current);
    },
    onPointerUp: () => {
      if (distance.current >= TRIGGER) onSwipe();
      reset();
    },
    onPointerCancel: reset,
  };

  const select = onSelect && {
    role: 'button',
    tabIndex: 0,
    onClick: onSelect,
    onKeyDown: (e) => e.key === 'Enter' && onSelect(),
  };

  return (
    <div className={`message-row ${mine ? 'mine' : ''}`}>
      {offset > 0 && (
        <span className="reply-hint" style={{ opacity: offset / TRIGGER }} aria-hidden="true">↩</span>
      )}
      <div
        className={`bubble ${mine ? 'mine' : ''} ${deleted ? 'deleted' : message.kind} ${onSwipe ? 'swipeable' : ''} ${offset ? 'dragging' : ''}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        {...swipe}
        {...select}
      >
        {message.kind === 'icebreaker' && !deleted && <em>❄️ Buz kırıcı</em>}
        {message.replyTo && !deleted && (
          <blockquote>
            <b>{quoteAuthor}</b>
            <span className="clamp">
              {message.replyTo.deleted ? 'Bu mesaj silindi' : message.replyTo.body}
            </span>
          </blockquote>
        )}
        <p>{deleted ? '🚫 Bu mesaj silindi' : message.body}</p>
      </div>
      <small className="meta">
        {message.editedAt && !deleted && 'düzenlendi · '}
        <time>{time(message.createdAt)}</time>
        {mine && !deleted && (
          <span className={seen ? 'seen' : ''} aria-label={seen ? 'Görüldü' : 'Gönderildi'}>
            {seen ? ' ✓✓' : ' ✓'}{showSeen && (seen ? ' Görüldü' : ' Gönderildi')}
          </span>
        )}
      </small>
    </div>
  );
}
