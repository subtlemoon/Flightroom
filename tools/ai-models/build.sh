#!/usr/bin/env bash
# Builds Flightroom's on-device AI download: the ONNX Runtime libraries and the
# four models, converted to ONNX from their published sources (all free to use
# and ship: Apache-2.0 / MIT). Run by .github/workflows/ai-models.yml, which
# uploads the result to the ai-models-1 release that the app downloads from.
#
#   birefnet.onnx           Subject (BiRefNet general, Swin-tiny backbone, via rembg)
#   ade20k.onnx             Sky, landscape and where people are (DeepLab v3+ Xception, ADE20K)
#   selfie_multiclass.onnx  People's parts: face and body skin, hair, clothes (MediaPipe)
#   scunet.onnx             AI Denoise (SCUNet, real-noise PSNR weights)
#
# usage: build.sh out-folder   (needs python with the packages in requirements.txt)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(mkdir -p "$1" && cd "$1" && pwd)"
SRC="$OUT/src"
mkdir -p "$SRC"
get() { [ -f "$SRC/$2" ] || curl -fsSL --retry 4 -o "$SRC/$2" "$1"; }

ORT=1.24.4 DML=1.15.4
get "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx" birefnet.onnx
get "https://storage.googleapis.com/download.tensorflow.org/models/deeplabv3_xception_ade20k_train_2018_05_29.tar.gz" deeplab.tar.gz
get "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite" selfie.tflite
get "https://github.com/cszn/KAIR/releases/download/v1.0/scunet_color_real_psnr.pth" scunet.pth
get "https://api.nuget.org/v3-flatcontainer/microsoft.ml.onnxruntime.directml/$ORT/microsoft.ml.onnxruntime.directml.$ORT.nupkg" ort-dml.zip
get "https://api.nuget.org/v3-flatcontainer/microsoft.ai.directml/$DML/microsoft.ai.directml.$DML.nupkg" directml.zip
get "https://github.com/microsoft/onnxruntime/releases/download/v$ORT/onnxruntime-linux-x64-$ORT.tgz" ort-linux.tgz

# The runtime: Windows (DirectML, graphics card) and Linux (processor, for testing).
unzip -o -j -q "$SRC/ort-dml.zip" runtimes/win-x64/native/onnxruntime.dll -d "$OUT"
unzip -o -j -q "$SRC/directml.zip" bin/x64-win/DirectML.dll -d "$OUT"
tar -xzf "$SRC/ort-linux.tgz" -C "$SRC"
cp "$SRC/onnxruntime-linux-x64-$ORT/lib/libonnxruntime.so.$ORT" "$OUT/libonnxruntime.so"

# Models. Large weights are stored as 16-bit floats (halve.py), checked against the original.
tar -xzf "$SRC/deeplab.tar.gz" -C "$SRC"
python -m tf2onnx.convert --graphdef "$SRC/deeplabv3_xception_ade20k_train/frozen_inference_graph.pb" \
  --inputs "sub_7:0[1,513,513,3]" --outputs "logits/semantic/BiasAdd:0" --opset 17 --output "$SRC/ade20k.raw.onnx"
python "$HERE/fixscales.py" "$SRC/ade20k.raw.onnx" "$SRC/ade20k.onnx"
python -m tf2onnx.convert --tflite "$SRC/selfie.tflite" --opset 17 --output "$OUT/selfie_multiclass.onnx"
python "$HERE/scunet_export.py" "$SRC/scunet.pth" "$SRC/scunet.onnx" 256
for m in birefnet ade20k scunet; do
  python "$HERE/halve.py" "$SRC/$m.onnx" "$OUT/$m.onnx"
  python "$HERE/check.py" "$SRC/$m.onnx" "$OUT/$m.onnx"
done

python "$HERE/manifest.py" "$OUT"
rm -rf "$SRC"
