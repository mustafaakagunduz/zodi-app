import { useState } from 'react';
import { useStore } from '../store.jsx';

const TEXT = {
  off: 'Yeni istek ve mesajlarda telefonuna bildirim gönderelim mi?',
  on: 'Bildirimler bu cihazda açık.',
  denied: 'Bildirim izni kapalı. Tarayıcı ya da telefon ayarlarından izin vermen gerekiyor.',
  unsupported: 'Bu tarayıcı ya da bağlantı bildirimleri desteklemiyor (HTTPS gerekir).',
  'ios-install':
    'iPhone’da bildirim için Safari’de Paylaş → “Ana Ekrana Ekle” de ve siteyi ana ekrandan aç.',
};

const DISMISS_KEY = 'burcdas.pushPrompt';

// prompt: Keşfet ekranındaki kapatılabilir hatırlatma. Aksi halde profildeki ayar.
export default function NotificationSettings({ prompt = false }) {
  const { pushState, setPush, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  if (!pushState || (prompt && (pushState !== 'off' || dismissed))) return null;

  const toggle = async (enable) => {
    setBusy(true);
    try {
      await setPush(enable);
    } catch {
      toast({ type: 'error', text: 'Bildirim ayarı değiştirilemedi.' });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <section className="card">
      <h2>🔔 Bildirimler</h2>
      <p className="muted">{TEXT[pushState]}</p>
      {(pushState === 'off' || pushState === 'on') && (
        <div className="actions">
          {prompt && <button type="button" className="button ghost" onClick={dismiss}>Şimdi değil</button>}
          <button
            type="button"
            className={`button ${pushState === 'on' ? 'ghost' : ''}`}
            disabled={busy}
            onClick={() => toggle(pushState === 'off')}
          >
            {pushState === 'on' ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
          </button>
        </div>
      )}
    </section>
  );
}
