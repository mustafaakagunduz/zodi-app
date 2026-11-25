// Alttan açılan küçük pencere.
export default function Sheet({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Kapat">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
