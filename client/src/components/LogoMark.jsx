// Logonun tek renkli hali (yazı rengini alır). Renkli sürüm: public/icon.svg
export default function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="10 10 46 42" aria-hidden="true">
      <path d="M18 20H46L18 44H46" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="currentColor">
        <circle cx="18" cy="20" r="5" />
        <circle cx="18" cy="44" r="5" />
        <circle cx="46" cy="44" r="5" />
        <circle cx="46" cy="20" r="7" />
      </g>
    </svg>
  );
}
