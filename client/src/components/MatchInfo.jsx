// Uyum skoru ve "Neden uyumlusunuz?" açıklaması.
export default function MatchInfo({ score }) {
  return (
    <details className={`score ${score.signLevel}`}>
      <summary>
        <b>%{score.total} uyum</b>
        <span>Neden uyumlusunuz? ▾</span>
        <meter min="0" max="100" value={score.total} aria-label="Uyum skoru" />
      </summary>
      <ul>
        {score.why.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p>Burç {score.sign}/60 · Kayıt nedenleri {score.reason}/25 · Konum {score.location}/15</p>
    </details>
  );
}
