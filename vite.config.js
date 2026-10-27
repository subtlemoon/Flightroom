import { copyFileSync, mkdirSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Copies the subject detector's WebAssembly runtime next to its model in dist/vision
// (the model itself is in vision/). The desktop side serves both to the window.
const vision = () => ({
  name: 'gearcheck-vision',
  writeBundle() {
    const out = 'dist/vision';
    mkdirSync(out, { recursive: true });
    const wasm = 'node_modules/@mediapipe/tasks-vision/wasm';
    for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(`${wasm}/${f}`, `${out}/${f}`);
    copyFileSync('vision/detector.tflite', `${out}/detector.tflite`);
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), vision()],
});
