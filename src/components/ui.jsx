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
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  reset: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 3.5v5h5" /></>,
  paste: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 11h6M9 15h4" /></>,
  mask: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="12" cy="12" r="4.5" /></>,
  brush: <><path d="M18.5 3.5l2 2L11 15l-2-2z" /><path d="M9 13c-2.5 0-4 1.5-4 4 0 1.5-1 2.5-2 3 3 .5 7 0 7.5-3.5" /></>,
  linear: <><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M3 8h18M3 12h18M3 16h18" /></>,
  radial: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /></>,
  luminance: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><path d="M3 3l18 18" /></>,
  invert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" /></>,
  minus: <path d="M5 12h14" />,
  // Retouch tools
  eraser: <><path d="M8 20h12" /><path d="M5.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 19H8.5z" /><path d="M10 11l5 5" /></>,
  stamp: <><path d="M9 3h6v5l-1 3h-4L9 8z" /><path d="M5 14h14v3H5z" /><path d="M7 20h10" /></>,
  heal: <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01" /></>,
  spot: <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M19 2l.6 1.4L21 4l-1.4.6L19 6l-.6-1.4L17 4l1.4-.6z" /></>,
  marquee: <><path d="M4 7V4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4" /></>,
  ellipseSel: <><ellipse cx="12" cy="12" rx="9" ry="7" strokeDasharray="3 3" /></>,
  lasso: <><path d="M7 15.5C4.5 14.5 3 12.8 3 10.8 3 7 7 4 12 4s9 3 9 6.8-4 6.7-9 6.7c-1 0-2-.1-2.9-.3" /><circle cx="7.5" cy="17" r="1.8" /><path d="M7 18.8c0 1.5-.8 2.4-2 2.7" /></>,
  hand: <><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M11 10.5v-6a1.5 1.5 0 0 1 3 0V11" /><path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V13" /><path d="M8 12a1.5 1.5 0 0 0-3 0v1.5a7.5 7.5 0 0 0 7.5 7.5h.5a7 7 0 0 0 7-7v-4.5a1.5 1.5 0 0 0-3 0" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 12.5l9 5 9-5" /><path d="M3 17l9 5 9-5" /></>,
  swap: <><path d="M7 4L4 7l3 3" /><path d="M4 7h11a4 4 0 0 1 4 4v1" /><path d="M17 20l3-3-3-3" /><path d="M20 17H9a4 4 0 0 1-4-4v-1" /></>,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  move: <><path d="M12 3v18M3 12h18" /><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>,
  polyLasso: <><path d="M4 7l8-4 8 6-3 8-7 1" /><circle cx="6.5" cy="18" r="1.6" /><path d="M6 19.6c0 1.2-.7 1.9-1.8 2.2" /></>,
  quickSel: <><path d="M15 4l5 5-8 8-5-5z" strokeDasharray="2.5 2.5" /><circle cx="7" cy="17" r="3.5" /></>,
  wand: <><path d="M4 20L15 9" /><path d="M14 3v3M18.5 5.5l-2 2M21 10h-3M18.5 14.5l-2-2M10 5.5l2 2" /></>,
  patch: <><rect x="4" y="9" width="10" height="10" rx="1.5" strokeDasharray="2.5 2.5" /><path d="M10 5h9v9" /><path d="M14 10l5-5" /></>,
  redeye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>,
  pencil: <><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></>,
  gradient: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M11 4v16" strokeOpacity=".75" /><path d="M15 4v16" strokeOpacity=".45" /><path d="M18 4v16" strokeOpacity=".2" /></>,
  bucket: <><path d="M5 11l7-7 7 7-7 7z" /><path d="M5 11h14" /><path d="M20 14c0 1.5 1 2.5 1 3.5a1 1 0 0 1-2 0c0-1 1-2 1-3.5z" /></>,
  blurTool: <path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z" />,
  sharpenTool: <path d="M12 3l6 15H6z" />,
  smudge: <><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 10.5V4.5a1.5 1.5 0 0 1 3 0V12" /><path d="M9 11a1.5 1.5 0 0 0-3 0v2a7 7 0 0 0 7 7h.5a5.5 5.5 0 0 0 5.5-5.5V9a1.5 1.5 0 0 0-3 0" /></>,
  dodge: <><circle cx="9" cy="9" r="5" /><path d="M12.5 12.5L20 20" /></>,
  burn: <><path d="M8 20c-2-2-2-5 0-7l3-3 3 3c2 2 2 5 0 7" /><path d="M5 9c3 0 5-2 6-6 1 4 3 6 6 6" /></>,
  sponge: <><rect x="4" y="7" width="16" height="11" rx="3" /><circle cx="9" cy="11" r="1" /><circle cx="14" cy="13" r="1.2" /><circle cx="11" cy="15" r=".8" /></>,
  type: <><path d="M5 6V4h14v2" /><path d="M12 4v16" /><path d="M9 20h6" /></>,
  shapeRect: <rect x="4" y="5" width="16" height="14" rx="1.5" />,
  shapeEllipse: <ellipse cx="12" cy="12" rx="9" ry="7" />,
  triangle: <path d="M12 4l9 16H3z" />,
  polygon: <path d="M12 3l8.5 6.2-3.2 10H6.7L3.5 9.2z" />,
  line: <path d="M5 19L19 5" />,
  zoom: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8M10.5 7.5v6M7.5 10.5h6" /></>,
  fx: <><path d="M10 5c-2 0-3 1-3.4 3L5 20" /><path d="M4 11h6" /><path d="M13 10l6 8M19 10l-6 8" /></>,
  folder2: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  adjust: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" /></>,
  lockAlpha: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 12h8V4M12 12h8v8h-8z" fill="currentColor" fillOpacity=".35" /></>,
  lockPixels: <><path d="M5 19c2-6 6-11 14-14" /><path d="M14 4l3 3" /></>,
  lockPosition: <><path d="M12 3v18M3 12h18" /><path d="M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5" /></>,
  quickMask: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="4" strokeDasharray="2 2" /></>,
  clipArrow: <><path d="M8 4v9a3 3 0 0 0 3 3h7" /><path d="M15 13l3 3-3 3" /></>,
  histogram: <><path d="M3 20h18" /><path d="M5 20v-4M9 20v-9M13 20V6M17 20v-7" /></>,
  curve: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M5 19C10 18 9 6 19 5" /></>,
  exposure: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 21L21 3" /><path d="M6 8h4M8 6v4M14 16h4" /></>,
  vibrance: <><path d="M4 18L12 4l8 14z" /><path d="M8.5 18L12 11.5 15.5 18" /></>,
  hue: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17" /></>,
  balance: <><path d="M12 4v16M6 20h12" /><path d="M4 9l3-5 3 5a3 3 0 0 1-6 0zM14 9l3-5 3 5a3 3 0 0 1-6 0z" /></>,
  bw: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 4l18 16" /><path d="M21 4v16H3z" fill="currentColor" fillOpacity=".5" /></>,
  photoFilter: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" fill="currentColor" fillOpacity=".35" /></>,
  mixer: <><circle cx="9" cy="9" r="5" /><circle cx="15" cy="9" r="5" /><circle cx="12" cy="15" r="5" /></>,
  selective: <><circle cx="12" cy="12" r="8.5" /><path d="M12 12L12 3.5A8.5 8.5 0 0 1 20.5 12z" fill="currentColor" fillOpacity=".45" /></>,
  posterize: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h6v5H3M9 14h6v6M15 4v10h6" /></>,
  threshold: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15c4 0 4-7 9-7s5 7 9 7" fill="currentColor" fillOpacity=".5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  history: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /><path d="M4 5l2.5 2.5M9 3h6" /></>,
  palette: <><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5-1-2 0-3s3 0 4.5-1A6.5 6.5 0 0 0 21 11c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7" r="1.2" /><circle cx="15" cy="7.5" r="1.2" /></>,
  swatches: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
  ruler: <><rect x="2.5" y="8" width="19" height="8" rx="1" /><path d="M6 8v3M9.5 8v4M13 8v3M16.5 8v4" /></>,
  // AI selections
  ai: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
  subject: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.5-4 3.3-6.5 7-6.5s6.5 2.5 7 6.5" /><path d="M3 7V4h3M18 4h3v3M3 17v3h3M21 17v3h-3" /></>,
  background: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="12" cy="10" r="2.5" /><path d="M7.5 20c.5-3 2.2-4.5 4.5-4.5s4 1.5 4.5 4.5" /></>,
  sky: <><path d="M7 17a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 18 10.5a3.3 3.3 0 0 1-.5 6.5z" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.4-3.5 2.8-5.5 6-5.5s5.6 2 6 5.5" /><circle cx="17" cy="9" r="2.4" /><path d="M16.5 14.5c2.6.2 4.1 2 4.5 5" /></>,
  landscape: <><path d="M2 19l6-9 4 5 3-4 7 8z" /><circle cx="17" cy="6" r="2" /></>,
  dropper: <><path d="M14.5 4.5l5 5" /><path d="M17 2.5a2.1 2.1 0 0 1 3 3L18 7.5l-3-3z" /><path d="M15.5 8.5L6 18l-3 1 1-3 9.5-9.5" /></>,
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
