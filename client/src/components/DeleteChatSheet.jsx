import { useState } from 'react';
import { useStore } from '../store.jsx';
import Sheet from './Sheet.jsx';

export default function DeleteChatSheet({ chat, onClose, onDeleted }) {
  const { act, toast } = useStore();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await act('chat:delete', { chatId: chat.id });
      onDeleted();
    } catch (error) {
      toast({ type: 'error', text: error.message });
      setBusy(false);
    }
  };

  return (
    <Sheet title="Sohbeti sil" onClose={onClose}>
      <p>
        {chat.partner.name} ile sohbetin listenden silinecek ve geri getirilemeyecek.
        {chat.status === 'active' && ' Sohbet karşı taraf için de sona erecek.'}
      </p>
      <p className="muted">Mesajlar, iki taraf da sohbeti sildiğinde sunucudan kalıcı olarak silinir.</p>
      <div className="actions">
        <button type="button" className="button ghost" onClick={onClose}>Vazgeç</button>
        <button type="button" className="button danger" disabled={busy} onClick={confirm}>Sil</button>
      </div>
    </Sheet>
  );
}
