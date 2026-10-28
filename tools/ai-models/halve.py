# Stores a model's large weights as 16-bit floats, with a Cast back to 32-bit
# in front of each: half the download, and ONNX Runtime folds the Casts away
# when it loads the model, so it still computes in 32-bit.
# usage: halve.py in.onnx out.onnx
import sys
import numpy as np
import onnx
from onnx import helper, numpy_helper

m = onnx.load(sys.argv[1])
g = m.graph
keep = []
for t in g.initializer:
    if t.data_type == onnx.TensorProto.FLOAT and np.prod(t.dims) >= 1024:
        a = numpy_helper.to_array(t)
        h = numpy_helper.from_array(a.astype(np.float16), t.name + '_f16')
        keep.append(h)
        g.node.insert(0, helper.make_node('Cast', [h.name], [t.name], to=onnx.TensorProto.FLOAT, name=t.name + '_cast'))
    else:
        keep.append(t)
del g.initializer[:]
g.initializer.extend(keep)
onnx.save(m, sys.argv[2])
