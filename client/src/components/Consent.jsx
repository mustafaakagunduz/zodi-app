const ITEMS = [
  ['isAdult', '18 yaşından büyük olduğumu onaylıyorum.'],
  ['acceptTerms', 'Kullanım Koşulları’nı kabul ediyorum, Gizlilik ve KVKK Aydınlatma Metni’ni okudum.'],
  ['explicitConsent', 'Cinsiyet ve eşleşme tercihlerimin eşleştirme amacıyla işlenmesine açık rıza veriyorum.'],
];

export const noConsent = Object.fromEntries(ITEMS.map(([key]) => [key, false]));

export default function Consent({ value, onChange }) {
  return (
    <div className="consent">
      {ITEMS.map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            required
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}
