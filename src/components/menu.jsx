// Right-click menus, Lightroom style, in Flightroom's look. Anything can open
// one: onContextMenu={(e) => openMenu(e, items)}, or onClick on a ⋯ button (it
// then drops down under the button). One host (in App) shows it.
//
// items: an array of
//   { label, onClick, hint (its key, shown on the right), icon, checked (true/false
//     shows a tick column), disabled, danger, items (a submenu) }
//   '-' (a divider) and { heading } (a small title)
// Falsy entries are skipped, so `cond && { ... }` works; dividers never pile up.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Modal } from './ui.jsx';
import { keyLabel } from '../cull/keys.js';

let show = null; // the host's setter
let ask = null; // the host's confirm setter
let pending = null; // opened before the host mounted

export function openMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  const list = tidy(items);
  if (!list.length) return;
  // From a button (a click, not a right-click): dropped down under it, right edges lined up.
  const r = e.type === 'contextmenu' ? null : e.currentTarget?.getBoundingClientRect?.();
  const m = r ? { x: r.right, y: r.bottom + 4, items: list, flipX: true } : { x: e.clientX, y: e.clientY, items: list };
  if (show) show(m); else pending = m;
}

/** Asks before something that can't be undone: { title, text, ok (button label), onOk }. */
export const confirmAction = (c) => ask?.(c);

/** Drops falsy entries and dividers at either end or next to each other. */
export function tidy(items) {
  const out = [];
  for (const it of items || []) {
    if (!it) continue;
    if (it === '-' && (!out.length || out[out.length - 1] === '-')) continue;
    out.push(it.items ? { ...it, items: tidy(it.items) } : it);
  }
  while (out[out.length - 1] === '-') out.pop();
  return out;
}

const usable = (it) => it && it !== '-' && !it.heading && !it.disabled;

export function ContextMenuHost() {
  const [menu, setMenu] = useState(null);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => {
    show = setMenu;
    ask = setConfirm;
    if (pending) { setMenu(pending); pending = null; }
    // The browser's own menu (Back, Reload, Save image as…) has nothing for
    // Flightroom; text boxes keep theirs for cut, copy and paste.
    const native = (e) => {
      if (e.defaultPrevented || e.target.closest?.('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable]')) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', native);
    return () => { show = null; ask = null; document.removeEventListener('contextmenu', native); };
  }, []);
  const done = () => setConfirm(null);
  return (
    <>
      {menu && createPortal(<Menu key={`${menu.x},${menu.y},${menu.items.length}`} x={menu.x} y={menu.y} flipX={menu.flipX} items={menu.items} root onClose={() => setMenu(null)} />, document.body)}
      {confirm && (
        <Modal title={confirm.title} onClose={done} footer={(
          <>
            <button className="btn" onClick={done}>Cancel</button>
            <button className="btn btn-primary" autoFocus onClick={() => { done(); confirm.onOk(); }}>{confirm.ok || 'OK'}</button>
          </>
        )}>
          <p className="muted">{confirm.text}</p>
        </Modal>
      )}
    </>
  );
}

// One level of the menu; a submenu is another Menu beside its row.
function Menu({ x, y, items, root, onClose, onBack, flipX }) {
  const ref = useRef();
  const [pos, setPos] = useState({ left: x, top: y, visibility: 'hidden' });
  const [hl, setHl] = useState(-1);
  const [sub, setSub] = useState(null); // { i, x, y, flip }
  const timer = useRef(0);

  // Kept on screen: flipped left or up when there's no room.
  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    let left = flipX ? x - r.width : x;
    if (left + r.width > W - 4) left = root ? x - r.width : W - 4 - r.width;
    left = Math.max(4, left);
    let top = y;
    if (top + r.height > H - 4) top = Math.max(4, root ? y - r.height : H - 4 - r.height);
    setPos({ left, top, maxHeight: H - 8 });
  }, [x, y]);

  useEffect(() => {
    if (!root) return;
    const away = (e) => { if (!e.target.closest?.('.cm')) onClose(); };
    const close = () => onClose();
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('wheel', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, []);

  const openSub = (i) => {
    const row = ref.current?.children[i]?.getBoundingClientRect();
    if (!row) return;
    const right = row.right + 2, room = window.innerWidth - right;
    setSub({ i, x: room > 200 ? right - 4 : row.left + 4, y: row.top - 5, flip: room <= 200 });
  };
  const run = (it, i) => {
    if (!usable(it)) return;
    if (it.items) { openSub(i); setHl(i); return; }
    onClose();
    it.onClick?.();
  };

  // Keys go to the deepest open menu.
  const keys = useRef();
  keys.current = (e) => {
    if (sub) return false;
    const step = (d) => {
      let i = hl;
      for (let n = 0; n < items.length; n++) { i = (i + d + items.length) % items.length; if (usable(items[i])) break; }
      setHl(i);
    };
    if (e.key === 'ArrowDown') step(1);
    else if (e.key === 'ArrowUp') step(-1);
    else if (e.key === 'ArrowRight' && items[hl]?.items) openSub(hl);
    else if (e.key === 'ArrowLeft' && onBack) onBack();
    else if (e.key === 'Enter' || e.key === ' ') run(items[hl], hl);
    else if (e.key === 'Escape') (onBack || onClose)();
    else return false;
    return true;
  };
  useEffect(() => {
    const onKey = (e) => { if (keys.current(e)) { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const ticks = items.some((it) => it && it.checked !== undefined);
  const icons = items.some((it) => it && it.icon);
  return (
    <>
      <div className="cm" role="menu" ref={ref} style={pos} onContextMenu={(e) => e.preventDefault()}>
        {items.map((it, i) => {
          if (it === '-') return <div key={i} className="cm-sep" />;
          if (it.heading) return <div key={i} className="cm-head">{it.heading}</div>;
          return (
            <div key={i} role="menuitem" aria-disabled={it.disabled || undefined}
              className={`cm-item${i === hl ? ' hl' : ''}${it.disabled ? ' off' : ''}${it.danger ? ' danger' : ''}${sub?.i === i ? ' open' : ''}`}
              onPointerEnter={() => {
                setHl(usable(it) ? i : -1);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => (it.items && usable(it) ? openSub(i) : setSub(null)), it.items ? 120 : 200);
              }}
              onClick={() => run(it, i)}>
              {ticks && <span className="cm-tick">{it.checked && <Icon name="check" size={13} />}</span>}
              {icons && <span className="cm-icon">{it.icon && <Icon name={it.icon} size={14} />}</span>}
              <span className="cm-label">{it.label}</span>
              {it.hint && <span className="cm-hint">{it.hint}</span>}
              {it.items && <span className="cm-more"><Icon name="chevR" size={12} /></span>}
            </div>
          );
        })}
      </div>
      {sub && items[sub.i]?.items && (
        <Menu key={sub.i} x={sub.x} y={sub.y} flipX={sub.flip ? true : undefined} items={items[sub.i].items}
          onClose={onClose} onBack={() => setSub(null)} />
      )}
    </>
  );
}

// Shared pieces of the photo menus (filmstrip, Culling and Develop photo).
export const ratingMenu = (current, rate, keys) => ({
  label: 'Set rating',
  icon: 'star',
  items: [0, 1, 2, 3, 4, 5].map((r) => ({
    label: r ? '★'.repeat(r) : 'No stars', hint: keys?.[r] ? keyLabel(keys[r]) : undefined, checked: current === r, onClick: () => rate(r),
  })),
});

/** Show in Explorer and Copy file path for a photo (a virtual copy shows its photo). */
export const fileItems = (photo, reveal) => [
  { label: 'Show in Explorer', icon: 'folder', onClick: () => reveal(photo.raw || photo.jpeg || photo.id) },
  { label: 'Copy file path', icon: 'copy', onClick: () => navigator.clipboard?.writeText(photo.raw || photo.jpeg || photo.id).catch(() => {}) },
];

/** A virtual copy's name as shown: "JWL_7345.NEF · Copy 2". */
export const photoLabel = (p) => (p.copy ? `${p.name} · Copy ${p.copy}` : p.name);

/**
 * Items of a menu bar (Retouch's: { label, key, run, check, disabled, items }, null =
 * divider) for a right-click menu. Each spec is a path through the menu bar,
 * 'Layer/Delete/Layer', optionally as [path, label] to show it under another
 * name, or '-'. Paths that aren't there are left out.
 */
export function fromMenuBar(menus, specs) {
  const conv = (it) => (it === null ? '-' : {
    label: it.label, hint: it.key, disabled: it.disabled, onClick: it.run,
    checked: it.check === undefined ? undefined : !!it.check,
    items: it.items && it.items.map(conv),
  });
  const find = (path) => {
    let list = menus, hit = null;
    for (const part of path.split('/')) {
      hit = list?.find((x) => x && x.label === part);
      list = hit?.items;
    }
    return hit;
  };
  return specs.map((spec) => {
    if (spec === '-') return '-';
    const [path, label] = Array.isArray(spec) ? spec : [spec];
    const hit = find(path);
    return hit && { ...conv(hit), ...(label ? { label } : {}) };
  });
}

/** For opening a menu a frame later (after a click has changed what it's for). */
export const menuAt = (e) => {
  e.preventDefault();
  e.stopPropagation();
  return { clientX: e.clientX, clientY: e.clientY, preventDefault() {}, stopPropagation() {} };
};
