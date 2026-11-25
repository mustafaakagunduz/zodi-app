import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import TabBar from './components/TabBar.jsx';
import Toasts from './components/Toasts.jsx';
import Chat from './pages/Chat.jsx';
import Chats from './pages/Chats.jsx';
import Discover from './pages/Discover.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Profile from './pages/Profile.jsx';
import Requests from './pages/Requests.jsx';
import SetupGate from './pages/SetupGate.jsx';
import { useStore } from './store.jsx';

// Mobil klavye açıldığında yerleşim görünen alana sığsın.
function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const update = () => {
      const { style } = document.documentElement;
      style.setProperty('--app-height', `${viewport.height}px`);
      style.setProperty('--app-top', `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
}

// Telefon bildirimine dokunulunca ilgili sayfaya git.
function useNotificationClicks() {
  const navigate = useNavigate();
  useEffect(() => {
    const container = navigator.serviceWorker;
    if (!container) return undefined;
    const onMessage = ({ data }) => {
      if (data?.type === 'navigate' && data.url.startsWith('/')) navigate(data.url);
    };
    container.addEventListener('message', onMessage);
    container.startMessages();
    return () => container.removeEventListener('message', onMessage);
  }, [navigate]);
}

const withTabs = (page) => (
  <>
    {page}
    <TabBar />
  </>
);

export default function App() {
  const { token, meta, me, needsSetup, connected, bootError, retry } = useStore();
  useVisualViewport();
  useNotificationClicks();

  let content;
  if (!meta || (token && !me)) {
    content = (
      <div className="splash">
        <img src="/icon.svg" alt="Zodi" width="72" height="72" />
        {bootError ? (
          <>
            <p>{bootError}</p>
            <button className="button" onClick={retry}>Tekrar dene</button>
          </>
        ) : (
          <p>Yıldızlar hizalanıyor…</p>
        )}
      </div>
    );
  } else if (!me) {
    content = <Onboarding />;
  } else if (needsSetup) {
    content = <SetupGate />;
  } else {
    content = (
      <>
        {!connected && <div className="offline">Bağlanıyor…</div>}
        <Routes>
          <Route path="/" element={withTabs(<Discover />)} />
          <Route path="/requests" element={withTabs(<Requests />)} />
          <Route path="/chats" element={withTabs(<Chats />)} />
          <Route path="/profile" element={withTabs(<Profile />)} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </>
    );
  }

  return <div className="app">{content}</div>;
}
