import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import useVisible from '../useVisible.js';

const REFRESH = 15_000;

// Toplam üye ve o an çevrimiçi kişi sayısı.
export default function StatsBar() {
  const { connected } = useStore();
  const visible = useVisible();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!visible) return undefined; // arka plandayken sorgulama
    let cancelled = false;
    const load = () =>
      api('/api/stats')
        .then((data) => !cancelled && setStats(data))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // connected: giriş yapınca kendi bağlantın da hemen sayıya yansısın.
  }, [visible, connected]);

  const format = (n) => n.toLocaleString('tr-TR');

  if (!stats?.visible) return null;

  return (
    <div className="stats">
      <span><b>{format(stats.total)}</b> üye</span>
      <span><i className="dot" aria-hidden="true" /><b>{format(stats.online)}</b> çevrimiçi</span>
    </div>
  );
}
