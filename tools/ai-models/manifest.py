# Writes manifest.json for a folder of built files: each file's size and
# SHA-256, the runtime files each system needs, and the models each feature
# needs (src-tauri/src/ai.rs reads it).
# usage: manifest.py folder
import hashlib
import json
import os
import sys

d = sys.argv[1]
RUNTIME = {'windows': ['onnxruntime.dll', 'DirectML.dll'], 'linux': ['libonnxruntime.so']}
FEATURES = {
    'subject': ['birefnet.onnx'],
    'landscape': ['ade20k.onnx'],
    'people': ['ade20k.onnx', 'selfie_multiclass.onnx'],
    'denoise': ['scunet.onnx'],
    # The AI grade's vision model (transformers.js layout, folders joined with "--").
    'grade': ['smolvlm--' + f for f in [
        'config.json', 'generation_config.json', 'preprocessor_config.json', 'processor_config.json', 'chat_template.json',
        'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'added_tokens.json',
        'onnx--vision_encoder_q4f16.onnx', 'onnx--embed_tokens_q4f16.onnx', 'onnx--decoder_model_merged_q4f16.onnx']],
}
files = []
for name in sorted({n for v in [*RUNTIME.values(), *FEATURES.values()] for n in v}):
    p = os.path.join(d, name)
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    files.append({'name': name, 'sha256': h.hexdigest(), 'size': os.path.getsize(p)})
with open(os.path.join(d, 'manifest.json'), 'w') as f:
    json.dump({'files': files, 'runtime': RUNTIME, 'features': FEATURES}, f, indent=1)
print(json.dumps(files, indent=1))
