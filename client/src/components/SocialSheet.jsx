import { useState } from 'react';
import { useStore } from '../store.jsx';
import Sheet from './Sheet.jsx';

const NETWORKS = [
  { id: 'instagram', name: 'Instagram', url: 'https://instagram.com/' },
  { id: 'twitter', name: 'Twitter / X', url: 'https://x.com/' },
];

export default function SocialSheet({ chat, onClose }) {
  const { act } = useStore();
  const { mine, partner, partnerShared } = chat.social;
  const [form, setForm] = useState({ instagram: mine?.instagram ?? '', twitter: mine?.twitter ?? '' });
  const [status, setStatus] = useState({ busy: false, error: '' });
  const { name } = chat.partner;

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      await act('social:share', { chatId: chat.id, ...form });
      setStatus({ busy: false, error: '' });
    } catch (error) {
      setStatus({ busy: false, error: error.message });
    }
  };

  let info;
  if (partner) info = 'İkiniz de paylaştınız, hesaplar açıldı 🎉';
  else if (mine) info = `Paylaştın. ${name} paylaşınca hesaplar ikinize de açılacak.`;
  else if (partnerShared) info = `${name} paylaştı! Görmek için sen de paylaş.`;
  else info = `Hesaplar ancak ikiniz de paylaşırsanız görünür. Paylaştığını ${name} bilecek.`;

  return (
    <Sheet title="Sosyal medya" onClose={onClose}>
      <p className="muted">{info}</p>
      {partner && (
        <div className="socials">
          {NETWORKS.filter((n) => partner[n.id]).map((n) => (
            <a key={n.id} href={`${n.url}${partner[n.id]}`} target="_blank" rel="noreferrer">
              <b>{n.name}</b> @{partner[n.id]}
            </a>
          ))}
        </div>
      )}
      <form className="form" onSubmit={submit}>
        {NETWORKS.map((n) => (
          <label key={n.id} className="field">
            {n.name} kullanıcı adın
            <input
              value={form[n.id]}
              onChange={(e) => setForm({ ...form, [n.id]: e.target.value })}
              placeholder="@kullaniciadi"
              maxLength={31}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        ))}
        {status.error && <p className="error" role="alert">{status.error}</p>}
        <button className="button big" disabled={status.busy || (!form.instagram.trim() && !form.twitter.trim())}>
          {mine ? 'Güncelle' : 'Paylaş'}
        </button>
      </form>
    </Sheet>
  );
}
