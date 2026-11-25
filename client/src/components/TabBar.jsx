import { NavLink } from 'react-router';
import { useStore } from '../store.jsx';
import { ChatIcon, MailIcon, UserIcon } from './Icons.jsx';
import LogoMark from './LogoMark.jsx';

export default function TabBar() {
  const { inbox } = useStore();
  const unread = inbox.chats.reduce((sum, chat) => sum + chat.unread, 0);
  const badge = (count) => count > 0 && <b className="badge">{count > 99 ? '99+' : count}</b>;
  return (
    <nav className="tabs">
      <NavLink to="/" end><span><LogoMark /></span>Keşfet</NavLink>
      <NavLink to="/requests">
        <span><MailIcon /></span>İstekler
        {badge(inbox.requests.length)}
      </NavLink>
      <NavLink to="/chats">
        <span><ChatIcon /></span>Sohbetler
        {badge(unread)}
      </NavLink>
      <NavLink to="/profile"><span><UserIcon /></span>Profil</NavLink>
    </nav>
  );
}
