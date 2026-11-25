import { useState } from 'react';
import { Link } from 'react-router';
import Avatar from '../components/Avatar.jsx';
import DeleteChatSheet from '../components/DeleteChatSheet.jsx';
import StatsBar from '../components/StatsBar.jsx';
import SwipeRow from '../components/SwipeRow.jsx';
import { useStore } from '../store.jsx';

function preview({ status, last }) {
  if (status === 'ended') return 'Sohbet sona erdi';
  if (!last) return 'Eşleştiniz, ilk mesajı gönder ✨';
  if (last.deleted) return 'Mesaj silindi';
  if (last.kind === 'game') return `🎮 Oyun: ${last.body}`;
  if (last.kind === 'social') {
    return last.mine ? 'Sosyal medyanı paylaştın' : 'Sosyal medyasını paylaştı';
  }
  return `${last.mine ? 'Sen: ' : ''}${last.body}`;
}

export default function Chats() {
  const { inbox } = useStore();
  const { chats } = inbox;
  const [deleting, setDeleting] = useState(null);
  const [openId, setOpenId] = useState(null); // aynı anda tek satır açık kalır
  const closeSheet = () => {
    setDeleting(null);
    setOpenId(null);
  };

  return (
    <main className="page">
      <StatsBar />
      <h1>Sohbetler</h1>
      {chats.length === 0 && <p className="empty">Henüz sohbetin yok. Keşfet sekmesinden istek gönder.</p>}
      <ul className="list">
        {chats.map((chat) => (
          <SwipeRow
            key={chat.id}
            open={openId === chat.id}
            onOpenChange={(open) => setOpenId(open ? chat.id : null)}
            onDelete={() => setDeleting(chat)}
            label={`${chat.partner.name} sohbetini sil`}
          >
            <Link to={`/chat/${chat.id}`} className={`chat-row ${chat.unread ? 'unread' : ''}`}>
              <Avatar user={chat.partner} />
              <div className="grow">
                <h2>
                  {chat.partner.name}
                  {chat.status === 'active' && (
                    <span className={`status ${chat.partner.online ? 'online' : ''}`}>
                      {chat.partner.online ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </span>
                  )}
                </h2>
                <p className="muted ellipsis">{preview(chat)}</p>
              </div>
              {chat.unread > 0 && (
                <b className="count" aria-label={`${chat.unread} okunmamış mesaj`}>
                  {chat.unread > 99 ? '99+' : chat.unread}
                </b>
              )}
            </Link>
          </SwipeRow>
        ))}
      </ul>
      {deleting && (
        <DeleteChatSheet chat={deleting} onClose={closeSheet} onDeleted={closeSheet} />
      )}
    </main>
  );
}
