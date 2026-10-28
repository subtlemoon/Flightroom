# tf2onnx writes Resize scales like 129/65, which ONNX floors to 128: nudge them up.
import onnx, sys, numpy as np
from onnx import numpy_helper
m = onnx.load(sys.argv[1])
names = {n.input[2] for n in m.graph.node if n.op_type == 'Resize' and len(n.input) > 2}
for i, t in enumerate(m.graph.initializer):
    if t.name in names:
        a = numpy_helper.to_array(t).copy()
        a[a != 1] += 1e-4
        m.graph.initializer[i].CopyFrom(numpy_helper.from_array(a.astype(np.float32), t.name))
del m.graph.value_info[:]
onnx.save(m, sys.argv[2])
