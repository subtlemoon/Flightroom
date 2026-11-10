import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { Titlebar } from './components/titlebar.jsx';
import { adoptGearCheckData, bridge } from './bridge.js';
import { detectGraphics } from './develop/graphics.js';
import { initEngine } from './develop/gpu/engine.js';
import './styles.css';

if (bridge) bridge.getVersion().then((v) => { window.flightroomVersion = v; }, () => {});
// Weak built-in graphics get lighter drawing in Develop (develop/graphics.js), going by the chip WebView2 draws with.
// Develop's engine (WebGPU, else WebGL2) is started first: renderers are made at once from then on.
const integrated = bridge ? bridge.ai.gpu().then((g) => { window.flightroomGpu = g; return g?.integrated; }, () => false) : Promise.resolve(false);
const graphics = Promise.all([integrated, initEngine().catch(() => null)]).then(([i]) => detectGraphics(i));

Promise.all([adoptGearCheckData(), graphics]).finally(() => {
  createRoot(document.getElementById('root')).render(<React.StrictMode><Titlebar /><App /></React.StrictMode>);
});
