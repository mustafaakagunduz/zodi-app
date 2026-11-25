import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';
import { disablePush, enablePush, syncPush } from './push.js';

const TOKEN_KEY = 'burcdas.token';
const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const emptyInbox = { requests: [], chats: [] };

export function StoreProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [meta, setMeta] = useState(null);
  const [me, setMe] = useState(null);
  const [bootError, setBootError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [inbox, setInbox] = useState(emptyInbox);
  // Sunucu "bir şeyler değişti" dediğinde artar; sayfalar verisini yeniler.
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [pushState, setPushState] = useState(null);
  const toastId = useRef(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback((data) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((list) => {
      // Aynı sohbetten art arda gelen mesaj bildirimleri üst üste yığılmasın.
      const rest = data.type === 'message'
        ? list.filter((t) => t.type !== 'message' || t.chatId !== data.chatId)
        : list;
      return [...rest, { ...data, id }].slice(-3);
    });
  }, []);

  const logout = useCallback(() => {
    disablePush().catch(() => {});
    setPushState(null);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMe(null);
    setInbox(emptyInbox);
    setToasts([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBootError('');
    (async () => {
      try {
        const metaData = await api('/api/meta');
        const meData = token ? await api('/api/me', { token }) : null;
        if (cancelled) return;
        setMeta(metaData);
        if (meData) setMe(meData.user);
      } catch (error) {
        if (cancelled) return;
        if (error.status === 401) logout();
        else setBootError(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [token, attempt, logout]);

  // Eksik hesap için canlı bağlantı kurulmaz.
  const needsSetup = Boolean(me && (me.needsConsent || me.needsCredentials || me.needsBirthYear));
  const userId = me && !needsSetup ? me.id : undefined;
  useEffect(() => {
    if (!token || !userId) return undefined;
    const s = io({ auth: { token } });
    // Sunucu, ekran kapalıyken telefona bildirim gönderebilsin.
    const reportPresence = () => {
      if (s.connected) s.emit('presence', { visible: document.visibilityState === 'visible' });
    };
    document.addEventListener('visibilitychange', reportPresence);
    s.on('connect', () => { setConnected(true); reportPresence(); refresh(); });
    s.on('disconnect', (reason) => {
      setConnected(false);
      // Sunucu bağlantıyı kestiyse yeniden dene; oturum kapanmışsa çıkış yapılır.
      if (reason === 'io server disconnect') s.connect();
    });
    s.on('connect_error', (error) => { if (error.message === 'unauthorized') logout(); });
    s.on('account:deleted', logout);
    s.on('password:reset', logout);
    s.on('sync', refresh);
    s.on('message:updated', refresh);
    s.on('chat:updated', refresh);
    s.on('message:new', (message) => {
      refresh();
      const incoming = message.senderId !== userId && message.kind !== 'social';
      if (incoming && window.location.pathname !== `/chat/${message.chatId}`) {
        const text = message.kind === 'game'
          ? `${message.senderName} oyun başlattı: ${message.body}`
          : `${message.senderName}: ${message.body}`;
        toast({ type: 'message', chatId: message.chatId, text });
      }
    });
    s.on('request:new', (request) => toast({ type: 'request', request }));
    s.on('request:accepted', ({ chatId, by }) =>
      toast({ type: 'info', chatId, text: `${by.name} ile eşleştiniz 🎉` }));
    s.on('social:shared', ({ chatId, by }) =>
      toast({ type: 'social', chatId, text: `${by.name} sosyal medyasını paylaştı` }));
    setSocket(s);
    return () => {
      document.removeEventListener('visibilitychange', reportPresence);
      s.close();
      setSocket(null);
      setConnected(false);
    };
  }, [token, userId, refresh, toast, logout]);

  useEffect(() => {
    if (!token || !userId) return undefined;
    let cancelled = false;
    api('/api/inbox', { token })
      .then((data) => {
        if (cancelled) return;
        setInbox(data);
        // Geçerliliğini yitiren istek bildirimlerini kaldır.
        const open = new Set(data.requests.map((r) => r.id));
        setToasts((list) => list.filter((t) => t.type !== 'request' || open.has(t.request.id)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, userId, version]);

  const publicKey = meta?.pushPublicKey;
  useEffect(() => {
    if (!token || !userId || !publicKey) return undefined;
    let cancelled = false;
    syncPush(token, publicKey)
      .then((state) => !cancelled && setPushState(state))
      .catch(() => !cancelled && setPushState('off'));
    return () => { cancelled = true; };
  }, [token, userId, publicKey]);

  const setPush = async (enable) => {
    if (enable) {
      setPushState(await enablePush(token, publicKey));
    } else {
      await disablePush(token);
      setPushState('off');
    }
  };

  const unread = inbox.chats.reduce((sum, chat) => sum + chat.unread, 0);
  const badge = unread + inbox.requests.length;
  useEffect(() => {
    document.title = badge ? `(${badge}) Zodi` : 'Zodi';
  }, [badge]);

  const act = useCallback(async (event, payload) => {
    if (!socket?.connected) throw new Error('Bağlantı yok, tekrar deniyoruz…');
    let result;
    try {
      result = await socket.timeout(8000).emitWithAck(event, payload);
    } catch {
      throw new Error('Sunucudan yanıt alınamadı.');
    }
    if (!result.ok) throw new Error(result.error);
    return result;
  }, [socket]);

  const startSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setMe(data.user);
    setToken(data.token);
  };

  const register = async (profile) =>
    startSession(await api('/api/register', { method: 'POST', body: profile }));

  const login = async (credentials) =>
    startSession(await api('/api/login', { method: 'POST', body: credentials }));

  const requestResetCode = (email) => api('/api/forgot', { method: 'POST', body: { email } });

  const resetPassword = async (details) =>
    startSession(await api('/api/reset', { method: 'POST', body: details }));

  const signOut = async () => {
    await disablePush(token).catch(() => {});
    await api('/api/logout', { token, method: 'POST' }).catch((error) => {
      if (error.status !== 401) throw error;
    });
    logout();
  };

  const updateProfile = async (profile) => {
    const data = await api('/api/me', { token, method: 'PUT', body: profile });
    setMe(data.user);
    refresh();
  };

  const updateAccount = async (details) => {
    const data = await api('/api/me/account', { token, method: 'PUT', body: details });
    setMe(data.user);
    // Şifre değişince sunucu abonelikleri siler; bu cihazınkini geri ekle.
    if (details.newPassword) syncPush(token, publicKey).then(setPushState).catch(() => {});
  };

  const setup = async (details) => {
    const data = await api('/api/setup', { token, method: 'POST', body: details });
    setMe(data.user);
  };

  const deleteAccount = async () => {
    await api('/api/me', { token, method: 'DELETE' });
    logout();
  };

  const value = {
    deleteAccount,
    pushState, setPush, badge, needsSetup, setup, updateAccount, login, signOut, requestResetCode, resetPassword,
    token, meta, me, socket, connected, inbox, version, refresh, act, register, updateProfile,
    toasts, toast, dismissToast, bootError, retry: () => setAttempt((a) => a + 1),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
