import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { adoptGearCheckData, bridge } from './bridge.js';
import { detectGraphics } from './develop/graphics.js';
import './styles.css';

if (bridge) bridge.getVersion().then((v) => { window.flightroomVersion = v; }, () => {});
// Weak built-in graphics get lighter drawing in Develop (develop/graphics.js), going by the chip WebView2 draws with.
const graphics = (bridge ? bridge.ai.gpu().then((g) => { window.flightroomGpu = g; return g?.integrated; }, () => false) : Promise.resolve(false))
  .then((integrated) => detectGraphics(integrated));

Promise.all([adoptGearCheckData(), graphics]).finally(() => {
  createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
});
