import { useState } from 'react';
import { useStore } from '../store.jsx';
import { EmailField } from './AccountFields.jsx';

// Giriş bilgileri. Değişiklik için mevcut şifre istenir.
export default function AccountSettings() {
  const { me, updateAccount } = useStore();
  const [form, setForm] = useState({
    username: me.username, email: me.email ?? '', newPassword: '', currentPassword: '',
  });
  const [status, setStatus] = useState({ busy: false, error: '', saved: false });

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus((s) => ({ ...s, error: '', saved: false }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, error: '', saved: false });
    try {
      await updateAccount(form);
      setForm((f) => ({
        ...f, username: f.username.trim().toLowerCase(), newPassword: '', currentPassword: '',
      }));
      setStatus({ busy: false, error: '', saved: true });
    } catch (error) {
      setStatus({ busy: false, error: error.message, saved: false });
    }
  };

  const password = (key, label, props) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="password"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        maxLength={72}
        {...props}
      />
    </label>
  );

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        Kullanıcı adı
        <input
          value={form.username}
          onChange={(e) => set('username', e.target.value)}
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_.]{3,20}"
          title="3-20 karakter: İngilizce harf, rakam, nokta ya da alt çizgi"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </label>
      <EmailField value={form.email} onChange={(email) => set('email', email)} />
      {password('newPassword', <>Yeni şifre <small>(değiştirmeyeceksen boş bırak)</small></>, {
        autoComplete: 'new-password', minLength: 8,
      })}
      {password('currentPassword', <>Mevcut şifren <small>(onay için)</small></>, {
        autoComplete: 'current-password', required: true,
      })}
      {status.error && <p className="error" role="alert">{status.error}</p>}
      {status.saved && <p className="success">Hesap bilgilerin güncellendi ✓</p>}
      <button className="button big" disabled={status.busy}>Hesabı güncelle</button>
    </form>
  );
}
