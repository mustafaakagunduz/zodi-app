import { useState } from 'react';
import { LEGAL } from '../legal.js';
import Sheet from './Sheet.jsx';

export default function LegalLinks() {
  const [open, setOpen] = useState(null);
  const doc = LEGAL[open];

  return (
    <>
      <div className="links">
        {Object.entries(LEGAL).map(([key, { title }]) => (
          <button key={key} type="button" onClick={() => setOpen(key)}>{title}</button>
        ))}
      </div>
      {doc && (
        <Sheet title={doc.title} onClose={() => setOpen(null)}>
          <p className="muted">{doc.intro}</p>
          {doc.sections.map(([heading, items]) => (
            <div key={heading} className="legal">
              <h3>{heading}</h3>
              <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </Sheet>
      )}
    </>
  );
}
