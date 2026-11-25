import UserCard from '../components/UserCard.jsx';
import useRespond from '../components/useRespond.js';
import { useStore } from '../store.jsx';

// Gelen görüşme istekleri.
export default function Requests() {
  const { inbox } = useStore();
  const [respond, busy] = useRespond();
  const { requests } = inbox;

  return (
    <main className="page">
      <h1>Gelen istekler</h1>
      {requests.length === 0 && <p className="empty">Şu an bekleyen isteğin yok.</p>}
      <ul className="list">
        {requests.map(({ id, from, score }) => (
          <UserCard key={id} user={{ ...from, score }}>
            <div className="actions">
              <button className="button ghost" disabled={busy} onClick={() => respond(id, false)}>Reddet</button>
              <button className="button" disabled={busy} onClick={() => respond(id, true)}>Kabul et</button>
            </div>
          </UserCard>
        ))}
      </ul>
    </main>
  );
}
