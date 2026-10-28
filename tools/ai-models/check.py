# Checks a halved model gives the same answers as the original on random input.
# usage: check.py original.onnx halved.onnx
import sys
import numpy as np
import onnxruntime as ort

a, b = (ort.InferenceSession(p, providers=['CPUExecutionProvider']) for p in sys.argv[1:3])
i = a.get_inputs()[0]
x = np.random.default_rng(0).random([d if isinstance(d, int) else 1 for d in i.shape], dtype=np.float32)
ya, yb = a.run(None, {i.name: x})[0], b.run(None, {i.name: x})[0]
err = float(np.abs(ya - yb).max() / (np.abs(ya).max() + 1e-6))
print(f'{sys.argv[2]}: relative difference {err:.2e}')
sys.exit(0 if err < 2e-2 else 1)
