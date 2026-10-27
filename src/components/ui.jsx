import { useEffect } from 'react';

const paths = {
  body: <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.5" /></>,
  lens: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" /></>,
  accessory: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></>,
  bag: <><rect x="3" y="8" width="18" height="12" rx="3" /><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>,
  grid: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  back: <path d="M15 18l-6-6 6-6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
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
