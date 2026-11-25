import { find, symbolOf } from '../labels.js';
import { useStore } from '../store.jsx';

export default function Avatar({ user }) {
  const { meta } = useStore();
  return (
    <span className={`avatar ${find(meta.signs, user.sign).element}`} aria-hidden="true">
      {symbolOf(meta, user.sign)}
      {user.online && <span className="dot" />}
    </span>
  );
}
