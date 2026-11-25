import { useRef, useState } from 'react';
import { TrashIcon } from './Icons.jsx';

const WIDTH = 72; // soldan açılan silme düğmesinin genişliği
const SWIPE = 40; // bu kadar yatay hareket açar ya da kapatır
const LONG_PRESS = 500;

// Basılı tutunca veya sağa kaydırınca soldan silme düğmesi gelen satır; sola kaydırınca kapanır.
export default function SwipeRow({ open, onOpenChange, onDelete, label, children }) {
  const start = useRef(null);
  const timer = useRef(null);
  const ignoreClick = useRef(false);
  const [drag, setDrag] = useState(null); // sürükleme sırasında açık genişlik

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
    setDrag(null);
  };

  const down = (e) => {
    ignoreClick.current = false;
    if (!e.isPrimary || e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, dx: 0, swiping: false };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      ignoreClick.current = true;
      onOpenChange(true);
    }, LONG_PRESS);
  };

  const move = (e) => {
    const from = start.current;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (!from.swiping) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      clearTimeout(timer.current);
      // Dikey hareket listeyi kaydırır.
      if (Math.abs(dy) >= Math.abs(dx)) return cancel();
      from.swiping = true;
      ignoreClick.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    from.dx = dx;
    setDrag(Math.max(0, Math.min((open ? WIDTH : 0) + dx, WIDTH)));
  };

  const up = () => {
    const from = start.current;
    if (from?.swiping) {
      if (!open && from.dx >= SWIPE) onOpenChange(true);
      if (open && from.dx <= -SWIPE) onOpenChange(false);
    }
    cancel();
  };

  const click = (e) => {
    // Kaydırma ya da basılı tutma sohbeti açmasın; açık satıra dokunmak satırı kapatır.
    if (ignoreClick.current || open) {
      e.preventDefault();
      if (!ignoreClick.current) onOpenChange(false);
      ignoreClick.current = false;
    }
  };

  const reveal = drag ?? (open ? WIDTH : 0);

  return (
    <li className={`chat-item ${drag === null ? '' : 'dragging'}`}>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${reveal}px)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onPointerLeave={() => !start.current?.swiping && cancel()}
        onClickCapture={click}
        // Android'de basılı tutma ve bilgisayarda sağ tık.
        onContextMenu={(e) => {
          e.preventDefault();
          clearTimeout(timer.current);
          onOpenChange(true);
        }}
        // Klavyeyle: satır seçiliyken Delete tuşu.
        onKeyDown={(e) => {
          ignoreClick.current = false;
          if (e.key === 'Delete') onOpenChange(true);
          if (e.key === 'Escape') onOpenChange(false);
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
      <button
        type="button"
        className="row-delete"
        style={{ transform: `translateX(${reveal - WIDTH}px)`, visibility: reveal ? 'visible' : 'hidden' }}
        onClick={onDelete}
        aria-label={label}
        title="Sohbeti sil"
      >
        <TrashIcon />
      </button>
    </li>
  );
}
