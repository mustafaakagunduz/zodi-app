import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { find } from '../labels.js';
import { useStore } from '../store.jsx';
import Avatar from './Avatar.jsx';
import useRespond from './useRespond.js';

function Toast({ toast }) {
  const { meta, dismissToast } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [respond, busy] = useRespond();
  const { id, type } = toast;

  // İstek bildirimi yanıtlanmazsa kapanır; istek "İstekler" sekmesinde kalır.
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(id), type === 'request' ? 15000 : 4500);
    return () => clearTimeout(timer);
  }, [id, type, dismissToast]);

  if (type === 'request') {
    const { from } = toast.request;
    const answer = async (accept) => {
      await respond(toast.request.id, accept);
      dismissToast(id);
    };
    return (
      <div className="toast">
        <div className="toast-row">
          <Avatar user={from} />
          <p>
            <b>{from.name}</b> seninle konuşmak istiyor
            <small>{find(meta.signs, from.sign).name} · {from.city}</small>
          </p>
          <button className="icon-button" onClick={() => dismissToast(id)} aria-label="Kapat">✕</button>
        </div>
        <div className="actions">
          <button className="button ghost" disabled={busy} onClick={() => answer(false)}>Reddet</button>
          <button className="button" disabled={busy} onClick={() => answer(true)}>Kabul et</button>
        </div>
      </div>
    );
  }

  // Zaten o sohbetteysek bilgi ekranda görünüyor.
  const inChat = pathname === `/chat/${toast.chatId}`;
  if ((type === 'social' || type === 'message') && inChat) return null;

  return (
    <button
      className={`toast ${type}`}
      onClick={() => {
        if (toast.chatId) navigate(`/chat/${toast.chatId}`);
        dismissToast(id);
      }}
    >
      <span className="clamp">{toast.text}</span>
    </button>
  );
}

export default function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}
