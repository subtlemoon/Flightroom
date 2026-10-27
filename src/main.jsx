import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { adoptGearCheckData } from './bridge.js';
import './styles.css';

adoptGearCheckData().finally(() => {
  createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
});
