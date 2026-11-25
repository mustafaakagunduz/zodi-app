// Kullanıcı adı ve şifre alanları (kayıt, giriş ve hesap tamamlama ekranlarında ortak).
export function CredentialFields({ value, onChange, isNew = true }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <>
      <label className="field">
        Kullanıcı adı
        <input
          value={value.username}
          onChange={set('username')}
          minLength={isNew ? 3 : undefined}
          maxLength={20}
          pattern={isNew ? '[A-Za-z0-9_.]{3,20}' : undefined}
          title="3-20 karakter: İngilizce harf, rakam, nokta ya da alt çizgi"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </label>
      <label className="field">
        <span>Şifre {isNew && <small>(en az 8 karakter)</small>}</span>
        <input
          type="password"
          value={value.password}
          onChange={set('password')}
          minLength={isNew ? 8 : undefined}
          maxLength={72}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          required
        />
      </label>
    </>
  );
}

export function EmailField({ value, onChange, required = false }) {
  return (
    <label className="field">
      <span>E-posta {!required && <small>(isteğe bağlı, kimse görmez)</small>}</span>
      <input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={254}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required={required}
      />
      {!required && !value && (
        <small>E-posta eklemezsen şifreni unuttuğunda hesabına giremezsin.</small>
      )}
    </label>
  );
}

// Yalnızca yıl sorulur ve elle yazılır.
const thisYear = new Date().getFullYear();

// Sorun varsa tarayıcının göstereceği uyarıyı döner.
function yearProblem(value) {
  if (value.length !== 4) return 'Doğum yılını 4 rakamla yaz (ör. 1998).';
  const age = thisYear - Number(value);
  if (age < 18) return 'Siteyi yalnızca 18 yaş ve üzeri kullanabilir.';
  return age > 99 ? 'Geçerli bir doğum yılı gir.' : '';
}

export function BirthYearField({ value, onChange }) {
  return (
    <label className="field">
      <span>Doğum yılın <small>(diğerleri yalnızca yaşını görür)</small></span>
      <input
        ref={(input) => input?.setCustomValidity(value ? yearProblem(value) : '')}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        autoComplete="bday-year"
        placeholder="Ör. 1998"
        maxLength={4}
        required
      />
    </label>
  );
}
