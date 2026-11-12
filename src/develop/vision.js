// The AI grade's eyes: a small vision language model (SmolVLM 500M Instruct,
// Apache-2.0) that looks at the photo and says what it is: the place, the
// light, the subject. It runs in the window with transformers.js on the
// graphics card (WebGPU). The model comes with the "grade" AI download and the
// desktop side serves it from this computer (src-tauri/src/ai.rs vision_url);
// nothing is fetched from the internet. mood.js turns what it says into the grade.
import { bridge, FILES } from '../bridge.js';
// ONNX Runtime's WebAssembly part, from the app itself (transformers.js would fetch it from a CDN).
import ortWasm from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url';

export const VISION_EDGE = 512; // px: what SmolVLM sees without splitting the photo into tiles
const MODEL = 'smolvlm';

let loading = null;
let lib = null;
let base = null; // where the model files are; tools/vlm-try serves them elsewhere

/** Serves the model from `url` instead of the AI download (for trying it outside the app). */
export const setVisionBase = (url) => { base = url; };

/** Why the vision model can't run on this computer, or null. */
export async function visionBlocked() {
  if (!navigator.gpu) return 'this graphics card has no WebGPU';
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!a) return 'no graphics card for WebGPU';
    if (!a.features.has('shader-f16')) return 'this graphics card can\'t do 16-bit maths in WebGPU';
  } catch { return 'WebGPU failed to start'; }
  return null;
}

const MB = (n) => Math.round(n / 1e6);

/**
 * Loads the model once (a few seconds; the files are on this computer).
 * onProgress(label, 0-1) says how far: reading the files, then starting it on the graphics card.
 */
let listen = null; // the latest caller's onProgress (a grade started while loading takes it over)
export function loadVision(onProgress) {
  listen = onProgress;
  if (!loading) {
    loading = (async () => {
      listen?.('Starting the vision model', 0);
      const t = await import('@huggingface/transformers');
      const local = base || (await bridge?.ai.visionUrl().catch(() => null));
      // The files come from this computer, but by URL, which transformers.js only checks for
      // (tokenizer_config.json above all) as a "remote" host: as a local path it decides they're missing.
      const url = typeof local === 'string' ? local : `${FILES}ai/`;
      t.env.allowLocalModels = false;
      t.env.allowRemoteModels = true;
      t.env.remoteHost = new URL(url, location.href).href;
      t.env.remotePathTemplate = '{model}/';
      t.env.useBrowserCache = false;
      t.env.useWasmCache = false;
      t.env.backends.onnx.wasm.wasmPaths = { wasm: ortWasm };
      t.env.backends.onnx.wasm.numThreads = 1;
      // Bytes read across all the files; once they're in, the graphics card gets the model ready.
      const files = new Map();
      const progress_callback = (p) => {
        if (p.status !== 'progress' || !p.total) return;
        files.set(p.file, [p.loaded, p.total]);
        let got = 0, all = 0;
        for (const [l, n] of files.values()) { got += l; all += n; }
        listen?.(got >= all ? 'Starting the vision model on the graphics card' : `Reading the vision model (${MB(got)} of ${MB(all)} MB)`, all > 1e8 ? got / all : 0);
      };
      const processor = await t.AutoProcessor.from_pretrained(MODEL, { progress_callback });
      const model = await t.AutoModelForVision2Seq.from_pretrained(MODEL, {
        device: 'webgpu',
        dtype: { embed_tokens: 'q4f16', vision_encoder: 'q4f16', decoder_model_merged: 'q4f16' },
        progress_callback,
      });
      lib = t;
      return { processor, model };
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

// The model reads the picture top row first, as RGB.
function toImage(pic) {
  const { w, h, rgba } = pic;
  const rgb = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4, dst = y * w * 3;
    for (let x = 0; x < w; x++) {
      rgb[dst + x * 3] = rgba[src + x * 4];
      rgb[dst + x * 3 + 1] = rgba[src + x * 4 + 1];
      rgb[dst + x * 3 + 2] = rgba[src + x * 4 + 2];
    }
  }
  return new lib.RawImage(rgb, w, h, 3);
}

async function ask({ processor, model }, image, question, maxTokens) {
  const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: question }] }];
  const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await processor(prompt, [image], { do_image_splitting: false });
  const ids = await model.generate({ ...inputs, max_new_tokens: maxTokens, do_sample: false, repetition_penalty: 1.1 });
  const [text] = processor.batch_decode(ids.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
  return text.trim();
}

export const DESCRIBE = 'Describe this photo in two sentences: what and where it is, the light and time of day, and the main subject.';

/**
 * What the model sees in `pic` ({ w, h, rgba } bottom row first, about
 * VISION_EDGE on the long edge), as a short description.
 */
export async function lookAt(pic, { onProgress, onLook } = {}) {
  const vlm = await loadVision(onProgress);
  onLook?.();
  return ask(vlm, toImage(pic), DESCRIBE, 80);
}
