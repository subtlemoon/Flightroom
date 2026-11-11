// Made by tools/wgsl.mjs from programs.js; don't edit.
/* eslint-disable */
export const WGSL = {
 "down": {
  "hash": "2e27fe43",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uOutSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e16 = cam_1;\n    c = max(_e16, vec3(0f));\n    let _e21 = c;\n    let _e22 = global.uWB;\n    bal = min((_e21 * _e22), vec3(1f));\n    let _e30 = c;\n    let _e32 = c;\n    let _e34 = c;\n    clip = smoothstep(0.88f, 0.97f, max(_e30.x, max(_e32.y, _e34.z)));\n    let _e40 = bal;\n    let _e41 = bal;\n    let _e43 = bal;\n    let _e45 = bal;\n    let _e50 = clip;\n    bal = mix(_e40, vec3(max(_e41.x, max(_e43.y, _e45.z))), vec3(_e50));\n    let _e53 = global.uCam;\n    let _e54 = bal;\n    return (_e53 * _e54);\n}\n\nfn main_1() {\n    var local: f32;\n    var cell: vec2<f32>;\n    var base: vec2<f32>;\n    var lsum: f32 = 0f;\n    var hsum: f32 = 0f;\n    var j: i32 = 0i;\n    var i: i32;\n    var uv: vec2<f32>;\n    var lin: vec3<f32>;\n\n    let _e16 = gl_FragCoord_1;\n    let _e18 = global.frFlip;\n    if (_e18 > 0.5f) {\n        let _e21 = global.frH;\n        let _e22 = gl_FragCoord_1;\n        local = (_e21 - _e22.y);\n    } else {\n        let _e25 = gl_FragCoord_1;\n        local = _e25.y;\n    }\n    let _e28 = local;\n    let _e29 = gl_FragCoord_1;\n    let _e30 = _e29.zw;\n    frFC = vec4<f32>(_e16.x, _e28, _e30.x, _e30.y);\n    let _e35 = global.uOutSize;\n    cell = (vec2(1f) / _e35);\n    let _e39 = frFC;\n    let _e44 = cell;\n    base = ((_e39.xy - vec2(0.5f)) * _e44);\n    loop {\n        let _e53 = j;\n        if !((_e53 < 4i)) {\n            break;\n        }\n        i = 0i;\n        loop {\n            let _e62 = i;\n            if !((_e62 < 4i)) {\n                break;\n            }\n            {\n                let _e69 = base;\n                let _e70 = i;\n                let _e72 = j;\n                let _e78 = cell;\n                uv = (_e69 + (((vec2<f32>(f32(_e70), f32(_e72)) + vec2(0.5f)) * _e78) / vec2(4f)));\n                let _e85 = uv;\n                let _e86 = textureSample(uSrc, uSrc_s, _e85);\n                let _e88 = toLinear(_e86.xyz);\n                lin = _e88;\n                let _e90 = lsum;\n                let _e91 = lin;\n                lsum = (_e90 + log2(max(dot(_e91, W709_), 0.00001f)));\n                let _e97 = hsum;\n                let _e98 = lin;\n                let _e100 = lin;\n                let _e103 = lin;\n                hsum = (_e97 + max(min(min(_e98.x, _e100.y), _e103.z), 0f));\n            }\n            continuing {\n                let _e66 = i;\n                i = (_e66 + 1i);\n            }\n        }\n        continuing {\n            let _e57 = j;\n            j = (_e57 + 1i);\n        }\n    }\n    let _e109 = lsum;\n    let _e112 = hsum;\n    o = vec4<f32>((_e109 / 16f), (_e112 / 16f), 0f, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e23 = o;\n    return FragmentOutput(_e23);\n}\n",
  "size": 80,
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
   "uOutSize": [
    64,
    "vec2",
    0
   ],
   "frFlip": [
    72,
    "float",
    0
   ],
   "frH": [
    76,
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
 "final": {
  "hash": "77259e64",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uHiRect: vec4<f32>,\n    uHiSafe: vec4<f32>,\n    uGlowMix: vec4<f32>,\n    uOut2Ori: mat3x3<f32>,\n    uOri2Photo: mat3x3<f32>,\n    uOut2Crop: mat3x3<f32>,\n    uOriCenter: vec2<f32>,\n    uOriHalf: f32,\n    uCornerR2_: f32,\n    uPersp: mat3x3<f32>,\n    uDistort: f32,\n    uLensK: vec4<f32>,\n    uLensC: vec2<f32>,\n    uLensN: vec2<f32>,\n    uLensVig: f32,\n    uLensVigMid: f32,\n    uDefringeP: f32,\n    uDefringeG: f32,\n    uShadowTint: f32,\n    uPhotoPx: vec2<f32>,\n    uOut2Vig: mat3x3<f32>,\n    uCropAspect: f32,\n    uBg: vec3<f32>,\n    uExposure: f32,\n    uContrast: f32,\n    uContrastSat: f32,\n    uToneMap: f32,\n    uTmA: vec4<f32>,\n    uTmB: vec4<f32>,\n    uTmHue: f32,\n    uHighlights: f32,\n    uShadows: f32,\n    uWhites: f32,\n    uBlacks: f32,\n    uHlTop: f32,\n    uTexture: f32,\n    uClarity: f32,\n    uDehaze: f32,\n    uVibrance: f32,\n    uSaturation: f32,\n    uAirY: f32,\n    uSharpen: f32,\n    uSharpenRadius: f32,\n    uSharpenDetail: f32,\n    uSharpenMasking: f32,\n    uNrLum: f32,\n    uNrColor: f32,\n    uNrLumDetail: f32,\n    uNrLumContrast: f32,\n    uNrColorDetail: f32,\n    uNrColorSmooth: f32,\n    uVignette: f32,\n    uVigMid: f32,\n    uVigRound: f32,\n    uVigFeather: f32,\n    uVigStyle: f32,\n    uVigHighlights: f32,\n    uRefineSat: f32,\n    uBW: f32,\n    uGradeS: vec3<f32>,\n    uGradeM: vec3<f32>,\n    uGradeH: vec3<f32>,\n    uGradeG: vec3<f32>,\n    uGradeLum: vec4<f32>,\n    uGradeShape: vec2<f32>,\n    uGradeOn: f32,\n    uGrain: vec3<f32>,\n    uShowClip: f32,\n    uMelissa: f32,\n    uOriSize: vec2<f32>,\n    uMaskN: f32,\n    uMA: array<vec4<f32>, 16>,\n    uMB: array<vec4<f32>, 16>,\n    uMC: array<vec4<f32>, 16>,\n    uMD: array<vec4<f32>, 16>,\n    uMR: array<vec4<f32>, 16>,\n    uME: array<vec4<f32>, 16>,\n    uMF: array<vec4<f32>, 16>,\n    uMP: array<vec4<f32>, 16>,\n    uMQ: array<vec4<f32>, 16>,\n    uMS: array<vec4<f32>, 16>,\n    uDcp: f32,\n    uBaseSat: f32,\n    uHsmDims: vec4<f32>,\n    uLookADims: vec4<f32>,\n    uLookBDims: vec4<f32>,\n    uS2P: mat3x3<f32>,\n    uP2S: mat3x3<f32>,\n    uPointView: f32,\n    uMaskView: f32,\n    uMaskColor: vec3<f32>,\n    uMaskOpacity: f32,\n    uMaskStyle: f32,\n    uMaskLine: f32,\n    uMaskFeather: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\nconst CS_K: f32 = 0.25f;\nconst CS_V: f32 = 0.1f;\nconst CON_K: f32 = 1f;\nconst CON_PIVOT: f32 = 0.6f;\nconst CON_LUM: f32 = 0.6f;\nconst HL_K: f32 = 1.3f;\nconst HL_LO: f32 = 0.35f;\nconst HL_T0_: f32 = 0.65f;\nconst HL_T1_: f32 = 0.85f;\nconst SH_K: f32 = 1.3f;\nconst SH_HI: f32 = 0.65f;\nconst SH_DEEP: f32 = 0.8f;\nconst SH_C: f32 = 0.3f;\nconst HL_X: f32 = 0.5f;\nconst SH_X: f32 = 0.2f;\nconst LIFT_EDGE: f32 = 1f;\nconst LIFT_R: f32 = 4f;\nconst CON_LOCAL: f32 = 0.45f;\nconst WB_LOCAL: f32 = 0.45f;\nconst WH_NEG: f32 = 0.24f;\nconst WH_POS: f32 = 0.3f;\nconst BL_NEG: f32 = 1.4f;\nconst BL_POS: f32 = 0.55f;\nconst BL_N: f32 = 2.36f;\nconst BL_LIFT: f32 = 0.035f;\nconst LIFT_GREY: f32 = 0.9f;\nconst CHROMA_FLOOR: f32 = 0.004f;\nconst SRGB_TO_PP: mat3x3<f32> = mat3x3<f32>(vec3<f32>(0.529346f, 0.098374f, 0.016883f), vec3<f32>(0.330073f, 0.873461f, 0.117672f), vec3<f32>(0.140581f, 0.028165f, 0.865444f));\nconst PP_TO_SRGB: mat3x3<f32> = mat3x3<f32>(vec3<f32>(2.034076f, -0.228813f, -0.00857f), vec3<f32>(-0.727334f, 1.23173f, -0.153287f), vec3<f32>(-0.306742f, -0.002917f, 1.161856f));\nconst MIX_HUE: f32 = 37.97f;\nconst MIX_SAT_UP: f32 = 0.211f;\nconst MIX_SAT_DOWN: f32 = 0.692f;\nconst MIX_LUM_UP: f32 = 0.929f;\nconst MIX_LUM_DOWN: f32 = 0.834f;\nconst MIX_LUM_SAT: f32 = 0.127f;\nconst MIX_S: f32 = 0.0615f;\nconst GRADE_OFF: f32 = 0.165f;\nconst GRADE_K: f32 = 0.0787f;\nconst GRADE_D: f32 = 0.248f;\nconst GRADE_Q: f32 = 0.18f;\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\n@group(0) @binding(3) \nvar uHi: texture_2d<f32>;\n@group(0) @binding(4) \nvar uHi_s: sampler;\n@group(0) @binding(5) \nvar uGuide: texture_2d<f32>;\n@group(0) @binding(6) \nvar uGuide_s: sampler;\n@group(0) @binding(7) \nvar uGlow: texture_2d<f32>;\n@group(0) @binding(8) \nvar uGlow_s: sampler;\n@group(0) @binding(9) \nvar uCurve: texture_2d<f32>;\n@group(0) @binding(10) \nvar uCurve_s: sampler;\n@group(0) @binding(11) \nvar uHue: texture_2d<f32>;\n@group(0) @binding(12) \nvar uHue_s: sampler;\n@group(0) @binding(13) \nvar uMask0_: texture_2d<f32>;\n@group(0) @binding(14) \nvar uMask0_s: sampler;\n@group(0) @binding(15) \nvar uMask1_: texture_2d<f32>;\n@group(0) @binding(16) \nvar uMask1_s: sampler;\n@group(0) @binding(17) \nvar uMask2_: texture_2d<f32>;\n@group(0) @binding(18) \nvar uMask2_s: sampler;\n@group(0) @binding(19) \nvar uMask3_: texture_2d<f32>;\n@group(0) @binding(20) \nvar uMask3_s: sampler;\n@group(0) @binding(21) \nvar uMaskCurve: texture_2d<f32>;\n@group(0) @binding(22) \nvar uMaskCurve_s: sampler;\n@group(0) @binding(23) \nvar uHsm: texture_2d<f32>;\n@group(0) @binding(24) \nvar uHsm_s: sampler;\n@group(0) @binding(25) \nvar uLookA: texture_2d<f32>;\n@group(0) @binding(26) \nvar uLookA_s: sampler;\n@group(0) @binding(27) \nvar uLookB: texture_2d<f32>;\n@group(0) @binding(28) \nvar uLookB_s: sampler;\n@group(0) @binding(29) \nvar uTone: texture_2d<f32>;\n@group(0) @binding(30) \nvar uTone_s: sampler;\n@group(0) @binding(31) \nvar frNearest: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o_4: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e233 = cam_1;\n    c = max(_e233, vec3(0f));\n    let _e238 = c;\n    let _e239 = global.uWB;\n    bal = min((_e238 * _e239), vec3(1f));\n    let _e247 = c;\n    let _e249 = c;\n    let _e251 = c;\n    clip = smoothstep(0.88f, 0.97f, max(_e247.x, max(_e249.y, _e251.z)));\n    let _e257 = bal;\n    let _e258 = bal;\n    let _e260 = bal;\n    let _e262 = bal;\n    let _e267 = clip;\n    bal = mix(_e257, vec3(max(_e258.x, max(_e260.y, _e262.z))), vec3(_e267));\n    let _e270 = global.uCam;\n    let _e271 = bal;\n    return (_e270 * _e271);\n}\n\nfn conCurve(x: f32, k: f32) -> f32 {\n    var x_1: f32;\n    var k_1: f32;\n    var p: f32 = CON_PIVOT;\n    var local: f32;\n    var t: f32;\n    var local_1: f32;\n\n    x_1 = x;\n    k_1 = k;\n    let _e241 = x_1;\n    let _e242 = p;\n    if (_e241 < _e242) {\n        let _e245 = x_1;\n        let _e247 = p;\n        local = ((0.5f * _e245) / _e247);\n    } else {\n        let _e251 = x_1;\n        let _e252 = p;\n        let _e256 = p;\n        local = (0.5f + ((0.5f * (_e251 - _e252)) / (1f - _e256)));\n    }\n    let _e261 = local;\n    t = clamp(_e261, 0f, 1f);\n    let _e266 = t;\n    let _e267 = k_1;\n    let _e268 = t;\n    let _e269 = t;\n    let _e273 = t;\n    let _e277 = t;\n    t = (_e266 + (_e267 * (((_e268 * _e269) * (3f - (2f * _e273))) - _e277)));\n    let _e281 = t;\n    if (_e281 < 0.5f) {\n        let _e285 = p;\n        let _e287 = t;\n        local_1 = ((2f * _e285) * _e287);\n    } else {\n        let _e289 = p;\n        let _e290 = t;\n        let _e296 = p;\n        local_1 = (_e289 + (((_e290 - 0.5f) * 2f) * (1f - _e296)));\n    }\n    let _e301 = local_1;\n    return _e301;\n}\n\nfn cam_2(p_1: vec2<f32>) -> vec3<f32> {\n    var p_2: vec2<f32>;\n\n    p_2 = p_1;\n    let _e260 = global.uHiRect;\n    let _e264 = p_2;\n    let _e266 = global.uHiSafe;\n    let _e270 = p_2;\n    let _e272 = global.uHiSafe;\n    let _e276 = p_2;\n    let _e278 = global.uHiSafe;\n    let _e280 = global.uHiSafe;\n    let _e285 = p_2;\n    let _e287 = global.uHiSafe;\n    let _e289 = global.uHiSafe;\n    if (((((_e260.z > 0f) && (_e264.x >= _e266.x)) && (_e270.y >= _e272.y)) && (_e276.x <= (_e278.x + _e280.z))) && (_e285.y <= (_e287.y + _e289.w))) {\n        let _e294 = p_2;\n        let _e295 = global.uHiRect;\n        let _e298 = global.uHiRect;\n        let _e301 = textureSample(uHi, uHi_s, ((_e294 - _e295.xy) / _e298.zw));\n        return _e301.xyz;\n    }\n    let _e303 = p_2;\n    let _e304 = textureSample(uSrc, uSrc_s, _e303);\n    return _e304.xyz;\n}\n\nfn logLum(p_3: vec2<f32>) -> f32 {\n    var p_4: vec2<f32>;\n\n    p_4 = p_3;\n    let _e260 = p_4;\n    let _e261 = cam_2(_e260);\n    let _e262 = toLinear(_e261);\n    return log2(max(dot(_e262, W709_), 0.00001f));\n}\n\nfn ring(p_5: vec2<f32>, r: f32) -> f32 {\n    var p_6: vec2<f32>;\n    var r_1: f32;\n    var d: vec2<f32>;\n    var s: f32 = 0f;\n    var e: vec2<f32>;\n\n    p_6 = p_5;\n    r_1 = r;\n    let _e262 = global.uPhotoPx;\n    let _e263 = r_1;\n    d = (_e262 * _e263);\n    let _e268 = s;\n    let _e269 = p_6;\n    let _e270 = d;\n    let _e275 = logLum((_e269 + vec2<f32>(_e270.x, 0f)));\n    let _e276 = p_6;\n    let _e277 = d;\n    let _e282 = logLum((_e276 - vec2<f32>(_e277.x, 0f)));\n    s = (_e268 + (_e275 + _e282));\n    let _e285 = s;\n    let _e286 = p_6;\n    let _e288 = d;\n    let _e292 = logLum((_e286 + vec2<f32>(0f, _e288.y)));\n    let _e293 = p_6;\n    let _e295 = d;\n    let _e299 = logLum((_e293 - vec2<f32>(0f, _e295.y)));\n    s = (_e285 + (_e292 + _e299));\n    let _e302 = d;\n    e = (_e302 * 0.7071f);\n    let _e306 = s;\n    let _e307 = p_6;\n    let _e308 = e;\n    let _e310 = logLum((_e307 + _e308));\n    let _e311 = p_6;\n    let _e312 = e;\n    let _e314 = logLum((_e311 - _e312));\n    let _e316 = p_6;\n    let _e317 = e;\n    let _e319 = e;\n    let _e324 = logLum((_e316 + vec2<f32>(_e317.x, -(_e319.y))));\n    let _e326 = p_6;\n    let _e327 = e;\n    let _e330 = e;\n    let _e334 = logLum((_e326 + vec2<f32>(-(_e327.x), _e330.y)));\n    s = (_e306 + (((_e310 + _e314) + _e324) + _e334));\n    let _e337 = s;\n    return (_e337 / 8f);\n}\n\nfn shoulder(x_2: vec3<f32>) -> vec3<f32> {\n    var x_3: vec3<f32>;\n    var k_2: f32 = 0.72f;\n    var over: vec3<f32>;\n\n    x_3 = x_2;\n    let _e262 = k_2;\n    let _e264 = k_2;\n    let _e267 = x_3;\n    let _e268 = k_2;\n    let _e273 = k_2;\n    over = (vec3(_e262) + ((1f - _e264) * (vec3(1f) - exp((-((_e267 - vec3(_e268))) / vec3((1f - _e273)))))));\n    let _e284 = x_3;\n    let _e285 = over;\n    let _e286 = k_2;\n    let _e287 = x_3;\n    return mix(_e284, _e285, step(vec3(_e286), _e287));\n}\n\nfn shoulder1_(x_4: f32) -> f32 {\n    var x_5: f32;\n\n    x_5 = x_4;\n    let _e260 = x_5;\n    let _e262 = shoulder(vec3(_e260));\n    return _e262.x;\n}\n\nfn chroma(c_1: vec3<f32>) -> vec3<f32> {\n    var c_2: vec3<f32>;\n    var y: f32;\n\n    c_2 = c_1;\n    let _e261 = c_2;\n    y = dot(_e261, W709_);\n    let _e264 = c_2;\n    let _e265 = y;\n    let _e268 = y;\n    return ((_e264 - vec3(_e265)) / vec3(max(_e268, CHROMA_FLOOR)));\n}\n\nfn encode(x_6: vec3<f32>) -> vec3<f32> {\n    var x_7: vec3<f32>;\n\n    x_7 = x_6;\n    let _e261 = x_7;\n    let _e265 = x_7;\n    let _e279 = x_7;\n    return mix((_e261 * 12.92f), ((1.055f * pow(max(_e265, vec3(0f)), vec3(0.41666666f))) - vec3(0.055f)), step(vec3(0.0031308f), _e279));\n}\n\nfn sigmoid1_(x_8: f32, pf: f32, pp: f32, k_3: f32) -> f32 {\n    var x_9: f32;\n    var pf_1: f32;\n    var pp_1: f32;\n    var k_4: f32;\n    var g: f32 = 0.18f;\n    var u: f32;\n    var w: f32;\n\n    x_9 = x_8;\n    pf_1 = pf;\n    pp_1 = pp;\n    k_4 = k_3;\n    let _e267 = x_9;\n    if (_e267 <= 0f) {\n        return 0f;\n    }\n    let _e273 = x_9;\n    let _e274 = g;\n    if (_e273 <= _e274) {\n        {\n            let _e276 = x_9;\n            let _e277 = g;\n            let _e279 = pf_1;\n            u = pow((_e276 / _e277), _e279);\n            let _e282 = u;\n            let _e283 = u;\n            let _e284 = k_4;\n            let _e287 = pp_1;\n            return pow((_e282 / (_e283 + _e284)), _e287);\n        }\n    }\n    let _e289 = g;\n    let _e290 = x_9;\n    let _e292 = pf_1;\n    w = pow((_e289 / _e290), _e292);\n    let _e297 = k_4;\n    let _e298 = w;\n    let _e302 = pp_1;\n    return pow((1f / (1f + (_e297 * _e298))), _e302);\n}\n\nfn sigmoidMap(x_10: vec3<f32>) -> vec3<f32> {\n    var x_11: vec3<f32>;\n    var pf_2: f32;\n    var pp_2: f32;\n    var k_5: f32;\n    var ph: f32;\n    var c0_: vec3<f32>;\n    var c_3: vec3<f32>;\n    var mx0_: f32;\n    var mn0_: f32;\n    var mx1_: f32;\n    var mn1_: f32;\n    var h: vec3<f32>;\n\n    x_11 = x_10;\n    let _e261 = global.uTmA;\n    pf_2 = _e261.x;\n    let _e264 = global.uTmA;\n    pp_2 = _e264.y;\n    let _e267 = global.uTmA;\n    k_5 = _e267.z;\n    let _e270 = global.uTmA;\n    ph = _e270.w;\n    let _e273 = x_11;\n    c0_ = max(_e273, vec3(0f));\n    let _e278 = c0_;\n    let _e280 = pf_2;\n    let _e281 = pp_2;\n    let _e282 = k_5;\n    let _e283 = sigmoid1_(_e278.x, _e280, _e281, _e282);\n    let _e284 = c0_;\n    let _e286 = pf_2;\n    let _e287 = pp_2;\n    let _e288 = k_5;\n    let _e289 = sigmoid1_(_e284.y, _e286, _e287, _e288);\n    let _e290 = c0_;\n    let _e292 = pf_2;\n    let _e293 = pp_2;\n    let _e294 = k_5;\n    let _e295 = sigmoid1_(_e290.z, _e292, _e293, _e294);\n    c_3 = vec3<f32>(_e283, _e289, _e295);\n    let _e298 = ph;\n    if (_e298 > 0f) {\n        {\n            let _e301 = c0_;\n            let _e303 = c0_;\n            let _e305 = c0_;\n            mx0_ = max(_e301.x, max(_e303.y, _e305.z));\n            let _e310 = c0_;\n            let _e312 = c0_;\n            let _e314 = c0_;\n            mn0_ = min(_e310.x, min(_e312.y, _e314.z));\n            let _e319 = c_3;\n            let _e321 = c_3;\n            let _e323 = c_3;\n            mx1_ = max(_e319.x, max(_e321.y, _e323.z));\n            let _e328 = c_3;\n            let _e330 = c_3;\n            let _e332 = c_3;\n            mn1_ = min(_e328.x, min(_e330.y, _e332.z));\n            let _e337 = mx0_;\n            let _e338 = mn0_;\n            let _e342 = mx1_;\n            let _e343 = mn1_;\n            if (((_e337 - _e338) > 0.000001f) && ((_e342 - _e343) > 0.000001f)) {\n                {\n                    let _e348 = mn1_;\n                    let _e349 = c0_;\n                    let _e350 = mn0_;\n                    let _e353 = mx0_;\n                    let _e354 = mn0_;\n                    let _e363 = mx1_;\n                    let _e364 = mn1_;\n                    h = (vec3(_e348) + (clamp(((_e349 - vec3(_e350)) / vec3((_e353 - _e354))), vec3(0f), vec3(1f)) * (_e363 - _e364)));\n                    let _e370 = c_3;\n                    let _e371 = h;\n                    let _e372 = ph;\n                    c_3 = mix(_e370, _e371, vec3(_e372));\n                }\n            }\n        }\n    }\n    let _e375 = c_3;\n    return clamp(_e375, vec3(0f), vec3(1f));\n}\n\nfn agxMap(x_12: vec3<f32>) -> vec3<f32> {\n    var x_13: vec3<f32>;\n    var inset: mat3x3<f32> = mat3x3<f32>(vec3<f32>(0.84247905f, 0.042328242f, 0.042375654f), vec3<f32>(0.0784336f, 0.87846863f, 0.0784336f), vec3<f32>(0.079223745f, 0.07916613f, 0.879143f));\n    var outset: mat3x3<f32> = mat3x3<f32>(vec3<f32>(1.196879f, -0.052896854f, -0.052971635f), vec3<f32>(-0.09802088f, 1.1519032f, -0.09804345f), vec3<f32>(-0.09902974f, -0.098961174f, 1.1510737f));\n    var lo: f32 = -12.47393f;\n    var hi: f32 = 4.026069f;\n    var mid: f32 = 0.6060606f;\n    var v: vec3<f32>;\n    var v2_: vec3<f32>;\n    var v4_: vec3<f32>;\n    var lin: vec3<f32>;\n    var y_1: f32;\n    var roll: f32;\n    var sat: f32;\n\n    x_13 = x_12;\n    let _e302 = inset;\n    let _e303 = x_13;\n    let _e312 = lo;\n    let _e315 = hi;\n    let _e316 = lo;\n    v = clamp(((log2(max((_e302 * max(_e303, vec3(0f))), vec3(0.0000000001f))) - vec3(_e312)) / vec3((_e315 - _e316))), vec3(0f), vec3(1f));\n    let _e326 = mid;\n    let _e327 = v;\n    let _e328 = mid;\n    let _e331 = global.uTmA;\n    v = clamp((vec3(_e326) + ((_e327 - vec3(_e328)) * _e331.x)), vec3(0f), vec3(1f));\n    let _e341 = v;\n    let _e342 = v;\n    v2_ = (_e341 * _e342);\n    let _e345 = v2_;\n    let _e346 = v2_;\n    v4_ = (_e345 * _e346);\n    let _e350 = v4_;\n    let _e352 = v2_;\n    let _e355 = v4_;\n    let _e357 = v;\n    let _e361 = v4_;\n    let _e365 = v2_;\n    let _e367 = v;\n    let _e371 = v2_;\n    let _e375 = v;\n    v = ((((((((15.5f * _e350) * _e352) - ((40.14f * _e355) * _e357)) + (31.96f * _e361)) - ((6.868f * _e365) * _e367)) + (0.4298f * _e371)) + (0.1191f * _e375)) - vec3(0.00232f));\n    let _e381 = outset;\n    let _e382 = v;\n    lin = max((_e381 * pow(max(_e382, vec3(0f)), vec3(2.2f))), vec3(0f));\n    let _e394 = lin;\n    y_1 = dot(_e394, W709_);\n    let _e399 = y_1;\n    let _e401 = global.uTmA;\n    roll = (smoothstep(0.5f, 1f, _e399) * _e401.z);\n    let _e405 = global.uTmA;\n    let _e408 = roll;\n    sat = (_e405.y * (1f - _e408));\n    let _e412 = y_1;\n    let _e413 = lin;\n    let _e414 = y_1;\n    let _e417 = sat;\n    return clamp((vec3(_e412) + ((_e413 - vec3(_e414)) * _e417)), vec3(0f), vec3(1f));\n}\n\nfn filmic1_(x_14: f32) -> f32 {\n    var x_15: f32;\n    var ev: f32;\n    var t_1: f32;\n    var s_1: f32;\n    var t1_: f32;\n    var y1_: f32;\n    var t2_: f32;\n    var y2_: f32;\n    var u_1: f32;\n    var m1_: f32;\n    var v_1: f32;\n    var d2_: f32;\n    var m2_: f32;\n\n    x_15 = x_14;\n    let _e261 = x_15;\n    if (_e261 <= 0f) {\n        return 0f;\n    }\n    let _e265 = x_15;\n    ev = log2((max(_e265, 0.0000000001f) / 0.18f));\n    let _e272 = ev;\n    let _e273 = global.uTmA;\n    let _e276 = global.uTmA;\n    t_1 = clamp(((_e272 - _e273.x) * _e276.y), 0f, 1f);\n    let _e283 = global.uTmA;\n    s_1 = _e283.w;\n    let _e286 = global.uTmB;\n    t1_ = _e286.x;\n    let _e289 = global.uTmB;\n    y1_ = _e289.y;\n    let _e292 = global.uTmB;\n    t2_ = _e292.z;\n    let _e295 = global.uTmB;\n    y2_ = _e295.w;\n    let _e298 = t_1;\n    let _e299 = t1_;\n    if (_e298 < _e299) {\n        {\n            let _e301 = t_1;\n            let _e302 = t1_;\n            u_1 = (_e301 / max(_e302, 0.000001f));\n            let _e307 = s_1;\n            let _e308 = t1_;\n            m1_ = (_e307 * _e308);\n            let _e311 = u_1;\n            let _e312 = u_1;\n            let _e315 = y1_;\n            let _e317 = m1_;\n            let _e319 = m1_;\n            let _e321 = y1_;\n            let _e324 = u_1;\n            return ((_e311 * _e312) * (((3f * _e315) - _e317) + ((_e319 - (2f * _e321)) * _e324)));\n        }\n    }\n    let _e328 = t_1;\n    let _e329 = t2_;\n    if (_e328 <= _e329) {\n        let _e331 = y1_;\n        let _e332 = s_1;\n        let _e333 = t_1;\n        let _e334 = t1_;\n        return (_e331 + (_e332 * (_e333 - _e334)));\n    }\n    let _e339 = t_1;\n    let _e342 = t2_;\n    v_1 = ((1f - _e339) / max((1f - _e342), 0.000001f));\n    let _e349 = y2_;\n    d2_ = (1f - _e349);\n    let _e352 = s_1;\n    let _e354 = t2_;\n    m2_ = (_e352 * (1f - _e354));\n    let _e359 = v_1;\n    let _e360 = v_1;\n    let _e363 = d2_;\n    let _e365 = m2_;\n    let _e367 = m2_;\n    let _e369 = d2_;\n    let _e372 = v_1;\n    return (1f - ((_e359 * _e360) * (((3f * _e363) - _e365) + ((_e367 - (2f * _e369)) * _e372))));\n}\n\nfn filmicMap(x_16: vec3<f32>) -> vec3<f32> {\n    var x_17: vec3<f32>;\n    var c_4: vec3<f32>;\n    var yIn: f32;\n    var yOut: f32;\n    var ev_1: f32;\n    var t_2: f32;\n    var sh: f32;\n    var lat: f32;\n    var d_1: vec3<f32>;\n    var h_1: vec3<f32>;\n    var mx: f32;\n    var mn: f32;\n    var normRgb: vec3<f32>;\n    var perCh: vec3<f32>;\n\n    x_17 = x_16;\n    let _e261 = x_17;\n    c_4 = max(_e261, vec3(0f));\n    let _e266 = c_4;\n    yIn = dot(_e266, W709_);\n    let _e269 = yIn;\n    if (_e269 <= 0.0000000001f) {\n        return vec3(0f);\n    }\n    let _e274 = yIn;\n    let _e275 = filmic1_(_e274);\n    yOut = _e275;\n    let _e277 = yIn;\n    ev_1 = log2((_e277 / 0.18f));\n    let _e282 = ev_1;\n    let _e283 = global.uTmA;\n    let _e286 = global.uTmA;\n    t_2 = clamp(((_e282 - _e283.x) * _e286.y), 0f, 1f);\n    let _e293 = global.uTmB;\n    let _e296 = t_2;\n    sh = smoothstep(_e293.z, 1f, _e296);\n    let _e300 = sh;\n    let _e301 = sh;\n    lat = (1f - ((_e300 * _e301) * 0.65f));\n    let _e307 = c_4;\n    let _e308 = yIn;\n    let _e311 = yOut;\n    let _e312 = yIn;\n    let _e315 = lat;\n    d_1 = (((_e307 - vec3(_e308)) * (_e311 / _e312)) * _e315);\n    let _e318 = yOut;\n    let _e319 = d_1;\n    h_1 = (vec3(_e318) + _e319);\n    let _e323 = h_1;\n    let _e325 = h_1;\n    let _e327 = h_1;\n    mx = max(_e323.x, max(_e325.y, _e327.z));\n    let _e332 = mx;\n    if (_e332 > 1f) {\n        let _e335 = d_1;\n        let _e337 = yOut;\n        let _e339 = mx;\n        let _e340 = yOut;\n        d_1 = (_e335 * ((1f - _e337) / max((_e339 - _e340), 0.000001f)));\n    }\n    let _e346 = yOut;\n    let _e347 = d_1;\n    let _e350 = yOut;\n    let _e351 = d_1;\n    let _e354 = yOut;\n    let _e355 = d_1;\n    mn = min((_e346 + _e347.x), min((_e350 + _e351.y), (_e354 + _e355.z)));\n    let _e361 = mn;\n    if (_e361 < 0f) {\n        let _e364 = d_1;\n        let _e365 = yOut;\n        let _e366 = yOut;\n        let _e367 = mn;\n        d_1 = (_e364 * (_e365 / max((_e366 - _e367), 0.000001f)));\n    }\n    let _e373 = yOut;\n    let _e374 = d_1;\n    normRgb = clamp((vec3(_e373) + _e374), vec3(0f), vec3(1f));\n    let _e383 = global.uTmHue;\n    if (_e383 >= 0.999f) {\n        let _e386 = normRgb;\n        return _e386;\n    }\n    let _e387 = c_4;\n    let _e389 = filmic1_(_e387.x);\n    let _e390 = c_4;\n    let _e392 = filmic1_(_e390.y);\n    let _e393 = c_4;\n    let _e395 = filmic1_(_e393.z);\n    perCh = vec3<f32>(_e389, _e392, _e395);\n    let _e398 = perCh;\n    let _e399 = normRgb;\n    let _e400 = global.uTmHue;\n    return clamp(mix(_e398, _e399, vec3(_e400)), vec3(0f), vec3(1f));\n}\n\nfn decodeS(v_2: vec3<f32>) -> vec3<f32> {\n    var v_3: vec3<f32>;\n\n    v_3 = v_2;\n    let _e261 = v_3;\n    let _e265 = v_3;\n    let _e279 = v_3;\n    return mix((_e261 / vec3(12.92f)), pow(((max(_e265, vec3(0f)) + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), step(vec3(0.04045f), _e279));\n}\n\nfn gamutIn(d_2: vec3<f32>) -> vec3<f32> {\n    var d_3: vec3<f32>;\n    var lin_1: vec3<f32>;\n    var ach: f32;\n    var thr: f32 = 0.95f;\n    var lim: f32 = 1.3f;\n    var pw: f32 = 1.2f;\n    var sc: f32;\n    var dist: vec3<f32>;\n    var over_1: vec3<f32>;\n    var cd: vec3<f32>;\n\n    d_3 = d_2;\n    let _e263 = d_3;\n    let _e264 = decodeS(_e263);\n    lin_1 = _e264;\n    let _e266 = lin_1;\n    let _e268 = lin_1;\n    let _e270 = lin_1;\n    ach = max(_e266.x, max(_e268.y, _e270.z));\n    let _e275 = ach;\n    if (_e275 > 0f) {\n        {\n            let _e284 = lim;\n            let _e285 = thr;\n            let _e288 = thr;\n            let _e290 = lim;\n            let _e291 = thr;\n            let _e294 = pw;\n            let _e300 = pw;\n            sc = ((_e284 - _e285) / pow((pow(((1f - _e288) / (_e290 - _e291)), -(_e294)) - 1f), (1f / _e300)));\n            let _e305 = ach;\n            let _e306 = lin_1;\n            let _e309 = ach;\n            dist = ((vec3(_e305) - _e306) / vec3(_e309));\n            let _e313 = dist;\n            let _e314 = thr;\n            let _e320 = sc;\n            over_1 = (max((_e313 - vec3(_e314)), vec3(0f)) / vec3(_e320));\n            let _e324 = dist;\n            let _e325 = thr;\n            let _e326 = sc;\n            let _e327 = over_1;\n            let _e330 = over_1;\n            let _e331 = pw;\n            let _e337 = pw;\n            let _e344 = thr;\n            let _e345 = dist;\n            cd = mix(_e324, (vec3(_e325) + ((_e326 * _e327) / pow((vec3(1f) + pow(_e330, vec3(_e331))), vec3((1f / _e337))))), step(vec3(_e344), _e345));\n            let _e350 = ach;\n            let _e351 = cd;\n            let _e352 = ach;\n            lin_1 = (vec3(_e350) - (_e351 * _e352));\n        }\n    }\n    let _e356 = lin_1;\n    let _e362 = encode(clamp(_e356, vec3(0f), vec3(1f)));\n    return clamp(_e362, vec3(0f), vec3(1f));\n}\n\nfn srgbToLin(c_5: vec3<f32>) -> vec3<f32> {\n    var c_6: vec3<f32>;\n    var a: vec3<f32>;\n\n    c_6 = c_5;\n    let _e274 = c_6;\n    a = abs(_e274);\n    let _e277 = c_6;\n    let _e279 = a;\n    let _e289 = a;\n    let _e293 = a;\n    return (sign(_e277) * mix(pow(((_e279 + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), (_e289 / vec3(12.92f)), step(_e293, vec3(0.04045f))));\n}\n\nfn linToSrgb(c_7: vec3<f32>) -> vec3<f32> {\n    var c_8: vec3<f32>;\n    var a_1: vec3<f32>;\n\n    c_8 = c_7;\n    let _e274 = c_8;\n    a_1 = abs(_e274);\n    let _e277 = c_8;\n    let _e280 = a_1;\n    let _e290 = a_1;\n    let _e293 = a_1;\n    return (sign(_e277) * mix(((1.055f * pow(_e280, vec3(0.41666666f))) - vec3(0.055f)), (_e290 * 12.92f), step(_e293, vec3(0.0031308f))));\n}\n\nfn toOklab(c_9: vec3<f32>) -> vec3<f32> {\n    var c_10: vec3<f32>;\n    var l: vec3<f32>;\n\n    c_10 = c_9;\n    let _e274 = c_10;\n    let _e275 = srgbToLin(_e274);\n    l = (_e275 * mat3x3<f32>(vec3<f32>(0.41222146f, 0.53633255f, 0.051445995f), vec3<f32>(0.2119035f, 0.6806995f, 0.10739696f), vec3<f32>(0.08830246f, 0.28171885f, 0.6299787f)));\n    let _e291 = l;\n    let _e293 = l;\n    l = (sign(_e291) * pow(abs(_e293), vec3(0.33333334f)));\n    let _e301 = l;\n    return (_e301 * mat3x3<f32>(vec3<f32>(0.21045426f, 0.7936178f, -0.004072047f), vec3<f32>(1.9779985f, -2.4285922f, 0.4505937f), vec3<f32>(0.025904037f, 0.78277177f, -0.80867577f)));\n}\n\nfn fromOklab(o: vec3<f32>) -> vec3<f32> {\n    var o_1: vec3<f32>;\n    var l_1: vec3<f32>;\n\n    o_1 = o;\n    let _e274 = o_1;\n    l_1 = (_e274 * mat3x3<f32>(vec3<f32>(1f, 0.39633778f, 0.21580376f), vec3<f32>(1f, -0.105561346f, -0.06385417f), vec3<f32>(1f, -0.08948418f, -1.2914855f)));\n    let _e294 = l_1;\n    let _e295 = l_1;\n    let _e297 = l_1;\n    l_1 = ((_e294 * _e295) * _e297);\n    let _e299 = l_1;\n    let _e319 = linToSrgb((_e299 * mat3x3<f32>(vec3<f32>(4.0767417f, -3.3077116f, 0.23096994f), vec3<f32>(-1.268438f, 2.6097574f, -0.34131938f), vec3<f32>(-0.0041960864f, -0.7034186f, 1.7076147f))));\n    return _e319;\n}\n\nfn hsv(c_11: vec3<f32>) -> vec3<f32> {\n    var c_12: vec3<f32>;\n    var mx_1: f32;\n    var mn_1: f32;\n    var d_4: f32;\n    var h_2: f32 = 0f;\n    var local_2: f32;\n\n    c_12 = c_11;\n    let _e274 = c_12;\n    let _e276 = c_12;\n    let _e278 = c_12;\n    mx_1 = max(_e274.x, max(_e276.y, _e278.z));\n    let _e283 = c_12;\n    let _e285 = c_12;\n    let _e287 = c_12;\n    mn_1 = min(_e283.x, min(_e285.y, _e287.z));\n    let _e292 = mx_1;\n    let _e293 = mn_1;\n    d_4 = (_e292 - _e293);\n    let _e298 = d_4;\n    if (_e298 > 0.00001f) {\n        {\n            let _e301 = mx_1;\n            let _e302 = c_12;\n            if (_e301 == _e302.x) {\n                let _e305 = c_12;\n                let _e307 = c_12;\n                let _e310 = d_4;\n                let _e311 = ((_e305.y - _e307.z) / _e310);\n                h_2 = (_e311 - (floor((_e311 / 6f)) * 6f));\n            } else {\n                let _e317 = mx_1;\n                let _e318 = c_12;\n                if (_e317 == _e318.y) {\n                    let _e321 = c_12;\n                    let _e323 = c_12;\n                    let _e326 = d_4;\n                    h_2 = (((_e321.z - _e323.x) / _e326) + 2f);\n                } else {\n                    let _e330 = c_12;\n                    let _e332 = c_12;\n                    let _e335 = d_4;\n                    h_2 = (((_e330.x - _e332.y) / _e335) + 4f);\n                }\n            }\n        }\n    }\n    let _e339 = h_2;\n    let _e342 = mx_1;\n    if (_e342 > 0f) {\n        let _e345 = d_4;\n        let _e346 = mx_1;\n        local_2 = (_e345 / _e346);\n    } else {\n        local_2 = 0f;\n    }\n    let _e350 = local_2;\n    let _e351 = mx_1;\n    return vec3<f32>((_e339 * 60f), _e350, _e351);\n}\n\nfn rotateHue(c_13: vec3<f32>, deg: f32) -> vec3<f32> {\n    var c_14: vec3<f32>;\n    var deg_1: f32;\n    var a_2: f32;\n    var s_2: f32;\n    var co: f32;\n    var k_6: vec3<f32> = vec3(0.57735f);\n    var m: f32;\n    var v_4: vec3<f32>;\n\n    c_14 = c_13;\n    deg_1 = deg;\n    let _e276 = deg_1;\n    a_2 = radians(_e276);\n    let _e279 = a_2;\n    s_2 = sin(_e279);\n    let _e282 = a_2;\n    co = cos(_e282);\n    let _e288 = c_14;\n    let _e290 = c_14;\n    let _e293 = c_14;\n    m = (((_e288.x + _e290.y) + _e293.z) / 3f);\n    let _e299 = c_14;\n    let _e300 = m;\n    v_4 = (_e299 - vec3(_e300));\n    let _e304 = m;\n    let _e305 = v_4;\n    let _e306 = co;\n    let _e310 = k_6;\n    let _e311 = v_4;\n    let _e313 = s_2;\n    return ((vec3(_e304) + (_e305 * _e306)) + (cross(_e310, _e311) * _e313));\n}\n\nfn rgbToHsv6_(c_15: vec3<f32>) -> vec3<f32> {\n    var c_16: vec3<f32>;\n    var v_5: f32;\n    var gap: f32;\n    var local_3: f32;\n    var local_4: f32;\n    var h_3: f32;\n\n    c_16 = c_15;\n    let _e274 = c_16;\n    let _e276 = c_16;\n    let _e278 = c_16;\n    v_5 = max(_e274.x, max(_e276.y, _e278.z));\n    let _e283 = v_5;\n    let _e284 = c_16;\n    let _e286 = c_16;\n    let _e288 = c_16;\n    gap = (_e283 - min(_e284.x, min(_e286.y, _e288.z)));\n    let _e294 = gap;\n    if (_e294 <= 0f) {\n        let _e299 = v_5;\n        return vec3<f32>(0f, 0f, _e299);\n    }\n    let _e301 = c_16;\n    let _e303 = v_5;\n    if (_e301.x == _e303) {\n        let _e305 = c_16;\n        let _e307 = c_16;\n        let _e310 = gap;\n        local_4 = ((_e305.y - _e307.z) / _e310);\n    } else {\n        let _e312 = c_16;\n        let _e314 = v_5;\n        if (_e312.y == _e314) {\n            let _e317 = c_16;\n            let _e319 = c_16;\n            let _e322 = gap;\n            local_3 = (2f + ((_e317.z - _e319.x) / _e322));\n        } else {\n            let _e326 = c_16;\n            let _e328 = c_16;\n            let _e331 = gap;\n            local_3 = (4f + ((_e326.x - _e328.y) / _e331));\n        }\n        let _e335 = local_3;\n        local_4 = _e335;\n    }\n    let _e337 = local_4;\n    h_3 = _e337;\n    let _e339 = h_3;\n    if (_e339 < 0f) {\n        let _e342 = h_3;\n        h_3 = (_e342 + 6f);\n    }\n    let _e345 = h_3;\n    let _e346 = gap;\n    let _e347 = v_5;\n    let _e349 = v_5;\n    return vec3<f32>(_e345, (_e346 / _e347), _e349);\n}\n\nfn hsv6ToRgb(c_17: vec3<f32>) -> vec3<f32> {\n    var c_18: vec3<f32>;\n    var h_4: f32;\n    var s_3: f32;\n    var v_6: f32;\n    var i: f32;\n    var f: f32;\n    var p_7: f32;\n    var q: f32;\n    var t_3: f32;\n\n    c_18 = c_17;\n    let _e274 = c_18;\n    h_4 = (_e274.x - (floor((_e274.x / 6f)) * 6f));\n    let _e282 = c_18;\n    s_3 = _e282.y;\n    let _e285 = c_18;\n    v_6 = _e285.z;\n    let _e288 = s_3;\n    if (_e288 <= 0f) {\n        let _e291 = v_6;\n        return vec3(_e291);\n    }\n    let _e293 = h_4;\n    i = floor(_e293);\n    let _e296 = h_4;\n    let _e297 = i;\n    f = (_e296 - _e297);\n    let _e300 = v_6;\n    let _e302 = s_3;\n    p_7 = (_e300 * (1f - _e302));\n    let _e306 = v_6;\n    let _e308 = s_3;\n    let _e309 = f;\n    q = (_e306 * (1f - (_e308 * _e309)));\n    let _e314 = v_6;\n    let _e316 = s_3;\n    let _e318 = f;\n    t_3 = (_e314 * (1f - (_e316 * (1f - _e318))));\n    let _e324 = i;\n    if (_e324 < 1f) {\n        let _e327 = v_6;\n        let _e328 = t_3;\n        let _e329 = p_7;\n        return vec3<f32>(_e327, _e328, _e329);\n    }\n    let _e331 = i;\n    if (_e331 < 2f) {\n        let _e334 = q;\n        let _e335 = v_6;\n        let _e336 = p_7;\n        return vec3<f32>(_e334, _e335, _e336);\n    }\n    let _e338 = i;\n    if (_e338 < 3f) {\n        let _e341 = p_7;\n        let _e342 = v_6;\n        let _e343 = t_3;\n        return vec3<f32>(_e341, _e342, _e343);\n    }\n    let _e345 = i;\n    if (_e345 < 4f) {\n        let _e348 = p_7;\n        let _e349 = q;\n        let _e350 = v_6;\n        return vec3<f32>(_e348, _e349, _e350);\n    }\n    let _e352 = i;\n    if (_e352 < 5f) {\n        let _e355 = t_3;\n        let _e356 = p_7;\n        let _e357 = v_6;\n        return vec3<f32>(_e355, _e356, _e357);\n    }\n    let _e359 = v_6;\n    let _e360 = p_7;\n    let _e361 = q;\n    return vec3<f32>(_e359, _e360, _e361);\n}\n\nfn encS1_(x_18: f32) -> f32 {\n    var x_19: f32;\n    var local_5: f32;\n\n    x_19 = x_18;\n    let _e274 = x_19;\n    if (_e274 <= 0.0031308f) {\n        let _e277 = x_19;\n        local_5 = (_e277 * 12.92f);\n    } else {\n        let _e281 = x_19;\n        local_5 = ((1.055f * pow(_e281, 0.41666666f)) - 0.055f);\n    }\n    let _e290 = local_5;\n    return _e290;\n}\n\nfn decS1_(x_20: f32) -> f32 {\n    var x_21: f32;\n    var local_6: f32;\n\n    x_21 = x_20;\n    let _e274 = x_21;\n    if (_e274 <= 0.04045f) {\n        let _e277 = x_21;\n        local_6 = (_e277 / 12.92f);\n    } else {\n        let _e280 = x_21;\n        local_6 = pow(((_e280 + 0.055f) / 1.055f), 2.4f);\n    }\n    let _e288 = local_6;\n    return _e288;\n}\n\nfn hsmAt(t_4: texture_2d<f32>, hues: i32, v_7: i32, h_5: i32, s_4: i32) -> vec3<f32> {\n    var hues_1: i32;\n    var v_8: i32;\n    var h_6: i32;\n    var s_5: i32;\n\n    hues_1 = hues;\n    v_8 = v_7;\n    h_6 = h_5;\n    s_5 = s_4;\n    let _e281 = s_5;\n    let _e282 = v_8;\n    let _e283 = hues_1;\n    let _e285 = h_6;\n    let _e289 = textureLoad(t_4, vec2<i32>(_e281, ((_e282 * _e283) + _e285)), 0i);\n    return _e289.xyz;\n}\n\nfn hueSatMap(t_5: texture_2d<f32>, dims: vec4<f32>, rgb: vec3<f32>) -> vec3<f32> {\n    var dims_1: vec4<f32>;\n    var rgb_1: vec3<f32>;\n    var hues_2: i32;\n    var sats: i32;\n    var vals: i32;\n    var c_19: vec3<f32>;\n    var enc: bool;\n    var local_7: f32;\n    var ve: f32;\n    var local_8: f32;\n    var hS: f32;\n    var sS: f32;\n    var h0_: i32;\n    var h1_: i32;\n    var s0_: i32;\n    var hf: f32;\n    var sf: f32;\n    var d_5: vec3<f32>;\n    var vS: f32;\n    var v0_: i32;\n    var vf: f32;\n    var a_3: vec3<f32>;\n    var b: vec3<f32>;\n    var local_9: f32;\n\n    dims_1 = dims;\n    rgb_1 = rgb;\n    let _e277 = dims_1;\n    hues_2 = i32(_e277.x);\n    let _e281 = dims_1;\n    sats = i32(_e281.y);\n    let _e285 = dims_1;\n    vals = i32(_e285.z);\n    let _e289 = rgb_1;\n    let _e290 = rgbToHsv6_(_e289);\n    c_19 = _e290;\n    let _e292 = dims_1;\n    let _e296 = c_19;\n    enc = ((_e292.w > 0.5f) && (_e296.z <= 1f));\n    let _e302 = enc;\n    if _e302 {\n        let _e303 = c_19;\n        let _e305 = encS1_(_e303.z);\n        local_7 = _e305;\n    } else {\n        let _e306 = c_19;\n        local_7 = _e306.z;\n    }\n    let _e309 = local_7;\n    ve = _e309;\n    let _e311 = hues_2;\n    if (_e311 < 2i) {\n        local_8 = 0f;\n    } else {\n        let _e315 = c_19;\n        let _e317 = hues_2;\n        local_8 = ((_e315.x * f32(_e317)) / 6f);\n    }\n    let _e323 = local_8;\n    hS = _e323;\n    let _e325 = c_19;\n    let _e327 = sats;\n    sS = (_e325.y * f32((_e327 - 1i)));\n    let _e333 = hS;\n    h0_ = i32(_e333);\n    let _e336 = h0_;\n    h1_ = (_e336 + 1i);\n    let _e340 = sS;\n    let _e342 = sats;\n    s0_ = min(i32(_e340), (_e342 - 2i));\n    let _e347 = h0_;\n    let _e348 = hues_2;\n    if (_e347 >= (_e348 - 1i)) {\n        {\n            let _e352 = hues_2;\n            h0_ = (_e352 - 1i);\n            h1_ = 0i;\n        }\n    }\n    let _e356 = hS;\n    let _e357 = h0_;\n    hf = (_e356 - f32(_e357));\n    let _e361 = sS;\n    let _e362 = s0_;\n    sf = (_e361 - f32(_e362));\n    let _e367 = vals;\n    if (_e367 < 2i) {\n        {\n            let _e370 = hues_2;\n            let _e372 = h0_;\n            let _e373 = s0_;\n            let _e374 = hsmAt(t_5, _e370, 0i, _e372, _e373);\n            let _e375 = hues_2;\n            let _e377 = h1_;\n            let _e378 = s0_;\n            let _e379 = hsmAt(t_5, _e375, 0i, _e377, _e378);\n            let _e380 = hf;\n            let _e383 = hues_2;\n            let _e385 = h0_;\n            let _e386 = s0_;\n            let _e389 = hsmAt(t_5, _e383, 0i, _e385, (_e386 + 1i));\n            let _e390 = hues_2;\n            let _e392 = h1_;\n            let _e393 = s0_;\n            let _e396 = hsmAt(t_5, _e390, 0i, _e392, (_e393 + 1i));\n            let _e397 = hf;\n            let _e400 = sf;\n            d_5 = mix(mix(_e374, _e379, vec3(_e380)), mix(_e389, _e396, vec3(_e397)), vec3(_e400));\n        }\n    } else {\n        {\n            let _e403 = ve;\n            let _e407 = vals;\n            vS = (clamp(_e403, 0f, 1f) * f32((_e407 - 1i)));\n            let _e413 = vS;\n            let _e415 = vals;\n            v0_ = min(i32(_e413), (_e415 - 2i));\n            let _e420 = vS;\n            let _e421 = v0_;\n            vf = (_e420 - f32(_e421));\n            let _e425 = hues_2;\n            let _e426 = v0_;\n            let _e427 = h0_;\n            let _e428 = s0_;\n            let _e429 = hsmAt(t_5, _e425, _e426, _e427, _e428);\n            let _e430 = hues_2;\n            let _e431 = v0_;\n            let _e432 = h1_;\n            let _e433 = s0_;\n            let _e434 = hsmAt(t_5, _e430, _e431, _e432, _e433);\n            let _e435 = hf;\n            let _e438 = hues_2;\n            let _e439 = v0_;\n            let _e440 = h0_;\n            let _e441 = s0_;\n            let _e444 = hsmAt(t_5, _e438, _e439, _e440, (_e441 + 1i));\n            let _e445 = hues_2;\n            let _e446 = v0_;\n            let _e447 = h1_;\n            let _e448 = s0_;\n            let _e451 = hsmAt(t_5, _e445, _e446, _e447, (_e448 + 1i));\n            let _e452 = hf;\n            let _e455 = sf;\n            a_3 = mix(mix(_e429, _e434, vec3(_e435)), mix(_e444, _e451, vec3(_e452)), vec3(_e455));\n            let _e459 = hues_2;\n            let _e460 = v0_;\n            let _e463 = h0_;\n            let _e464 = s0_;\n            let _e465 = hsmAt(t_5, _e459, (_e460 + 1i), _e463, _e464);\n            let _e466 = hues_2;\n            let _e467 = v0_;\n            let _e470 = h1_;\n            let _e471 = s0_;\n            let _e472 = hsmAt(t_5, _e466, (_e467 + 1i), _e470, _e471);\n            let _e473 = hf;\n            let _e476 = hues_2;\n            let _e477 = v0_;\n            let _e480 = h0_;\n            let _e481 = s0_;\n            let _e484 = hsmAt(t_5, _e476, (_e477 + 1i), _e480, (_e481 + 1i));\n            let _e485 = hues_2;\n            let _e486 = v0_;\n            let _e489 = h1_;\n            let _e490 = s0_;\n            let _e493 = hsmAt(t_5, _e485, (_e486 + 1i), _e489, (_e490 + 1i));\n            let _e494 = hf;\n            let _e497 = sf;\n            b = mix(mix(_e465, _e472, vec3(_e473)), mix(_e484, _e493, vec3(_e494)), vec3(_e497));\n            let _e501 = a_3;\n            let _e502 = b;\n            let _e503 = vf;\n            d_5 = mix(_e501, _e502, vec3(_e503));\n        }\n    }\n    let _e507 = c_19;\n    let _e509 = d_5;\n    c_19.x = (_e507.x + (_e509.x * 0.016666668f));\n    let _e517 = c_19;\n    let _e519 = d_5;\n    c_19.y = min((_e517.y * _e519.y), 1f);\n    let _e524 = ve;\n    let _e525 = d_5;\n    ve = (_e524 * _e525.z);\n    let _e528 = c_19;\n    if (_e528.z <= 1f) {\n        let _e532 = ve;\n        ve = clamp(_e532, 0f, 1f);\n    }\n    let _e537 = enc;\n    if _e537 {\n        let _e538 = ve;\n        let _e539 = decS1_(_e538);\n        local_9 = _e539;\n    } else {\n        let _e540 = ve;\n        local_9 = _e540;\n    }\n    let _e542 = local_9;\n    c_19.z = _e542;\n    let _e543 = c_19;\n    let _e544 = hsv6ToRgb(_e543);\n    return _e544;\n}\n\nfn toneAt(x_22: f32) -> f32 {\n    var x_23: f32;\n    var n: i32;\n    var p_8: f32;\n    var i_1: i32;\n\n    x_23 = x_22;\n    let _e275 = textureDimensions(uTone, 0i);\n    n = vec2<i32>(_e275).x;\n    let _e279 = x_23;\n    let _e283 = n;\n    p_8 = (clamp(_e279, 0f, 1f) * f32((_e283 - 1i)));\n    let _e289 = p_8;\n    let _e291 = n;\n    i_1 = min(i32(_e289), (_e291 - 2i));\n    let _e296 = i_1;\n    let _e300 = textureLoad(uTone, vec2<i32>(_e296, 0i), 0i);\n    let _e302 = i_1;\n    let _e308 = textureLoad(uTone, vec2<i32>((_e302 + 1i), 0i), 0i);\n    let _e310 = p_8;\n    let _e311 = i_1;\n    return mix(_e300.x, _e308.x, (_e310 - f32(_e311)));\n}\n\nfn rgbTone(c_20: vec3<f32>) -> vec3<f32> {\n    var c_21: vec3<f32>;\n    var mx_2: f32;\n    var mn_2: f32;\n    var tmx: f32;\n    var tmn: f32;\n\n    c_21 = c_20;\n    let _e274 = c_21;\n    c_21 = clamp(_e274, vec3(0f), vec3(1f));\n    let _e280 = c_21;\n    let _e282 = c_21;\n    let _e284 = c_21;\n    mx_2 = max(_e280.x, max(_e282.y, _e284.z));\n    let _e289 = c_21;\n    let _e291 = c_21;\n    let _e293 = c_21;\n    mn_2 = min(_e289.x, min(_e291.y, _e293.z));\n    let _e298 = mx_2;\n    let _e299 = toneAt(_e298);\n    tmx = _e299;\n    let _e301 = mn_2;\n    let _e302 = toneAt(_e301);\n    tmn = _e302;\n    let _e304 = mx_2;\n    let _e305 = mn_2;\n    if ((_e304 - _e305) <= 0f) {\n        let _e309 = tmx;\n        return vec3(_e309);\n    }\n    let _e311 = tmn;\n    let _e312 = tmx;\n    let _e313 = tmn;\n    let _e315 = c_21;\n    let _e316 = mn_2;\n    let _e320 = mx_2;\n    let _e321 = mn_2;\n    return (vec3(_e311) + (((_e312 - _e313) * (_e315 - vec3(_e316))) / vec3((_e320 - _e321))));\n}\n\nfn easeWhite(x_24: vec3<f32>) -> vec3<f32> {\n    var x_25: vec3<f32>;\n    var k_7: f32 = 0.95f;\n\n    x_25 = x_24;\n    let _e276 = x_25;\n    let _e277 = k_7;\n    let _e279 = k_7;\n    let _e282 = x_25;\n    let _e283 = k_7;\n    let _e288 = k_7;\n    let _e298 = k_7;\n    let _e299 = x_25;\n    return mix(_e276, (vec3(_e277) + ((1f - _e279) * (vec3(1f) - exp((-((_e282 - vec3(_e283))) / vec3((1f - _e288))))))), step(vec3(_e298), _e299));\n}\n\nfn disp(y_2: f32) -> f32 {\n    var y_3: f32;\n    var local_10: f32;\n\n    y_3 = y_2;\n    let _e274 = y_3;\n    y_3 = max(_e274, 0f);\n    let _e277 = global.uDcp;\n    let _e280 = global.uToneMap;\n    if ((_e277 > 0.5f) && (_e280 < 0.5f)) {\n        let _e284 = y_3;\n        let _e285 = toneAt(_e284);\n        let _e286 = encS1_(_e285);\n        local_10 = _e286;\n    } else {\n        let _e287 = y_3;\n        let _e288 = shoulder1_(_e287);\n        let _e290 = encode(vec3(_e288));\n        local_10 = _e290.x;\n    }\n    let _e293 = local_10;\n    return _e293;\n}\n\nfn intoRange(lin_2: vec3<f32>) -> vec3<f32> {\n    var lin_3: vec3<f32>;\n    var y_4: f32;\n    var mn_3: f32;\n    var local_11: vec3<f32>;\n\n    lin_3 = lin_2;\n    let _e274 = lin_3;\n    y_4 = dot(_e274, W709_);\n    let _e277 = lin_3;\n    let _e279 = lin_3;\n    let _e281 = lin_3;\n    mn_3 = min(_e277.x, min(_e279.y, _e281.z));\n    let _e286 = mn_3;\n    if (_e286 < 0f) {\n        let _e289 = y_4;\n        if (_e289 > 0f) {\n            let _e292 = y_4;\n            let _e293 = lin_3;\n            let _e294 = y_4;\n            let _e297 = y_4;\n            let _e298 = y_4;\n            let _e299 = mn_3;\n            local_11 = (vec3(_e292) + ((_e293 - vec3(_e294)) * (_e297 / ((_e298 - _e299) + 0.000001f))));\n        } else {\n            local_11 = vec3(0f);\n        }\n        let _e310 = local_11;\n        lin_3 = _e310;\n    }\n    let _e311 = lin_3;\n    return max(_e311, vec3(0f));\n}\n\nfn hash(q_1: vec2<f32>) -> f32 {\n    var q_2: vec2<f32>;\n\n    q_2 = q_1;\n    let _e274 = q_2;\n    return fract((sin(dot(_e274, vec2<f32>(127.1f, 311.7f))) * 43758.547f));\n}\n\nfn vnoise(q_3: vec2<f32>) -> f32 {\n    var q_4: vec2<f32>;\n    var i_2: vec2<f32>;\n    var f_1: vec2<f32>;\n\n    q_4 = q_3;\n    let _e274 = q_4;\n    i_2 = floor(_e274);\n    let _e277 = q_4;\n    f_1 = fract(_e277);\n    let _e280 = f_1;\n    let _e281 = f_1;\n    let _e285 = f_1;\n    f_1 = ((_e280 * _e281) * (vec2(3f) - (2f * _e285)));\n    let _e290 = i_2;\n    let _e291 = hash(_e290);\n    let _e292 = i_2;\n    let _e297 = hash((_e292 + vec2<f32>(1f, 0f)));\n    let _e298 = f_1;\n    let _e301 = i_2;\n    let _e306 = hash((_e301 + vec2<f32>(0f, 1f)));\n    let _e307 = i_2;\n    let _e311 = hash((_e307 + vec2(1f)));\n    let _e312 = f_1;\n    let _e315 = f_1;\n    return mix(mix(_e291, _e297, _e298.x), mix(_e306, _e311, _e312.x), _e315.y);\n}\n\nfn main_1() {\n    var local_12: f32;\n    var cq: vec2<f32>;\n    var ori: vec2<f32>;\n    var n_1: vec2<f32>;\n    var hn: vec3<f32>;\n    var r2_: f32;\n    var p_9: vec2<f32>;\n    var lv: vec2<f32>;\n    var lr2_: f32;\n    var lin_4: vec3<f32>;\n    var lin0_: vec3<f32>;\n    var LA: vec4<f32> = vec4(0f);\n    var LB: vec4<f32> = vec4(0f);\n    var LC: vec4<f32> = vec4(0f);\n    var LD: vec4<f32> = vec4(0f);\n    var LE: vec4<f32> = vec4(0f);\n    var LF: vec4<f32> = vec4(0f);\n    var LG: f32 = 0f;\n    var mw: array<f32, 16>;\n    var i_3: i32 = 0i;\n    var shownW: f32 = 0f;\n    var muv: vec2<f32>;\n    var m0_: vec4<f32>;\n    var local_13: vec4<f32>;\n    var m1_1: vec4<f32>;\n    var local_14: vec4<f32>;\n    var m2_1: vec4<f32>;\n    var local_15: vec4<f32>;\n    var m3_: vec4<f32>;\n    var yl: f32;\n    var i_4: i32 = 0i;\n    var local_16: f32;\n    var local_17: f32;\n    var local_18: f32;\n    var w_1: f32;\n    var r_2: vec4<f32>;\n    var sm: f32;\n    var nrLum: f32;\n    var nrColor: f32;\n    var exposure: f32;\n    var highlights: f32;\n    var shadows: f32;\n    var whites: f32;\n    var blacks: f32;\n    var texAmt: f32;\n    var clarity: f32;\n    var dehaze: f32;\n    var sharpen: f32;\n    var y0_: f32;\n    var lsum: vec3<f32>;\n    var lw: f32 = 1f;\n    var csum: vec3<f32>;\n    var cw: f32 = 1f;\n    var sigma: f32;\n    var cr: f32;\n    var i_5: i32 = 0i;\n    var a_4: f32;\n    var dir: vec2<f32>;\n    var n1_: vec3<f32>;\n    var y1_1: f32;\n    var d_6: f32;\n    var w_2: f32;\n    var n2_: vec3<f32>;\n    var n3_: vec3<f32>;\n    var yl_1: f32;\n    var yb: f32;\n    var w_3: f32;\n    var w_4: f32;\n    var yb_1: f32;\n    var y0_1: f32;\n    var l0_: f32;\n    var g_1: vec2<f32>;\n    var dEdge: f32;\n    var base: f32;\n    var detail: f32;\n    var bd: f32;\n    var shLift: f32 = 0f;\n    var lw_1: f32;\n    var dl: f32;\n    var bw: f32;\n    var mid_1: f32;\n    var l1_: f32;\n    var th: f32;\n    var local_19: f32;\n    var hp: f32;\n    var limit: f32;\n    var edge: f32;\n    var local_20: f32;\n    var mask: f32;\n    var fine: f32;\n    var ys: f32;\n    var air: f32;\n    var haze: f32;\n    var t_6: f32;\n    var glowAmt: f32;\n    var gl: vec3<f32>;\n    var mapped: vec3<f32>;\n    var pp_3: vec3<f32>;\n    var local_21: vec3<f32>;\n    var local_22: vec3<f32>;\n    var local_23: vec3<f32>;\n    var d_7: vec3<f32>;\n    var yp: f32;\n    var y_5: f32;\n    var y2_1: f32;\n    var q_5: f32;\n    var dk: f32;\n    var local_24: f32;\n    var local_25: vec3<f32>;\n    var local_26: vec3<f32>;\n    var ck: f32;\n    var hi_1: f32;\n    var lo_1: f32;\n    var hi2_: f32;\n    var lo2_: f32;\n    var local_27: vec3<f32>;\n    var ck_1: f32;\n    var kl: f32;\n    var y_6: f32;\n    var y2_2: f32;\n    var local_28: vec3<f32>;\n    var dl_1: vec3<f32>;\n    var hi_2: f32;\n    var lo_2: f32;\n    var hi2_1: f32;\n    var lo2_1: f32;\n    var local_29: vec3<f32>;\n    var dh: vec3<f32>;\n    var cs: f32;\n    var yc: f32;\n    var mx_3: f32;\n    var local_30: f32;\n    var sv: f32;\n    var dc: vec3<f32>;\n    var hi_3: f32;\n    var lo_3: f32;\n    var hi2_2: f32;\n    var lo2_2: f32;\n    var local_31: vec3<f32>;\n    var yc0_: f32;\n    var yc_1: f32;\n    var i_6: i32 = 0i;\n    var row: f32;\n    var c_22: vec3<f32>;\n    var yc0_1: f32;\n    var yc_2: f32;\n    var h_7: vec3<f32>;\n    var chroma_1: f32;\n    var pp_4: vec3<f32>;\n    var q_6: vec3<f32>;\n    var adj: vec4<f32>;\n    var local_32: f32;\n    var local_33: f32;\n    var sv_1: f32;\n    var ps: f32;\n    var local_34: f32;\n    var local_35: f32;\n    var f_2: f32;\n    var o_2: vec3<f32>;\n    var yt: f32;\n    var pointShow: f32 = -1f;\n    var i_7: i32 = 0i;\n    var hp_1: vec3<f32>;\n    var dh_1: f32;\n    var dist_1: f32;\n    var width: f32;\n    var near: f32;\n    var k_8: f32;\n    var yp_1: f32;\n    var edge_1: f32;\n    var hd: vec3<f32>;\n    var purple: f32;\n    var green: f32;\n    var k_9: f32;\n    var yk: f32;\n    var yb_2: f32;\n    var o_3: vec3<f32>;\n    var c_23: f32;\n    var w_5: f32;\n    var sh_1: f32;\n    var hi_4: f32;\n    var mi: f32;\n    var wr: vec4<f32>;\n    var ab: vec2<f32>;\n    var dk_1: f32 = 0f;\n    var dirs: array<vec2<f32>, 4>;\n    var i_8: i32 = 0i;\n    var lum: f32;\n    var local_36: vec3<f32>;\n    var q_7: vec2<f32>;\n    var r_3: f32;\n    var local_37: vec2<f32>;\n    var qs: vec2<f32>;\n    var pw_1: f32;\n    var dist_2: f32;\n    var m0_1: f32;\n    var f_3: f32;\n    var mask_1: f32;\n    var amt: f32;\n    var local_38: vec3<f32>;\n    var d0_: vec3<f32>;\n    var local_39: vec3<f32>;\n    var grainAmt: f32;\n    var t_7: f32;\n    var size: f32;\n    var rough: f32;\n    var g_2: vec2<f32>;\n    var nz: f32;\n    var yg: f32;\n    var local_40: vec3<f32>;\n    var fw: f32;\n    var edge_2: f32;\n    var soft: f32;\n    var lines: f32;\n\n    let _e273 = gl_FragCoord_1;\n    let _e275 = global.frFlip;\n    if (_e275 > 0.5f) {\n        let _e278 = global.frH;\n        let _e279 = gl_FragCoord_1;\n        local_12 = (_e278 - _e279.y);\n    } else {\n        let _e282 = gl_FragCoord_1;\n        local_12 = _e282.y;\n    }\n    let _e285 = local_12;\n    let _e286 = gl_FragCoord_1;\n    let _e287 = _e286.zw;\n    frFC = vec4<f32>(_e273.x, _e285, _e287.x, _e287.y);\n    let _e291 = global.uOut2Crop;\n    let _e292 = frFC;\n    let _e293 = _e292.xy;\n    cq = (_e291 * vec3<f32>(_e293.x, _e293.y, 1f)).xy;\n    let _e301 = cq;\n    let _e306 = cq;\n    if ((abs(_e301.x) > 1.001f) || (abs(_e306.y) > 1.001f)) {\n        {\n            let _e312 = global.uBg;\n            o_4 = vec4<f32>(_e312.x, _e312.y, _e312.z, 1f);\n            return;\n        }\n    }\n    let _e318 = global.uOut2Ori;\n    let _e319 = frFC;\n    let _e320 = _e319.xy;\n    ori = (_e318 * vec3<f32>(_e320.x, _e320.y, 1f)).xy;\n    let _e328 = ori;\n    let _e329 = global.uOriCenter;\n    let _e331 = global.uOriHalf;\n    n_1 = ((_e328 - _e329) / vec2(_e331));\n    let _e335 = global.uPersp;\n    let _e336 = n_1;\n    hn = (_e335 * vec3<f32>(_e336.x, _e336.y, 1f));\n    let _e343 = hn;\n    let _e345 = hn;\n    n_1 = (_e343.xy / vec2(_e345.z));\n    let _e349 = n_1;\n    let _e350 = n_1;\n    let _e352 = global.uCornerR2_;\n    r2_ = (dot(_e349, _e350) / _e352);\n    let _e355 = n_1;\n    let _e357 = global.uDistort;\n    let _e358 = r2_;\n    n_1 = (_e355 * (1f - (_e357 * _e358)));\n    let _e362 = global.uOri2Photo;\n    let _e363 = n_1;\n    let _e364 = global.uOriHalf;\n    let _e366 = global.uOriCenter;\n    let _e367 = ((_e363 * _e364) + _e366);\n    p_9 = (_e362 * vec3<f32>(_e367.x, _e367.y, 1f)).xy;\n    let _e375 = p_9;\n    let _e376 = global.uLensC;\n    let _e378 = global.uLensN;\n    lv = ((_e375 - _e376) * _e378);\n    let _e381 = lv;\n    let _e382 = lv;\n    lr2_ = dot(_e381, _e382);\n    let _e385 = global.uLensC;\n    let _e386 = p_9;\n    let _e387 = global.uLensC;\n    let _e390 = lr2_;\n    let _e391 = global.uLensK;\n    let _e393 = lr2_;\n    let _e394 = global.uLensK;\n    let _e396 = lr2_;\n    let _e397 = global.uLensK;\n    let _e406 = global.uLensK;\n    p_9 = (_e385 + (((_e386 - _e387) * (1f + (_e390 * (_e391.x + (_e393 * (_e394.y + (_e396 * _e397.z))))))) * _e406.w));\n    let _e410 = hn;\n    let _e414 = p_9;\n    let _e419 = p_9;\n    let _e424 = p_9;\n    let _e429 = p_9;\n    if (((((_e410.z <= 0f) || (_e414.x < 0f)) || (_e419.y < 0f)) || (_e424.x > 1f)) || (_e429.y > 1f)) {\n        {\n            let _e434 = global.uBg;\n            o_4 = vec4<f32>(_e434.x, _e434.y, _e434.z, 1f);\n            return;\n        }\n    }\n    let _e440 = p_9;\n    let _e441 = cam_2(_e440);\n    let _e442 = toLinear(_e441);\n    lin_4 = _e442;\n    let _e444 = lin_4;\n    lin0_ = _e444;\n    loop {\n        let _e469 = i_3;\n        if !((_e469 < 16i)) {\n            break;\n        }\n        let _e476 = i_3;\n        mw[_e476] = 0f;\n        continuing {\n            let _e473 = i_3;\n            i_3 = (_e473 + 1i);\n        }\n    }\n    let _e481 = global.uMaskN;\n    if (_e481 > 0f) {\n        {\n            let _e484 = ori;\n            let _e485 = global.uOriSize;\n            muv = (_e484 / _e485);\n            let _e488 = muv;\n            let _e489 = textureSample(uMask0_, uMask0_s, _e488);\n            m0_ = _e489;\n            let _e491 = global.uMaskN;\n            if (_e491 > 4f) {\n                let _e494 = muv;\n                let _e495 = textureSample(uMask1_, uMask1_s, _e494);\n                local_13 = _e495;\n            } else {\n                local_13 = vec4(0f);\n            }\n            let _e499 = local_13;\n            m1_1 = _e499;\n            let _e501 = global.uMaskN;\n            if (_e501 > 8f) {\n                let _e504 = muv;\n                let _e505 = textureSample(uMask2_, uMask2_s, _e504);\n                local_14 = _e505;\n            } else {\n                local_14 = vec4(0f);\n            }\n            let _e509 = local_14;\n            m2_1 = _e509;\n            let _e511 = global.uMaskN;\n            if (_e511 > 12f) {\n                let _e514 = muv;\n                let _e515 = textureSample(uMask3_, uMask3_s, _e514);\n                local_15 = _e515;\n            } else {\n                local_15 = vec4(0f);\n            }\n            let _e519 = local_15;\n            m3_ = _e519;\n            let _e521 = lin0_;\n            let _e523 = global.uExposure;\n            let _e526 = disp((dot(_e521, W709_) * exp2(_e523)));\n            yl = _e526;\n            loop {\n                let _e530 = i_4;\n                if !((_e530 < 16i)) {\n                    break;\n                }\n                {\n                    let _e537 = i_4;\n                    let _e539 = global.uMaskN;\n                    if (f32(_e537) >= _e539) {\n                        break;\n                    }\n                    let _e541 = i_4;\n                    if (_e541 < 4i) {\n                        let _e544 = i_4;\n                        let _e546 = m0_[_e544];\n                        local_18 = _e546;\n                    } else {\n                        let _e547 = i_4;\n                        if (_e547 < 8i) {\n                            let _e550 = i_4;\n                            let _e554 = m1_1[(_e550 - 4i)];\n                            local_17 = _e554;\n                        } else {\n                            let _e555 = i_4;\n                            if (_e555 < 12i) {\n                                let _e558 = i_4;\n                                let _e562 = m2_1[(_e558 - 8i)];\n                                local_16 = _e562;\n                            } else {\n                                let _e563 = i_4;\n                                let _e567 = m3_[(_e563 - 12i)];\n                                local_16 = _e567;\n                            }\n                            let _e569 = local_16;\n                            local_17 = _e569;\n                        }\n                        let _e571 = local_17;\n                        local_18 = _e571;\n                    }\n                    let _e573 = local_18;\n                    w_1 = _e573;\n                    let _e575 = i_4;\n                    let _e577 = global.uMR[_e575];\n                    r_2 = _e577;\n                    let _e579 = r_2;\n                    if ((_e579.w - (floor((_e579.w / 2f)) * 2f)) >= 1f) {\n                        {\n                            let _e588 = r_2;\n                            sm = max((_e588.z * 0.5f), 0.004f);\n                            let _e595 = w_1;\n                            let _e596 = r_2;\n                            let _e598 = sm;\n                            let _e600 = r_2;\n                            let _e602 = yl;\n                            let _e605 = r_2;\n                            let _e607 = r_2;\n                            let _e609 = sm;\n                            let _e611 = yl;\n                            w_1 = (_e595 * (smoothstep((_e596.x - _e598), _e600.x, _e602) * (1f - smoothstep(_e605.y, (_e607.y + _e609), _e611))));\n                        }\n                    }\n                    let _e616 = r_2;\n                    if (_e616.w >= 2f) {\n                        let _e621 = w_1;\n                        w_1 = (1f - _e621);\n                    }\n                    let _e623 = i_4;\n                    let _e625 = global.uMaskView;\n                    if (f32(_e623) == _e625) {\n                        let _e627 = w_1;\n                        shownW = _e627;\n                    }\n                    let _e628 = w_1;\n                    let _e629 = i_4;\n                    let _e631 = global.uMD[_e629];\n                    w_1 = (_e628 * _e631.w);\n                    let _e634 = i_4;\n                    let _e636 = w_1;\n                    mw[_e634] = _e636;\n                    let _e637 = LG;\n                    let _e638 = i_4;\n                    let _e640 = global.uMS[_e638];\n                    let _e642 = w_1;\n                    LG = (_e637 + (_e640.w * _e642));\n                    let _e645 = LA;\n                    let _e646 = i_4;\n                    let _e648 = global.uMA[_e646];\n                    let _e649 = w_1;\n                    LA = (_e645 + (_e648 * _e649));\n                    let _e652 = LB;\n                    let _e653 = i_4;\n                    let _e655 = global.uMB[_e653];\n                    let _e656 = w_1;\n                    LB = (_e652 + (_e655 * _e656));\n                    let _e659 = LC;\n                    let _e660 = i_4;\n                    let _e662 = global.uMC[_e660];\n                    let _e663 = w_1;\n                    LC = (_e659 + (_e662 * _e663));\n                    let _e666 = LD;\n                    let _e667 = i_4;\n                    let _e669 = global.uMD[_e667];\n                    let _e670 = w_1;\n                    LD = (_e666 + (_e669 * _e670));\n                    let _e673 = LE;\n                    let _e674 = i_4;\n                    let _e676 = global.uME[_e674];\n                    let _e677 = w_1;\n                    LE = (_e673 + (_e676 * _e677));\n                    let _e680 = LF;\n                    let _e681 = i_4;\n                    let _e683 = global.uMF[_e681];\n                    let _e684 = w_1;\n                    LF = (_e680 + (_e683 * _e684));\n                }\n                continuing {\n                    let _e534 = i_4;\n                    i_4 = (_e534 + 1i);\n                }\n            }\n        }\n    }\n    let _e687 = global.uNrLum;\n    let _e688 = LD;\n    nrLum = clamp((_e687 + _e688.z), 0f, 1f);\n    let _e695 = global.uNrColor;\n    let _e696 = LE;\n    nrColor = clamp((_e695 + _e696.w), 0f, 1f);\n    let _e703 = global.uExposure;\n    let _e704 = LA;\n    exposure = (_e703 + _e704.x);\n    let _e708 = global.uHighlights;\n    let _e709 = LA;\n    highlights = (_e708 + _e709.z);\n    let _e713 = global.uShadows;\n    let _e714 = LA;\n    shadows = (_e713 + _e714.w);\n    let _e718 = global.uWhites;\n    let _e719 = LB;\n    whites = (_e718 + _e719.x);\n    let _e723 = global.uBlacks;\n    let _e724 = LB;\n    blacks = (_e723 + _e724.y);\n    let _e728 = global.uTexture;\n    let _e729 = LB;\n    texAmt = (_e728 + _e729.z);\n    let _e733 = global.uClarity;\n    let _e734 = LB;\n    clarity = (_e733 + _e734.w);\n    let _e738 = global.uDehaze;\n    let _e739 = LC;\n    dehaze = clamp((_e738 + _e739.x), -1f, 1f);\n    let _e747 = global.uSharpen;\n    let _e748 = LD;\n    sharpen = (_e747 + (_e748.y * 1.1f));\n    let _e754 = nrLum;\n    let _e757 = nrColor;\n    if ((_e754 > 0f) || (_e757 > 0f)) {\n        {\n            let _e761 = lin_4;\n            y0_ = max(dot(_e761, W709_), 0.00001f);\n            let _e766 = lin_4;\n            lsum = _e766;\n            let _e770 = lin_4;\n            let _e771 = chroma(_e770);\n            csum = _e771;\n            let _e776 = nrLum;\n            let _e781 = global.uNrLumDetail;\n            sigma = ((0.02f + (_e776 * 0.25f)) * (1.5f - _e781));\n            let _e787 = global.uNrColorDetail;\n            cr = (4f * (1.5f - _e787));\n            loop {\n                let _e793 = i_5;\n                if !((_e793 < 8i)) {\n                    break;\n                }\n                {\n                    let _e800 = i_5;\n                    a_4 = (f32(_e800) * 0.785398f);\n                    let _e805 = a_4;\n                    let _e807 = a_4;\n                    dir = vec2<f32>(cos(_e805), sin(_e807));\n                    let _e811 = p_9;\n                    let _e812 = dir;\n                    let _e813 = global.uPhotoPx;\n                    let _e818 = cam_2((_e811 + ((_e812 * _e813) * 1.5f)));\n                    let _e819 = toLinear(_e818);\n                    n1_ = _e819;\n                    let _e821 = n1_;\n                    y1_1 = max(dot(_e821, W709_), 0.00001f);\n                    let _e826 = y1_1;\n                    let _e828 = y0_;\n                    d_6 = (log2(_e826) - log2(_e828));\n                    let _e832 = d_6;\n                    let _e834 = d_6;\n                    let _e837 = sigma;\n                    let _e839 = sigma;\n                    let _e843 = nrLum;\n                    w_2 = (exp(((-(_e832) * _e834) / ((2f * _e837) * _e839))) * _e843);\n                    let _e846 = lsum;\n                    let _e847 = n1_;\n                    let _e848 = w_2;\n                    lsum = (_e846 + (_e847 * _e848));\n                    let _e851 = lw;\n                    let _e852 = w_2;\n                    lw = (_e851 + _e852);\n                    let _e854 = nrColor;\n                    if (_e854 > 0f) {\n                        {\n                            let _e857 = p_9;\n                            let _e858 = dir;\n                            let _e859 = global.uPhotoPx;\n                            let _e861 = cr;\n                            let _e864 = cam_2((_e857 + ((_e858 * _e859) * _e861)));\n                            let _e865 = toLinear(_e864);\n                            n2_ = _e865;\n                            let _e867 = csum;\n                            let _e868 = n2_;\n                            let _e869 = chroma(_e868);\n                            let _e870 = nrColor;\n                            csum = (_e867 + (_e869 * _e870));\n                            let _e873 = cw;\n                            let _e874 = nrColor;\n                            cw = (_e873 + _e874);\n                            let _e876 = global.uNrColorSmooth;\n                            if (_e876 > 0f) {\n                                {\n                                    let _e879 = p_9;\n                                    let _e880 = dir;\n                                    let _e881 = global.uPhotoPx;\n                                    let _e883 = cr;\n                                    let _e888 = cam_2((_e879 + (((_e880 * _e881) * _e883) * 2.5f)));\n                                    let _e889 = toLinear(_e888);\n                                    n3_ = _e889;\n                                    let _e891 = csum;\n                                    let _e892 = n3_;\n                                    let _e893 = chroma(_e892);\n                                    let _e894 = nrColor;\n                                    let _e896 = global.uNrColorSmooth;\n                                    csum = (_e891 + ((_e893 * _e894) * _e896));\n                                    let _e899 = cw;\n                                    let _e900 = nrColor;\n                                    let _e901 = global.uNrColorSmooth;\n                                    cw = (_e899 + (_e900 * _e901));\n                                }\n                            }\n                        }\n                    }\n                }\n                continuing {\n                    let _e797 = i_5;\n                    i_5 = (_e797 + 1i);\n                }\n            }\n            let _e904 = lsum;\n            let _e905 = lw;\n            lin_4 = (_e904 / vec3(_e905));\n            let _e908 = global.uNrLumContrast;\n            if (_e908 > 0f) {\n                let _e911 = lin_4;\n                let _e912 = y0_;\n                let _e914 = lin_4;\n                let _e920 = global.uNrLumContrast;\n                lin_4 = (_e911 * exp2((((log2(_e912) - log2(max(dot(_e914, W709_), 0.00001f))) * _e920) * 0.6f)));\n            }\n            let _e926 = nrColor;\n            if (_e926 > 0f) {\n                {\n                    let _e929 = lin_4;\n                    yl_1 = dot(_e929, W709_);\n                    let _e932 = yl_1;\n                    let _e933 = csum;\n                    let _e934 = cw;\n                    let _e937 = yl_1;\n                    lin_4 = (vec3(_e932) + ((_e933 / vec3(_e934)) * max(_e937, CHROMA_FLOOR)));\n                }\n            }\n        }\n    }\n    let _e942 = global.uDcp;\n    let _e945 = global.uHsmDims;\n    if ((_e942 > 0.5f) && (_e945.x > 0f)) {\n        let _e950 = global.uP2S;\n        let _e951 = global.uHsmDims;\n        let _e952 = global.uS2P;\n        let _e953 = lin_4;\n        let _e958 = hueSatMap(uHsm, _e951, max((_e952 * _e953), vec3(0f)));\n        lin_4 = (_e950 * _e958);\n    }\n    let _e960 = global.uBaseSat;\n    if (_e960 != 1f) {\n        {\n            let _e963 = lin_4;\n            yb = dot(_e963, W709_);\n            let _e966 = yb;\n            let _e967 = lin_4;\n            let _e968 = yb;\n            let _e971 = global.uBaseSat;\n            lin_4 = (vec3(_e966) + ((_e967 - vec3(_e968)) * _e971));\n        }\n    }\n    let _e975 = global.uLensVig;\n    if (_e975 != 0f) {\n        {\n            let _e978 = global.uLensVigMid;\n            let _e982 = r2_;\n            w_3 = smoothstep((_e978 * 0.6f), 1f, sqrt(_e982));\n            let _e986 = lin_4;\n            let _e987 = global.uLensVig;\n            let _e990 = w_3;\n            let _e992 = w_3;\n            lin_4 = (_e986 * exp2((((_e987 * 1.6f) * _e990) * _e992)));\n        }\n    }\n    let _e996 = global.uShadowTint;\n    if (_e996 != 0f) {\n        {\n            let _e1002 = lin_4;\n            w_4 = (1f - smoothstep(0f, 0.2f, dot(_e1002, W709_)));\n            let _e1008 = lin_4;\n            let _e1011 = global.uShadowTint;\n            let _e1014 = w_4;\n            lin_4.y = (_e1008.y * (1f - ((_e1011 * 0.18f) * _e1014)));\n        }\n    }\n    let _e1018 = LC;\n    let _e1022 = LC;\n    if ((_e1018.z != 0f) || (_e1022.w != 0f)) {\n        {\n            let _e1027 = lin_4;\n            yb_1 = dot(_e1027, W709_);\n            let _e1030 = lin_4;\n            let _e1031 = LC;\n            let _e1035 = LC;\n            let _e1040 = LC;\n            lin_4 = (_e1030 * exp2(vec3<f32>((_e1031.z * 0.45f), (-(_e1035.w) * 0.35f), (-(_e1040.z) * 0.45f))));\n            let _e1048 = lin_4;\n            let _e1049 = yb_1;\n            let _e1051 = lin_4;\n            lin_4 = (_e1048 * (max(_e1049, CHROMA_FLOOR) / max(dot(_e1051, W709_), CHROMA_FLOOR)));\n        }\n    }\n    let _e1056 = lin_4;\n    y0_1 = max(dot(_e1056, W709_), 0.00001f);\n    let _e1061 = y0_1;\n    l0_ = log2(_e1061);\n    let _e1064 = p_9;\n    let _e1065 = textureSample(uGuide, uGuide_s, _e1064);\n    g_1 = _e1065.xy;\n    let _e1068 = l0_;\n    let _e1069 = g_1;\n    dEdge = (_e1068 - _e1069.x);\n    let _e1073 = g_1;\n    let _e1075 = dEdge;\n    let _e1077 = dEdge;\n    let _e1079 = dEdge;\n    base = (_e1073.x + (_e1075 * (1f - exp(((-(_e1077) * _e1079) / 0.1f)))));\n    let _e1088 = l0_;\n    let _e1089 = base;\n    detail = (_e1088 - _e1089);\n    let _e1092 = base;\n    let _e1093 = exposure;\n    base = (_e1092 + _e1093);\n    let _e1095 = base;\n    let _e1097 = disp(exp2(_e1095));\n    bd = _e1097;\n    let _e1101 = highlights;\n    let _e1104 = shadows;\n    if ((_e1101 != 0f) || (_e1104 != 0f)) {\n        {\n            let _e1109 = p_9;\n            let _e1110 = ring(_e1109, LIFT_R);\n            let _e1111 = p_9;\n            let _e1115 = ring(_e1111, 8f);\n            lw_1 = (0.5f * (_e1110 + _e1115));\n            let _e1119 = l0_;\n            let _e1120 = lw_1;\n            dl = (_e1119 - _e1120);\n            let _e1123 = lw_1;\n            let _e1124 = dl;\n            let _e1126 = dl;\n            let _e1128 = dl;\n            lw_1 = (_e1123 + (_e1124 * (1f - exp(((-(_e1126) * _e1128) / LIFT_EDGE)))));\n            let _e1135 = lw_1;\n            let _e1136 = exposure;\n            let _e1139 = disp(exp2((_e1135 + _e1136)));\n            bw = _e1139;\n            let _e1141 = base;\n            let _e1142 = highlights;\n            let _e1145 = bw;\n            let _e1149 = global.uHlTop;\n            let _e1150 = bd;\n            let _e1156 = global.uContrastSat;\n            let _e1157 = LA;\n            base = (_e1141 + ((((_e1142 * HL_K) * smoothstep(HL_LO, 1f, _e1145)) * (1f - (_e1149 * smoothstep(HL_T0_, HL_T1_, _e1150)))) * (1f - (HL_X * max(-((_e1156 + _e1157.y)), 0f)))));\n            let _e1167 = shadows;\n            let _e1170 = bw;\n            let _e1177 = bw;\n            let _e1184 = blacks;\n            shLift = ((_e1167 * ((SH_K * (1f - smoothstep(0f, SH_HI, _e1170))) + (SH_DEEP * (1f - smoothstep(0f, 0.2f, _e1177))))) * (1f - (SH_X * max(_e1184, 0f))));\n            let _e1190 = base;\n            let _e1191 = shLift;\n            base = (_e1190 + _e1191);\n        }\n    }\n    let _e1195 = bd;\n    let _e1200 = bd;\n    mid_1 = (smoothstep(0.03f, 0.35f, _e1195) * (1f - smoothstep(0.8f, 1f, _e1200)));\n    let _e1205 = detail;\n    let _e1208 = clarity;\n    let _e1211 = mid_1;\n    detail = (_e1205 * max(0f, (1f + ((_e1208 * 0.9f) * _e1211))));\n    let _e1216 = base;\n    let _e1217 = detail;\n    l1_ = (_e1216 + _e1217);\n    let _e1220 = texAmt;\n    if (_e1220 != 0f) {\n        {\n            let _e1223 = l0_;\n            let _e1224 = p_9;\n            let _e1226 = ring(_e1224, 3f);\n            th = (_e1223 - _e1226);\n            let _e1229 = l1_;\n            let _e1230 = texAmt;\n            let _e1233 = th;\n            let _e1237 = mid_1;\n            let _e1241 = texAmt;\n            if (_e1241 < 0f) {\n                let _e1247 = th;\n                local_19 = (1f - smoothstep(0.08f, 0.25f, abs(_e1247)));\n            } else {\n                local_19 = 1f;\n            }\n            let _e1253 = local_19;\n            l1_ = (_e1229 + ((((_e1230 * 0.9f) * _e1233) * (0.4f + (0.6f * _e1237))) * _e1253));\n        }\n    }\n    let _e1256 = sharpen;\n    if (_e1256 > 0f) {\n        {\n            let _e1259 = l0_;\n            let _e1260 = p_9;\n            let _e1261 = global.uSharpenRadius;\n            let _e1262 = ring(_e1260, _e1261);\n            hp = (_e1259 - _e1262);\n            let _e1266 = global.uSharpenDetail;\n            limit = (0.06f + (_e1266 * 0.6f));\n            let _e1271 = l0_;\n            let _e1272 = p_9;\n            let _e1273 = global.uSharpenRadius;\n            let _e1276 = ring(_e1272, (_e1273 * 2f));\n            edge = abs((_e1271 - _e1276));\n            let _e1280 = global.uSharpenMasking;\n            if (_e1280 > 0f) {\n                let _e1283 = global.uSharpenMasking;\n                let _e1286 = global.uSharpenMasking;\n                let _e1291 = edge;\n                local_20 = smoothstep((_e1283 * 0.25f), ((_e1286 * 0.25f) + 0.08f), _e1291);\n            } else {\n                local_20 = 1f;\n            }\n            let _e1295 = local_20;\n            mask = _e1295;\n            let _e1297 = l1_;\n            let _e1298 = sharpen;\n            let _e1299 = hp;\n            let _e1300 = limit;\n            let _e1302 = limit;\n            let _e1305 = mask;\n            l1_ = (_e1297 + ((_e1298 * clamp(_e1299, -(_e1300), _e1302)) * _e1305));\n        }\n    } else {\n        let _e1308 = sharpen;\n        if (_e1308 < 0f) {\n            let _e1311 = l1_;\n            let _e1312 = sharpen;\n            let _e1316 = l0_;\n            let _e1317 = p_9;\n            let _e1319 = ring(_e1317, 1.5f);\n            l1_ = (_e1311 + (max(_e1312, -1f) * (_e1316 - _e1319)));\n        }\n    }\n    let _e1323 = l1_;\n    let _e1324 = base;\n    fine = (_e1323 - _e1324);\n    let _e1327 = lin_4;\n    let _e1328 = l1_;\n    let _e1329 = l0_;\n    lin_4 = (_e1327 * exp2((_e1328 - _e1329)));\n    let _e1333 = shLift;\n    if (_e1333 > 0f) {\n        {\n            let _e1336 = lin_4;\n            ys = dot(_e1336, W709_);\n            let _e1339 = ys;\n            let _e1340 = lin_4;\n            let _e1341 = ys;\n            let _e1346 = shLift;\n            lin_4 = (vec3(_e1339) + ((_e1340 - vec3(_e1341)) * exp2((-0.3f * _e1346))));\n        }\n    }\n    let _e1352 = dehaze;\n    if (_e1352 != 0f) {\n        {\n            let _e1355 = global.uAirY;\n            let _e1356 = exposure;\n            air = (_e1355 * exp2(_e1356));\n            let _e1360 = g_1;\n            let _e1362 = exposure;\n            let _e1365 = air;\n            haze = clamp(((_e1360.y * exp2(_e1362)) / max(_e1365, 0.0001f)), 0f, 1f);\n            let _e1373 = dehaze;\n            if (_e1373 > 0f) {\n                {\n                    let _e1378 = dehaze;\n                    let _e1380 = haze;\n                    t_6 = max((1f - ((0.95f * _e1378) * _e1380)), 0.2f);\n                    let _e1386 = lin_4;\n                    let _e1387 = air;\n                    let _e1389 = t_6;\n                    let _e1394 = t_6;\n                    lin_4 = ((_e1386 - vec3((_e1387 * (1f - _e1389)))) / vec3(_e1394));\n                }\n            } else {\n                {\n                    let _e1397 = lin_4;\n                    let _e1398 = air;\n                    let _e1402 = dehaze;\n                    let _e1408 = haze;\n                    lin_4 = mix(_e1397, vec3((_e1398 * 0.85f)), vec3(((-(_e1402) * 0.45f) * (0.4f + (0.6f * _e1408)))));\n                }\n            }\n        }\n    }\n    let _e1414 = global.uGlowMix;\n    let _e1416 = LG;\n    glowAmt = clamp((_e1414.x + _e1416), 0f, 1f);\n    let _e1422 = global.uGlowMix;\n    let _e1426 = glowAmt;\n    if ((_e1422.w > 0.5f) && (_e1426 > 0f)) {\n        {\n            let _e1430 = p_9;\n            let _e1431 = textureSample(uGlow, uGlow_s, _e1430);\n            gl = _e1431.xyz;\n            let _e1434 = lin_4;\n            let _e1435 = gl;\n            let _e1436 = glowAmt;\n            let _e1437 = global.uGlowMix;\n            let _e1442 = gl;\n            let _e1443 = glowAmt;\n            let _e1444 = global.uGlowMix;\n            lin_4 = (mix(_e1434, _e1435, vec3((_e1436 * _e1437.y))) + (_e1442 * (_e1443 * _e1444.z)));\n        }\n    }\n    let _e1450 = global.uDcp;\n    let _e1453 = global.uToneMap;\n    if ((_e1450 > 0.5f) && (_e1453 < 0.5f)) {\n        {\n            let _e1457 = global.uS2P;\n            let _e1458 = lin_4;\n            pp_3 = max((_e1457 * _e1458), vec3(0f));\n            let _e1464 = global.uLookADims;\n            if (_e1464.x > 0f) {\n                let _e1468 = global.uLookADims;\n                let _e1469 = pp_3;\n                let _e1470 = hueSatMap(uLookA, _e1468, _e1469);\n                pp_3 = _e1470;\n            }\n            let _e1471 = global.uLookBDims;\n            if (_e1471.x > 0f) {\n                let _e1475 = global.uLookBDims;\n                let _e1476 = pp_3;\n                let _e1477 = hueSatMap(uLookB, _e1475, _e1476);\n                pp_3 = _e1477;\n            }\n            let _e1478 = global.uP2S;\n            let _e1479 = pp_3;\n            let _e1480 = easeWhite(_e1479);\n            let _e1481 = rgbTone(_e1480);\n            let _e1483 = intoRange((_e1478 * _e1481));\n            mapped = _e1483;\n        }\n    } else {\n        {\n            let _e1484 = lin_4;\n            let _e1485 = intoRange(_e1484);\n            lin_4 = _e1485;\n            let _e1486 = global.uToneMap;\n            if (_e1486 < 0.5f) {\n                let _e1489 = lin_4;\n                let _e1490 = shoulder(_e1489);\n                local_23 = _e1490;\n            } else {\n                let _e1491 = global.uToneMap;\n                if (_e1491 < 1.5f) {\n                    let _e1494 = lin_4;\n                    let _e1495 = sigmoidMap(_e1494);\n                    local_22 = _e1495;\n                } else {\n                    let _e1496 = global.uToneMap;\n                    if (_e1496 < 2.5f) {\n                        let _e1499 = lin_4;\n                        let _e1500 = agxMap(_e1499);\n                        local_21 = _e1500;\n                    } else {\n                        let _e1501 = lin_4;\n                        let _e1502 = filmicMap(_e1501);\n                        local_21 = _e1502;\n                    }\n                    let _e1504 = local_21;\n                    local_22 = _e1504;\n                }\n                let _e1506 = local_22;\n                local_23 = _e1506;\n            }\n            let _e1508 = local_23;\n            mapped = _e1508;\n        }\n    }\n    let _e1509 = mapped;\n    let _e1510 = encode(_e1509);\n    d_7 = _e1510;\n    let _e1512 = whites;\n    let _e1515 = blacks;\n    if ((_e1512 != 0f) || (_e1515 != 0f)) {\n        {\n            let _e1519 = d_7;\n            yp = clamp(dot(_e1519, W709_), 0f, 1f);\n            let _e1525 = yp;\n            let _e1526 = fine;\n            y_5 = clamp((_e1525 * exp2((-(_e1526) * WB_LOCAL))), 0f, 1f);\n            let _e1535 = y_5;\n            y2_1 = _e1535;\n            let _e1537 = whites;\n            if (_e1537 < 0f) {\n                {\n                    let _e1540 = y2_1;\n                    q_5 = (_e1540 / 0.9f);\n                    let _e1544 = q_5;\n                    let _e1545 = q_5;\n                    let _e1546 = q_5;\n                    q_5 = (_e1544 * (_e1545 * _e1546));\n                    let _e1549 = y2_1;\n                    let _e1550 = whites;\n                    let _e1552 = y2_1;\n                    let _e1554 = y2_1;\n                    let _e1556 = y2_1;\n                    let _e1559 = q_5;\n                    let _e1560 = q_5;\n                    y2_1 = (_e1549 + (((((_e1550 * WH_NEG) * _e1552) * _e1554) * _e1556) / (1f + (_e1559 * _e1560))));\n                }\n            } else {\n                let _e1565 = whites;\n                if (_e1565 > 0f) {\n                    let _e1568 = y2_1;\n                    let _e1570 = whites;\n                    let _e1572 = y2_1;\n                    y2_1 = (_e1568 * (1f + ((_e1570 * WH_POS) * _e1572)));\n                }\n            }\n            let _e1576 = y2_1;\n            let _e1578 = y2_1;\n            dk = (_e1576 * pow((1f - min(_e1578, 1f)), BL_N));\n            let _e1585 = y2_1;\n            let _e1586 = blacks;\n            if (_e1586 < 0f) {\n                let _e1589 = blacks;\n                let _e1591 = dk;\n                local_24 = ((_e1589 * BL_NEG) * _e1591);\n            } else {\n                let _e1593 = blacks;\n                let _e1594 = dk;\n                let _e1597 = y2_1;\n                local_24 = (_e1593 * ((BL_POS * _e1594) + (BL_LIFT * (1f - _e1597))));\n            }\n            let _e1603 = local_24;\n            y2_1 = (_e1585 + _e1603);\n            let _e1605 = y2_1;\n            y2_1 = max(_e1605, 0f);\n            let _e1608 = y_5;\n            if (_e1608 > 0.0001f) {\n                let _e1611 = y2_1;\n                let _e1612 = y_5;\n                if (_e1611 > _e1612) {\n                    let _e1614 = d_7;\n                    let _e1615 = y2_1;\n                    let _e1616 = y_5;\n                    let _e1619 = d_7;\n                    let _e1620 = y2_1;\n                    let _e1621 = y_5;\n                    let _e1623 = yp;\n                    let _e1625 = y_5;\n                    local_25 = mix((_e1614 * (_e1615 / _e1616)), (_e1619 + vec3((((_e1620 - _e1621) * _e1623) / _e1625))), vec3(0.9f));\n                } else {\n                    let _e1632 = d_7;\n                    let _e1633 = y2_1;\n                    let _e1634 = y_5;\n                    local_25 = (_e1632 * (_e1633 / _e1634));\n                }\n                let _e1638 = local_25;\n                local_26 = _e1638;\n            } else {\n                let _e1639 = y2_1;\n                local_26 = vec3(_e1639);\n            }\n            let _e1642 = local_26;\n            d_7 = _e1642;\n        }\n    }\n    let _e1643 = d_7;\n    d_7 = clamp(_e1643, vec3(0f), vec3(1f));\n    {\n        let _e1649 = global.uContrast;\n        ck = _e1649;\n        let _e1651 = d_7;\n        let _e1653 = d_7;\n        let _e1655 = d_7;\n        hi_1 = max(_e1651.x, max(_e1653.y, _e1655.z));\n        let _e1660 = d_7;\n        let _e1662 = d_7;\n        let _e1664 = d_7;\n        lo_1 = min(_e1660.x, min(_e1662.y, _e1664.z));\n        let _e1669 = hi_1;\n        let _e1670 = ck;\n        let _e1671 = hi_1;\n        let _e1672 = hi_1;\n        let _e1676 = hi_1;\n        let _e1680 = hi_1;\n        hi2_ = (_e1669 + (_e1670 * (((_e1671 * _e1672) * (3f - (2f * _e1676))) - _e1680)));\n        let _e1685 = lo_1;\n        let _e1686 = ck;\n        let _e1687 = lo_1;\n        let _e1688 = lo_1;\n        let _e1692 = lo_1;\n        let _e1696 = lo_1;\n        lo2_ = (_e1685 + (_e1686 * (((_e1687 * _e1688) * (3f - (2f * _e1692))) - _e1696)));\n        let _e1701 = hi_1;\n        let _e1702 = lo_1;\n        if ((_e1701 - _e1702) > 0.00001f) {\n            let _e1706 = lo2_;\n            let _e1707 = d_7;\n            let _e1708 = lo_1;\n            let _e1711 = hi2_;\n            let _e1712 = lo2_;\n            let _e1714 = hi_1;\n            let _e1715 = lo_1;\n            local_27 = (vec3(_e1706) + ((_e1707 - vec3(_e1708)) * ((_e1711 - _e1712) / (_e1714 - _e1715))));\n        } else {\n            let _e1721 = hi2_;\n            local_27 = vec3(_e1721);\n        }\n        let _e1724 = local_27;\n        d_7 = _e1724;\n    }\n    {\n        let _e1725 = global.uContrastSat;\n        let _e1726 = LA;\n        ck_1 = (CON_K * (_e1725 + _e1726.y));\n        let _e1731 = ck_1;\n        if (_e1731 != 0f) {\n            {\n                let _e1734 = fine;\n                kl = exp2((-(_e1734) * CON_LOCAL));\n                let _e1739 = d_7;\n                let _e1741 = kl;\n                y_6 = clamp((dot(_e1739, W709_) * _e1741), 0f, 1f);\n                let _e1747 = y_6;\n                let _e1748 = ck_1;\n                let _e1749 = conCurve(_e1747, _e1748);\n                y2_2 = _e1749;\n                let _e1751 = y_6;\n                if (_e1751 > 0.0001f) {\n                    let _e1754 = d_7;\n                    let _e1755 = y2_2;\n                    let _e1756 = y_6;\n                    local_28 = (_e1754 * (_e1755 / _e1756));\n                } else {\n                    let _e1759 = y2_2;\n                    local_28 = vec3(_e1759);\n                }\n                let _e1762 = local_28;\n                dl_1 = _e1762;\n                let _e1764 = d_7;\n                let _e1766 = d_7;\n                let _e1768 = d_7;\n                hi_2 = max(_e1764.x, max(_e1766.y, _e1768.z));\n                let _e1773 = d_7;\n                let _e1775 = d_7;\n                let _e1777 = d_7;\n                lo_2 = min(_e1773.x, min(_e1775.y, _e1777.z));\n                let _e1782 = hi_2;\n                let _e1783 = kl;\n                let _e1788 = ck_1;\n                let _e1789 = conCurve(clamp((_e1782 * _e1783), 0f, 1f), _e1788);\n                let _e1790 = kl;\n                hi2_1 = (_e1789 / _e1790);\n                let _e1793 = lo_2;\n                let _e1794 = kl;\n                let _e1799 = ck_1;\n                let _e1800 = conCurve(clamp((_e1793 * _e1794), 0f, 1f), _e1799);\n                let _e1801 = kl;\n                lo2_1 = (_e1800 / _e1801);\n                let _e1804 = hi_2;\n                let _e1805 = lo_2;\n                if ((_e1804 - _e1805) > 0.00001f) {\n                    let _e1809 = lo2_1;\n                    let _e1810 = d_7;\n                    let _e1811 = lo_2;\n                    let _e1814 = hi2_1;\n                    let _e1815 = lo2_1;\n                    let _e1817 = hi_2;\n                    let _e1818 = lo_2;\n                    local_29 = (vec3(_e1809) + ((_e1810 - vec3(_e1811)) * ((_e1814 - _e1815) / (_e1817 - _e1818))));\n                } else {\n                    let _e1824 = hi2_1;\n                    local_29 = vec3(_e1824);\n                }\n                let _e1827 = local_29;\n                dh = _e1827;\n                let _e1829 = dh;\n                let _e1830 = dl_1;\n                d_7 = mix(_e1829, _e1830, vec3(0.6f));\n            }\n        }\n    }\n    let _e1834 = global.uContrastSat;\n    let _e1835 = LA;\n    cs = (_e1834 + _e1835.y);\n    let _e1839 = cs;\n    if (_e1839 != 0f) {\n        {\n            let _e1842 = d_7;\n            yc = dot(_e1842, W709_);\n            let _e1845 = d_7;\n            let _e1847 = d_7;\n            let _e1849 = d_7;\n            mx_3 = max(_e1845.x, max(_e1847.y, _e1849.z));\n            let _e1854 = mx_3;\n            if (_e1854 > 0f) {\n                let _e1857 = mx_3;\n                let _e1858 = d_7;\n                let _e1860 = d_7;\n                let _e1862 = d_7;\n                let _e1867 = mx_3;\n                local_30 = ((_e1857 - min(_e1858.x, min(_e1860.y, _e1862.z))) / _e1867);\n            } else {\n                local_30 = 0f;\n            }\n            let _e1871 = local_30;\n            sv = _e1871;\n            let _e1873 = yc;\n            let _e1874 = d_7;\n            let _e1875 = yc;\n            let _e1879 = cs;\n            let _e1881 = sv;\n            let _e1885 = sv;\n            d_7 = (vec3(_e1873) + ((_e1874 - vec3(_e1875)) * max((1f + (_e1879 * (CS_K + ((CS_V * (1f - _e1881)) * (1f - _e1885))))), 0f)));\n        }\n    }\n    let _e1896 = d_7;\n    let _e1897 = decodeS(_e1896);\n    let _e1904 = encode(clamp((SRGB_TO_PP * _e1897), vec3(0f), vec3(1f)));\n    d_7 = _e1904;\n    {\n        let _e1906 = d_7;\n        let _e1908 = d_7;\n        let _e1910 = d_7;\n        hi_3 = max(_e1906.x, max(_e1908.y, _e1910.z));\n        let _e1915 = d_7;\n        let _e1917 = d_7;\n        let _e1919 = d_7;\n        lo_3 = min(_e1915.x, min(_e1917.y, _e1919.z));\n        let _e1924 = hi_3;\n        let _e1927 = textureSample(uCurve, uCurve_s, vec2<f32>(_e1924, 0.5f));\n        hi2_2 = _e1927.x;\n        let _e1930 = lo_3;\n        let _e1933 = textureSample(uCurve, uCurve_s, vec2<f32>(_e1930, 0.5f));\n        lo2_2 = _e1933.x;\n        let _e1936 = hi_3;\n        let _e1937 = lo_3;\n        if ((_e1936 - _e1937) > 0.00001f) {\n            let _e1941 = lo2_2;\n            let _e1942 = d_7;\n            let _e1943 = lo_3;\n            let _e1946 = hi2_2;\n            let _e1947 = lo2_2;\n            let _e1949 = hi_3;\n            let _e1950 = lo_3;\n            local_31 = (vec3(_e1941) + ((_e1942 - vec3(_e1943)) * ((_e1946 - _e1947) / (_e1949 - _e1950))));\n        } else {\n            let _e1956 = hi2_2;\n            local_31 = vec3(_e1956);\n        }\n        let _e1959 = local_31;\n        dc = _e1959;\n    }\n    let _e1960 = global.uRefineSat;\n    if (_e1960 < 1f) {\n        {\n            let _e1963 = d_7;\n            yc0_ = dot(_e1963, W709_);\n            let _e1966 = yc0_;\n            let _e1969 = textureSample(uCurve, uCurve_s, vec2<f32>(_e1966, 0.5f));\n            yc_1 = _e1969.x;\n            let _e1972 = yc_1;\n            let _e1973 = d_7;\n            let _e1974 = yc0_;\n            let _e1977 = yc_1;\n            let _e1978 = yc0_;\n            let _e1985 = dc;\n            let _e1986 = global.uRefineSat;\n            d_7 = mix((vec3(_e1972) + ((_e1973 - vec3(_e1974)) * (_e1977 / max(_e1978, 0.001f)))), _e1985, vec3(_e1986));\n        }\n    } else {\n        let _e1989 = dc;\n        d_7 = _e1989;\n    }\n    let _e1990 = d_7;\n    d_7 = clamp(_e1990, vec3(0f), vec3(1f));\n    let _e1996 = d_7;\n    let _e2000 = textureSample(uCurve, uCurve_s, vec2<f32>(_e1996.x, 0.5f));\n    let _e2002 = d_7;\n    let _e2006 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2002.y, 0.5f));\n    let _e2008 = d_7;\n    let _e2012 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2008.z, 0.5f));\n    d_7 = vec3<f32>(_e2000.y, _e2006.z, _e2012.w);\n    let _e2015 = d_7;\n    let _e2016 = decodeS(_e2015);\n    let _e2018 = encode((PP_TO_SRGB * _e2016));\n    d_7 = _e2018;\n    let _e2019 = global.uMaskN;\n    if (_e2019 > 0f) {\n        {\n            loop {\n                let _e2024 = i_6;\n                if !((_e2024 < 16i)) {\n                    break;\n                }\n                {\n                    let _e2031 = i_6;\n                    let _e2033 = global.uMaskN;\n                    if (f32(_e2031) >= _e2033) {\n                        break;\n                    }\n                    let _e2035 = i_6;\n                    let _e2037 = global.uMS[_e2035];\n                    let _e2041 = i_6;\n                    let _e2043 = mw[_e2041];\n                    if ((_e2037.y < 0.5f) || (_e2043 <= 0f)) {\n                        continue;\n                    }\n                    let _e2047 = i_6;\n                    row = ((f32(_e2047) + 0.5f) / 16f);\n                    let _e2054 = d_7;\n                    let _e2056 = row;\n                    let _e2058 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2054.x, _e2056));\n                    let _e2060 = d_7;\n                    let _e2062 = row;\n                    let _e2064 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2060.y, _e2062));\n                    let _e2066 = d_7;\n                    let _e2068 = row;\n                    let _e2070 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2066.z, _e2068));\n                    c_22 = vec3<f32>(_e2058.x, _e2064.x, _e2070.x);\n                    let _e2074 = d_7;\n                    yc0_1 = dot(_e2074, W709_);\n                    let _e2077 = yc0_1;\n                    let _e2078 = row;\n                    let _e2080 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2077, _e2078));\n                    yc_2 = _e2080.x;\n                    let _e2083 = yc_2;\n                    let _e2084 = d_7;\n                    let _e2085 = yc0_1;\n                    let _e2088 = yc_2;\n                    let _e2089 = yc0_1;\n                    let _e2096 = c_22;\n                    let _e2097 = i_6;\n                    let _e2099 = global.uMS[_e2097];\n                    c_22 = mix((vec3(_e2083) + ((_e2084 - vec3(_e2085)) * (_e2088 / max(_e2089, 0.001f)))), _e2096, vec3(_e2099.z));\n                    let _e2103 = c_22;\n                    c_22 = clamp(_e2103, vec3(0f), vec3(1f));\n                    let _e2109 = c_22;\n                    let _e2111 = row;\n                    let _e2113 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2109.x, _e2111));\n                    let _e2115 = c_22;\n                    let _e2117 = row;\n                    let _e2119 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2115.y, _e2117));\n                    let _e2121 = c_22;\n                    let _e2123 = row;\n                    let _e2125 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2121.z, _e2123));\n                    c_22 = vec3<f32>(_e2113.y, _e2119.z, _e2125.w);\n                    let _e2128 = d_7;\n                    let _e2129 = c_22;\n                    let _e2130 = i_6;\n                    let _e2132 = mw[_e2130];\n                    d_7 = mix(_e2128, _e2129, vec3(min(_e2132, 1f)));\n                }\n                continuing {\n                    let _e2028 = i_6;\n                    i_6 = (_e2028 + 1i);\n                }\n            }\n        }\n    }\n    let _e2137 = d_7;\n    let _e2138 = hsv(_e2137);\n    h_7 = _e2138;\n    let _e2142 = h_7;\n    chroma_1 = smoothstep(0.02f, 0.25f, _e2142.y);\n    let _e2146 = d_7;\n    let _e2147 = srgbToLin(_e2146);\n    pp_4 = (SRGB_TO_PP * _e2147);\n    let _e2150 = pp_4;\n    let _e2154 = rgbToHsv6_(max(_e2150, vec3(0f)));\n    q_6 = _e2154;\n    let _e2156 = q_6;\n    let _e2166 = textureSample(uHue, uHue_s, vec2<f32>((((_e2156.x * 60f) + 0.5f) / 360f), 0.5f));\n    let _e2168 = q_6;\n    adj = (_e2166 * smoothstep(0f, MIX_S, _e2168.y));\n    let _e2173 = adj;\n    let _e2177 = adj;\n    let _e2182 = adj;\n    if (((_e2173.x != 0f) || (_e2177.y != 0f)) || (_e2182.z != 0f)) {\n        {\n            let _e2188 = q_6;\n            let _e2190 = adj;\n            q_6.x = (_e2188.x + ((_e2190.x * MIX_HUE) / 60f));\n            let _e2197 = q_6;\n            let _e2200 = adj;\n            let _e2202 = adj;\n            if (_e2202.y > 0f) {\n                local_32 = MIX_SAT_UP;\n            } else {\n                local_32 = MIX_SAT_DOWN;\n            }\n            let _e2207 = local_32;\n            let _e2210 = adj;\n            q_6.y = (_e2197.y * max(((1f + (_e2200.y * _e2207)) - (_e2210.z * MIX_LUM_SAT)), 0f));\n            let _e2218 = q_6;\n            q_6.y = min(_e2218.y, 1f);\n            let _e2223 = q_6;\n            let _e2226 = adj;\n            let _e2228 = adj;\n            if (_e2228.z > 0f) {\n                local_33 = MIX_LUM_UP;\n            } else {\n                local_33 = MIX_LUM_DOWN;\n            }\n            let _e2233 = local_33;\n            q_6.z = (_e2223.z * max((1f + (_e2226.z * _e2233)), 0f));\n            let _e2239 = q_6;\n            let _e2240 = hsv6ToRgb(_e2239);\n            let _e2242 = linToSrgb((PP_TO_SRGB * _e2240));\n            d_7 = _e2242;\n        }\n    }\n    let _e2243 = LD;\n    if (_e2243.x != 0f) {\n        let _e2247 = d_7;\n        let _e2248 = LD;\n        let _e2252 = chroma_1;\n        let _e2254 = rotateHue(_e2247, ((_e2248.x * 60f) * _e2252));\n        d_7 = _e2254;\n    }\n    let _e2255 = global.uSaturation;\n    let _e2256 = LC;\n    sv_1 = (_e2255 + _e2256.y);\n    let _e2260 = sv_1;\n    let _e2263 = global.uVibrance;\n    if ((_e2260 != 0f) || (_e2263 != 0f)) {\n        {\n            let _e2267 = d_7;\n            let _e2268 = srgbToLin(_e2267);\n            let _e2273 = rgbToHsv6_(max((SRGB_TO_PP * _e2268), vec3(0f)));\n            ps = _e2273.y;\n            let _e2277 = sv_1;\n            let _e2278 = sv_1;\n            if (_e2278 > 0f) {\n                local_34 = 0.8f;\n            } else {\n                local_34 = 0.92f;\n            }\n            let _e2284 = local_34;\n            let _e2288 = global.uVibrance;\n            let _e2289 = global.uVibrance;\n            if (_e2289 > 0f) {\n                let _e2294 = ps;\n                local_35 = (1.29f * pow(clamp((1f - (_e2294 / 0.96f)), 0f, 1f), 0.77f));\n            } else {\n                local_35 = 0.77f;\n            }\n            let _e2306 = local_35;\n            f_2 = ((1f + (_e2277 * _e2284)) * (1f + (_e2288 * _e2306)));\n            let _e2311 = d_7;\n            let _e2312 = toOklab(_e2311);\n            o_2 = _e2312;\n            let _e2314 = o_2;\n            let _e2316 = o_2;\n            let _e2318 = f_2;\n            let _e2321 = (_e2316.yz * max(_e2318, 0f));\n            o_2.y = _e2321.x;\n            o_2.z = _e2321.y;\n            let _e2326 = o_2;\n            let _e2327 = fromOklab(_e2326);\n            d_7 = _e2327;\n        }\n    }\n    let _e2328 = LF;\n    let _e2332 = LF;\n    let _e2337 = LF;\n    if (((_e2328.y != 0f) || (_e2332.z != 0f)) || (_e2337.w != 0f)) {\n        {\n            let _e2342 = d_7;\n            yt = dot(_e2342, W709_);\n            let _e2345 = d_7;\n            let _e2347 = LF;\n            d_7 = (_e2345 * (vec3(1f) + (_e2347.yzw * 2.4f)));\n            let _e2354 = d_7;\n            let _e2355 = yt;\n            let _e2357 = d_7;\n            d_7 = (_e2354 * (max(_e2355, CHROMA_FLOOR) / max(dot(_e2357, W709_), CHROMA_FLOOR)));\n        }\n    }\n    let _e2365 = global.uMaskN;\n    if (_e2365 > 0f) {\n        {\n            loop {\n                let _e2370 = i_7;\n                if !((_e2370 < 16i)) {\n                    break;\n                }\n                {\n                    let _e2377 = i_7;\n                    let _e2379 = global.uMaskN;\n                    if (f32(_e2377) >= _e2379) {\n                        break;\n                    }\n                    let _e2381 = i_7;\n                    let _e2383 = global.uMP[_e2381];\n                    if (_e2383.w < 0.5f) {\n                        continue;\n                    }\n                    let _e2387 = d_7;\n                    let _e2388 = hsv(_e2387);\n                    hp_1 = _e2388;\n                    let _e2390 = hp_1;\n                    let _e2392 = i_7;\n                    let _e2394 = global.uMP[_e2392];\n                    dh_1 = abs((_e2390.x - _e2394.x));\n                    let _e2399 = dh_1;\n                    let _e2401 = dh_1;\n                    dh_1 = (min(_e2399, (360f - _e2401)) / 180f);\n                    let _e2406 = dh_1;\n                    let _e2409 = hp_1;\n                    let _e2411 = i_7;\n                    let _e2413 = global.uMP[_e2411];\n                    let _e2417 = i_7;\n                    let _e2419 = global.uMP[_e2417];\n                    let _e2424 = dh_1;\n                    let _e2428 = hp_1;\n                    let _e2430 = i_7;\n                    let _e2432 = global.uMP[_e2430];\n                    let _e2437 = hp_1;\n                    let _e2439 = i_7;\n                    let _e2441 = global.uMP[_e2439];\n                    dist_1 = length(vec3<f32>(((((_e2406 * 2.2f) * min(_e2409.y, _e2413.y)) / max(_e2419.y, 0.05f)) + (_e2424 * 0.4f)), ((_e2428.y - _e2432.y) * 0.9f), ((_e2437.z - _e2441.z) * 0.6f)));\n                    let _e2449 = i_7;\n                    let _e2451 = global.uMQ[_e2449];\n                    width = _e2451.w;\n                    let _e2455 = width;\n                    let _e2458 = i_7;\n                    let _e2460 = global.uMS[_e2458];\n                    let _e2465 = width;\n                    let _e2466 = dist_1;\n                    near = (1f - smoothstep((_e2455 * (1f - (0.85f * _e2460.x))), _e2465, _e2466));\n                    let _e2470 = i_7;\n                    let _e2472 = global.uPointView;\n                    if (f32(_e2470) == _e2472) {\n                        let _e2474 = near;\n                        pointShow = _e2474;\n                    }\n                    let _e2475 = near;\n                    let _e2476 = i_7;\n                    let _e2478 = mw[_e2476];\n                    k_8 = (_e2475 * _e2478);\n                    let _e2481 = k_8;\n                    if (_e2481 <= 0f) {\n                        continue;\n                    }\n                    let _e2484 = i_7;\n                    let _e2486 = global.uMQ[_e2484];\n                    if (_e2486.x != 0f) {\n                        let _e2490 = d_7;\n                        let _e2491 = i_7;\n                        let _e2493 = global.uMQ[_e2491];\n                        let _e2495 = k_8;\n                        let _e2497 = rotateHue(_e2490, (_e2493.x * _e2495));\n                        d_7 = _e2497;\n                    }\n                    let _e2498 = d_7;\n                    yp_1 = dot(_e2498, W709_);\n                    let _e2501 = yp_1;\n                    let _e2502 = d_7;\n                    let _e2503 = yp_1;\n                    let _e2507 = i_7;\n                    let _e2509 = global.uMQ[_e2507];\n                    let _e2511 = k_8;\n                    d_7 = (vec3(_e2501) + ((_e2502 - vec3(_e2503)) * max((1f + (_e2509.y * _e2511)), 0f)));\n                    let _e2519 = d_7;\n                    let _e2521 = i_7;\n                    let _e2523 = global.uMQ[_e2521];\n                    let _e2527 = k_8;\n                    d_7 = (_e2519 * (1f + ((_e2523.z * 0.8f) * _e2527)));\n                }\n                continuing {\n                    let _e2374 = i_7;\n                    i_7 = (_e2374 + 1i);\n                }\n            }\n        }\n    }\n    let _e2531 = global.uDefringeP;\n    let _e2534 = global.uDefringeG;\n    let _e2538 = LF;\n    if (((_e2531 > 0f) || (_e2534 > 0f)) || (_e2538.x > 0f)) {\n        {\n            let _e2545 = l0_;\n            let _e2546 = p_9;\n            let _e2548 = ring(_e2546, 2f);\n            edge_1 = smoothstep(0.15f, 0.6f, abs((_e2545 - _e2548)));\n            let _e2553 = d_7;\n            let _e2554 = hsv(_e2553);\n            hd = _e2554;\n            let _e2558 = hd;\n            let _e2564 = hd;\n            purple = (smoothstep(240f, 265f, _e2558.x) * (1f - smoothstep(320f, 345f, _e2564.x)));\n            let _e2572 = hd;\n            let _e2578 = hd;\n            green = (smoothstep(75f, 95f, _e2572.x) * (1f - smoothstep(150f, 170f, _e2578.x)));\n            let _e2584 = edge_1;\n            let _e2585 = purple;\n            let _e2586 = global.uDefringeP;\n            let _e2587 = LF;\n            let _e2593 = green;\n            let _e2594 = global.uDefringeG;\n            let _e2595 = LF;\n            k_9 = clamp((_e2584 * ((_e2585 * (_e2586 + max(_e2587.x, 0f))) + (_e2593 * (_e2594 + max(_e2595.x, 0f))))), 0f, 1f);\n            let _e2607 = d_7;\n            yk = dot(_e2607, W709_);\n            let _e2610 = d_7;\n            let _e2611 = yk;\n            let _e2613 = k_9;\n            d_7 = mix(_e2610, vec3(_e2611), vec3(_e2613));\n        }\n    }\n    let _e2616 = global.uBW;\n    if (_e2616 > 0f) {\n        {\n            let _e2619 = d_7;\n            let _e2622 = adj;\n            let _e2624 = chroma_1;\n            yb_2 = (dot(_e2619, W709_) * (1f + ((_e2622.w * _e2624) * 1.2f)));\n            let _e2631 = yb_2;\n            d_7 = vec3(max(_e2631, 0f));\n        }\n    }\n    let _e2635 = global.uGradeOn;\n    if (_e2635 > 0f) {\n        {\n            let _e2638 = d_7;\n            let _e2639 = toOklab(_e2638);\n            o_3 = _e2639;\n            let _e2642 = global.uGradeShape;\n            c_23 = (0.639f - (_e2642.y * 0.3f));\n            let _e2650 = global.uGradeShape;\n            w_5 = ((0.0943f * (0.1f + (_e2650.x * 0.4f))) / 0.3f);\n            let _e2661 = o_3;\n            let _e2663 = c_23;\n            let _e2666 = w_5;\n            sh_1 = (1f / (1f + exp((((_e2661.x - _e2663) + GRADE_OFF) / _e2666))));\n            let _e2674 = c_23;\n            let _e2676 = o_3;\n            let _e2679 = w_5;\n            hi_4 = (1f / (1f + exp((((_e2674 + GRADE_OFF) - _e2676.x) / _e2679))));\n            let _e2686 = sh_1;\n            let _e2688 = hi_4;\n            let _e2696 = w_5;\n            mi = (clamp(((1f - _e2686) - _e2688), 0f, 1f) / (1f - (2f / (1f + exp((GRADE_OFF / _e2696))))));\n            let _e2704 = sh_1;\n            let _e2705 = mi;\n            let _e2706 = hi_4;\n            let _e2709 = global.uGradeS;\n            let _e2711 = global.uGradeM;\n            let _e2713 = global.uGradeH;\n            let _e2715 = global.uGradeG;\n            wr = (vec4<f32>(_e2704, _e2705, _e2706, 1f) * vec4<f32>(_e2709.z, _e2711.z, _e2713.z, _e2715.z));\n            let _e2720 = o_3;\n            ab = _e2720.yz;\n            let _e2725 = o_3;\n            let _e2727 = o_3;\n            let _e2730 = wr;\n            let _e2732 = wr;\n            let _e2735 = wr;\n            let _e2738 = wr;\n            let _e2743 = (_e2727.yz * (1f - (GRADE_Q * (((_e2730.x + _e2732.y) + _e2735.z) + _e2738.w))));\n            o_3.y = _e2743.x;\n            o_3.z = _e2743.y;\n            let _e2748 = global.uGradeS;\n            let _e2750 = global.uGradeM;\n            let _e2752 = global.uGradeH;\n            let _e2754 = global.uGradeG;\n            dirs = array<vec2<f32>, 4>(_e2748.xy, _e2750.xy, _e2752.xy, _e2754.xy);\n            loop {\n                let _e2760 = i_8;\n                if !((_e2760 < 4i)) {\n                    break;\n                }\n                {\n                    let _e2767 = o_3;\n                    let _e2769 = o_3;\n                    let _e2771 = o_3;\n                    let _e2778 = i_8;\n                    let _e2780 = wr[_e2778];\n                    let _e2782 = i_8;\n                    let _e2784 = dirs[_e2782];\n                    let _e2786 = (_e2769.yz + (((GRADE_K * pow(max(_e2771.x, 0f), 0.361f)) * _e2780) * _e2784));\n                    o_3.y = _e2786.x;\n                    o_3.z = _e2786.y;\n                    let _e2791 = dk_1;\n                    let _e2792 = i_8;\n                    let _e2794 = wr[_e2792];\n                    let _e2797 = ab;\n                    let _e2798 = i_8;\n                    let _e2800 = dirs[_e2798];\n                    dk_1 = (_e2791 + (_e2794 * clamp((1f - (7f * dot(_e2797, _e2800))), 0f, 1f)));\n                }\n                continuing {\n                    let _e2764 = i_8;\n                    i_8 = (_e2764 + 1i);\n                }\n            }\n            let _e2810 = o_3;\n            let _e2813 = dk_1;\n            o_3.x = (_e2810.x * (1f - (GRADE_D * _e2813)));\n            let _e2817 = o_3;\n            let _e2818 = fromOklab(_e2817);\n            d_7 = _e2818;\n            let _e2819 = global.uGradeLum;\n            let _e2821 = sh_1;\n            let _e2823 = global.uGradeLum;\n            let _e2825 = mi;\n            let _e2828 = global.uGradeLum;\n            let _e2830 = hi_4;\n            let _e2833 = global.uGradeLum;\n            lum = ((((_e2819.x * _e2821) + (_e2823.y * _e2825)) + (_e2828.z * _e2830)) + _e2833.w);\n            let _e2837 = lum;\n            if (_e2837 >= 0f) {\n                let _e2842 = d_7;\n                let _e2846 = lum;\n                local_36 = (vec3(1f) - ((vec3(1f) - _e2842) * (1f - (_e2846 * 0.5f))));\n            } else {\n                let _e2853 = d_7;\n                let _e2855 = lum;\n                local_36 = (_e2853 * (1f + (_e2855 * 0.5f)));\n            }\n            let _e2861 = local_36;\n            d_7 = _e2861;\n        }\n    }\n    let _e2862 = global.uVignette;\n    if (_e2862 != 0f) {\n        {\n            let _e2865 = global.uOut2Vig;\n            let _e2866 = frFC;\n            let _e2867 = _e2866.xy;\n            q_7 = (_e2865 * vec3<f32>(_e2867.x, _e2867.y, 1f)).xy;\n            let _e2875 = global.uVigRound;\n            r_3 = _e2875;\n            let _e2877 = q_7;\n            let _e2878 = r_3;\n            if (_e2878 > 0f) {\n                let _e2882 = global.uCropAspect;\n                let _e2883 = r_3;\n                let _e2888 = global.uCropAspect;\n                let _e2891 = r_3;\n                local_37 = (vec2<f32>(mix(1f, _e2882, _e2883), 1f) / vec2(mix(1f, max(_e2888, 1f), _e2891)));\n            } else {\n                local_37 = vec2(1f);\n            }\n            let _e2898 = local_37;\n            qs = (_e2877 * _e2898);\n            let _e2902 = r_3;\n            pw_1 = (2f + (max(-(_e2902), 0f) * 6f));\n            let _e2910 = qs;\n            let _e2913 = pw_1;\n            let _e2915 = qs;\n            let _e2918 = pw_1;\n            let _e2922 = pw_1;\n            dist_2 = pow((pow(abs(_e2910.x), _e2913) + pow(abs(_e2915.y), _e2918)), (1f / _e2922));\n            let _e2927 = global.uVigMid;\n            m0_1 = (1.45f - (_e2927 * 0.9f));\n            let _e2933 = global.uVigFeather;\n            f_3 = (0.08f + (_e2933 * 0.9f));\n            let _e2938 = m0_1;\n            let _e2939 = f_3;\n            let _e2943 = m0_1;\n            let _e2944 = f_3;\n            let _e2948 = dist_2;\n            mask_1 = smoothstep((_e2938 - (_e2939 * 0.5f)), (_e2943 + (_e2944 * 0.5f)), _e2948);\n            let _e2951 = global.uVignette;\n            let _e2953 = mask_1;\n            amt = ((abs(_e2951) * _e2953) * 0.9f);\n            let _e2958 = global.uVigStyle;\n            if (_e2958 > 2.5f) {\n                let _e2961 = d_7;\n                let _e2962 = global.uVignette;\n                if (_e2962 > 0f) {\n                    local_38 = vec3(1f);\n                } else {\n                    local_38 = vec3(0f);\n                }\n                let _e2970 = local_38;\n                let _e2971 = amt;\n                d_7 = mix(_e2961, _e2970, vec3(_e2971));\n            } else {\n                {\n                    let _e2974 = d_7;\n                    d0_ = _e2974;\n                    let _e2976 = global.uVignette;\n                    if (_e2976 > 0f) {\n                        let _e2981 = d_7;\n                        let _e2985 = amt;\n                        local_39 = (vec3(1f) - ((vec3(1f) - _e2981) * (1f - _e2985)));\n                    } else {\n                        let _e2990 = d_7;\n                        let _e2992 = amt;\n                        local_39 = (_e2990 * (1f - _e2992));\n                    }\n                    let _e2996 = local_39;\n                    d_7 = _e2996;\n                    let _e2997 = global.uVigStyle;\n                    if (_e2997 < 1.5f) {\n                        let _e3000 = d_7;\n                        let _e3001 = d0_;\n                        let _e3002 = global.uVigHighlights;\n                        let _e3005 = d0_;\n                        let _e3007 = d0_;\n                        let _e3009 = d0_;\n                        d_7 = mix(_e3000, _e3001, vec3((_e3002 * smoothstep(0.55f, 1f, max(_e3005.x, max(_e3007.y, _e3009.z))))));\n                    } else {\n                        let _e3017 = d_7;\n                        let _e3018 = d0_;\n                        let _e3019 = global.uVigHighlights;\n                        let _e3024 = d0_;\n                        let _e3026 = d0_;\n                        let _e3028 = d0_;\n                        d_7 = mix(_e3017, _e3018, vec3(((_e3019 * 0.5f) * smoothstep(0.7f, 1f, max(_e3024.x, max(_e3026.y, _e3028.z))))));\n                    }\n                }\n            }\n        }\n    }\n    let _e3036 = global.uGrain;\n    let _e3038 = LE;\n    grainAmt = (_e3036.x + _e3038.x);\n    let _e3042 = grainAmt;\n    if (_e3042 > 0f) {\n        {\n            let _e3045 = LE;\n            let _e3047 = grainAmt;\n            t_7 = (_e3045.x / _e3047);\n            let _e3050 = global.uGrain;\n            let _e3052 = LE;\n            let _e3054 = LE;\n            let _e3059 = t_7;\n            size = mix(_e3050.y, (_e3052.y / max(_e3054.x, 0.0001f)), _e3059);\n            let _e3062 = global.uGrain;\n            let _e3064 = LE;\n            let _e3066 = LE;\n            let _e3071 = t_7;\n            rough = mix(_e3062.z, (_e3064.z / max(_e3066.x, 0.0001f)), _e3071);\n            let _e3074 = ori;\n            let _e3075 = size;\n            g_2 = (_e3074 / vec2(_e3075));\n            let _e3079 = g_2;\n            let _e3080 = vnoise(_e3079);\n            nz = (_e3080 - 0.5f);\n            let _e3084 = nz;\n            let _e3085 = g_2;\n            let _e3091 = vnoise(((_e3085 * 2.3f) + vec2(17f)));\n            let _e3094 = rough;\n            nz = mix(_e3084, (_e3091 - 0.5f), (_e3094 * 0.6f));\n            let _e3098 = d_7;\n            yg = dot(_e3098, W709_);\n            let _e3101 = d_7;\n            let _e3102 = nz;\n            let _e3103 = grainAmt;\n            let _e3112 = yg;\n            d_7 = (_e3101 + vec3((((_e3102 * min(_e3103, 1.5f)) * 0.35f) * (0.3f + (0.7f * (1f - abs(((_e3112 * 2f) - 1f))))))));\n        }\n    }\n    let _e3124 = global.uMelissa;\n    if (_e3124 > 0.5f) {\n        let _e3127 = d_7;\n        let _e3128 = decodeS(_e3127);\n        let _e3135 = encode(clamp((SRGB_TO_PP * _e3128), vec3(0f), vec3(1f)));\n        local_40 = _e3135;\n    } else {\n        let _e3136 = d_7;\n        let _e3137 = gamutIn(_e3136);\n        local_40 = _e3137;\n    }\n    let _e3139 = local_40;\n    d_7 = _e3139;\n    let _e3140 = global.uMaskView;\n    if (_e3140 >= 0f) {\n        {\n            let _e3143 = shownW;\n            let _e3144 = fwidth(_e3143);\n            let _e3147 = global.uMaskLine;\n            fw = (max(_e3144, 0.0001f) * _e3147);\n            let _e3152 = fw;\n            let _e3153 = shownW;\n            edge_2 = (1f - smoothstep(0f, _e3152, abs((_e3153 - 0.5f))));\n            let _e3162 = fw;\n            let _e3165 = shownW;\n            let _e3173 = fw;\n            let _e3176 = shownW;\n            soft = (max((1f - smoothstep(0f, (_e3162 * 0.7f), abs((_e3165 - 0.08f)))), (1f - smoothstep(0f, (_e3173 * 0.7f), abs((_e3176 - 0.92f))))) * 0.55f);\n            let _e3186 = soft;\n            let _e3188 = shownW;\n            let _e3189 = fwidth(_e3188);\n            let _e3191 = global.uMaskFeather;\n            soft = (_e3186 * (step(0.002f, _e3189) * _e3191));\n            let _e3194 = edge_2;\n            let _e3195 = soft;\n            lines = max(_e3194, _e3195);\n            let _e3198 = global.uMaskStyle;\n            if (_e3198 < 0.5f) {\n                let _e3201 = d_7;\n                let _e3202 = global.uMaskColor;\n                let _e3203 = shownW;\n                let _e3204 = global.uMaskOpacity;\n                d_7 = mix(_e3201, _e3202, vec3((_e3203 * _e3204)));\n            } else {\n                let _e3208 = global.uMaskStyle;\n                if (_e3208 < 1.5f) {\n                    let _e3211 = d_7;\n                    let _e3212 = global.uMaskColor;\n                    let _e3213 = shownW;\n                    let _e3214 = global.uMaskOpacity;\n                    let _e3220 = global.uMaskColor;\n                    let _e3221 = lines;\n                    d_7 = mix(mix(_e3211, _e3212, vec3(((_e3213 * _e3214) * 0.6f))), _e3220, vec3(_e3221));\n                } else {\n                    let _e3224 = global.uMaskStyle;\n                    if (_e3224 < 2.5f) {\n                        let _e3227 = d_7;\n                        let _e3228 = global.uMaskColor;\n                        let _e3229 = lines;\n                        let _e3230 = global.uMaskOpacity;\n                        d_7 = mix(_e3227, _e3228, vec3((_e3229 * max(_e3230, 0.35f))));\n                    } else {\n                        let _e3236 = global.uMaskStyle;\n                        if (_e3236 < 3.5f) {\n                            let _e3239 = shownW;\n                            d_7 = vec3(_e3239);\n                        } else {\n                            let _e3241 = d_7;\n                            let _e3242 = shownW;\n                            d_7 = (_e3241 * _e3242);\n                        }\n                    }\n                }\n            }\n        }\n    }\n    let _e3244 = pointShow;\n    if (_e3244 >= 0f) {\n        let _e3247 = d_7;\n        let _e3252 = d_7;\n        let _e3253 = pointShow;\n        d_7 = mix(vec3((dot(_e3247, W709_) * 0.6f)), _e3252, vec3(_e3253));\n    }\n    let _e3256 = global.uShowClip;\n    if (_e3256 > 0f) {\n        {\n            let _e3259 = d_7;\n            let _e3261 = d_7;\n            let _e3263 = d_7;\n            if (max(_e3259.x, max(_e3261.y, _e3263.z)) >= 0.998f) {\n                d_7 = vec3<f32>(1f, 0.15f, 0.2f);\n            } else {\n                let _e3273 = d_7;\n                let _e3275 = d_7;\n                let _e3277 = d_7;\n                if (max(_e3273.x, max(_e3275.y, _e3277.z)) <= 0.004f) {\n                    d_7 = vec3<f32>(0.2f, 0.45f, 1f);\n                }\n            }\n        }\n    }\n    let _e3287 = d_7;\n    o_4 = vec4<f32>(_e3287.x, _e3287.y, _e3287.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e349 = o_4;\n    return FragmentOutput(_e349);\n}\n",
  "size": 3584,
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
   "uHiRect": [
    64,
    "vec4",
    0
   ],
   "uHiSafe": [
    80,
    "vec4",
    0
   ],
   "uGlowMix": [
    96,
    "vec4",
    0
   ],
   "uOut2Ori": [
    112,
    "mat3",
    0
   ],
   "uOri2Photo": [
    160,
    "mat3",
    0
   ],
   "uOut2Crop": [
    208,
    "mat3",
    0
   ],
   "uOriCenter": [
    256,
    "vec2",
    0
   ],
   "uOriHalf": [
    264,
    "float",
    0
   ],
   "uCornerR2": [
    268,
    "float",
    0
   ],
   "uPersp": [
    272,
    "mat3",
    0
   ],
   "uDistort": [
    320,
    "float",
    0
   ],
   "uLensK": [
    336,
    "vec4",
    0
   ],
   "uLensC": [
    352,
    "vec2",
    0
   ],
   "uLensN": [
    360,
    "vec2",
    0
   ],
   "uLensVig": [
    368,
    "float",
    0
   ],
   "uLensVigMid": [
    372,
    "float",
    0
   ],
   "uDefringeP": [
    376,
    "float",
    0
   ],
   "uDefringeG": [
    380,
    "float",
    0
   ],
   "uShadowTint": [
    384,
    "float",
    0
   ],
   "uPhotoPx": [
    392,
    "vec2",
    0
   ],
   "uOut2Vig": [
    400,
    "mat3",
    0
   ],
   "uCropAspect": [
    448,
    "float",
    0
   ],
   "uBg": [
    464,
    "vec3",
    0
   ],
   "uExposure": [
    476,
    "float",
    0
   ],
   "uContrast": [
    480,
    "float",
    0
   ],
   "uContrastSat": [
    484,
    "float",
    0
   ],
   "uToneMap": [
    488,
    "float",
    0
   ],
   "uTmA": [
    496,
    "vec4",
    0
   ],
   "uTmB": [
    512,
    "vec4",
    0
   ],
   "uTmHue": [
    528,
    "float",
    0
   ],
   "uHighlights": [
    532,
    "float",
    0
   ],
   "uShadows": [
    536,
    "float",
    0
   ],
   "uWhites": [
    540,
    "float",
    0
   ],
   "uBlacks": [
    544,
    "float",
    0
   ],
   "uHlTop": [
    548,
    "float",
    0
   ],
   "uTexture": [
    552,
    "float",
    0
   ],
   "uClarity": [
    556,
    "float",
    0
   ],
   "uDehaze": [
    560,
    "float",
    0
   ],
   "uVibrance": [
    564,
    "float",
    0
   ],
   "uSaturation": [
    568,
    "float",
    0
   ],
   "uAirY": [
    572,
    "float",
    0
   ],
   "uSharpen": [
    576,
    "float",
    0
   ],
   "uSharpenRadius": [
    580,
    "float",
    0
   ],
   "uSharpenDetail": [
    584,
    "float",
    0
   ],
   "uSharpenMasking": [
    588,
    "float",
    0
   ],
   "uNrLum": [
    592,
    "float",
    0
   ],
   "uNrColor": [
    596,
    "float",
    0
   ],
   "uNrLumDetail": [
    600,
    "float",
    0
   ],
   "uNrLumContrast": [
    604,
    "float",
    0
   ],
   "uNrColorDetail": [
    608,
    "float",
    0
   ],
   "uNrColorSmooth": [
    612,
    "float",
    0
   ],
   "uVignette": [
    616,
    "float",
    0
   ],
   "uVigMid": [
    620,
    "float",
    0
   ],
   "uVigRound": [
    624,
    "float",
    0
   ],
   "uVigFeather": [
    628,
    "float",
    0
   ],
   "uVigStyle": [
    632,
    "float",
    0
   ],
   "uVigHighlights": [
    636,
    "float",
    0
   ],
   "uRefineSat": [
    640,
    "float",
    0
   ],
   "uBW": [
    644,
    "float",
    0
   ],
   "uGradeS": [
    656,
    "vec3",
    0
   ],
   "uGradeM": [
    672,
    "vec3",
    0
   ],
   "uGradeH": [
    688,
    "vec3",
    0
   ],
   "uGradeG": [
    704,
    "vec3",
    0
   ],
   "uGradeLum": [
    720,
    "vec4",
    0
   ],
   "uGradeShape": [
    736,
    "vec2",
    0
   ],
   "uGradeOn": [
    744,
    "float",
    0
   ],
   "uGrain": [
    752,
    "vec3",
    0
   ],
   "uShowClip": [
    764,
    "float",
    0
   ],
   "uMelissa": [
    768,
    "float",
    0
   ],
   "uOriSize": [
    776,
    "vec2",
    0
   ],
   "uMaskN": [
    784,
    "float",
    0
   ],
   "uMA": [
    800,
    "vec4",
    16
   ],
   "uMB": [
    1056,
    "vec4",
    16
   ],
   "uMC": [
    1312,
    "vec4",
    16
   ],
   "uMD": [
    1568,
    "vec4",
    16
   ],
   "uMR": [
    1824,
    "vec4",
    16
   ],
   "uME": [
    2080,
    "vec4",
    16
   ],
   "uMF": [
    2336,
    "vec4",
    16
   ],
   "uMP": [
    2592,
    "vec4",
    16
   ],
   "uMQ": [
    2848,
    "vec4",
    16
   ],
   "uMS": [
    3104,
    "vec4",
    16
   ],
   "uDcp": [
    3360,
    "float",
    0
   ],
   "uBaseSat": [
    3364,
    "float",
    0
   ],
   "uHsmDims": [
    3376,
    "vec4",
    0
   ],
   "uLookADims": [
    3392,
    "vec4",
    0
   ],
   "uLookBDims": [
    3408,
    "vec4",
    0
   ],
   "uS2P": [
    3424,
    "mat3",
    0
   ],
   "uP2S": [
    3472,
    "mat3",
    0
   ],
   "uPointView": [
    3520,
    "float",
    0
   ],
   "uMaskView": [
    3524,
    "float",
    0
   ],
   "uMaskColor": [
    3536,
    "vec3",
    0
   ],
   "uMaskOpacity": [
    3548,
    "float",
    0
   ],
   "uMaskStyle": [
    3552,
    "float",
    0
   ],
   "uMaskLine": [
    3556,
    "float",
    0
   ],
   "uMaskFeather": [
    3560,
    "float",
    0
   ],
   "frFlip": [
    3564,
    "float",
    0
   ],
   "frH": [
    3568,
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
    "uGlow",
    7,
    8,
    true
   ],
   [
    "uCurve",
    9,
    10,
    true
   ],
   [
    "uHue",
    11,
    12,
    true
   ],
   [
    "uMask0",
    13,
    14,
    true
   ],
   [
    "uMask1",
    15,
    16,
    true
   ],
   [
    "uMask2",
    17,
    18,
    true
   ],
   [
    "uMask3",
    19,
    20,
    true
   ],
   [
    "uMaskCurve",
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
  "hash": "c0a7f253",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uOutSize: vec2<f32>,\n    uGlowGain: f32,\n    uGlowKnee: vec2<f32>,\n    uGlowSat: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e22 = cam_1;\n    c = max(_e22, vec3(0f));\n    let _e27 = c;\n    let _e28 = global.uWB;\n    bal = min((_e27 * _e28), vec3(1f));\n    let _e36 = c;\n    let _e38 = c;\n    let _e40 = c;\n    clip = smoothstep(0.88f, 0.97f, max(_e36.x, max(_e38.y, _e40.z)));\n    let _e46 = bal;\n    let _e47 = bal;\n    let _e49 = bal;\n    let _e51 = bal;\n    let _e56 = clip;\n    bal = mix(_e46, vec3(max(_e47.x, max(_e49.y, _e51.z))), vec3(_e56));\n    let _e59 = global.uCam;\n    let _e60 = bal;\n    return (_e59 * _e60);\n}\n\nfn main_1() {\n    var local: f32;\n    var cell: vec2<f32>;\n    var base: vec2<f32>;\n    var sum: vec3<f32> = vec3(0f);\n    var j: i32 = 0i;\n    var i: i32;\n    var uv: vec2<f32>;\n    var lin: vec3<f32>;\n    var y: f32;\n    var c_1: vec3<f32>;\n    var y_1: f32;\n\n    let _e22 = gl_FragCoord_1;\n    let _e24 = global.frFlip;\n    if (_e24 > 0.5f) {\n        let _e27 = global.frH;\n        let _e28 = gl_FragCoord_1;\n        local = (_e27 - _e28.y);\n    } else {\n        let _e31 = gl_FragCoord_1;\n        local = _e31.y;\n    }\n    let _e34 = local;\n    let _e35 = gl_FragCoord_1;\n    let _e36 = _e35.zw;\n    frFC = vec4<f32>(_e22.x, _e34, _e36.x, _e36.y);\n    let _e41 = global.uOutSize;\n    cell = (vec2(1f) / _e41);\n    let _e45 = frFC;\n    let _e50 = cell;\n    base = ((_e45.xy - vec2(0.5f)) * _e50);\n    loop {\n        let _e58 = j;\n        if !((_e58 < 6i)) {\n            break;\n        }\n        i = 0i;\n        loop {\n            let _e67 = i;\n            if !((_e67 < 6i)) {\n                break;\n            }\n            {\n                let _e74 = base;\n                let _e75 = i;\n                let _e77 = j;\n                let _e83 = cell;\n                uv = (_e74 + (((vec2<f32>(f32(_e75), f32(_e77)) + vec2(0.5f)) * _e83) / vec2(6f)));\n                let _e90 = uv;\n                let _e91 = textureSample(uSrc, uSrc_s, _e90);\n                let _e93 = toLinear(_e91.xyz);\n                let _e97 = global.uGlowGain;\n                lin = min((max(_e93, vec3(0f)) * _e97), vec3(16f));\n                let _e103 = lin;\n                y = max(dot(_e103, W709_), 0.000001f);\n                let _e108 = sum;\n                let _e109 = lin;\n                let _e110 = global.uGlowKnee;\n                let _e112 = global.uGlowKnee;\n                let _e115 = global.uGlowKnee;\n                let _e117 = global.uGlowKnee;\n                let _e120 = y;\n                sum = (_e108 + (_e109 * smoothstep((_e110.x - _e112.y), (_e115.x + _e117.y), log2((_e120 / 0.18f)))));\n            }\n            continuing {\n                let _e71 = i;\n                i = (_e71 + 1i);\n            }\n        }\n        continuing {\n            let _e62 = j;\n            j = (_e62 + 1i);\n        }\n    }\n    let _e127 = sum;\n    c_1 = (_e127 / vec3(36f));\n    let _e132 = c_1;\n    y_1 = dot(_e132, W709_);\n    let _e135 = y_1;\n    let _e137 = c_1;\n    let _e138 = y_1;\n    let _e141 = global.uGlowSat;\n    let _e146 = max((vec3(_e135) + ((_e137 - vec3(_e138)) * _e141)), vec3(0f));\n    o = vec4<f32>(_e146.x, _e146.y, _e146.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e29 = o;\n    return FragmentOutput(_e29);\n}\n",
  "size": 112,
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
   "uOutSize": [
    64,
    "vec2",
    0
   ],
   "uGlowGain": [
    72,
    "float",
    0
   ],
   "uGlowKnee": [
    80,
    "vec2",
    0
   ],
   "uGlowSat": [
    88,
    "float",
    0
   ],
   "frFlip": [
    92,
    "float",
    0
   ],
   "frH": [
    96,
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
 "glowMix": {
  "hash": "277fc125",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uGlowW: vec4<f32>,\n    uGlowW4_: f32,\n    uGlowHalo: f32,\n    uGlowTint: vec3<f32>,\n    uOutSize: vec2<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uG0_: texture_2d<f32>;\n@group(0) @binding(2) \nvar uG0_s: sampler;\n@group(0) @binding(3) \nvar uG1_: texture_2d<f32>;\n@group(0) @binding(4) \nvar uG1_s: sampler;\n@group(0) @binding(5) \nvar uG2_: texture_2d<f32>;\n@group(0) @binding(6) \nvar uG2_s: sampler;\n@group(0) @binding(7) \nvar uG3_: texture_2d<f32>;\n@group(0) @binding(8) \nvar uG3_s: sampler;\n@group(0) @binding(9) \nvar uG4_: texture_2d<f32>;\n@group(0) @binding(10) \nvar uG4_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var uv: vec2<f32>;\n    var f: vec3<f32>;\n    var g: vec3<f32>;\n\n    let _e27 = gl_FragCoord_1;\n    let _e29 = global.frFlip;\n    if (_e29 > 0.5f) {\n        let _e32 = global.frH;\n        let _e33 = gl_FragCoord_1;\n        local = (_e32 - _e33.y);\n    } else {\n        let _e36 = gl_FragCoord_1;\n        local = _e36.y;\n    }\n    let _e39 = local;\n    let _e40 = gl_FragCoord_1;\n    let _e41 = _e40.zw;\n    frFC = vec4<f32>(_e27.x, _e39, _e41.x, _e41.y);\n    let _e45 = frFC;\n    let _e47 = global.uOutSize;\n    uv = (_e45.xy / _e47);\n    let _e50 = uv;\n    let _e51 = textureSample(uG0_, uG0_s, _e50);\n    f = _e51.xyz;\n    let _e54 = global.uGlowW;\n    let _e56 = f;\n    let _e58 = global.uGlowW;\n    let _e60 = uv;\n    let _e61 = textureSample(uG1_, uG1_s, _e60);\n    let _e65 = global.uGlowW;\n    let _e67 = uv;\n    let _e68 = textureSample(uG2_, uG2_s, _e67);\n    let _e72 = global.uGlowW;\n    let _e74 = uv;\n    let _e75 = textureSample(uG3_, uG3_s, _e74);\n    let _e79 = global.uGlowW4_;\n    let _e80 = uv;\n    let _e81 = textureSample(uG4_, uG4_s, _e80);\n    g = (((((_e54.x * _e56) + (_e58.y * _e61.xyz)) + (_e65.z * _e68.xyz)) + (_e72.w * _e75.xyz)) + (_e79 * _e81.xyz));\n    let _e86 = g;\n    let _e87 = global.uGlowHalo;\n    let _e88 = f;\n    g = max((_e86 - (_e87 * _e88)), vec3(0f));\n    let _e94 = g;\n    let _e95 = global.uGlowTint;\n    let _e96 = (_e94 * _e95);\n    o = vec4<f32>(_e96.x, _e96.y, _e96.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e41 = o;\n    return FragmentOutput(_e41);\n}\n",
  "size": 64,
  "uniforms": {
   "uGlowW": [
    0,
    "vec4",
    0
   ],
   "uGlowW4": [
    16,
    "float",
    0
   ],
   "uGlowHalo": [
    20,
    "float",
    0
   ],
   "uGlowTint": [
    32,
    "vec3",
    0
   ],
   "uOutSize": [
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
   ],
   [
    "uG2",
    5,
    6,
    true
   ],
   [
    "uG3",
    7,
    8,
    true
   ],
   [
    "uG4",
    9,
    10,
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
  "hash": "82981543",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uOutSize: vec2<f32>,\n    uScale: vec2<f32>,\n    uG0_: vec2<f32>,\n    uG1_: vec2<f32>,\n    uFill: f32,\n    uUseStroke: f32,\n    uUseOverlay: f32,\n    uOverlayA: f32,\n    uStrokeA: f32,\n    uUseInner: f32,\n    uUseGrad: f32,\n    uGradA: f32,\n    uGradRadial: f32,\n    uStrokeC: vec3<f32>,\n    uOverlayC: vec3<f32>,\n    uGC0_: vec3<f32>,\n    uGC1_: vec3<f32>,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uTex: texture_2d<f32>;\n@group(0) @binding(2) \nvar uTex_s: sampler;\n@group(0) @binding(3) \nvar uDil: texture_2d<f32>;\n@group(0) @binding(4) \nvar uDil_s: sampler;\n@group(0) @binding(5) \nvar uInner: texture_2d<f32>;\n@group(0) @binding(6) \nvar uInner_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn main_1() {\n    var local: f32;\n    var c0_: vec4<f32>;\n    var c: vec4<f32>;\n    var i: vec4<f32>;\n    var d: vec2<f32>;\n    var p: vec2<f32>;\n    var local_1: f32;\n    var g: f32;\n    var d_1: f32;\n    var s: f32;\n\n    let _e47 = gl_FragCoord_1;\n    let _e49 = global.frFlip;\n    if (_e49 > 0.5f) {\n        let _e52 = global.frH;\n        let _e53 = gl_FragCoord_1;\n        local = (_e52 - _e53.y);\n    } else {\n        let _e56 = gl_FragCoord_1;\n        local = _e56.y;\n    }\n    let _e59 = local;\n    let _e60 = gl_FragCoord_1;\n    let _e61 = _e60.zw;\n    frFC = vec4<f32>(_e47.x, _e59, _e61.x, _e61.y);\n    let _e65 = frFC;\n    let _e69 = textureLoad(uTex, vec2<i32>(_e65.xy), 0i);\n    c0_ = _e69;\n    let _e71 = c0_;\n    c = _e71;\n    let _e73 = global.uUseInner;\n    if (_e73 > 0.5f) {\n        {\n            let _e76 = frFC;\n            let _e80 = textureLoad(uInner, vec2<i32>(_e76.xy), 0i);\n            i = _e80;\n            let _e82 = c;\n            let _e84 = i;\n            let _e86 = c;\n            let _e89 = i;\n            let _e91 = c;\n            let _e98 = (_e84.xyz + (_e86.xyz * (1f - (_e89.w / max(_e91.w, 0.00001f)))));\n            c.x = _e98.x;\n            c.y = _e98.y;\n            c.z = _e98.z;\n        }\n    }\n    let _e105 = global.uUseGrad;\n    if (_e105 > 0.5f) {\n        {\n            let _e108 = global.uG1_;\n            let _e109 = global.uG0_;\n            d = (_e108 - _e109);\n            let _e112 = frFC;\n            let _e114 = global.uG0_;\n            p = (_e112.xy - _e114);\n            let _e117 = global.uGradRadial;\n            if (_e117 > 0.5f) {\n                let _e120 = p;\n                let _e122 = d;\n                local_1 = (length(_e120) / max(length(_e122), 0.001f));\n            } else {\n                let _e127 = p;\n                let _e128 = d;\n                let _e130 = d;\n                let _e131 = d;\n                local_1 = (dot(_e127, _e128) / max(dot(_e130, _e131), 0.001f));\n            }\n            let _e137 = local_1;\n            g = clamp(_e137, 0f, 1f);\n            let _e142 = c;\n            let _e144 = c;\n            let _e146 = global.uGC0_;\n            let _e147 = global.uGC1_;\n            let _e148 = g;\n            let _e151 = c;\n            let _e154 = global.uGradA;\n            let _e156 = mix(_e144.xyz, (mix(_e146, _e147, vec3(_e148)) * _e151.w), vec3(_e154));\n            c.x = _e156.x;\n            c.y = _e156.y;\n            c.z = _e156.z;\n        }\n    }\n    let _e163 = global.uUseOverlay;\n    if (_e163 > 0.5f) {\n        let _e166 = c;\n        let _e168 = c;\n        let _e170 = global.uOverlayC;\n        let _e171 = c;\n        let _e174 = global.uOverlayA;\n        let _e176 = mix(_e168.xyz, (_e170 * _e171.w), vec3(_e174));\n        c.x = _e176.x;\n        c.y = _e176.y;\n        c.z = _e176.z;\n    }\n    let _e183 = c;\n    let _e184 = global.uFill;\n    c = (_e183 * _e184);\n    let _e186 = global.uUseStroke;\n    if (_e186 > 0.5f) {\n        {\n            let _e189 = frFC;\n            let _e191 = global.uOutSize;\n            let _e193 = global.uScale;\n            let _e195 = textureSample(uDil, uDil_s, ((_e189.xy / _e191) * _e193));\n            d_1 = clamp(_e195.w, 0f, 1f);\n            let _e202 = d_1;\n            let _e203 = c0_;\n            let _e207 = global.uStrokeA;\n            s = (max(0f, (_e202 - _e203.w)) * _e207);\n            let _e210 = c;\n            let _e211 = global.uStrokeC;\n            let _e212 = s;\n            let _e213 = (_e211 * _e212);\n            let _e214 = s;\n            let _e220 = c;\n            c = (_e210 + (vec4<f32>(_e213.x, _e213.y, _e213.z, _e214) * (1f - _e220.w)));\n        }\n    }\n    let _e225 = c;\n    o = _e225;\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e57 = o;\n    return FragmentOutput(_e57);\n}\n",
  "size": 160,
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
   "frFlip": [
    140,
    "float",
    0
   ],
   "frH": [
    144,
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
 }
};
