// Maths typed into a number field: "1920/2", "(30+15)*2", "2^3", "-0.5*pi".
// A small parser, never eval. Returns a finite number or NaN.
// Units and other letters typed after a number ("25 px", "50%") are ignored.

export function evalNumber(text) {
  const s = String(text ?? '').toLowerCase().replace(/(\d),(\d{3})(?!\d)/g, '$1$2').replace(/,/g, '.').replace(/(px|%|°|ev|k)\s*$/, '').replace(/\s+/g, '');
  if (!s || /\d\s+[\d.]/.test(String(text))) return NaN;
  let i = 0;
  const peek = () => s[i];
  const fail = () => { throw new Error('bad'); };
  const num = () => {
    if (s.startsWith('pi', i)) { i += 2; return Math.PI; }
    if (s.startsWith('tau', i)) { i += 3; return Math.PI * 2; }
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (!m) fail();
    i += m[0].length;
    return Number(m[0]);
  };
  const atom = () => {
    if (peek() === '(') { i++; const v = sum(); if (peek() !== ')') fail(); i++; return v; }
    if (peek() === '-') { i++; return -atom(); }
    if (peek() === '+') { i++; return atom(); }
    return num();
  };
  const pow = () => {
    const b = atom();
    if (peek() === '^' || s.startsWith('**', i)) { i += peek() === '^' ? 1 : 2; return b ** pow(); }
    return b;
  };
  const product = () => {
    let v = pow();
    for (let c = peek(); c === '*' || c === '/' || c === '%'; c = peek()) {
      i++;
      const r = pow();
      if (c !== '*' && r === 0) fail();
      v = c === '*' ? v * r : c === '/' ? v / r : v % r;
    }
    return v;
  };
  const sum = () => {
    let v = product();
    for (let c = peek(); c === '+' || c === '-'; c = peek()) { i++; v = c === '+' ? v + product() : v - product(); }
    return v;
  };
  try {
    const v = sum();
    return i === s.length && Number.isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}
