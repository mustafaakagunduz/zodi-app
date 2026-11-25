import { useState } from 'react';
import ForgotPassword from '../components/ForgotPassword.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import LoginForm from '../components/LoginForm.jsx';
import ProfileForm from '../components/ProfileForm.jsx';
import StatsBar from '../components/StatsBar.jsx';
import { isIOS, isStandalone } from '../push.js';
import { useStore } from '../store.jsx';

export default function Onboarding() {
  const { register } = useStore();
  const [mode, setMode] = useState('register');

  return (
    <main className="page">
      <StatsBar />
      <div className="hero">
        <img src="/icon.svg" alt="" width="72" height="72" />
        <h1>Zodi</h1>
        <p>Burcuna uygun insanlarla tanış.</p>
      </div>
      <div className="switch">
        {[['register', 'Kayıt ol'], ['login', 'Giriş yap']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={mode === id || (id === 'login' && mode === 'forgot')} onClick={() => setMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {isIOS() && !isStandalone() && (
        <p className="card muted">
          iPhone’da bildirim almak istiyorsan Paylaş → “Ana Ekrana Ekle” de ve siteyi ana
          ekrandan aç.
        </p>
      )}
      {mode === 'register' && <ProfileForm submitLabel="Yıldızımı bul" onSubmit={register} />}
      {mode === 'login' && <LoginForm onForgot={() => setMode('forgot')} />}
      {mode === 'forgot' && <ForgotPassword onBack={() => setMode('login')} />}
      <LegalLinks />
    </main>
  );
}
