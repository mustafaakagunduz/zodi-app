import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../api.js';
import FilterSheet, { defaultFilters } from '../components/FilterSheet.jsx';
import { FilterIcon, RefreshIcon } from '../components/Icons.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import StatsBar from '../components/StatsBar.jsx';
import UserCard from '../components/UserCard.jsx';
import { find } from '../labels.js';
import { useStore } from '../store.jsx';

function Candidate({ user }) {
  const { act, toast, refresh } = useStore();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const { chatId } = await act('request:send', { userId: user.id });
      if (chatId) navigate(`/chat/${chatId}`);
    } catch (error) {
      toast({ type: 'error', text: error.message });
      refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <UserCard user={user}>
      <button className="button" disabled={user.relation !== 'none' || sending} onClick={send}>
        {{ none: 'Görüşme isteği at', sent: 'İstek gönderildi', rejected: 'İstek kabul edilmedi' }[user.relation]}
      </button>
    </UserCard>
  );
}

const toQuery = (filters) =>
  new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, value === true ? '1' : value || '']),
  ).toString();

export default function Discover() {
  const { token, me, meta, version, refresh } = useStore();
  const [results, setCandidates] = useState(null);
  const [error, setError] = useState('');
  const storageKey = `burcdas.filters.${me.id}`;
  const [filters, setFilters] = useState(() => ({
    ...defaultFilters,
    ...JSON.parse(localStorage.getItem(storageKey) ?? '{}'),
  }));
  const [filtering, setFiltering] = useState(false);
  const query = toQuery(filters);
  const filtered = query !== toQuery(defaultFilters);

  const apply = (next) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setFilters(next);
    setFiltering(false);
  };

  useEffect(() => {
    let cancelled = false;
    api(`/api/candidates?${query}`, { token })
      .then((data) => {
        if (cancelled) return;
        setCandidates(data.candidates);
        setError('');
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [token, version, query]);

  // Sana istek gönderenler "İstekler" sayfasında gösterilir.
  const candidates = results?.filter((user) => user.relation !== 'received');
  const names = (ids) => ids.map((id) => find(meta.signs, id).name).join(', ');
  const { full, partial } = meta.compatible[me.sign];

  return (
    <main className="page">
      <StatsBar />
      <div className="page-head">
        <h1>Keşfet</h1>
        <div className="actions">
          <button
            className={`button square ${filtered ? '' : 'ghost'}`}
            onClick={() => setFiltering(true)}
            aria-label={filtered ? 'Filtrele (filtre açık)' : 'Filtrele'}
            title="Filtrele"
          >
            <FilterIcon />
          </button>
          <button className="button ghost square" onClick={refresh} aria-label="Yenile" title="Yenile">
            <RefreshIcon />
          </button>
        </div>
      </div>
      <p className="muted">
        {find(meta.signs, me.sign).name} için tam uyumlu: {names(full)}. Kısmen: {names(partial)}.
        <br />Burç uyumu eğlence amaçlıdır.
      </p>
      <NotificationSettings prompt />
      {error && <p className="error">{error}</p>}
      {!candidates && !error && <p className="empty">Adaylar aranıyor…</p>}
      {candidates?.length === 0 && (
        <p className="empty">
          {filtered
            ? 'Filtrene uyan aday yok. Filtreyi genişletmeyi dene.'
            : 'Şimdilik sana uygun aday yok. Biraz sonra tekrar bak ya da profilinden konum tercihini genişlet.'}
        </p>
      )}
      <ul className="list">
        {candidates?.map((user) => <Candidate key={user.id} user={user} />)}
      </ul>
      {filtering && <FilterSheet filters={filters} onApply={apply} onClose={() => setFiltering(false)} />}
    </main>
  );
}
