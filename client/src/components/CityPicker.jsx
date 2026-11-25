import { useEffect, useId, useRef, useState } from 'react';
import { exactCity, searchCities } from '../citySearch.js';

// Yazdıkça süzülen şehir seçimi.
export default function CityPicker({ cities, value, onChange }) {
  const id = useId();
  const [query, setQuery] = useState(null); // null: seçili şehir gösteriliyor
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);
  const matches = searchCities(cities, query ?? '');

  // Listeden seçim yapılmadan form gönderilemesin.
  useEffect(() => {
    input.current.setCustomValidity(value ? '' : 'Listeden bir şehir seç.');
  }, [value]);

  // Klavyeyle gezinirken seçili satır görünür kalsın.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (city) => {
    onChange(city);
    setQuery(null);
    setOpen(false);
  };

  const type = (e) => {
    setQuery(e.target.value);
    setActive(0);
    setOpen(true);
    onChange(exactCity(cities, e.target.value));
  };

  const keyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.max(0, Math.min(matches.length - 1, i + step)));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); // formu göndermek yerine şehri seç
      if (matches[active]) pick(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="field">
      <label htmlFor={id}>Şehir</label>
      <input
        id={id}
        ref={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
        aria-autocomplete="list"
        value={query ?? value}
        onChange={type}
        onKeyDown={keyDown}
        onFocus={(e) => {
          e.target.select();
          setActive(0);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (value) setQuery(null);
        }}
        placeholder="Şehrini yaz…"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        required
      />
      {open && (
        <ul id={`${id}-list`} ref={list} className="cities" role="listbox">
          {matches.map((city, index) => (
            <li
              key={city}
              id={`${id}-${index}`}
              role="option"
              aria-selected={city === value}
              className={index === active ? 'active' : ''}
              // Dokunuşta yazı alanı odağı kaybedip liste kapanmasın.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(city)}
            >
              {city}
            </li>
          ))}
          {matches.length === 0 && <li className="none">Şehir bulunamadı</li>}
        </ul>
      )}
    </div>
  );
}
