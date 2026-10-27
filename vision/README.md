# Subject detector

`detector.tflite` is EfficientDet-Lite2 (int8), an object-detection model trained on
the COCO dataset, from MediaPipe:
https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/latest/efficientdet_lite2.tflite
(Apache License 2.0). Auto-rating uses it to find the subject of each photo
(src/cull/subject.js). The build copies it to dist/vision with MediaPipe's
WebAssembly runtime (vite.config.js).
