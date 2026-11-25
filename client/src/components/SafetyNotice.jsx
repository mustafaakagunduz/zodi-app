import { useState } from 'react';

// TR IBAN: "TR" + 24 rakam, aralarında boşluk, nokta ya da tire olabilir.
export const hasIban = (text) => /TR(?:[\s.-]*\d){24}/i.test(text);

export default function SafetyNotice({ chatId }) {
  const key = `burcdas.safety.${chatId}`;
  const [hidden, setHidden] = useState(() => localStorage.getItem(key) === '1');
  if (hidden) return null;

  const dismiss = () => {
    localStorage.setItem(key, '1');
    setHidden(true);
  };

  return (
    <aside className="safety">
      <b>⚠️ Güvenliğin için</b>
      <ul>
        <li>IBAN, kart bilgisi, şifre ya da doğrulama kodu paylaşma; para gönderme.</li>
        <li>Karşındaki kişi ahlaki sınırları aşan şeyler söylerse onu engelle.</li>
      </ul>
      <button type="button" className="button small" onClick={dismiss}>Anladım</button>
    </aside>
  );
}
