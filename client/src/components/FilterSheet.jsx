import { useState } from 'react';
import { useStore } from '../store.jsx';
import Sheet from './Sheet.jsx';

export const MIN_AGE = 18;
export const MAX_AGE = 99;

export const defaultFilters = {
  minAge: MIN_AGE, maxAge: MAX_AGE, flex: false, online: false, fullOnly: false,
  place: 'all', reason: '',
};

const ages = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

function AgeStepper({ label, value, onChange }) {
  const set = (next) => onChange(Math.min(MAX_AGE, Math.max(MIN_AGE, next)));
  return (
    <div className="stepper">
      <span>{label}</span>
      <button type="button" onClick={() => set(value - 1)} disabled={value <= MIN_AGE} aria-label={`${label} azalt`}>−</button>
      <select value={value} onChange={(e) => set(Number(e.target.value))} aria-label={label}>
        {ages.map((age) => <option key={age}>{age}</option>)}
      </select>
      <button type="button" onClick={() => set(value + 1)} disabled={value >= MAX_AGE} aria-label={`${label} artır`}>+</button>
    </div>
  );
}

export default function FilterSheet({ filters, onApply, onClose }) {
  const { meta } = useStore();
  const [draft, setDraft] = useState(filters);
  const update = (changes) => setDraft((d) => ({ ...d, ...changes }));

  const check = (key, label) => (
    <label className="check">
      <input type="checkbox" checked={draft[key]} onChange={(e) => update({ [key]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );

  return (
    <Sheet title="Filtrele" onClose={onClose}>
      <AgeStepper
        label="En küçük yaş"
        value={draft.minAge}
        onChange={(minAge) => update({ minAge, maxAge: Math.max(minAge, draft.maxAge) })}
      />
      <AgeStepper
        label="En büyük yaş"
        value={draft.maxAge}
        onChange={(maxAge) => update({ maxAge, minAge: Math.min(maxAge, draft.minAge) })}
      />
      {check('flex', `Aralığı ±1 yaş esnet (${Math.max(MIN_AGE, draft.minAge - 1)}–${Math.min(MAX_AGE, draft.maxAge + 1)})`)}
      {check('online', 'Yalnızca çevrimiçi olanlar')}
      {check('fullOnly', 'Yalnızca burcu tam uyumlu olanlar')}
      <label className="field">
        Konum
        <select value={draft.place} onChange={(e) => update({ place: e.target.value })}>
          <option value="all">Tümü</option>
          <option value="same">Aynı şehir</option>
          <option value="neighbor">Aynı ve komşu şehirler</option>
        </select>
      </label>
      <label className="field">
        Kayıt nedeni
        <select value={draft.reason} onChange={(e) => update({ reason: e.target.value })}>
          <option value="">Tümü</option>
          {meta.reasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <div className="actions">
        <button type="button" className="button ghost" onClick={() => onApply(defaultFilters)}>Sıfırla</button>
        <button type="button" className="button" onClick={() => onApply(draft)}>Uygula</button>
      </div>
    </Sheet>
  );
}
