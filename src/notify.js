// "AI job done" notifications: when Denoise, an AI mask, an AI grade or a model
// download finishes while Flightroom isn't the window in front, Windows shows a
// notification (and the taskbar button flashes). Settings can turn it off.
import { bridge } from './bridge.js';

const KEY = 'flightroom-ai-notify';
export const aiNotifyOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setAiNotify = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} };

/** The desktop side only shows it when the window isn't focused (or is minimized). */
export function aiDone(title, body = '') {
  if (!bridge || !aiNotifyOn()) return;
  bridge.win.notifyDone(title, body);
}
