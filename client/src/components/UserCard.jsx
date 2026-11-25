import { find } from '../labels.js';
import { useStore } from '../store.jsx';
import Avatar from './Avatar.jsx';
import MatchInfo from './MatchInfo.jsx';

// Aday kartı. Keşfet listesinde ve profildeki önizlemede aynı görünüm kullanılır.
export default function UserCard({ user, as: Tag = 'li', children }) {
  const { meta } = useStore();
  return (
    <Tag className="card">
      <div className="card-head">
        <Avatar user={user} />
        <div>
          <h2>{user.name}, {user.age}</h2>
          <p className="muted">
            {find(meta.signs, user.sign).name} · {find(meta.genders, user.gender).name} · {user.city}
            {user.job && ` · ${user.job}`}
          </p>
        </div>
      </div>
      {user.score && <MatchInfo score={user.score} />}
      {user.bio && <p className="bio">{user.bio}</p>}
      <div className="tags">
        {user.reasons.map((id) => <span key={id}>{find(meta.reasons, id).name}</span>)}
        {user.stretched && <span>±1 yaş</span>}
      </div>
      {children}
    </Tag>
  );
}
