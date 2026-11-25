import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '../store.jsx';

// Gelen isteği kabul etme / reddetme (bildirimde ve listede ortak).
export default function useRespond() {
  const { act, toast, refresh } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const respond = async (requestId, accept) => {
    setBusy(true);
    try {
      const { chatId } = await act('request:respond', { requestId, accept });
      if (chatId) navigate(`/chat/${chatId}`);
    } catch (error) {
      toast({ type: 'error', text: error.message });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return [respond, busy];
}
