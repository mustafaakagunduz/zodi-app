import { useState } from 'react';
import { BirthYearField, CredentialFields, EmailField } from '../components/AccountFields.jsx';
import Consent, { noConsent } from '../components/Consent.jsx';
import DeleteAccount from '../components/DeleteAccount.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import { useStore } from '../store.jsx';

// Yeni zorunlu bilgiler eklenmeden önce açılmış hesaplar için.
export default function SetupGate() {
  const { me, setup } = useStore();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [email, setEmail] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [consent, setConsent] = useState(noConsent);
  const [status, setStatus] = useState({ busy: false, error: '' });

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, error: '' });
    try {
      await setup({ ...credentials, email, birthYear, ...consent });
    } catch (error) {
      setStatus({ busy: false, error: error.message });
    }
  };

  return (
    <main className="page">
      <h1>Hesabını tamamla</h1>
      <p className="muted">Devam etmek için eksik bilgileri doldur.</p>
      <form className="form" onSubmit={submit}>
        {me.needsCredentials && <CredentialFields value={credentials} onChange={setCredentials} />}
        {!me.email && <EmailField value={email} onChange={setEmail} />}
        {me.needsBirthYear && <BirthYearField value={birthYear} onChange={setBirthYear} />}
        {me.needsConsent && <Consent value={consent} onChange={setConsent} />}
        {status.error && <p className="error" role="alert">{status.error}</p>}
        <button className="button big" disabled={status.busy}>Devam et</button>
      </form>
      <LegalLinks />
      <DeleteAccount />
    </main>
  );
}
