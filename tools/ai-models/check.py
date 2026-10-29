# Checks a halved model gives the same answers as the original on random input.
# usage: check.py original.onnx halved.onnx
import sys
import numpy as np
import onnxruntime as ort

# One model at a time: two big ones at once can run out of memory.
def run(path):
    s = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
    i = s.get_inputs()[0]
    x = np.random.default_rng(0).random([d if isinstance(d, int) else 1 for d in i.shape], dtype=np.float32)
    return s.run(None, {i.name: x})[0]
ya = run(sys.argv[1])
yb = run(sys.argv[2])
err = float(np.abs(ya - yb).max() / (np.abs(ya).max() + 1e-6))
print(f'{sys.argv[2]}: relative difference {err:.2e}')
sys.exit(0 if err < 2e-2 else 1)
