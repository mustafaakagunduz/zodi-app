import { useState } from 'react';
import { useStore } from '../store.jsx';
import { CredentialFields } from './AccountFields.jsx';

export default function LoginForm({ onForgot }) {
  const { login } = useStore();
  const [form, setForm] = useState({ username: '', password: '' });
  const [status, setStatus] = useState({ busy: false, error: '' });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      await login(form);
    } catch (error) {
      setStatus({ busy: false, error: error.message });
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <CredentialFields value={form} onChange={setForm} isNew={false} />
      {status.error && <p className="error" role="alert">{status.error}</p>}
      <button className="button big" disabled={status.busy}>Giriş yap</button>
      <button type="button" className="button ghost" onClick={onForgot}>Şifremi unuttum</button>
    </form>
  );
}
