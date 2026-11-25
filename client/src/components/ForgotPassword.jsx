import { useState } from 'react';
import { useStore } from '../store.jsx';
import { EmailField } from './AccountFields.jsx';

// İki adım: e-postaya kod iste, kodla yeni şifre belirle.
export default function ForgotPassword({ onBack }) {
  const { requestResetCode, resetPassword } = useStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ busy: false, error: '' });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      if (!sent) {
        await requestResetCode(email);
        setSent(true);
        setStatus({ busy: false, error: '' });
      } else {
        await resetPassword({ email, code, password });
      }
    } catch (error) {
      setStatus({ busy: false, error: error.message });
    }
  };

  const restart = () => {
    setSent(false);
    setCode('');
    setStatus({ busy: false, error: '' });
  };

  return (
    <form className="form" onSubmit={submit}>
      <h2>Şifremi unuttum</h2>
      {!sent ? (
        <EmailField value={email} onChange={setEmail} required />
      ) : (
        <>
          <p className="muted">
            {email} kayıtlıysa 6 haneli bir kod gönderdik. Gelmediyse spam klasörüne bak.
          </p>
          <label className="field">
            Kod
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
            />
          </label>
          <label className="field">
            <span>Yeni şifre <small>(en az 8 karakter)</small></span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
          </label>
        </>
      )}
      {status.error && <p className="error" role="alert">{status.error}</p>}
      <button className="button big" disabled={status.busy}>
        {sent ? 'Şifreyi yenile' : 'Kod gönder'}
      </button>
      {sent && <button type="button" className="button ghost" onClick={restart}>Yeni kod iste</button>}
      <button type="button" className="back" onClick={onBack}>‹ Girişe dön</button>
    </form>
  );
}
