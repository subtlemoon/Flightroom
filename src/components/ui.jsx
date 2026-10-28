import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const paths = {
  body: <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.5" /></>,
  lens: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" /></>,
  accessory: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></>,
  bag: <><rect x="3" y="8" width="18" height="12" rx="3" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  news: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 8h10M7 12h10M7 16h6" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  back: <path d="M15 18l-6-6 6-6" />,
  chevL: <path d="M15 18l-6-6 6-6" />,
  chevR: <path d="M9 18l6-6-6-6" />,
  chevU: <path d="M6 15l6-6 6 6" />,
  chevD: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
  develop: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  crop: <><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M2 6h14a2 2 0 0 1 2 2v14" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></>,
  export: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  compare: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /><path d="M12 8l9 8" /></>,
  picker: <><path d="M14.5 4.5l5 5" /><path d="M17 2.5a2.1 2.1 0 0 1 3 3L18 7.5l-3-3z" /><path d="M15.5 8.5L6 18l-3 1 1-3 9.5-9.5" /></>,
  reset: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 3.5v5h5" /></>,
  paste: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 11h6M9 15h4" /></>,
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// A thin strip on a panel's edge that hides or shows it (Lightroom style).
// side: where the panel is ('left' | 'right' | 'bottom').
export function PanelHandle({ side, open, onClick, title }) {
  const icon = { left: open ? 'chevL' : 'chevR', right: open ? 'chevR' : 'chevL', bottom: open ? 'chevD' : 'chevU' }[side];
  return (
    <button className={`panel-handle panel-handle-${side}${open ? ' open' : ''}`} onClick={onClick} title={title} aria-label={title}
      onMouseDown={(e) => e.preventDefault()}>
      <Icon name={icon} size={12} />
    </button>
  );
}

export const LEVEL_META = {
  ok: { label: 'Compatible', short: 'OK', sym: '✓' },
  info: { label: 'Note', short: 'Note', sym: 'i' },
  warn: { label: 'Works with caveats', short: 'Caution', sym: '!' },
  bad: { label: 'Not compatible', short: 'Problem', sym: '✕' },
};

export function Status({ level, text, small }) {
  return (
    <span className={`status status-${level}${small ? ' status-sm' : ''}`}>
      <span className="status-dot">{LEVEL_META[level].sym}</span>
      {text ?? LEVEL_META[level].label}
    </span>
  );
}

export function Counts({ counts }) {
  return (
    <div className="counts">
      {['ok', 'warn', 'bad'].map((l) => (
        <span key={l} className={`count count-${l}`} title={LEVEL_META[l].label}>
          <span className="status-dot">{LEVEL_META[l].sym}</span>{counts[l]}
        </span>
      ))}
    </div>
  );
}

/**
 * A dropdown menu styled like the rest of the app (the system's own menus
 * ignore the dark theme on Windows). options: [{ value, label, disabled, hint }].
 * `label` overrides what the closed button says.
 */
export function Dropdown({ value, options, onChange, className = '', title, label, placeholder = 'Choose…', disabled }) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(-1);
  const [pos, setPos] = useState(null);
  const btn = useRef();
  const menu = useRef();
  const current = options.find((o) => o.value === value);

  const place = () => {
    const r = btn.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom, above = r.top;
    const up = below < 220 && above > below;
    setPos({ left: Math.min(r.left, window.innerWidth - 180), minWidth: r.width, ...(up ? { bottom: window.innerHeight - r.top + 4, maxHeight: above - 12 } : { top: r.bottom + 4, maxHeight: below - 12 }) });
  };
  const show = () => { if (disabled) return; place(); setHl(Math.max(0, options.findIndex((o) => o.value === value))); setOpen(true); };
  const choose = (o) => {
    if (!o || o.disabled) return;
    setOpen(false);
    btn.current?.blur(); // keys go back to the page (photo navigation and so on)
    if (o.value !== value) onChange(o.value);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const close = (e) => { if (!menu.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);
  useLayoutEffect(() => { if (open) menu.current?.querySelector('.hl')?.scrollIntoView({ block: 'nearest' }); }, [open, hl]);

  const onKey = (e) => {
    const step = (d) => {
      let i = hl;
      for (let n = 0; n < options.length; n++) { i = (i + d + options.length) % options.length; if (!options[i].disabled) break; }
      setHl(i);
    };
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); e.stopPropagation(); show(); }
      return;
    }
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[hl]); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setOpen(false); }
  };

  return (
    <>
      <button ref={btn} type="button" className={`dd ${className}${open ? ' open' : ''}`} title={title} disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey} aria-haspopup="listbox" aria-expanded={open}>
        <span className="dd-label">{label ?? current?.label ?? placeholder}</span>
        <Icon name="chevD" size={12} />
      </button>
      {open && pos && createPortal(
        <div className="dd-menu" role="listbox" ref={menu} style={pos}>
          {options.map((o, i) => (
            <div key={String(o.value)} role="option" aria-selected={o.value === value}
              className={`dd-item${o.value === value ? ' sel' : ''}${i === hl ? ' hl' : ''}${o.disabled ? ' off' : ''}`}
              onPointerEnter={() => !o.disabled && setHl(i)} onClick={() => choose(o)}>
              <span>{o.label}</span>{o.hint != null && <span className="dd-hint">{o.hint}</span>}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const typeLabel = (g) => (g.type === 'body' ? 'Camera body' : g.type === 'lens' ? 'Lens' : g.category);
export const typeIcon = (g) => (g.type === 'body' ? 'body' : g.type === 'lens' ? 'lens' : 'accessory');

// One-line summary of the most useful specs for a card.
export function keySpecs(g) {
  if (g.type === 'body') return [g.mount, g.sensor, g.megapixels && `${g.megapixels} MP`, g.maxVideo].filter(Boolean);
  if (g.type === 'lens') return [g.mount, g.focal, g.aperture, g.coverage].filter(Boolean);
  switch (g.category) {
    case 'Adapter': return [`${g.fromMount} → ${g.toMount}`];
    case 'Battery': return [g.batteryModel];
    case 'Memory card': return [g.cardType];
    case 'Filter': return [`${g.threadSize}mm thread`];
    case 'Flash': return [g.shoe];
    case 'Microphone': return [g.connection === '3.5mm' ? '3.5mm input' : `${g.connection} shoe`];
    case 'Gimbal':
    case 'Tripod': return [`Max ${(g.maxPayload / 1000).toFixed(1)} kg`];
    default: return [];
  }
}
