import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { adoptGearCheckData, bridge } from './bridge.js';
import { setGentleGraphics } from './develop/renderer.js';
import './styles.css';

// Graphics built into the processor get gentler drawing (renderer.js GENTLE_BAND_PX).
if (bridge) bridge.getVersion().then((v) => { window.flightroomVersion = v; }, () => {});
const graphics = bridge ? bridge.ai.gpu().then((g) => { window.flightroomGpu = g; setGentleGraphics(!!g?.integrated); }, () => {}) : Promise.resolve();

Promise.all([adoptGearCheckData(), graphics]).finally(() => {
  createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
});
