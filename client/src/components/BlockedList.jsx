import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';

export default function BlockedList() {
  const { token, version, act, toast } = useStore();
  const [blocked, setBlocked] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api('/api/blocks', { token })
      .then((data) => !cancelled && setBlocked(data.blocked))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, version]);

  const unblock = async (userId) => {
    try {
      await act('user:unblock', { userId });
    } catch (error) {
      toast({ type: 'error', text: error.message });
    }
  };

  return (
    <section className="card">
      <h2>Engellediklerim</h2>
      {blocked?.length === 0 && <p className="muted">Kimseyi engellemedin.</p>}
      <ul className="list">
        {blocked?.map((user) => (
          <li key={user.id} className="blocked">
            <span>{user.name} <small>{user.city}</small></span>
            <button type="button" className="button ghost small" onClick={() => unblock(user.id)}>
              Engeli kaldır
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
