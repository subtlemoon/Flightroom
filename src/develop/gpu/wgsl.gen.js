// Made by tools/wgsl.mjs from programs.js; don't edit.
/* eslint-disable */
export const WGSL = {
 "down": {
  "hash": "2cfdbb55",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uPicture: f32,\n    uOutSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e18 = cam_1;\n    c = max(_e18, vec3(0f));\n    let _e23 = cam_1;\n    let _e24 = global.uWB;\n    bal = min((_e23 * _e24), vec3(1f));\n    let _e32 = c;\n    let _e34 = c;\n    let _e36 = c;\n    let _e42 = global.uPicture;\n    clip = (smoothstep(0.88f, 0.97f, max(_e32.x, max(_e34.y, _e36.z))) * (1f - _e42));\n    let _e46 = bal;\n    let _e47 = bal;\n    let _e49 = bal;\n    let _e51 = bal;\n    let _e56 = clip;\n    bal = mix(_e46, vec3(max(_e47.x, max(_e49.y, _e51.z))), vec3(_e56));\n    let _e59 = global.uCam;\n    let _e60 = bal;\n    return (_e59 * _e60);\n}\n\nfn main_1() {\n    var local: f32;\n    var cell: vec2<f32>;\n    var base: vec2<f32>;\n    var lsum: f32 = 0f;\n    var hsum: f32 = 0f;\n    var j: i32 = 0i;\n    var i: i32;\n    var uv: vec2<f32>;\n    var lin: vec3<f32>;\n\n    let _e18 = gl_FragCoord_1;\n    let _e20 = global.frFlip;\n    if (_e20 > 0.5f) {\n        let _e23 = global.frH;\n        let _e24 = gl_FragCoord_1;\n        local = (_e23 - _e24.y);\n    } else {\n        let _e27 = gl_FragCoord_1;\n        local = _e27.y;\n    }\n    let _e30 = local;\n    let _e31 = gl_FragCoord_1;\n    let _e32 = _e31.zw;\n    frFC = vec4<f32>(_e18.x, _e30, _e32.x, _e32.y);\n    let _e37 = global.uOutSize;\n    cell = (vec2(1f) / _e37);\n    let _e41 = frFC;\n    let _e46 = cell;\n    base = ((_e41.xy - vec2(0.5f)) * _e46);\n    loop {\n        let _e55 = j;\n        if !((_e55 < 4i)) {\n            break;\n        }\n        i = 0i;\n        loop {\n            let _e64 = i;\n            if !((_e64 < 4i)) {\n                break;\n            }\n            {\n                let _e71 = base;\n                let _e72 = i;\n                let _e74 = j;\n                let _e80 = cell;\n                uv = (_e71 + (((vec2<f32>(f32(_e72), f32(_e74)) + vec2(0.5f)) * _e80) / vec2(4f)));\n                let _e87 = uv;\n                let _e88 = textureSample(uSrc, uSrc_s, _e87);\n                let _e90 = toLinear(_e88.xyz);\n                lin = _e90;\n                let _e92 = lsum;\n                let _e93 = lin;\n                lsum = (_e92 + log2(max(dot(_e93, W709_), 0.00001f)));\n                let _e99 = hsum;\n                let _e100 = lin;\n                let _e102 = lin;\n                let _e105 = lin;\n                hsum = (_e99 + max(min(min(_e100.x, _e102.y), _e105.z), 0f));\n            }\n            continuing {\n                let _e68 = i;\n                i = (_e68 + 1i);\n            }\n        }\n        continuing {\n            let _e59 = j;\n            j = (_e59 + 1i);\n        }\n    }\n    let _e111 = lsum;\n    let _e114 = hsum;\n    o = vec4<f32>((_e111 / 16f), (_e114 / 16f), 0f, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 96,
  "uniforms": {
   "uWB": [
    0,
    "vec3",
    0
   ],
   "uCam": [
    16,
    "mat3",
    0
   ],
   "uPicture": [
    64,
    "float",
    0
   ],
   "uOutSize": [
    72,
    "vec2",
    0
   ],
   "frFlip": [
    80,
    "float",
    0
   ],
   "frH": [
    84,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uSrc",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "blur": {
  "hash": "b8b4a1ab",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uStep: vec2<f32>,\n    uSigma: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var uv: vec2<f32>;\n    var size: vec2<i32>;\n    var sum: vec4<f32> = vec4(0f);\n    var wsum: f32 = 0f;\n    var r: i32;\n    var i: i32 = -40i;\n    var w: f32;\n\n    let _e13 = gl_FragCoord_1;\n    let _e15 = global.frFlip;\n    if (_e15 > 0.5f) {\n        let _e18 = global.frH;\n        let _e19 = gl_FragCoord_1;\n        local = (_e18 - _e19.y);\n    } else {\n        let _e22 = gl_FragCoord_1;\n        local = _e22.y;\n    }\n    let _e25 = local;\n    let _e26 = gl_FragCoord_1;\n    let _e27 = _e26.zw;\n    frFC = vec4<f32>(_e13.x, _e25, _e27.x, _e27.y);\n    let _e31 = frFC;\n    uv = (_e31.xy * 0f);\n    let _e37 = textureDimensions(uTex, 0i);\n    size = vec2<i32>(_e37);\n    let _e40 = frFC;\n    let _e42 = size;\n    uv = (_e40.xy / vec2<f32>(_e42));\n    let _e50 = global.uSigma;\n    r = i32(ceil((_e50 * 2.5f)));\n    loop {\n        let _e59 = i;\n        if !((_e59 <= 40i)) {\n            break;\n        }\n        {\n            let _e66 = i;\n            let _e67 = r;\n            let _e70 = i;\n            let _e71 = r;\n            if ((_e66 < -(_e67)) || (_e70 > _e71)) {\n                continue;\n            }\n            let _e74 = i;\n            let _e75 = i;\n            let _e80 = global.uSigma;\n            let _e82 = global.uSigma;\n            w = exp((-(f32((_e74 * _e75))) / ((2f * _e80) * _e82)));\n            let _e87 = sum;\n            let _e88 = uv;\n            let _e89 = global.uStep;\n            let _e90 = i;\n            let _e94 = textureSample(uTex, uTex_s, (_e88 + (_e89 * f32(_e90))));\n            let _e95 = w;\n            sum = (_e87 + (_e94 * _e95));\n            let _e98 = wsum;\n            let _e99 = w;\n            wsum = (_e98 + _e99);\n        }\n        continuing {\n            let _e63 = i;\n            i = (_e63 + 1i);\n        }\n    }\n    let _e101 = sum;\n    let _e102 = wsum;\n    o = (_e101 / vec4(_e102));\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e19 = o;\n    return FragmentOutput(_e19);\n}\n",
  "size": 32,
  "uniforms": {
   "uStep": [
    0,
    "vec2",
    0
   ],
   "uSigma": [
    8,
    "float",
    0
   ],
   "frFlip": [
    12,
    "float",
    0
   ],
   "frH": [
    16,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "cnrDown": {
  "hash": "f8ffccea",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uPicture: f32,\n    uOutSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e18 = cam_1;\n    c = max(_e18, vec3(0f));\n    let _e23 = cam_1;\n    let _e24 = global.uWB;\n    bal = min((_e23 * _e24), vec3(1f));\n    let _e32 = c;\n    let _e34 = c;\n    let _e36 = c;\n    let _e42 = global.uPicture;\n    clip = (smoothstep(0.88f, 0.97f, max(_e32.x, max(_e34.y, _e36.z))) * (1f - _e42));\n    let _e46 = bal;\n    let _e47 = bal;\n    let _e49 = bal;\n    let _e51 = bal;\n    let _e56 = clip;\n    bal = mix(_e46, vec3(max(_e47.x, max(_e49.y, _e51.z))), vec3(_e56));\n    let _e59 = global.uCam;\n    let _e60 = bal;\n    return (_e59 * _e60);\n}\n\nfn main_1() {\n    var local: f32;\n    var cell: vec2<f32>;\n    var base: vec2<f32>;\n    var acc: vec4<f32> = vec4(0f);\n    var j: i32 = 0i;\n    var i: i32;\n    var lin: vec3<f32>;\n    var y: f32;\n    var c_1: vec2<f32>;\n\n    let _e18 = gl_FragCoord_1;\n    let _e20 = global.frFlip;\n    if (_e20 > 0.5f) {\n        let _e23 = global.frH;\n        let _e24 = gl_FragCoord_1;\n        local = (_e23 - _e24.y);\n    } else {\n        let _e27 = gl_FragCoord_1;\n        local = _e27.y;\n    }\n    let _e30 = local;\n    let _e31 = gl_FragCoord_1;\n    let _e32 = _e31.zw;\n    frFC = vec4<f32>(_e18.x, _e30, _e32.x, _e32.y);\n    let _e37 = global.uOutSize;\n    cell = (vec2(1f) / _e37);\n    let _e41 = frFC;\n    let _e46 = cell;\n    base = ((_e41.xy - vec2(0.5f)) * _e46);\n    loop {\n        let _e54 = j;\n        if !((_e54 < 2i)) {\n            break;\n        }\n        i = 0i;\n        loop {\n            let _e63 = i;\n            if !((_e63 < 2i)) {\n                break;\n            }\n            {\n                let _e70 = base;\n                let _e71 = i;\n                let _e73 = j;\n                let _e79 = cell;\n                let _e84 = textureSample(uSrc, uSrc_s, (_e70 + (((vec2<f32>(f32(_e71), f32(_e73)) + vec2(0.5f)) * _e79) * 0.5f)));\n                let _e86 = toLinear(_e84.xyz);\n                lin = _e86;\n                let _e88 = lin;\n                y = dot(_e88, W709_);\n                let _e91 = lin;\n                let _e93 = y;\n                c_1 = (_e91.xz - vec2(_e93));\n                let _e97 = acc;\n                let _e98 = c_1;\n                let _e99 = y;\n                let _e100 = c_1;\n                let _e101 = c_1;\n                acc = (_e97 + vec4<f32>(_e98.x, _e98.y, _e99, dot(_e100, _e101)));\n            }\n            continuing {\n                let _e67 = i;\n                i = (_e67 + 1i);\n            }\n        }\n        continuing {\n            let _e58 = j;\n            j = (_e58 + 1i);\n        }\n    }\n    let _e107 = acc;\n    let _e110 = (_e107.xyz * 0.25f);\n    o = vec4<f32>(_e110.x, _e110.y, _e110.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 96,
  "uniforms": {
   "uWB": [
    0,
    "vec3",
    0
   ],
   "uCam": [
    16,
    "mat3",
    0
   ],
   "uPicture": [
    64,
    "float",
    0
   ],
   "uOutSize": [
    72,
    "vec2",
    0
   ],
   "frFlip": [
    80,
    "float",
    0
   ],
   "frH": [
    84,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uSrc",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "cnrBlur": {
  "hash": "ac6aa35a",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uNoise: array<vec4<f32>, 3>,\n    uStep: vec2<f32>,\n    uSigma: f32,\n    uRange: f32,\n    uNoiseDiv: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst CNR_EPS: f32 = 0.02f;\nconst CNR_TB: f32 = 25f;\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn noiseAt(y: f32) -> f32 {\n    var y_1: f32;\n    var t: f32;\n    var i: i32;\n    var f: f32;\n    var local: f32;\n    var a: f32;\n    var j: i32;\n    var local_1: f32;\n    var b: f32;\n\n    y_1 = y;\n    let _e19 = y_1;\n    t = clamp(((log2(max(_e19, 0.0001f)) + 10f) / 1.25f), 0f, 7f);\n    let _e31 = t;\n    i = i32(floor(_e31));\n    let _e35 = t;\n    let _e36 = i;\n    f = (_e35 - f32(_e36));\n    let _e40 = i;\n    if (_e40 < 4i) {\n        let _e43 = i;\n        let _e47 = global.uNoise[0][_e43];\n        local = _e47;\n    } else {\n        let _e48 = i;\n        let _e54 = global.uNoise[1][(_e48 - 4i)];\n        local = _e54;\n    }\n    let _e56 = local;\n    a = _e56;\n    let _e58 = i;\n    j = min((_e58 + 1i), 7i);\n    let _e64 = j;\n    if (_e64 < 4i) {\n        let _e67 = j;\n        let _e71 = global.uNoise[0][_e67];\n        local_1 = _e71;\n    } else {\n        let _e72 = j;\n        let _e78 = global.uNoise[1][(_e72 - 4i)];\n        local_1 = _e78;\n    }\n    let _e80 = local_1;\n    b = _e80;\n    let _e82 = a;\n    let _e83 = b;\n    let _e84 = f;\n    return mix(_e82, _e83, _e84);\n}\n\nfn main_1() {\n    var local_2: f32;\n    var uv: vec2<f32>;\n    var c0_: vec4<f32>;\n    var sum: vec4<f32> = vec4(0f);\n    var wsum: f32 = 0f;\n    var r: i32;\n    var i_1: i32 = -24i;\n    var t_1: vec4<f32>;\n    var d: f32;\n    var dc: vec2<f32>;\n    var nv: f32;\n    var w: f32;\n\n    let _e21 = gl_FragCoord_1;\n    let _e23 = global.frFlip;\n    if (_e23 > 0.5f) {\n        let _e26 = global.frH;\n        let _e27 = gl_FragCoord_1;\n        local_2 = (_e26 - _e27.y);\n    } else {\n        let _e30 = gl_FragCoord_1;\n        local_2 = _e30.y;\n    }\n    let _e33 = local_2;\n    let _e34 = gl_FragCoord_1;\n    let _e35 = _e34.zw;\n    frFC = vec4<f32>(_e21.x, _e33, _e35.x, _e35.y);\n    let _e39 = frFC;\n    let _e42 = textureDimensions(uTex, 0i);\n    uv = (_e39.xy / vec2<f32>(vec2<i32>(_e42)));\n    let _e47 = uv;\n    let _e48 = textureSample(uTex, uTex_s, _e47);\n    c0_ = _e48;\n    let _e55 = global.uSigma;\n    r = i32(ceil((_e55 * 2.5f)));\n    loop {\n        let _e64 = i_1;\n        if !((_e64 <= 24i)) {\n            break;\n        }\n        {\n            let _e71 = i_1;\n            let _e72 = r;\n            let _e75 = i_1;\n            let _e76 = r;\n            if ((_e71 < -(_e72)) || (_e75 > _e76)) {\n                continue;\n            }\n            let _e79 = uv;\n            let _e80 = global.uStep;\n            let _e81 = i_1;\n            let _e85 = textureSample(uTex, uTex_s, (_e79 + (_e80 * f32(_e81))));\n            t_1 = _e85;\n            let _e87 = t_1;\n            let _e93 = c0_;\n            d = (log2((max(_e87.z, 0f) + CNR_EPS)) - log2((max(_e93.z, 0f) + CNR_EPS)));\n            let _e101 = t_1;\n            let _e103 = t_1;\n            let _e109 = c0_;\n            let _e111 = c0_;\n            dc = ((_e101.xy / vec2(max(_e103.z, 0.004f))) - (_e109.xy / vec2(max(_e111.z, 0.004f))));\n            let _e119 = c0_;\n            let _e121 = noiseAt(_e119.z);\n            let _e122 = global.uNoiseDiv;\n            let _e123 = c0_;\n            let _e125 = c0_;\n            nv = (_e121 / (_e122 * max((_e123.z * _e125.z), 0.000016000002f)));\n            let _e135 = i_1;\n            let _e136 = i_1;\n            let _e141 = global.uSigma;\n            let _e143 = global.uSigma;\n            let _e146 = d;\n            let _e147 = d;\n            let _e150 = global.uRange;\n            let _e152 = global.uRange;\n            let _e156 = dc;\n            let _e157 = dc;\n            let _e162 = nv;\n            w = exp((((-(f32((_e135 * _e136))) / ((2f * _e141) * _e143)) - ((_e146 * _e147) / ((2f * _e150) * _e152))) - (dot(_e156, _e157) / (50f * _e162))));\n            let _e168 = sum;\n            let _e169 = t_1;\n            let _e170 = w;\n            sum = (_e168 + (_e169 * _e170));\n            let _e173 = wsum;\n            let _e174 = w;\n            wsum = (_e173 + _e174);\n        }\n        continuing {\n            let _e68 = i_1;\n            i_1 = (_e68 + 1i);\n        }\n    }\n    let _e176 = sum;\n    let _e177 = wsum;\n    o = (_e176 / vec4(_e177));\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e29 = o;\n    return FragmentOutput(_e29);\n}\n",
  "size": 80,
  "uniforms": {
   "uNoise": [
    0,
    "vec4",
    3
   ],
   "uStep": [
    48,
    "vec2",
    0
   ],
   "uSigma": [
    56,
    "float",
    0
   ],
   "uRange": [
    60,
    "float",
    0
   ],
   "uNoiseDiv": [
    64,
    "float",
    0
   ],
   "frFlip": [
    68,
    "float",
    0
   ],
   "frH": [
    72,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "final": {
  "hash": "28b967e8",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uPicture: f32,\n    uNoise: array<vec4<f32>, 3>,\n    uHiRect: vec4<f32>,\n    uHiSafe: vec4<f32>,\n    uChromaPx: vec2<f32>,\n    uGlowMix: vec4<f32>,\n    uGlowF: vec4<f32>,\n    uGlowF2_: vec4<f32>,\n    uLook: vec2<f32>,\n    uOut2Ori: mat3x3<f32>,\n    uOri2Photo: mat3x3<f32>,\n    uOut2Crop: mat3x3<f32>,\n    uOriCenter: vec2<f32>,\n    uOriHalf: f32,\n    uCornerR2_: f32,\n    uPersp: mat3x3<f32>,\n    uDistort: f32,\n    uLensK: vec4<f32>,\n    uLensC: vec2<f32>,\n    uLensN: vec2<f32>,\n    uLensVig: f32,\n    uLensVigMid: f32,\n    uDefringeP: f32,\n    uDefringeG: f32,\n    uShadowTint: f32,\n    uPhotoPx: vec2<f32>,\n    uOut2Vig: mat3x3<f32>,\n    uCropAspect: f32,\n    uBg: vec3<f32>,\n    uExposure: f32,\n    uContrast: f32,\n    uContrastSat: f32,\n    uConPivot: f32,\n    uToneMap: f32,\n    uTmA: vec4<f32>,\n    uTmB: vec4<f32>,\n    uTmHue: f32,\n    uHighlights: f32,\n    uShadows: f32,\n    uWhites: f32,\n    uBlacks: f32,\n    uHlTop: f32,\n    uTexture: f32,\n    uClarity: f32,\n    uDehaze: f32,\n    uVibrance: f32,\n    uSaturation: f32,\n    uAirY: f32,\n    uSharpen: f32,\n    uSharpenRadius: f32,\n    uSharpenDetail: f32,\n    uSharpenMasking: f32,\n    uChromaOn: f32,\n    uNoiseFull: f32,\n    uNrLum: f32,\n    uNrColor: f32,\n    uNrLumDetail: f32,\n    uNrLumContrast: f32,\n    uNrColorDetail: f32,\n    uNrColorSmooth: f32,\n    uVignette: f32,\n    uVigMid: f32,\n    uVigRound: f32,\n    uVigFeather: f32,\n    uVigStyle: f32,\n    uVigHighlights: f32,\n    uRefineSat: f32,\n    uBW: f32,\n    uGradeS: vec3<f32>,\n    uGradeM: vec3<f32>,\n    uGradeH: vec3<f32>,\n    uGradeG: vec3<f32>,\n    uGradeLum: vec4<f32>,\n    uGradeShape: vec2<f32>,\n    uGradeOn: f32,\n    uGrain: vec3<f32>,\n    uShowClip: f32,\n    uMelissa: f32,\n    uOriSize: vec2<f32>,\n    uMaskN: f32,\n    uMA: array<vec4<f32>, 16>,\n    uMB: array<vec4<f32>, 16>,\n    uMC: array<vec4<f32>, 16>,\n    uMD: array<vec4<f32>, 16>,\n    uMR: array<vec4<f32>, 16>,\n    uME: array<vec4<f32>, 16>,\n    uMF: array<vec4<f32>, 16>,\n    uMP: array<vec4<f32>, 16>,\n    uMQ: array<vec4<f32>, 16>,\n    uMS: array<vec4<f32>, 16>,\n    uDcp: f32,\n    uBaseSat: f32,\n    uHsmDims: vec4<f32>,\n    uLookADims: vec4<f32>,\n    uLookBDims: vec4<f32>,\n    uS2P: mat3x3<f32>,\n    uP2S: mat3x3<f32>,\n    uPointView: f32,\n    uMaskView: f32,\n    uMaskColor: vec3<f32>,\n    uMaskOpacity: f32,\n    uMaskStyle: f32,\n    uMaskLine: f32,\n    uMaskFeather: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\nconst CS_K: f32 = 0.25f;\nconst CS_V: f32 = 0.1f;\nconst CON_K: f32 = 1f;\nconst CON_LUM: f32 = 0.6f;\nconst HL_K: f32 = 1.3f;\nconst HL_LO: f32 = 0.35f;\nconst HL_T0_: f32 = 0.65f;\nconst HL_T1_: f32 = 0.85f;\nconst SH_K: f32 = 1.3f;\nconst SH_HI: f32 = 0.65f;\nconst SH_DEEP: f32 = 0.8f;\nconst SH_C: f32 = 0.3f;\nconst HL_X: f32 = 0.5f;\nconst SH_X: f32 = 0.2f;\nconst LIFT_EDGE: f32 = 1f;\nconst LIFT_R: f32 = 4f;\nconst CON_LOCAL: f32 = 0.45f;\nconst WB_LOCAL: f32 = 0.45f;\nconst WH_NEG: f32 = 0.24f;\nconst WH_POS: f32 = 0.3f;\nconst BL_NEG: f32 = 1.4f;\nconst BL_POS: f32 = 0.55f;\nconst BL_N: f32 = 2.36f;\nconst BL_LIFT: f32 = 0.035f;\nconst LIFT_GREY: f32 = 0.9f;\nconst CNR_RANGE: f32 = 0.8f;\nconst CNR_T: f32 = 30f;\nconst CNR_EPS: f32 = 0.02f;\nconst CNR_LOCAL: f32 = 0.11f;\nconst CNR_TL: f32 = 9f;\nconst CURVE_ROW0_: f32 = 0.029411765f;\nconst CHROMA_FLOOR: f32 = 0.004f;\nconst SRGB_TO_PP: mat3x3<f32> = mat3x3<f32>(vec3<f32>(0.529346f, 0.098374f, 0.016883f), vec3<f32>(0.330073f, 0.873461f, 0.117672f), vec3<f32>(0.140581f, 0.028165f, 0.865444f));\nconst PP_TO_SRGB: mat3x3<f32> = mat3x3<f32>(vec3<f32>(2.034076f, -0.228813f, -0.00857f), vec3<f32>(-0.727334f, 1.23173f, -0.153287f), vec3<f32>(-0.306742f, -0.002917f, 1.161856f));\nconst MIX_HUE: f32 = 37.97f;\nconst MIX_SAT_UP: f32 = 0.211f;\nconst MIX_SAT_DOWN: f32 = 0.692f;\nconst MIX_LUM_UP: f32 = 0.929f;\nconst MIX_LUM_DOWN: f32 = 0.834f;\nconst MIX_LUM_SAT: f32 = 0.127f;\nconst MIX_S: f32 = 0.0615f;\nconst GRADE_C: f32 = 0.6257f;\nconst GRADE_OFF: f32 = 0.1045f;\nconst GRADE_W: f32 = 0.1302f;\nconst GRADE_P: f32 = 0.4262f;\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\n@group(0) @binding(3) \nvar uHi: texture_2d<f32>;\n@group(0) @binding(4) \nvar uHi_s: sampler;\n@group(0) @binding(5) \nvar uGuide: texture_2d<f32>;\n@group(0) @binding(6) \nvar uGuide_s: sampler;\n@group(0) @binding(7) \nvar uChroma: texture_2d<f32>;\n@group(0) @binding(8) \nvar uChroma_s: sampler;\n@group(0) @binding(9) \nvar uGlow: texture_2d<f32>;\n@group(0) @binding(10) \nvar uGlow_s: sampler;\n@group(0) @binding(11) \nvar uCurve: texture_2d<f32>;\n@group(0) @binding(12) \nvar uCurve_s: sampler;\n@group(0) @binding(13) \nvar uHue: texture_2d<f32>;\n@group(0) @binding(14) \nvar uHue_s: sampler;\n@group(0) @binding(15) \nvar uMask0_: texture_2d<f32>;\n@group(0) @binding(16) \nvar uMask0_s: sampler;\n@group(0) @binding(17) \nvar uMask1_: texture_2d<f32>;\n@group(0) @binding(18) \nvar uMask1_s: sampler;\n@group(0) @binding(19) \nvar uMask2_: texture_2d<f32>;\n@group(0) @binding(20) \nvar uMask2_s: sampler;\n@group(0) @binding(21) \nvar uMask3_: texture_2d<f32>;\n@group(0) @binding(22) \nvar uMask3_s: sampler;\n@group(0) @binding(23) \nvar uHsm: texture_2d<f32>;\n@group(0) @binding(24) \nvar uHsm_s: sampler;\n@group(0) @binding(25) \nvar uLookA: texture_2d<f32>;\n@group(0) @binding(26) \nvar uLookA_s: sampler;\n@group(0) @binding(27) \nvar uLookB: texture_2d<f32>;\n@group(0) @binding(28) \nvar uLookB_s: sampler;\n@group(0) @binding(29) \nvar uTone: texture_2d<f32>;\n@group(0) @binding(30) \nvar uTone_s: sampler;\n@group(0) @binding(31) \nvar frNearest: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o_4: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e251 = cam_1;\n    c = max(_e251, vec3(0f));\n    let _e256 = cam_1;\n    let _e257 = global.uWB;\n    bal = min((_e256 * _e257), vec3(1f));\n    let _e265 = c;\n    let _e267 = c;\n    let _e269 = c;\n    let _e275 = global.uPicture;\n    clip = (smoothstep(0.88f, 0.97f, max(_e265.x, max(_e267.y, _e269.z))) * (1f - _e275));\n    let _e279 = bal;\n    let _e280 = bal;\n    let _e282 = bal;\n    let _e284 = bal;\n    let _e289 = clip;\n    bal = mix(_e279, vec3(max(_e280.x, max(_e282.y, _e284.z))), vec3(_e289));\n    let _e292 = global.uCam;\n    let _e293 = bal;\n    return (_e292 * _e293);\n}\n\nfn noiseAt(y: f32) -> f32 {\n    var y_1: f32;\n    var t: f32;\n    var i: i32;\n    var f: f32;\n    var local: f32;\n    var a: f32;\n    var j: i32;\n    var local_1: f32;\n    var b: f32;\n\n    y_1 = y;\n    let _e251 = y_1;\n    t = clamp(((log2(max(_e251, 0.0001f)) + 10f) / 1.25f), 0f, 7f);\n    let _e263 = t;\n    i = i32(floor(_e263));\n    let _e267 = t;\n    let _e268 = i;\n    f = (_e267 - f32(_e268));\n    let _e272 = i;\n    if (_e272 < 4i) {\n        let _e275 = i;\n        let _e279 = global.uNoise[0][_e275];\n        local = _e279;\n    } else {\n        let _e280 = i;\n        let _e286 = global.uNoise[1][(_e280 - 4i)];\n        local = _e286;\n    }\n    let _e288 = local;\n    a = _e288;\n    let _e290 = i;\n    j = min((_e290 + 1i), 7i);\n    let _e296 = j;\n    if (_e296 < 4i) {\n        let _e299 = j;\n        let _e303 = global.uNoise[0][_e299];\n        local_1 = _e303;\n    } else {\n        let _e304 = j;\n        let _e310 = global.uNoise[1][(_e304 - 4i)];\n        local_1 = _e310;\n    }\n    let _e312 = local_1;\n    b = _e312;\n    let _e314 = a;\n    let _e315 = b;\n    let _e316 = f;\n    return mix(_e314, _e315, _e316);\n}\n\nfn conCurve(x: f32, k: f32) -> f32 {\n    var x_1: f32;\n    var k_1: f32;\n    var p: f32;\n    var local_2: f32;\n    var t_1: f32;\n    var local_3: f32;\n\n    x_1 = x;\n    k_1 = k;\n    let _e257 = global.uConPivot;\n    p = _e257;\n    let _e259 = x_1;\n    let _e260 = p;\n    if (_e259 < _e260) {\n        let _e263 = x_1;\n        let _e265 = p;\n        local_2 = ((0.5f * _e263) / _e265);\n    } else {\n        let _e269 = x_1;\n        let _e270 = p;\n        let _e274 = p;\n        local_2 = (0.5f + ((0.5f * (_e269 - _e270)) / (1f - _e274)));\n    }\n    let _e279 = local_2;\n    t_1 = clamp(_e279, 0f, 1f);\n    let _e284 = t_1;\n    let _e285 = k_1;\n    let _e286 = t_1;\n    let _e287 = t_1;\n    let _e291 = t_1;\n    let _e295 = t_1;\n    t_1 = (_e284 + (_e285 * (((_e286 * _e287) * (3f - (2f * _e291))) - _e295)));\n    let _e299 = t_1;\n    if (_e299 < 0.5f) {\n        let _e303 = p;\n        let _e305 = t_1;\n        local_3 = ((2f * _e303) * _e305);\n    } else {\n        let _e307 = p;\n        let _e308 = t_1;\n        let _e314 = p;\n        local_3 = (_e307 + (((_e308 - 0.5f) * 2f) * (1f - _e314)));\n    }\n    let _e319 = local_3;\n    return _e319;\n}\n\nfn cam_2(p_1: vec2<f32>) -> vec3<f32> {\n    var p_2: vec2<f32>;\n\n    p_2 = p_1;\n    let _e282 = global.uHiRect;\n    let _e286 = p_2;\n    let _e288 = global.uHiSafe;\n    let _e292 = p_2;\n    let _e294 = global.uHiSafe;\n    let _e298 = p_2;\n    let _e300 = global.uHiSafe;\n    let _e302 = global.uHiSafe;\n    let _e307 = p_2;\n    let _e309 = global.uHiSafe;\n    let _e311 = global.uHiSafe;\n    if (((((_e282.z > 0f) && (_e286.x >= _e288.x)) && (_e292.y >= _e294.y)) && (_e298.x <= (_e300.x + _e302.z))) && (_e307.y <= (_e309.y + _e311.w))) {\n        let _e316 = p_2;\n        let _e317 = global.uHiRect;\n        let _e320 = global.uHiRect;\n        let _e323 = textureSample(uHi, uHi_s, ((_e316 - _e317.xy) / _e320.zw));\n        return _e323.xyz;\n    }\n    let _e325 = p_2;\n    let _e326 = textureSample(uSrc, uSrc_s, _e325);\n    return _e326.xyz;\n}\n\nfn logLum(p_3: vec2<f32>) -> f32 {\n    var p_4: vec2<f32>;\n\n    p_4 = p_3;\n    let _e282 = p_4;\n    let _e283 = cam_2(_e282);\n    let _e284 = toLinear(_e283);\n    return log2(max(dot(_e284, W709_), 0.00001f));\n}\n\nfn ring(p_5: vec2<f32>, r: f32) -> f32 {\n    var p_6: vec2<f32>;\n    var r_1: f32;\n    var d: vec2<f32>;\n    var s: f32 = 0f;\n    var e: vec2<f32>;\n\n    p_6 = p_5;\n    r_1 = r;\n    let _e284 = global.uPhotoPx;\n    let _e285 = r_1;\n    d = (_e284 * _e285);\n    let _e290 = s;\n    let _e291 = p_6;\n    let _e292 = d;\n    let _e297 = logLum((_e291 + vec2<f32>(_e292.x, 0f)));\n    let _e298 = p_6;\n    let _e299 = d;\n    let _e304 = logLum((_e298 - vec2<f32>(_e299.x, 0f)));\n    s = (_e290 + (_e297 + _e304));\n    let _e307 = s;\n    let _e308 = p_6;\n    let _e310 = d;\n    let _e314 = logLum((_e308 + vec2<f32>(0f, _e310.y)));\n    let _e315 = p_6;\n    let _e317 = d;\n    let _e321 = logLum((_e315 - vec2<f32>(0f, _e317.y)));\n    s = (_e307 + (_e314 + _e321));\n    let _e324 = d;\n    e = (_e324 * 0.7071f);\n    let _e328 = s;\n    let _e329 = p_6;\n    let _e330 = e;\n    let _e332 = logLum((_e329 + _e330));\n    let _e333 = p_6;\n    let _e334 = e;\n    let _e336 = logLum((_e333 - _e334));\n    let _e338 = p_6;\n    let _e339 = e;\n    let _e341 = e;\n    let _e346 = logLum((_e338 + vec2<f32>(_e339.x, -(_e341.y))));\n    let _e348 = p_6;\n    let _e349 = e;\n    let _e352 = e;\n    let _e356 = logLum((_e348 + vec2<f32>(-(_e349.x), _e352.y)));\n    s = (_e328 + (((_e332 + _e336) + _e346) + _e356));\n    let _e359 = s;\n    return (_e359 / 8f);\n}\n\nfn shoulder(x_2: vec3<f32>) -> vec3<f32> {\n    var x_3: vec3<f32>;\n    var k_2: f32 = 0.72f;\n    var over: vec3<f32>;\n\n    x_3 = x_2;\n    let _e284 = k_2;\n    let _e286 = k_2;\n    let _e289 = x_3;\n    let _e290 = k_2;\n    let _e295 = k_2;\n    over = (vec3(_e284) + ((1f - _e286) * (vec3(1f) - exp((-((_e289 - vec3(_e290))) / vec3((1f - _e295)))))));\n    let _e306 = x_3;\n    let _e307 = over;\n    let _e308 = k_2;\n    let _e309 = x_3;\n    return mix(_e306, _e307, step(vec3(_e308), _e309));\n}\n\nfn shoulder1_(x_4: f32) -> f32 {\n    var x_5: f32;\n\n    x_5 = x_4;\n    let _e282 = x_5;\n    let _e284 = shoulder(vec3(_e282));\n    return _e284.x;\n}\n\nfn chroma(c_1: vec3<f32>) -> vec3<f32> {\n    var c_2: vec3<f32>;\n    var y_2: f32;\n\n    c_2 = c_1;\n    let _e284 = c_2;\n    y_2 = dot(_e284, W709_);\n    let _e287 = c_2;\n    let _e288 = y_2;\n    let _e291 = y_2;\n    return ((_e287 - vec3(_e288)) / vec3(max(_e291, CHROMA_FLOOR)));\n}\n\nfn encode(x_6: vec3<f32>) -> vec3<f32> {\n    var x_7: vec3<f32>;\n\n    x_7 = x_6;\n    let _e284 = x_7;\n    let _e288 = x_7;\n    let _e302 = x_7;\n    return mix((_e284 * 12.92f), ((1.055f * pow(max(_e288, vec3(0f)), vec3(0.41666666f))) - vec3(0.055f)), step(vec3(0.0031308f), _e302));\n}\n\nfn sigmoid1_(x_8: f32, pf: f32, pp: f32, k_3: f32) -> f32 {\n    var x_9: f32;\n    var pf_1: f32;\n    var pp_1: f32;\n    var k_4: f32;\n    var g: f32 = 0.18f;\n    var u: f32;\n    var w: f32;\n\n    x_9 = x_8;\n    pf_1 = pf;\n    pp_1 = pp;\n    k_4 = k_3;\n    let _e290 = x_9;\n    if (_e290 <= 0f) {\n        return 0f;\n    }\n    let _e296 = x_9;\n    let _e297 = g;\n    if (_e296 <= _e297) {\n        {\n            let _e299 = x_9;\n            let _e300 = g;\n            let _e302 = pf_1;\n            u = pow((_e299 / _e300), _e302);\n            let _e305 = u;\n            let _e306 = u;\n            let _e307 = k_4;\n            let _e310 = pp_1;\n            return pow((_e305 / (_e306 + _e307)), _e310);\n        }\n    }\n    let _e312 = g;\n    let _e313 = x_9;\n    let _e315 = pf_1;\n    w = pow((_e312 / _e313), _e315);\n    let _e320 = k_4;\n    let _e321 = w;\n    let _e325 = pp_1;\n    return pow((1f / (1f + (_e320 * _e321))), _e325);\n}\n\nfn sigmoidMap(x_10: vec3<f32>) -> vec3<f32> {\n    var x_11: vec3<f32>;\n    var pf_2: f32;\n    var pp_2: f32;\n    var k_5: f32;\n    var ph: f32;\n    var c0_: vec3<f32>;\n    var c_3: vec3<f32>;\n    var mx0_: f32;\n    var mn0_: f32;\n    var mx1_: f32;\n    var mn1_: f32;\n    var h: vec3<f32>;\n\n    x_11 = x_10;\n    let _e284 = global.uTmA;\n    pf_2 = _e284.x;\n    let _e287 = global.uTmA;\n    pp_2 = _e287.y;\n    let _e290 = global.uTmA;\n    k_5 = _e290.z;\n    let _e293 = global.uTmA;\n    ph = _e293.w;\n    let _e296 = x_11;\n    c0_ = max(_e296, vec3(0f));\n    let _e301 = c0_;\n    let _e303 = pf_2;\n    let _e304 = pp_2;\n    let _e305 = k_5;\n    let _e306 = sigmoid1_(_e301.x, _e303, _e304, _e305);\n    let _e307 = c0_;\n    let _e309 = pf_2;\n    let _e310 = pp_2;\n    let _e311 = k_5;\n    let _e312 = sigmoid1_(_e307.y, _e309, _e310, _e311);\n    let _e313 = c0_;\n    let _e315 = pf_2;\n    let _e316 = pp_2;\n    let _e317 = k_5;\n    let _e318 = sigmoid1_(_e313.z, _e315, _e316, _e317);\n    c_3 = vec3<f32>(_e306, _e312, _e318);\n    let _e321 = ph;\n    if (_e321 > 0f) {\n        {\n            let _e324 = c0_;\n            let _e326 = c0_;\n            let _e328 = c0_;\n            mx0_ = max(_e324.x, max(_e326.y, _e328.z));\n            let _e333 = c0_;\n            let _e335 = c0_;\n            let _e337 = c0_;\n            mn0_ = min(_e333.x, min(_e335.y, _e337.z));\n            let _e342 = c_3;\n            let _e344 = c_3;\n            let _e346 = c_3;\n            mx1_ = max(_e342.x, max(_e344.y, _e346.z));\n            let _e351 = c_3;\n            let _e353 = c_3;\n            let _e355 = c_3;\n            mn1_ = min(_e351.x, min(_e353.y, _e355.z));\n            let _e360 = mx0_;\n            let _e361 = mn0_;\n            let _e365 = mx1_;\n            let _e366 = mn1_;\n            if (((_e360 - _e361) > 0.000001f) && ((_e365 - _e366) > 0.000001f)) {\n                {\n                    let _e371 = mn1_;\n                    let _e372 = c0_;\n                    let _e373 = mn0_;\n                    let _e376 = mx0_;\n                    let _e377 = mn0_;\n                    let _e386 = mx1_;\n                    let _e387 = mn1_;\n                    h = (vec3(_e371) + (clamp(((_e372 - vec3(_e373)) / vec3((_e376 - _e377))), vec3(0f), vec3(1f)) * (_e386 - _e387)));\n                    let _e393 = c_3;\n                    let _e394 = h;\n                    let _e395 = ph;\n                    c_3 = mix(_e393, _e394, vec3(_e395));\n                }\n            }\n        }\n    }\n    let _e398 = c_3;\n    return clamp(_e398, vec3(0f), vec3(1f));\n}\n\nfn agxMap(x_12: vec3<f32>) -> vec3<f32> {\n    var x_13: vec3<f32>;\n    var inset: mat3x3<f32> = mat3x3<f32>(vec3<f32>(0.84247905f, 0.042328242f, 0.042375654f), vec3<f32>(0.0784336f, 0.87846863f, 0.0784336f), vec3<f32>(0.079223745f, 0.07916613f, 0.879143f));\n    var outset: mat3x3<f32> = mat3x3<f32>(vec3<f32>(1.196879f, -0.052896854f, -0.052971635f), vec3<f32>(-0.09802088f, 1.1519032f, -0.09804345f), vec3<f32>(-0.09902974f, -0.098961174f, 1.1510737f));\n    var lo: f32 = -12.47393f;\n    var hi: f32 = 4.026069f;\n    var mid: f32 = 0.6060606f;\n    var v: vec3<f32>;\n    var v2_: vec3<f32>;\n    var v4_: vec3<f32>;\n    var lin: vec3<f32>;\n    var y_3: f32;\n    var roll: f32;\n    var sat: f32;\n\n    x_13 = x_12;\n    let _e325 = inset;\n    let _e326 = x_13;\n    let _e335 = lo;\n    let _e338 = hi;\n    let _e339 = lo;\n    v = clamp(((log2(max((_e325 * max(_e326, vec3(0f))), vec3(0.0000000001f))) - vec3(_e335)) / vec3((_e338 - _e339))), vec3(0f), vec3(1f));\n    let _e349 = mid;\n    let _e350 = v;\n    let _e351 = mid;\n    let _e354 = global.uTmA;\n    v = clamp((vec3(_e349) + ((_e350 - vec3(_e351)) * _e354.x)), vec3(0f), vec3(1f));\n    let _e364 = v;\n    let _e365 = v;\n    v2_ = (_e364 * _e365);\n    let _e368 = v2_;\n    let _e369 = v2_;\n    v4_ = (_e368 * _e369);\n    let _e373 = v4_;\n    let _e375 = v2_;\n    let _e378 = v4_;\n    let _e380 = v;\n    let _e384 = v4_;\n    let _e388 = v2_;\n    let _e390 = v;\n    let _e394 = v2_;\n    let _e398 = v;\n    v = ((((((((15.5f * _e373) * _e375) - ((40.14f * _e378) * _e380)) + (31.96f * _e384)) - ((6.868f * _e388) * _e390)) + (0.4298f * _e394)) + (0.1191f * _e398)) - vec3(0.00232f));\n    let _e404 = outset;\n    let _e405 = v;\n    lin = max((_e404 * pow(max(_e405, vec3(0f)), vec3(2.2f))), vec3(0f));\n    let _e417 = lin;\n    y_3 = dot(_e417, W709_);\n    let _e422 = y_3;\n    let _e424 = global.uTmA;\n    roll = (smoothstep(0.5f, 1f, _e422) * _e424.z);\n    let _e428 = global.uTmA;\n    let _e431 = roll;\n    sat = (_e428.y * (1f - _e431));\n    let _e435 = y_3;\n    let _e436 = lin;\n    let _e437 = y_3;\n    let _e440 = sat;\n    return clamp((vec3(_e435) + ((_e436 - vec3(_e437)) * _e440)), vec3(0f), vec3(1f));\n}\n\nfn filmic1_(x_14: f32) -> f32 {\n    var x_15: f32;\n    var ev: f32;\n    var t_2: f32;\n    var s_1: f32;\n    var t1_: f32;\n    var y1_: f32;\n    var t2_: f32;\n    var y2_: f32;\n    var u_1: f32;\n    var m1_: f32;\n    var v_1: f32;\n    var d2_: f32;\n    var m2_: f32;\n\n    x_15 = x_14;\n    let _e284 = x_15;\n    if (_e284 <= 0f) {\n        return 0f;\n    }\n    let _e288 = x_15;\n    ev = log2((max(_e288, 0.0000000001f) / 0.18f));\n    let _e295 = ev;\n    let _e296 = global.uTmA;\n    let _e299 = global.uTmA;\n    t_2 = clamp(((_e295 - _e296.x) * _e299.y), 0f, 1f);\n    let _e306 = global.uTmA;\n    s_1 = _e306.w;\n    let _e309 = global.uTmB;\n    t1_ = _e309.x;\n    let _e312 = global.uTmB;\n    y1_ = _e312.y;\n    let _e315 = global.uTmB;\n    t2_ = _e315.z;\n    let _e318 = global.uTmB;\n    y2_ = _e318.w;\n    let _e321 = t_2;\n    let _e322 = t1_;\n    if (_e321 < _e322) {\n        {\n            let _e324 = t_2;\n            let _e325 = t1_;\n            u_1 = (_e324 / max(_e325, 0.000001f));\n            let _e330 = s_1;\n            let _e331 = t1_;\n            m1_ = (_e330 * _e331);\n            let _e334 = u_1;\n            let _e335 = u_1;\n            let _e338 = y1_;\n            let _e340 = m1_;\n            let _e342 = m1_;\n            let _e344 = y1_;\n            let _e347 = u_1;\n            return ((_e334 * _e335) * (((3f * _e338) - _e340) + ((_e342 - (2f * _e344)) * _e347)));\n        }\n    }\n    let _e351 = t_2;\n    let _e352 = t2_;\n    if (_e351 <= _e352) {\n        let _e354 = y1_;\n        let _e355 = s_1;\n        let _e356 = t_2;\n        let _e357 = t1_;\n        return (_e354 + (_e355 * (_e356 - _e357)));\n    }\n    let _e362 = t_2;\n    let _e365 = t2_;\n    v_1 = ((1f - _e362) / max((1f - _e365), 0.000001f));\n    let _e372 = y2_;\n    d2_ = (1f - _e372);\n    let _e375 = s_1;\n    let _e377 = t2_;\n    m2_ = (_e375 * (1f - _e377));\n    let _e382 = v_1;\n    let _e383 = v_1;\n    let _e386 = d2_;\n    let _e388 = m2_;\n    let _e390 = m2_;\n    let _e392 = d2_;\n    let _e395 = v_1;\n    return (1f - ((_e382 * _e383) * (((3f * _e386) - _e388) + ((_e390 - (2f * _e392)) * _e395))));\n}\n\nfn filmicMap(x_16: vec3<f32>) -> vec3<f32> {\n    var x_17: vec3<f32>;\n    var c_4: vec3<f32>;\n    var yIn: f32;\n    var yOut: f32;\n    var ev_1: f32;\n    var t_3: f32;\n    var sh: f32;\n    var lat: f32;\n    var d_1: vec3<f32>;\n    var h_1: vec3<f32>;\n    var mx: f32;\n    var mn: f32;\n    var normRgb: vec3<f32>;\n    var perCh: vec3<f32>;\n\n    x_17 = x_16;\n    let _e284 = x_17;\n    c_4 = max(_e284, vec3(0f));\n    let _e289 = c_4;\n    yIn = dot(_e289, W709_);\n    let _e292 = yIn;\n    if (_e292 <= 0.0000000001f) {\n        return vec3(0f);\n    }\n    let _e297 = yIn;\n    let _e298 = filmic1_(_e297);\n    yOut = _e298;\n    let _e300 = yIn;\n    ev_1 = log2((_e300 / 0.18f));\n    let _e305 = ev_1;\n    let _e306 = global.uTmA;\n    let _e309 = global.uTmA;\n    t_3 = clamp(((_e305 - _e306.x) * _e309.y), 0f, 1f);\n    let _e316 = global.uTmB;\n    let _e319 = t_3;\n    sh = smoothstep(_e316.z, 1f, _e319);\n    let _e323 = sh;\n    let _e324 = sh;\n    lat = (1f - ((_e323 * _e324) * 0.65f));\n    let _e330 = c_4;\n    let _e331 = yIn;\n    let _e334 = yOut;\n    let _e335 = yIn;\n    let _e338 = lat;\n    d_1 = (((_e330 - vec3(_e331)) * (_e334 / _e335)) * _e338);\n    let _e341 = yOut;\n    let _e342 = d_1;\n    h_1 = (vec3(_e341) + _e342);\n    let _e346 = h_1;\n    let _e348 = h_1;\n    let _e350 = h_1;\n    mx = max(_e346.x, max(_e348.y, _e350.z));\n    let _e355 = mx;\n    if (_e355 > 1f) {\n        let _e358 = d_1;\n        let _e360 = yOut;\n        let _e362 = mx;\n        let _e363 = yOut;\n        d_1 = (_e358 * ((1f - _e360) / max((_e362 - _e363), 0.000001f)));\n    }\n    let _e369 = yOut;\n    let _e370 = d_1;\n    let _e373 = yOut;\n    let _e374 = d_1;\n    let _e377 = yOut;\n    let _e378 = d_1;\n    mn = min((_e369 + _e370.x), min((_e373 + _e374.y), (_e377 + _e378.z)));\n    let _e384 = mn;\n    if (_e384 < 0f) {\n        let _e387 = d_1;\n        let _e388 = yOut;\n        let _e389 = yOut;\n        let _e390 = mn;\n        d_1 = (_e387 * (_e388 / max((_e389 - _e390), 0.000001f)));\n    }\n    let _e396 = yOut;\n    let _e397 = d_1;\n    normRgb = clamp((vec3(_e396) + _e397), vec3(0f), vec3(1f));\n    let _e406 = global.uTmHue;\n    if (_e406 >= 0.999f) {\n        let _e409 = normRgb;\n        return _e409;\n    }\n    let _e410 = c_4;\n    let _e412 = filmic1_(_e410.x);\n    let _e413 = c_4;\n    let _e415 = filmic1_(_e413.y);\n    let _e416 = c_4;\n    let _e418 = filmic1_(_e416.z);\n    perCh = vec3<f32>(_e412, _e415, _e418);\n    let _e421 = perCh;\n    let _e422 = normRgb;\n    let _e423 = global.uTmHue;\n    return clamp(mix(_e421, _e422, vec3(_e423)), vec3(0f), vec3(1f));\n}\n\nfn decodeS(v_2: vec3<f32>) -> vec3<f32> {\n    var v_3: vec3<f32>;\n\n    v_3 = v_2;\n    let _e284 = v_3;\n    let _e288 = v_3;\n    let _e302 = v_3;\n    return mix((_e284 / vec3(12.92f)), pow(((max(_e288, vec3(0f)) + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), step(vec3(0.04045f), _e302));\n}\n\nfn gamutIn(d_2: vec3<f32>) -> vec3<f32> {\n    var d_3: vec3<f32>;\n    var lin_1: vec3<f32>;\n    var ach: f32;\n    var thr: f32 = 0.95f;\n    var lim: f32 = 1.3f;\n    var pw: f32 = 1.2f;\n    var sc: f32;\n    var dist: vec3<f32>;\n    var over_1: vec3<f32>;\n    var cd: vec3<f32>;\n\n    d_3 = d_2;\n    let _e286 = d_3;\n    let _e287 = decodeS(_e286);\n    lin_1 = _e287;\n    let _e289 = lin_1;\n    let _e291 = lin_1;\n    let _e293 = lin_1;\n    ach = max(_e289.x, max(_e291.y, _e293.z));\n    let _e298 = ach;\n    if (_e298 > 0f) {\n        {\n            let _e307 = lim;\n            let _e308 = thr;\n            let _e311 = thr;\n            let _e313 = lim;\n            let _e314 = thr;\n            let _e317 = pw;\n            let _e323 = pw;\n            sc = ((_e307 - _e308) / pow((pow(((1f - _e311) / (_e313 - _e314)), -(_e317)) - 1f), (1f / _e323)));\n            let _e328 = ach;\n            let _e329 = lin_1;\n            let _e332 = ach;\n            dist = ((vec3(_e328) - _e329) / vec3(_e332));\n            let _e336 = dist;\n            let _e337 = thr;\n            let _e343 = sc;\n            over_1 = (max((_e336 - vec3(_e337)), vec3(0f)) / vec3(_e343));\n            let _e347 = dist;\n            let _e348 = thr;\n            let _e349 = sc;\n            let _e350 = over_1;\n            let _e353 = over_1;\n            let _e354 = pw;\n            let _e360 = pw;\n            let _e367 = thr;\n            let _e368 = dist;\n            cd = mix(_e347, (vec3(_e348) + ((_e349 * _e350) / pow((vec3(1f) + pow(_e353, vec3(_e354))), vec3((1f / _e360))))), step(vec3(_e367), _e368));\n            let _e373 = ach;\n            let _e374 = cd;\n            let _e375 = ach;\n            lin_1 = (vec3(_e373) - (_e374 * _e375));\n        }\n    }\n    let _e379 = lin_1;\n    let _e385 = encode(clamp(_e379, vec3(0f), vec3(1f)));\n    return clamp(_e385, vec3(0f), vec3(1f));\n}\n\nfn srgbToLin(c_5: vec3<f32>) -> vec3<f32> {\n    var c_6: vec3<f32>;\n    var a_1: vec3<f32>;\n\n    c_6 = c_5;\n    let _e297 = c_6;\n    a_1 = abs(_e297);\n    let _e300 = c_6;\n    let _e302 = a_1;\n    let _e312 = a_1;\n    let _e316 = a_1;\n    return (sign(_e300) * mix(pow(((_e302 + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), (_e312 / vec3(12.92f)), step(_e316, vec3(0.04045f))));\n}\n\nfn linToSrgb(c_7: vec3<f32>) -> vec3<f32> {\n    var c_8: vec3<f32>;\n    var a_2: vec3<f32>;\n\n    c_8 = c_7;\n    let _e297 = c_8;\n    a_2 = abs(_e297);\n    let _e300 = c_8;\n    let _e303 = a_2;\n    let _e313 = a_2;\n    let _e316 = a_2;\n    return (sign(_e300) * mix(((1.055f * pow(_e303, vec3(0.41666666f))) - vec3(0.055f)), (_e313 * 12.92f), step(_e316, vec3(0.0031308f))));\n}\n\nfn toOklab(c_9: vec3<f32>) -> vec3<f32> {\n    var c_10: vec3<f32>;\n    var l: vec3<f32>;\n\n    c_10 = c_9;\n    let _e297 = c_10;\n    let _e298 = srgbToLin(_e297);\n    l = (_e298 * mat3x3<f32>(vec3<f32>(0.41222146f, 0.53633255f, 0.051445995f), vec3<f32>(0.2119035f, 0.6806995f, 0.10739696f), vec3<f32>(0.08830246f, 0.28171885f, 0.6299787f)));\n    let _e314 = l;\n    let _e316 = l;\n    l = (sign(_e314) * pow(abs(_e316), vec3(0.33333334f)));\n    let _e324 = l;\n    return (_e324 * mat3x3<f32>(vec3<f32>(0.21045426f, 0.7936178f, -0.004072047f), vec3<f32>(1.9779985f, -2.4285922f, 0.4505937f), vec3<f32>(0.025904037f, 0.78277177f, -0.80867577f)));\n}\n\nfn fromOklab(o: vec3<f32>) -> vec3<f32> {\n    var o_1: vec3<f32>;\n    var l_1: vec3<f32>;\n\n    o_1 = o;\n    let _e297 = o_1;\n    l_1 = (_e297 * mat3x3<f32>(vec3<f32>(1f, 0.39633778f, 0.21580376f), vec3<f32>(1f, -0.105561346f, -0.06385417f), vec3<f32>(1f, -0.08948418f, -1.2914855f)));\n    let _e317 = l_1;\n    let _e318 = l_1;\n    let _e320 = l_1;\n    l_1 = ((_e317 * _e318) * _e320);\n    let _e322 = l_1;\n    let _e342 = linToSrgb((_e322 * mat3x3<f32>(vec3<f32>(4.0767417f, -3.3077116f, 0.23096994f), vec3<f32>(-1.268438f, 2.6097574f, -0.34131938f), vec3<f32>(-0.0041960864f, -0.7034186f, 1.7076147f))));\n    return _e342;\n}\n\nfn hsv(c_11: vec3<f32>) -> vec3<f32> {\n    var c_12: vec3<f32>;\n    var mx_1: f32;\n    var mn_1: f32;\n    var d_4: f32;\n    var h_2: f32 = 0f;\n    var local_4: f32;\n\n    c_12 = c_11;\n    let _e297 = c_12;\n    let _e299 = c_12;\n    let _e301 = c_12;\n    mx_1 = max(_e297.x, max(_e299.y, _e301.z));\n    let _e306 = c_12;\n    let _e308 = c_12;\n    let _e310 = c_12;\n    mn_1 = min(_e306.x, min(_e308.y, _e310.z));\n    let _e315 = mx_1;\n    let _e316 = mn_1;\n    d_4 = (_e315 - _e316);\n    let _e321 = d_4;\n    if (_e321 > 0.00001f) {\n        {\n            let _e324 = mx_1;\n            let _e325 = c_12;\n            if (_e324 == _e325.x) {\n                let _e328 = c_12;\n                let _e330 = c_12;\n                let _e333 = d_4;\n                let _e334 = ((_e328.y - _e330.z) / _e333);\n                h_2 = (_e334 - (floor((_e334 / 6f)) * 6f));\n            } else {\n                let _e340 = mx_1;\n                let _e341 = c_12;\n                if (_e340 == _e341.y) {\n                    let _e344 = c_12;\n                    let _e346 = c_12;\n                    let _e349 = d_4;\n                    h_2 = (((_e344.z - _e346.x) / _e349) + 2f);\n                } else {\n                    let _e353 = c_12;\n                    let _e355 = c_12;\n                    let _e358 = d_4;\n                    h_2 = (((_e353.x - _e355.y) / _e358) + 4f);\n                }\n            }\n        }\n    }\n    let _e362 = h_2;\n    let _e365 = mx_1;\n    if (_e365 > 0f) {\n        let _e368 = d_4;\n        let _e369 = mx_1;\n        local_4 = (_e368 / _e369);\n    } else {\n        local_4 = 0f;\n    }\n    let _e373 = local_4;\n    let _e374 = mx_1;\n    return vec3<f32>((_e362 * 60f), _e373, _e374);\n}\n\nfn rotateHue(c_13: vec3<f32>, deg: f32) -> vec3<f32> {\n    var c_14: vec3<f32>;\n    var deg_1: f32;\n    var a_3: f32;\n    var s_2: f32;\n    var co: f32;\n    var k_6: vec3<f32> = vec3(0.57735f);\n    var m: f32;\n    var v_4: vec3<f32>;\n\n    c_14 = c_13;\n    deg_1 = deg;\n    let _e299 = deg_1;\n    a_3 = radians(_e299);\n    let _e302 = a_3;\n    s_2 = sin(_e302);\n    let _e305 = a_3;\n    co = cos(_e305);\n    let _e311 = c_14;\n    let _e313 = c_14;\n    let _e316 = c_14;\n    m = (((_e311.x + _e313.y) + _e316.z) / 3f);\n    let _e322 = c_14;\n    let _e323 = m;\n    v_4 = (_e322 - vec3(_e323));\n    let _e327 = m;\n    let _e328 = v_4;\n    let _e329 = co;\n    let _e333 = k_6;\n    let _e334 = v_4;\n    let _e336 = s_2;\n    return ((vec3(_e327) + (_e328 * _e329)) + (cross(_e333, _e334) * _e336));\n}\n\nfn rgbToHsv6_(c_15: vec3<f32>) -> vec3<f32> {\n    var c_16: vec3<f32>;\n    var v_5: f32;\n    var gap: f32;\n    var local_5: f32;\n    var local_6: f32;\n    var h_3: f32;\n\n    c_16 = c_15;\n    let _e297 = c_16;\n    let _e299 = c_16;\n    let _e301 = c_16;\n    v_5 = max(_e297.x, max(_e299.y, _e301.z));\n    let _e306 = v_5;\n    let _e307 = c_16;\n    let _e309 = c_16;\n    let _e311 = c_16;\n    gap = (_e306 - min(_e307.x, min(_e309.y, _e311.z)));\n    let _e317 = gap;\n    if (_e317 <= 0f) {\n        let _e322 = v_5;\n        return vec3<f32>(0f, 0f, _e322);\n    }\n    let _e324 = c_16;\n    let _e326 = v_5;\n    if (_e324.x == _e326) {\n        let _e328 = c_16;\n        let _e330 = c_16;\n        let _e333 = gap;\n        local_6 = ((_e328.y - _e330.z) / _e333);\n    } else {\n        let _e335 = c_16;\n        let _e337 = v_5;\n        if (_e335.y == _e337) {\n            let _e340 = c_16;\n            let _e342 = c_16;\n            let _e345 = gap;\n            local_5 = (2f + ((_e340.z - _e342.x) / _e345));\n        } else {\n            let _e349 = c_16;\n            let _e351 = c_16;\n            let _e354 = gap;\n            local_5 = (4f + ((_e349.x - _e351.y) / _e354));\n        }\n        let _e358 = local_5;\n        local_6 = _e358;\n    }\n    let _e360 = local_6;\n    h_3 = _e360;\n    let _e362 = h_3;\n    if (_e362 < 0f) {\n        let _e365 = h_3;\n        h_3 = (_e365 + 6f);\n    }\n    let _e368 = h_3;\n    let _e369 = gap;\n    let _e370 = v_5;\n    let _e372 = v_5;\n    return vec3<f32>(_e368, (_e369 / _e370), _e372);\n}\n\nfn hsv6ToRgb(c_17: vec3<f32>) -> vec3<f32> {\n    var c_18: vec3<f32>;\n    var h_4: f32;\n    var s_3: f32;\n    var v_6: f32;\n    var i_1: f32;\n    var f_1: f32;\n    var p_7: f32;\n    var q: f32;\n    var t_4: f32;\n\n    c_18 = c_17;\n    let _e297 = c_18;\n    h_4 = (_e297.x - (floor((_e297.x / 6f)) * 6f));\n    let _e305 = c_18;\n    s_3 = _e305.y;\n    let _e308 = c_18;\n    v_6 = _e308.z;\n    let _e311 = s_3;\n    if (_e311 <= 0f) {\n        let _e314 = v_6;\n        return vec3(_e314);\n    }\n    let _e316 = h_4;\n    i_1 = floor(_e316);\n    let _e319 = h_4;\n    let _e320 = i_1;\n    f_1 = (_e319 - _e320);\n    let _e323 = v_6;\n    let _e325 = s_3;\n    p_7 = (_e323 * (1f - _e325));\n    let _e329 = v_6;\n    let _e331 = s_3;\n    let _e332 = f_1;\n    q = (_e329 * (1f - (_e331 * _e332)));\n    let _e337 = v_6;\n    let _e339 = s_3;\n    let _e341 = f_1;\n    t_4 = (_e337 * (1f - (_e339 * (1f - _e341))));\n    let _e347 = i_1;\n    if (_e347 < 1f) {\n        let _e350 = v_6;\n        let _e351 = t_4;\n        let _e352 = p_7;\n        return vec3<f32>(_e350, _e351, _e352);\n    }\n    let _e354 = i_1;\n    if (_e354 < 2f) {\n        let _e357 = q;\n        let _e358 = v_6;\n        let _e359 = p_7;\n        return vec3<f32>(_e357, _e358, _e359);\n    }\n    let _e361 = i_1;\n    if (_e361 < 3f) {\n        let _e364 = p_7;\n        let _e365 = v_6;\n        let _e366 = t_4;\n        return vec3<f32>(_e364, _e365, _e366);\n    }\n    let _e368 = i_1;\n    if (_e368 < 4f) {\n        let _e371 = p_7;\n        let _e372 = q;\n        let _e373 = v_6;\n        return vec3<f32>(_e371, _e372, _e373);\n    }\n    let _e375 = i_1;\n    if (_e375 < 5f) {\n        let _e378 = t_4;\n        let _e379 = p_7;\n        let _e380 = v_6;\n        return vec3<f32>(_e378, _e379, _e380);\n    }\n    let _e382 = v_6;\n    let _e383 = p_7;\n    let _e384 = q;\n    return vec3<f32>(_e382, _e383, _e384);\n}\n\nfn encS1_(x_18: f32) -> f32 {\n    var x_19: f32;\n    var local_7: f32;\n\n    x_19 = x_18;\n    let _e297 = x_19;\n    if (_e297 <= 0.0031308f) {\n        let _e300 = x_19;\n        local_7 = (_e300 * 12.92f);\n    } else {\n        let _e304 = x_19;\n        local_7 = ((1.055f * pow(_e304, 0.41666666f)) - 0.055f);\n    }\n    let _e313 = local_7;\n    return _e313;\n}\n\nfn decS1_(x_20: f32) -> f32 {\n    var x_21: f32;\n    var local_8: f32;\n\n    x_21 = x_20;\n    let _e297 = x_21;\n    if (_e297 <= 0.04045f) {\n        let _e300 = x_21;\n        local_8 = (_e300 / 12.92f);\n    } else {\n        let _e303 = x_21;\n        local_8 = pow(((_e303 + 0.055f) / 1.055f), 2.4f);\n    }\n    let _e311 = local_8;\n    return _e311;\n}\n\nfn lookTex(i_2: i32) -> vec3<f32> {\n    var i_3: i32;\n\n    i_3 = i_2;\n    let _e297 = i_3;\n    let _e301 = i_3;\n    let _e307 = textureLoad(uHue, vec2<i32>((_e297 % 360i), (1i + (_e301 / 360i))), 0i);\n    return _e307.xyz;\n}\n\nfn lookAt(c_19: vec3<f32>) -> vec3<f32> {\n    var c_20: vec3<f32>;\n    var n1_: f32;\n    var p_8: vec3<f32>;\n    var b_1: vec3<f32>;\n    var f_2: vec3<f32>;\n    var n: i32;\n    var o_2: i32;\n    var sy: i32;\n    var sz: i32;\n    var c0_1: vec3<f32>;\n    var c1_: vec3<f32>;\n\n    c_20 = c_19;\n    let _e297 = global.uLook;\n    n1_ = (_e297.x - 1f);\n    let _e302 = c_20;\n    let _e308 = n1_;\n    p_8 = (clamp(_e302, vec3(0f), vec3(1f)) * _e308);\n    let _e311 = p_8;\n    let _e313 = n1_;\n    b_1 = min(floor(_e311), vec3((_e313 - 1f)));\n    let _e319 = p_8;\n    let _e320 = b_1;\n    f_2 = (_e319 - _e320);\n    let _e323 = global.uLook;\n    n = i32((_e323.x + 0.5f));\n    let _e329 = b_1;\n    let _e332 = b_1;\n    let _e335 = n;\n    let _e338 = b_1;\n    let _e341 = n;\n    let _e343 = n;\n    o_2 = ((i32(_e329.x) + (i32(_e332.y) * _e335)) + ((i32(_e338.z) * _e341) * _e343));\n    let _e347 = n;\n    sy = _e347;\n    let _e349 = n;\n    let _e350 = n;\n    sz = (_e349 * _e350);\n    let _e353 = o_2;\n    let _e354 = lookTex(_e353);\n    c0_1 = _e354;\n    let _e356 = o_2;\n    let _e359 = sy;\n    let _e361 = sz;\n    let _e363 = lookTex((((_e356 + 1i) + _e359) + _e361));\n    c1_ = _e363;\n    let _e365 = f_2;\n    let _e367 = f_2;\n    if (_e365.x > _e367.y) {\n        {\n            let _e370 = f_2;\n            let _e372 = f_2;\n            if (_e370.y > _e372.z) {\n                let _e376 = f_2;\n                let _e379 = c0_1;\n                let _e381 = f_2;\n                let _e383 = f_2;\n                let _e386 = o_2;\n                let _e389 = lookTex((_e386 + 1i));\n                let _e392 = f_2;\n                let _e394 = f_2;\n                let _e397 = o_2;\n                let _e400 = sy;\n                let _e402 = lookTex(((_e397 + 1i) + _e400));\n                let _e405 = f_2;\n                let _e407 = c1_;\n                return (((((1f - _e376.x) * _e379) + ((_e381.x - _e383.y) * _e389)) + ((_e392.y - _e394.z) * _e402)) + (_e405.z * _e407));\n            }\n            let _e410 = f_2;\n            let _e412 = f_2;\n            if (_e410.x > _e412.z) {\n                let _e416 = f_2;\n                let _e419 = c0_1;\n                let _e421 = f_2;\n                let _e423 = f_2;\n                let _e426 = o_2;\n                let _e429 = lookTex((_e426 + 1i));\n                let _e432 = f_2;\n                let _e434 = f_2;\n                let _e437 = o_2;\n                let _e440 = sz;\n                let _e442 = lookTex(((_e437 + 1i) + _e440));\n                let _e445 = f_2;\n                let _e447 = c1_;\n                return (((((1f - _e416.x) * _e419) + ((_e421.x - _e423.z) * _e429)) + ((_e432.z - _e434.y) * _e442)) + (_e445.y * _e447));\n            }\n            let _e451 = f_2;\n            let _e454 = c0_1;\n            let _e456 = f_2;\n            let _e458 = f_2;\n            let _e461 = o_2;\n            let _e462 = sz;\n            let _e464 = lookTex((_e461 + _e462));\n            let _e467 = f_2;\n            let _e469 = f_2;\n            let _e472 = o_2;\n            let _e475 = sz;\n            let _e477 = lookTex(((_e472 + 1i) + _e475));\n            let _e480 = f_2;\n            let _e482 = c1_;\n            return (((((1f - _e451.z) * _e454) + ((_e456.z - _e458.x) * _e464)) + ((_e467.x - _e469.y) * _e477)) + (_e480.y * _e482));\n        }\n    }\n    let _e485 = f_2;\n    let _e487 = f_2;\n    if (_e485.z > _e487.y) {\n        let _e491 = f_2;\n        let _e494 = c0_1;\n        let _e496 = f_2;\n        let _e498 = f_2;\n        let _e501 = o_2;\n        let _e502 = sz;\n        let _e504 = lookTex((_e501 + _e502));\n        let _e507 = f_2;\n        let _e509 = f_2;\n        let _e512 = o_2;\n        let _e513 = sy;\n        let _e515 = sz;\n        let _e517 = lookTex(((_e512 + _e513) + _e515));\n        let _e520 = f_2;\n        let _e522 = c1_;\n        return (((((1f - _e491.z) * _e494) + ((_e496.z - _e498.y) * _e504)) + ((_e507.y - _e509.x) * _e517)) + (_e520.x * _e522));\n    }\n    let _e525 = f_2;\n    let _e527 = f_2;\n    if (_e525.z > _e527.x) {\n        let _e531 = f_2;\n        let _e534 = c0_1;\n        let _e536 = f_2;\n        let _e538 = f_2;\n        let _e541 = o_2;\n        let _e542 = sy;\n        let _e544 = lookTex((_e541 + _e542));\n        let _e547 = f_2;\n        let _e549 = f_2;\n        let _e552 = o_2;\n        let _e553 = sy;\n        let _e555 = sz;\n        let _e557 = lookTex(((_e552 + _e553) + _e555));\n        let _e560 = f_2;\n        let _e562 = c1_;\n        return (((((1f - _e531.y) * _e534) + ((_e536.y - _e538.z) * _e544)) + ((_e547.z - _e549.x) * _e557)) + (_e560.x * _e562));\n    }\n    let _e566 = f_2;\n    let _e569 = c0_1;\n    let _e571 = f_2;\n    let _e573 = f_2;\n    let _e576 = o_2;\n    let _e577 = sy;\n    let _e579 = lookTex((_e576 + _e577));\n    let _e582 = f_2;\n    let _e584 = f_2;\n    let _e587 = o_2;\n    let _e590 = sy;\n    let _e592 = lookTex(((_e587 + 1i) + _e590));\n    let _e595 = f_2;\n    let _e597 = c1_;\n    return (((((1f - _e566.y) * _e569) + ((_e571.y - _e573.x) * _e579)) + ((_e582.x - _e584.z) * _e592)) + (_e595.z * _e597));\n}\n\nfn hsmAt(t_5: texture_2d<f32>, hues: i32, v_7: i32, h_5: i32, s_4: i32) -> vec3<f32> {\n    var hues_1: i32;\n    var v_8: i32;\n    var h_6: i32;\n    var s_5: i32;\n\n    hues_1 = hues;\n    v_8 = v_7;\n    h_6 = h_5;\n    s_5 = s_4;\n    let _e304 = s_5;\n    let _e305 = v_8;\n    let _e306 = hues_1;\n    let _e308 = h_6;\n    let _e312 = textureLoad(t_5, vec2<i32>(_e304, ((_e305 * _e306) + _e308)), 0i);\n    return _e312.xyz;\n}\n\nfn hueSatMap(t_6: texture_2d<f32>, dims: vec4<f32>, rgb: vec3<f32>) -> vec3<f32> {\n    var dims_1: vec4<f32>;\n    var rgb_1: vec3<f32>;\n    var hues_2: i32;\n    var sats: i32;\n    var vals: i32;\n    var c_21: vec3<f32>;\n    var enc: bool;\n    var local_9: f32;\n    var ve: f32;\n    var local_10: f32;\n    var hS: f32;\n    var sS: f32;\n    var h0_: i32;\n    var h1_: i32;\n    var s0_: i32;\n    var hf: f32;\n    var sf: f32;\n    var d_5: vec3<f32>;\n    var vS: f32;\n    var v0_: i32;\n    var vf: f32;\n    var a_4: vec3<f32>;\n    var b_2: vec3<f32>;\n    var local_11: f32;\n\n    dims_1 = dims;\n    rgb_1 = rgb;\n    let _e300 = dims_1;\n    hues_2 = i32(_e300.x);\n    let _e304 = dims_1;\n    sats = i32(_e304.y);\n    let _e308 = dims_1;\n    vals = i32(_e308.z);\n    let _e312 = rgb_1;\n    let _e313 = rgbToHsv6_(_e312);\n    c_21 = _e313;\n    let _e315 = dims_1;\n    let _e319 = c_21;\n    enc = ((_e315.w > 0.5f) && (_e319.z <= 1f));\n    let _e325 = enc;\n    if _e325 {\n        let _e326 = c_21;\n        let _e328 = encS1_(_e326.z);\n        local_9 = _e328;\n    } else {\n        let _e329 = c_21;\n        local_9 = _e329.z;\n    }\n    let _e332 = local_9;\n    ve = _e332;\n    let _e334 = hues_2;\n    if (_e334 < 2i) {\n        local_10 = 0f;\n    } else {\n        let _e338 = c_21;\n        let _e340 = hues_2;\n        local_10 = ((_e338.x * f32(_e340)) / 6f);\n    }\n    let _e346 = local_10;\n    hS = _e346;\n    let _e348 = c_21;\n    let _e350 = sats;\n    sS = (_e348.y * f32((_e350 - 1i)));\n    let _e356 = hS;\n    h0_ = i32(_e356);\n    let _e359 = h0_;\n    h1_ = (_e359 + 1i);\n    let _e363 = sS;\n    let _e365 = sats;\n    s0_ = min(i32(_e363), (_e365 - 2i));\n    let _e370 = h0_;\n    let _e371 = hues_2;\n    if (_e370 >= (_e371 - 1i)) {\n        {\n            let _e375 = hues_2;\n            h0_ = (_e375 - 1i);\n            h1_ = 0i;\n        }\n    }\n    let _e379 = hS;\n    let _e380 = h0_;\n    hf = (_e379 - f32(_e380));\n    let _e384 = sS;\n    let _e385 = s0_;\n    sf = (_e384 - f32(_e385));\n    let _e390 = vals;\n    if (_e390 < 2i) {\n        {\n            let _e393 = hues_2;\n            let _e395 = h0_;\n            let _e396 = s0_;\n            let _e397 = hsmAt(t_6, _e393, 0i, _e395, _e396);\n            let _e398 = hues_2;\n            let _e400 = h1_;\n            let _e401 = s0_;\n            let _e402 = hsmAt(t_6, _e398, 0i, _e400, _e401);\n            let _e403 = hf;\n            let _e406 = hues_2;\n            let _e408 = h0_;\n            let _e409 = s0_;\n            let _e412 = hsmAt(t_6, _e406, 0i, _e408, (_e409 + 1i));\n            let _e413 = hues_2;\n            let _e415 = h1_;\n            let _e416 = s0_;\n            let _e419 = hsmAt(t_6, _e413, 0i, _e415, (_e416 + 1i));\n            let _e420 = hf;\n            let _e423 = sf;\n            d_5 = mix(mix(_e397, _e402, vec3(_e403)), mix(_e412, _e419, vec3(_e420)), vec3(_e423));\n        }\n    } else {\n        {\n            let _e426 = ve;\n            let _e430 = vals;\n            vS = (clamp(_e426, 0f, 1f) * f32((_e430 - 1i)));\n            let _e436 = vS;\n            let _e438 = vals;\n            v0_ = min(i32(_e436), (_e438 - 2i));\n            let _e443 = vS;\n            let _e444 = v0_;\n            vf = (_e443 - f32(_e444));\n            let _e448 = hues_2;\n            let _e449 = v0_;\n            let _e450 = h0_;\n            let _e451 = s0_;\n            let _e452 = hsmAt(t_6, _e448, _e449, _e450, _e451);\n            let _e453 = hues_2;\n            let _e454 = v0_;\n            let _e455 = h1_;\n            let _e456 = s0_;\n            let _e457 = hsmAt(t_6, _e453, _e454, _e455, _e456);\n            let _e458 = hf;\n            let _e461 = hues_2;\n            let _e462 = v0_;\n            let _e463 = h0_;\n            let _e464 = s0_;\n            let _e467 = hsmAt(t_6, _e461, _e462, _e463, (_e464 + 1i));\n            let _e468 = hues_2;\n            let _e469 = v0_;\n            let _e470 = h1_;\n            let _e471 = s0_;\n            let _e474 = hsmAt(t_6, _e468, _e469, _e470, (_e471 + 1i));\n            let _e475 = hf;\n            let _e478 = sf;\n            a_4 = mix(mix(_e452, _e457, vec3(_e458)), mix(_e467, _e474, vec3(_e475)), vec3(_e478));\n            let _e482 = hues_2;\n            let _e483 = v0_;\n            let _e486 = h0_;\n            let _e487 = s0_;\n            let _e488 = hsmAt(t_6, _e482, (_e483 + 1i), _e486, _e487);\n            let _e489 = hues_2;\n            let _e490 = v0_;\n            let _e493 = h1_;\n            let _e494 = s0_;\n            let _e495 = hsmAt(t_6, _e489, (_e490 + 1i), _e493, _e494);\n            let _e496 = hf;\n            let _e499 = hues_2;\n            let _e500 = v0_;\n            let _e503 = h0_;\n            let _e504 = s0_;\n            let _e507 = hsmAt(t_6, _e499, (_e500 + 1i), _e503, (_e504 + 1i));\n            let _e508 = hues_2;\n            let _e509 = v0_;\n            let _e512 = h1_;\n            let _e513 = s0_;\n            let _e516 = hsmAt(t_6, _e508, (_e509 + 1i), _e512, (_e513 + 1i));\n            let _e517 = hf;\n            let _e520 = sf;\n            b_2 = mix(mix(_e488, _e495, vec3(_e496)), mix(_e507, _e516, vec3(_e517)), vec3(_e520));\n            let _e524 = a_4;\n            let _e525 = b_2;\n            let _e526 = vf;\n            d_5 = mix(_e524, _e525, vec3(_e526));\n        }\n    }\n    let _e530 = c_21;\n    let _e532 = d_5;\n    c_21.x = (_e530.x + (_e532.x * 0.016666668f));\n    let _e540 = c_21;\n    let _e542 = d_5;\n    c_21.y = min((_e540.y * _e542.y), 1f);\n    let _e547 = ve;\n    let _e548 = d_5;\n    ve = (_e547 * _e548.z);\n    let _e551 = c_21;\n    if (_e551.z <= 1f) {\n        let _e555 = ve;\n        ve = clamp(_e555, 0f, 1f);\n    }\n    let _e560 = enc;\n    if _e560 {\n        let _e561 = ve;\n        let _e562 = decS1_(_e561);\n        local_11 = _e562;\n    } else {\n        let _e563 = ve;\n        local_11 = _e563;\n    }\n    let _e565 = local_11;\n    c_21.z = _e565;\n    let _e566 = c_21;\n    let _e567 = hsv6ToRgb(_e566);\n    return _e567;\n}\n\nfn toneAt(x_22: f32) -> f32 {\n    var x_23: f32;\n    var n_1: i32;\n    var p_9: f32;\n    var i_4: i32;\n\n    x_23 = x_22;\n    let _e298 = textureDimensions(uTone, 0i);\n    n_1 = vec2<i32>(_e298).x;\n    let _e302 = x_23;\n    let _e306 = n_1;\n    p_9 = (clamp(_e302, 0f, 1f) * f32((_e306 - 1i)));\n    let _e312 = p_9;\n    let _e314 = n_1;\n    i_4 = min(i32(_e312), (_e314 - 2i));\n    let _e319 = i_4;\n    let _e323 = textureLoad(uTone, vec2<i32>(_e319, 0i), 0i);\n    let _e325 = i_4;\n    let _e331 = textureLoad(uTone, vec2<i32>((_e325 + 1i), 0i), 0i);\n    let _e333 = p_9;\n    let _e334 = i_4;\n    return mix(_e323.x, _e331.x, (_e333 - f32(_e334)));\n}\n\nfn rgbTone(c_22: vec3<f32>) -> vec3<f32> {\n    var c_23: vec3<f32>;\n    var mx_2: f32;\n    var mn_2: f32;\n    var tmx: f32;\n    var tmn: f32;\n\n    c_23 = c_22;\n    let _e297 = c_23;\n    c_23 = clamp(_e297, vec3(0f), vec3(1f));\n    let _e303 = c_23;\n    let _e305 = c_23;\n    let _e307 = c_23;\n    mx_2 = max(_e303.x, max(_e305.y, _e307.z));\n    let _e312 = c_23;\n    let _e314 = c_23;\n    let _e316 = c_23;\n    mn_2 = min(_e312.x, min(_e314.y, _e316.z));\n    let _e321 = mx_2;\n    let _e322 = toneAt(_e321);\n    tmx = _e322;\n    let _e324 = mn_2;\n    let _e325 = toneAt(_e324);\n    tmn = _e325;\n    let _e327 = mx_2;\n    let _e328 = mn_2;\n    if ((_e327 - _e328) <= 0f) {\n        let _e332 = tmx;\n        return vec3(_e332);\n    }\n    let _e334 = tmn;\n    let _e335 = tmx;\n    let _e336 = tmn;\n    let _e338 = c_23;\n    let _e339 = mn_2;\n    let _e343 = mx_2;\n    let _e344 = mn_2;\n    return (vec3(_e334) + (((_e335 - _e336) * (_e338 - vec3(_e339))) / vec3((_e343 - _e344))));\n}\n\nfn easeWhite(x_24: vec3<f32>) -> vec3<f32> {\n    var x_25: vec3<f32>;\n    var k_7: f32 = 0.95f;\n\n    x_25 = x_24;\n    let _e299 = x_25;\n    let _e300 = k_7;\n    let _e302 = k_7;\n    let _e305 = x_25;\n    let _e306 = k_7;\n    let _e311 = k_7;\n    let _e321 = k_7;\n    let _e322 = x_25;\n    return mix(_e299, (vec3(_e300) + ((1f - _e302) * (vec3(1f) - exp((-((_e305 - vec3(_e306))) / vec3((1f - _e311))))))), step(vec3(_e321), _e322));\n}\n\nfn disp(y_4: f32) -> f32 {\n    var y_5: f32;\n    var local_12: f32;\n    var local_13: f32;\n\n    y_5 = y_4;\n    let _e297 = y_5;\n    y_5 = max(_e297, 0f);\n    let _e300 = global.uDcp;\n    let _e303 = global.uToneMap;\n    if ((_e300 > 0.5f) && (_e303 < 0.5f)) {\n        let _e307 = y_5;\n        let _e308 = toneAt(_e307);\n        let _e309 = encS1_(_e308);\n        local_13 = _e309;\n    } else {\n        let _e310 = global.uToneMap;\n        if (_e310 > 3.5f) {\n            let _e313 = y_5;\n            let _e316 = encS1_(min(_e313, 1f));\n            local_12 = _e316;\n        } else {\n            let _e317 = y_5;\n            let _e318 = shoulder1_(_e317);\n            let _e320 = encode(vec3(_e318));\n            local_12 = _e320.x;\n        }\n        let _e323 = local_12;\n        local_13 = _e323;\n    }\n    let _e325 = local_13;\n    return _e325;\n}\n\nfn intoRange(lin_2: vec3<f32>) -> vec3<f32> {\n    var lin_3: vec3<f32>;\n    var y_6: f32;\n    var mn_3: f32;\n    var local_14: vec3<f32>;\n\n    lin_3 = lin_2;\n    let _e297 = lin_3;\n    y_6 = dot(_e297, W709_);\n    let _e300 = lin_3;\n    let _e302 = lin_3;\n    let _e304 = lin_3;\n    mn_3 = min(_e300.x, min(_e302.y, _e304.z));\n    let _e309 = mn_3;\n    if (_e309 < 0f) {\n        let _e312 = y_6;\n        if (_e312 > 0f) {\n            let _e315 = y_6;\n            let _e316 = lin_3;\n            let _e317 = y_6;\n            let _e320 = y_6;\n            let _e321 = y_6;\n            let _e322 = mn_3;\n            local_14 = (vec3(_e315) + ((_e316 - vec3(_e317)) * (_e320 / ((_e321 - _e322) + 0.000001f))));\n        } else {\n            local_14 = vec3(0f);\n        }\n        let _e333 = local_14;\n        lin_3 = _e333;\n    }\n    let _e334 = lin_3;\n    return max(_e334, vec3(0f));\n}\n\nfn hash(q_1: vec2<f32>) -> f32 {\n    var q_2: vec2<f32>;\n\n    q_2 = q_1;\n    let _e297 = q_2;\n    return fract((sin(dot(_e297, vec2<f32>(127.1f, 311.7f))) * 43758.547f));\n}\n\nfn vnoise(q_3: vec2<f32>) -> f32 {\n    var q_4: vec2<f32>;\n    var i_5: vec2<f32>;\n    var f_3: vec2<f32>;\n\n    q_4 = q_3;\n    let _e297 = q_4;\n    i_5 = floor(_e297);\n    let _e300 = q_4;\n    f_3 = fract(_e300);\n    let _e303 = f_3;\n    let _e304 = f_3;\n    let _e308 = f_3;\n    f_3 = ((_e303 * _e304) * (vec2(3f) - (2f * _e308)));\n    let _e313 = i_5;\n    let _e314 = hash(_e313);\n    let _e315 = i_5;\n    let _e320 = hash((_e315 + vec2<f32>(1f, 0f)));\n    let _e321 = f_3;\n    let _e324 = i_5;\n    let _e329 = hash((_e324 + vec2<f32>(0f, 1f)));\n    let _e330 = i_5;\n    let _e334 = hash((_e330 + vec2(1f)));\n    let _e335 = f_3;\n    let _e338 = f_3;\n    return mix(mix(_e314, _e320, _e321.x), mix(_e329, _e334, _e335.x), _e338.y);\n}\n\nfn main_1() {\n    var local_15: f32;\n    var cq: vec2<f32>;\n    var ori: vec2<f32>;\n    var n_2: vec2<f32>;\n    var hn: vec3<f32>;\n    var r2_: f32;\n    var p_10: vec2<f32>;\n    var lv: vec2<f32>;\n    var lr2_: f32;\n    var lin_4: vec3<f32>;\n    var lin0_: vec3<f32>;\n    var LA: vec4<f32> = vec4(0f);\n    var LB: vec4<f32> = vec4(0f);\n    var LC: vec4<f32> = vec4(0f);\n    var LD: vec4<f32> = vec4(0f);\n    var LE: vec4<f32> = vec4(0f);\n    var LF: vec4<f32> = vec4(0f);\n    var LG: f32 = 0f;\n    var mw: array<f32, 16>;\n    var i_6: i32 = 0i;\n    var shownW: f32 = 0f;\n    var muv: vec2<f32>;\n    var m0_: vec4<f32>;\n    var local_16: vec4<f32>;\n    var m1_1: vec4<f32>;\n    var local_17: vec4<f32>;\n    var m2_1: vec4<f32>;\n    var local_18: vec4<f32>;\n    var m3_: vec4<f32>;\n    var yl: f32;\n    var i_7: i32 = 0i;\n    var local_19: f32;\n    var local_20: f32;\n    var local_21: f32;\n    var w_1: f32;\n    var r_2: vec4<f32>;\n    var sm: f32;\n    var nrLum: f32;\n    var nrColor: f32;\n    var exposure: f32;\n    var highlights: f32;\n    var shadows: f32;\n    var whites: f32;\n    var blacks: f32;\n    var texAmt: f32;\n    var clarity: f32;\n    var dehaze: f32;\n    var sharpen: f32;\n    var y0_: f32;\n    var lsum: vec3<f32>;\n    var lw: f32 = 1f;\n    var csum: vec4<f32>;\n    var cw: f32 = 1f;\n    var c0_2: vec3<f32>;\n    var yn0_: f32;\n    var nv0_: f32;\n    var sigma: f32;\n    var cr: f32;\n    var i_8: i32 = 0i;\n    var a_5: f32;\n    var dir: vec2<f32>;\n    var n1_1: vec3<f32>;\n    var y1_1: f32;\n    var d_6: f32;\n    var w_2: f32;\n    var n2_: vec3<f32>;\n    var e2_: vec3<f32>;\n    var g2_: f32;\n    var n3_: vec3<f32>;\n    var e3_: vec3<f32>;\n    var g3_: f32;\n    var yl_1: f32;\n    var co_1: vec3<f32>;\n    var ll: f32;\n    var ct: vec2<f32> = vec2(0f);\n    var yt: f32 = 0f;\n    var ws: f32 = 0.0001f;\n    var k_8: i32 = 0i;\n    var local_22: f32;\n    var local_23: f32;\n    var local_24: f32;\n    var local_25: f32;\n    var local_26: vec2<f32>;\n    var off: vec2<f32>;\n    var t_7: vec4<f32>;\n    var d_7: f32;\n    var w_3: f32;\n    var yn: f32;\n    var noise: f32;\n    var dc: vec2<f32>;\n    var x_26: f32;\n    var conf: f32;\n    var take: f32;\n    var rb: vec2<f32>;\n    var pp_3: vec3<f32>;\n    var pos: vec3<f32>;\n    var yb: f32;\n    var w_4: f32;\n    var w_5: f32;\n    var yb_1: f32;\n    var y0_1: f32;\n    var l0_: f32;\n    var g_1: vec2<f32>;\n    var dEdge: f32;\n    var base: f32;\n    var detail: f32;\n    var bd: f32;\n    var shLift: f32 = 0f;\n    var lw_1: f32;\n    var dl: f32;\n    var bw: f32;\n    var mid_1: f32;\n    var l1_: f32;\n    var th: f32;\n    var local_27: f32;\n    var hp: f32;\n    var limit: f32;\n    var edge: f32;\n    var local_28: f32;\n    var mask: f32;\n    var fine: f32;\n    var ys: f32;\n    var air: f32;\n    var haze: f32;\n    var t_8: f32;\n    var local_29: f32;\n    var glowAmt: f32;\n    var local_30: vec3<f32>;\n    var gl: vec3<f32>;\n    var lc: vec3<f32>;\n    var w_6: f32;\n    var mapped: vec3<f32>;\n    var pp_4: vec3<f32>;\n    var local_31: vec3<f32>;\n    var local_32: vec3<f32>;\n    var local_33: vec3<f32>;\n    var local_34: vec3<f32>;\n    var d_8: vec3<f32>;\n    var dl_1: vec3<f32>;\n    var yg: f32;\n    var ga: vec3<f32>;\n    var e_1: f32;\n    var spill: vec3<f32>;\n    var yp: f32;\n    var y_7: f32;\n    var y2_1: f32;\n    var q_5: f32;\n    var dk: f32;\n    var local_35: f32;\n    var local_36: vec3<f32>;\n    var local_37: vec3<f32>;\n    var ck: f32;\n    var hi_1: f32;\n    var lo_1: f32;\n    var hi2_: f32;\n    var lo2_: f32;\n    var local_38: vec3<f32>;\n    var ck_1: f32;\n    var kl: f32;\n    var y_8: f32;\n    var y2_2: f32;\n    var local_39: vec3<f32>;\n    var dl_2: vec3<f32>;\n    var hi_2: f32;\n    var lo_2: f32;\n    var hi2_1: f32;\n    var lo2_1: f32;\n    var local_40: vec3<f32>;\n    var dh: vec3<f32>;\n    var cs: f32;\n    var yc: f32;\n    var mx_3: f32;\n    var local_41: f32;\n    var sv: f32;\n    var dc_1: vec3<f32>;\n    var hi_3: f32;\n    var lo_3: f32;\n    var hi2_2: f32;\n    var lo2_2: f32;\n    var local_42: vec3<f32>;\n    var yc0_: f32;\n    var yc_1: f32;\n    var i_9: i32 = 0i;\n    var row: f32;\n    var c_24: vec3<f32>;\n    var yc0_1: f32;\n    var yc_2: f32;\n    var h_7: vec3<f32>;\n    var chroma_1: f32;\n    var pp_5: vec3<f32>;\n    var q_6: vec3<f32>;\n    var adj: vec4<f32>;\n    var local_43: f32;\n    var local_44: f32;\n    var sv_1: f32;\n    var ps: f32;\n    var local_45: f32;\n    var local_46: f32;\n    var f_4: f32;\n    var o_3: vec3<f32>;\n    var yt_1: f32;\n    var pointShow: f32 = -1f;\n    var i_10: i32 = 0i;\n    var hp_1: vec3<f32>;\n    var dh_1: f32;\n    var dist_1: f32;\n    var width: f32;\n    var near: f32;\n    var k_9: f32;\n    var yp_1: f32;\n    var edge_1: f32;\n    var hd: vec3<f32>;\n    var purple: f32;\n    var green: f32;\n    var k_10: f32;\n    var yk: f32;\n    var yb_2: f32;\n    var lk: f32;\n    var bl: f32;\n    var up: f32;\n    var c_25: f32;\n    var local_47: f32;\n    var w_7: f32;\n    var sh_1: f32;\n    var hi_4: f32;\n    var mi: f32;\n    var dd: vec3<f32>;\n    var lum: f32;\n    var local_48: vec3<f32>;\n    var q_7: vec2<f32>;\n    var r_3: f32;\n    var local_49: vec2<f32>;\n    var qs: vec2<f32>;\n    var pw_1: f32;\n    var dist_2: f32;\n    var m0_1: f32;\n    var f_5: f32;\n    var mask_1: f32;\n    var amt: f32;\n    var local_50: vec3<f32>;\n    var d0_: vec3<f32>;\n    var local_51: vec3<f32>;\n    var grainAmt: f32;\n    var t_9: f32;\n    var size: f32;\n    var rough: f32;\n    var g_2: vec2<f32>;\n    var nz: f32;\n    var yg_1: f32;\n    var local_52: vec3<f32>;\n    var fw: f32;\n    var edge_2: f32;\n    var soft: f32;\n    var lines: f32;\n\n    let _e296 = gl_FragCoord_1;\n    let _e298 = global.frFlip;\n    if (_e298 > 0.5f) {\n        let _e301 = global.frH;\n        let _e302 = gl_FragCoord_1;\n        local_15 = (_e301 - _e302.y);\n    } else {\n        let _e305 = gl_FragCoord_1;\n        local_15 = _e305.y;\n    }\n    let _e308 = local_15;\n    let _e309 = gl_FragCoord_1;\n    let _e310 = _e309.zw;\n    frFC = vec4<f32>(_e296.x, _e308, _e310.x, _e310.y);\n    let _e314 = global.uOut2Crop;\n    let _e315 = frFC;\n    let _e316 = _e315.xy;\n    cq = (_e314 * vec3<f32>(_e316.x, _e316.y, 1f)).xy;\n    let _e324 = cq;\n    let _e329 = cq;\n    if ((abs(_e324.x) > 1.001f) || (abs(_e329.y) > 1.001f)) {\n        {\n            let _e335 = global.uBg;\n            o_4 = vec4<f32>(_e335.x, _e335.y, _e335.z, 1f);\n            return;\n        }\n    }\n    let _e341 = global.uOut2Ori;\n    let _e342 = frFC;\n    let _e343 = _e342.xy;\n    ori = (_e341 * vec3<f32>(_e343.x, _e343.y, 1f)).xy;\n    let _e351 = ori;\n    let _e352 = global.uOriCenter;\n    let _e354 = global.uOriHalf;\n    n_2 = ((_e351 - _e352) / vec2(_e354));\n    let _e358 = global.uPersp;\n    let _e359 = n_2;\n    hn = (_e358 * vec3<f32>(_e359.x, _e359.y, 1f));\n    let _e366 = hn;\n    let _e368 = hn;\n    n_2 = (_e366.xy / vec2(_e368.z));\n    let _e372 = n_2;\n    let _e373 = n_2;\n    let _e375 = global.uCornerR2_;\n    r2_ = (dot(_e372, _e373) / _e375);\n    let _e378 = n_2;\n    let _e380 = global.uDistort;\n    let _e381 = r2_;\n    n_2 = (_e378 * (1f - (_e380 * _e381)));\n    let _e385 = global.uOri2Photo;\n    let _e386 = n_2;\n    let _e387 = global.uOriHalf;\n    let _e389 = global.uOriCenter;\n    let _e390 = ((_e386 * _e387) + _e389);\n    p_10 = (_e385 * vec3<f32>(_e390.x, _e390.y, 1f)).xy;\n    let _e398 = p_10;\n    let _e399 = global.uLensC;\n    let _e401 = global.uLensN;\n    lv = ((_e398 - _e399) * _e401);\n    let _e404 = lv;\n    let _e405 = lv;\n    lr2_ = dot(_e404, _e405);\n    let _e408 = global.uLensC;\n    let _e409 = p_10;\n    let _e410 = global.uLensC;\n    let _e413 = lr2_;\n    let _e414 = global.uLensK;\n    let _e416 = lr2_;\n    let _e417 = global.uLensK;\n    let _e419 = lr2_;\n    let _e420 = global.uLensK;\n    let _e429 = global.uLensK;\n    p_10 = (_e408 + (((_e409 - _e410) * (1f + (_e413 * (_e414.x + (_e416 * (_e417.y + (_e419 * _e420.z))))))) * _e429.w));\n    let _e433 = hn;\n    let _e437 = p_10;\n    let _e442 = p_10;\n    let _e447 = p_10;\n    let _e452 = p_10;\n    if (((((_e433.z <= 0f) || (_e437.x < 0f)) || (_e442.y < 0f)) || (_e447.x > 1f)) || (_e452.y > 1f)) {\n        {\n            let _e457 = global.uBg;\n            o_4 = vec4<f32>(_e457.x, _e457.y, _e457.z, 1f);\n            return;\n        }\n    }\n    let _e463 = p_10;\n    let _e464 = cam_2(_e463);\n    let _e465 = toLinear(_e464);\n    lin_4 = _e465;\n    let _e467 = lin_4;\n    lin0_ = _e467;\n    loop {\n        let _e492 = i_6;\n        if !((_e492 < 16i)) {\n            break;\n        }\n        let _e499 = i_6;\n        mw[_e499] = 0f;\n        continuing {\n            let _e496 = i_6;\n            i_6 = (_e496 + 1i);\n        }\n    }\n    let _e504 = global.uMaskN;\n    if (_e504 > 0f) {\n        {\n            let _e507 = ori;\n            let _e508 = global.uOriSize;\n            muv = (_e507 / _e508);\n            let _e511 = muv;\n            let _e512 = textureSample(uMask0_, uMask0_s, _e511);\n            m0_ = _e512;\n            let _e514 = global.uMaskN;\n            if (_e514 > 4f) {\n                let _e517 = muv;\n                let _e518 = textureSample(uMask1_, uMask1_s, _e517);\n                local_16 = _e518;\n            } else {\n                local_16 = vec4(0f);\n            }\n            let _e522 = local_16;\n            m1_1 = _e522;\n            let _e524 = global.uMaskN;\n            if (_e524 > 8f) {\n                let _e527 = muv;\n                let _e528 = textureSample(uMask2_, uMask2_s, _e527);\n                local_17 = _e528;\n            } else {\n                local_17 = vec4(0f);\n            }\n            let _e532 = local_17;\n            m2_1 = _e532;\n            let _e534 = global.uMaskN;\n            if (_e534 > 12f) {\n                let _e537 = muv;\n                let _e538 = textureSample(uMask3_, uMask3_s, _e537);\n                local_18 = _e538;\n            } else {\n                local_18 = vec4(0f);\n            }\n            let _e542 = local_18;\n            m3_ = _e542;\n            let _e544 = lin0_;\n            let _e546 = global.uExposure;\n            let _e549 = disp((dot(_e544, W709_) * exp2(_e546)));\n            yl = _e549;\n            loop {\n                let _e553 = i_7;\n                if !((_e553 < 16i)) {\n                    break;\n                }\n                {\n                    let _e560 = i_7;\n                    let _e562 = global.uMaskN;\n                    if (f32(_e560) >= _e562) {\n                        break;\n                    }\n                    let _e564 = i_7;\n                    if (_e564 < 4i) {\n                        let _e567 = i_7;\n                        let _e569 = m0_[_e567];\n                        local_21 = _e569;\n                    } else {\n                        let _e570 = i_7;\n                        if (_e570 < 8i) {\n                            let _e573 = i_7;\n                            let _e577 = m1_1[(_e573 - 4i)];\n                            local_20 = _e577;\n                        } else {\n                            let _e578 = i_7;\n                            if (_e578 < 12i) {\n                                let _e581 = i_7;\n                                let _e585 = m2_1[(_e581 - 8i)];\n                                local_19 = _e585;\n                            } else {\n                                let _e586 = i_7;\n                                let _e590 = m3_[(_e586 - 12i)];\n                                local_19 = _e590;\n                            }\n                            let _e592 = local_19;\n                            local_20 = _e592;\n                        }\n                        let _e594 = local_20;\n                        local_21 = _e594;\n                    }\n                    let _e596 = local_21;\n                    w_1 = _e596;\n                    let _e598 = i_7;\n                    let _e600 = global.uMR[_e598];\n                    r_2 = _e600;\n                    let _e602 = r_2;\n                    if ((_e602.w - (floor((_e602.w / 2f)) * 2f)) >= 1f) {\n                        {\n                            let _e611 = r_2;\n                            sm = max((_e611.z * 0.5f), 0.004f);\n                            let _e618 = w_1;\n                            let _e619 = r_2;\n                            let _e621 = sm;\n                            let _e623 = r_2;\n                            let _e625 = yl;\n                            let _e628 = r_2;\n                            let _e630 = r_2;\n                            let _e632 = sm;\n                            let _e634 = yl;\n                            w_1 = (_e618 * (smoothstep((_e619.x - _e621), _e623.x, _e625) * (1f - smoothstep(_e628.y, (_e630.y + _e632), _e634))));\n                        }\n                    }\n                    let _e639 = r_2;\n                    if (_e639.w >= 2f) {\n                        let _e644 = w_1;\n                        w_1 = (1f - _e644);\n                    }\n                    let _e646 = i_7;\n                    let _e648 = global.uMaskView;\n                    if (f32(_e646) == _e648) {\n                        let _e650 = w_1;\n                        shownW = _e650;\n                    }\n                    let _e651 = w_1;\n                    let _e652 = i_7;\n                    let _e654 = global.uMD[_e652];\n                    w_1 = (_e651 * _e654.w);\n                    let _e657 = i_7;\n                    let _e659 = w_1;\n                    mw[_e657] = _e659;\n                    let _e660 = LG;\n                    let _e661 = i_7;\n                    let _e663 = global.uMS[_e661];\n                    let _e665 = w_1;\n                    LG = (_e660 + (_e663.w * _e665));\n                    let _e668 = LA;\n                    let _e669 = i_7;\n                    let _e671 = global.uMA[_e669];\n                    let _e672 = w_1;\n                    LA = (_e668 + (_e671 * _e672));\n                    let _e675 = LB;\n                    let _e676 = i_7;\n                    let _e678 = global.uMB[_e676];\n                    let _e679 = w_1;\n                    LB = (_e675 + (_e678 * _e679));\n                    let _e682 = LC;\n                    let _e683 = i_7;\n                    let _e685 = global.uMC[_e683];\n                    let _e686 = w_1;\n                    LC = (_e682 + (_e685 * _e686));\n                    let _e689 = LD;\n                    let _e690 = i_7;\n                    let _e692 = global.uMD[_e690];\n                    let _e693 = w_1;\n                    LD = (_e689 + (_e692 * _e693));\n                    let _e696 = LE;\n                    let _e697 = i_7;\n                    let _e699 = global.uME[_e697];\n                    let _e700 = w_1;\n                    LE = (_e696 + (_e699 * _e700));\n                    let _e703 = LF;\n                    let _e704 = i_7;\n                    let _e706 = global.uMF[_e704];\n                    let _e707 = w_1;\n                    LF = (_e703 + (_e706 * _e707));\n                }\n                continuing {\n                    let _e557 = i_7;\n                    i_7 = (_e557 + 1i);\n                }\n            }\n        }\n    }\n    let _e710 = global.uNrLum;\n    let _e711 = LD;\n    nrLum = clamp((_e710 + _e711.z), 0f, 1f);\n    let _e718 = global.uNrColor;\n    let _e719 = LE;\n    nrColor = clamp((_e718 + _e719.w), 0f, 1f);\n    let _e726 = global.uExposure;\n    let _e727 = LA;\n    exposure = (_e726 + _e727.x);\n    let _e731 = global.uHighlights;\n    let _e732 = LA;\n    highlights = (_e731 + _e732.z);\n    let _e736 = global.uShadows;\n    let _e737 = LA;\n    shadows = (_e736 + _e737.w);\n    let _e741 = global.uWhites;\n    let _e742 = LB;\n    whites = (_e741 + _e742.x);\n    let _e746 = global.uBlacks;\n    let _e747 = LB;\n    blacks = (_e746 + _e747.y);\n    let _e751 = global.uTexture;\n    let _e752 = LB;\n    texAmt = (_e751 + _e752.z);\n    let _e756 = global.uClarity;\n    let _e757 = LB;\n    clarity = (_e756 + _e757.w);\n    let _e761 = global.uDehaze;\n    let _e762 = LC;\n    dehaze = clamp((_e761 + _e762.x), -1f, 1f);\n    let _e770 = global.uSharpen;\n    let _e771 = LD;\n    sharpen = (_e770 + (_e771.y * 1.1f));\n    let _e777 = nrLum;\n    let _e780 = nrColor;\n    if ((_e777 > 0f) || (_e780 > 0f)) {\n        {\n            let _e784 = lin_4;\n            y0_ = max(dot(_e784, W709_), 0.00001f);\n            let _e789 = lin_4;\n            lsum = _e789;\n            let _e793 = lin_4;\n            let _e794 = lin_4;\n            let _e797 = (_e793 - vec3(dot(_e794, W709_)));\n            let _e798 = lin_4;\n            csum = vec4<f32>(_e797.x, _e797.y, _e797.z, dot(_e798, W709_));\n            let _e807 = lin_4;\n            let _e808 = chroma(_e807);\n            c0_2 = _e808;\n            let _e810 = lin_4;\n            yn0_ = max(dot(_e810, W709_), CHROMA_FLOOR);\n            let _e817 = lin_4;\n            let _e821 = noiseAt(max(dot(_e817, W709_), 0f));\n            let _e823 = global.uNoiseFull;\n            let _e825 = yn0_;\n            let _e826 = yn0_;\n            nv0_ = ((((18f * _e821) * _e823) / (_e825 * _e826)) + 0.0000001f);\n            let _e833 = nrLum;\n            let _e838 = global.uNrLumDetail;\n            sigma = ((0.02f + (_e833 * 0.25f)) * (1.5f - _e838));\n            let _e844 = global.uNrColorDetail;\n            cr = (4f * (1.5f - _e844));\n            loop {\n                let _e850 = i_8;\n                if !((_e850 < 8i)) {\n                    break;\n                }\n                {\n                    let _e857 = i_8;\n                    a_5 = (f32(_e857) * 0.785398f);\n                    let _e862 = a_5;\n                    let _e864 = a_5;\n                    dir = vec2<f32>(cos(_e862), sin(_e864));\n                    let _e868 = p_10;\n                    let _e869 = dir;\n                    let _e870 = global.uPhotoPx;\n                    let _e875 = cam_2((_e868 + ((_e869 * _e870) * 1.5f)));\n                    let _e876 = toLinear(_e875);\n                    n1_1 = _e876;\n                    let _e878 = n1_1;\n                    y1_1 = max(dot(_e878, W709_), 0.00001f);\n                    let _e883 = y1_1;\n                    let _e885 = y0_;\n                    d_6 = (log2(_e883) - log2(_e885));\n                    let _e889 = d_6;\n                    let _e891 = d_6;\n                    let _e894 = sigma;\n                    let _e896 = sigma;\n                    let _e900 = nrLum;\n                    w_2 = (exp(((-(_e889) * _e891) / ((2f * _e894) * _e896))) * _e900);\n                    let _e903 = lsum;\n                    let _e904 = n1_1;\n                    let _e905 = w_2;\n                    lsum = (_e903 + (_e904 * _e905));\n                    let _e908 = lw;\n                    let _e909 = w_2;\n                    lw = (_e908 + _e909);\n                    let _e911 = nrColor;\n                    if (_e911 > 0f) {\n                        {\n                            let _e914 = p_10;\n                            let _e915 = dir;\n                            let _e916 = global.uPhotoPx;\n                            let _e918 = cr;\n                            let _e921 = cam_2((_e914 + ((_e915 * _e916) * _e918)));\n                            let _e922 = toLinear(_e921);\n                            n2_ = _e922;\n                            let _e924 = n2_;\n                            let _e925 = chroma(_e924);\n                            let _e926 = c0_2;\n                            e2_ = (_e925 - _e926);\n                            let _e929 = nrColor;\n                            let _e930 = e2_;\n                            let _e931 = e2_;\n                            let _e934 = nv0_;\n                            g2_ = (_e929 * exp((-(dot(_e930, _e931)) / _e934)));\n                            let _e939 = csum;\n                            let _e940 = n2_;\n                            let _e941 = n2_;\n                            let _e944 = (_e940 - vec3(dot(_e941, W709_)));\n                            let _e945 = n2_;\n                            let _e951 = g2_;\n                            csum = (_e939 + (vec4<f32>(_e944.x, _e944.y, _e944.z, dot(_e945, W709_)) * _e951));\n                            let _e954 = cw;\n                            let _e955 = g2_;\n                            cw = (_e954 + _e955);\n                            let _e957 = global.uNrColorSmooth;\n                            if (_e957 > 0f) {\n                                {\n                                    let _e960 = p_10;\n                                    let _e961 = dir;\n                                    let _e962 = global.uPhotoPx;\n                                    let _e964 = cr;\n                                    let _e969 = cam_2((_e960 + (((_e961 * _e962) * _e964) * 2.5f)));\n                                    let _e970 = toLinear(_e969);\n                                    n3_ = _e970;\n                                    let _e972 = n3_;\n                                    let _e973 = chroma(_e972);\n                                    let _e974 = c0_2;\n                                    e3_ = (_e973 - _e974);\n                                    let _e977 = nrColor;\n                                    let _e978 = global.uNrColorSmooth;\n                                    let _e980 = e3_;\n                                    let _e981 = e3_;\n                                    let _e984 = nv0_;\n                                    g3_ = ((_e977 * _e978) * exp((-(dot(_e980, _e981)) / _e984)));\n                                    let _e989 = csum;\n                                    let _e990 = n3_;\n                                    let _e991 = n3_;\n                                    let _e994 = (_e990 - vec3(dot(_e991, W709_)));\n                                    let _e995 = n3_;\n                                    let _e1001 = g3_;\n                                    csum = (_e989 + (vec4<f32>(_e994.x, _e994.y, _e994.z, dot(_e995, W709_)) * _e1001));\n                                    let _e1004 = cw;\n                                    let _e1005 = g3_;\n                                    cw = (_e1004 + _e1005);\n                                }\n                            }\n                        }\n                    }\n                }\n                continuing {\n                    let _e854 = i_8;\n                    i_8 = (_e854 + 1i);\n                }\n            }\n            let _e1007 = lsum;\n            let _e1008 = lw;\n            lin_4 = (_e1007 / vec3(_e1008));\n            let _e1011 = global.uNrLumContrast;\n            if (_e1011 > 0f) {\n                let _e1014 = lin_4;\n                let _e1015 = y0_;\n                let _e1017 = lin_4;\n                let _e1023 = global.uNrLumContrast;\n                lin_4 = (_e1014 * exp2((((log2(_e1015) - log2(max(dot(_e1017, W709_), 0.00001f))) * _e1023) * 0.6f)));\n            }\n            let _e1029 = nrColor;\n            if (_e1029 > 0f) {\n                {\n                    let _e1032 = lin_4;\n                    yl_1 = dot(_e1032, W709_);\n                    let _e1035 = csum;\n                    let _e1037 = csum;\n                    let _e1039 = cw;\n                    let _e1044 = cw;\n                    co_1 = ((_e1035.xyz / vec3(max((_e1037.w / _e1039), CHROMA_FLOOR))) / vec3(_e1044));\n                    let _e1048 = yl_1;\n                    ll = log2((max(_e1048, 0f) + CNR_EPS));\n                    loop {\n                        let _e1063 = k_8;\n                        if !((_e1063 < 5i)) {\n                            break;\n                        }\n                        {\n                            let _e1070 = k_8;\n                            if (_e1070 == 0i) {\n                                local_26 = vec2(0f);\n                            } else {\n                                let _e1075 = k_8;\n                                if (_e1075 == 1i) {\n                                    local_23 = 1f;\n                                } else {\n                                    let _e1079 = k_8;\n                                    if (_e1079 == 2i) {\n                                        local_22 = -1f;\n                                    } else {\n                                        local_22 = 0f;\n                                    }\n                                    let _e1086 = local_22;\n                                    local_23 = _e1086;\n                                }\n                                let _e1088 = local_23;\n                                let _e1089 = k_8;\n                                if (_e1089 == 3i) {\n                                    local_25 = 1f;\n                                } else {\n                                    let _e1093 = k_8;\n                                    if (_e1093 == 4i) {\n                                        local_24 = -1f;\n                                    } else {\n                                        local_24 = 0f;\n                                    }\n                                    let _e1100 = local_24;\n                                    local_25 = _e1100;\n                                }\n                                let _e1102 = local_25;\n                                local_26 = (vec2<f32>(_e1088, _e1102) * 1.5f);\n                            }\n                            let _e1107 = local_26;\n                            off = _e1107;\n                            let _e1109 = p_10;\n                            let _e1110 = off;\n                            let _e1111 = global.uChromaPx;\n                            let _e1114 = textureSample(uChroma, uChroma_s, (_e1109 + (_e1110 * _e1111)));\n                            t_7 = _e1114;\n                            let _e1116 = t_7;\n                            let _e1122 = ll;\n                            d_7 = (log2((max(_e1116.z, 0f) + CNR_EPS)) - _e1122);\n                            let _e1125 = d_7;\n                            let _e1127 = d_7;\n                            w_3 = exp(((-(_e1125) * _e1127) / 1.2800001f));\n                            let _e1137 = ct;\n                            let _e1138 = t_7;\n                            let _e1140 = w_3;\n                            ct = (_e1137 + (_e1138.xy * _e1140));\n                            let _e1143 = yt;\n                            let _e1144 = t_7;\n                            let _e1146 = w_3;\n                            yt = (_e1143 + (_e1144.z * _e1146));\n                            let _e1149 = ws;\n                            let _e1150 = w_3;\n                            ws = (_e1149 + _e1150);\n                        }\n                        continuing {\n                            let _e1067 = k_8;\n                            k_8 = (_e1067 + 1i);\n                        }\n                    }\n                    let _e1152 = ct;\n                    let _e1153 = ws;\n                    ct = (_e1152 / vec2(_e1153));\n                    let _e1156 = yt;\n                    let _e1157 = ws;\n                    yt = max((_e1156 / _e1157), CHROMA_FLOOR);\n                    let _e1160 = ct;\n                    let _e1161 = yt;\n                    ct = (_e1160 / vec2(_e1161));\n                    let _e1164 = yl_1;\n                    yn = max(_e1164, CHROMA_FLOOR);\n                    let _e1167 = yl_1;\n                    let _e1170 = noiseAt(max(_e1167, 0f));\n                    let _e1171 = global.uNoiseFull;\n                    let _e1174 = yn;\n                    let _e1175 = yn;\n                    noise = ((((_e1170 * _e1171) * CNR_LOCAL) / (_e1174 * _e1175)) + 0.0000001f);\n                    let _e1181 = co_1;\n                    let _e1183 = ct;\n                    dc = (_e1181.xz - _e1183);\n                    let _e1186 = dc;\n                    let _e1187 = dc;\n                    let _e1189 = noise;\n                    let _e1192 = global.uNrColorDetail;\n                    x_26 = (dot(_e1186, _e1187) / ((_e1189 * CNR_T) * ((2f - (_e1192 * 2f)) + 0.25f)));\n                    let _e1203 = ws;\n                    conf = smoothstep(0.1f, 0.5f, (_e1203 / 5f));\n                    let _e1210 = nrColor;\n                    let _e1213 = x_26;\n                    let _e1214 = x_26;\n                    let _e1217 = x_26;\n                    let _e1218 = x_26;\n                    let _e1224 = conf;\n                    let _e1227 = global.uChromaOn;\n                    take = (((smoothstep(0f, 0.25f, _e1210) * (1f - ((_e1213 * _e1214) / (1f + (_e1217 * _e1218))))) * _e1224) * step(0.5f, _e1227));\n                    let _e1231 = co_1;\n                    let _e1233 = ct;\n                    let _e1234 = take;\n                    rb = mix(_e1231.xz, _e1233, vec2(_e1234));\n                    let _e1238 = rb;\n                    let _e1241 = rb;\n                    let _e1245 = rb;\n                    let _e1252 = rb;\n                    co_1 = vec3<f32>(_e1238.x, (-(((0.2126f * _e1241.x) + (0.0722f * _e1245.y))) / 0.7152f), _e1252.y);\n                    let _e1255 = yl_1;\n                    let _e1256 = co_1;\n                    let _e1257 = yl_1;\n                    lin_4 = (vec3(_e1255) + (_e1256 * max(_e1257, CHROMA_FLOOR)));\n                }\n            }\n        }\n    }\n    let _e1262 = global.uDcp;\n    let _e1265 = global.uHsmDims;\n    if ((_e1262 > 0.5f) && (_e1265.x > 0f)) {\n        {\n            let _e1270 = global.uS2P;\n            let _e1271 = lin_4;\n            pp_3 = (_e1270 * _e1271);\n            let _e1274 = pp_3;\n            pos = max(_e1274, vec3(0f));\n            let _e1279 = global.uP2S;\n            let _e1280 = global.uHsmDims;\n            let _e1281 = pos;\n            let _e1282 = hueSatMap(uHsm, _e1280, _e1281);\n            let _e1283 = pp_3;\n            let _e1284 = pos;\n            lin_4 = (_e1279 * (_e1282 + (_e1283 - _e1284)));\n        }\n    }\n    let _e1288 = global.uBaseSat;\n    if (_e1288 != 1f) {\n        {\n            let _e1291 = lin_4;\n            yb = dot(_e1291, W709_);\n            let _e1294 = yb;\n            let _e1295 = lin_4;\n            let _e1296 = yb;\n            let _e1299 = global.uBaseSat;\n            lin_4 = (vec3(_e1294) + ((_e1295 - vec3(_e1296)) * _e1299));\n        }\n    }\n    let _e1303 = global.uLensVig;\n    if (_e1303 != 0f) {\n        {\n            let _e1306 = global.uLensVigMid;\n            let _e1310 = r2_;\n            w_4 = smoothstep((_e1306 * 0.6f), 1f, sqrt(_e1310));\n            let _e1314 = lin_4;\n            let _e1315 = global.uLensVig;\n            let _e1318 = w_4;\n            let _e1320 = w_4;\n            lin_4 = (_e1314 * exp2((((_e1315 * 1.6f) * _e1318) * _e1320)));\n        }\n    }\n    let _e1324 = global.uShadowTint;\n    if (_e1324 != 0f) {\n        {\n            let _e1330 = lin_4;\n            w_5 = (1f - smoothstep(0f, 0.2f, dot(_e1330, W709_)));\n            let _e1336 = lin_4;\n            let _e1339 = global.uShadowTint;\n            let _e1342 = w_5;\n            lin_4.y = (_e1336.y * (1f - ((_e1339 * 0.18f) * _e1342)));\n        }\n    }\n    let _e1346 = LC;\n    let _e1350 = LC;\n    if ((_e1346.z != 0f) || (_e1350.w != 0f)) {\n        {\n            let _e1355 = lin_4;\n            yb_1 = dot(_e1355, W709_);\n            let _e1358 = lin_4;\n            let _e1359 = LC;\n            let _e1363 = LC;\n            let _e1368 = LC;\n            lin_4 = (_e1358 * exp2(vec3<f32>((_e1359.z * 0.45f), (-(_e1363.w) * 0.35f), (-(_e1368.z) * 0.45f))));\n            let _e1376 = lin_4;\n            let _e1377 = yb_1;\n            let _e1379 = lin_4;\n            lin_4 = (_e1376 * (max(_e1377, CHROMA_FLOOR) / max(dot(_e1379, W709_), CHROMA_FLOOR)));\n        }\n    }\n    let _e1384 = lin_4;\n    y0_1 = max(dot(_e1384, W709_), 0.00001f);\n    let _e1389 = y0_1;\n    l0_ = log2(_e1389);\n    let _e1392 = p_10;\n    let _e1393 = textureSample(uGuide, uGuide_s, _e1392);\n    g_1 = _e1393.xy;\n    let _e1396 = l0_;\n    let _e1397 = g_1;\n    dEdge = (_e1396 - _e1397.x);\n    let _e1401 = g_1;\n    let _e1403 = dEdge;\n    let _e1405 = dEdge;\n    let _e1407 = dEdge;\n    base = (_e1401.x + (_e1403 * (1f - exp(((-(_e1405) * _e1407) / 0.1f)))));\n    let _e1416 = l0_;\n    let _e1417 = base;\n    detail = (_e1416 - _e1417);\n    let _e1420 = base;\n    let _e1421 = exposure;\n    base = (_e1420 + _e1421);\n    let _e1423 = base;\n    let _e1425 = disp(exp2(_e1423));\n    bd = _e1425;\n    let _e1429 = highlights;\n    let _e1432 = shadows;\n    if ((_e1429 != 0f) || (_e1432 != 0f)) {\n        {\n            let _e1437 = p_10;\n            let _e1438 = ring(_e1437, LIFT_R);\n            let _e1439 = p_10;\n            let _e1443 = ring(_e1439, 8f);\n            lw_1 = (0.5f * (_e1438 + _e1443));\n            let _e1447 = l0_;\n            let _e1448 = lw_1;\n            dl = (_e1447 - _e1448);\n            let _e1451 = lw_1;\n            let _e1452 = dl;\n            let _e1454 = dl;\n            let _e1456 = dl;\n            lw_1 = (_e1451 + (_e1452 * (1f - exp(((-(_e1454) * _e1456) / LIFT_EDGE)))));\n            let _e1463 = lw_1;\n            let _e1464 = exposure;\n            let _e1467 = disp(exp2((_e1463 + _e1464)));\n            bw = _e1467;\n            let _e1469 = base;\n            let _e1470 = highlights;\n            let _e1473 = bw;\n            let _e1477 = global.uHlTop;\n            let _e1478 = bd;\n            let _e1484 = global.uContrastSat;\n            let _e1485 = LA;\n            base = (_e1469 + ((((_e1470 * HL_K) * smoothstep(HL_LO, 1f, _e1473)) * (1f - (_e1477 * smoothstep(HL_T0_, HL_T1_, _e1478)))) * (1f - (HL_X * max(-((_e1484 + _e1485.y)), 0f)))));\n            let _e1495 = shadows;\n            let _e1498 = bw;\n            let _e1505 = bw;\n            let _e1512 = blacks;\n            shLift = ((_e1495 * ((SH_K * (1f - smoothstep(0f, SH_HI, _e1498))) + (SH_DEEP * (1f - smoothstep(0f, 0.2f, _e1505))))) * (1f - (SH_X * max(_e1512, 0f))));\n            let _e1518 = base;\n            let _e1519 = shLift;\n            base = (_e1518 + _e1519);\n        }\n    }\n    let _e1523 = bd;\n    let _e1528 = bd;\n    mid_1 = (smoothstep(0.03f, 0.35f, _e1523) * (1f - smoothstep(0.8f, 1f, _e1528)));\n    let _e1533 = detail;\n    let _e1536 = clarity;\n    let _e1539 = mid_1;\n    detail = (_e1533 * max(0f, (1f + ((_e1536 * 0.9f) * _e1539))));\n    let _e1544 = base;\n    let _e1545 = detail;\n    l1_ = (_e1544 + _e1545);\n    let _e1548 = texAmt;\n    if (_e1548 != 0f) {\n        {\n            let _e1551 = l0_;\n            let _e1552 = p_10;\n            let _e1554 = ring(_e1552, 3f);\n            th = (_e1551 - _e1554);\n            let _e1557 = l1_;\n            let _e1558 = texAmt;\n            let _e1561 = th;\n            let _e1565 = mid_1;\n            let _e1569 = texAmt;\n            if (_e1569 < 0f) {\n                let _e1575 = th;\n                local_27 = (1f - smoothstep(0.08f, 0.25f, abs(_e1575)));\n            } else {\n                local_27 = 1f;\n            }\n            let _e1581 = local_27;\n            l1_ = (_e1557 + ((((_e1558 * 0.9f) * _e1561) * (0.4f + (0.6f * _e1565))) * _e1581));\n        }\n    }\n    let _e1584 = sharpen;\n    if (_e1584 > 0f) {\n        {\n            let _e1587 = l0_;\n            let _e1588 = p_10;\n            let _e1589 = global.uSharpenRadius;\n            let _e1590 = ring(_e1588, _e1589);\n            hp = (_e1587 - _e1590);\n            let _e1594 = global.uSharpenDetail;\n            limit = (0.06f + (_e1594 * 0.6f));\n            let _e1599 = l0_;\n            let _e1600 = p_10;\n            let _e1601 = global.uSharpenRadius;\n            let _e1604 = ring(_e1600, (_e1601 * 2f));\n            edge = abs((_e1599 - _e1604));\n            let _e1608 = global.uSharpenMasking;\n            if (_e1608 > 0f) {\n                let _e1611 = global.uSharpenMasking;\n                let _e1614 = global.uSharpenMasking;\n                let _e1619 = edge;\n                local_28 = smoothstep((_e1611 * 0.25f), ((_e1614 * 0.25f) + 0.08f), _e1619);\n            } else {\n                local_28 = 1f;\n            }\n            let _e1623 = local_28;\n            mask = _e1623;\n            let _e1625 = l1_;\n            let _e1626 = sharpen;\n            let _e1627 = hp;\n            let _e1628 = limit;\n            let _e1630 = limit;\n            let _e1633 = mask;\n            l1_ = (_e1625 + ((_e1626 * clamp(_e1627, -(_e1628), _e1630)) * _e1633));\n        }\n    } else {\n        let _e1636 = sharpen;\n        if (_e1636 < 0f) {\n            let _e1639 = l1_;\n            let _e1640 = sharpen;\n            let _e1644 = l0_;\n            let _e1645 = p_10;\n            let _e1647 = ring(_e1645, 1.5f);\n            l1_ = (_e1639 + (max(_e1640, -1f) * (_e1644 - _e1647)));\n        }\n    }\n    let _e1651 = l1_;\n    let _e1652 = base;\n    fine = (_e1651 - _e1652);\n    let _e1655 = lin_4;\n    let _e1656 = l1_;\n    let _e1657 = l0_;\n    lin_4 = (_e1655 * exp2((_e1656 - _e1657)));\n    let _e1661 = shLift;\n    if (_e1661 > 0f) {\n        {\n            let _e1664 = lin_4;\n            ys = dot(_e1664, W709_);\n            let _e1667 = ys;\n            let _e1668 = lin_4;\n            let _e1669 = ys;\n            let _e1674 = shLift;\n            lin_4 = (vec3(_e1667) + ((_e1668 - vec3(_e1669)) * exp2((-0.3f * _e1674))));\n        }\n    }\n    let _e1680 = dehaze;\n    if (_e1680 != 0f) {\n        {\n            let _e1683 = global.uAirY;\n            let _e1684 = exposure;\n            air = (_e1683 * exp2(_e1684));\n            let _e1688 = g_1;\n            let _e1690 = exposure;\n            let _e1693 = air;\n            haze = clamp(((_e1688.y * exp2(_e1690)) / max(_e1693, 0.0001f)), 0f, 1f);\n            let _e1701 = dehaze;\n            if (_e1701 > 0f) {\n                {\n                    let _e1706 = dehaze;\n                    let _e1708 = haze;\n                    t_8 = max((1f - ((0.95f * _e1706) * _e1708)), 0.2f);\n                    let _e1714 = lin_4;\n                    let _e1715 = air;\n                    let _e1717 = t_8;\n                    let _e1722 = t_8;\n                    lin_4 = ((_e1714 - vec3((_e1715 * (1f - _e1717)))) / vec3(_e1722));\n                }\n            } else {\n                {\n                    let _e1725 = lin_4;\n                    let _e1726 = air;\n                    let _e1730 = dehaze;\n                    let _e1736 = haze;\n                    lin_4 = mix(_e1725, vec3((_e1726 * 0.85f)), vec3(((-(_e1730) * 0.45f) * (0.4f + (0.6f * _e1736)))));\n                }\n            }\n        }\n    }\n    let _e1742 = global.uGlowMix;\n    if (_e1742.w > 0.5f) {\n        let _e1746 = global.uGlowMix;\n        let _e1748 = LG;\n        local_29 = clamp((_e1746.x + _e1748), 0f, 1f);\n    } else {\n        local_29 = 0f;\n    }\n    let _e1755 = local_29;\n    glowAmt = _e1755;\n    let _e1757 = glowAmt;\n    if (_e1757 > 0f) {\n        let _e1760 = p_10;\n        let _e1761 = textureSample(uGlow, uGlow_s, _e1760);\n        local_30 = _e1761.xyz;\n    } else {\n        local_30 = vec3(0f);\n    }\n    let _e1766 = local_30;\n    gl = _e1766;\n    let _e1768 = glowAmt;\n    let _e1771 = global.uGlowMix;\n    if ((_e1768 > 0f) && (_e1771.y > 1.5f)) {\n        {\n            let _e1776 = lin_4;\n            lc = clamp(_e1776, vec3(0f), vec3(1f));\n            let _e1783 = global.uGlowF;\n            let _e1785 = global.uGlowF;\n            let _e1787 = lc;\n            w_6 = smoothstep(_e1783.z, _e1785.w, dot(_e1787, W709_));\n            let _e1791 = lin_4;\n            let _e1792 = glowAmt;\n            let _e1793 = w_6;\n            let _e1795 = global.uGlowF;\n            let _e1797 = gl;\n            let _e1798 = lin_4;\n            let _e1801 = global.uGlowF;\n            let _e1803 = lc;\n            let _e1806 = lc;\n            lin_4 = (_e1791 + ((_e1792 * _e1793) * ((_e1795.x * (_e1797 - _e1798)) + ((_e1801.y * _e1803) * (vec3(1f) - _e1806)))));\n        }\n    }\n    let _e1814 = global.uDcp;\n    let _e1817 = global.uToneMap;\n    if ((_e1814 > 0.5f) && (_e1817 < 0.5f)) {\n        {\n            let _e1821 = global.uS2P;\n            let _e1822 = lin_4;\n            pp_4 = max((_e1821 * _e1822), vec3(0f));\n            let _e1828 = global.uLookADims;\n            if (_e1828.x > 0f) {\n                let _e1832 = global.uLookADims;\n                let _e1833 = pp_4;\n                let _e1834 = hueSatMap(uLookA, _e1832, _e1833);\n                pp_4 = _e1834;\n            }\n            let _e1835 = global.uLookBDims;\n            if (_e1835.x > 0f) {\n                let _e1839 = global.uLookBDims;\n                let _e1840 = pp_4;\n                let _e1841 = hueSatMap(uLookB, _e1839, _e1840);\n                pp_4 = _e1841;\n            }\n            let _e1842 = global.uP2S;\n            let _e1843 = pp_4;\n            let _e1844 = easeWhite(_e1843);\n            let _e1845 = rgbTone(_e1844);\n            let _e1847 = intoRange((_e1842 * _e1845));\n            mapped = _e1847;\n        }\n    } else {\n        {\n            let _e1848 = lin_4;\n            let _e1849 = intoRange(_e1848);\n            lin_4 = _e1849;\n            let _e1850 = global.uToneMap;\n            if (_e1850 < 0.5f) {\n                let _e1853 = lin_4;\n                let _e1854 = shoulder(_e1853);\n                local_34 = _e1854;\n            } else {\n                let _e1855 = global.uToneMap;\n                if (_e1855 < 1.5f) {\n                    let _e1858 = lin_4;\n                    let _e1859 = sigmoidMap(_e1858);\n                    local_33 = _e1859;\n                } else {\n                    let _e1860 = global.uToneMap;\n                    if (_e1860 < 2.5f) {\n                        let _e1863 = lin_4;\n                        let _e1864 = agxMap(_e1863);\n                        local_32 = _e1864;\n                    } else {\n                        let _e1865 = global.uToneMap;\n                        if (_e1865 < 3.5f) {\n                            let _e1868 = lin_4;\n                            let _e1869 = filmicMap(_e1868);\n                            local_31 = _e1869;\n                        } else {\n                            let _e1870 = lin_4;\n                            local_31 = _e1870;\n                        }\n                        let _e1872 = local_31;\n                        local_32 = _e1872;\n                    }\n                    let _e1874 = local_32;\n                    local_33 = _e1874;\n                }\n                let _e1876 = local_33;\n                local_34 = _e1876;\n            }\n            let _e1878 = local_34;\n            mapped = _e1878;\n        }\n    }\n    let _e1879 = mapped;\n    let _e1880 = encode(_e1879);\n    d_8 = _e1880;\n    let _e1882 = glowAmt;\n    let _e1885 = global.uGlowMix;\n    if ((_e1882 > 0f) && (_e1885.y < 1.5f)) {\n        {\n            let _e1890 = d_8;\n            let _e1891 = decodeS(_e1890);\n            dl_1 = _e1891;\n            let _e1893 = global.uGlowMix;\n            if (_e1893.y < 0.5f) {\n                {\n                    let _e1897 = gl;\n                    let _e1898 = glowAmt;\n                    gl = (_e1897 * _e1898);\n                    let _e1900 = gl;\n                    yg = max(dot(_e1900, W709_), 0f);\n                    let _e1905 = gl;\n                    let _e1907 = yg;\n                    let _e1908 = global.uGlowF;\n                    let _e1911 = global.uGlowF;\n                    ga = (_e1905 * (1f - exp(-(pow((_e1907 / _e1908.x), _e1911.y)))));\n                    let _e1921 = dl_1;\n                    let _e1929 = ga;\n                    dl_1 = (vec3(1f) - ((vec3(1f) - clamp(_e1921, vec3(0f), vec3(1f))) * exp(-(_e1929))));\n                }\n            } else {\n                {\n                    let _e1935 = gl;\n                    let _e1937 = glowAmt;\n                    let _e1939 = global.uGlowF;\n                    e_1 = ((_e1935.x * _e1937) * _e1939.x);\n                    let _e1944 = global.uGlowF2_;\n                    let _e1946 = global.uGlowF2_;\n                    let _e1949 = e_1;\n                    let _e1950 = global.uGlowF2_;\n                    spill = (vec3<f32>(0f, _e1944.x, _e1946.y) * max((_e1949 - _e1950.z), 0f));\n                    let _e1957 = dl_1;\n                    let _e1958 = e_1;\n                    let _e1959 = global.uGlowF;\n                    let _e1961 = e_1;\n                    let _e1963 = global.uGlowF;\n                    let _e1965 = e_1;\n                    let _e1968 = spill;\n                    dl_1 = (_e1957 + (vec3<f32>(_e1958, (_e1959.y * _e1961), (_e1963.z * _e1965)) + _e1968));\n                }\n            }\n            let _e1971 = dl_1;\n            let _e1972 = encode(_e1971);\n            d_8 = _e1972;\n        }\n    }\n    let _e1973 = whites;\n    let _e1976 = blacks;\n    if ((_e1973 != 0f) || (_e1976 != 0f)) {\n        {\n            let _e1980 = d_8;\n            yp = clamp(dot(_e1980, W709_), 0f, 1f);\n            let _e1986 = yp;\n            let _e1987 = fine;\n            y_7 = clamp((_e1986 * exp2((-(_e1987) * WB_LOCAL))), 0f, 1f);\n            let _e1996 = y_7;\n            y2_1 = _e1996;\n            let _e1998 = whites;\n            if (_e1998 < 0f) {\n                {\n                    let _e2001 = y2_1;\n                    q_5 = (_e2001 / 0.9f);\n                    let _e2005 = q_5;\n                    let _e2006 = q_5;\n                    let _e2007 = q_5;\n                    q_5 = (_e2005 * (_e2006 * _e2007));\n                    let _e2010 = y2_1;\n                    let _e2011 = whites;\n                    let _e2013 = y2_1;\n                    let _e2015 = y2_1;\n                    let _e2017 = y2_1;\n                    let _e2020 = q_5;\n                    let _e2021 = q_5;\n                    y2_1 = (_e2010 + (((((_e2011 * WH_NEG) * _e2013) * _e2015) * _e2017) / (1f + (_e2020 * _e2021))));\n                }\n            } else {\n                let _e2026 = whites;\n                if (_e2026 > 0f) {\n                    let _e2029 = y2_1;\n                    let _e2031 = whites;\n                    let _e2033 = y2_1;\n                    y2_1 = (_e2029 * (1f + ((_e2031 * WH_POS) * _e2033)));\n                }\n            }\n            let _e2037 = y2_1;\n            let _e2039 = y2_1;\n            dk = (_e2037 * pow((1f - min(_e2039, 1f)), BL_N));\n            let _e2046 = y2_1;\n            let _e2047 = blacks;\n            if (_e2047 < 0f) {\n                let _e2050 = blacks;\n                let _e2052 = dk;\n                local_35 = ((_e2050 * BL_NEG) * _e2052);\n            } else {\n                let _e2054 = blacks;\n                let _e2055 = dk;\n                let _e2058 = y2_1;\n                local_35 = (_e2054 * ((BL_POS * _e2055) + (BL_LIFT * (1f - _e2058))));\n            }\n            let _e2064 = local_35;\n            y2_1 = (_e2046 + _e2064);\n            let _e2066 = y2_1;\n            y2_1 = max(_e2066, 0f);\n            let _e2069 = y_7;\n            if (_e2069 > 0.0001f) {\n                let _e2072 = y2_1;\n                let _e2073 = y_7;\n                if (_e2072 > _e2073) {\n                    let _e2075 = d_8;\n                    let _e2076 = y2_1;\n                    let _e2077 = y_7;\n                    let _e2080 = d_8;\n                    let _e2081 = y2_1;\n                    let _e2082 = y_7;\n                    let _e2084 = yp;\n                    let _e2086 = y_7;\n                    local_36 = mix((_e2075 * (_e2076 / _e2077)), (_e2080 + vec3((((_e2081 - _e2082) * _e2084) / _e2086))), vec3(0.9f));\n                } else {\n                    let _e2093 = d_8;\n                    let _e2094 = y2_1;\n                    let _e2095 = y_7;\n                    local_36 = (_e2093 * (_e2094 / _e2095));\n                }\n                let _e2099 = local_36;\n                local_37 = _e2099;\n            } else {\n                let _e2100 = y2_1;\n                local_37 = vec3(_e2100);\n            }\n            let _e2103 = local_37;\n            d_8 = _e2103;\n        }\n    }\n    let _e2104 = d_8;\n    d_8 = clamp(_e2104, vec3(0f), vec3(1f));\n    {\n        let _e2110 = global.uContrast;\n        ck = _e2110;\n        let _e2112 = d_8;\n        let _e2114 = d_8;\n        let _e2116 = d_8;\n        hi_1 = max(_e2112.x, max(_e2114.y, _e2116.z));\n        let _e2121 = d_8;\n        let _e2123 = d_8;\n        let _e2125 = d_8;\n        lo_1 = min(_e2121.x, min(_e2123.y, _e2125.z));\n        let _e2130 = hi_1;\n        let _e2131 = ck;\n        let _e2132 = hi_1;\n        let _e2133 = hi_1;\n        let _e2137 = hi_1;\n        let _e2141 = hi_1;\n        hi2_ = (_e2130 + (_e2131 * (((_e2132 * _e2133) * (3f - (2f * _e2137))) - _e2141)));\n        let _e2146 = lo_1;\n        let _e2147 = ck;\n        let _e2148 = lo_1;\n        let _e2149 = lo_1;\n        let _e2153 = lo_1;\n        let _e2157 = lo_1;\n        lo2_ = (_e2146 + (_e2147 * (((_e2148 * _e2149) * (3f - (2f * _e2153))) - _e2157)));\n        let _e2162 = hi_1;\n        let _e2163 = lo_1;\n        if ((_e2162 - _e2163) > 0.00001f) {\n            let _e2167 = lo2_;\n            let _e2168 = d_8;\n            let _e2169 = lo_1;\n            let _e2172 = hi2_;\n            let _e2173 = lo2_;\n            let _e2175 = hi_1;\n            let _e2176 = lo_1;\n            local_38 = (vec3(_e2167) + ((_e2168 - vec3(_e2169)) * ((_e2172 - _e2173) / (_e2175 - _e2176))));\n        } else {\n            let _e2182 = hi2_;\n            local_38 = vec3(_e2182);\n        }\n        let _e2185 = local_38;\n        d_8 = _e2185;\n    }\n    {\n        let _e2186 = global.uContrastSat;\n        let _e2187 = LA;\n        ck_1 = (CON_K * (_e2186 + _e2187.y));\n        let _e2192 = ck_1;\n        if (_e2192 != 0f) {\n            {\n                let _e2195 = fine;\n                kl = exp2((-(_e2195) * CON_LOCAL));\n                let _e2200 = d_8;\n                let _e2202 = kl;\n                y_8 = clamp((dot(_e2200, W709_) * _e2202), 0f, 1f);\n                let _e2208 = y_8;\n                let _e2209 = ck_1;\n                let _e2210 = conCurve(_e2208, _e2209);\n                y2_2 = _e2210;\n                let _e2212 = y_8;\n                if (_e2212 > 0.0001f) {\n                    let _e2215 = d_8;\n                    let _e2216 = y2_2;\n                    let _e2217 = y_8;\n                    local_39 = (_e2215 * (_e2216 / _e2217));\n                } else {\n                    let _e2220 = y2_2;\n                    local_39 = vec3(_e2220);\n                }\n                let _e2223 = local_39;\n                dl_2 = _e2223;\n                let _e2225 = d_8;\n                let _e2227 = d_8;\n                let _e2229 = d_8;\n                hi_2 = max(_e2225.x, max(_e2227.y, _e2229.z));\n                let _e2234 = d_8;\n                let _e2236 = d_8;\n                let _e2238 = d_8;\n                lo_2 = min(_e2234.x, min(_e2236.y, _e2238.z));\n                let _e2243 = hi_2;\n                let _e2244 = kl;\n                let _e2249 = ck_1;\n                let _e2250 = conCurve(clamp((_e2243 * _e2244), 0f, 1f), _e2249);\n                let _e2251 = kl;\n                hi2_1 = (_e2250 / _e2251);\n                let _e2254 = lo_2;\n                let _e2255 = kl;\n                let _e2260 = ck_1;\n                let _e2261 = conCurve(clamp((_e2254 * _e2255), 0f, 1f), _e2260);\n                let _e2262 = kl;\n                lo2_1 = (_e2261 / _e2262);\n                let _e2265 = hi_2;\n                let _e2266 = lo_2;\n                if ((_e2265 - _e2266) > 0.00001f) {\n                    let _e2270 = lo2_1;\n                    let _e2271 = d_8;\n                    let _e2272 = lo_2;\n                    let _e2275 = hi2_1;\n                    let _e2276 = lo2_1;\n                    let _e2278 = hi_2;\n                    let _e2279 = lo_2;\n                    local_40 = (vec3(_e2270) + ((_e2271 - vec3(_e2272)) * ((_e2275 - _e2276) / (_e2278 - _e2279))));\n                } else {\n                    let _e2285 = hi2_1;\n                    local_40 = vec3(_e2285);\n                }\n                let _e2288 = local_40;\n                dh = _e2288;\n                let _e2290 = dh;\n                let _e2291 = dl_2;\n                d_8 = mix(_e2290, _e2291, vec3(0.6f));\n            }\n        }\n    }\n    let _e2295 = global.uContrastSat;\n    let _e2296 = LA;\n    cs = (_e2295 + _e2296.y);\n    let _e2300 = cs;\n    if (_e2300 != 0f) {\n        {\n            let _e2303 = d_8;\n            yc = dot(_e2303, W709_);\n            let _e2306 = d_8;\n            let _e2308 = d_8;\n            let _e2310 = d_8;\n            mx_3 = max(_e2306.x, max(_e2308.y, _e2310.z));\n            let _e2315 = mx_3;\n            if (_e2315 > 0f) {\n                let _e2318 = mx_3;\n                let _e2319 = d_8;\n                let _e2321 = d_8;\n                let _e2323 = d_8;\n                let _e2328 = mx_3;\n                local_41 = ((_e2318 - min(_e2319.x, min(_e2321.y, _e2323.z))) / _e2328);\n            } else {\n                local_41 = 0f;\n            }\n            let _e2332 = local_41;\n            sv = _e2332;\n            let _e2334 = yc;\n            let _e2335 = d_8;\n            let _e2336 = yc;\n            let _e2340 = cs;\n            let _e2342 = sv;\n            let _e2346 = sv;\n            d_8 = (vec3(_e2334) + ((_e2335 - vec3(_e2336)) * max((1f + (_e2340 * (CS_K + ((CS_V * (1f - _e2342)) * (1f - _e2346))))), 0f)));\n        }\n    }\n    let _e2357 = d_8;\n    let _e2358 = decodeS(_e2357);\n    let _e2365 = encode(clamp((SRGB_TO_PP * _e2358), vec3(0f), vec3(1f)));\n    d_8 = _e2365;\n    {\n        let _e2367 = d_8;\n        let _e2369 = d_8;\n        let _e2371 = d_8;\n        hi_3 = max(_e2367.x, max(_e2369.y, _e2371.z));\n        let _e2376 = d_8;\n        let _e2378 = d_8;\n        let _e2380 = d_8;\n        lo_3 = min(_e2376.x, min(_e2378.y, _e2380.z));\n        let _e2385 = hi_3;\n        let _e2387 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2385, CURVE_ROW0_));\n        hi2_2 = _e2387.x;\n        let _e2390 = lo_3;\n        let _e2392 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2390, CURVE_ROW0_));\n        lo2_2 = _e2392.x;\n        let _e2395 = hi_3;\n        let _e2396 = lo_3;\n        if ((_e2395 - _e2396) > 0.00001f) {\n            let _e2400 = lo2_2;\n            let _e2401 = d_8;\n            let _e2402 = lo_3;\n            let _e2405 = hi2_2;\n            let _e2406 = lo2_2;\n            let _e2408 = hi_3;\n            let _e2409 = lo_3;\n            local_42 = (vec3(_e2400) + ((_e2401 - vec3(_e2402)) * ((_e2405 - _e2406) / (_e2408 - _e2409))));\n        } else {\n            let _e2415 = hi2_2;\n            local_42 = vec3(_e2415);\n        }\n        let _e2418 = local_42;\n        dc_1 = _e2418;\n    }\n    let _e2419 = global.uRefineSat;\n    if (_e2419 < 1f) {\n        {\n            let _e2422 = d_8;\n            yc0_ = dot(_e2422, W709_);\n            let _e2425 = yc0_;\n            let _e2427 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2425, CURVE_ROW0_));\n            yc_1 = _e2427.x;\n            let _e2430 = yc_1;\n            let _e2431 = d_8;\n            let _e2432 = yc0_;\n            let _e2435 = yc_1;\n            let _e2436 = yc0_;\n            let _e2443 = dc_1;\n            let _e2444 = global.uRefineSat;\n            d_8 = mix((vec3(_e2430) + ((_e2431 - vec3(_e2432)) * (_e2435 / max(_e2436, 0.001f)))), _e2443, vec3(_e2444));\n        }\n    } else {\n        let _e2447 = dc_1;\n        d_8 = _e2447;\n    }\n    let _e2448 = d_8;\n    d_8 = clamp(_e2448, vec3(0f), vec3(1f));\n    let _e2454 = d_8;\n    let _e2457 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2454.x, CURVE_ROW0_));\n    let _e2459 = d_8;\n    let _e2462 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2459.y, CURVE_ROW0_));\n    let _e2464 = d_8;\n    let _e2467 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2464.z, CURVE_ROW0_));\n    d_8 = vec3<f32>(_e2457.y, _e2462.z, _e2467.w);\n    let _e2470 = d_8;\n    let _e2471 = decodeS(_e2470);\n    let _e2473 = encode((PP_TO_SRGB * _e2471));\n    d_8 = _e2473;\n    let _e2474 = global.uMaskN;\n    if (_e2474 > 0f) {\n        {\n            loop {\n                let _e2479 = i_9;\n                if !((_e2479 < 16i)) {\n                    break;\n                }\n                {\n                    let _e2486 = i_9;\n                    let _e2488 = global.uMaskN;\n                    if (f32(_e2486) >= _e2488) {\n                        break;\n                    }\n                    let _e2490 = i_9;\n                    let _e2492 = global.uMS[_e2490];\n                    let _e2496 = i_9;\n                    let _e2498 = mw[_e2496];\n                    if ((_e2492.y < 0.5f) || (_e2498 <= 0f)) {\n                        continue;\n                    }\n                    let _e2502 = i_9;\n                    row = ((f32(_e2502) + 1.5f) / 17f);\n                    let _e2509 = d_8;\n                    let _e2511 = row;\n                    let _e2513 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2509.x, _e2511));\n                    let _e2515 = d_8;\n                    let _e2517 = row;\n                    let _e2519 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2515.y, _e2517));\n                    let _e2521 = d_8;\n                    let _e2523 = row;\n                    let _e2525 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2521.z, _e2523));\n                    c_24 = vec3<f32>(_e2513.x, _e2519.x, _e2525.x);\n                    let _e2529 = d_8;\n                    yc0_1 = dot(_e2529, W709_);\n                    let _e2532 = yc0_1;\n                    let _e2533 = row;\n                    let _e2535 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2532, _e2533));\n                    yc_2 = _e2535.x;\n                    let _e2538 = yc_2;\n                    let _e2539 = d_8;\n                    let _e2540 = yc0_1;\n                    let _e2543 = yc_2;\n                    let _e2544 = yc0_1;\n                    let _e2551 = c_24;\n                    let _e2552 = i_9;\n                    let _e2554 = global.uMS[_e2552];\n                    c_24 = mix((vec3(_e2538) + ((_e2539 - vec3(_e2540)) * (_e2543 / max(_e2544, 0.001f)))), _e2551, vec3(_e2554.z));\n                    let _e2558 = c_24;\n                    c_24 = clamp(_e2558, vec3(0f), vec3(1f));\n                    let _e2564 = c_24;\n                    let _e2566 = row;\n                    let _e2568 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2564.x, _e2566));\n                    let _e2570 = c_24;\n                    let _e2572 = row;\n                    let _e2574 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2570.y, _e2572));\n                    let _e2576 = c_24;\n                    let _e2578 = row;\n                    let _e2580 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2576.z, _e2578));\n                    c_24 = vec3<f32>(_e2568.y, _e2574.z, _e2580.w);\n                    let _e2583 = d_8;\n                    let _e2584 = c_24;\n                    let _e2585 = i_9;\n                    let _e2587 = mw[_e2585];\n                    d_8 = mix(_e2583, _e2584, vec3(min(_e2587, 1f)));\n                }\n                continuing {\n                    let _e2483 = i_9;\n                    i_9 = (_e2483 + 1i);\n                }\n            }\n        }\n    }\n    let _e2592 = d_8;\n    let _e2593 = hsv(_e2592);\n    h_7 = _e2593;\n    let _e2597 = h_7;\n    chroma_1 = smoothstep(0.02f, 0.25f, _e2597.y);\n    let _e2601 = d_8;\n    let _e2602 = srgbToLin(_e2601);\n    pp_5 = (SRGB_TO_PP * _e2602);\n    let _e2605 = pp_5;\n    let _e2609 = rgbToHsv6_(max(_e2605, vec3(0f)));\n    q_6 = _e2609;\n    let _e2611 = q_6;\n    let _e2623 = textureSample(uHue, uHue_s, vec2<f32>((((_e2611.x * 60f) + 0.5f) / 360f), 0.00065445027f));\n    let _e2625 = q_6;\n    adj = (_e2623 * smoothstep(0f, MIX_S, _e2625.y));\n    let _e2630 = adj;\n    let _e2634 = adj;\n    let _e2639 = adj;\n    if (((_e2630.x != 0f) || (_e2634.y != 0f)) || (_e2639.z != 0f)) {\n        {\n            let _e2645 = q_6;\n            let _e2647 = adj;\n            q_6.x = (_e2645.x + ((_e2647.x * MIX_HUE) / 60f));\n            let _e2654 = q_6;\n            let _e2657 = adj;\n            let _e2659 = adj;\n            if (_e2659.y > 0f) {\n                local_43 = MIX_SAT_UP;\n            } else {\n                local_43 = MIX_SAT_DOWN;\n            }\n            let _e2664 = local_43;\n            let _e2667 = adj;\n            q_6.y = (_e2654.y * max(((1f + (_e2657.y * _e2664)) - (_e2667.z * MIX_LUM_SAT)), 0f));\n            let _e2675 = q_6;\n            q_6.y = min(_e2675.y, 1f);\n            let _e2680 = q_6;\n            let _e2683 = adj;\n            let _e2685 = adj;\n            if (_e2685.z > 0f) {\n                local_44 = MIX_LUM_UP;\n            } else {\n                local_44 = MIX_LUM_DOWN;\n            }\n            let _e2690 = local_44;\n            q_6.z = (_e2680.z * max((1f + (_e2683.z * _e2690)), 0f));\n            let _e2696 = q_6;\n            let _e2697 = hsv6ToRgb(_e2696);\n            let _e2699 = linToSrgb((PP_TO_SRGB * _e2697));\n            d_8 = _e2699;\n        }\n    }\n    let _e2700 = LD;\n    if (_e2700.x != 0f) {\n        let _e2704 = d_8;\n        let _e2705 = LD;\n        let _e2709 = chroma_1;\n        let _e2711 = rotateHue(_e2704, ((_e2705.x * 60f) * _e2709));\n        d_8 = _e2711;\n    }\n    let _e2712 = global.uSaturation;\n    let _e2713 = LC;\n    sv_1 = (_e2712 + _e2713.y);\n    let _e2717 = sv_1;\n    let _e2720 = global.uVibrance;\n    if ((_e2717 != 0f) || (_e2720 != 0f)) {\n        {\n            let _e2724 = d_8;\n            let _e2725 = srgbToLin(_e2724);\n            let _e2730 = rgbToHsv6_(max((SRGB_TO_PP * _e2725), vec3(0f)));\n            ps = _e2730.y;\n            let _e2734 = sv_1;\n            let _e2735 = sv_1;\n            if (_e2735 > 0f) {\n                local_45 = 0.8f;\n            } else {\n                local_45 = 0.92f;\n            }\n            let _e2741 = local_45;\n            let _e2745 = global.uVibrance;\n            let _e2746 = global.uVibrance;\n            if (_e2746 > 0f) {\n                let _e2751 = ps;\n                local_46 = (1.29f * pow(clamp((1f - (_e2751 / 0.96f)), 0f, 1f), 0.77f));\n            } else {\n                local_46 = 0.77f;\n            }\n            let _e2763 = local_46;\n            f_4 = ((1f + (_e2734 * _e2741)) * (1f + (_e2745 * _e2763)));\n            let _e2768 = d_8;\n            let _e2769 = toOklab(_e2768);\n            o_3 = _e2769;\n            let _e2771 = o_3;\n            let _e2773 = o_3;\n            let _e2775 = f_4;\n            let _e2778 = (_e2773.yz * max(_e2775, 0f));\n            o_3.y = _e2778.x;\n            o_3.z = _e2778.y;\n            let _e2783 = o_3;\n            let _e2784 = fromOklab(_e2783);\n            d_8 = _e2784;\n        }\n    }\n    let _e2785 = LF;\n    let _e2789 = LF;\n    let _e2794 = LF;\n    if (((_e2785.y != 0f) || (_e2789.z != 0f)) || (_e2794.w != 0f)) {\n        {\n            let _e2799 = d_8;\n            yt_1 = dot(_e2799, W709_);\n            let _e2802 = d_8;\n            let _e2804 = LF;\n            d_8 = (_e2802 * (vec3(1f) + (_e2804.yzw * 2.4f)));\n            let _e2811 = d_8;\n            let _e2812 = yt_1;\n            let _e2814 = d_8;\n            d_8 = (_e2811 * (max(_e2812, CHROMA_FLOOR) / max(dot(_e2814, W709_), CHROMA_FLOOR)));\n        }\n    }\n    let _e2822 = global.uMaskN;\n    if (_e2822 > 0f) {\n        {\n            loop {\n                let _e2827 = i_10;\n                if !((_e2827 < 16i)) {\n                    break;\n                }\n                {\n                    let _e2834 = i_10;\n                    let _e2836 = global.uMaskN;\n                    if (f32(_e2834) >= _e2836) {\n                        break;\n                    }\n                    let _e2838 = i_10;\n                    let _e2840 = global.uMP[_e2838];\n                    if (_e2840.w < 0.5f) {\n                        continue;\n                    }\n                    let _e2844 = d_8;\n                    let _e2845 = hsv(_e2844);\n                    hp_1 = _e2845;\n                    let _e2847 = hp_1;\n                    let _e2849 = i_10;\n                    let _e2851 = global.uMP[_e2849];\n                    dh_1 = abs((_e2847.x - _e2851.x));\n                    let _e2856 = dh_1;\n                    let _e2858 = dh_1;\n                    dh_1 = (min(_e2856, (360f - _e2858)) / 180f);\n                    let _e2863 = dh_1;\n                    let _e2866 = hp_1;\n                    let _e2868 = i_10;\n                    let _e2870 = global.uMP[_e2868];\n                    let _e2874 = i_10;\n                    let _e2876 = global.uMP[_e2874];\n                    let _e2881 = dh_1;\n                    let _e2885 = hp_1;\n                    let _e2887 = i_10;\n                    let _e2889 = global.uMP[_e2887];\n                    let _e2894 = hp_1;\n                    let _e2896 = i_10;\n                    let _e2898 = global.uMP[_e2896];\n                    dist_1 = length(vec3<f32>(((((_e2863 * 2.2f) * min(_e2866.y, _e2870.y)) / max(_e2876.y, 0.05f)) + (_e2881 * 0.4f)), ((_e2885.y - _e2889.y) * 0.9f), ((_e2894.z - _e2898.z) * 0.6f)));\n                    let _e2906 = i_10;\n                    let _e2908 = global.uMQ[_e2906];\n                    width = _e2908.w;\n                    let _e2912 = width;\n                    let _e2915 = i_10;\n                    let _e2917 = global.uMS[_e2915];\n                    let _e2922 = width;\n                    let _e2923 = dist_1;\n                    near = (1f - smoothstep((_e2912 * (1f - (0.85f * _e2917.x))), _e2922, _e2923));\n                    let _e2927 = i_10;\n                    let _e2929 = global.uPointView;\n                    if (f32(_e2927) == _e2929) {\n                        let _e2931 = near;\n                        pointShow = _e2931;\n                    }\n                    let _e2932 = near;\n                    let _e2933 = i_10;\n                    let _e2935 = mw[_e2933];\n                    k_9 = (_e2932 * _e2935);\n                    let _e2938 = k_9;\n                    if (_e2938 <= 0f) {\n                        continue;\n                    }\n                    let _e2941 = i_10;\n                    let _e2943 = global.uMQ[_e2941];\n                    if (_e2943.x != 0f) {\n                        let _e2947 = d_8;\n                        let _e2948 = i_10;\n                        let _e2950 = global.uMQ[_e2948];\n                        let _e2952 = k_9;\n                        let _e2954 = rotateHue(_e2947, (_e2950.x * _e2952));\n                        d_8 = _e2954;\n                    }\n                    let _e2955 = d_8;\n                    yp_1 = dot(_e2955, W709_);\n                    let _e2958 = yp_1;\n                    let _e2959 = d_8;\n                    let _e2960 = yp_1;\n                    let _e2964 = i_10;\n                    let _e2966 = global.uMQ[_e2964];\n                    let _e2968 = k_9;\n                    d_8 = (vec3(_e2958) + ((_e2959 - vec3(_e2960)) * max((1f + (_e2966.y * _e2968)), 0f)));\n                    let _e2976 = d_8;\n                    let _e2978 = i_10;\n                    let _e2980 = global.uMQ[_e2978];\n                    let _e2984 = k_9;\n                    d_8 = (_e2976 * (1f + ((_e2980.z * 0.8f) * _e2984)));\n                }\n                continuing {\n                    let _e2831 = i_10;\n                    i_10 = (_e2831 + 1i);\n                }\n            }\n        }\n    }\n    let _e2988 = global.uDefringeP;\n    let _e2991 = global.uDefringeG;\n    let _e2995 = LF;\n    if (((_e2988 > 0f) || (_e2991 > 0f)) || (_e2995.x > 0f)) {\n        {\n            let _e3002 = l0_;\n            let _e3003 = p_10;\n            let _e3005 = ring(_e3003, 2f);\n            edge_1 = smoothstep(0.15f, 0.6f, abs((_e3002 - _e3005)));\n            let _e3010 = d_8;\n            let _e3011 = hsv(_e3010);\n            hd = _e3011;\n            let _e3015 = hd;\n            let _e3021 = hd;\n            purple = (smoothstep(240f, 265f, _e3015.x) * (1f - smoothstep(320f, 345f, _e3021.x)));\n            let _e3029 = hd;\n            let _e3035 = hd;\n            green = (smoothstep(75f, 95f, _e3029.x) * (1f - smoothstep(150f, 170f, _e3035.x)));\n            let _e3041 = edge_1;\n            let _e3042 = purple;\n            let _e3043 = global.uDefringeP;\n            let _e3044 = LF;\n            let _e3050 = green;\n            let _e3051 = global.uDefringeG;\n            let _e3052 = LF;\n            k_10 = clamp((_e3041 * ((_e3042 * (_e3043 + max(_e3044.x, 0f))) + (_e3050 * (_e3051 + max(_e3052.x, 0f))))), 0f, 1f);\n            let _e3064 = d_8;\n            yk = dot(_e3064, W709_);\n            let _e3067 = d_8;\n            let _e3068 = yk;\n            let _e3070 = k_10;\n            d_8 = mix(_e3067, vec3(_e3068), vec3(_e3070));\n        }\n    }\n    let _e3073 = global.uBW;\n    if (_e3073 > 0f) {\n        {\n            let _e3076 = d_8;\n            let _e3079 = adj;\n            let _e3081 = chroma_1;\n            yb_2 = (dot(_e3076, W709_) * (1f + ((_e3079.w * _e3081) * 1.2f)));\n            let _e3088 = yb_2;\n            d_8 = vec3(max(_e3088, 0f));\n        }\n    }\n    let _e3092 = global.uGradeOn;\n    if (_e3092 > 0f) {\n        {\n            let _e3095 = d_8;\n            let _e3096 = toOklab(_e3095);\n            lk = _e3096.x;\n            let _e3099 = global.uGradeShape;\n            bl = _e3099.x;\n            let _e3102 = bl;\n            up = max((_e3102 - 0.5f), 0f);\n            let _e3108 = global.uGradeShape;\n            c_25 = (GRADE_C - (_e3108.y * 0.3f));\n            let _e3114 = bl;\n            if (_e3114 >= 0.5f) {\n                let _e3118 = up;\n                local_47 = (1f + (_e3118 * 4f));\n            } else {\n                let _e3123 = bl;\n                local_47 = ((0.1f + (_e3123 * 0.4f)) / 0.3f);\n            }\n            let _e3130 = local_47;\n            w_7 = (GRADE_W * _e3130);\n            let _e3135 = lk;\n            let _e3136 = c_25;\n            let _e3139 = w_7;\n            sh_1 = (1f / (1f + exp((((_e3135 - _e3136) + GRADE_OFF) / _e3139))));\n            let _e3147 = c_25;\n            let _e3149 = lk;\n            let _e3151 = w_7;\n            hi_4 = (1f / (1f + exp((((_e3147 + GRADE_OFF) - _e3149) / _e3151))));\n            let _e3158 = sh_1;\n            let _e3160 = hi_4;\n            mi = clamp(((1f - _e3158) - _e3160), 0f, 1f);\n            let _e3166 = d_8;\n            dd = clamp(_e3166, vec3(0f), vec3(1f));\n            let _e3173 = d_8;\n            let _e3174 = sh_1;\n            let _e3175 = global.uGradeS;\n            let _e3177 = mi;\n            let _e3178 = global.uGradeM;\n            let _e3181 = hi_4;\n            let _e3182 = global.uGradeH;\n            let _e3186 = up;\n            let _e3191 = global.uGradeG;\n            let _e3194 = dd;\n            let _e3197 = dd;\n            d_8 = (_e3173 + ((((((_e3174 * _e3175) + (_e3177 * _e3178)) + (_e3181 * _e3182)) * (1f + (_e3186 * 2f))) + _e3191) * pow(((4f * _e3194) * (vec3(1f) - _e3197)), vec3(0.4262f))));\n            let _e3206 = global.uGradeLum;\n            let _e3208 = sh_1;\n            let _e3210 = global.uGradeLum;\n            let _e3212 = mi;\n            let _e3215 = global.uGradeLum;\n            let _e3217 = hi_4;\n            let _e3220 = global.uGradeLum;\n            lum = ((((_e3206.x * _e3208) + (_e3210.y * _e3212)) + (_e3215.z * _e3217)) + _e3220.w);\n            let _e3224 = lum;\n            if (_e3224 >= 0f) {\n                let _e3229 = d_8;\n                let _e3233 = lum;\n                local_48 = (vec3(1f) - ((vec3(1f) - _e3229) * (1f - (_e3233 * 0.5f))));\n            } else {\n                let _e3240 = d_8;\n                let _e3242 = lum;\n                local_48 = (_e3240 * (1f + (_e3242 * 0.5f)));\n            }\n            let _e3248 = local_48;\n            d_8 = _e3248;\n        }\n    }\n    let _e3249 = global.uLook;\n    if (_e3249.x > 1.5f) {\n        let _e3253 = d_8;\n        let _e3254 = d_8;\n        let _e3255 = lookAt(_e3254);\n        let _e3256 = global.uLook;\n        d_8 = mix(_e3253, _e3255, vec3(_e3256.y));\n    }\n    let _e3260 = global.uVignette;\n    if (_e3260 != 0f) {\n        {\n            let _e3263 = global.uOut2Vig;\n            let _e3264 = frFC;\n            let _e3265 = _e3264.xy;\n            q_7 = (_e3263 * vec3<f32>(_e3265.x, _e3265.y, 1f)).xy;\n            let _e3273 = global.uVigRound;\n            r_3 = _e3273;\n            let _e3275 = q_7;\n            let _e3276 = r_3;\n            if (_e3276 > 0f) {\n                let _e3280 = global.uCropAspect;\n                let _e3281 = r_3;\n                let _e3286 = global.uCropAspect;\n                let _e3289 = r_3;\n                local_49 = (vec2<f32>(mix(1f, _e3280, _e3281), 1f) / vec2(mix(1f, max(_e3286, 1f), _e3289)));\n            } else {\n                local_49 = vec2(1f);\n            }\n            let _e3296 = local_49;\n            qs = (_e3275 * _e3296);\n            let _e3300 = r_3;\n            pw_1 = (2f + (max(-(_e3300), 0f) * 6f));\n            let _e3308 = qs;\n            let _e3311 = pw_1;\n            let _e3313 = qs;\n            let _e3316 = pw_1;\n            let _e3320 = pw_1;\n            dist_2 = pow((pow(abs(_e3308.x), _e3311) + pow(abs(_e3313.y), _e3316)), (1f / _e3320));\n            let _e3325 = global.uVigMid;\n            m0_1 = (1.374f - (_e3325 * 0.9f));\n            let _e3331 = global.uVigFeather;\n            f_5 = (0.08f + (_e3331 * 1.476f));\n            let _e3336 = m0_1;\n            let _e3337 = f_5;\n            let _e3341 = m0_1;\n            let _e3342 = f_5;\n            let _e3346 = dist_2;\n            mask_1 = smoothstep((_e3336 - (_e3337 * 0.5f)), (_e3341 + (_e3342 * 0.5f)), _e3346);\n            let _e3349 = global.uVignette;\n            let _e3351 = mask_1;\n            amt = ((abs(_e3349) * _e3351) * 1.58f);\n            let _e3356 = global.uVigStyle;\n            if (_e3356 > 2.5f) {\n                let _e3359 = d_8;\n                let _e3360 = global.uVignette;\n                if (_e3360 > 0f) {\n                    local_50 = vec3(1f);\n                } else {\n                    local_50 = vec3(0f);\n                }\n                let _e3368 = local_50;\n                let _e3369 = amt;\n                d_8 = mix(_e3359, _e3368, vec3(_e3369));\n            } else {\n                {\n                    let _e3372 = d_8;\n                    d0_ = _e3372;\n                    let _e3374 = global.uVignette;\n                    if (_e3374 > 0f) {\n                        let _e3379 = d_8;\n                        let _e3383 = amt;\n                        local_51 = (vec3(1f) - ((vec3(1f) - _e3379) * (1f - _e3383)));\n                    } else {\n                        let _e3388 = d_8;\n                        let _e3390 = amt;\n                        local_51 = (_e3388 * (1f - _e3390));\n                    }\n                    let _e3394 = local_51;\n                    d_8 = _e3394;\n                    let _e3395 = global.uVigStyle;\n                    if (_e3395 < 1.5f) {\n                        let _e3398 = d_8;\n                        let _e3399 = d0_;\n                        let _e3402 = global.uVigHighlights;\n                        let _e3407 = global.uVigHighlights;\n                        let _e3410 = d0_;\n                        let _e3412 = d0_;\n                        let _e3414 = d0_;\n                        d_8 = mix(_e3398, _e3399, vec3(((0.83f + (0.17f * _e3402)) * smoothstep(mix(0.68f, 0.55f, _e3407), 1f, max(_e3410.x, max(_e3412.y, _e3414.z))))));\n                    } else {\n                        let _e3422 = d_8;\n                        let _e3423 = d0_;\n                        let _e3424 = global.uVigHighlights;\n                        let _e3429 = d0_;\n                        let _e3431 = d0_;\n                        let _e3433 = d0_;\n                        d_8 = mix(_e3422, _e3423, vec3(((_e3424 * 0.5f) * smoothstep(0.7f, 1f, max(_e3429.x, max(_e3431.y, _e3433.z))))));\n                    }\n                }\n            }\n        }\n    }\n    let _e3441 = global.uGrain;\n    let _e3443 = LE;\n    grainAmt = (_e3441.x + _e3443.x);\n    let _e3447 = grainAmt;\n    if (_e3447 > 0f) {\n        {\n            let _e3450 = LE;\n            let _e3452 = grainAmt;\n            t_9 = (_e3450.x / _e3452);\n            let _e3455 = global.uGrain;\n            let _e3457 = LE;\n            let _e3459 = LE;\n            let _e3464 = t_9;\n            size = mix(_e3455.y, (_e3457.y / max(_e3459.x, 0.0001f)), _e3464);\n            let _e3467 = global.uGrain;\n            let _e3469 = LE;\n            let _e3471 = LE;\n            let _e3476 = t_9;\n            rough = mix(_e3467.z, (_e3469.z / max(_e3471.x, 0.0001f)), _e3476);\n            let _e3479 = ori;\n            let _e3480 = size;\n            g_2 = (_e3479 / vec2(_e3480));\n            let _e3484 = g_2;\n            let _e3485 = vnoise(_e3484);\n            nz = (_e3485 - 0.5f);\n            let _e3489 = nz;\n            let _e3490 = g_2;\n            let _e3496 = vnoise(((_e3490 * 2.3f) + vec2(17f)));\n            let _e3499 = rough;\n            nz = mix(_e3489, (_e3496 - 0.5f), (_e3499 * 0.6f));\n            let _e3503 = d_8;\n            yg_1 = dot(_e3503, W709_);\n            let _e3506 = d_8;\n            let _e3507 = nz;\n            let _e3508 = grainAmt;\n            let _e3517 = yg_1;\n            d_8 = (_e3506 + vec3((((_e3507 * min(_e3508, 1.5f)) * 0.35f) * (0.3f + (0.7f * (1f - abs(((_e3517 * 2f) - 1f))))))));\n        }\n    }\n    let _e3529 = global.uMelissa;\n    if (_e3529 > 0.5f) {\n        let _e3532 = d_8;\n        let _e3533 = decodeS(_e3532);\n        let _e3540 = encode(clamp((SRGB_TO_PP * _e3533), vec3(0f), vec3(1f)));\n        local_52 = _e3540;\n    } else {\n        let _e3541 = d_8;\n        let _e3542 = gamutIn(_e3541);\n        local_52 = _e3542;\n    }\n    let _e3544 = local_52;\n    d_8 = _e3544;\n    let _e3545 = global.uMaskView;\n    if (_e3545 >= 0f) {\n        {\n            let _e3548 = shownW;\n            let _e3549 = fwidth(_e3548);\n            let _e3552 = global.uMaskLine;\n            fw = (max(_e3549, 0.0001f) * _e3552);\n            let _e3557 = fw;\n            let _e3558 = shownW;\n            edge_2 = (1f - smoothstep(0f, _e3557, abs((_e3558 - 0.5f))));\n            let _e3567 = fw;\n            let _e3570 = shownW;\n            let _e3578 = fw;\n            let _e3581 = shownW;\n            soft = (max((1f - smoothstep(0f, (_e3567 * 0.7f), abs((_e3570 - 0.08f)))), (1f - smoothstep(0f, (_e3578 * 0.7f), abs((_e3581 - 0.92f))))) * 0.55f);\n            let _e3591 = soft;\n            let _e3593 = shownW;\n            let _e3594 = fwidth(_e3593);\n            let _e3596 = global.uMaskFeather;\n            soft = (_e3591 * (step(0.002f, _e3594) * _e3596));\n            let _e3599 = edge_2;\n            let _e3600 = soft;\n            lines = max(_e3599, _e3600);\n            let _e3603 = global.uMaskStyle;\n            if (_e3603 < 0.5f) {\n                let _e3606 = d_8;\n                let _e3607 = global.uMaskColor;\n                let _e3608 = shownW;\n                let _e3609 = global.uMaskOpacity;\n                d_8 = mix(_e3606, _e3607, vec3((_e3608 * _e3609)));\n            } else {\n                let _e3613 = global.uMaskStyle;\n                if (_e3613 < 1.5f) {\n                    let _e3616 = d_8;\n                    let _e3617 = global.uMaskColor;\n                    let _e3618 = shownW;\n                    let _e3619 = global.uMaskOpacity;\n                    let _e3625 = global.uMaskColor;\n                    let _e3626 = lines;\n                    d_8 = mix(mix(_e3616, _e3617, vec3(((_e3618 * _e3619) * 0.6f))), _e3625, vec3(_e3626));\n                } else {\n                    let _e3629 = global.uMaskStyle;\n                    if (_e3629 < 2.5f) {\n                        let _e3632 = d_8;\n                        let _e3633 = global.uMaskColor;\n                        let _e3634 = lines;\n                        let _e3635 = global.uMaskOpacity;\n                        d_8 = mix(_e3632, _e3633, vec3((_e3634 * max(_e3635, 0.35f))));\n                    } else {\n                        let _e3641 = global.uMaskStyle;\n                        if (_e3641 < 3.5f) {\n                            let _e3644 = shownW;\n                            d_8 = vec3(_e3644);\n                        } else {\n                            let _e3646 = d_8;\n                            let _e3647 = shownW;\n                            d_8 = (_e3646 * _e3647);\n                        }\n                    }\n                }\n            }\n        }\n    }\n    let _e3649 = pointShow;\n    if (_e3649 >= 0f) {\n        let _e3652 = d_8;\n        let _e3657 = d_8;\n        let _e3658 = pointShow;\n        d_8 = mix(vec3((dot(_e3652, W709_) * 0.6f)), _e3657, vec3(_e3658));\n    }\n    let _e3661 = global.uShowClip;\n    if (_e3661 > 0f) {\n        {\n            let _e3664 = d_8;\n            let _e3666 = d_8;\n            let _e3668 = d_8;\n            if (max(_e3664.x, max(_e3666.y, _e3668.z)) >= 0.998f) {\n                d_8 = vec3<f32>(1f, 0.15f, 0.2f);\n            } else {\n                let _e3678 = d_8;\n                let _e3680 = d_8;\n                let _e3682 = d_8;\n                if (max(_e3678.x, max(_e3680.y, _e3682.z)) <= 0.004f) {\n                    d_8 = vec3<f32>(0.2f, 0.45f, 1f);\n                }\n            }\n        }\n    }\n    let _e3692 = d_8;\n    o_4 = vec4<f32>(_e3692.x, _e3692.y, _e3692.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e377 = o_4;\n    return FragmentOutput(_e377);\n}\n",
  "size": 3712,
  "uniforms": {
   "uWB": [
    0,
    "vec3",
    0
   ],
   "uCam": [
    16,
    "mat3",
    0
   ],
   "uPicture": [
    64,
    "float",
    0
   ],
   "uNoise": [
    80,
    "vec4",
    3
   ],
   "uHiRect": [
    128,
    "vec4",
    0
   ],
   "uHiSafe": [
    144,
    "vec4",
    0
   ],
   "uChromaPx": [
    160,
    "vec2",
    0
   ],
   "uGlowMix": [
    176,
    "vec4",
    0
   ],
   "uGlowF": [
    192,
    "vec4",
    0
   ],
   "uGlowF2": [
    208,
    "vec4",
    0
   ],
   "uLook": [
    224,
    "vec2",
    0
   ],
   "uOut2Ori": [
    240,
    "mat3",
    0
   ],
   "uOri2Photo": [
    288,
    "mat3",
    0
   ],
   "uOut2Crop": [
    336,
    "mat3",
    0
   ],
   "uOriCenter": [
    384,
    "vec2",
    0
   ],
   "uOriHalf": [
    392,
    "float",
    0
   ],
   "uCornerR2": [
    396,
    "float",
    0
   ],
   "uPersp": [
    400,
    "mat3",
    0
   ],
   "uDistort": [
    448,
    "float",
    0
   ],
   "uLensK": [
    464,
    "vec4",
    0
   ],
   "uLensC": [
    480,
    "vec2",
    0
   ],
   "uLensN": [
    488,
    "vec2",
    0
   ],
   "uLensVig": [
    496,
    "float",
    0
   ],
   "uLensVigMid": [
    500,
    "float",
    0
   ],
   "uDefringeP": [
    504,
    "float",
    0
   ],
   "uDefringeG": [
    508,
    "float",
    0
   ],
   "uShadowTint": [
    512,
    "float",
    0
   ],
   "uPhotoPx": [
    520,
    "vec2",
    0
   ],
   "uOut2Vig": [
    528,
    "mat3",
    0
   ],
   "uCropAspect": [
    576,
    "float",
    0
   ],
   "uBg": [
    592,
    "vec3",
    0
   ],
   "uExposure": [
    604,
    "float",
    0
   ],
   "uContrast": [
    608,
    "float",
    0
   ],
   "uContrastSat": [
    612,
    "float",
    0
   ],
   "uConPivot": [
    616,
    "float",
    0
   ],
   "uToneMap": [
    620,
    "float",
    0
   ],
   "uTmA": [
    624,
    "vec4",
    0
   ],
   "uTmB": [
    640,
    "vec4",
    0
   ],
   "uTmHue": [
    656,
    "float",
    0
   ],
   "uHighlights": [
    660,
    "float",
    0
   ],
   "uShadows": [
    664,
    "float",
    0
   ],
   "uWhites": [
    668,
    "float",
    0
   ],
   "uBlacks": [
    672,
    "float",
    0
   ],
   "uHlTop": [
    676,
    "float",
    0
   ],
   "uTexture": [
    680,
    "float",
    0
   ],
   "uClarity": [
    684,
    "float",
    0
   ],
   "uDehaze": [
    688,
    "float",
    0
   ],
   "uVibrance": [
    692,
    "float",
    0
   ],
   "uSaturation": [
    696,
    "float",
    0
   ],
   "uAirY": [
    700,
    "float",
    0
   ],
   "uSharpen": [
    704,
    "float",
    0
   ],
   "uSharpenRadius": [
    708,
    "float",
    0
   ],
   "uSharpenDetail": [
    712,
    "float",
    0
   ],
   "uSharpenMasking": [
    716,
    "float",
    0
   ],
   "uChromaOn": [
    720,
    "float",
    0
   ],
   "uNoiseFull": [
    724,
    "float",
    0
   ],
   "uNrLum": [
    728,
    "float",
    0
   ],
   "uNrColor": [
    732,
    "float",
    0
   ],
   "uNrLumDetail": [
    736,
    "float",
    0
   ],
   "uNrLumContrast": [
    740,
    "float",
    0
   ],
   "uNrColorDetail": [
    744,
    "float",
    0
   ],
   "uNrColorSmooth": [
    748,
    "float",
    0
   ],
   "uVignette": [
    752,
    "float",
    0
   ],
   "uVigMid": [
    756,
    "float",
    0
   ],
   "uVigRound": [
    760,
    "float",
    0
   ],
   "uVigFeather": [
    764,
    "float",
    0
   ],
   "uVigStyle": [
    768,
    "float",
    0
   ],
   "uVigHighlights": [
    772,
    "float",
    0
   ],
   "uRefineSat": [
    776,
    "float",
    0
   ],
   "uBW": [
    780,
    "float",
    0
   ],
   "uGradeS": [
    784,
    "vec3",
    0
   ],
   "uGradeM": [
    800,
    "vec3",
    0
   ],
   "uGradeH": [
    816,
    "vec3",
    0
   ],
   "uGradeG": [
    832,
    "vec3",
    0
   ],
   "uGradeLum": [
    848,
    "vec4",
    0
   ],
   "uGradeShape": [
    864,
    "vec2",
    0
   ],
   "uGradeOn": [
    872,
    "float",
    0
   ],
   "uGrain": [
    880,
    "vec3",
    0
   ],
   "uShowClip": [
    892,
    "float",
    0
   ],
   "uMelissa": [
    896,
    "float",
    0
   ],
   "uOriSize": [
    904,
    "vec2",
    0
   ],
   "uMaskN": [
    912,
    "float",
    0
   ],
   "uMA": [
    928,
    "vec4",
    16
   ],
   "uMB": [
    1184,
    "vec4",
    16
   ],
   "uMC": [
    1440,
    "vec4",
    16
   ],
   "uMD": [
    1696,
    "vec4",
    16
   ],
   "uMR": [
    1952,
    "vec4",
    16
   ],
   "uME": [
    2208,
    "vec4",
    16
   ],
   "uMF": [
    2464,
    "vec4",
    16
   ],
   "uMP": [
    2720,
    "vec4",
    16
   ],
   "uMQ": [
    2976,
    "vec4",
    16
   ],
   "uMS": [
    3232,
    "vec4",
    16
   ],
   "uDcp": [
    3488,
    "float",
    0
   ],
   "uBaseSat": [
    3492,
    "float",
    0
   ],
   "uHsmDims": [
    3504,
    "vec4",
    0
   ],
   "uLookADims": [
    3520,
    "vec4",
    0
   ],
   "uLookBDims": [
    3536,
    "vec4",
    0
   ],
   "uS2P": [
    3552,
    "mat3",
    0
   ],
   "uP2S": [
    3600,
    "mat3",
    0
   ],
   "uPointView": [
    3648,
    "float",
    0
   ],
   "uMaskView": [
    3652,
    "float",
    0
   ],
   "uMaskColor": [
    3664,
    "vec3",
    0
   ],
   "uMaskOpacity": [
    3676,
    "float",
    0
   ],
   "uMaskStyle": [
    3680,
    "float",
    0
   ],
   "uMaskLine": [
    3684,
    "float",
    0
   ],
   "uMaskFeather": [
    3688,
    "float",
    0
   ],
   "frFlip": [
    3692,
    "float",
    0
   ],
   "frH": [
    3696,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uSrc",
    1,
    2,
    true
   ],
   [
    "uHi",
    3,
    4,
    true
   ],
   [
    "uGuide",
    5,
    6,
    true
   ],
   [
    "uChroma",
    7,
    8,
    true
   ],
   [
    "uGlow",
    9,
    10,
    true
   ],
   [
    "uCurve",
    11,
    12,
    true
   ],
   [
    "uHue",
    13,
    14,
    true
   ],
   [
    "uMask0",
    15,
    16,
    true
   ],
   [
    "uMask1",
    17,
    18,
    true
   ],
   [
    "uMask2",
    19,
    20,
    true
   ],
   [
    "uMask3",
    21,
    22,
    true
   ],
   [
    "uHsm",
    23,
    24,
    false
   ],
   [
    "uLookA",
    25,
    26,
    false
   ],
   [
    "uLookB",
    27,
    28,
    false
   ],
   [
    "uTone",
    29,
    30,
    false
   ]
  ],
  "nearest": 31
 },
 "copy": {
  "hash": "fadd0713",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uRect: vec4<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n\n    let _e11 = gl_FragCoord_1;\n    let _e13 = global.frFlip;\n    if (_e13 > 0.5f) {\n        let _e16 = global.frH;\n        let _e17 = gl_FragCoord_1;\n        local = (_e16 - _e17.y);\n    } else {\n        let _e20 = gl_FragCoord_1;\n        local = _e20.y;\n    }\n    let _e23 = local;\n    let _e24 = gl_FragCoord_1;\n    let _e25 = _e24.zw;\n    frFC = vec4<f32>(_e11.x, _e23, _e25.x, _e25.y);\n    let _e29 = frFC;\n    let _e31 = global.uRect;\n    let _e34 = global.uRect;\n    let _e37 = textureSample(uTex, uTex_s, ((_e29.xy - _e31.xy) / _e34.zw));\n    o = _e37;\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e17 = o;\n    return FragmentOutput(_e17);\n}\n",
  "size": 32,
  "uniforms": {
   "uRect": [
    0,
    "vec4",
    0
   ],
   "frFlip": [
    16,
    "float",
    0
   ],
   "frH": [
    20,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "resample": {
  "hash": "1a0c19af",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uRect: vec4<f32>,\n    uScale: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn lz(x: f32) -> f32 {\n    var x_1: f32;\n    var px: f32;\n\n    x_1 = x;\n    let _e14 = x_1;\n    x_1 = abs(_e14);\n    let _e16 = x_1;\n    if (_e16 < 0.0001f) {\n        return 1f;\n    }\n    let _e20 = x_1;\n    if (_e20 >= 2f) {\n        return 0f;\n    }\n    let _e25 = x_1;\n    px = (3.1415927f * _e25);\n    let _e29 = px;\n    let _e32 = px;\n    let _e37 = px;\n    let _e38 = px;\n    return (((2f * sin(_e29)) * sin((_e32 * 0.5f))) / (_e37 * _e38));\n}\n\nfn main_1() {\n    var local: f32;\n    var lev: f32;\n    var s: f32;\n    var size: vec2<f32>;\n    var c: vec2<f32>;\n    var b: vec2<f32>;\n    var acc: vec4<f32> = vec4(0f);\n    var wsum: f32 = 0f;\n    var j: i32 = -6i;\n    var wy: f32;\n    var i: i32;\n    var wx: f32;\n    var t: vec2<f32>;\n\n    let _e13 = gl_FragCoord_1;\n    let _e15 = global.frFlip;\n    if (_e15 > 0.5f) {\n        let _e18 = global.frH;\n        let _e19 = gl_FragCoord_1;\n        local = (_e18 - _e19.y);\n    } else {\n        let _e22 = gl_FragCoord_1;\n        local = _e22.y;\n    }\n    let _e25 = local;\n    let _e26 = gl_FragCoord_1;\n    let _e27 = _e26.zw;\n    frFC = vec4<f32>(_e13.x, _e25, _e27.x, _e27.y);\n    let _e32 = global.uScale;\n    lev = max(0f, floor(log2((_e32 / 1.5f))));\n    let _e39 = global.uScale;\n    let _e40 = lev;\n    s = (_e39 / exp2(_e40));\n    let _e44 = lev;\n    let _e46 = textureDimensions(uTex, i32(_e44));\n    size = vec2<f32>(vec2<i32>(_e46));\n    let _e50 = frFC;\n    let _e52 = global.uRect;\n    let _e55 = global.uRect;\n    let _e58 = size;\n    c = ((((_e50.xy - _e52.xy) / _e55.zw) * _e58) - vec2(0.5f));\n    let _e64 = c;\n    b = floor(_e64);\n    loop {\n        let _e75 = j;\n        if !((_e75 <= 6i)) {\n            break;\n        }\n        {\n            let _e82 = b;\n            let _e84 = j;\n            let _e87 = c;\n            let _e90 = s;\n            let _e92 = lz((((_e82.y + f32(_e84)) - _e87.y) / _e90));\n            wy = _e92;\n            let _e94 = wy;\n            if (_e94 == 0f) {\n                continue;\n            }\n            i = -6i;\n            loop {\n                let _e100 = i;\n                if !((_e100 <= 6i)) {\n                    break;\n                }\n                {\n                    let _e107 = b;\n                    let _e109 = i;\n                    let _e112 = c;\n                    let _e115 = s;\n                    let _e117 = lz((((_e107.x + f32(_e109)) - _e112.x) / _e115));\n                    wx = _e117;\n                    let _e119 = wx;\n                    if (_e119 == 0f) {\n                        continue;\n                    }\n                    let _e122 = b;\n                    let _e123 = i;\n                    let _e125 = j;\n                    let _e131 = size;\n                    t = clamp((_e122 + vec2<f32>(f32(_e123), f32(_e125))), vec2(0f), (_e131 - vec2(1f)));\n                    let _e137 = acc;\n                    let _e138 = wx;\n                    let _e139 = wy;\n                    let _e141 = t;\n                    let _e143 = lev;\n                    let _e145 = textureLoad(uTex, vec2<i32>(_e141), i32(_e143));\n                    acc = (_e137 + ((_e138 * _e139) * _e145));\n                    let _e148 = wsum;\n                    let _e149 = wx;\n                    let _e150 = wy;\n                    wsum = (_e148 + (_e149 * _e150));\n                }\n                continuing {\n                    let _e104 = i;\n                    i = (_e104 + 1i);\n                }\n            }\n        }\n        continuing {\n            let _e79 = j;\n            j = (_e79 + 1i);\n        }\n    }\n    let _e153 = acc;\n    let _e154 = wsum;\n    o = clamp((_e153 / vec4(_e154)), vec4(0f), vec4(1f));\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e19 = o;\n    return FragmentOutput(_e19);\n}\n",
  "size": 32,
  "uniforms": {
   "uRect": [
    0,
    "vec4",
    0
   ],
   "uScale": [
    16,
    "float",
    0
   ],
   "frFlip": [
    20,
    "float",
    0
   ],
   "frH": [
    24,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ]
  ],
  "nearest": 0
 },
 "display": {
  "hash": "c94078f0",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uDispM: mat3x3<f32>,\n    uSize: vec2<f32>,\n    uLutN: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uLut: texture_2d<f32>;\n@group(0) @binding(4) \nvar uLut_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn decodeS(v: vec3<f32>) -> vec3<f32> {\n    var v_1: vec3<f32>;\n\n    v_1 = v;\n    let _e18 = v_1;\n    let _e22 = v_1;\n    let _e36 = v_1;\n    return mix((_e18 / vec3(12.92f)), pow(((max(_e22, vec3(0f)) + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), step(vec3(0.04045f), _e36));\n}\n\nfn lut(t: f32, c: i32) -> f32 {\n    var t_1: f32;\n    var c_1: i32;\n\n    t_1 = t;\n    c_1 = c;\n    let _e20 = c_1;\n    let _e21 = t_1;\n    let _e22 = global.uLutN;\n    let _e28 = global.uLutN;\n    let _e32 = textureSample(uLut, uLut_s, vec2<f32>((((_e21 * (_e22 - 1f)) + 0.5f) / _e28), 0.5f));\n    return _e32[_e20];\n}\n\nfn main_1() {\n    var local: f32;\n    var lin: vec3<f32>;\n    var t_2: vec3<f32>;\n    var v_2: vec3<f32>;\n    var n: f32;\n\n    let _e17 = gl_FragCoord_1;\n    let _e19 = global.frFlip;\n    if (_e19 > 0.5f) {\n        let _e22 = global.frH;\n        let _e23 = gl_FragCoord_1;\n        local = (_e22 - _e23.y);\n    } else {\n        let _e26 = gl_FragCoord_1;\n        local = _e26.y;\n    }\n    let _e29 = local;\n    let _e30 = gl_FragCoord_1;\n    let _e31 = _e30.zw;\n    frFC = vec4<f32>(_e17.x, _e29, _e31.x, _e31.y);\n    let _e35 = global.uDispM;\n    let _e36 = frFC;\n    let _e38 = global.uSize;\n    let _e40 = textureSample(uTex, uTex_s, (_e36.xy / _e38));\n    let _e42 = decodeS(_e40.xyz);\n    lin = clamp((_e35 * _e42), vec3(0f), vec3(1f));\n    let _e50 = lin;\n    t_2 = sqrt(_e50);\n    let _e53 = t_2;\n    let _e56 = lut(_e53.x, 0i);\n    let _e57 = t_2;\n    let _e60 = lut(_e57.y, 1i);\n    let _e61 = t_2;\n    let _e64 = lut(_e61.z, 2i);\n    v_2 = vec3<f32>(_e56, _e60, _e64);\n    let _e67 = frFC;\n    n = (fract((sin(dot(_e67.xy, vec2<f32>(12.9898f, 78.233f))) * 43758.547f)) - 0.5f);\n    let _e80 = v_2;\n    let _e81 = n;\n    let _e85 = (_e80 + vec3((_e81 / 255f)));\n    o = vec4<f32>(_e85.x, _e85.y, _e85.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 80,
  "uniforms": {
   "uDispM": [
    0,
    "mat3",
    0
   ],
   "uSize": [
    48,
    "vec2",
    0
   ],
   "uLutN": [
    56,
    "float",
    0
   ],
   "frFlip": [
    60,
    "float",
    0
   ],
   "frH": [
    64,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ],
   [
    "uLut",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "glowSrc": {
  "hash": "608d640b",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uPicture: f32,\n    uOutSize: vec2<f32>,\n    uGlowGain: f32,\n    uGlowMode: f32,\n    uGlowW: vec4<f32>,\n    uDcp: f32,\n    uContrast: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\n@group(0) @binding(3) \nvar uTone: texture_2d<f32>;\n@group(0) @binding(4) \nvar uTone_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e30 = cam_1;\n    c = max(_e30, vec3(0f));\n    let _e35 = cam_1;\n    let _e36 = global.uWB;\n    bal = min((_e35 * _e36), vec3(1f));\n    let _e44 = c;\n    let _e46 = c;\n    let _e48 = c;\n    let _e54 = global.uPicture;\n    clip = (smoothstep(0.88f, 0.97f, max(_e44.x, max(_e46.y, _e48.z))) * (1f - _e54));\n    let _e58 = bal;\n    let _e59 = bal;\n    let _e61 = bal;\n    let _e63 = bal;\n    let _e68 = clip;\n    bal = mix(_e58, vec3(max(_e59.x, max(_e61.y, _e63.z))), vec3(_e68));\n    let _e71 = global.uCam;\n    let _e72 = bal;\n    return (_e71 * _e72);\n}\n\nfn shown(y: f32) -> f32 {\n    var y_1: f32;\n    var t: f32;\n    var n: i32;\n    var p: f32;\n    var i: i32;\n    var local: f32;\n    var local_1: f32;\n    var d: f32;\n    var local_2: f32;\n\n    y_1 = y;\n    let _e32 = global.uDcp;\n    if (_e32 > 0.5f) {\n        {\n            let _e36 = textureDimensions(uTone, 0i);\n            n = vec2<i32>(_e36).x;\n            let _e40 = y_1;\n            let _e44 = n;\n            p = (clamp(_e40, 0f, 1f) * f32((_e44 - 1i)));\n            let _e50 = p;\n            let _e52 = n;\n            i = min(i32(_e50), (_e52 - 2i));\n            let _e57 = i;\n            let _e61 = textureLoad(uTone, vec2<i32>(_e57, 0i), 0i);\n            let _e63 = i;\n            let _e69 = textureLoad(uTone, vec2<i32>((_e63 + 1i), 0i), 0i);\n            let _e71 = p;\n            let _e72 = i;\n            t = mix(_e61.x, _e69.x, (_e71 - f32(_e72)));\n        }\n    } else {\n        let _e76 = y_1;\n        if (_e76 < 0.72f) {\n            let _e79 = y_1;\n            local = _e79;\n        } else {\n            let _e83 = y_1;\n            local = (0.72f + (0.28f * (1f - exp((-((_e83 - 0.72f)) / 0.28f)))));\n        }\n        let _e94 = local;\n        t = _e94;\n    }\n    let _e95 = t;\n    if (_e95 <= 0.0031308f) {\n        let _e98 = t;\n        local_1 = (_e98 * 12.92f);\n    } else {\n        let _e102 = t;\n        local_1 = ((1.055f * pow(_e102, 0.41666666f)) - 0.055f);\n    }\n    let _e111 = local_1;\n    d = _e111;\n    let _e113 = d;\n    let _e114 = global.uContrast;\n    let _e115 = d;\n    let _e116 = d;\n    let _e120 = d;\n    let _e124 = d;\n    d = clamp((_e113 + (_e114 * (((_e115 * _e116) * (3f - (2f * _e120))) - _e124))), 0f, 1f);\n    let _e131 = d;\n    if (_e131 <= 0.04045f) {\n        let _e134 = d;\n        local_2 = (_e134 / 12.92f);\n    } else {\n        let _e137 = d;\n        local_2 = pow(((_e137 + 0.055f) / 1.055f), 2.4f);\n    }\n    let _e145 = local_2;\n    return _e145;\n}\n\nfn main_1() {\n    var local_3: f32;\n    var cell: vec2<f32>;\n    var foot: f32;\n    var sum: vec3<f32> = vec3(0f);\n    var j: i32 = 0i;\n    var i_1: i32;\n    var uv: vec2<f32>;\n    var l: vec3<f32>;\n    var c_1: vec3<f32>;\n    var y_2: f32;\n    var y_3: f32;\n    var y_4: f32;\n\n    let _e30 = gl_FragCoord_1;\n    let _e32 = global.frFlip;\n    if (_e32 > 0.5f) {\n        let _e35 = global.frH;\n        let _e36 = gl_FragCoord_1;\n        local_3 = (_e35 - _e36.y);\n    } else {\n        let _e39 = gl_FragCoord_1;\n        local_3 = _e39.y;\n    }\n    let _e42 = local_3;\n    let _e43 = gl_FragCoord_1;\n    let _e44 = _e43.zw;\n    frFC = vec4<f32>(_e30.x, _e42, _e44.x, _e44.y);\n    let _e49 = global.uOutSize;\n    cell = (vec2(1f) / _e49);\n    let _e53 = global.uGlowW;\n    foot = _e53.w;\n    loop {\n        let _e61 = j;\n        if !((_e61 < 6i)) {\n            break;\n        }\n        i_1 = 0i;\n        loop {\n            let _e70 = i_1;\n            if !((_e70 < 6i)) {\n                break;\n            }\n            {\n                let _e77 = frFC;\n                let _e79 = i_1;\n                let _e81 = j;\n                let _e93 = foot;\n                let _e96 = cell;\n                uv = ((_e77.xy + ((((vec2<f32>(f32(_e79), f32(_e81)) + vec2(0.5f)) / vec2(6f)) - vec2(0.5f)) * _e93)) * _e96);\n                let _e99 = global.uCam;\n                let _e100 = uv;\n                let _e101 = textureSample(uSrc, uSrc_s, _e100);\n                let _e106 = global.uWB;\n                let _e112 = global.uGlowGain;\n                l = max(((_e99 * min((max(_e101.xyz, vec3(0f)) * _e106), vec3(1f))) * _e112), vec3(0f));\n                let _e118 = l;\n                let _e121 = l;\n                l = (_e118 * min(1f, (1f / max(dot(_e121, W709_), 0.00001f))));\n                let _e128 = sum;\n                let _e129 = l;\n                sum = (_e128 + _e129);\n            }\n            continuing {\n                let _e74 = i_1;\n                i_1 = (_e74 + 1i);\n            }\n        }\n        continuing {\n            let _e65 = j;\n            j = (_e65 + 1i);\n        }\n    }\n    let _e131 = sum;\n    c_1 = (_e131 / vec3(36f));\n    let _e136 = global.uGlowMode;\n    if (_e136 < 1.5f) {\n        {\n            let _e139 = c_1;\n            y_2 = dot(_e139, W709_);\n            let _e142 = y_2;\n            if (_e142 > 0.00001f) {\n                let _e145 = c_1;\n                let _e146 = y_2;\n                let _e147 = shown(_e146);\n                let _e148 = y_2;\n                c_1 = (_e145 * (_e147 / _e148));\n            }\n        }\n    }\n    let _e151 = global.uGlowMode;\n    if (_e151 < 0.5f) {\n        {\n            let _e154 = c_1;\n            y_3 = clamp(dot(_e154, W709_), 0f, 1f);\n            let _e160 = c_1;\n            let _e161 = global.uGlowW;\n            let _e163 = global.uGlowW;\n            let _e165 = y_3;\n            let _e168 = global.uGlowW;\n            let _e171 = y_3;\n            let _e176 = global.uGlowW;\n            c_1 = (_e160 * (_e161.z * pow(max(((_e163.x * _e165) / ((1f + _e168.x) - _e171)), 0f), _e176.y)));\n        }\n    } else {\n        let _e181 = global.uGlowMode;\n        if (_e181 < 1.5f) {\n            {\n                let _e184 = c_1;\n                y_4 = clamp(dot(_e184, W709_), 0f, 1f);\n                let _e190 = y_4;\n                let _e191 = global.uGlowW;\n                let _e195 = global.uGlowW;\n                let _e202 = global.uGlowW;\n                c_1 = vec3(pow(clamp(((_e190 - _e191.x) / (1f - _e195.x)), 0f, 1f), _e202.y));\n            }\n        }\n    }\n    let _e206 = c_1;\n    o = vec4<f32>(_e206.x, _e206.y, _e206.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e39 = o;\n    return FragmentOutput(_e39);\n}\n",
  "size": 128,
  "uniforms": {
   "uWB": [
    0,
    "vec3",
    0
   ],
   "uCam": [
    16,
    "mat3",
    0
   ],
   "uPicture": [
    64,
    "float",
    0
   ],
   "uOutSize": [
    72,
    "vec2",
    0
   ],
   "uGlowGain": [
    80,
    "float",
    0
   ],
   "uGlowMode": [
    84,
    "float",
    0
   ],
   "uGlowW": [
    96,
    "vec4",
    0
   ],
   "uDcp": [
    112,
    "float",
    0
   ],
   "uContrast": [
    116,
    "float",
    0
   ],
   "frFlip": [
    120,
    "float",
    0
   ],
   "frH": [
    124,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uSrc",
    1,
    2,
    true
   ],
   [
    "uTone",
    3,
    4,
    false
   ]
  ],
  "nearest": 0
 },
 "glowDown": {
  "hash": "e90c3897",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOutSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var uv: vec2<f32>;\n    var px: vec2<f32>;\n\n    let _e11 = gl_FragCoord_1;\n    let _e13 = global.frFlip;\n    if (_e13 > 0.5f) {\n        let _e16 = global.frH;\n        let _e17 = gl_FragCoord_1;\n        local = (_e16 - _e17.y);\n    } else {\n        let _e20 = gl_FragCoord_1;\n        local = _e20.y;\n    }\n    let _e23 = local;\n    let _e24 = gl_FragCoord_1;\n    let _e25 = _e24.zw;\n    frFC = vec4<f32>(_e11.x, _e23, _e25.x, _e25.y);\n    let _e29 = frFC;\n    let _e31 = global.uOutSize;\n    uv = (_e29.xy / _e31);\n    let _e36 = textureDimensions(uTex, 0i);\n    px = (vec2(0.5f) / vec2<f32>(vec2<i32>(_e36)));\n    let _e43 = uv;\n    let _e44 = px;\n    let _e47 = px;\n    let _e52 = textureSample(uTex, uTex_s, (_e43 + vec2<f32>(-(_e44.x), -(_e47.y))));\n    let _e53 = uv;\n    let _e54 = px;\n    let _e56 = px;\n    let _e61 = textureSample(uTex, uTex_s, (_e53 + vec2<f32>(_e54.x, -(_e56.y))));\n    let _e63 = uv;\n    let _e64 = px;\n    let _e67 = px;\n    let _e71 = textureSample(uTex, uTex_s, (_e63 + vec2<f32>(-(_e64.x), _e67.y)));\n    let _e73 = uv;\n    let _e74 = px;\n    let _e76 = px;\n    let _e80 = textureSample(uTex, uTex_s, (_e73 + vec2<f32>(_e74.x, _e76.y)));\n    o = (0.25f * (((_e52 + _e61) + _e71) + _e80));\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e17 = o;\n    return FragmentOutput(_e17);\n}\n",
  "size": 16,
  "uniforms": {
   "uOutSize": [
    0,
    "vec2",
    0
   ],
   "frFlip": [
    8,
    "float",
    0
   ],
   "frH": [
    12,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "glowLine": {
  "hash": "6c36e48e",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uStep: vec2<f32>,\n    uLen: f32,\n    uOneSided: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var uv: vec2<f32>;\n    var reach: f32;\n    var stepT: f32;\n    var sum: vec4<f32> = vec4(0f);\n    var wsum: f32 = 0f;\n    var i: i32 = -96i;\n    var d: f32;\n    var w: f32;\n\n    let _e15 = gl_FragCoord_1;\n    let _e17 = global.frFlip;\n    if (_e17 > 0.5f) {\n        let _e20 = global.frH;\n        let _e21 = gl_FragCoord_1;\n        local = (_e20 - _e21.y);\n    } else {\n        let _e24 = gl_FragCoord_1;\n        local = _e24.y;\n    }\n    let _e27 = local;\n    let _e28 = gl_FragCoord_1;\n    let _e29 = _e28.zw;\n    frFC = vec4<f32>(_e15.x, _e27, _e29.x, _e29.y);\n    let _e33 = frFC;\n    let _e36 = textureDimensions(uTex, 0i);\n    uv = (_e33.xy / vec2<f32>(vec2<i32>(_e36)));\n    let _e41 = global.uLen;\n    reach = (_e41 * 4f);\n    let _e46 = reach;\n    stepT = max(1f, (_e46 / 96f));\n    loop {\n        let _e59 = i;\n        if !((_e59 <= 96i)) {\n            break;\n        }\n        {\n            let _e66 = i;\n            let _e68 = stepT;\n            d = (f32(_e66) * _e68);\n            let _e71 = d;\n            let _e73 = reach;\n            if (abs(_e71) > _e73) {\n                continue;\n            }\n            let _e75 = global.uOneSided;\n            let _e78 = d;\n            if ((_e75 > 0.5f) && (_e78 < 0f)) {\n                continue;\n            }\n            let _e82 = d;\n            let _e85 = global.uLen;\n            w = exp((-(abs(_e82)) / max(_e85, 0.001f)));\n            let _e91 = sum;\n            let _e92 = uv;\n            let _e93 = global.uStep;\n            let _e94 = d;\n            let _e97 = textureSample(uTex, uTex_s, (_e92 - (_e93 * _e94)));\n            let _e98 = w;\n            sum = (_e91 + (_e97 * _e98));\n            let _e101 = wsum;\n            let _e102 = w;\n            wsum = (_e101 + _e102);\n        }\n        continuing {\n            let _e63 = i;\n            i = (_e63 + 1i);\n        }\n    }\n    let _e104 = sum;\n    let _e105 = wsum;\n    o = (_e104 / vec4(max(_e105, 0.000001f)));\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e21 = o;\n    return FragmentOutput(_e21);\n}\n",
  "size": 32,
  "uniforms": {
   "uStep": [
    0,
    "vec2",
    0
   ],
   "uLen": [
    8,
    "float",
    0
   ],
   "uOneSided": [
    12,
    "float",
    0
   ],
   "frFlip": [
    16,
    "float",
    0
   ],
   "frH": [
    20,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "glowMix": {
  "hash": "cac02ab6",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uGlowW: vec2<f32>,\n    uGlowTint: vec3<f32>,\n    uOutSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uG0_: texture_2d<f32>;\n@group(0) @binding(2) \nvar uG0_s: sampler;\n@group(0) @binding(3) \nvar uG1_: texture_2d<f32>;\n@group(0) @binding(4) \nvar uG1_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var uv: vec2<f32>;\n    var g: vec3<f32>;\n\n    let _e17 = gl_FragCoord_1;\n    let _e19 = global.frFlip;\n    if (_e19 > 0.5f) {\n        let _e22 = global.frH;\n        let _e23 = gl_FragCoord_1;\n        local = (_e22 - _e23.y);\n    } else {\n        let _e26 = gl_FragCoord_1;\n        local = _e26.y;\n    }\n    let _e29 = local;\n    let _e30 = gl_FragCoord_1;\n    let _e31 = _e30.zw;\n    frFC = vec4<f32>(_e17.x, _e29, _e31.x, _e31.y);\n    let _e35 = frFC;\n    let _e37 = global.uOutSize;\n    uv = (_e35.xy / _e37);\n    let _e40 = global.uGlowW;\n    let _e42 = uv;\n    let _e43 = textureSample(uG0_, uG0_s, _e42);\n    let _e46 = global.uGlowW;\n    let _e48 = uv;\n    let _e49 = textureSample(uG1_, uG1_s, _e48);\n    g = ((_e40.x * _e43.xyz) + (_e46.y * _e49.xyz));\n    let _e54 = g;\n    let _e55 = global.uGlowTint;\n    let _e56 = (_e54 * _e55);\n    o = vec4<f32>(_e56.x, _e56.y, _e56.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 48,
  "uniforms": {
   "uGlowW": [
    0,
    "vec2",
    0
   ],
   "uGlowTint": [
    16,
    "vec3",
    0
   ],
   "uOutSize": [
    32,
    "vec2",
    0
   ],
   "frFlip": [
    40,
    "float",
    0
   ],
   "frH": [
    44,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uG0",
    1,
    2,
    true
   ],
   [
    "uG1",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "dab": {
  "hash": "e25cd805",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uHard: f32,\n    uFlow: f32,\n    uAlias: f32,\n    uOri2Out: mat3x3<f32>,\n    uOutSize: vec2<f32>,\n    uScale: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\nvar<private> frFC: vec4<f32>;\nvar<private> vUv_1: vec2<f32>;\nvar<private> vR_1: f32;\nvar<private> vDir_1: vec2<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var d: f32;\n    var r: f32;\n    var inner: f32;\n    var local_1: f32;\n    var a: f32;\n\n    let _e22 = gl_FragCoord_1;\n    let _e24 = global.frFlip;\n    if (_e24 > 0.5f) {\n        let _e27 = global.frH;\n        let _e28 = gl_FragCoord_1;\n        local = (_e27 - _e28.y);\n    } else {\n        let _e31 = gl_FragCoord_1;\n        local = _e31.y;\n    }\n    let _e34 = local;\n    let _e35 = gl_FragCoord_1;\n    let _e36 = _e35.zw;\n    frFC = vec4<f32>(_e22.x, _e34, _e36.x, _e36.y);\n    let _e40 = vUv_1;\n    d = length(_e40);\n    let _e43 = vR_1;\n    r = max(_e43, 0.5f);\n    let _e47 = global.uHard;\n    let _e48 = r;\n    let _e50 = r;\n    inner = min((_e47 * _e48), (_e50 - 0.75f));\n    let _e55 = global.uAlias;\n    if (_e55 > 0.5f) {\n        let _e58 = d;\n        let _e59 = r;\n        local_1 = step(_e58, _e59);\n    } else {\n        let _e62 = inner;\n        let _e63 = r;\n        let _e66 = d;\n        local_1 = (1f - smoothstep(_e62, (_e63 + 0.5f), _e66));\n    }\n    let _e70 = local_1;\n    a = _e70;\n    let _e72 = a;\n    let _e73 = global.uFlow;\n    a = (_e72 * _e73);\n    let _e75 = a;\n    let _e76 = a;\n    let _e79 = vDir_1;\n    let _e84 = a;\n    let _e87 = vDir_1;\n    let _e92 = a;\n    o = vec4<f32>(_e75, (_e76 * (0.5f + (0.5f * _e79.x))), (_e84 * (0.5f + (0.5f * _e87.y))), _e92);\n    return;\n}\n\n@fragment \nfn main(@location(0) vUv: vec2<f32>, @location(1) vR: f32, @location(2) vDir: vec2<f32>, @builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    vUv_1 = vUv;\n    vR_1 = vR;\n    vDir_1 = vDir;\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e35 = o;\n    return FragmentOutput(_e35);\n}\n",
  "size": 96,
  "uniforms": {
   "uHard": [
    0,
    "float",
    0
   ],
   "uFlow": [
    4,
    "float",
    0
   ],
   "uAlias": [
    8,
    "float",
    0
   ],
   "uOri2Out": [
    16,
    "mat3",
    0
   ],
   "uOutSize": [
    64,
    "vec2",
    0
   ],
   "uScale": [
    72,
    "float",
    0
   ],
   "frFlip": [
    76,
    "float",
    0
   ],
   "frH": [
    80,
    "float",
    0
   ]
  },
  "textures": [],
  "nearest": 0,
  "vert": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uHard: f32,\n    uFlow: f32,\n    uAlias: f32,\n    uOri2Out: mat3x3<f32>,\n    uOutSize: vec2<f32>,\n    uScale: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct VertexOutput {\n    @location(0) vUv: vec2<f32>,\n    @location(1) vR: f32,\n    @location(2) vDir: vec2<f32>,\n    @builtin(position) gl_Position: vec4<f32>,\n}\n\nconst Q: array<vec2<f32>, 6> = array<vec2<f32>, 6>(vec2<f32>(-1f, -1f), vec2<f32>(1f, -1f), vec2<f32>(-1f, 1f), vec2<f32>(-1f, 1f), vec2<f32>(1f, -1f), vec2<f32>(1f, 1f));\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\nvar<private> aDab_1: vec4<f32>;\nvar<private> vUv: vec2<f32>;\nvar<private> vR: f32;\nvar<private> vDir: vec2<f32>;\nvar<private> gl_VertexIndex_1: u32;\nvar<private> gl_Position: vec4<f32>;\n\nfn main_1() {\n    var local: array<vec2<f32>, 6> = Q;\n    var c: vec2<f32>;\n    var r: f32;\n    var p: vec2<f32>;\n    var d: vec2<f32>;\n\n    let _e22 = gl_VertexIndex_1;\n    let _e26 = local[_e22];\n    c = _e26;\n    let _e28 = aDab_1;\n    let _e30 = global.uScale;\n    r = (_e28.z * _e30);\n    let _e33 = global.uOri2Out;\n    let _e34 = aDab_1;\n    let _e35 = _e34.xy;\n    let _e42 = c;\n    let _e43 = r;\n    p = ((_e33 * vec3<f32>(_e35.x, _e35.y, 1f)).xy + (_e42 * (_e43 + 1f)));\n    let _e49 = c;\n    let _e50 = r;\n    vUv = (_e49 * (_e50 + 1f));\n    let _e54 = r;\n    vR = _e54;\n    let _e55 = global.uOri2Out;\n    let _e56 = aDab_1;\n    let _e59 = aDab_1;\n    d = (_e55 * vec3<f32>(cos(_e56.w), sin(_e59.w), 0f)).xy;\n    let _e67 = d;\n    let _e68 = d;\n    vDir = (_e67 / vec2(max(length(_e68), 0.000001f)));\n    let _e75 = p;\n    let _e76 = global.uOutSize;\n    let _e82 = (((_e75 / _e76) * 2f) - vec2(1f));\n    gl_Position = vec4<f32>(_e82.x, _e82.y, 0f, 1f);\n    let _e88 = global.frFlip;\n    if (_e88 < 0.5f) {\n        let _e92 = gl_Position;\n        gl_Position.y = -(_e92.y);\n        return;\n    } else {\n        return;\n    }\n}\n\n@vertex \nfn main(@location(1) aDab: vec4<f32>, @builtin(vertex_index) gl_VertexIndex: u32) -> VertexOutput {\n    aDab_1 = aDab;\n    gl_VertexIndex_1 = gl_VertexIndex;\n    main_1();\n    let _e31 = vUv;\n    let _e33 = vR;\n    let _e35 = vDir;\n    let _e37 = gl_Position;\n    return VertexOutput(_e31, _e33, _e35, _e37);\n}\n"
 },
 "op": {
  "hash": "c124be9",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uKind: f32,\n    uColor: vec3<f32>,\n    uOpacity: f32,\n    uUseCov: f32,\n    uUseSel: f32,\n    uK: f32,\n    uOut2Ori: mat3x3<f32>,\n    uOriSize: vec2<f32>,\n    uMemRect: vec3<f32>,\n    uMemSize: vec2<f32>,\n    uMemCap: vec2<f32>,\n    uG: vec4<f32>,\n    uC0_: vec4<f32>,\n    uC1_: vec4<f32>,\n    uImgRect: vec4<f32>,\n    uP: vec4<f32>,\n    uGStyle: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uCov: texture_2d<f32>;\n@group(0) @binding(2) \nvar uCov_s: sampler;\n@group(0) @binding(3) \nvar uSrcTex: texture_2d<f32>;\n@group(0) @binding(4) \nvar uSrcTex_s: sampler;\n@group(0) @binding(5) \nvar uMem: texture_2d<f32>;\n@group(0) @binding(6) \nvar uMem_s: sampler;\n@group(0) @binding(7) \nvar uSel: texture_2d<f32>;\n@group(0) @binding(8) \nvar uSel_s: sampler;\n@group(0) @binding(9) \nvar uSnap: texture_2d<f32>;\n@group(0) @binding(10) \nvar uSnap_s: sampler;\n@group(0) @binding(11) \nvar uBack: texture_2d<f32>;\n@group(0) @binding(12) \nvar uBack_s: sampler;\n@group(0) @binding(13) \nvar uImg: texture_2d<f32>;\n@group(0) @binding(14) \nvar uImg_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn lum(c: vec3<f32>) -> f32 {\n    var c_1: vec3<f32>;\n\n    c_1 = c;\n    let _e56 = c_1;\n    return dot(_e56, vec3<f32>(0.3f, 0.59f, 0.11f));\n}\n\nfn there(ip: vec2<i32>) -> vec3<f32> {\n    var ip_1: vec2<i32>;\n    var s: vec4<f32>;\n\n    ip_1 = ip;\n    let _e56 = ip_1;\n    let _e58 = textureLoad(uSnap, _e56, 0i);\n    s = _e58;\n    let _e60 = s;\n    let _e62 = ip_1;\n    let _e64 = textureLoad(uBack, _e62, 0i);\n    let _e67 = s;\n    return (_e60.xyz + (_e64.xyz * (1f - _e67.w)));\n}\n\nfn thereAt(p: vec2<f32>) -> vec3<f32> {\n    var p_1: vec2<f32>;\n\n    p_1 = p;\n    let _e56 = p_1;\n    let _e61 = textureDimensions(uSnap, 0i);\n    let _e67 = there(clamp(vec2<i32>(_e56), vec2(0i), (vec2<i32>(_e61) - vec2(1i))));\n    return _e67;\n}\n\nfn main_1() {\n    var local: f32;\n    var ip_2: vec2<i32>;\n    var kind: i32;\n    var q: vec2<f32>;\n    var a: f32;\n    var cov: vec4<f32>;\n    var c_2: vec3<f32>;\n    var m: vec2<f32>;\n    var A: vec2<f32>;\n    var d: vec2<f32>;\n    var v: vec2<f32>;\n    var L2_: f32;\n    var t: f32;\n    var st: i32;\n    var g: vec4<f32>;\n    var uv: vec2<f32>;\n    var local_1: vec4<f32>;\n    var im: vec4<f32>;\n    var s_1: vec3<f32>;\n    var l: f32;\n    var local_2: f32;\n    var local_3: f32;\n    var w: f32;\n    var e: f32;\n    var local_4: vec3<f32>;\n    var local_5: f32;\n    var r: f32;\n    var sum: vec3<f32>;\n    var i: i32 = 0i;\n    var an: f32;\n    var local_6: f32;\n    var b: vec3<f32>;\n    var local_7: vec3<f32>;\n    var local_8: vec2<f32>;\n    var dir: vec2<f32>;\n    var red: f32;\n    var local_9: vec4<f32>;\n\n    let _e55 = gl_FragCoord_1;\n    let _e57 = global.frFlip;\n    if (_e57 > 0.5f) {\n        let _e60 = global.frH;\n        let _e61 = gl_FragCoord_1;\n        local = (_e60 - _e61.y);\n    } else {\n        let _e64 = gl_FragCoord_1;\n        local = _e64.y;\n    }\n    let _e67 = local;\n    let _e68 = gl_FragCoord_1;\n    let _e69 = _e68.zw;\n    frFC = vec4<f32>(_e55.x, _e67, _e69.x, _e69.y);\n    let _e73 = frFC;\n    ip_2 = vec2<i32>(_e73.xy);\n    let _e77 = global.uKind;\n    kind = i32((_e77 + 0.5f));\n    let _e82 = global.uOut2Ori;\n    let _e83 = frFC;\n    let _e84 = _e83.xy;\n    q = (_e82 * vec3<f32>(_e84.x, _e84.y, 1f)).xy;\n    let _e92 = global.uOpacity;\n    a = _e92;\n    let _e94 = ip_2;\n    let _e96 = textureLoad(uCov, _e94, 0i);\n    cov = _e96;\n    let _e98 = global.uUseCov;\n    if (_e98 > 0.5f) {\n        let _e101 = a;\n        let _e102 = cov;\n        a = (_e101 * min(_e102.x, 1f));\n    }\n    let _e107 = global.uUseSel;\n    if (_e107 > 0.5f) {\n        let _e110 = a;\n        let _e111 = q;\n        let _e112 = global.uOriSize;\n        let _e114 = textureSample(uSel, uSel_s, (_e111 / _e112));\n        a = (_e110 * _e114.w);\n    }\n    let _e117 = global.uColor;\n    c_2 = _e117;\n    let _e119 = kind;\n    let _e122 = kind;\n    if ((_e119 == 2i) || (_e122 == 3i)) {\n        let _e126 = ip_2;\n        let _e128 = textureLoad(uSrcTex, _e126, 0i);\n        c_2 = _e128.xyz;\n    }\n    let _e130 = kind;\n    if (_e130 == 3i) {\n        {\n            let _e133 = frFC;\n            let _e135 = global.uMemRect;\n            let _e138 = global.uMemRect;\n            let _e143 = global.uMemSize;\n            m = clamp(((_e133.xy - _e135.xy) * _e138.z), vec2(0.5f), (_e143 - vec2(0.5f)));\n            let _e149 = c_2;\n            let _e150 = m;\n            let _e151 = global.uMemCap;\n            let _e153 = textureSample(uMem, uMem_s, (_e150 / _e151));\n            c_2 = clamp((_e149 + _e153.xyz), vec3(0f), vec3(1f));\n        }\n    }\n    let _e161 = kind;\n    if (_e161 == 6i) {\n        {\n            let _e164 = global.uG;\n            A = _e164.xy;\n            let _e167 = global.uG;\n            let _e169 = A;\n            d = (_e167.zw - _e169);\n            let _e172 = q;\n            let _e173 = A;\n            v = (_e172 - _e173);\n            let _e176 = d;\n            let _e177 = d;\n            L2_ = max(dot(_e176, _e177), 0.000001f);\n            let _e183 = global.uGStyle;\n            st = i32((_e183 + 0.5f));\n            let _e188 = st;\n            if (_e188 == 1i) {\n                let _e191 = v;\n                let _e193 = L2_;\n                t = (length(_e191) / sqrt(_e193));\n            } else {\n                let _e196 = st;\n                if (_e196 == 2i) {\n                    let _e199 = v;\n                    let _e201 = d;\n                    let _e204 = v;\n                    let _e206 = d;\n                    let _e210 = v;\n                    let _e211 = d;\n                    t = fract(((atan2(((_e199.x * _e201.y) - (_e204.y * _e206.x)), dot(_e210, _e211)) / 6.28318f) + 1f));\n                } else {\n                    let _e219 = st;\n                    if (_e219 == 3i) {\n                        let _e222 = v;\n                        let _e223 = d;\n                        let _e226 = L2_;\n                        t = (abs(dot(_e222, _e223)) / _e226);\n                    } else {\n                        let _e228 = st;\n                        if (_e228 == 4i) {\n                            let _e231 = v;\n                            let _e232 = d;\n                            let _e235 = v;\n                            let _e237 = d;\n                            let _e240 = v;\n                            let _e242 = d;\n                            let _e248 = L2_;\n                            t = ((abs(dot(_e231, _e232)) + abs(((_e235.x * _e237.y) - (_e240.y * _e242.x)))) / _e248);\n                        } else {\n                            let _e250 = v;\n                            let _e251 = d;\n                            let _e253 = L2_;\n                            t = (dot(_e250, _e251) / _e253);\n                        }\n                    }\n                }\n            }\n            let _e255 = global.uC0_;\n            let _e256 = global.uC1_;\n            let _e257 = t;\n            g = mix(_e255, _e256, vec4(clamp(_e257, 0f, 1f)));\n            let _e264 = a;\n            let _e265 = g;\n            a = (_e264 * _e265.w);\n            let _e268 = g;\n            c_2 = _e268.xyz;\n        }\n    }\n    let _e270 = kind;\n    if (_e270 == 7i) {\n        {\n            let _e273 = q;\n            let _e274 = global.uImgRect;\n            let _e277 = global.uImgRect;\n            uv = ((_e273 - _e274.xy) / _e277.zw);\n            let _e281 = uv;\n            let _e285 = uv;\n            let _e290 = uv;\n            let _e295 = uv;\n            if ((((_e281.x < 0f) || (_e285.y < 0f)) || (_e290.x > 1f)) || (_e295.y > 1f)) {\n                local_1 = vec4(0f);\n            } else {\n                let _e302 = uv;\n                let _e303 = textureSample(uImg, uImg_s, _e302);\n                local_1 = _e303;\n            }\n            let _e305 = local_1;\n            im = _e305;\n            let _e307 = im;\n            let _e308 = a;\n            o = (_e307 * _e308);\n            return;\n        }\n    }\n    let _e310 = kind;\n    if (_e310 >= 8i) {\n        {\n            let _e313 = ip_2;\n            let _e314 = there(_e313);\n            s_1 = _e314;\n            let _e316 = s_1;\n            let _e317 = lum(_e316);\n            l = _e317;\n            let _e319 = kind;\n            let _e322 = kind;\n            if ((_e319 == 8i) || (_e322 == 9i)) {\n                {\n                    let _e326 = global.uP;\n                    if (_e326.x < 0.5f) {\n                        let _e331 = l;\n                        let _e334 = l;\n                        local_3 = ((1f - _e331) * (1f - _e334));\n                    } else {\n                        let _e337 = global.uP;\n                        if (_e337.x < 1.5f) {\n                            let _e342 = l;\n                            let _e345 = l;\n                            local_2 = ((4f * _e342) * (1f - _e345));\n                        } else {\n                            let _e348 = l;\n                            let _e349 = l;\n                            local_2 = (_e348 * _e349);\n                        }\n                        let _e352 = local_2;\n                        local_3 = _e352;\n                    }\n                    let _e354 = local_3;\n                    w = _e354;\n                    let _e356 = global.uP;\n                    let _e358 = w;\n                    e = (_e356.y * _e358);\n                    let _e361 = kind;\n                    if (_e361 == 8i) {\n                        let _e364 = s_1;\n                        let _e366 = s_1;\n                        let _e369 = e;\n                        local_4 = (_e364 + (((vec3(1f) - _e366) * _e369) * 0.9f));\n                    } else {\n                        let _e374 = s_1;\n                        let _e376 = e;\n                        local_4 = (_e374 * (1f - (_e376 * 0.85f)));\n                    }\n                    let _e382 = local_4;\n                    c_2 = _e382;\n                    let _e383 = global.uP;\n                    if (_e383.z > 0.5f) {\n                        let _e387 = c_2;\n                        let _e388 = s_1;\n                        let _e389 = c_2;\n                        let _e390 = lum(_e389);\n                        let _e391 = l;\n                        c_2 = mix(_e387, (_e388 * (_e390 / max(_e391, 0.0001f))), vec3(0.5f));\n                    }\n                }\n            } else {\n                let _e399 = kind;\n                if (_e399 == 10i) {\n                    let _e402 = l;\n                    let _e404 = s_1;\n                    let _e405 = global.uP;\n                    if (_e405.x < 0.5f) {\n                        let _e410 = global.uP;\n                        local_5 = (1f + _e410.y);\n                    } else {\n                        let _e414 = global.uP;\n                        local_5 = (1f - _e414.y);\n                    }\n                    let _e418 = local_5;\n                    c_2 = mix(vec3(_e402), _e404, vec3(_e418));\n                } else {\n                    let _e421 = kind;\n                    let _e424 = kind;\n                    if ((_e421 == 11i) || (_e424 == 12i)) {\n                        {\n                            let _e430 = global.uK;\n                            r = max(1.5f, (2.5f * _e430));\n                            let _e434 = s_1;\n                            sum = _e434;\n                            loop {\n                                let _e438 = i;\n                                if !((_e438 < 12i)) {\n                                    break;\n                                }\n                                {\n                                    let _e445 = i;\n                                    an = (f32(_e445) * 0.5236f);\n                                    let _e450 = sum;\n                                    let _e451 = frFC;\n                                    let _e453 = an;\n                                    let _e455 = an;\n                                    let _e458 = r;\n                                    let _e460 = i;\n                                    if ((_e460 % 2i) == 0i) {\n                                        local_6 = 1f;\n                                    } else {\n                                        local_6 = 0.55f;\n                                    }\n                                    let _e468 = local_6;\n                                    let _e471 = thereAt((_e451.xy + ((vec2<f32>(cos(_e453), sin(_e455)) * _e458) * _e468)));\n                                    sum = (_e450 + _e471);\n                                }\n                                continuing {\n                                    let _e442 = i;\n                                    i = (_e442 + 1i);\n                                }\n                            }\n                            let _e473 = sum;\n                            b = (_e473 / vec3(13f));\n                            let _e478 = kind;\n                            if (_e478 == 11i) {\n                                let _e481 = b;\n                                local_7 = _e481;\n                            } else {\n                                let _e482 = s_1;\n                                let _e483 = s_1;\n                                let _e484 = b;\n                                let _e487 = global.uP;\n                                local_7 = clamp((_e482 + ((_e483 - _e484) * (0.6f + _e487.y))), vec3(0f), vec3(1f));\n                            }\n                            let _e498 = local_7;\n                            c_2 = _e498;\n                        }\n                    } else {\n                        let _e499 = kind;\n                        if (_e499 == 13i) {\n                            {\n                                let _e502 = cov;\n                                if (_e502.w > 0f) {\n                                    let _e506 = cov;\n                                    let _e508 = cov;\n                                    local_8 = (((_e506.yz / vec2(_e508.w)) - vec2(0.5f)) * 2f);\n                                } else {\n                                    local_8 = vec2(0f);\n                                }\n                                let _e520 = local_8;\n                                dir = _e520;\n                                let _e522 = frFC;\n                                let _e524 = dir;\n                                let _e525 = global.uP;\n                                let _e529 = thereAt((_e522.xy - (_e524 * _e525.w)));\n                                c_2 = _e529;\n                            }\n                        } else {\n                            let _e530 = kind;\n                            if (_e530 == 14i) {\n                                {\n                                    let _e533 = s_1;\n                                    let _e535 = s_1;\n                                    let _e537 = s_1;\n                                    red = (_e533.x - max(_e535.y, _e537.z));\n                                    let _e542 = s_1;\n                                    let _e543 = s_1;\n                                    let _e545 = s_1;\n                                    let _e552 = global.uP;\n                                    let _e560 = red;\n                                    c_2 = mix(_e542, (vec3(((_e543.y + _e545.z) * 0.5f)) * (1f - (_e552.y * 0.7f))), vec3(smoothstep(0.05f, 0.25f, _e560)));\n                                }\n                            }\n                        }\n                    }\n                }\n            }\n            let _e564 = c_2;\n            c_2 = clamp(_e564, vec3(0f), vec3(1f));\n        }\n    }\n    let _e570 = kind;\n    let _e573 = kind;\n    if ((_e570 == 1i) || (_e573 == 5i)) {\n        let _e577 = a;\n        local_9 = vec4(_e577);\n    } else {\n        let _e579 = c_2;\n        let _e580 = a;\n        let _e581 = (_e579 * _e580);\n        let _e582 = a;\n        local_9 = vec4<f32>(_e581.x, _e581.y, _e581.z, _e582);\n    }\n    let _e588 = local_9;\n    o = _e588;\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e73 = o;\n    return FragmentOutput(_e73);\n}\n",
  "size": 240,
  "uniforms": {
   "uKind": [
    0,
    "float",
    0
   ],
   "uColor": [
    16,
    "vec3",
    0
   ],
   "uOpacity": [
    28,
    "float",
    0
   ],
   "uUseCov": [
    32,
    "float",
    0
   ],
   "uUseSel": [
    36,
    "float",
    0
   ],
   "uK": [
    40,
    "float",
    0
   ],
   "uOut2Ori": [
    48,
    "mat3",
    0
   ],
   "uOriSize": [
    96,
    "vec2",
    0
   ],
   "uMemRect": [
    112,
    "vec3",
    0
   ],
   "uMemSize": [
    128,
    "vec2",
    0
   ],
   "uMemCap": [
    136,
    "vec2",
    0
   ],
   "uG": [
    144,
    "vec4",
    0
   ],
   "uC0": [
    160,
    "vec4",
    0
   ],
   "uC1": [
    176,
    "vec4",
    0
   ],
   "uImgRect": [
    192,
    "vec4",
    0
   ],
   "uP": [
    208,
    "vec4",
    0
   ],
   "uGStyle": [
    224,
    "float",
    0
   ],
   "frFlip": [
    228,
    "float",
    0
   ],
   "frH": [
    232,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uCov",
    1,
    2,
    false
   ],
   [
    "uSrcTex",
    3,
    4,
    false
   ],
   [
    "uMem",
    5,
    6,
    true
   ],
   [
    "uSel",
    7,
    8,
    true
   ],
   [
    "uSnap",
    9,
    10,
    false
   ],
   [
    "uBack",
    11,
    12,
    false
   ],
   [
    "uImg",
    13,
    14,
    true
   ]
  ],
  "nearest": 0
 },
 "covsel": {
  "hash": "246c1042",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOut2Ori: mat3x3<f32>,\n    uOriSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSel: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSel_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var a: f32;\n\n    let _e13 = gl_FragCoord_1;\n    let _e15 = global.frFlip;\n    if (_e15 > 0.5f) {\n        let _e18 = global.frH;\n        let _e19 = gl_FragCoord_1;\n        local = (_e18 - _e19.y);\n    } else {\n        let _e22 = gl_FragCoord_1;\n        local = _e22.y;\n    }\n    let _e25 = local;\n    let _e26 = gl_FragCoord_1;\n    let _e27 = _e26.zw;\n    frFC = vec4<f32>(_e13.x, _e25, _e27.x, _e27.y);\n    let _e31 = global.uOut2Ori;\n    let _e32 = frFC;\n    let _e33 = _e32.xy;\n    let _e40 = global.uOriSize;\n    let _e42 = textureSample(uSel, uSel_s, ((_e31 * vec3<f32>(_e33.x, _e33.y, 1f)).xy / _e40));\n    a = _e42.w;\n    let _e45 = a;\n    let _e47 = a;\n    let _e50 = a;\n    let _e52 = a;\n    o = vec4<f32>(_e45, (0.5f * _e47), (0.5f * _e50), _e52);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e19 = o;\n    return FragmentOutput(_e19);\n}\n",
  "size": 64,
  "uniforms": {
   "uOut2Ori": [
    0,
    "mat3",
    0
   ],
   "uOriSize": [
    48,
    "vec2",
    0
   ],
   "frFlip": [
    56,
    "float",
    0
   ],
   "frH": [
    60,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uSel",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "inside": {
  "hash": "dd0e3f66",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOut2Ori: mat3x3<f32>,\n    uOriSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var q: vec2<f32>;\n    var local_1: f32;\n\n    let _e11 = gl_FragCoord_1;\n    let _e13 = global.frFlip;\n    if (_e13 > 0.5f) {\n        let _e16 = global.frH;\n        let _e17 = gl_FragCoord_1;\n        local = (_e16 - _e17.y);\n    } else {\n        let _e20 = gl_FragCoord_1;\n        local = _e20.y;\n    }\n    let _e23 = local;\n    let _e24 = gl_FragCoord_1;\n    let _e25 = _e24.zw;\n    frFC = vec4<f32>(_e11.x, _e23, _e25.x, _e25.y);\n    let _e29 = global.uOut2Ori;\n    let _e30 = frFC;\n    let _e31 = _e30.xy;\n    q = (_e29 * vec3<f32>(_e31.x, _e31.y, 1f)).xy;\n    let _e39 = q;\n    let _e43 = q;\n    let _e48 = q;\n    let _e50 = global.uOriSize;\n    let _e54 = q;\n    let _e56 = global.uOriSize;\n    if ((((_e39.x >= 0f) && (_e43.y >= 0f)) && (_e48.x <= _e50.x)) && (_e54.y <= _e56.y)) {\n        local_1 = 1f;\n    } else {\n        local_1 = 0f;\n    }\n    let _e63 = local_1;\n    o = vec4(_e63);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e15 = o;\n    return FragmentOutput(_e15);\n}\n",
  "size": 64,
  "uniforms": {
   "uOut2Ori": [
    0,
    "mat3",
    0
   ],
   "uOriSize": [
    48,
    "vec2",
    0
   ],
   "frFlip": [
    56,
    "float",
    0
   ],
   "frH": [
    60,
    "float",
    0
   ]
  },
  "textures": [],
  "nearest": 0
 },
 "healL0": {
  "hash": "e29b9139",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uMemRect: vec3<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uBack: texture_2d<f32>;\n@group(0) @binding(2) \nvar uBack_s: sampler;\n@group(0) @binding(3) \nvar uSrcTex: texture_2d<f32>;\n@group(0) @binding(4) \nvar uSrcTex_s: sampler;\n@group(0) @binding(5) \nvar uCov: texture_2d<f32>;\n@group(0) @binding(6) \nvar uCov_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var sum: vec4<f32> = vec4(0f);\n    var j: i32 = 0i;\n    var i: i32;\n    var q: vec2<f32>;\n    var ip: vec2<i32>;\n    var local_1: f32;\n    var w: f32;\n\n    let _e15 = gl_FragCoord_1;\n    let _e17 = global.frFlip;\n    if (_e17 > 0.5f) {\n        let _e20 = global.frH;\n        let _e21 = gl_FragCoord_1;\n        local = (_e20 - _e21.y);\n    } else {\n        let _e24 = gl_FragCoord_1;\n        local = _e24.y;\n    }\n    let _e27 = local;\n    let _e28 = gl_FragCoord_1;\n    let _e29 = _e28.zw;\n    frFC = vec4<f32>(_e15.x, _e27, _e29.x, _e29.y);\n    loop {\n        let _e38 = j;\n        if !((_e38 < 2i)) {\n            break;\n        }\n        i = 0i;\n        loop {\n            let _e47 = i;\n            if !((_e47 < 2i)) {\n                break;\n            }\n            {\n                let _e54 = global.uMemRect;\n                let _e56 = frFC;\n                let _e61 = i;\n                let _e62 = j;\n                let _e72 = global.uMemRect;\n                q = (_e54.xy + (((_e56.xy - vec2(0.5f)) + ((vec2<f32>(f32(_e61), f32(_e62)) + vec2(0.5f)) * 0.5f)) / vec2(_e72.z)));\n                let _e78 = q;\n                let _e81 = textureDimensions(uCov, 0i);\n                ip = min(vec2<i32>(_e78), (vec2<i32>(_e81) - vec2(1i)));\n                let _e88 = ip;\n                let _e90 = textureLoad(uCov, _e88, 0i);\n                if (_e90.x < 0.02f) {\n                    local_1 = 1f;\n                } else {\n                    local_1 = 0f;\n                }\n                let _e97 = local_1;\n                w = _e97;\n                let _e99 = sum;\n                let _e100 = ip;\n                let _e102 = textureLoad(uBack, _e100, 0i);\n                let _e104 = ip;\n                let _e106 = textureLoad(uSrcTex, _e104, 0i);\n                let _e109 = w;\n                let _e110 = ((_e102.xyz - _e106.xyz) * _e109);\n                let _e111 = w;\n                sum = (_e99 + vec4<f32>(_e110.x, _e110.y, _e110.z, _e111));\n            }\n            continuing {\n                let _e51 = i;\n                i = (_e51 + 1i);\n            }\n        }\n        continuing {\n            let _e42 = j;\n            j = (_e42 + 1i);\n        }\n    }\n    let _e117 = sum;\n    o = (_e117 * 0.25f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 32,
  "uniforms": {
   "uMemRect": [
    0,
    "vec3",
    0
   ],
   "frFlip": [
    12,
    "float",
    0
   ],
   "frH": [
    16,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uBack",
    1,
    2,
    false
   ],
   [
    "uSrcTex",
    3,
    4,
    false
   ],
   [
    "uCov",
    5,
    6,
    false
   ]
  ],
  "nearest": 0
 },
 "pull": {
  "hash": "7e540832",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uMax: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var b: vec2<i32>;\n    var m: vec2<i32>;\n\n    let _e11 = gl_FragCoord_1;\n    let _e13 = global.frFlip;\n    if (_e13 > 0.5f) {\n        let _e16 = global.frH;\n        let _e17 = gl_FragCoord_1;\n        local = (_e16 - _e17.y);\n    } else {\n        let _e20 = gl_FragCoord_1;\n        local = _e20.y;\n    }\n    let _e23 = local;\n    let _e24 = gl_FragCoord_1;\n    let _e25 = _e24.zw;\n    frFC = vec4<f32>(_e11.x, _e23, _e25.x, _e25.y);\n    let _e29 = frFC;\n    b = (vec2<i32>(_e29.xy) * 2i);\n    let _e35 = global.uMax;\n    m = vec2<i32>(_e35);\n    let _e38 = b;\n    let _e39 = m;\n    let _e42 = textureLoad(uTex, min(_e38, _e39), 0i);\n    let _e43 = b;\n    let _e48 = m;\n    let _e51 = textureLoad(uTex, min((_e43 + vec2<i32>(1i, 0i)), _e48), 0i);\n    let _e53 = b;\n    let _e58 = m;\n    let _e61 = textureLoad(uTex, min((_e53 + vec2<i32>(0i, 1i)), _e58), 0i);\n    let _e63 = b;\n    let _e68 = m;\n    let _e71 = textureLoad(uTex, min((_e63 + vec2<i32>(1i, 1i)), _e68), 0i);\n    o = ((((_e42 + _e51) + _e61) + _e71) * 0.25f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e17 = o;\n    return FragmentOutput(_e17);\n}\n",
  "size": 16,
  "uniforms": {
   "uMax": [
    0,
    "vec2",
    0
   ],
   "frFlip": [
    8,
    "float",
    0
   ],
   "frH": [
    12,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ]
  ],
  "nearest": 0
 },
 "push": {
  "hash": "e0db9bcd",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uUpSize: vec2<f32>,\n    uUpCap: vec2<f32>,\n    uTop: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uL: texture_2d<f32>;\n@group(0) @binding(2) \nvar uL_s: sampler;\n@group(0) @binding(3) \nvar uUp: texture_2d<f32>;\n@group(0) @binding(4) \nvar uUp_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var l: vec4<f32>;\n    var q: vec2<f32>;\n    var up: vec3<f32>;\n\n    let _e17 = gl_FragCoord_1;\n    let _e19 = global.frFlip;\n    if (_e19 > 0.5f) {\n        let _e22 = global.frH;\n        let _e23 = gl_FragCoord_1;\n        local = (_e22 - _e23.y);\n    } else {\n        let _e26 = gl_FragCoord_1;\n        local = _e26.y;\n    }\n    let _e29 = local;\n    let _e30 = gl_FragCoord_1;\n    let _e31 = _e30.zw;\n    frFC = vec4<f32>(_e17.x, _e29, _e31.x, _e31.y);\n    let _e35 = frFC;\n    let _e39 = textureLoad(uL, vec2<i32>(_e35.xy), 0i);\n    l = _e39;\n    let _e41 = global.uTop;\n    if (_e41 > 0.5f) {\n        {\n            let _e44 = l;\n            let _e46 = l;\n            let _e51 = (_e44.xyz / vec3(max(_e46.w, 0.000001f)));\n            o = vec4<f32>(_e51.x, _e51.y, _e51.z, 1f);\n            return;\n        }\n    }\n    let _e57 = frFC;\n    let _e63 = global.uUpSize;\n    q = clamp((_e57.xy * 0.5f), vec2(0.5f), (_e63 - vec2(0.5f)));\n    let _e69 = q;\n    let _e70 = global.uUpCap;\n    let _e72 = textureSample(uUp, uUp_s, (_e69 / _e70));\n    up = _e72.xyz;\n    let _e75 = l;\n    let _e78 = l;\n    let _e81 = up;\n    let _e83 = (_e75.xyz + ((1f - _e78.w) * _e81));\n    o = vec4<f32>(_e83.x, _e83.y, _e83.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 32,
  "uniforms": {
   "uUpSize": [
    0,
    "vec2",
    0
   ],
   "uUpCap": [
    8,
    "vec2",
    0
   ],
   "uTop": [
    16,
    "float",
    0
   ],
   "frFlip": [
    20,
    "float",
    0
   ],
   "frH": [
    24,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uL",
    1,
    2,
    false
   ],
   [
    "uUp",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "comp": {
  "hash": "fa8a440e",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uMode: f32,\n    uOpacity: f32,\n    uUseMask: f32,\n    uDensity: f32,\n    uUseClip: f32,\n    uOut2Ori: mat3x3<f32>,\n    uOriSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uBack: texture_2d<f32>;\n@group(0) @binding(2) \nvar uBack_s: sampler;\n@group(0) @binding(3) \nvar uLayer: texture_2d<f32>;\n@group(0) @binding(4) \nvar uLayer_s: sampler;\n@group(0) @binding(5) \nvar uMask: texture_2d<f32>;\n@group(0) @binding(6) \nvar uMask_s: sampler;\n@group(0) @binding(7) \nvar uClip: texture_2d<f32>;\n@group(0) @binding(8) \nvar uClip_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn lum(c: vec3<f32>) -> f32 {\n    var c_1: vec3<f32>;\n\n    c_1 = c;\n    let _e30 = c_1;\n    return dot(_e30, vec3<f32>(0.3f, 0.59f, 0.11f));\n}\n\nfn clipColor(c_2: vec3<f32>) -> vec3<f32> {\n    var c_3: vec3<f32>;\n    var l: f32;\n    var n: f32;\n    var x: f32;\n\n    c_3 = c_2;\n    let _e30 = c_3;\n    let _e31 = lum(_e30);\n    l = _e31;\n    let _e33 = c_3;\n    let _e35 = c_3;\n    let _e37 = c_3;\n    n = min(_e33.x, min(_e35.y, _e37.z));\n    let _e42 = c_3;\n    let _e44 = c_3;\n    let _e46 = c_3;\n    x = max(_e42.x, max(_e44.y, _e46.z));\n    let _e51 = n;\n    if (_e51 < 0f) {\n        let _e54 = l;\n        let _e55 = c_3;\n        let _e56 = l;\n        let _e59 = l;\n        let _e61 = l;\n        let _e62 = n;\n        c_3 = (vec3(_e54) + (((_e55 - vec3(_e56)) * _e59) / vec3(max((_e61 - _e62), 0.000001f))));\n    }\n    let _e70 = x;\n    if (_e70 > 1f) {\n        let _e73 = l;\n        let _e74 = c_3;\n        let _e75 = l;\n        let _e79 = l;\n        let _e82 = x;\n        let _e83 = l;\n        c_3 = (vec3(_e73) + (((_e74 - vec3(_e75)) * (1f - _e79)) / vec3(max((_e82 - _e83), 0.000001f))));\n    }\n    let _e91 = c_3;\n    return _e91;\n}\n\nfn setLum(c_4: vec3<f32>, l_1: f32) -> vec3<f32> {\n    var c_5: vec3<f32>;\n    var l_2: f32;\n\n    c_5 = c_4;\n    l_2 = l_1;\n    let _e32 = c_5;\n    let _e33 = l_2;\n    let _e34 = c_5;\n    let _e35 = lum(_e34);\n    let _e39 = clipColor((_e32 + vec3((_e33 - _e35))));\n    return _e39;\n}\n\nfn sat(c_6: vec3<f32>) -> f32 {\n    var c_7: vec3<f32>;\n\n    c_7 = c_6;\n    let _e30 = c_7;\n    let _e32 = c_7;\n    let _e34 = c_7;\n    let _e38 = c_7;\n    let _e40 = c_7;\n    let _e42 = c_7;\n    return (max(_e30.x, max(_e32.y, _e34.z)) - min(_e38.x, min(_e40.y, _e42.z)));\n}\n\nfn setSat(c_8: vec3<f32>, s: f32) -> vec3<f32> {\n    var c_9: vec3<f32>;\n    var s_1: f32;\n    var n_1: f32;\n    var x_1: f32;\n    var local: vec3<f32>;\n\n    c_9 = c_8;\n    s_1 = s;\n    let _e32 = c_9;\n    let _e34 = c_9;\n    let _e36 = c_9;\n    n_1 = min(_e32.x, min(_e34.y, _e36.z));\n    let _e41 = c_9;\n    let _e43 = c_9;\n    let _e45 = c_9;\n    x_1 = max(_e41.x, max(_e43.y, _e45.z));\n    let _e50 = x_1;\n    let _e51 = n_1;\n    if (_e50 > _e51) {\n        let _e53 = c_9;\n        let _e54 = n_1;\n        let _e57 = s_1;\n        let _e59 = x_1;\n        let _e60 = n_1;\n        local = (((_e53 - vec3(_e54)) * _e57) / vec3((_e59 - _e60)));\n    } else {\n        local = vec3(0f);\n    }\n    let _e67 = local;\n    return _e67;\n}\n\nfn soft(b: vec3<f32>, s_2: vec3<f32>) -> vec3<f32> {\n    var b_1: vec3<f32>;\n    var s_3: vec3<f32>;\n    var d: vec3<f32>;\n\n    b_1 = b;\n    s_3 = s_2;\n    let _e32 = b_1;\n    let _e35 = b_1;\n    let _e40 = b_1;\n    let _e45 = b_1;\n    let _e47 = b_1;\n    d = mix(sqrt(_e32), (((((16f * _e35) - vec3(12f)) * _e40) + vec3(4f)) * _e45), step(_e47, vec3(0.25f)));\n    let _e53 = b_1;\n    let _e55 = s_3;\n    let _e60 = d;\n    let _e61 = b_1;\n    let _e65 = b_1;\n    let _e68 = s_3;\n    let _e72 = b_1;\n    let _e75 = b_1;\n    let _e80 = s_3;\n    return mix((_e53 + (((2f * _e55) - vec3(1f)) * (_e60 - _e61))), (_e65 - (((vec3(1f) - (2f * _e68)) * _e72) * (vec3(1f) - _e75))), step(_e80, vec3(0.5f)));\n}\n\nfn burn(b_2: vec3<f32>, s_4: vec3<f32>) -> vec3<f32> {\n    var b_3: vec3<f32>;\n    var s_5: vec3<f32>;\n\n    b_3 = b_2;\n    s_5 = s_4;\n    let _e36 = b_3;\n    let _e39 = s_5;\n    let _e50 = b_3;\n    return mix((vec3(1f) - min(vec3(1f), ((vec3(1f) - _e36) / max(_e39, vec3(0.00001f))))), vec3(1f), step(vec3(1f), _e50));\n}\n\nfn dodge(b_4: vec3<f32>, s_6: vec3<f32>) -> vec3<f32> {\n    var b_5: vec3<f32>;\n    var s_7: vec3<f32>;\n\n    b_5 = b_4;\n    s_7 = s_6;\n    let _e34 = b_5;\n    let _e36 = s_7;\n    let _e46 = b_5;\n    return mix(min(vec3(1f), (_e34 / max((vec3(1f) - _e36), vec3(0.00001f)))), vec3(0f), step(_e46, vec3(0f)));\n}\n\nfn hash(p: vec2<f32>) -> f32 {\n    var p_1: vec2<f32>;\n\n    p_1 = p;\n    let _e30 = p_1;\n    p_1 = fract((_e30 * vec2<f32>(123.34f, 456.21f)));\n    let _e36 = p_1;\n    let _e37 = p_1;\n    let _e38 = p_1;\n    p_1 = (_e36 + vec2(dot(_e37, (_e38 + vec2(45.32f)))));\n    let _e45 = p_1;\n    let _e47 = p_1;\n    return fract((_e45.x * _e47.y));\n}\n\nfn main_1() {\n    var local_1: f32;\n    var ip: vec2<i32>;\n    var b_6: vec3<f32>;\n    var l_3: vec4<f32>;\n    var a: f32;\n    var q: vec2<f32>;\n    var s_8: vec3<f32>;\n    var m: i32;\n    var f: vec3<f32>;\n    var local_2: f32;\n    var local_3: vec3<f32>;\n    var local_4: vec3<f32>;\n\n    let _e29 = gl_FragCoord_1;\n    let _e31 = global.frFlip;\n    if (_e31 > 0.5f) {\n        let _e34 = global.frH;\n        let _e35 = gl_FragCoord_1;\n        local_1 = (_e34 - _e35.y);\n    } else {\n        let _e38 = gl_FragCoord_1;\n        local_1 = _e38.y;\n    }\n    let _e41 = local_1;\n    let _e42 = gl_FragCoord_1;\n    let _e43 = _e42.zw;\n    frFC = vec4<f32>(_e29.x, _e41, _e43.x, _e43.y);\n    let _e47 = frFC;\n    ip = vec2<i32>(_e47.xy);\n    let _e51 = ip;\n    let _e53 = textureLoad(uBack, _e51, 0i);\n    b_6 = _e53.xyz;\n    let _e56 = ip;\n    let _e58 = textureLoad(uLayer, _e56, 0i);\n    l_3 = _e58;\n    let _e60 = l_3;\n    let _e62 = global.uOpacity;\n    a = (_e60.w * _e62);\n    let _e65 = global.uUseMask;\n    if (_e65 > 0.5f) {\n        let _e68 = a;\n        let _e70 = global.uDensity;\n        let _e72 = ip;\n        let _e74 = textureLoad(uMask, _e72, 0i);\n        a = (_e68 * (1f - (_e70 * (1f - _e74.x))));\n    }\n    let _e80 = global.uUseClip;\n    if (_e80 > 0.5f) {\n        let _e83 = a;\n        let _e84 = ip;\n        let _e86 = textureLoad(uClip, _e84, 0i);\n        a = (_e83 * _e86.w);\n    }\n    let _e89 = global.uOut2Ori;\n    let _e90 = frFC;\n    let _e91 = _e90.xy;\n    q = (_e89 * vec3<f32>(_e91.x, _e91.y, 1f)).xy;\n    let _e99 = q;\n    let _e103 = q;\n    let _e108 = q;\n    let _e110 = global.uOriSize;\n    let _e114 = q;\n    let _e116 = global.uOriSize;\n    if ((((_e99.x < 0f) || (_e103.y < 0f)) || (_e108.x > _e110.x)) || (_e114.y > _e116.y)) {\n        a = 0f;\n    }\n    let _e121 = a;\n    if (_e121 <= 0f) {\n        {\n            let _e124 = b_6;\n            o = vec4<f32>(_e124.x, _e124.y, _e124.z, 1f);\n            return;\n        }\n    }\n    let _e130 = l_3;\n    let _e132 = l_3;\n    s_8 = clamp((_e130.xyz / vec3(_e132.w)), vec3(0f), vec3(1f));\n    let _e142 = global.uMode;\n    m = i32((_e142 + 0.5f));\n    let _e147 = s_8;\n    f = _e147;\n    let _e149 = m;\n    if (_e149 == 1i) {\n        let _e152 = frFC;\n        let _e154 = hash(_e152.xy);\n        let _e155 = a;\n        if (_e154 < _e155) {\n            local_2 = 1f;\n        } else {\n            local_2 = 0f;\n        }\n        let _e160 = local_2;\n        a = _e160;\n    } else {\n        let _e161 = m;\n        if (_e161 == 2i) {\n            let _e164 = b_6;\n            let _e165 = s_8;\n            f = min(_e164, _e165);\n        } else {\n            let _e167 = m;\n            if (_e167 == 3i) {\n                let _e170 = b_6;\n                let _e171 = s_8;\n                f = (_e170 * _e171);\n            } else {\n                let _e173 = m;\n                if (_e173 == 4i) {\n                    let _e176 = b_6;\n                    let _e177 = s_8;\n                    let _e178 = burn(_e176, _e177);\n                    f = _e178;\n                } else {\n                    let _e179 = m;\n                    if (_e179 == 5i) {\n                        let _e182 = b_6;\n                        let _e183 = s_8;\n                        f = max(((_e182 + _e183) - vec3(1f)), vec3(0f));\n                    } else {\n                        let _e191 = m;\n                        if (_e191 == 6i) {\n                            let _e194 = s_8;\n                            let _e195 = lum(_e194);\n                            let _e196 = b_6;\n                            let _e197 = lum(_e196);\n                            if (_e195 < _e197) {\n                                let _e199 = s_8;\n                                local_3 = _e199;\n                            } else {\n                                let _e200 = b_6;\n                                local_3 = _e200;\n                            }\n                            let _e202 = local_3;\n                            f = _e202;\n                        } else {\n                            let _e203 = m;\n                            if (_e203 == 7i) {\n                                let _e206 = b_6;\n                                let _e207 = s_8;\n                                f = max(_e206, _e207);\n                            } else {\n                                let _e209 = m;\n                                if (_e209 == 8i) {\n                                    let _e214 = b_6;\n                                    let _e218 = s_8;\n                                    f = (vec3(1f) - ((vec3(1f) - _e214) * (vec3(1f) - _e218)));\n                                } else {\n                                    let _e224 = m;\n                                    if (_e224 == 9i) {\n                                        let _e227 = b_6;\n                                        let _e228 = s_8;\n                                        let _e229 = dodge(_e227, _e228);\n                                        f = _e229;\n                                    } else {\n                                        let _e230 = m;\n                                        if (_e230 == 10i) {\n                                            let _e233 = b_6;\n                                            let _e234 = s_8;\n                                            f = min((_e233 + _e234), vec3(1f));\n                                        } else {\n                                            let _e239 = m;\n                                            if (_e239 == 11i) {\n                                                let _e242 = s_8;\n                                                let _e243 = lum(_e242);\n                                                let _e244 = b_6;\n                                                let _e245 = lum(_e244);\n                                                if (_e243 > _e245) {\n                                                    let _e247 = s_8;\n                                                    local_4 = _e247;\n                                                } else {\n                                                    let _e248 = b_6;\n                                                    local_4 = _e248;\n                                                }\n                                                let _e250 = local_4;\n                                                f = _e250;\n                                            } else {\n                                                let _e251 = m;\n                                                if (_e251 == 12i) {\n                                                    let _e257 = b_6;\n                                                    let _e262 = s_8;\n                                                    let _e269 = b_6;\n                                                    let _e271 = s_8;\n                                                    let _e273 = b_6;\n                                                    f = mix((vec3(1f) - ((2f * (vec3(1f) - _e257)) * (vec3(1f) - _e262))), ((2f * _e269) * _e271), step(_e273, vec3(0.5f)));\n                                                } else {\n                                                    let _e278 = m;\n                                                    if (_e278 == 13i) {\n                                                        let _e281 = b_6;\n                                                        let _e282 = s_8;\n                                                        let _e283 = soft(_e281, _e282);\n                                                        f = _e283;\n                                                    } else {\n                                                        let _e284 = m;\n                                                        if (_e284 == 14i) {\n                                                            let _e290 = b_6;\n                                                            let _e295 = s_8;\n                                                            let _e302 = b_6;\n                                                            let _e304 = s_8;\n                                                            let _e306 = s_8;\n                                                            f = mix((vec3(1f) - ((2f * (vec3(1f) - _e290)) * (vec3(1f) - _e295))), ((2f * _e302) * _e304), step(_e306, vec3(0.5f)));\n                                                        } else {\n                                                            let _e311 = m;\n                                                            if (_e311 == 15i) {\n                                                                let _e314 = b_6;\n                                                                let _e316 = s_8;\n                                                                let _e321 = dodge(_e314, ((2f * _e316) - vec3(1f)));\n                                                                let _e322 = b_6;\n                                                                let _e324 = s_8;\n                                                                let _e326 = burn(_e322, (2f * _e324));\n                                                                let _e327 = s_8;\n                                                                f = mix(_e321, _e326, step(_e327, vec3(0.5f)));\n                                                            } else {\n                                                                let _e332 = m;\n                                                                if (_e332 == 16i) {\n                                                                    let _e335 = b_6;\n                                                                    let _e337 = s_8;\n                                                                    f = clamp(((_e335 + (2f * _e337)) - vec3(1f)), vec3(0f), vec3(1f));\n                                                                } else {\n                                                                    let _e348 = m;\n                                                                    if (_e348 == 17i) {\n                                                                        let _e351 = b_6;\n                                                                        let _e353 = s_8;\n                                                                        let _e359 = b_6;\n                                                                        let _e361 = s_8;\n                                                                        let _e364 = s_8;\n                                                                        f = mix(max(_e351, ((2f * _e353) - vec3(1f))), min(_e359, (2f * _e361)), step(_e364, vec3(0.5f)));\n                                                                    } else {\n                                                                        let _e369 = m;\n                                                                        if (_e369 == 18i) {\n                                                                            let _e373 = b_6;\n                                                                            let _e374 = s_8;\n                                                                            f = step(vec3(1f), (_e373 + _e374));\n                                                                        } else {\n                                                                            let _e378 = m;\n                                                                            if (_e378 == 19i) {\n                                                                                let _e381 = b_6;\n                                                                                let _e382 = s_8;\n                                                                                f = abs((_e381 - _e382));\n                                                                            } else {\n                                                                                let _e385 = m;\n                                                                                if (_e385 == 20i) {\n                                                                                    let _e388 = b_6;\n                                                                                    let _e389 = s_8;\n                                                                                    let _e392 = b_6;\n                                                                                    let _e394 = s_8;\n                                                                                    f = ((_e388 + _e389) - ((2f * _e392) * _e394));\n                                                                                } else {\n                                                                                    let _e397 = m;\n                                                                                    if (_e397 == 21i) {\n                                                                                        let _e400 = b_6;\n                                                                                        let _e401 = s_8;\n                                                                                        f = max((_e400 - _e401), vec3(0f));\n                                                                                    } else {\n                                                                                        let _e406 = m;\n                                                                                        if (_e406 == 22i) {\n                                                                                            let _e409 = b_6;\n                                                                                            let _e410 = s_8;\n                                                                                            f = min((_e409 / max(_e410, vec3(0.00001f))), vec3(1f));\n                                                                                        } else {\n                                                                                            let _e418 = m;\n                                                                                            if (_e418 == 23i) {\n                                                                                                let _e421 = s_8;\n                                                                                                let _e422 = b_6;\n                                                                                                let _e423 = sat(_e422);\n                                                                                                let _e424 = setSat(_e421, _e423);\n                                                                                                let _e425 = b_6;\n                                                                                                let _e426 = lum(_e425);\n                                                                                                let _e427 = setLum(_e424, _e426);\n                                                                                                f = _e427;\n                                                                                            } else {\n                                                                                                let _e428 = m;\n                                                                                                if (_e428 == 24i) {\n                                                                                                    let _e431 = b_6;\n                                                                                                    let _e432 = s_8;\n                                                                                                    let _e433 = sat(_e432);\n                                                                                                    let _e434 = setSat(_e431, _e433);\n                                                                                                    let _e435 = b_6;\n                                                                                                    let _e436 = lum(_e435);\n                                                                                                    let _e437 = setLum(_e434, _e436);\n                                                                                                    f = _e437;\n                                                                                                } else {\n                                                                                                    let _e438 = m;\n                                                                                                    if (_e438 == 25i) {\n                                                                                                        let _e441 = s_8;\n                                                                                                        let _e442 = b_6;\n                                                                                                        let _e443 = lum(_e442);\n                                                                                                        let _e444 = setLum(_e441, _e443);\n                                                                                                        f = _e444;\n                                                                                                    } else {\n                                                                                                        let _e445 = m;\n                                                                                                        if (_e445 == 26i) {\n                                                                                                            let _e448 = b_6;\n                                                                                                            let _e449 = s_8;\n                                                                                                            let _e450 = lum(_e449);\n                                                                                                            let _e451 = setLum(_e448, _e450);\n                                                                                                            f = _e451;\n                                                                                                        }\n                                                                                                    }\n                                                                                                }\n                                                                                            }\n                                                                                        }\n                                                                                    }\n                                                                                }\n                                                                            }\n                                                                        }\n                                                                    }\n                                                                }\n                                                            }\n                                                        }\n                                                    }\n                                                }\n                                            }\n                                        }\n                                    }\n                                }\n                            }\n                        }\n                    }\n                }\n            }\n        }\n    }\n    let _e452 = b_6;\n    let _e453 = f;\n    let _e459 = a;\n    let _e463 = mix(_e452, clamp(_e453, vec3(0f), vec3(1f)), vec3(min(_e459, 1f)));\n    o = vec4<f32>(_e463.x, _e463.y, _e463.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e41 = o;\n    return FragmentOutput(_e41);\n}\n",
  "size": 96,
  "uniforms": {
   "uMode": [
    0,
    "float",
    0
   ],
   "uOpacity": [
    4,
    "float",
    0
   ],
   "uUseMask": [
    8,
    "float",
    0
   ],
   "uDensity": [
    12,
    "float",
    0
   ],
   "uUseClip": [
    16,
    "float",
    0
   ],
   "uOut2Ori": [
    32,
    "mat3",
    0
   ],
   "uOriSize": [
    80,
    "vec2",
    0
   ],
   "frFlip": [
    88,
    "float",
    0
   ],
   "frH": [
    92,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uBack",
    1,
    2,
    false
   ],
   [
    "uLayer",
    3,
    4,
    false
   ],
   [
    "uMask",
    5,
    6,
    false
   ],
   [
    "uClip",
    7,
    8,
    false
   ]
  ],
  "nearest": 0
 },
 "adj": {
  "hash": "c87c4da5",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uAdj: f32,\n    uP: array<vec4<f32>, 12>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uBack: texture_2d<f32>;\n@group(0) @binding(2) \nvar uBack_s: sampler;\n@group(0) @binding(3) \nvar uLut: texture_2d<f32>;\n@group(0) @binding(4) \nvar uLut_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o_4: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn lum(c: vec3<f32>) -> f32 {\n    var c_1: vec3<f32>;\n\n    c_1 = c;\n    let _e16 = c_1;\n    return dot(_e16, vec3<f32>(0.3f, 0.59f, 0.11f));\n}\n\nfn rgb2hsl(c_2: vec3<f32>) -> vec3<f32> {\n    var c_3: vec3<f32>;\n    var mx: f32;\n    var mn: f32;\n    var l: f32;\n    var d: f32;\n    var local: f32;\n    var s: f32;\n    var local_1: f32;\n    var local_2: f32;\n    var local_3: f32;\n    var h: f32;\n\n    c_3 = c_2;\n    let _e16 = c_3;\n    let _e18 = c_3;\n    let _e20 = c_3;\n    mx = max(_e16.x, max(_e18.y, _e20.z));\n    let _e25 = c_3;\n    let _e27 = c_3;\n    let _e29 = c_3;\n    mn = min(_e25.x, min(_e27.y, _e29.z));\n    let _e34 = mx;\n    let _e35 = mn;\n    l = ((_e34 + _e35) * 0.5f);\n    let _e40 = mx;\n    let _e41 = mn;\n    d = (_e40 - _e41);\n    let _e44 = d;\n    if (_e44 < 0.00001f) {\n        let _e49 = l;\n        return vec3<f32>(0f, 0f, _e49);\n    }\n    let _e51 = l;\n    if (_e51 > 0.5f) {\n        let _e54 = d;\n        let _e56 = mx;\n        let _e58 = mn;\n        local = (_e54 / ((2f - _e56) - _e58));\n    } else {\n        let _e61 = d;\n        let _e62 = mx;\n        let _e63 = mn;\n        local = (_e61 / (_e62 + _e63));\n    }\n    let _e67 = local;\n    s = _e67;\n    let _e69 = mx;\n    let _e70 = c_3;\n    if (_e69 == _e70.x) {\n        let _e73 = c_3;\n        let _e75 = c_3;\n        let _e78 = d;\n        let _e80 = c_3;\n        let _e82 = c_3;\n        if (_e80.y < _e82.z) {\n            local_1 = 6f;\n        } else {\n            local_1 = 0f;\n        }\n        let _e88 = local_1;\n        local_3 = (((_e73.y - _e75.z) / _e78) + _e88);\n    } else {\n        let _e90 = mx;\n        let _e91 = c_3;\n        if (_e90 == _e91.y) {\n            let _e94 = c_3;\n            let _e96 = c_3;\n            let _e99 = d;\n            local_2 = (((_e94.z - _e96.x) / _e99) + 2f);\n        } else {\n            let _e103 = c_3;\n            let _e105 = c_3;\n            let _e108 = d;\n            local_2 = (((_e103.x - _e105.y) / _e108) + 4f);\n        }\n        let _e113 = local_2;\n        local_3 = _e113;\n    }\n    let _e115 = local_3;\n    h = _e115;\n    let _e117 = h;\n    let _e120 = s;\n    let _e121 = l;\n    return vec3<f32>((_e117 / 6f), _e120, _e121);\n}\n\nfn hue2rgb(p: f32, q: f32, t: f32) -> f32 {\n    var p_1: f32;\n    var q_1: f32;\n    var t_1: f32;\n\n    p_1 = p;\n    q_1 = q;\n    t_1 = t;\n    let _e20 = t_1;\n    t_1 = fract(_e20);\n    let _e22 = t_1;\n    if (_e22 < 0.16666667f) {\n        let _e27 = p_1;\n        let _e28 = q_1;\n        let _e29 = p_1;\n        let _e33 = t_1;\n        return (_e27 + (((_e28 - _e29) * 6f) * _e33));\n    }\n    let _e36 = t_1;\n    if (_e36 < 0.5f) {\n        let _e39 = q_1;\n        return _e39;\n    }\n    let _e40 = t_1;\n    if (_e40 < 0.6666667f) {\n        let _e45 = p_1;\n        let _e46 = q_1;\n        let _e47 = p_1;\n        let _e52 = t_1;\n        return (_e45 + (((_e46 - _e47) * (0.6666667f - _e52)) * 6f));\n    }\n    let _e58 = p_1;\n    return _e58;\n}\n\nfn hsl2rgb(h_1: vec3<f32>) -> vec3<f32> {\n    var h_2: vec3<f32>;\n    var local_4: f32;\n    var q_2: f32;\n    var p_2: f32;\n\n    h_2 = h_1;\n    let _e16 = h_2;\n    if (_e16.y < 0.00001f) {\n        let _e20 = h_2;\n        return vec3(_e20.z);\n    }\n    let _e23 = h_2;\n    if (_e23.z < 0.5f) {\n        let _e27 = h_2;\n        let _e30 = h_2;\n        local_4 = (_e27.z * (1f + _e30.y));\n    } else {\n        let _e34 = h_2;\n        let _e36 = h_2;\n        let _e39 = h_2;\n        let _e41 = h_2;\n        local_4 = ((_e34.z + _e36.y) - (_e39.z * _e41.y));\n    }\n    let _e46 = local_4;\n    q_2 = _e46;\n    let _e49 = h_2;\n    let _e52 = q_2;\n    p_2 = ((2f * _e49.z) - _e52);\n    let _e55 = p_2;\n    let _e56 = q_2;\n    let _e57 = h_2;\n    let _e63 = hue2rgb(_e55, _e56, (_e57.x + 0.33333334f));\n    let _e64 = p_2;\n    let _e65 = q_2;\n    let _e66 = h_2;\n    let _e68 = hue2rgb(_e64, _e65, _e66.x);\n    let _e69 = p_2;\n    let _e70 = q_2;\n    let _e71 = h_2;\n    let _e77 = hue2rgb(_e69, _e70, (_e71.x - 0.33333334f));\n    return vec3<f32>(_e63, _e68, _e77);\n}\n\nfn keepLum(c_4: vec3<f32>, l_1: f32) -> vec3<f32> {\n    var c_5: vec3<f32>;\n    var l_2: f32;\n\n    c_5 = c_4;\n    l_2 = l_1;\n    let _e18 = c_5;\n    let _e19 = l_2;\n    let _e20 = c_5;\n    let _e21 = lum(_e20);\n    return clamp((_e18 + vec3((_e19 - _e21))), vec3(0f), vec3(1f));\n}\n\nfn adjust(c_6: vec3<f32>) -> vec3<f32> {\n    var c_7: vec3<f32>;\n    var A: i32;\n    var b: f32;\n    var k: f32;\n    var local_5: vec3<f32>;\n    var local_6: f32;\n    var f: f32;\n    var l_3: vec3<f32>;\n    var mx_1: f32;\n    var mn_1: f32;\n    var sat: f32;\n    var l_4: f32;\n    var local_7: f32;\n    var v: f32;\n    var h_3: vec3<f32>;\n    var L: f32;\n    var local_8: vec3<f32>;\n    var l_5: f32;\n    var ws: f32;\n    var wh: f32;\n    var wm: f32;\n    var d_1: vec3<f32>;\n    var o: vec3<f32>;\n    var local_9: vec3<f32>;\n    var h_4: vec3<f32>;\n    var hue: f32;\n    var w0_: array<f32, 6>;\n    var i: i32;\n    var t_2: f32;\n    var w: f32;\n    var mx_2: f32;\n    var mn_2: f32;\n    var g: f32;\n    var local_10: vec3<f32>;\n    var l_6: f32;\n    var o_1: vec3<f32>;\n    var local_11: vec3<f32>;\n    var o_2: vec3<f32>;\n    var local_12: vec3<f32>;\n    var mx_3: f32;\n    var mn_3: f32;\n    var md: f32;\n    var o_3: vec3<f32>;\n    var k_1: i32 = 0i;\n    var w_1: f32;\n    var local_13: f32;\n    var local_14: f32;\n    var local_15: f32;\n    var local_16: f32;\n    var local_17: f32;\n    var local_18: f32;\n    var a: vec4<f32>;\n    var cmy: vec3<f32>;\n    var v_1: vec3<f32>;\n    var local_19: vec3<f32>;\n    var amt: vec3<f32>;\n    var n: f32;\n    var n_1: f32;\n    var bz: f32;\n    var b0_: f32;\n    var b1_: f32;\n    var rg: vec2<f32>;\n    var s0_: vec3<f32>;\n    var s1_: vec3<f32>;\n\n    c_7 = c_6;\n    let _e16 = global.uAdj;\n    A = i32((_e16 + 0.5f));\n    let _e21 = A;\n    if (_e21 == 0i) {\n        {\n            let _e26 = global.uP[0];\n            b = _e26.x;\n            let _e31 = global.uP[0];\n            k = _e31.y;\n            let _e34 = b;\n            if (_e34 >= 0f) {\n                let _e37 = c_7;\n                let _e39 = c_7;\n                let _e42 = b;\n                let _e47 = c_7;\n                let _e52 = b;\n                let _e55 = c_7;\n                let _e58 = c_7;\n                local_5 = ((_e37 + ((((vec3(1f) - _e39) * _e42) * 0.55f) * (vec3(1f) - _e47))) + (((_e52 * 0.2f) * _e55) * (vec3(1f) - _e58)));\n            } else {\n                let _e63 = c_7;\n                let _e65 = b;\n                local_5 = (_e63 * (1f + (_e65 * 0.6f)));\n            }\n            let _e71 = local_5;\n            c_7 = _e71;\n            let _e72 = k;\n            if (_e72 >= 0f) {\n                let _e76 = k;\n                local_6 = (1f + (_e76 * 1.2f));\n            } else {\n                let _e81 = k;\n                local_6 = (1f + _e81);\n            }\n            let _e84 = local_6;\n            f = _e84;\n            let _e86 = c_7;\n            let _e90 = f;\n            return clamp((((_e86 - vec3(0.5f)) * _e90) + vec3(0.5f)), vec3(0f), vec3(1f));\n        }\n    }\n    let _e100 = A;\n    let _e103 = A;\n    if ((_e100 == 1i) || (_e103 == 2i)) {\n        {\n            let _e107 = c_7;\n            let _e119 = textureSample(uLut, uLut_s, vec2<f32>((((_e107.x * 255f) / 256f) + 0.001953125f), 0.5f));\n            let _e121 = c_7;\n            let _e133 = textureSample(uLut, uLut_s, vec2<f32>((((_e121.y * 255f) / 256f) + 0.001953125f), 0.5f));\n            let _e135 = c_7;\n            let _e147 = textureSample(uLut, uLut_s, vec2<f32>((((_e135.z * 255f) / 256f) + 0.001953125f), 0.5f));\n            return vec3<f32>(_e119.x, _e133.y, _e147.z);\n        }\n    }\n    let _e150 = A;\n    if (_e150 == 3i) {\n        {\n            let _e153 = c_7;\n            let _e159 = global.uP[0];\n            let _e165 = global.uP[0];\n            l_3 = ((pow(_e153, vec3(2.2f)) * exp2(_e159.x)) + vec3(_e165.y));\n            let _e170 = l_3;\n            let _e178 = global.uP[0];\n            return clamp(pow(max(_e170, vec3(0f)), vec3((1f / (2.2f * _e178.z)))), vec3(0f), vec3(1f));\n        }\n    }\n    let _e189 = A;\n    if (_e189 == 4i) {\n        {\n            let _e192 = c_7;\n            let _e194 = c_7;\n            let _e196 = c_7;\n            mx_1 = max(_e192.x, max(_e194.y, _e196.z));\n            let _e201 = c_7;\n            let _e203 = c_7;\n            let _e205 = c_7;\n            mn_1 = min(_e201.x, min(_e203.y, _e205.z));\n            let _e210 = mx_1;\n            let _e211 = mn_1;\n            sat = (_e210 - _e211);\n            let _e214 = c_7;\n            let _e215 = lum(_e214);\n            l_4 = _e215;\n            let _e219 = global.uP[0];\n            let _e222 = sat;\n            let _e227 = global.uP[0];\n            if (_e227.x > 0f) {\n                let _e234 = c_7;\n                let _e236 = c_7;\n                let _e240 = c_7;\n                let _e242 = c_7;\n                let _e246 = c_7;\n                let _e248 = c_7;\n                local_7 = (1f - (smoothstep(0.05f, 0.6f, ((abs((_e234.x - _e236.y)) * step(_e240.z, _e242.y)) * step(_e246.y, _e248.x))) * 0.5f));\n            } else {\n                local_7 = 1f;\n            }\n            let _e258 = local_7;\n            v = ((_e219.x * (1f - _e222)) * _e258);\n            let _e261 = l_4;\n            let _e263 = c_7;\n            let _e265 = v;\n            c_7 = mix(vec3(_e261), _e263, vec3((1f + _e265)));\n            let _e269 = c_7;\n            let _e270 = lum(_e269);\n            let _e272 = c_7;\n            let _e276 = global.uP[0];\n            c_7 = mix(vec3(_e270), _e272, vec3((1f + _e276.y)));\n            let _e281 = c_7;\n            return clamp(_e281, vec3(0f), vec3(1f));\n        }\n    }\n    let _e287 = A;\n    if (_e287 == 5i) {\n        {\n            let _e290 = c_7;\n            let _e291 = rgb2hsl(_e290);\n            h_3 = _e291;\n            let _e295 = global.uP[0];\n            if (_e295.w > 0.5f) {\n                {\n                    let _e302 = global.uP[0];\n                    h_3.x = fract(_e302.x);\n                    let _e309 = global.uP[0];\n                    h_3.y = clamp(((0.25f + (_e309.y * 0.75f)) + 0.25f), 0f, 1f);\n                }\n            } else {\n                {\n                    let _e320 = h_3;\n                    let _e324 = global.uP[0];\n                    h_3.x = fract((_e320.x + _e324.x));\n                    let _e329 = h_3;\n                    let _e334 = global.uP[0];\n                    h_3.y = clamp((_e329.y * (1f + _e334.y)), 0f, 1f);\n                }\n            }\n            let _e341 = h_3;\n            let _e342 = hsl2rgb(_e341);\n            c_7 = _e342;\n            let _e345 = global.uP[0];\n            L = _e345.z;\n            let _e348 = L;\n            if (_e348 >= 0f) {\n                let _e351 = c_7;\n                let _e354 = L;\n                local_8 = mix(_e351, vec3(1f), vec3(_e354));\n            } else {\n                let _e357 = c_7;\n                let _e359 = L;\n                local_8 = (_e357 * (1f + _e359));\n            }\n            let _e363 = local_8;\n            return _e363;\n        }\n    }\n    let _e364 = A;\n    if (_e364 == 6i) {\n        {\n            let _e367 = c_7;\n            let _e368 = lum(_e367);\n            l_5 = _e368;\n            let _e371 = l_5;\n            ws = clamp((1f - (_e371 * 3f)), 0f, 1f);\n            let _e379 = l_5;\n            wh = clamp(((_e379 * 3f) - 2f), 0f, 1f);\n            let _e389 = ws;\n            let _e391 = wh;\n            wm = ((1f - _e389) - _e391);\n            let _e396 = global.uP[0];\n            let _e398 = ws;\n            let _e402 = global.uP[1];\n            let _e404 = wm;\n            let _e409 = global.uP[2];\n            let _e411 = wh;\n            d_1 = (((_e396.xyz * _e398) + (_e402.xyz * _e404)) + (_e409.xyz * _e411));\n            let _e415 = c_7;\n            let _e416 = d_1;\n            o = clamp((_e415 + (_e416 * 0.3f)), vec3(0f), vec3(1f));\n            let _e428 = global.uP[0];\n            if (_e428.w > 0.5f) {\n                let _e432 = o;\n                let _e433 = l_5;\n                let _e434 = keepLum(_e432, _e433);\n                local_9 = _e434;\n            } else {\n                let _e435 = o;\n                local_9 = _e435;\n            }\n            let _e437 = local_9;\n            return _e437;\n        }\n    }\n    let _e438 = A;\n    if (_e438 == 7i) {\n        {\n            let _e441 = c_7;\n            let _e442 = rgb2hsl(_e441);\n            h_4 = _e442;\n            let _e444 = h_4;\n            hue = (_e444.x * 6f);\n            let _e451 = global.uP[0];\n            let _e455 = global.uP[0];\n            let _e459 = global.uP[0];\n            let _e463 = global.uP[0];\n            let _e467 = global.uP[1];\n            let _e471 = global.uP[1];\n            w0_ = array<f32, 6>(_e451.x, _e455.y, _e459.z, _e463.w, _e467.x, _e471.y);\n            let _e475 = hue;\n            i = (i32(floor(_e475)) % 6i);\n            let _e481 = hue;\n            t_2 = fract(_e481);\n            let _e484 = i;\n            let _e486 = w0_[_e484];\n            let _e487 = i;\n            let _e493 = w0_[((_e487 + 1i) % 6i)];\n            let _e494 = t_2;\n            w = mix(_e486, _e493, _e494);\n            let _e497 = c_7;\n            let _e499 = c_7;\n            let _e501 = c_7;\n            mx_2 = max(_e497.x, max(_e499.y, _e501.z));\n            let _e506 = c_7;\n            let _e508 = c_7;\n            let _e510 = c_7;\n            mn_2 = min(_e506.x, min(_e508.y, _e510.z));\n            let _e515 = mn_2;\n            let _e516 = mx_2;\n            let _e517 = mn_2;\n            let _e519 = w;\n            g = clamp((_e515 + ((_e516 - _e517) * _e519)), 0f, 1f);\n            let _e528 = global.uP[1];\n            if (_e528.z > 0.5f) {\n                let _e532 = g;\n                let _e537 = global.uP[2];\n                let _e543 = g;\n                local_10 = clamp((_e532 * mix(vec3(1f), (_e537.xyz * 2f), vec3((1f - abs(((2f * _e543) - 1f)))))), vec3(0f), vec3(1f));\n            } else {\n                let _e557 = g;\n                local_10 = vec3(_e557);\n            }\n            let _e560 = local_10;\n            return _e560;\n        }\n    }\n    let _e561 = A;\n    if (_e561 == 8i) {\n        {\n            let _e564 = c_7;\n            let _e565 = lum(_e564);\n            l_6 = _e565;\n            let _e567 = c_7;\n            let _e568 = c_7;\n            let _e571 = global.uP[0];\n            let _e578 = global.uP[0];\n            o_1 = mix(_e567, ((_e568 * _e571.xyz) * 1.6f), vec3(_e578.w));\n            let _e585 = global.uP[1];\n            if (_e585.x > 0.5f) {\n                let _e589 = o_1;\n                let _e590 = l_6;\n                let _e591 = keepLum(_e589, _e590);\n                local_11 = _e591;\n            } else {\n                let _e592 = o_1;\n                local_11 = clamp(_e592, vec3(0f), vec3(1f));\n            }\n            let _e599 = local_11;\n            return _e599;\n        }\n    }\n    let _e600 = A;\n    if (_e600 == 9i) {\n        {\n            let _e603 = c_7;\n            let _e606 = global.uP[0];\n            let _e611 = global.uP[0];\n            let _e614 = c_7;\n            let _e617 = global.uP[1];\n            let _e622 = global.uP[1];\n            let _e625 = c_7;\n            let _e628 = global.uP[2];\n            let _e633 = global.uP[2];\n            o_2 = vec3<f32>((dot(_e603, _e606.xyz) + _e611.w), (dot(_e614, _e617.xyz) + _e622.w), (dot(_e625, _e628.xyz) + _e633.w));\n            let _e640 = global.uP[3];\n            if (_e640.x > 0.5f) {\n                let _e644 = o_2;\n                local_12 = vec3(_e644.x);\n            } else {\n                let _e647 = o_2;\n                local_12 = _e647;\n            }\n            let _e649 = local_12;\n            return clamp(_e649, vec3(0f), vec3(1f));\n        }\n    }\n    let _e655 = A;\n    if (_e655 == 10i) {\n        {\n            let _e658 = c_7;\n            let _e660 = c_7;\n            let _e662 = c_7;\n            mx_3 = max(_e658.x, max(_e660.y, _e662.z));\n            let _e667 = c_7;\n            let _e669 = c_7;\n            let _e671 = c_7;\n            mn_3 = min(_e667.x, min(_e669.y, _e671.z));\n            let _e676 = c_7;\n            let _e678 = c_7;\n            let _e681 = c_7;\n            let _e684 = mx_3;\n            let _e686 = mn_3;\n            md = ((((_e676.x + _e678.y) + _e681.z) - _e684) - _e686);\n            let _e689 = c_7;\n            o_3 = _e689;\n            loop {\n                let _e693 = k_1;\n                if !((_e693 < 9i)) {\n                    break;\n                }\n                {\n                    let _e701 = k_1;\n                    if (_e701 == 0i) {\n                        let _e704 = c_7;\n                        let _e706 = mx_3;\n                        if (_e704.x == _e706) {\n                            let _e708 = mx_3;\n                            let _e709 = md;\n                            local_13 = (_e708 - _e709);\n                        } else {\n                            local_13 = 0f;\n                        }\n                        let _e713 = local_13;\n                        w_1 = _e713;\n                    } else {\n                        let _e714 = k_1;\n                        if (_e714 == 1i) {\n                            let _e717 = c_7;\n                            let _e719 = mn_3;\n                            if (_e717.z == _e719) {\n                                let _e721 = md;\n                                let _e722 = mn_3;\n                                local_14 = (_e721 - _e722);\n                            } else {\n                                local_14 = 0f;\n                            }\n                            let _e726 = local_14;\n                            w_1 = _e726;\n                        } else {\n                            let _e727 = k_1;\n                            if (_e727 == 2i) {\n                                let _e730 = c_7;\n                                let _e732 = mx_3;\n                                if (_e730.y == _e732) {\n                                    let _e734 = mx_3;\n                                    let _e735 = md;\n                                    local_15 = (_e734 - _e735);\n                                } else {\n                                    local_15 = 0f;\n                                }\n                                let _e739 = local_15;\n                                w_1 = _e739;\n                            } else {\n                                let _e740 = k_1;\n                                if (_e740 == 3i) {\n                                    let _e743 = c_7;\n                                    let _e745 = mn_3;\n                                    if (_e743.x == _e745) {\n                                        let _e747 = md;\n                                        let _e748 = mn_3;\n                                        local_16 = (_e747 - _e748);\n                                    } else {\n                                        local_16 = 0f;\n                                    }\n                                    let _e752 = local_16;\n                                    w_1 = _e752;\n                                } else {\n                                    let _e753 = k_1;\n                                    if (_e753 == 4i) {\n                                        let _e756 = c_7;\n                                        let _e758 = mx_3;\n                                        if (_e756.z == _e758) {\n                                            let _e760 = mx_3;\n                                            let _e761 = md;\n                                            local_17 = (_e760 - _e761);\n                                        } else {\n                                            local_17 = 0f;\n                                        }\n                                        let _e765 = local_17;\n                                        w_1 = _e765;\n                                    } else {\n                                        let _e766 = k_1;\n                                        if (_e766 == 5i) {\n                                            let _e769 = c_7;\n                                            let _e771 = mn_3;\n                                            if (_e769.y == _e771) {\n                                                let _e773 = md;\n                                                let _e774 = mn_3;\n                                                local_18 = (_e773 - _e774);\n                                            } else {\n                                                local_18 = 0f;\n                                            }\n                                            let _e778 = local_18;\n                                            w_1 = _e778;\n                                        } else {\n                                            let _e779 = k_1;\n                                            if (_e779 == 6i) {\n                                                let _e782 = mn_3;\n                                                w_1 = clamp(((_e782 - 0.5f) * 2f), 0f, 1f);\n                                            } else {\n                                                let _e790 = k_1;\n                                                if (_e790 == 7i) {\n                                                    let _e794 = mx_3;\n                                                    let _e798 = mn_3;\n                                                    w_1 = (1f - (abs((_e794 - 0.5f)) + abs((_e798 - 0.5f))));\n                                                } else {\n                                                    let _e805 = mx_3;\n                                                    w_1 = clamp(((0.5f - _e805) * 2f), 0f, 1f);\n                                                }\n                                            }\n                                        }\n                                    }\n                                }\n                            }\n                        }\n                    }\n                    let _e812 = k_1;\n                    let _e814 = global.uP[_e812];\n                    a = _e814;\n                    let _e816 = w_1;\n                    let _e819 = a;\n                    if ((_e816 <= 0f) || (dot(abs(_e819), vec4(1f)) == 0f)) {\n                        continue;\n                    }\n                    let _e828 = o_3;\n                    cmy = (vec3(1f) - _e828);\n                    let _e832 = a;\n                    let _e834 = a;\n                    v_1 = (_e832.xyz + vec3(_e834.w));\n                    let _e841 = global.uP[9];\n                    if (_e841.x > 0.5f) {\n                        let _e845 = v_1;\n                        local_19 = _e845;\n                    } else {\n                        let _e846 = v_1;\n                        let _e847 = cmy;\n                        let _e849 = cmy;\n                        let _e853 = v_1;\n                        local_19 = (_e846 * mix(_e847, (vec3(1f) - _e849), step(vec3(0f), _e853)));\n                    }\n                    let _e859 = local_19;\n                    amt = _e859;\n                    let _e862 = cmy;\n                    let _e863 = amt;\n                    let _e864 = w_1;\n                    o_3 = clamp((vec3(1f) - (_e862 + (_e863 * _e864))), vec3(0f), vec3(1f));\n                }\n                continuing {\n                    let _e697 = k_1;\n                    k_1 = (_e697 + 1i);\n                }\n            }\n            let _e874 = o_3;\n            return _e874;\n        }\n    }\n    let _e875 = A;\n    if (_e875 == 11i) {\n        let _e879 = c_7;\n        return (vec3(1f) - _e879);\n    }\n    let _e882 = A;\n    if (_e882 == 12i) {\n        {\n            let _e888 = global.uP[0];\n            n = max(2f, _e888.x);\n            let _e892 = c_7;\n            let _e893 = n;\n            let _e898 = n;\n            return (floor(((_e892 * _e893) * 0.9999f)) / vec3((_e898 - 1f)));\n        }\n    }\n    let _e903 = A;\n    if (_e903 == 13i) {\n        let _e908 = global.uP[0];\n        let _e910 = c_7;\n        let _e911 = lum(_e910);\n        return vec3(step(_e908.x, _e911));\n    }\n    let _e914 = A;\n    if (_e914 == 14i) {\n        let _e919 = global.uP[0];\n        let _e923 = global.uP[1];\n        let _e925 = c_7;\n        let _e926 = lum(_e925);\n        return mix(_e919.xyz, _e923.xyz, vec3(_e926));\n    }\n    let _e929 = A;\n    if (_e929 == 15i) {\n        {\n            let _e934 = global.uP[0];\n            n_1 = _e934.x;\n            let _e937 = n_1;\n            if (_e937 < 2f) {\n                let _e940 = c_7;\n                return _e940;\n            }\n            let _e941 = c_7;\n            let _e946 = n_1;\n            bz = (clamp(_e941.z, 0f, 1f) * (_e946 - 1f));\n            let _e951 = bz;\n            b0_ = floor(_e951);\n            let _e954 = b0_;\n            let _e957 = n_1;\n            b1_ = min((_e954 + 1f), (_e957 - 1f));\n            let _e962 = c_7;\n            let _e969 = n_1;\n            rg = ((clamp(_e962.xy, vec2(0f), vec2(1f)) * (_e969 - 1f)) + vec2(0.5f));\n            let _e977 = b0_;\n            let _e978 = n_1;\n            let _e980 = rg;\n            let _e983 = n_1;\n            let _e984 = n_1;\n            let _e987 = rg;\n            let _e989 = n_1;\n            let _e992 = textureSample(uLut, uLut_s, vec2<f32>((((_e977 * _e978) + _e980.x) / (_e983 * _e984)), (_e987.y / _e989)));\n            s0_ = _e992.xyz;\n            let _e995 = b1_;\n            let _e996 = n_1;\n            let _e998 = rg;\n            let _e1001 = n_1;\n            let _e1002 = n_1;\n            let _e1005 = rg;\n            let _e1007 = n_1;\n            let _e1010 = textureSample(uLut, uLut_s, vec2<f32>((((_e995 * _e996) + _e998.x) / (_e1001 * _e1002)), (_e1005.y / _e1007)));\n            s1_ = _e1010.xyz;\n            let _e1013 = s0_;\n            let _e1014 = s1_;\n            let _e1015 = bz;\n            let _e1016 = b0_;\n            return mix(_e1013, _e1014, vec3((_e1015 - _e1016)));\n        }\n    }\n    let _e1020 = c_7;\n    return _e1020;\n}\n\nfn main_1() {\n    var local_20: f32;\n\n    let _e15 = gl_FragCoord_1;\n    let _e17 = global.frFlip;\n    if (_e17 > 0.5f) {\n        let _e20 = global.frH;\n        let _e21 = gl_FragCoord_1;\n        local_20 = (_e20 - _e21.y);\n    } else {\n        let _e24 = gl_FragCoord_1;\n        local_20 = _e24.y;\n    }\n    let _e27 = local_20;\n    let _e28 = gl_FragCoord_1;\n    let _e29 = _e28.zw;\n    frFC = vec4<f32>(_e15.x, _e27, _e29.x, _e29.y);\n    let _e33 = frFC;\n    let _e37 = textureLoad(uBack, vec2<i32>(_e33.xy), 0i);\n    let _e39 = adjust(_e37.xyz);\n    o_4 = vec4<f32>(_e39.x, _e39.y, _e39.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e23 = o_4;\n    return FragmentOutput(_e23);\n}\n",
  "size": 224,
  "uniforms": {
   "uAdj": [
    0,
    "float",
    0
   ],
   "uP": [
    16,
    "vec4",
    12
   ],
   "frFlip": [
    208,
    "float",
    0
   ],
   "frH": [
    212,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uBack",
    1,
    2,
    false
   ],
   [
    "uLut",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "fxBlur": {
  "hash": "3006eb28",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uDir: vec2<f32>,\n    uSize: vec2<f32>,\n    uSigma: f32,\n    uMode: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var uv: vec2<f32>;\n    var local_1: f32;\n    var r: f32;\n    var n: f32;\n    var stepPx: f32;\n    var acc: vec4<f32> = vec4(0f);\n    var wsum: f32 = 0f;\n    var m: vec4<f32>;\n    var i: f32;\n    var c: vec4<f32>;\n    var local_2: f32;\n    var w: f32;\n    var local_3: vec4<f32>;\n\n    let _e17 = gl_FragCoord_1;\n    let _e19 = global.frFlip;\n    if (_e19 > 0.5f) {\n        let _e22 = global.frH;\n        let _e23 = gl_FragCoord_1;\n        local = (_e22 - _e23.y);\n    } else {\n        let _e26 = gl_FragCoord_1;\n        local = _e26.y;\n    }\n    let _e29 = local;\n    let _e30 = gl_FragCoord_1;\n    let _e31 = _e30.zw;\n    frFC = vec4<f32>(_e17.x, _e29, _e31.x, _e31.y);\n    let _e35 = frFC;\n    let _e37 = global.uSize;\n    uv = (_e35.xy / _e37);\n    let _e40 = global.uMode;\n    if (_e40 < 0.5f) {\n        let _e43 = global.uSigma;\n        local_1 = (_e43 * 3f);\n    } else {\n        let _e46 = global.uSigma;\n        local_1 = _e46;\n    }\n    let _e48 = local_1;\n    r = _e48;\n    let _e50 = r;\n    n = min(_e50, 48f);\n    let _e55 = r;\n    stepPx = max(1f, (_e55 / 48f));\n    let _e65 = uv;\n    let _e66 = textureSample(uTex, uTex_s, _e65);\n    m = _e66;\n    let _e68 = n;\n    i = -(_e68);\n    loop {\n        let _e71 = i;\n        let _e72 = n;\n        if !((_e71 <= _e72)) {\n            break;\n        }\n        {\n            let _e78 = uv;\n            let _e79 = global.uDir;\n            let _e80 = i;\n            let _e82 = stepPx;\n            let _e84 = global.uSize;\n            let _e87 = textureSample(uTex, uTex_s, (_e78 + (((_e79 * _e80) * _e82) / _e84)));\n            c = _e87;\n            let _e89 = global.uMode;\n            if (_e89 > 2.5f) {\n                let _e92 = m;\n                let _e93 = c;\n                m = min(_e92, _e93);\n            } else {\n                let _e95 = global.uMode;\n                if (_e95 > 1.5f) {\n                    let _e98 = m;\n                    let _e99 = c;\n                    m = max(_e98, _e99);\n                } else {\n                    {\n                        let _e101 = global.uMode;\n                        if (_e101 < 0.5f) {\n                            let _e106 = i;\n                            let _e107 = stepPx;\n                            let _e110 = i;\n                            let _e111 = stepPx;\n                            let _e114 = global.uSigma;\n                            let _e115 = global.uSigma;\n                            local_2 = exp((((-0.5f * (_e106 * _e107)) * (_e110 * _e111)) / max((_e114 * _e115), 0.0001f)));\n                        } else {\n                            local_2 = 1f;\n                        }\n                        let _e123 = local_2;\n                        w = _e123;\n                        let _e125 = acc;\n                        let _e126 = c;\n                        let _e127 = w;\n                        acc = (_e125 + (_e126 * _e127));\n                        let _e130 = wsum;\n                        let _e131 = w;\n                        wsum = (_e130 + _e131);\n                    }\n                }\n            }\n        }\n        continuing {\n            let _e75 = i;\n            i = (_e75 + 1f);\n        }\n    }\n    let _e133 = global.uMode;\n    if (_e133 > 1.5f) {\n        let _e136 = m;\n        local_3 = _e136;\n    } else {\n        let _e137 = acc;\n        let _e138 = wsum;\n        local_3 = (_e137 / vec4(max(_e138, 0.000001f)));\n    }\n    let _e144 = local_3;\n    o = _e144;\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e23 = o;\n    return FragmentOutput(_e23);\n}\n",
  "size": 32,
  "uniforms": {
   "uDir": [
    0,
    "vec2",
    0
   ],
   "uSize": [
    8,
    "vec2",
    0
   ],
   "uSigma": [
    16,
    "float",
    0
   ],
   "uMode": [
    20,
    "float",
    0
   ],
   "frFlip": [
    24,
    "float",
    0
   ],
   "frH": [
    28,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "fx": {
  "hash": "afd4c5cd",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOutSize: vec2<f32>,\n    uOriSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uOut2Ori: mat3x3<f32>,\n    uOri2Out: mat3x3<f32>,\n    uFx: f32,\n    uK: f32,\n    uUseSel: f32,\n    uSeed: f32,\n    uP: vec4<f32>,\n    uFg: vec3<f32>,\n    uBg: vec3<f32>,\n    uCenter: vec3<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uBlur: texture_2d<f32>;\n@group(0) @binding(4) \nvar uBlur_s: sampler;\n@group(0) @binding(5) \nvar uSel: texture_2d<f32>;\n@group(0) @binding(6) \nvar uSel_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toOri(p: vec2<f32>) -> vec2<f32> {\n    var p_1: vec2<f32>;\n\n    p_1 = p;\n    let _e40 = global.uOut2Ori;\n    let _e41 = p_1;\n    return (_e40 * vec3<f32>(_e41.x, _e41.y, 1f)).xy;\n}\n\nfn at(p_2: vec2<f32>) -> vec4<f32> {\n    var p_3: vec2<f32>;\n\n    p_3 = p_2;\n    let _e40 = p_3;\n    let _e41 = global.uOutSize;\n    let _e43 = textureSample(uTex, uTex_s, (_e40 / _e41));\n    return _e43;\n}\n\nfn atOri(q: vec2<f32>) -> vec4<f32> {\n    var q_1: vec2<f32>;\n\n    q_1 = q;\n    let _e40 = global.uOri2Out;\n    let _e41 = q_1;\n    let _e48 = at((_e40 * vec3<f32>(_e41.x, _e41.y, 1f)).xy);\n    return _e48;\n}\n\nfn hash(p_4: vec2<f32>) -> f32 {\n    var p_5: vec2<f32>;\n\n    p_5 = p_4;\n    let _e40 = p_5;\n    p_5 = fract((_e40 * vec2<f32>(123.34f, 456.21f)));\n    let _e46 = p_5;\n    let _e47 = p_5;\n    let _e48 = p_5;\n    let _e52 = global.uSeed;\n    p_5 = (_e46 + vec2(dot(_e47, ((_e48 + vec2(45.32f)) + vec2(_e52)))));\n    let _e58 = p_5;\n    let _e60 = p_5;\n    return fract((_e58.x * _e60.y));\n}\n\nfn hash2_(p_6: vec2<f32>) -> vec2<f32> {\n    var p_7: vec2<f32>;\n\n    p_7 = p_6;\n    let _e40 = p_7;\n    let _e41 = hash(_e40);\n    let _e42 = p_7;\n    let _e46 = hash((_e42 + vec2(17.7f)));\n    return vec2<f32>(_e41, _e46);\n}\n\nfn vnoise(p_8: vec2<f32>) -> f32 {\n    var p_9: vec2<f32>;\n    var i: vec2<f32>;\n    var f: vec2<f32>;\n\n    p_9 = p_8;\n    let _e40 = p_9;\n    i = floor(_e40);\n    let _e43 = p_9;\n    f = fract(_e43);\n    let _e46 = f;\n    let _e47 = f;\n    let _e51 = f;\n    f = ((_e46 * _e47) * (vec2(3f) - (2f * _e51)));\n    let _e56 = i;\n    let _e57 = hash(_e56);\n    let _e58 = i;\n    let _e65 = hash((_e58 + vec2<f32>(1f, 0f)));\n    let _e66 = f;\n    let _e69 = i;\n    let _e76 = hash((_e69 + vec2<f32>(0f, 1f)));\n    let _e77 = i;\n    let _e84 = hash((_e77 + vec2<f32>(1f, 1f)));\n    let _e85 = f;\n    let _e88 = f;\n    return mix(mix(_e57, _e65, _e66.x), mix(_e76, _e84, _e85.x), _e88.y);\n}\n\nfn lum(c: vec3<f32>) -> f32 {\n    var c_1: vec3<f32>;\n\n    c_1 = c;\n    let _e40 = c_1;\n    return dot(_e40, vec3<f32>(0.3f, 0.59f, 0.11f));\n}\n\nfn un(c_2: vec4<f32>) -> vec4<f32> {\n    var c_3: vec4<f32>;\n\n    c_3 = c_2;\n    let _e40 = c_3;\n    let _e42 = c_3;\n    let _e47 = (_e40.xyz / vec3(max(_e42.w, 0.00001f)));\n    let _e48 = c_3;\n    return vec4<f32>(_e47.x, _e47.y, _e47.z, _e48.w);\n}\n\nfn pre(c_4: vec4<f32>) -> vec4<f32> {\n    var c_5: vec4<f32>;\n\n    c_5 = c_4;\n    let _e40 = c_5;\n    let _e42 = c_5;\n    let _e44 = (_e40.xyz * _e42.w);\n    let _e45 = c_5;\n    return vec4<f32>(_e44.x, _e44.y, _e44.z, _e45.w);\n}\n\nfn main_1() {\n    var local: f32;\n    var p_10: vec2<f32>;\n    var q_2: vec2<f32>;\n    var c_6: vec4<f32>;\n    var b: vec4<f32>;\n    var fx: i32;\n    var r: vec4<f32>;\n    var cen: vec2<f32>;\n    var rad: f32;\n    var d: f32;\n    var a: f32;\n    var n: vec2<f32>;\n    var c0_: vec2<f32>;\n    var c0_1: vec2<f32>;\n    var w: f32;\n    var d_1: vec4<f32>;\n    var t: f32;\n    var local_1: vec4<f32>;\n    var rr: f32;\n    var t_1: f32;\n    var st: f32;\n    var acc: vec4<f32> = vec4(0f);\n    var ws: f32 = 0f;\n    var j: f32 = -6f;\n    var i_1: f32;\n    var d_2: vec2<f32>;\n    var s: vec4<f32>;\n    var w_1: f32;\n    var st_1: f32;\n    var v: array<vec4<f32>, 9>;\n    var k: i32 = 0i;\n    var j_1: i32 = -1i;\n    var i_2: i32;\n    var a_1: i32 = 0i;\n    var bb: i32;\n    var lo: vec4<f32>;\n    var cell: vec2<f32>;\n    var g: vec2<f32>;\n    var best: f32 = 1000000000f;\n    var bp: vec2<f32>;\n    var j_2: i32 = -1i;\n    var i_3: i32;\n    var cc: vec2<f32>;\n    var pt: vec2<f32>;\n    var d_3: f32;\n    var u: vec4<f32>;\n    var res: vec3<f32>;\n    var ang: array<f32, 3> = array<f32, 3>(108f, 162f, 90f);\n    var ch: i32 = 0i;\n    var a_2: f32;\n    var R: mat2x2<f32>;\n    var rq: vec2<f32>;\n    var cell_1: vec2<f32>;\n    var s_1: vec4<f32>;\n    var ink: f32;\n    var d_4: f32;\n    var local_2: f32;\n    var d_5: vec2<f32>;\n    var l: f32;\n    var src: vec2<f32>;\n    var local_3: f32;\n    var e: f32;\n    var a_3: f32;\n    var s_2: f32;\n    var a_4: f32;\n    var n_1: vec2<f32>;\n    var ph: f32;\n    var acc_1: vec4<f32> = vec4(0f);\n    var i_4: i32 = 0i;\n    var t_2: f32;\n    var local_4: vec2<f32>;\n    var src_1: vec2<f32>;\n    var g_1: vec2<f32>;\n    var h4_: vec4<f32>;\n    var local_5: vec3<f32>;\n    var n_2: vec3<f32>;\n    var u_1: vec4<f32>;\n    var s_3: vec2<f32>;\n    var v_1: f32 = 0f;\n    var amp: f32 = 0.5f;\n    var i_5: i32 = 0i;\n    var fp: vec2<f32>;\n    var mid: vec2<f32>;\n    var L: f32;\n    var d_6: f32;\n    var glow: f32;\n    var ring: f32;\n    var spots: f32 = 0f;\n    var i_6: i32 = 1i;\n    var sp: vec2<f32>;\n    var add: vec3<f32>;\n    var a_5: f32;\n    var d_7: vec2<f32>;\n    var g_2: f32;\n    var gx: vec3<f32>;\n    var gy: vec3<f32>;\n    var u_2: vec4<f32>;\n    var rr_1: f32;\n    var st_2: f32;\n    var bestM: vec3<f32>;\n    var bestV: f32 = 1000000000f;\n    var k_1: i32 = 0i;\n    var local_6: f32;\n    var local_7: f32;\n    var sg: vec2<f32>;\n    var m: vec3<f32>;\n    var m2_: vec3<f32>;\n    var j_3: f32;\n    var i_7: f32;\n    var s_4: vec3<f32>;\n    var v_2: f32;\n\n    let _e39 = gl_FragCoord_1;\n    let _e41 = global.frFlip;\n    if (_e41 > 0.5f) {\n        let _e44 = global.frH;\n        let _e45 = gl_FragCoord_1;\n        local = (_e44 - _e45.y);\n    } else {\n        let _e48 = gl_FragCoord_1;\n        local = _e48.y;\n    }\n    let _e51 = local;\n    let _e52 = gl_FragCoord_1;\n    let _e53 = _e52.zw;\n    frFC = vec4<f32>(_e39.x, _e51, _e53.x, _e53.y);\n    let _e57 = frFC;\n    p_10 = _e57.xy;\n    let _e60 = p_10;\n    let _e61 = toOri(_e60);\n    q_2 = _e61;\n    let _e63 = p_10;\n    let _e64 = at(_e63);\n    c_6 = _e64;\n    let _e66 = p_10;\n    let _e67 = global.uOutSize;\n    let _e69 = global.uScale;\n    let _e71 = textureSample(uBlur, uBlur_s, ((_e66 / _e67) * _e69));\n    b = _e71;\n    let _e73 = global.uFx;\n    fx = i32((_e73 + 0.5f));\n    let _e78 = c_6;\n    r = _e78;\n    let _e80 = global.uCenter;\n    cen = _e80.xy;\n    let _e83 = global.uCenter;\n    rad = max(_e83.z, 1f);\n    let _e88 = fx;\n    if (_e88 == 1i) {\n        let _e91 = b;\n        r = _e91;\n    } else {\n        let _e92 = fx;\n        let _e95 = fx;\n        if ((_e92 == 2i) || (_e95 == 3i)) {\n            {\n                let _e100 = fx;\n                if (_e100 == 2i) {\n                    {\n                        let _e103 = global.uP;\n                        a = radians(_e103.w);\n                        let _e107 = a;\n                        let _e110 = a;\n                        n = vec2<f32>(-(sin(_e107)), cos(_e110));\n                        let _e114 = global.uOriSize;\n                        let _e118 = global.uOriSize;\n                        let _e120 = global.uP;\n                        c0_ = vec2<f32>((_e114.x * 0.5f), (_e118.y * _e120.x));\n                        let _e125 = q_2;\n                        let _e126 = c0_;\n                        let _e128 = n;\n                        let _e131 = global.uOriSize;\n                        d = (abs(dot((_e125 - _e126), _e128)) / _e131.y);\n                    }\n                } else {\n                    {\n                        let _e134 = global.uP;\n                        let _e136 = global.uOriSize;\n                        c0_1 = (_e134.xy * _e136);\n                        let _e139 = q_2;\n                        let _e140 = c0_1;\n                        let _e142 = global.uOriSize;\n                        let _e144 = global.uOriSize;\n                        d = length(((_e139 - _e140) / vec2(max(_e142.x, _e144.y))));\n                    }\n                }\n                let _e150 = global.uP;\n                let _e154 = global.uP;\n                let _e158 = global.uP;\n                let _e165 = d;\n                w = smoothstep((_e150.y * 0.5f), (((_e154.y * 0.5f) + (_e158.z * 0.5f)) + 0.0001f), _e165);\n                let _e168 = c_6;\n                let _e169 = b;\n                let _e170 = w;\n                r = mix(_e168, _e169, vec4(_e170));\n            }\n        } else {\n            let _e173 = fx;\n            if (_e173 == 4i) {\n                {\n                    let _e176 = c_6;\n                    let _e177 = b;\n                    d_1 = (_e176 - _e177);\n                    let _e180 = global.uP;\n                    t = _e180.y;\n                    let _e183 = d_1;\n                    let _e185 = lum(_e183.xyz);\n                    let _e187 = t;\n                    if (abs(_e185) > _e187) {\n                        let _e189 = c_6;\n                        let _e190 = d_1;\n                        let _e191 = global.uP;\n                        local_1 = clamp((_e189 + (_e190 * _e191.x)), vec4(0f), vec4(1f));\n                    } else {\n                        let _e200 = c_6;\n                        local_1 = _e200;\n                    }\n                    let _e202 = local_1;\n                    r = _e202;\n                    let _e203 = r;\n                    let _e205 = r;\n                    let _e207 = r;\n                    let _e210 = min(_e205.xyz, vec3(_e207.w));\n                    r.x = _e210.x;\n                    r.y = _e210.y;\n                    r.z = _e210.z;\n                }\n            } else {\n                let _e217 = fx;\n                if (_e217 == 5i) {\n                    {\n                        let _e220 = c_6;\n                        let _e222 = b;\n                        let _e226 = c_6;\n                        let _e235 = clamp(((_e220.xyz - _e222.xyz) + vec3((0.5f * _e226.w))), vec3(0f), vec3(1f));\n                        let _e236 = c_6;\n                        r = vec4<f32>(_e235.x, _e235.y, _e235.z, _e236.w);\n                        let _e242 = r;\n                        let _e244 = r;\n                        let _e246 = r;\n                        let _e249 = min(_e244.xyz, vec3(_e246.w));\n                        r.x = _e249.x;\n                        r.y = _e249.y;\n                        r.z = _e249.z;\n                    }\n                } else {\n                    let _e256 = fx;\n                    if (_e256 == 6i) {\n                        {\n                            let _e259 = global.uP;\n                            let _e261 = global.uK;\n                            rr = (_e259.x * _e261);\n                            let _e264 = global.uP;\n                            t_1 = _e264.y;\n                            let _e268 = rr;\n                            st = max(1f, (_e268 / 6f));\n                            loop {\n                                let _e281 = j;\n                                if !((_e281 <= 6f)) {\n                                    break;\n                                }\n                                i_1 = -6f;\n                                loop {\n                                    let _e291 = i_1;\n                                    if !((_e291 <= 6f)) {\n                                        break;\n                                    }\n                                    {\n                                        let _e298 = i_1;\n                                        let _e299 = j;\n                                        let _e301 = st;\n                                        d_2 = (vec2<f32>(_e298, _e299) * _e301);\n                                        let _e304 = d_2;\n                                        let _e306 = rr;\n                                        if (length(_e304) > (_e306 + 0.5f)) {\n                                            continue;\n                                        }\n                                        let _e310 = p_10;\n                                        let _e311 = d_2;\n                                        let _e313 = at((_e310 + _e311));\n                                        s = _e313;\n                                        let _e317 = s;\n                                        let _e319 = c_6;\n                                        let _e324 = t_1;\n                                        w_1 = max(0f, (1f - (length((_e317.xyz - _e319.xyz)) / (2.5f * _e324))));\n                                        let _e330 = acc;\n                                        let _e331 = s;\n                                        let _e332 = w_1;\n                                        acc = (_e330 + (_e331 * _e332));\n                                        let _e335 = ws;\n                                        let _e336 = w_1;\n                                        ws = (_e335 + _e336);\n                                    }\n                                    continuing {\n                                        let _e295 = i_1;\n                                        i_1 = (_e295 + 1f);\n                                    }\n                                }\n                                continuing {\n                                    let _e285 = j;\n                                    j = (_e285 + 1f);\n                                }\n                            }\n                            let _e338 = acc;\n                            let _e339 = ws;\n                            r = (_e338 / vec4(max(_e339, 0.00001f)));\n                        }\n                    } else {\n                        let _e344 = fx;\n                        if (_e344 == 7i) {\n                            {\n                                let _e348 = global.uP;\n                                let _e350 = global.uK;\n                                st_1 = max(1f, (_e348.x * _e350));\n                                loop {\n                                    let _e360 = j_1;\n                                    if !((_e360 <= 1i)) {\n                                        break;\n                                    }\n                                    i_2 = -1i;\n                                    loop {\n                                        let _e370 = i_2;\n                                        if !((_e370 <= 1i)) {\n                                            break;\n                                        }\n                                        let _e377 = k;\n                                        k = (_e377 + 1i);\n                                        let _e381 = p_10;\n                                        let _e382 = i_2;\n                                        let _e383 = j_1;\n                                        let _e387 = st_1;\n                                        let _e390 = at((_e381 + (vec2<f32>(f32(_e382), f32(_e383)) * _e387)));\n                                        v[_e377] = _e390;\n                                        continuing {\n                                            let _e374 = i_2;\n                                            i_2 = (_e374 + 1i);\n                                        }\n                                    }\n                                    continuing {\n                                        let _e364 = j_1;\n                                        j_1 = (_e364 + 1i);\n                                    }\n                                }\n                                loop {\n                                    let _e393 = a_1;\n                                    if !((_e393 < 9i)) {\n                                        break;\n                                    }\n                                    let _e400 = a_1;\n                                    bb = (_e400 + 1i);\n                                    loop {\n                                        let _e404 = bb;\n                                        if !((_e404 < 9i)) {\n                                            break;\n                                        }\n                                        {\n                                            let _e411 = a_1;\n                                            let _e413 = v[_e411];\n                                            let _e414 = bb;\n                                            let _e416 = v[_e414];\n                                            lo = min(_e413, _e416);\n                                            let _e419 = bb;\n                                            let _e421 = a_1;\n                                            let _e423 = v[_e421];\n                                            let _e424 = bb;\n                                            let _e426 = v[_e424];\n                                            v[_e419] = max(_e423, _e426);\n                                            let _e428 = a_1;\n                                            let _e430 = lo;\n                                            v[_e428] = _e430;\n                                        }\n                                        continuing {\n                                            let _e408 = bb;\n                                            bb = (_e408 + 1i);\n                                        }\n                                    }\n                                    continuing {\n                                        let _e397 = a_1;\n                                        a_1 = (_e397 + 1i);\n                                    }\n                                }\n                                let _e433 = v[4];\n                                r = _e433;\n                                let _e434 = global.uP;\n                                let _e438 = r;\n                                let _e440 = c_6;\n                                let _e444 = global.uP;\n                                if ((_e434.y > 0f) && (length((_e438.xyz - _e440.xyz)) < _e444.y)) {\n                                    let _e448 = c_6;\n                                    r = _e448;\n                                }\n                            }\n                        } else {\n                            let _e449 = fx;\n                            if (_e449 == 8i) {\n                                {\n                                    let _e452 = q_2;\n                                    let _e453 = global.uP;\n                                    let _e461 = global.uP;\n                                    cell = ((floor((_e452 / vec2(_e453.x))) + vec2(0.5f)) * _e461.x);\n                                    let _e465 = cell;\n                                    let _e466 = atOri(_e465);\n                                    r = _e466;\n                                }\n                            } else {\n                                let _e467 = fx;\n                                if (_e467 == 9i) {\n                                    {\n                                        let _e470 = q_2;\n                                        let _e471 = global.uP;\n                                        g = floor((_e470 / vec2(_e471.x)));\n                                        let _e479 = q_2;\n                                        bp = _e479;\n                                        loop {\n                                            let _e484 = j_2;\n                                            if !((_e484 <= 1i)) {\n                                                break;\n                                            }\n                                            i_3 = -1i;\n                                            loop {\n                                                let _e494 = i_3;\n                                                if !((_e494 <= 1i)) {\n                                                    break;\n                                                }\n                                                {\n                                                    let _e501 = g;\n                                                    let _e502 = i_3;\n                                                    let _e503 = j_2;\n                                                    cc = (_e501 + vec2<f32>(f32(_e502), f32(_e503)));\n                                                    let _e509 = cc;\n                                                    let _e510 = cc;\n                                                    let _e511 = hash2_(_e510);\n                                                    let _e513 = global.uP;\n                                                    pt = ((_e509 + _e511) * _e513.x);\n                                                    let _e517 = pt;\n                                                    let _e518 = q_2;\n                                                    d_3 = distance(_e517, _e518);\n                                                    let _e521 = d_3;\n                                                    let _e522 = best;\n                                                    if (_e521 < _e522) {\n                                                        {\n                                                            let _e524 = d_3;\n                                                            best = _e524;\n                                                            let _e525 = pt;\n                                                            bp = _e525;\n                                                        }\n                                                    }\n                                                }\n                                                continuing {\n                                                    let _e498 = i_3;\n                                                    i_3 = (_e498 + 1i);\n                                                }\n                                            }\n                                            continuing {\n                                                let _e488 = j_2;\n                                                j_2 = (_e488 + 1i);\n                                            }\n                                        }\n                                        let _e526 = bp;\n                                        let _e527 = atOri(_e526);\n                                        r = _e527;\n                                    }\n                                } else {\n                                    let _e528 = fx;\n                                    if (_e528 == 10i) {\n                                        {\n                                            let _e531 = c_6;\n                                            let _e532 = un(_e531);\n                                            u = _e532;\n                                            loop {\n                                                let _e542 = ch;\n                                                if !((_e542 < 3i)) {\n                                                    break;\n                                                }\n                                                {\n                                                    let _e549 = ch;\n                                                    let _e551 = ang[_e549];\n                                                    a_2 = radians(_e551);\n                                                    let _e554 = a_2;\n                                                    let _e556 = a_2;\n                                                    let _e559 = a_2;\n                                                    let _e561 = a_2;\n                                                    R = mat2x2<f32>(vec2<f32>(cos(_e554), -(sin(_e556))), vec2<f32>(sin(_e559), cos(_e561)));\n                                                    let _e567 = R;\n                                                    let _e568 = q_2;\n                                                    rq = (_e567 * _e568);\n                                                    let _e571 = rq;\n                                                    let _e572 = global.uP;\n                                                    let _e582 = global.uP;\n                                                    cell_1 = (((floor((_e571 / vec2((_e572.x * 2f)))) + vec2(0.5f)) * _e582.x) * 2f);\n                                                    let _e588 = R;\n                                                    let _e590 = cell_1;\n                                                    let _e592 = atOri((transpose(_e588) * _e590));\n                                                    let _e593 = un(_e592);\n                                                    s_1 = _e593;\n                                                    let _e596 = ch;\n                                                    let _e598 = s_1[_e596];\n                                                    ink = (1f - _e598);\n                                                    let _e601 = rq;\n                                                    let _e602 = cell_1;\n                                                    let _e604 = global.uP;\n                                                    d_4 = (distance(_e601, _e602) / _e604.x);\n                                                    let _e608 = ch;\n                                                    let _e610 = d_4;\n                                                    let _e611 = ink;\n                                                    if (_e610 < (sqrt(_e611) * 1.2f)) {\n                                                        local_2 = 0f;\n                                                    } else {\n                                                        local_2 = 1f;\n                                                    }\n                                                    let _e619 = local_2;\n                                                    res[_e608] = _e619;\n                                                }\n                                                continuing {\n                                                    let _e546 = ch;\n                                                    ch = (_e546 + 1i);\n                                                }\n                                            }\n                                            let _e620 = res;\n                                            let _e621 = u;\n                                            let _e627 = pre(vec4<f32>(_e620.x, _e620.y, _e620.z, _e621.w));\n                                            r = _e627;\n                                        }\n                                    } else {\n                                        let _e628 = fx;\n                                        let _e631 = fx;\n                                        if ((_e628 >= 11i) && (_e631 <= 15i)) {\n                                            {\n                                                let _e635 = q_2;\n                                                let _e636 = cen;\n                                                let _e638 = rad;\n                                                d_5 = ((_e635 - _e636) / vec2(_e638));\n                                                let _e642 = d_5;\n                                                l = length(_e642);\n                                                let _e645 = q_2;\n                                                src = _e645;\n                                                let _e647 = fx;\n                                                let _e650 = fx;\n                                                let _e654 = l;\n                                                let _e658 = l;\n                                                if ((((_e647 == 11i) || (_e650 == 12i)) && (_e654 < 1f)) && (_e658 > 0f)) {\n                                                    {\n                                                        let _e662 = fx;\n                                                        if (_e662 == 11i) {\n                                                            let _e666 = global.uP;\n                                                            local_3 = (1f - (_e666.x * 0.5f));\n                                                        } else {\n                                                            let _e672 = global.uP;\n                                                            local_3 = (1f + (_e672.x * 0.6f));\n                                                        }\n                                                        let _e678 = local_3;\n                                                        e = _e678;\n                                                        let _e680 = cen;\n                                                        let _e681 = d_5;\n                                                        let _e682 = rad;\n                                                        let _e684 = l;\n                                                        let _e685 = e;\n                                                        let _e688 = l;\n                                                        let _e692 = q_2;\n                                                        let _e695 = l;\n                                                        src = mix((_e680 + (((_e681 * _e682) * pow(_e684, _e685)) / vec2(_e688))), _e692, vec2(smoothstep(0.85f, 1f, _e695)));\n                                                    }\n                                                } else {\n                                                    let _e699 = fx;\n                                                    let _e702 = l;\n                                                    if ((_e699 == 13i) && (_e702 < 1f)) {\n                                                        {\n                                                            let _e706 = global.uP;\n                                                            let _e710 = l;\n                                                            let _e714 = l;\n                                                            a_3 = ((radians(_e706.x) * (1f - _e710)) * (1f - _e714));\n                                                            let _e718 = cen;\n                                                            let _e719 = a_3;\n                                                            let _e721 = a_3;\n                                                            let _e723 = a_3;\n                                                            let _e726 = a_3;\n                                                            let _e731 = q_2;\n                                                            let _e732 = cen;\n                                                            src = (_e718 + (mat2x2<f32>(vec2<f32>(cos(_e719), sin(_e721)), vec2<f32>(-(sin(_e723)), cos(_e726))) * (_e731 - _e732)));\n                                                        }\n                                                    } else {\n                                                        let _e736 = fx;\n                                                        if (_e736 == 14i) {\n                                                            {\n                                                                let _e741 = global.uP;\n                                                                s_2 = (6f * (4f - _e741.y));\n                                                                let _e746 = q_2;\n                                                                let _e747 = global.uP;\n                                                                let _e751 = q_2;\n                                                                let _e753 = s_2;\n                                                                let _e756 = q_2;\n                                                                let _e758 = s_2;\n                                                                src = (_e746 + ((_e747.x * 6f) * vec2<f32>(sin((_e751.y / _e753)), sin((_e756.x / _e758)))));\n                                                            }\n                                                        } else {\n                                                            let _e764 = fx;\n                                                            if (_e764 == 15i) {\n                                                                {\n                                                                    let _e767 = global.uP;\n                                                                    a_4 = radians(_e767.z);\n                                                                    let _e771 = a_4;\n                                                                    let _e773 = a_4;\n                                                                    n_1 = vec2<f32>(cos(_e771), sin(_e773));\n                                                                    let _e777 = q_2;\n                                                                    let _e778 = n_1;\n                                                                    let _e781 = n_1;\n                                                                    let _e787 = global.uP;\n                                                                    ph = ((dot(_e777, vec2<f32>(-(_e778.y), _e781.x)) * 6.28318f) / max(_e787.x, 1f));\n                                                                    let _e793 = q_2;\n                                                                    let _e794 = n_1;\n                                                                    let _e795 = ph;\n                                                                    let _e798 = global.uP;\n                                                                    src = (_e793 + ((_e794 * sin(_e795)) * _e798.y));\n                                                                }\n                                                            }\n                                                        }\n                                                    }\n                                                }\n                                                let _e802 = src;\n                                                let _e803 = atOri(_e802);\n                                                r = _e803;\n                                            }\n                                        } else {\n                                            let _e804 = fx;\n                                            if (_e804 == 16i) {\n                                                {\n                                                    loop {\n                                                        let _e812 = i_4;\n                                                        if !((_e812 < 32i)) {\n                                                            break;\n                                                        }\n                                                        {\n                                                            let _e819 = i_4;\n                                                            let _e825 = global.uP;\n                                                            t_2 = ((((f32(_e819) / 31f) - 0.5f) * _e825.x) / 100f);\n                                                            let _e831 = global.uP;\n                                                            if (_e831.y > 0.5f) {\n                                                                let _e835 = cen;\n                                                                let _e836 = q_2;\n                                                                let _e837 = cen;\n                                                                let _e840 = t_2;\n                                                                local_4 = (_e835 + ((_e836 - _e837) * (1f + (_e840 * 0.6f))));\n                                                            } else {\n                                                                let _e846 = cen;\n                                                                let _e847 = t_2;\n                                                                let _e849 = t_2;\n                                                                let _e851 = t_2;\n                                                                let _e854 = t_2;\n                                                                let _e859 = q_2;\n                                                                let _e860 = cen;\n                                                                local_4 = (_e846 + (mat2x2<f32>(vec2<f32>(cos(_e847), sin(_e849)), vec2<f32>(-(sin(_e851)), cos(_e854))) * (_e859 - _e860)));\n                                                            }\n                                                            let _e865 = local_4;\n                                                            src_1 = _e865;\n                                                            let _e867 = acc_1;\n                                                            let _e868 = src_1;\n                                                            let _e869 = atOri(_e868);\n                                                            acc_1 = (_e867 + _e869);\n                                                        }\n                                                        continuing {\n                                                            let _e816 = i_4;\n                                                            i_4 = (_e816 + 1i);\n                                                        }\n                                                    }\n                                                    let _e871 = acc_1;\n                                                    r = (_e871 / vec4(32f));\n                                                }\n                                            } else {\n                                                let _e875 = fx;\n                                                if (_e875 == 17i) {\n                                                    {\n                                                        let _e878 = q_2;\n                                                        g_1 = floor(_e878);\n                                                        let _e881 = g_1;\n                                                        let _e882 = hash(_e881);\n                                                        let _e883 = g_1;\n                                                        let _e887 = hash((_e883 + vec2(1.3f)));\n                                                        let _e888 = g_1;\n                                                        let _e892 = hash((_e888 + vec2(2.9f)));\n                                                        let _e893 = g_1;\n                                                        let _e897 = hash((_e893 + vec2(5.3f)));\n                                                        h4_ = vec4<f32>(_e882, _e887, _e892, _e897);\n                                                        let _e900 = global.uP;\n                                                        if (_e900.y > 0.5f) {\n                                                            let _e904 = h4_;\n                                                            let _e908 = g_1;\n                                                            let _e912 = hash((_e908 + vec2(11f)));\n                                                            let _e915 = g_1;\n                                                            let _e919 = hash((_e915 + vec2(12.3f)));\n                                                            let _e923 = g_1;\n                                                            let _e927 = hash((_e923 + vec2(21f)));\n                                                            let _e930 = g_1;\n                                                            let _e934 = hash((_e930 + vec2(23.9f)));\n                                                            local_5 = ((vec3<f32>(dot(_e904, vec4(0.25f)), ((_e912 * 0.5f) + (_e919 * 0.5f)), ((_e927 * 0.5f) + (_e934 * 0.5f))) - vec3(0.5f)) * 1.6f);\n                                                        } else {\n                                                            let _e944 = h4_;\n                                                            let _e946 = g_1;\n                                                            let _e950 = hash((_e946 + vec2(3.1f)));\n                                                            let _e951 = g_1;\n                                                            let _e955 = hash((_e951 + vec2(7.7f)));\n                                                            local_5 = (vec3<f32>(_e944.x, _e950, _e955) - vec3(0.5f));\n                                                        }\n                                                        let _e961 = local_5;\n                                                        n_2 = _e961;\n                                                        let _e963 = global.uP;\n                                                        if (_e963.z > 0.5f) {\n                                                            let _e967 = n_2;\n                                                            n_2 = vec3(_e967.x);\n                                                        }\n                                                        let _e970 = c_6;\n                                                        let _e971 = un(_e970);\n                                                        u_1 = _e971;\n                                                        let _e973 = u_1;\n                                                        let _e975 = n_2;\n                                                        let _e976 = global.uP;\n                                                        let _e984 = clamp((_e973.xyz + (_e975 * _e976.x)), vec3(0f), vec3(1f));\n                                                        let _e985 = u_1;\n                                                        let _e991 = pre(vec4<f32>(_e984.x, _e984.y, _e984.z, _e985.w));\n                                                        r = _e991;\n                                                    }\n                                                } else {\n                                                    let _e992 = fx;\n                                                    if (_e992 == 18i) {\n                                                        {\n                                                            let _e995 = q_2;\n                                                            let _e996 = global.uP;\n                                                            s_3 = (_e995 / vec2(_e996.x));\n                                                            loop {\n                                                                let _e1007 = i_5;\n                                                                if !((_e1007 < 6i)) {\n                                                                    break;\n                                                                }\n                                                                {\n                                                                    let _e1014 = v_1;\n                                                                    let _e1015 = s_3;\n                                                                    let _e1016 = i_5;\n                                                                    let _e1022 = vnoise((_e1015 + vec2((f32(_e1016) * 13.1f))));\n                                                                    let _e1023 = amp;\n                                                                    v_1 = (_e1014 + (_e1022 * _e1023));\n                                                                    let _e1026 = s_3;\n                                                                    s_3 = (_e1026 * 2f);\n                                                                    let _e1029 = amp;\n                                                                    amp = (_e1029 * 0.5f);\n                                                                }\n                                                                continuing {\n                                                                    let _e1011 = i_5;\n                                                                    i_5 = (_e1011 + 1i);\n                                                                }\n                                                            }\n                                                            let _e1032 = global.uFg;\n                                                            let _e1033 = global.uBg;\n                                                            let _e1034 = v_1;\n                                                            let _e1039 = mix(_e1032, _e1033, vec3(clamp(_e1034, 0f, 1f)));\n                                                            r = vec4<f32>(_e1039.x, _e1039.y, _e1039.z, 1f);\n                                                        }\n                                                    } else {\n                                                        let _e1045 = fx;\n                                                        if (_e1045 == 19i) {\n                                                            {\n                                                                let _e1048 = global.uP;\n                                                                let _e1050 = global.uOriSize;\n                                                                fp = (_e1048.yz * _e1050);\n                                                                let _e1053 = global.uOriSize;\n                                                                mid = (_e1053 * 0.5f);\n                                                                let _e1057 = global.uOriSize;\n                                                                let _e1059 = global.uOriSize;\n                                                                L = max(_e1057.x, _e1059.y);\n                                                                let _e1063 = q_2;\n                                                                let _e1064 = fp;\n                                                                let _e1066 = L;\n                                                                d_6 = (distance(_e1063, _e1064) / _e1066);\n                                                                let _e1069 = d_6;\n                                                                let _e1076 = d_6;\n                                                                glow = ((exp((-(_e1069) * 18f)) * 1.2f) + (exp((-(_e1076) * 4f)) * 0.25f));\n                                                                let _e1085 = d_6;\n                                                                ring = (exp(-(pow(((_e1085 - 0.12f) * 60f), 2f))) * 0.15f);\n                                                                loop {\n                                                                    let _e1101 = i_6;\n                                                                    if !((_e1101 <= 4i)) {\n                                                                        break;\n                                                                    }\n                                                                    {\n                                                                        let _e1108 = fp;\n                                                                        let _e1109 = mid;\n                                                                        let _e1110 = mid;\n                                                                        let _e1111 = fp;\n                                                                        let _e1114 = i_6;\n                                                                        sp = mix(_e1108, (_e1109 + (_e1110 - _e1111)), vec2((f32(_e1114) * 0.25f)));\n                                                                        let _e1121 = spots;\n                                                                        let _e1122 = q_2;\n                                                                        let _e1123 = sp;\n                                                                        let _e1125 = L;\n                                                                        let _e1128 = i_6;\n                                                                        spots = (_e1121 + (exp(-(pow((distance(_e1122, _e1123) / (_e1125 * (0.01f + (0.012f * f32(_e1128))))), 2f))) * 0.18f));\n                                                                    }\n                                                                    continuing {\n                                                                        let _e1105 = i_6;\n                                                                        i_6 = (_e1105 + 1i);\n                                                                    }\n                                                                }\n                                                                let _e1145 = glow;\n                                                                let _e1151 = ring;\n                                                                let _e1152 = spots;\n                                                                let _e1156 = global.uP;\n                                                                add = (((vec3<f32>(1f, 0.9f, 0.75f) * _e1145) + (vec3<f32>(0.7f, 0.85f, 1f) * (_e1151 + _e1152))) * _e1156.x);\n                                                                let _e1160 = c_6;\n                                                                let _e1162 = add;\n                                                                let _e1163 = c_6;\n                                                                let _e1167 = c_6;\n                                                                let _e1170 = min((_e1160.xyz + (_e1162 * _e1163.w)), vec3(_e1167.w));\n                                                                let _e1171 = c_6;\n                                                                r = vec4<f32>(_e1170.x, _e1170.y, _e1170.z, _e1171.w);\n                                                            }\n                                                        } else {\n                                                            let _e1177 = fx;\n                                                            if (_e1177 == 20i) {\n                                                                {\n                                                                    let _e1180 = global.uP;\n                                                                    a_5 = radians(_e1180.x);\n                                                                    let _e1184 = a_5;\n                                                                    let _e1186 = a_5;\n                                                                    let _e1191 = global.uP;\n                                                                    let _e1193 = global.uK;\n                                                                    d_7 = (vec2<f32>(cos(_e1184), -(sin(_e1186))) * max(1f, ((_e1191.y * _e1193) * 0.5f)));\n                                                                    let _e1200 = p_10;\n                                                                    let _e1201 = d_7;\n                                                                    let _e1203 = at((_e1200 + _e1201));\n                                                                    let _e1205 = p_10;\n                                                                    let _e1206 = d_7;\n                                                                    let _e1208 = at((_e1205 - _e1206));\n                                                                    let _e1211 = lum((_e1203.xyz - _e1208.xyz));\n                                                                    g_2 = _e1211;\n                                                                    let _e1214 = g_2;\n                                                                    let _e1215 = global.uP;\n                                                                    let _e1223 = c_6;\n                                                                    let _e1225 = (vec3(clamp((0.5f + (_e1214 * _e1215.z)), 0f, 1f)) * _e1223.w);\n                                                                    let _e1226 = c_6;\n                                                                    r = vec4<f32>(_e1225.x, _e1225.y, _e1225.z, _e1226.w);\n                                                                }\n                                                            } else {\n                                                                let _e1232 = fx;\n                                                                if (_e1232 == 21i) {\n                                                                    {\n                                                                        let _e1235 = p_10;\n                                                                        let _e1242 = at((_e1235 + vec2<f32>(1f, 1f)));\n                                                                        let _e1245 = p_10;\n                                                                        let _e1252 = at((_e1245 + vec2<f32>(1f, 0f)));\n                                                                        let _e1256 = p_10;\n                                                                        let _e1264 = at((_e1256 + vec2<f32>(1f, -1f)));\n                                                                        let _e1267 = p_10;\n                                                                        let _e1275 = at((_e1267 + vec2<f32>(-1f, 1f)));\n                                                                        let _e1278 = p_10;\n                                                                        let _e1286 = at((_e1278 + vec2<f32>(-1f, 0f)));\n                                                                        let _e1290 = p_10;\n                                                                        let _e1299 = at((_e1290 + vec2<f32>(-1f, -1f)));\n                                                                        gx = (((_e1242.xyz + (2f * _e1252.xyz)) + _e1264.xyz) - ((_e1275.xyz + (2f * _e1286.xyz)) + _e1299.xyz));\n                                                                        let _e1304 = p_10;\n                                                                        let _e1312 = at((_e1304 + vec2<f32>(-1f, 1f)));\n                                                                        let _e1315 = p_10;\n                                                                        let _e1322 = at((_e1315 + vec2<f32>(0f, 1f)));\n                                                                        let _e1326 = p_10;\n                                                                        let _e1333 = at((_e1326 + vec2<f32>(1f, 1f)));\n                                                                        let _e1336 = p_10;\n                                                                        let _e1345 = at((_e1336 + vec2<f32>(-1f, -1f)));\n                                                                        let _e1348 = p_10;\n                                                                        let _e1356 = at((_e1348 + vec2<f32>(0f, -1f)));\n                                                                        let _e1360 = p_10;\n                                                                        let _e1368 = at((_e1360 + vec2<f32>(1f, -1f)));\n                                                                        gy = (((_e1312.xyz + (2f * _e1322.xyz)) + _e1333.xyz) - ((_e1345.xyz + (2f * _e1356.xyz)) + _e1368.xyz));\n                                                                        let _e1374 = gx;\n                                                                        let _e1375 = gx;\n                                                                        let _e1377 = gy;\n                                                                        let _e1378 = gy;\n                                                                        let _e1391 = c_6;\n                                                                        let _e1393 = (clamp((vec3(1f) - (sqrt(((_e1374 * _e1375) + (_e1377 * _e1378))) * 0.7f)), vec3(0f), vec3(1f)) * _e1391.w);\n                                                                        let _e1394 = c_6;\n                                                                        r = vec4<f32>(_e1393.x, _e1393.y, _e1393.z, _e1394.w);\n                                                                    }\n                                                                } else {\n                                                                    let _e1400 = fx;\n                                                                    if (_e1400 == 22i) {\n                                                                        {\n                                                                            let _e1403 = c_6;\n                                                                            let _e1404 = un(_e1403);\n                                                                            u_2 = _e1404;\n                                                                            let _e1406 = u_2;\n                                                                            let _e1409 = u_2;\n                                                                            let _e1414 = u_2;\n                                                                            let _e1418 = mix(_e1406.xyz, (vec3(1f) - _e1409.xyz), step(vec3(0.5f), _e1414.xyz));\n                                                                            let _e1419 = u_2;\n                                                                            let _e1425 = pre(vec4<f32>(_e1418.x, _e1418.y, _e1418.z, _e1419.w));\n                                                                            r = _e1425;\n                                                                        }\n                                                                    } else {\n                                                                        let _e1426 = fx;\n                                                                        if (_e1426 == 23i) {\n                                                                            {\n                                                                                let _e1430 = global.uP;\n                                                                                let _e1432 = global.uK;\n                                                                                rr_1 = max(1f, (_e1430.x * _e1432));\n                                                                                let _e1437 = rr_1;\n                                                                                st_2 = max(1f, (_e1437 / 4f));\n                                                                                let _e1442 = c_6;\n                                                                                bestM = _e1442.xyz;\n                                                                                loop {\n                                                                                    let _e1449 = k_1;\n                                                                                    if !((_e1449 < 4i)) {\n                                                                                        break;\n                                                                                    }\n                                                                                    {\n                                                                                        let _e1456 = k_1;\n                                                                                        let _e1459 = k_1;\n                                                                                        if ((_e1456 == 0i) || (_e1459 == 2i)) {\n                                                                                            local_6 = -1f;\n                                                                                        } else {\n                                                                                            local_6 = 1f;\n                                                                                        }\n                                                                                        let _e1467 = local_6;\n                                                                                        let _e1468 = k_1;\n                                                                                        if (_e1468 < 2i) {\n                                                                                            local_7 = -1f;\n                                                                                        } else {\n                                                                                            local_7 = 1f;\n                                                                                        }\n                                                                                        let _e1475 = local_7;\n                                                                                        sg = vec2<f32>(_e1467, _e1475);\n                                                                                        m = vec3(0f);\n                                                                                        m2_ = vec3(0f);\n                                                                                        j_3 = 0f;\n                                                                                        loop {\n                                                                                            let _e1486 = j_3;\n                                                                                            if !((_e1486 <= 4f)) {\n                                                                                                break;\n                                                                                            }\n                                                                                            i_7 = 0f;\n                                                                                            loop {\n                                                                                                let _e1495 = i_7;\n                                                                                                if !((_e1495 <= 4f)) {\n                                                                                                    break;\n                                                                                                }\n                                                                                                {\n                                                                                                    let _e1502 = p_10;\n                                                                                                    let _e1503 = sg;\n                                                                                                    let _e1504 = i_7;\n                                                                                                    let _e1505 = j_3;\n                                                                                                    let _e1508 = st_2;\n                                                                                                    let _e1511 = at((_e1502 + ((_e1503 * vec2<f32>(_e1504, _e1505)) * _e1508)));\n                                                                                                    s_4 = _e1511.xyz;\n                                                                                                    let _e1514 = m;\n                                                                                                    let _e1515 = s_4;\n                                                                                                    m = (_e1514 + _e1515);\n                                                                                                    let _e1517 = m2_;\n                                                                                                    let _e1518 = s_4;\n                                                                                                    let _e1519 = s_4;\n                                                                                                    m2_ = (_e1517 + (_e1518 * _e1519));\n                                                                                                }\n                                                                                                continuing {\n                                                                                                    let _e1499 = i_7;\n                                                                                                    i_7 = (_e1499 + 1f);\n                                                                                                }\n                                                                                            }\n                                                                                            continuing {\n                                                                                                let _e1490 = j_3;\n                                                                                                j_3 = (_e1490 + 1f);\n                                                                                            }\n                                                                                        }\n                                                                                        let _e1522 = m;\n                                                                                        m = (_e1522 / vec3(25f));\n                                                                                        let _e1526 = m2_;\n                                                                                        m2_ = (_e1526 / vec3(25f));\n                                                                                        let _e1530 = m2_;\n                                                                                        let _e1531 = m;\n                                                                                        let _e1532 = m;\n                                                                                        v_2 = dot((_e1530 - (_e1531 * _e1532)), vec3(1f));\n                                                                                        let _e1539 = v_2;\n                                                                                        let _e1540 = bestV;\n                                                                                        if (_e1539 < _e1540) {\n                                                                                            {\n                                                                                                let _e1542 = v_2;\n                                                                                                bestV = _e1542;\n                                                                                                let _e1543 = m;\n                                                                                                bestM = _e1543;\n                                                                                            }\n                                                                                        }\n                                                                                    }\n                                                                                    continuing {\n                                                                                        let _e1453 = k_1;\n                                                                                        k_1 = (_e1453 + 1i);\n                                                                                    }\n                                                                                }\n                                                                                let _e1544 = bestM;\n                                                                                let _e1545 = c_6;\n                                                                                r = vec4<f32>(_e1544.x, _e1544.y, _e1544.z, _e1545.w);\n                                                                            }\n                                                                        } else {\n                                                                            let _e1551 = fx;\n                                                                            if (_e1551 == 24i) {\n                                                                                {\n                                                                                    let _e1554 = p_10;\n                                                                                    let _e1555 = q_2;\n                                                                                    let _e1557 = hash2_(floor(_e1555));\n                                                                                    let _e1563 = global.uP;\n                                                                                    let _e1567 = global.uK;\n                                                                                    let _e1571 = at((_e1554 + ((((_e1557 - vec2(0.5f)) * 2f) * _e1563.x) * max(1f, _e1567))));\n                                                                                    r = _e1571;\n                                                                                }\n                                                                            }\n                                                                        }\n                                                                    }\n                                                                }\n                                                            }\n                                                        }\n                                                    }\n                                                }\n                                            }\n                                        }\n                                    }\n                                }\n                            }\n                        }\n                    }\n                }\n            }\n        }\n    }\n    let _e1572 = global.uUseSel;\n    if (_e1572 > 0.5f) {\n        let _e1575 = c_6;\n        let _e1576 = r;\n        let _e1577 = q_2;\n        let _e1578 = global.uOriSize;\n        let _e1580 = textureSample(uSel, uSel_s, (_e1577 / _e1578));\n        r = mix(_e1575, _e1576, vec4(_e1580.w));\n    }\n    let _e1584 = r;\n    o = _e1584;\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e49 = o;\n    return FragmentOutput(_e49);\n}\n",
  "size": 224,
  "uniforms": {
   "uOutSize": [
    0,
    "vec2",
    0
   ],
   "uOriSize": [
    8,
    "vec2",
    0
   ],
   "uScale": [
    16,
    "vec2",
    0
   ],
   "uOut2Ori": [
    32,
    "mat3",
    0
   ],
   "uOri2Out": [
    80,
    "mat3",
    0
   ],
   "uFx": [
    128,
    "float",
    0
   ],
   "uK": [
    132,
    "float",
    0
   ],
   "uUseSel": [
    136,
    "float",
    0
   ],
   "uSeed": [
    140,
    "float",
    0
   ],
   "uP": [
    144,
    "vec4",
    0
   ],
   "uFg": [
    160,
    "vec3",
    0
   ],
   "uBg": [
    176,
    "vec3",
    0
   ],
   "uCenter": [
    192,
    "vec3",
    0
   ],
   "frFlip": [
    204,
    "float",
    0
   ],
   "frH": [
    208,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ],
   [
    "uBlur",
    3,
    4,
    true
   ],
   [
    "uSel",
    5,
    6,
    true
   ]
  ],
  "nearest": 0
 },
 "shade": {
  "hash": "df0c3c0b",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOff: vec2<f32>,\n    uOutSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uColor: vec3<f32>,\n    uGain: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var a: f32;\n\n    let _e19 = gl_FragCoord_1;\n    let _e21 = global.frFlip;\n    if (_e21 > 0.5f) {\n        let _e24 = global.frH;\n        let _e25 = gl_FragCoord_1;\n        local = (_e24 - _e25.y);\n    } else {\n        let _e28 = gl_FragCoord_1;\n        local = _e28.y;\n    }\n    let _e31 = local;\n    let _e32 = gl_FragCoord_1;\n    let _e33 = _e32.zw;\n    frFC = vec4<f32>(_e19.x, _e31, _e33.x, _e33.y);\n    let _e37 = frFC;\n    let _e39 = global.uOff;\n    let _e41 = global.uOutSize;\n    let _e43 = global.uScale;\n    let _e45 = textureSample(uTex, uTex_s, (((_e37.xy - _e39) / _e41) * _e43));\n    let _e47 = global.uGain;\n    a = clamp((_e45.w * _e47), 0f, 1f);\n    let _e53 = global.uColor;\n    let _e54 = a;\n    let _e55 = (_e53 * _e54);\n    let _e56 = a;\n    o = vec4<f32>(_e55.x, _e55.y, _e55.z, _e56);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 64,
  "uniforms": {
   "uOff": [
    0,
    "vec2",
    0
   ],
   "uOutSize": [
    8,
    "vec2",
    0
   ],
   "uScale": [
    16,
    "vec2",
    0
   ],
   "uColor": [
    32,
    "vec3",
    0
   ],
   "uGain": [
    44,
    "float",
    0
   ],
   "frFlip": [
    48,
    "float",
    0
   ],
   "frH": [
    52,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    true
   ]
  ],
  "nearest": 0
 },
 "style": {
  "hash": "c7a2629f",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOutSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uG0_: vec2<f32>,\n    uG1_: vec2<f32>,\n    uFill: f32,\n    uUseStroke: f32,\n    uUseOverlay: f32,\n    uOverlayA: f32,\n    uStrokeA: f32,\n    uUseInner: f32,\n    uUseGrad: f32,\n    uGradA: f32,\n    uGradRadial: f32,\n    uUsePat: f32,\n    uPatA: f32,\n    uStrokeC: vec3<f32>,\n    uOverlayC: vec3<f32>,\n    uGC0_: vec3<f32>,\n    uGC1_: vec3<f32>,\n    uOut2Ori: mat3x3<f32>,\n    uPatTile: vec4<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uDil: texture_2d<f32>;\n@group(0) @binding(4) \nvar uDil_s: sampler;\n@group(0) @binding(5) \nvar uInner: texture_2d<f32>;\n@group(0) @binding(6) \nvar uInner_s: sampler;\n@group(0) @binding(7) \nvar uPat: texture_2d<f32>;\n@group(0) @binding(8) \nvar uPat_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var c0_: vec4<f32>;\n    var c: vec4<f32>;\n    var i: vec4<f32>;\n    var q: vec2<f32>;\n    var pc: vec4<f32>;\n    var d: vec2<f32>;\n    var p: vec2<f32>;\n    var local_1: f32;\n    var g: f32;\n    var d_1: f32;\n    var s: f32;\n\n    let _e57 = gl_FragCoord_1;\n    let _e59 = global.frFlip;\n    if (_e59 > 0.5f) {\n        let _e62 = global.frH;\n        let _e63 = gl_FragCoord_1;\n        local = (_e62 - _e63.y);\n    } else {\n        let _e66 = gl_FragCoord_1;\n        local = _e66.y;\n    }\n    let _e69 = local;\n    let _e70 = gl_FragCoord_1;\n    let _e71 = _e70.zw;\n    frFC = vec4<f32>(_e57.x, _e69, _e71.x, _e71.y);\n    let _e75 = frFC;\n    let _e79 = textureLoad(uTex, vec2<i32>(_e75.xy), 0i);\n    c0_ = _e79;\n    let _e81 = c0_;\n    c = _e81;\n    let _e83 = global.uUseInner;\n    if (_e83 > 0.5f) {\n        {\n            let _e86 = frFC;\n            let _e90 = textureLoad(uInner, vec2<i32>(_e86.xy), 0i);\n            i = _e90;\n            let _e92 = c;\n            let _e94 = i;\n            let _e96 = c;\n            let _e99 = i;\n            let _e101 = c;\n            let _e108 = (_e94.xyz + (_e96.xyz * (1f - (_e99.w / max(_e101.w, 0.00001f)))));\n            c.x = _e108.x;\n            c.y = _e108.y;\n            c.z = _e108.z;\n        }\n    }\n    let _e115 = global.uUsePat;\n    if (_e115 > 0.5f) {\n        {\n            let _e118 = global.uOut2Ori;\n            let _e119 = frFC;\n            let _e120 = _e119.xy;\n            let _e127 = global.uPatTile;\n            q = ((_e118 * vec3<f32>(_e120.x, _e120.y, 1f)).xy - _e127.zw);\n            let _e131 = q;\n            let _e132 = global.uPatTile;\n            let _e136 = textureSample(uPat, uPat_s, fract((_e131 / _e132.xy)));\n            pc = _e136;\n            let _e138 = c;\n            let _e140 = c;\n            let _e142 = pc;\n            let _e144 = pc;\n            let _e150 = c;\n            let _e153 = global.uPatA;\n            let _e154 = pc;\n            let _e158 = mix(_e140.xyz, ((_e142.xyz / vec3(max(_e144.w, 0.00001f))) * _e150.w), vec3((_e153 * _e154.w)));\n            c.x = _e158.x;\n            c.y = _e158.y;\n            c.z = _e158.z;\n        }\n    }\n    let _e165 = global.uUseGrad;\n    if (_e165 > 0.5f) {\n        {\n            let _e168 = global.uG1_;\n            let _e169 = global.uG0_;\n            d = (_e168 - _e169);\n            let _e172 = frFC;\n            let _e174 = global.uG0_;\n            p = (_e172.xy - _e174);\n            let _e177 = global.uGradRadial;\n            if (_e177 > 0.5f) {\n                let _e180 = p;\n                let _e182 = d;\n                local_1 = (length(_e180) / max(length(_e182), 0.001f));\n            } else {\n                let _e187 = p;\n                let _e188 = d;\n                let _e190 = d;\n                let _e191 = d;\n                local_1 = (dot(_e187, _e188) / max(dot(_e190, _e191), 0.001f));\n            }\n            let _e197 = local_1;\n            g = clamp(_e197, 0f, 1f);\n            let _e202 = c;\n            let _e204 = c;\n            let _e206 = global.uGC0_;\n            let _e207 = global.uGC1_;\n            let _e208 = g;\n            let _e211 = c;\n            let _e214 = global.uGradA;\n            let _e216 = mix(_e204.xyz, (mix(_e206, _e207, vec3(_e208)) * _e211.w), vec3(_e214));\n            c.x = _e216.x;\n            c.y = _e216.y;\n            c.z = _e216.z;\n        }\n    }\n    let _e223 = global.uUseOverlay;\n    if (_e223 > 0.5f) {\n        let _e226 = c;\n        let _e228 = c;\n        let _e230 = global.uOverlayC;\n        let _e231 = c;\n        let _e234 = global.uOverlayA;\n        let _e236 = mix(_e228.xyz, (_e230 * _e231.w), vec3(_e234));\n        c.x = _e236.x;\n        c.y = _e236.y;\n        c.z = _e236.z;\n    }\n    let _e243 = c;\n    let _e244 = global.uFill;\n    c = (_e243 * _e244);\n    let _e246 = global.uUseStroke;\n    if (_e246 > 0.5f) {\n        {\n            let _e249 = frFC;\n            let _e251 = global.uOutSize;\n            let _e253 = global.uScale;\n            let _e255 = textureSample(uDil, uDil_s, ((_e249.xy / _e251) * _e253));\n            d_1 = clamp(_e255.w, 0f, 1f);\n            let _e262 = d_1;\n            let _e263 = c0_;\n            let _e267 = global.uStrokeA;\n            s = (max(0f, (_e262 - _e263.w)) * _e267);\n            let _e270 = c;\n            let _e271 = global.uStrokeC;\n            let _e272 = s;\n            let _e273 = (_e271 * _e272);\n            let _e274 = s;\n            let _e280 = c;\n            c = (_e270 + (vec4<f32>(_e273.x, _e273.y, _e273.z, _e274) * (1f - _e280.w)));\n        }\n    }\n    let _e285 = c;\n    o = _e285;\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e69 = o;\n    return FragmentOutput(_e69);\n}\n",
  "size": 224,
  "uniforms": {
   "uOutSize": [
    0,
    "vec2",
    0
   ],
   "uScale": [
    8,
    "vec2",
    0
   ],
   "uG0": [
    16,
    "vec2",
    0
   ],
   "uG1": [
    24,
    "vec2",
    0
   ],
   "uFill": [
    32,
    "float",
    0
   ],
   "uUseStroke": [
    36,
    "float",
    0
   ],
   "uUseOverlay": [
    40,
    "float",
    0
   ],
   "uOverlayA": [
    44,
    "float",
    0
   ],
   "uStrokeA": [
    48,
    "float",
    0
   ],
   "uUseInner": [
    52,
    "float",
    0
   ],
   "uUseGrad": [
    56,
    "float",
    0
   ],
   "uGradA": [
    60,
    "float",
    0
   ],
   "uGradRadial": [
    64,
    "float",
    0
   ],
   "uUsePat": [
    68,
    "float",
    0
   ],
   "uPatA": [
    72,
    "float",
    0
   ],
   "uStrokeC": [
    80,
    "vec3",
    0
   ],
   "uOverlayC": [
    96,
    "vec3",
    0
   ],
   "uGC0": [
    112,
    "vec3",
    0
   ],
   "uGC1": [
    128,
    "vec3",
    0
   ],
   "uOut2Ori": [
    144,
    "mat3",
    0
   ],
   "uPatTile": [
    192,
    "vec4",
    0
   ],
   "frFlip": [
    208,
    "float",
    0
   ],
   "frH": [
    212,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ],
   [
    "uDil",
    3,
    4,
    true
   ],
   [
    "uInner",
    5,
    6,
    false
   ],
   [
    "uPat",
    7,
    8,
    true
   ]
  ],
  "nearest": 0
 },
 "inner": {
  "hash": "e410132a",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOff: vec2<f32>,\n    uOutSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uColor: vec3<f32>,\n    uGain: f32,\n    uOpacity: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uBlur: texture_2d<f32>;\n@group(0) @binding(4) \nvar uBlur_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var a0_: f32;\n    var b: f32;\n    var a: f32;\n\n    let _e23 = gl_FragCoord_1;\n    let _e25 = global.frFlip;\n    if (_e25 > 0.5f) {\n        let _e28 = global.frH;\n        let _e29 = gl_FragCoord_1;\n        local = (_e28 - _e29.y);\n    } else {\n        let _e32 = gl_FragCoord_1;\n        local = _e32.y;\n    }\n    let _e35 = local;\n    let _e36 = gl_FragCoord_1;\n    let _e37 = _e36.zw;\n    frFC = vec4<f32>(_e23.x, _e35, _e37.x, _e37.y);\n    let _e41 = frFC;\n    let _e45 = textureLoad(uTex, vec2<i32>(_e41.xy), 0i);\n    a0_ = _e45.w;\n    let _e48 = frFC;\n    let _e50 = global.uOff;\n    let _e52 = global.uOutSize;\n    let _e54 = global.uScale;\n    let _e56 = textureSample(uBlur, uBlur_s, (((_e48.xy - _e50) / _e52) * _e54));\n    b = _e56.w;\n    let _e60 = b;\n    let _e62 = global.uGain;\n    let _e67 = a0_;\n    let _e69 = global.uOpacity;\n    a = ((clamp(((1f - _e60) * _e62), 0f, 1f) * _e67) * _e69);\n    let _e72 = global.uColor;\n    let _e73 = a;\n    let _e74 = (_e72 * _e73);\n    let _e75 = a;\n    o = vec4<f32>(_e74.x, _e74.y, _e74.z, _e75);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e31 = o;\n    return FragmentOutput(_e31);\n}\n",
  "size": 64,
  "uniforms": {
   "uOff": [
    0,
    "vec2",
    0
   ],
   "uOutSize": [
    8,
    "vec2",
    0
   ],
   "uScale": [
    16,
    "vec2",
    0
   ],
   "uColor": [
    32,
    "vec3",
    0
   ],
   "uGain": [
    44,
    "float",
    0
   ],
   "uOpacity": [
    48,
    "float",
    0
   ],
   "frFlip": [
    52,
    "float",
    0
   ],
   "frH": [
    56,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ],
   [
    "uBlur",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "clipa": {
  "hash": "42bd27bb",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uUseMask: f32,\n    uDensity: f32,\n    uOpacity: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uMask: texture_2d<f32>;\n@group(0) @binding(4) \nvar uMask_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var ip: vec2<i32>;\n    var local_1: f32;\n    var m: f32;\n\n    let _e17 = gl_FragCoord_1;\n    let _e19 = global.frFlip;\n    if (_e19 > 0.5f) {\n        let _e22 = global.frH;\n        let _e23 = gl_FragCoord_1;\n        local = (_e22 - _e23.y);\n    } else {\n        let _e26 = gl_FragCoord_1;\n        local = _e26.y;\n    }\n    let _e29 = local;\n    let _e30 = gl_FragCoord_1;\n    let _e31 = _e30.zw;\n    frFC = vec4<f32>(_e17.x, _e29, _e31.x, _e31.y);\n    let _e35 = frFC;\n    ip = vec2<i32>(_e35.xy);\n    let _e39 = global.uUseMask;\n    if (_e39 > 0.5f) {\n        let _e43 = global.uDensity;\n        let _e45 = ip;\n        let _e47 = textureLoad(uMask, _e45, 0i);\n        local_1 = (1f - (_e43 * (1f - _e47.x)));\n    } else {\n        local_1 = 1f;\n    }\n    let _e54 = local_1;\n    m = _e54;\n    let _e56 = ip;\n    let _e58 = textureLoad(uTex, _e56, 0i);\n    let _e60 = m;\n    let _e62 = global.uOpacity;\n    o = vec4(((_e58.w * _e60) * _e62));\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e25 = o;\n    return FragmentOutput(_e25);\n}\n",
  "size": 32,
  "uniforms": {
   "uUseMask": [
    0,
    "float",
    0
   ],
   "uDensity": [
    4,
    "float",
    0
   ],
   "uOpacity": [
    8,
    "float",
    0
   ],
   "frFlip": [
    12,
    "float",
    0
   ],
   "frH": [
    16,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ],
   [
    "uMask",
    3,
    4,
    false
   ]
  ],
  "nearest": 0
 },
 "stretch": {
  "hash": "1dd3c1ab",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOut2Ori: mat3x3<f32>,\n    uS: vec4<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var q: vec2<f32>;\n    var local_1: vec2<f32>;\n    var v: vec2<f32>;\n    var local_2: f32;\n\n    let _e11 = gl_FragCoord_1;\n    let _e13 = global.frFlip;\n    if (_e13 > 0.5f) {\n        let _e16 = global.frH;\n        let _e17 = gl_FragCoord_1;\n        local = (_e16 - _e17.y);\n    } else {\n        let _e20 = gl_FragCoord_1;\n        local = _e20.y;\n    }\n    let _e23 = local;\n    let _e24 = gl_FragCoord_1;\n    let _e25 = _e24.zw;\n    frFC = vec4<f32>(_e11.x, _e23, _e25.x, _e25.y);\n    let _e29 = global.uOut2Ori;\n    let _e30 = frFC;\n    let _e31 = _e30.xy;\n    q = (_e29 * vec3<f32>(_e31.x, _e31.y, 1f)).xy;\n    let _e39 = global.uS;\n    if (_e39.x > 0.5f) {\n        let _e43 = q;\n        local_1 = _e43;\n    } else {\n        let _e44 = q;\n        local_1 = _e44.yx;\n    }\n    let _e47 = local_1;\n    v = _e47;\n    let _e49 = v;\n    let _e51 = global.uS;\n    let _e57 = v;\n    let _e59 = global.uS;\n    let _e63 = v;\n    let _e65 = global.uS;\n    if (((abs((_e49.x - _e51.y)) <= 0.5f) && (_e57.y >= _e59.z)) && (_e63.y <= _e65.w)) {\n        local_2 = 1f;\n    } else {\n        local_2 = 0f;\n    }\n    let _e72 = local_2;\n    o = vec4(_e72);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e15 = o;\n    return FragmentOutput(_e15);\n}\n",
  "size": 80,
  "uniforms": {
   "uOut2Ori": [
    0,
    "mat3",
    0
   ],
   "uS": [
    48,
    "vec4",
    0
   ],
   "frFlip": [
    64,
    "float",
    0
   ],
   "frH": [
    68,
    "float",
    0
   ]
  },
  "textures": [],
  "nearest": 0
 },
 "bevel": {
  "hash": "d439c8cd",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOutSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uLight: vec2<f32>,\n    uColor: vec3<f32>,\n    uStyle: f32,\n    uDepth: f32,\n    uAlt: f32,\n    uWhich: f32,\n    uOpacity: f32,\n    uDown: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uBlur: texture_2d<f32>;\n@group(0) @binding(4) \nvar uBlur_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn hgt(p: vec2<f32>) -> f32 {\n    var p_1: vec2<f32>;\n    var b: f32;\n    var local: f32;\n    var local_1: f32;\n\n    p_1 = p;\n    let _e32 = p_1;\n    let _e33 = global.uOutSize;\n    let _e35 = global.uScale;\n    let _e37 = textureSample(uBlur, uBlur_s, ((_e32 / _e33) * _e35));\n    b = _e37.w;\n    let _e40 = global.uStyle;\n    if (_e40 < 0.5f) {\n        let _e44 = b;\n        local_1 = clamp(((2f * _e44) - 1f), 0f, 1f);\n    } else {\n        let _e51 = global.uStyle;\n        if (_e51 < 1.5f) {\n            let _e55 = b;\n            local = clamp((2f * _e55), 0f, 1f);\n        } else {\n            let _e60 = b;\n            local = _e60;\n        }\n        let _e62 = local;\n        local_1 = _e62;\n    }\n    let _e64 = local_1;\n    return _e64;\n}\n\nfn main_1() {\n    var local_2: f32;\n    var p_2: vec2<f32>;\n    var a0_: f32;\n    var g: vec2<f32>;\n    var local_3: f32;\n    var up: f32;\n    var n: vec3<f32>;\n    var L: vec3<f32>;\n    var shade: f32;\n    var local_4: f32;\n    var v: f32;\n    var local_5: f32;\n    var local_6: f32;\n    var m: f32;\n    var a: f32;\n\n    let _e31 = gl_FragCoord_1;\n    let _e33 = global.frFlip;\n    if (_e33 > 0.5f) {\n        let _e36 = global.frH;\n        let _e37 = gl_FragCoord_1;\n        local_2 = (_e36 - _e37.y);\n    } else {\n        let _e40 = gl_FragCoord_1;\n        local_2 = _e40.y;\n    }\n    let _e43 = local_2;\n    let _e44 = gl_FragCoord_1;\n    let _e45 = _e44.zw;\n    frFC = vec4<f32>(_e31.x, _e43, _e45.x, _e45.y);\n    let _e49 = frFC;\n    p_2 = _e49.xy;\n    let _e52 = p_2;\n    let _e55 = textureLoad(uTex, vec2<i32>(_e52), 0i);\n    a0_ = _e55.w;\n    let _e58 = p_2;\n    let _e63 = hgt((_e58 + vec2<f32>(1f, 0f)));\n    let _e64 = p_2;\n    let _e69 = hgt((_e64 - vec2<f32>(1f, 0f)));\n    let _e71 = p_2;\n    let _e76 = hgt((_e71 + vec2<f32>(0f, 1f)));\n    let _e77 = p_2;\n    let _e82 = hgt((_e77 - vec2<f32>(0f, 1f)));\n    g = (vec2<f32>((_e63 - _e69), (_e76 - _e82)) * 0.5f);\n    let _e88 = global.uDown;\n    if (_e88 > 0.5f) {\n        local_3 = -1f;\n    } else {\n        local_3 = 1f;\n    }\n    let _e95 = local_3;\n    up = _e95;\n    let _e97 = global.uStyle;\n    let _e100 = a0_;\n    if ((_e97 > 2.5f) && (_e100 < 0.5f)) {\n        let _e104 = up;\n        up = -(_e104);\n    }\n    let _e106 = g;\n    let _e108 = global.uDepth;\n    let _e110 = up;\n    let _e111 = ((-(_e106) * _e108) * _e110);\n    n = normalize(vec3<f32>(_e111.x, _e111.y, 1f));\n    let _e118 = global.uLight;\n    let _e119 = global.uAlt;\n    let _e121 = (_e118 * cos(_e119));\n    let _e122 = global.uAlt;\n    L = vec3<f32>(_e121.x, _e121.y, sin(_e122));\n    let _e128 = n;\n    let _e129 = L;\n    let _e131 = global.uAlt;\n    let _e135 = global.uAlt;\n    shade = ((dot(_e128, _e129) - sin(_e131)) / max((1f - (sin(_e135) * 0.5f)), 0.2f));\n    let _e144 = global.uWhich;\n    if (_e144 < 0.5f) {\n        let _e147 = shade;\n        local_4 = _e147;\n    } else {\n        let _e148 = shade;\n        local_4 = -(_e148);\n    }\n    let _e151 = local_4;\n    v = clamp((_e151 * 1.6f), 0f, 1f);\n    let _e158 = global.uStyle;\n    if (_e158 < 0.5f) {\n        let _e161 = a0_;\n        local_6 = _e161;\n    } else {\n        let _e162 = global.uStyle;\n        if (_e162 < 1.5f) {\n            let _e166 = a0_;\n            local_5 = (1f - _e166);\n        } else {\n            local_5 = 1f;\n        }\n        let _e170 = local_5;\n        local_6 = _e170;\n    }\n    let _e172 = local_6;\n    m = _e172;\n    let _e174 = v;\n    let _e175 = m;\n    let _e177 = global.uOpacity;\n    a = ((_e174 * _e175) * _e177);\n    let _e180 = global.uColor;\n    let _e181 = a;\n    let _e182 = (_e180 * _e181);\n    let _e183 = a;\n    o = vec4<f32>(_e182.x, _e182.y, _e182.z, _e183);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e39 = o;\n    return FragmentOutput(_e39);\n}\n",
  "size": 80,
  "uniforms": {
   "uOutSize": [
    0,
    "vec2",
    0
   ],
   "uScale": [
    8,
    "vec2",
    0
   ],
   "uLight": [
    16,
    "vec2",
    0
   ],
   "uColor": [
    32,
    "vec3",
    0
   ],
   "uStyle": [
    44,
    "float",
    0
   ],
   "uDepth": [
    48,
    "float",
    0
   ],
   "uAlt": [
    52,
    "float",
    0
   ],
   "uWhich": [
    56,
    "float",
    0
   ],
   "uOpacity": [
    60,
    "float",
    0
   ],
   "uDown": [
    64,
    "float",
    0
   ],
   "frFlip": [
    68,
    "float",
    0
   ],
   "frH": [
    72,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ],
   [
    "uBlur",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "satin": {
  "hash": "477a82f1",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOff: vec2<f32>,\n    uOutSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uColor: vec3<f32>,\n    uInvert: f32,\n    uOpacity: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uBlur: texture_2d<f32>;\n@group(0) @binding(4) \nvar uBlur_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var p: vec2<f32>;\n    var a0_: f32;\n    var s: f32;\n    var a: f32;\n\n    let _e23 = gl_FragCoord_1;\n    let _e25 = global.frFlip;\n    if (_e25 > 0.5f) {\n        let _e28 = global.frH;\n        let _e29 = gl_FragCoord_1;\n        local = (_e28 - _e29.y);\n    } else {\n        let _e32 = gl_FragCoord_1;\n        local = _e32.y;\n    }\n    let _e35 = local;\n    let _e36 = gl_FragCoord_1;\n    let _e37 = _e36.zw;\n    frFC = vec4<f32>(_e23.x, _e35, _e37.x, _e37.y);\n    let _e41 = frFC;\n    p = _e41.xy;\n    let _e44 = p;\n    let _e47 = textureLoad(uTex, vec2<i32>(_e44), 0i);\n    a0_ = _e47.w;\n    let _e50 = p;\n    let _e51 = global.uOff;\n    let _e53 = global.uOutSize;\n    let _e55 = global.uScale;\n    let _e57 = textureSample(uBlur, uBlur_s, (((_e50 - _e51) / _e53) * _e55));\n    let _e59 = p;\n    let _e60 = global.uOff;\n    let _e62 = global.uOutSize;\n    let _e64 = global.uScale;\n    let _e66 = textureSample(uBlur, uBlur_s, (((_e59 + _e60) / _e62) * _e64));\n    s = abs((_e57.w - _e66.w));\n    let _e71 = global.uInvert;\n    if (_e71 > 0.5f) {\n        let _e75 = s;\n        s = (1f - _e75);\n    }\n    let _e77 = s;\n    let _e81 = a0_;\n    let _e83 = global.uOpacity;\n    a = ((clamp(_e77, 0f, 1f) * _e81) * _e83);\n    let _e86 = global.uColor;\n    let _e87 = a;\n    let _e88 = (_e86 * _e87);\n    let _e89 = a;\n    o = vec4<f32>(_e88.x, _e88.y, _e88.z, _e89);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e31 = o;\n    return FragmentOutput(_e31);\n}\n",
  "size": 64,
  "uniforms": {
   "uOff": [
    0,
    "vec2",
    0
   ],
   "uOutSize": [
    8,
    "vec2",
    0
   ],
   "uScale": [
    16,
    "vec2",
    0
   ],
   "uColor": [
    32,
    "vec3",
    0
   ],
   "uInvert": [
    44,
    "float",
    0
   ],
   "uOpacity": [
    48,
    "float",
    0
   ],
   "frFlip": [
    52,
    "float",
    0
   ],
   "frH": [
    56,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ],
   [
    "uBlur",
    3,
    4,
    true
   ]
  ],
  "nearest": 0
 },
 "maskMul": {
  "hash": "38b4c93b",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n\n    let _e9 = gl_FragCoord_1;\n    let _e11 = global.frFlip;\n    if (_e11 > 0.5f) {\n        let _e14 = global.frH;\n        let _e15 = gl_FragCoord_1;\n        local = (_e14 - _e15.y);\n    } else {\n        let _e18 = gl_FragCoord_1;\n        local = _e18.y;\n    }\n    let _e21 = local;\n    let _e22 = gl_FragCoord_1;\n    let _e23 = _e22.zw;\n    frFC = vec4<f32>(_e9.x, _e21, _e23.x, _e23.y);\n    let _e27 = frFC;\n    let _e31 = textureLoad(uTex, vec2<i32>(_e27.xy), 0i);\n    let _e32 = _e31.xxx;\n    o = vec4<f32>(_e32.x, _e32.y, _e32.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e15 = o;\n    return FragmentOutput(_e15);\n}\n",
  "size": 16,
  "uniforms": {
   "frFlip": [
    0,
    "float",
    0
   ],
   "frH": [
    4,
    "float",
    0
   ]
  },
  "textures": [
   [
    "uTex",
    1,
    2,
    false
   ]
  ],
  "nearest": 0
 }
};
