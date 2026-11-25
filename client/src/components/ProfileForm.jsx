import { useState } from 'react';
import { symbolOf } from '../labels.js';
import { useStore } from '../store.jsx';
import { BirthYearField, CredentialFields, EmailField } from './AccountFields.jsx';
import CityPicker from './CityPicker.jsx';
import Consent, { noConsent } from './Consent.jsx';

const empty = {
  name: '', gender: '', sign: '', city: '', job: '', reasons: [],
  locationPref: '', genderPref: '', bio: '',
};

export default function ProfileForm({ initial, submitLabel, onSubmit }) {
  const { meta } = useStore();
  const [form, setForm] = useState(() =>
    Object.fromEntries(Object.keys(empty).map((key) => [key, initial?.[key] ?? ''])));
  const [status, setStatus] = useState({ busy: false, error: '', saved: false });

  const [consent, setConsent] = useState(noConsent);
  // Yalnızca kayıtta sorulur.
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [email, setEmail] = useState('');
  const [birthYear, setBirthYear] = useState(() => String(initial?.birthYear ?? ''));

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus((s) => ({ ...s, error: '', saved: false }));
  };
  const set = (key) => (e) => update(key, e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ busy: true, error: '', saved: false });
    try {
      await onSubmit(
        initial ? { ...form, birthYear } : { ...form, ...credentials, email, birthYear, ...consent },
      );
      setStatus({ busy: false, error: '', saved: true });
    } catch (error) {
      setStatus({ busy: false, error: error.message, saved: false });
    }
  };

  const toggleReason = (id) =>
    update(
      'reasons',
      form.reasons.includes(id) ? form.reasons.filter((r) => r !== id) : [...form.reasons, id],
    );

  const choices = (key, label, options, className = 'chips') => (
    <fieldset>
      <legend>{label}</legend>
      <div className={className}>
        {options.map((option) => (
          <label key={option.id} className="choice">
            <input
              type="radio"
              name={key}
              value={option.id}
              checked={form[key] === option.id}
              onChange={set(key)}
              required
            />
            <span>
              {option.symbol && <i>{symbolOf(meta, option.id)}</i>}
              {option.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <form className="form" onSubmit={submit}>
      {!initial && <CredentialFields value={credentials} onChange={setCredentials} />}
      {!initial && <EmailField value={email} onChange={setEmail} />}
      <label className="field">
        İsim
        <input value={form.name} onChange={set('name')} minLength={2} maxLength={30} required autoComplete="given-name" />
      </label>
      <BirthYearField
        value={birthYear}
        onChange={(year) => {
          setBirthYear(year);
          setStatus((s) => ({ ...s, error: '', saved: false }));
        }}
      />
      {choices('gender', 'Cinsiyetin', meta.genders)}
      {choices('sign', 'Burcun', meta.signs, 'signs')}
      <CityPicker cities={meta.cities} value={form.city} onChange={(city) => update('city', city)} />
      <label className="field">
        <span>Meslek <small>(isteğe bağlı)</small></span>
        <input value={form.job} onChange={set('job')} maxLength={50} />
      </label>
      <fieldset>
        <legend>Neden buradasın? <small>(birden fazla seçebilirsin)</small></legend>
        <div className="chips">
          {meta.reasons.map((reason, index) => (
            <label key={reason.id} className="choice">
              <input
                type="checkbox"
                // Hiçbiri seçili değilse form gönderilmesin.
                ref={index === 0
                  ? (el) => el?.setCustomValidity(form.reasons.length ? '' : 'En az bir tane seç.')
                  : undefined}
                checked={form.reasons.includes(reason.id)}
                onChange={() => toggleReason(reason.id)}
              />
              <span>{form.reasons.includes(reason.id) && '✓ '}{reason.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {choices('genderPref', 'Kiminle konuşmak istersin?', meta.genderPrefs)}
      {choices('locationPref', 'Eşleşeceğin kişi nerede olsun?', meta.locationPrefs)}
      <label className="field">
        <span>Biyografi <small>(isteğe bağlı) {form.bio.length}/300</small></span>
        <textarea value={form.bio} onChange={set('bio')} rows={4} maxLength={300} placeholder="Kendinden kısaca bahset…" />
      </label>
      {!initial && <Consent value={consent} onChange={setConsent} />}
      {status.error && <p className="error" role="alert">{status.error}</p>}
      {status.saved && initial && <p className="success">Kaydedildi ✓</p>}
      <button className="button big" disabled={status.busy}>
        {status.busy ? 'Bekle…' : submitLabel}
      </button>
    </form>
  );
}
