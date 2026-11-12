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
  "hash": "ee967c46",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uHiRect: vec4<f32>,\n    uHiSafe: vec4<f32>,\n    uGlowMix: vec4<f32>,\n    uGlowF: vec4<f32>,\n    uGlowF2_: vec4<f32>,\n    uOut2Ori: mat3x3<f32>,\n    uOri2Photo: mat3x3<f32>,\n    uOut2Crop: mat3x3<f32>,\n    uOriCenter: vec2<f32>,\n    uOriHalf: f32,\n    uCornerR2_: f32,\n    uPersp: mat3x3<f32>,\n    uDistort: f32,\n    uLensK: vec4<f32>,\n    uLensC: vec2<f32>,\n    uLensN: vec2<f32>,\n    uLensVig: f32,\n    uLensVigMid: f32,\n    uDefringeP: f32,\n    uDefringeG: f32,\n    uShadowTint: f32,\n    uPhotoPx: vec2<f32>,\n    uOut2Vig: mat3x3<f32>,\n    uCropAspect: f32,\n    uBg: vec3<f32>,\n    uExposure: f32,\n    uContrast: f32,\n    uContrastSat: f32,\n    uConPivot: f32,\n    uToneMap: f32,\n    uTmA: vec4<f32>,\n    uTmB: vec4<f32>,\n    uTmHue: f32,\n    uHighlights: f32,\n    uShadows: f32,\n    uWhites: f32,\n    uBlacks: f32,\n    uHlTop: f32,\n    uTexture: f32,\n    uClarity: f32,\n    uDehaze: f32,\n    uVibrance: f32,\n    uSaturation: f32,\n    uAirY: f32,\n    uSharpen: f32,\n    uSharpenRadius: f32,\n    uSharpenDetail: f32,\n    uSharpenMasking: f32,\n    uNrLum: f32,\n    uNrColor: f32,\n    uNrLumDetail: f32,\n    uNrLumContrast: f32,\n    uNrColorDetail: f32,\n    uNrColorSmooth: f32,\n    uVignette: f32,\n    uVigMid: f32,\n    uVigRound: f32,\n    uVigFeather: f32,\n    uVigStyle: f32,\n    uVigHighlights: f32,\n    uRefineSat: f32,\n    uBW: f32,\n    uGradeS: vec3<f32>,\n    uGradeM: vec3<f32>,\n    uGradeH: vec3<f32>,\n    uGradeG: vec3<f32>,\n    uGradeLum: vec4<f32>,\n    uGradeShape: vec2<f32>,\n    uGradeOn: f32,\n    uGrain: vec3<f32>,\n    uShowClip: f32,\n    uMelissa: f32,\n    uOriSize: vec2<f32>,\n    uMaskN: f32,\n    uMA: array<vec4<f32>, 16>,\n    uMB: array<vec4<f32>, 16>,\n    uMC: array<vec4<f32>, 16>,\n    uMD: array<vec4<f32>, 16>,\n    uMR: array<vec4<f32>, 16>,\n    uME: array<vec4<f32>, 16>,\n    uMF: array<vec4<f32>, 16>,\n    uMP: array<vec4<f32>, 16>,\n    uMQ: array<vec4<f32>, 16>,\n    uMS: array<vec4<f32>, 16>,\n    uDcp: f32,\n    uBaseSat: f32,\n    uHsmDims: vec4<f32>,\n    uLookADims: vec4<f32>,\n    uLookBDims: vec4<f32>,\n    uS2P: mat3x3<f32>,\n    uP2S: mat3x3<f32>,\n    uPointView: f32,\n    uMaskView: f32,\n    uMaskColor: vec3<f32>,\n    uMaskOpacity: f32,\n    uMaskStyle: f32,\n    uMaskLine: f32,\n    uMaskFeather: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\nconst CS_K: f32 = 0.25f;\nconst CS_V: f32 = 0.1f;\nconst CON_K: f32 = 1f;\nconst CON_LUM: f32 = 0.6f;\nconst HL_K: f32 = 1.3f;\nconst HL_LO: f32 = 0.35f;\nconst HL_T0_: f32 = 0.65f;\nconst HL_T1_: f32 = 0.85f;\nconst SH_K: f32 = 1.3f;\nconst SH_HI: f32 = 0.65f;\nconst SH_DEEP: f32 = 0.8f;\nconst SH_C: f32 = 0.3f;\nconst HL_X: f32 = 0.5f;\nconst SH_X: f32 = 0.2f;\nconst LIFT_EDGE: f32 = 1f;\nconst LIFT_R: f32 = 4f;\nconst CON_LOCAL: f32 = 0.45f;\nconst WB_LOCAL: f32 = 0.45f;\nconst WH_NEG: f32 = 0.24f;\nconst WH_POS: f32 = 0.3f;\nconst BL_NEG: f32 = 1.4f;\nconst BL_POS: f32 = 0.55f;\nconst BL_N: f32 = 2.36f;\nconst BL_LIFT: f32 = 0.035f;\nconst LIFT_GREY: f32 = 0.9f;\nconst CHROMA_FLOOR: f32 = 0.004f;\nconst SRGB_TO_PP: mat3x3<f32> = mat3x3<f32>(vec3<f32>(0.529346f, 0.098374f, 0.016883f), vec3<f32>(0.330073f, 0.873461f, 0.117672f), vec3<f32>(0.140581f, 0.028165f, 0.865444f));\nconst PP_TO_SRGB: mat3x3<f32> = mat3x3<f32>(vec3<f32>(2.034076f, -0.228813f, -0.00857f), vec3<f32>(-0.727334f, 1.23173f, -0.153287f), vec3<f32>(-0.306742f, -0.002917f, 1.161856f));\nconst MIX_HUE: f32 = 37.97f;\nconst MIX_SAT_UP: f32 = 0.211f;\nconst MIX_SAT_DOWN: f32 = 0.692f;\nconst MIX_LUM_UP: f32 = 0.929f;\nconst MIX_LUM_DOWN: f32 = 0.834f;\nconst MIX_LUM_SAT: f32 = 0.127f;\nconst MIX_S: f32 = 0.0615f;\nconst GRADE_C: f32 = 0.6257f;\nconst GRADE_OFF: f32 = 0.1045f;\nconst GRADE_W: f32 = 0.1302f;\nconst GRADE_P: f32 = 0.4262f;\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\n@group(0) @binding(3) \nvar uHi: texture_2d<f32>;\n@group(0) @binding(4) \nvar uHi_s: sampler;\n@group(0) @binding(5) \nvar uGuide: texture_2d<f32>;\n@group(0) @binding(6) \nvar uGuide_s: sampler;\n@group(0) @binding(7) \nvar uGlow: texture_2d<f32>;\n@group(0) @binding(8) \nvar uGlow_s: sampler;\n@group(0) @binding(9) \nvar uCurve: texture_2d<f32>;\n@group(0) @binding(10) \nvar uCurve_s: sampler;\n@group(0) @binding(11) \nvar uHue: texture_2d<f32>;\n@group(0) @binding(12) \nvar uHue_s: sampler;\n@group(0) @binding(13) \nvar uMask0_: texture_2d<f32>;\n@group(0) @binding(14) \nvar uMask0_s: sampler;\n@group(0) @binding(15) \nvar uMask1_: texture_2d<f32>;\n@group(0) @binding(16) \nvar uMask1_s: sampler;\n@group(0) @binding(17) \nvar uMask2_: texture_2d<f32>;\n@group(0) @binding(18) \nvar uMask2_s: sampler;\n@group(0) @binding(19) \nvar uMask3_: texture_2d<f32>;\n@group(0) @binding(20) \nvar uMask3_s: sampler;\n@group(0) @binding(21) \nvar uMaskCurve: texture_2d<f32>;\n@group(0) @binding(22) \nvar uMaskCurve_s: sampler;\n@group(0) @binding(23) \nvar uHsm: texture_2d<f32>;\n@group(0) @binding(24) \nvar uHsm_s: sampler;\n@group(0) @binding(25) \nvar uLookA: texture_2d<f32>;\n@group(0) @binding(26) \nvar uLookA_s: sampler;\n@group(0) @binding(27) \nvar uLookB: texture_2d<f32>;\n@group(0) @binding(28) \nvar uLookB_s: sampler;\n@group(0) @binding(29) \nvar uTone: texture_2d<f32>;\n@group(0) @binding(30) \nvar uTone_s: sampler;\n@group(0) @binding(31) \nvar frNearest: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o_3: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e239 = cam_1;\n    c = max(_e239, vec3(0f));\n    let _e244 = c;\n    let _e245 = global.uWB;\n    bal = min((_e244 * _e245), vec3(1f));\n    let _e253 = c;\n    let _e255 = c;\n    let _e257 = c;\n    clip = smoothstep(0.88f, 0.97f, max(_e253.x, max(_e255.y, _e257.z)));\n    let _e263 = bal;\n    let _e264 = bal;\n    let _e266 = bal;\n    let _e268 = bal;\n    let _e273 = clip;\n    bal = mix(_e263, vec3(max(_e264.x, max(_e266.y, _e268.z))), vec3(_e273));\n    let _e276 = global.uCam;\n    let _e277 = bal;\n    return (_e276 * _e277);\n}\n\nfn conCurve(x: f32, k: f32) -> f32 {\n    var x_1: f32;\n    var k_1: f32;\n    var p: f32;\n    var local: f32;\n    var t: f32;\n    var local_1: f32;\n\n    x_1 = x;\n    k_1 = k;\n    let _e245 = global.uConPivot;\n    p = _e245;\n    let _e247 = x_1;\n    let _e248 = p;\n    if (_e247 < _e248) {\n        let _e251 = x_1;\n        let _e253 = p;\n        local = ((0.5f * _e251) / _e253);\n    } else {\n        let _e257 = x_1;\n        let _e258 = p;\n        let _e262 = p;\n        local = (0.5f + ((0.5f * (_e257 - _e258)) / (1f - _e262)));\n    }\n    let _e267 = local;\n    t = clamp(_e267, 0f, 1f);\n    let _e272 = t;\n    let _e273 = k_1;\n    let _e274 = t;\n    let _e275 = t;\n    let _e279 = t;\n    let _e283 = t;\n    t = (_e272 + (_e273 * (((_e274 * _e275) * (3f - (2f * _e279))) - _e283)));\n    let _e287 = t;\n    if (_e287 < 0.5f) {\n        let _e291 = p;\n        let _e293 = t;\n        local_1 = ((2f * _e291) * _e293);\n    } else {\n        let _e295 = p;\n        let _e296 = t;\n        let _e302 = p;\n        local_1 = (_e295 + (((_e296 - 0.5f) * 2f) * (1f - _e302)));\n    }\n    let _e307 = local_1;\n    return _e307;\n}\n\nfn cam_2(p_1: vec2<f32>) -> vec3<f32> {\n    var p_2: vec2<f32>;\n\n    p_2 = p_1;\n    let _e265 = global.uHiRect;\n    let _e269 = p_2;\n    let _e271 = global.uHiSafe;\n    let _e275 = p_2;\n    let _e277 = global.uHiSafe;\n    let _e281 = p_2;\n    let _e283 = global.uHiSafe;\n    let _e285 = global.uHiSafe;\n    let _e290 = p_2;\n    let _e292 = global.uHiSafe;\n    let _e294 = global.uHiSafe;\n    if (((((_e265.z > 0f) && (_e269.x >= _e271.x)) && (_e275.y >= _e277.y)) && (_e281.x <= (_e283.x + _e285.z))) && (_e290.y <= (_e292.y + _e294.w))) {\n        let _e299 = p_2;\n        let _e300 = global.uHiRect;\n        let _e303 = global.uHiRect;\n        let _e306 = textureSample(uHi, uHi_s, ((_e299 - _e300.xy) / _e303.zw));\n        return _e306.xyz;\n    }\n    let _e308 = p_2;\n    let _e309 = textureSample(uSrc, uSrc_s, _e308);\n    return _e309.xyz;\n}\n\nfn logLum(p_3: vec2<f32>) -> f32 {\n    var p_4: vec2<f32>;\n\n    p_4 = p_3;\n    let _e265 = p_4;\n    let _e266 = cam_2(_e265);\n    let _e267 = toLinear(_e266);\n    return log2(max(dot(_e267, W709_), 0.00001f));\n}\n\nfn ring(p_5: vec2<f32>, r: f32) -> f32 {\n    var p_6: vec2<f32>;\n    var r_1: f32;\n    var d: vec2<f32>;\n    var s: f32 = 0f;\n    var e: vec2<f32>;\n\n    p_6 = p_5;\n    r_1 = r;\n    let _e267 = global.uPhotoPx;\n    let _e268 = r_1;\n    d = (_e267 * _e268);\n    let _e273 = s;\n    let _e274 = p_6;\n    let _e275 = d;\n    let _e280 = logLum((_e274 + vec2<f32>(_e275.x, 0f)));\n    let _e281 = p_6;\n    let _e282 = d;\n    let _e287 = logLum((_e281 - vec2<f32>(_e282.x, 0f)));\n    s = (_e273 + (_e280 + _e287));\n    let _e290 = s;\n    let _e291 = p_6;\n    let _e293 = d;\n    let _e297 = logLum((_e291 + vec2<f32>(0f, _e293.y)));\n    let _e298 = p_6;\n    let _e300 = d;\n    let _e304 = logLum((_e298 - vec2<f32>(0f, _e300.y)));\n    s = (_e290 + (_e297 + _e304));\n    let _e307 = d;\n    e = (_e307 * 0.7071f);\n    let _e311 = s;\n    let _e312 = p_6;\n    let _e313 = e;\n    let _e315 = logLum((_e312 + _e313));\n    let _e316 = p_6;\n    let _e317 = e;\n    let _e319 = logLum((_e316 - _e317));\n    let _e321 = p_6;\n    let _e322 = e;\n    let _e324 = e;\n    let _e329 = logLum((_e321 + vec2<f32>(_e322.x, -(_e324.y))));\n    let _e331 = p_6;\n    let _e332 = e;\n    let _e335 = e;\n    let _e339 = logLum((_e331 + vec2<f32>(-(_e332.x), _e335.y)));\n    s = (_e311 + (((_e315 + _e319) + _e329) + _e339));\n    let _e342 = s;\n    return (_e342 / 8f);\n}\n\nfn shoulder(x_2: vec3<f32>) -> vec3<f32> {\n    var x_3: vec3<f32>;\n    var k_2: f32 = 0.72f;\n    var over: vec3<f32>;\n\n    x_3 = x_2;\n    let _e267 = k_2;\n    let _e269 = k_2;\n    let _e272 = x_3;\n    let _e273 = k_2;\n    let _e278 = k_2;\n    over = (vec3(_e267) + ((1f - _e269) * (vec3(1f) - exp((-((_e272 - vec3(_e273))) / vec3((1f - _e278)))))));\n    let _e289 = x_3;\n    let _e290 = over;\n    let _e291 = k_2;\n    let _e292 = x_3;\n    return mix(_e289, _e290, step(vec3(_e291), _e292));\n}\n\nfn shoulder1_(x_4: f32) -> f32 {\n    var x_5: f32;\n\n    x_5 = x_4;\n    let _e265 = x_5;\n    let _e267 = shoulder(vec3(_e265));\n    return _e267.x;\n}\n\nfn chroma(c_1: vec3<f32>) -> vec3<f32> {\n    var c_2: vec3<f32>;\n    var y: f32;\n\n    c_2 = c_1;\n    let _e266 = c_2;\n    y = dot(_e266, W709_);\n    let _e269 = c_2;\n    let _e270 = y;\n    let _e273 = y;\n    return ((_e269 - vec3(_e270)) / vec3(max(_e273, CHROMA_FLOOR)));\n}\n\nfn encode(x_6: vec3<f32>) -> vec3<f32> {\n    var x_7: vec3<f32>;\n\n    x_7 = x_6;\n    let _e266 = x_7;\n    let _e270 = x_7;\n    let _e284 = x_7;\n    return mix((_e266 * 12.92f), ((1.055f * pow(max(_e270, vec3(0f)), vec3(0.41666666f))) - vec3(0.055f)), step(vec3(0.0031308f), _e284));\n}\n\nfn sigmoid1_(x_8: f32, pf: f32, pp: f32, k_3: f32) -> f32 {\n    var x_9: f32;\n    var pf_1: f32;\n    var pp_1: f32;\n    var k_4: f32;\n    var g: f32 = 0.18f;\n    var u: f32;\n    var w: f32;\n\n    x_9 = x_8;\n    pf_1 = pf;\n    pp_1 = pp;\n    k_4 = k_3;\n    let _e272 = x_9;\n    if (_e272 <= 0f) {\n        return 0f;\n    }\n    let _e278 = x_9;\n    let _e279 = g;\n    if (_e278 <= _e279) {\n        {\n            let _e281 = x_9;\n            let _e282 = g;\n            let _e284 = pf_1;\n            u = pow((_e281 / _e282), _e284);\n            let _e287 = u;\n            let _e288 = u;\n            let _e289 = k_4;\n            let _e292 = pp_1;\n            return pow((_e287 / (_e288 + _e289)), _e292);\n        }\n    }\n    let _e294 = g;\n    let _e295 = x_9;\n    let _e297 = pf_1;\n    w = pow((_e294 / _e295), _e297);\n    let _e302 = k_4;\n    let _e303 = w;\n    let _e307 = pp_1;\n    return pow((1f / (1f + (_e302 * _e303))), _e307);\n}\n\nfn sigmoidMap(x_10: vec3<f32>) -> vec3<f32> {\n    var x_11: vec3<f32>;\n    var pf_2: f32;\n    var pp_2: f32;\n    var k_5: f32;\n    var ph: f32;\n    var c0_: vec3<f32>;\n    var c_3: vec3<f32>;\n    var mx0_: f32;\n    var mn0_: f32;\n    var mx1_: f32;\n    var mn1_: f32;\n    var h: vec3<f32>;\n\n    x_11 = x_10;\n    let _e266 = global.uTmA;\n    pf_2 = _e266.x;\n    let _e269 = global.uTmA;\n    pp_2 = _e269.y;\n    let _e272 = global.uTmA;\n    k_5 = _e272.z;\n    let _e275 = global.uTmA;\n    ph = _e275.w;\n    let _e278 = x_11;\n    c0_ = max(_e278, vec3(0f));\n    let _e283 = c0_;\n    let _e285 = pf_2;\n    let _e286 = pp_2;\n    let _e287 = k_5;\n    let _e288 = sigmoid1_(_e283.x, _e285, _e286, _e287);\n    let _e289 = c0_;\n    let _e291 = pf_2;\n    let _e292 = pp_2;\n    let _e293 = k_5;\n    let _e294 = sigmoid1_(_e289.y, _e291, _e292, _e293);\n    let _e295 = c0_;\n    let _e297 = pf_2;\n    let _e298 = pp_2;\n    let _e299 = k_5;\n    let _e300 = sigmoid1_(_e295.z, _e297, _e298, _e299);\n    c_3 = vec3<f32>(_e288, _e294, _e300);\n    let _e303 = ph;\n    if (_e303 > 0f) {\n        {\n            let _e306 = c0_;\n            let _e308 = c0_;\n            let _e310 = c0_;\n            mx0_ = max(_e306.x, max(_e308.y, _e310.z));\n            let _e315 = c0_;\n            let _e317 = c0_;\n            let _e319 = c0_;\n            mn0_ = min(_e315.x, min(_e317.y, _e319.z));\n            let _e324 = c_3;\n            let _e326 = c_3;\n            let _e328 = c_3;\n            mx1_ = max(_e324.x, max(_e326.y, _e328.z));\n            let _e333 = c_3;\n            let _e335 = c_3;\n            let _e337 = c_3;\n            mn1_ = min(_e333.x, min(_e335.y, _e337.z));\n            let _e342 = mx0_;\n            let _e343 = mn0_;\n            let _e347 = mx1_;\n            let _e348 = mn1_;\n            if (((_e342 - _e343) > 0.000001f) && ((_e347 - _e348) > 0.000001f)) {\n                {\n                    let _e353 = mn1_;\n                    let _e354 = c0_;\n                    let _e355 = mn0_;\n                    let _e358 = mx0_;\n                    let _e359 = mn0_;\n                    let _e368 = mx1_;\n                    let _e369 = mn1_;\n                    h = (vec3(_e353) + (clamp(((_e354 - vec3(_e355)) / vec3((_e358 - _e359))), vec3(0f), vec3(1f)) * (_e368 - _e369)));\n                    let _e375 = c_3;\n                    let _e376 = h;\n                    let _e377 = ph;\n                    c_3 = mix(_e375, _e376, vec3(_e377));\n                }\n            }\n        }\n    }\n    let _e380 = c_3;\n    return clamp(_e380, vec3(0f), vec3(1f));\n}\n\nfn agxMap(x_12: vec3<f32>) -> vec3<f32> {\n    var x_13: vec3<f32>;\n    var inset: mat3x3<f32> = mat3x3<f32>(vec3<f32>(0.84247905f, 0.042328242f, 0.042375654f), vec3<f32>(0.0784336f, 0.87846863f, 0.0784336f), vec3<f32>(0.079223745f, 0.07916613f, 0.879143f));\n    var outset: mat3x3<f32> = mat3x3<f32>(vec3<f32>(1.196879f, -0.052896854f, -0.052971635f), vec3<f32>(-0.09802088f, 1.1519032f, -0.09804345f), vec3<f32>(-0.09902974f, -0.098961174f, 1.1510737f));\n    var lo: f32 = -12.47393f;\n    var hi: f32 = 4.026069f;\n    var mid: f32 = 0.6060606f;\n    var v: vec3<f32>;\n    var v2_: vec3<f32>;\n    var v4_: vec3<f32>;\n    var lin: vec3<f32>;\n    var y_1: f32;\n    var roll: f32;\n    var sat: f32;\n\n    x_13 = x_12;\n    let _e307 = inset;\n    let _e308 = x_13;\n    let _e317 = lo;\n    let _e320 = hi;\n    let _e321 = lo;\n    v = clamp(((log2(max((_e307 * max(_e308, vec3(0f))), vec3(0.0000000001f))) - vec3(_e317)) / vec3((_e320 - _e321))), vec3(0f), vec3(1f));\n    let _e331 = mid;\n    let _e332 = v;\n    let _e333 = mid;\n    let _e336 = global.uTmA;\n    v = clamp((vec3(_e331) + ((_e332 - vec3(_e333)) * _e336.x)), vec3(0f), vec3(1f));\n    let _e346 = v;\n    let _e347 = v;\n    v2_ = (_e346 * _e347);\n    let _e350 = v2_;\n    let _e351 = v2_;\n    v4_ = (_e350 * _e351);\n    let _e355 = v4_;\n    let _e357 = v2_;\n    let _e360 = v4_;\n    let _e362 = v;\n    let _e366 = v4_;\n    let _e370 = v2_;\n    let _e372 = v;\n    let _e376 = v2_;\n    let _e380 = v;\n    v = ((((((((15.5f * _e355) * _e357) - ((40.14f * _e360) * _e362)) + (31.96f * _e366)) - ((6.868f * _e370) * _e372)) + (0.4298f * _e376)) + (0.1191f * _e380)) - vec3(0.00232f));\n    let _e386 = outset;\n    let _e387 = v;\n    lin = max((_e386 * pow(max(_e387, vec3(0f)), vec3(2.2f))), vec3(0f));\n    let _e399 = lin;\n    y_1 = dot(_e399, W709_);\n    let _e404 = y_1;\n    let _e406 = global.uTmA;\n    roll = (smoothstep(0.5f, 1f, _e404) * _e406.z);\n    let _e410 = global.uTmA;\n    let _e413 = roll;\n    sat = (_e410.y * (1f - _e413));\n    let _e417 = y_1;\n    let _e418 = lin;\n    let _e419 = y_1;\n    let _e422 = sat;\n    return clamp((vec3(_e417) + ((_e418 - vec3(_e419)) * _e422)), vec3(0f), vec3(1f));\n}\n\nfn filmic1_(x_14: f32) -> f32 {\n    var x_15: f32;\n    var ev: f32;\n    var t_1: f32;\n    var s_1: f32;\n    var t1_: f32;\n    var y1_: f32;\n    var t2_: f32;\n    var y2_: f32;\n    var u_1: f32;\n    var m1_: f32;\n    var v_1: f32;\n    var d2_: f32;\n    var m2_: f32;\n\n    x_15 = x_14;\n    let _e266 = x_15;\n    if (_e266 <= 0f) {\n        return 0f;\n    }\n    let _e270 = x_15;\n    ev = log2((max(_e270, 0.0000000001f) / 0.18f));\n    let _e277 = ev;\n    let _e278 = global.uTmA;\n    let _e281 = global.uTmA;\n    t_1 = clamp(((_e277 - _e278.x) * _e281.y), 0f, 1f);\n    let _e288 = global.uTmA;\n    s_1 = _e288.w;\n    let _e291 = global.uTmB;\n    t1_ = _e291.x;\n    let _e294 = global.uTmB;\n    y1_ = _e294.y;\n    let _e297 = global.uTmB;\n    t2_ = _e297.z;\n    let _e300 = global.uTmB;\n    y2_ = _e300.w;\n    let _e303 = t_1;\n    let _e304 = t1_;\n    if (_e303 < _e304) {\n        {\n            let _e306 = t_1;\n            let _e307 = t1_;\n            u_1 = (_e306 / max(_e307, 0.000001f));\n            let _e312 = s_1;\n            let _e313 = t1_;\n            m1_ = (_e312 * _e313);\n            let _e316 = u_1;\n            let _e317 = u_1;\n            let _e320 = y1_;\n            let _e322 = m1_;\n            let _e324 = m1_;\n            let _e326 = y1_;\n            let _e329 = u_1;\n            return ((_e316 * _e317) * (((3f * _e320) - _e322) + ((_e324 - (2f * _e326)) * _e329)));\n        }\n    }\n    let _e333 = t_1;\n    let _e334 = t2_;\n    if (_e333 <= _e334) {\n        let _e336 = y1_;\n        let _e337 = s_1;\n        let _e338 = t_1;\n        let _e339 = t1_;\n        return (_e336 + (_e337 * (_e338 - _e339)));\n    }\n    let _e344 = t_1;\n    let _e347 = t2_;\n    v_1 = ((1f - _e344) / max((1f - _e347), 0.000001f));\n    let _e354 = y2_;\n    d2_ = (1f - _e354);\n    let _e357 = s_1;\n    let _e359 = t2_;\n    m2_ = (_e357 * (1f - _e359));\n    let _e364 = v_1;\n    let _e365 = v_1;\n    let _e368 = d2_;\n    let _e370 = m2_;\n    let _e372 = m2_;\n    let _e374 = d2_;\n    let _e377 = v_1;\n    return (1f - ((_e364 * _e365) * (((3f * _e368) - _e370) + ((_e372 - (2f * _e374)) * _e377))));\n}\n\nfn filmicMap(x_16: vec3<f32>) -> vec3<f32> {\n    var x_17: vec3<f32>;\n    var c_4: vec3<f32>;\n    var yIn: f32;\n    var yOut: f32;\n    var ev_1: f32;\n    var t_2: f32;\n    var sh: f32;\n    var lat: f32;\n    var d_1: vec3<f32>;\n    var h_1: vec3<f32>;\n    var mx: f32;\n    var mn: f32;\n    var normRgb: vec3<f32>;\n    var perCh: vec3<f32>;\n\n    x_17 = x_16;\n    let _e266 = x_17;\n    c_4 = max(_e266, vec3(0f));\n    let _e271 = c_4;\n    yIn = dot(_e271, W709_);\n    let _e274 = yIn;\n    if (_e274 <= 0.0000000001f) {\n        return vec3(0f);\n    }\n    let _e279 = yIn;\n    let _e280 = filmic1_(_e279);\n    yOut = _e280;\n    let _e282 = yIn;\n    ev_1 = log2((_e282 / 0.18f));\n    let _e287 = ev_1;\n    let _e288 = global.uTmA;\n    let _e291 = global.uTmA;\n    t_2 = clamp(((_e287 - _e288.x) * _e291.y), 0f, 1f);\n    let _e298 = global.uTmB;\n    let _e301 = t_2;\n    sh = smoothstep(_e298.z, 1f, _e301);\n    let _e305 = sh;\n    let _e306 = sh;\n    lat = (1f - ((_e305 * _e306) * 0.65f));\n    let _e312 = c_4;\n    let _e313 = yIn;\n    let _e316 = yOut;\n    let _e317 = yIn;\n    let _e320 = lat;\n    d_1 = (((_e312 - vec3(_e313)) * (_e316 / _e317)) * _e320);\n    let _e323 = yOut;\n    let _e324 = d_1;\n    h_1 = (vec3(_e323) + _e324);\n    let _e328 = h_1;\n    let _e330 = h_1;\n    let _e332 = h_1;\n    mx = max(_e328.x, max(_e330.y, _e332.z));\n    let _e337 = mx;\n    if (_e337 > 1f) {\n        let _e340 = d_1;\n        let _e342 = yOut;\n        let _e344 = mx;\n        let _e345 = yOut;\n        d_1 = (_e340 * ((1f - _e342) / max((_e344 - _e345), 0.000001f)));\n    }\n    let _e351 = yOut;\n    let _e352 = d_1;\n    let _e355 = yOut;\n    let _e356 = d_1;\n    let _e359 = yOut;\n    let _e360 = d_1;\n    mn = min((_e351 + _e352.x), min((_e355 + _e356.y), (_e359 + _e360.z)));\n    let _e366 = mn;\n    if (_e366 < 0f) {\n        let _e369 = d_1;\n        let _e370 = yOut;\n        let _e371 = yOut;\n        let _e372 = mn;\n        d_1 = (_e369 * (_e370 / max((_e371 - _e372), 0.000001f)));\n    }\n    let _e378 = yOut;\n    let _e379 = d_1;\n    normRgb = clamp((vec3(_e378) + _e379), vec3(0f), vec3(1f));\n    let _e388 = global.uTmHue;\n    if (_e388 >= 0.999f) {\n        let _e391 = normRgb;\n        return _e391;\n    }\n    let _e392 = c_4;\n    let _e394 = filmic1_(_e392.x);\n    let _e395 = c_4;\n    let _e397 = filmic1_(_e395.y);\n    let _e398 = c_4;\n    let _e400 = filmic1_(_e398.z);\n    perCh = vec3<f32>(_e394, _e397, _e400);\n    let _e403 = perCh;\n    let _e404 = normRgb;\n    let _e405 = global.uTmHue;\n    return clamp(mix(_e403, _e404, vec3(_e405)), vec3(0f), vec3(1f));\n}\n\nfn decodeS(v_2: vec3<f32>) -> vec3<f32> {\n    var v_3: vec3<f32>;\n\n    v_3 = v_2;\n    let _e266 = v_3;\n    let _e270 = v_3;\n    let _e284 = v_3;\n    return mix((_e266 / vec3(12.92f)), pow(((max(_e270, vec3(0f)) + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), step(vec3(0.04045f), _e284));\n}\n\nfn gamutIn(d_2: vec3<f32>) -> vec3<f32> {\n    var d_3: vec3<f32>;\n    var lin_1: vec3<f32>;\n    var ach: f32;\n    var thr: f32 = 0.95f;\n    var lim: f32 = 1.3f;\n    var pw: f32 = 1.2f;\n    var sc: f32;\n    var dist: vec3<f32>;\n    var over_1: vec3<f32>;\n    var cd: vec3<f32>;\n\n    d_3 = d_2;\n    let _e268 = d_3;\n    let _e269 = decodeS(_e268);\n    lin_1 = _e269;\n    let _e271 = lin_1;\n    let _e273 = lin_1;\n    let _e275 = lin_1;\n    ach = max(_e271.x, max(_e273.y, _e275.z));\n    let _e280 = ach;\n    if (_e280 > 0f) {\n        {\n            let _e289 = lim;\n            let _e290 = thr;\n            let _e293 = thr;\n            let _e295 = lim;\n            let _e296 = thr;\n            let _e299 = pw;\n            let _e305 = pw;\n            sc = ((_e289 - _e290) / pow((pow(((1f - _e293) / (_e295 - _e296)), -(_e299)) - 1f), (1f / _e305)));\n            let _e310 = ach;\n            let _e311 = lin_1;\n            let _e314 = ach;\n            dist = ((vec3(_e310) - _e311) / vec3(_e314));\n            let _e318 = dist;\n            let _e319 = thr;\n            let _e325 = sc;\n            over_1 = (max((_e318 - vec3(_e319)), vec3(0f)) / vec3(_e325));\n            let _e329 = dist;\n            let _e330 = thr;\n            let _e331 = sc;\n            let _e332 = over_1;\n            let _e335 = over_1;\n            let _e336 = pw;\n            let _e342 = pw;\n            let _e349 = thr;\n            let _e350 = dist;\n            cd = mix(_e329, (vec3(_e330) + ((_e331 * _e332) / pow((vec3(1f) + pow(_e335, vec3(_e336))), vec3((1f / _e342))))), step(vec3(_e349), _e350));\n            let _e355 = ach;\n            let _e356 = cd;\n            let _e357 = ach;\n            lin_1 = (vec3(_e355) - (_e356 * _e357));\n        }\n    }\n    let _e361 = lin_1;\n    let _e367 = encode(clamp(_e361, vec3(0f), vec3(1f)));\n    return clamp(_e367, vec3(0f), vec3(1f));\n}\n\nfn srgbToLin(c_5: vec3<f32>) -> vec3<f32> {\n    var c_6: vec3<f32>;\n    var a: vec3<f32>;\n\n    c_6 = c_5;\n    let _e279 = c_6;\n    a = abs(_e279);\n    let _e282 = c_6;\n    let _e284 = a;\n    let _e294 = a;\n    let _e298 = a;\n    return (sign(_e282) * mix(pow(((_e284 + vec3(0.055f)) / vec3(1.055f)), vec3(2.4f)), (_e294 / vec3(12.92f)), step(_e298, vec3(0.04045f))));\n}\n\nfn linToSrgb(c_7: vec3<f32>) -> vec3<f32> {\n    var c_8: vec3<f32>;\n    var a_1: vec3<f32>;\n\n    c_8 = c_7;\n    let _e279 = c_8;\n    a_1 = abs(_e279);\n    let _e282 = c_8;\n    let _e285 = a_1;\n    let _e295 = a_1;\n    let _e298 = a_1;\n    return (sign(_e282) * mix(((1.055f * pow(_e285, vec3(0.41666666f))) - vec3(0.055f)), (_e295 * 12.92f), step(_e298, vec3(0.0031308f))));\n}\n\nfn toOklab(c_9: vec3<f32>) -> vec3<f32> {\n    var c_10: vec3<f32>;\n    var l: vec3<f32>;\n\n    c_10 = c_9;\n    let _e279 = c_10;\n    let _e280 = srgbToLin(_e279);\n    l = (_e280 * mat3x3<f32>(vec3<f32>(0.41222146f, 0.53633255f, 0.051445995f), vec3<f32>(0.2119035f, 0.6806995f, 0.10739696f), vec3<f32>(0.08830246f, 0.28171885f, 0.6299787f)));\n    let _e296 = l;\n    let _e298 = l;\n    l = (sign(_e296) * pow(abs(_e298), vec3(0.33333334f)));\n    let _e306 = l;\n    return (_e306 * mat3x3<f32>(vec3<f32>(0.21045426f, 0.7936178f, -0.004072047f), vec3<f32>(1.9779985f, -2.4285922f, 0.4505937f), vec3<f32>(0.025904037f, 0.78277177f, -0.80867577f)));\n}\n\nfn fromOklab(o: vec3<f32>) -> vec3<f32> {\n    var o_1: vec3<f32>;\n    var l_1: vec3<f32>;\n\n    o_1 = o;\n    let _e279 = o_1;\n    l_1 = (_e279 * mat3x3<f32>(vec3<f32>(1f, 0.39633778f, 0.21580376f), vec3<f32>(1f, -0.105561346f, -0.06385417f), vec3<f32>(1f, -0.08948418f, -1.2914855f)));\n    let _e299 = l_1;\n    let _e300 = l_1;\n    let _e302 = l_1;\n    l_1 = ((_e299 * _e300) * _e302);\n    let _e304 = l_1;\n    let _e324 = linToSrgb((_e304 * mat3x3<f32>(vec3<f32>(4.0767417f, -3.3077116f, 0.23096994f), vec3<f32>(-1.268438f, 2.6097574f, -0.34131938f), vec3<f32>(-0.0041960864f, -0.7034186f, 1.7076147f))));\n    return _e324;\n}\n\nfn hsv(c_11: vec3<f32>) -> vec3<f32> {\n    var c_12: vec3<f32>;\n    var mx_1: f32;\n    var mn_1: f32;\n    var d_4: f32;\n    var h_2: f32 = 0f;\n    var local_2: f32;\n\n    c_12 = c_11;\n    let _e279 = c_12;\n    let _e281 = c_12;\n    let _e283 = c_12;\n    mx_1 = max(_e279.x, max(_e281.y, _e283.z));\n    let _e288 = c_12;\n    let _e290 = c_12;\n    let _e292 = c_12;\n    mn_1 = min(_e288.x, min(_e290.y, _e292.z));\n    let _e297 = mx_1;\n    let _e298 = mn_1;\n    d_4 = (_e297 - _e298);\n    let _e303 = d_4;\n    if (_e303 > 0.00001f) {\n        {\n            let _e306 = mx_1;\n            let _e307 = c_12;\n            if (_e306 == _e307.x) {\n                let _e310 = c_12;\n                let _e312 = c_12;\n                let _e315 = d_4;\n                let _e316 = ((_e310.y - _e312.z) / _e315);\n                h_2 = (_e316 - (floor((_e316 / 6f)) * 6f));\n            } else {\n                let _e322 = mx_1;\n                let _e323 = c_12;\n                if (_e322 == _e323.y) {\n                    let _e326 = c_12;\n                    let _e328 = c_12;\n                    let _e331 = d_4;\n                    h_2 = (((_e326.z - _e328.x) / _e331) + 2f);\n                } else {\n                    let _e335 = c_12;\n                    let _e337 = c_12;\n                    let _e340 = d_4;\n                    h_2 = (((_e335.x - _e337.y) / _e340) + 4f);\n                }\n            }\n        }\n    }\n    let _e344 = h_2;\n    let _e347 = mx_1;\n    if (_e347 > 0f) {\n        let _e350 = d_4;\n        let _e351 = mx_1;\n        local_2 = (_e350 / _e351);\n    } else {\n        local_2 = 0f;\n    }\n    let _e355 = local_2;\n    let _e356 = mx_1;\n    return vec3<f32>((_e344 * 60f), _e355, _e356);\n}\n\nfn rotateHue(c_13: vec3<f32>, deg: f32) -> vec3<f32> {\n    var c_14: vec3<f32>;\n    var deg_1: f32;\n    var a_2: f32;\n    var s_2: f32;\n    var co: f32;\n    var k_6: vec3<f32> = vec3(0.57735f);\n    var m: f32;\n    var v_4: vec3<f32>;\n\n    c_14 = c_13;\n    deg_1 = deg;\n    let _e281 = deg_1;\n    a_2 = radians(_e281);\n    let _e284 = a_2;\n    s_2 = sin(_e284);\n    let _e287 = a_2;\n    co = cos(_e287);\n    let _e293 = c_14;\n    let _e295 = c_14;\n    let _e298 = c_14;\n    m = (((_e293.x + _e295.y) + _e298.z) / 3f);\n    let _e304 = c_14;\n    let _e305 = m;\n    v_4 = (_e304 - vec3(_e305));\n    let _e309 = m;\n    let _e310 = v_4;\n    let _e311 = co;\n    let _e315 = k_6;\n    let _e316 = v_4;\n    let _e318 = s_2;\n    return ((vec3(_e309) + (_e310 * _e311)) + (cross(_e315, _e316) * _e318));\n}\n\nfn rgbToHsv6_(c_15: vec3<f32>) -> vec3<f32> {\n    var c_16: vec3<f32>;\n    var v_5: f32;\n    var gap: f32;\n    var local_3: f32;\n    var local_4: f32;\n    var h_3: f32;\n\n    c_16 = c_15;\n    let _e279 = c_16;\n    let _e281 = c_16;\n    let _e283 = c_16;\n    v_5 = max(_e279.x, max(_e281.y, _e283.z));\n    let _e288 = v_5;\n    let _e289 = c_16;\n    let _e291 = c_16;\n    let _e293 = c_16;\n    gap = (_e288 - min(_e289.x, min(_e291.y, _e293.z)));\n    let _e299 = gap;\n    if (_e299 <= 0f) {\n        let _e304 = v_5;\n        return vec3<f32>(0f, 0f, _e304);\n    }\n    let _e306 = c_16;\n    let _e308 = v_5;\n    if (_e306.x == _e308) {\n        let _e310 = c_16;\n        let _e312 = c_16;\n        let _e315 = gap;\n        local_4 = ((_e310.y - _e312.z) / _e315);\n    } else {\n        let _e317 = c_16;\n        let _e319 = v_5;\n        if (_e317.y == _e319) {\n            let _e322 = c_16;\n            let _e324 = c_16;\n            let _e327 = gap;\n            local_3 = (2f + ((_e322.z - _e324.x) / _e327));\n        } else {\n            let _e331 = c_16;\n            let _e333 = c_16;\n            let _e336 = gap;\n            local_3 = (4f + ((_e331.x - _e333.y) / _e336));\n        }\n        let _e340 = local_3;\n        local_4 = _e340;\n    }\n    let _e342 = local_4;\n    h_3 = _e342;\n    let _e344 = h_3;\n    if (_e344 < 0f) {\n        let _e347 = h_3;\n        h_3 = (_e347 + 6f);\n    }\n    let _e350 = h_3;\n    let _e351 = gap;\n    let _e352 = v_5;\n    let _e354 = v_5;\n    return vec3<f32>(_e350, (_e351 / _e352), _e354);\n}\n\nfn hsv6ToRgb(c_17: vec3<f32>) -> vec3<f32> {\n    var c_18: vec3<f32>;\n    var h_4: f32;\n    var s_3: f32;\n    var v_6: f32;\n    var i: f32;\n    var f: f32;\n    var p_7: f32;\n    var q: f32;\n    var t_3: f32;\n\n    c_18 = c_17;\n    let _e279 = c_18;\n    h_4 = (_e279.x - (floor((_e279.x / 6f)) * 6f));\n    let _e287 = c_18;\n    s_3 = _e287.y;\n    let _e290 = c_18;\n    v_6 = _e290.z;\n    let _e293 = s_3;\n    if (_e293 <= 0f) {\n        let _e296 = v_6;\n        return vec3(_e296);\n    }\n    let _e298 = h_4;\n    i = floor(_e298);\n    let _e301 = h_4;\n    let _e302 = i;\n    f = (_e301 - _e302);\n    let _e305 = v_6;\n    let _e307 = s_3;\n    p_7 = (_e305 * (1f - _e307));\n    let _e311 = v_6;\n    let _e313 = s_3;\n    let _e314 = f;\n    q = (_e311 * (1f - (_e313 * _e314)));\n    let _e319 = v_6;\n    let _e321 = s_3;\n    let _e323 = f;\n    t_3 = (_e319 * (1f - (_e321 * (1f - _e323))));\n    let _e329 = i;\n    if (_e329 < 1f) {\n        let _e332 = v_6;\n        let _e333 = t_3;\n        let _e334 = p_7;\n        return vec3<f32>(_e332, _e333, _e334);\n    }\n    let _e336 = i;\n    if (_e336 < 2f) {\n        let _e339 = q;\n        let _e340 = v_6;\n        let _e341 = p_7;\n        return vec3<f32>(_e339, _e340, _e341);\n    }\n    let _e343 = i;\n    if (_e343 < 3f) {\n        let _e346 = p_7;\n        let _e347 = v_6;\n        let _e348 = t_3;\n        return vec3<f32>(_e346, _e347, _e348);\n    }\n    let _e350 = i;\n    if (_e350 < 4f) {\n        let _e353 = p_7;\n        let _e354 = q;\n        let _e355 = v_6;\n        return vec3<f32>(_e353, _e354, _e355);\n    }\n    let _e357 = i;\n    if (_e357 < 5f) {\n        let _e360 = t_3;\n        let _e361 = p_7;\n        let _e362 = v_6;\n        return vec3<f32>(_e360, _e361, _e362);\n    }\n    let _e364 = v_6;\n    let _e365 = p_7;\n    let _e366 = q;\n    return vec3<f32>(_e364, _e365, _e366);\n}\n\nfn encS1_(x_18: f32) -> f32 {\n    var x_19: f32;\n    var local_5: f32;\n\n    x_19 = x_18;\n    let _e279 = x_19;\n    if (_e279 <= 0.0031308f) {\n        let _e282 = x_19;\n        local_5 = (_e282 * 12.92f);\n    } else {\n        let _e286 = x_19;\n        local_5 = ((1.055f * pow(_e286, 0.41666666f)) - 0.055f);\n    }\n    let _e295 = local_5;\n    return _e295;\n}\n\nfn decS1_(x_20: f32) -> f32 {\n    var x_21: f32;\n    var local_6: f32;\n\n    x_21 = x_20;\n    let _e279 = x_21;\n    if (_e279 <= 0.04045f) {\n        let _e282 = x_21;\n        local_6 = (_e282 / 12.92f);\n    } else {\n        let _e285 = x_21;\n        local_6 = pow(((_e285 + 0.055f) / 1.055f), 2.4f);\n    }\n    let _e293 = local_6;\n    return _e293;\n}\n\nfn hsmAt(t_4: texture_2d<f32>, hues: i32, v_7: i32, h_5: i32, s_4: i32) -> vec3<f32> {\n    var hues_1: i32;\n    var v_8: i32;\n    var h_6: i32;\n    var s_5: i32;\n\n    hues_1 = hues;\n    v_8 = v_7;\n    h_6 = h_5;\n    s_5 = s_4;\n    let _e286 = s_5;\n    let _e287 = v_8;\n    let _e288 = hues_1;\n    let _e290 = h_6;\n    let _e294 = textureLoad(t_4, vec2<i32>(_e286, ((_e287 * _e288) + _e290)), 0i);\n    return _e294.xyz;\n}\n\nfn hueSatMap(t_5: texture_2d<f32>, dims: vec4<f32>, rgb: vec3<f32>) -> vec3<f32> {\n    var dims_1: vec4<f32>;\n    var rgb_1: vec3<f32>;\n    var hues_2: i32;\n    var sats: i32;\n    var vals: i32;\n    var c_19: vec3<f32>;\n    var enc: bool;\n    var local_7: f32;\n    var ve: f32;\n    var local_8: f32;\n    var hS: f32;\n    var sS: f32;\n    var h0_: i32;\n    var h1_: i32;\n    var s0_: i32;\n    var hf: f32;\n    var sf: f32;\n    var d_5: vec3<f32>;\n    var vS: f32;\n    var v0_: i32;\n    var vf: f32;\n    var a_3: vec3<f32>;\n    var b: vec3<f32>;\n    var local_9: f32;\n\n    dims_1 = dims;\n    rgb_1 = rgb;\n    let _e282 = dims_1;\n    hues_2 = i32(_e282.x);\n    let _e286 = dims_1;\n    sats = i32(_e286.y);\n    let _e290 = dims_1;\n    vals = i32(_e290.z);\n    let _e294 = rgb_1;\n    let _e295 = rgbToHsv6_(_e294);\n    c_19 = _e295;\n    let _e297 = dims_1;\n    let _e301 = c_19;\n    enc = ((_e297.w > 0.5f) && (_e301.z <= 1f));\n    let _e307 = enc;\n    if _e307 {\n        let _e308 = c_19;\n        let _e310 = encS1_(_e308.z);\n        local_7 = _e310;\n    } else {\n        let _e311 = c_19;\n        local_7 = _e311.z;\n    }\n    let _e314 = local_7;\n    ve = _e314;\n    let _e316 = hues_2;\n    if (_e316 < 2i) {\n        local_8 = 0f;\n    } else {\n        let _e320 = c_19;\n        let _e322 = hues_2;\n        local_8 = ((_e320.x * f32(_e322)) / 6f);\n    }\n    let _e328 = local_8;\n    hS = _e328;\n    let _e330 = c_19;\n    let _e332 = sats;\n    sS = (_e330.y * f32((_e332 - 1i)));\n    let _e338 = hS;\n    h0_ = i32(_e338);\n    let _e341 = h0_;\n    h1_ = (_e341 + 1i);\n    let _e345 = sS;\n    let _e347 = sats;\n    s0_ = min(i32(_e345), (_e347 - 2i));\n    let _e352 = h0_;\n    let _e353 = hues_2;\n    if (_e352 >= (_e353 - 1i)) {\n        {\n            let _e357 = hues_2;\n            h0_ = (_e357 - 1i);\n            h1_ = 0i;\n        }\n    }\n    let _e361 = hS;\n    let _e362 = h0_;\n    hf = (_e361 - f32(_e362));\n    let _e366 = sS;\n    let _e367 = s0_;\n    sf = (_e366 - f32(_e367));\n    let _e372 = vals;\n    if (_e372 < 2i) {\n        {\n            let _e375 = hues_2;\n            let _e377 = h0_;\n            let _e378 = s0_;\n            let _e379 = hsmAt(t_5, _e375, 0i, _e377, _e378);\n            let _e380 = hues_2;\n            let _e382 = h1_;\n            let _e383 = s0_;\n            let _e384 = hsmAt(t_5, _e380, 0i, _e382, _e383);\n            let _e385 = hf;\n            let _e388 = hues_2;\n            let _e390 = h0_;\n            let _e391 = s0_;\n            let _e394 = hsmAt(t_5, _e388, 0i, _e390, (_e391 + 1i));\n            let _e395 = hues_2;\n            let _e397 = h1_;\n            let _e398 = s0_;\n            let _e401 = hsmAt(t_5, _e395, 0i, _e397, (_e398 + 1i));\n            let _e402 = hf;\n            let _e405 = sf;\n            d_5 = mix(mix(_e379, _e384, vec3(_e385)), mix(_e394, _e401, vec3(_e402)), vec3(_e405));\n        }\n    } else {\n        {\n            let _e408 = ve;\n            let _e412 = vals;\n            vS = (clamp(_e408, 0f, 1f) * f32((_e412 - 1i)));\n            let _e418 = vS;\n            let _e420 = vals;\n            v0_ = min(i32(_e418), (_e420 - 2i));\n            let _e425 = vS;\n            let _e426 = v0_;\n            vf = (_e425 - f32(_e426));\n            let _e430 = hues_2;\n            let _e431 = v0_;\n            let _e432 = h0_;\n            let _e433 = s0_;\n            let _e434 = hsmAt(t_5, _e430, _e431, _e432, _e433);\n            let _e435 = hues_2;\n            let _e436 = v0_;\n            let _e437 = h1_;\n            let _e438 = s0_;\n            let _e439 = hsmAt(t_5, _e435, _e436, _e437, _e438);\n            let _e440 = hf;\n            let _e443 = hues_2;\n            let _e444 = v0_;\n            let _e445 = h0_;\n            let _e446 = s0_;\n            let _e449 = hsmAt(t_5, _e443, _e444, _e445, (_e446 + 1i));\n            let _e450 = hues_2;\n            let _e451 = v0_;\n            let _e452 = h1_;\n            let _e453 = s0_;\n            let _e456 = hsmAt(t_5, _e450, _e451, _e452, (_e453 + 1i));\n            let _e457 = hf;\n            let _e460 = sf;\n            a_3 = mix(mix(_e434, _e439, vec3(_e440)), mix(_e449, _e456, vec3(_e457)), vec3(_e460));\n            let _e464 = hues_2;\n            let _e465 = v0_;\n            let _e468 = h0_;\n            let _e469 = s0_;\n            let _e470 = hsmAt(t_5, _e464, (_e465 + 1i), _e468, _e469);\n            let _e471 = hues_2;\n            let _e472 = v0_;\n            let _e475 = h1_;\n            let _e476 = s0_;\n            let _e477 = hsmAt(t_5, _e471, (_e472 + 1i), _e475, _e476);\n            let _e478 = hf;\n            let _e481 = hues_2;\n            let _e482 = v0_;\n            let _e485 = h0_;\n            let _e486 = s0_;\n            let _e489 = hsmAt(t_5, _e481, (_e482 + 1i), _e485, (_e486 + 1i));\n            let _e490 = hues_2;\n            let _e491 = v0_;\n            let _e494 = h1_;\n            let _e495 = s0_;\n            let _e498 = hsmAt(t_5, _e490, (_e491 + 1i), _e494, (_e495 + 1i));\n            let _e499 = hf;\n            let _e502 = sf;\n            b = mix(mix(_e470, _e477, vec3(_e478)), mix(_e489, _e498, vec3(_e499)), vec3(_e502));\n            let _e506 = a_3;\n            let _e507 = b;\n            let _e508 = vf;\n            d_5 = mix(_e506, _e507, vec3(_e508));\n        }\n    }\n    let _e512 = c_19;\n    let _e514 = d_5;\n    c_19.x = (_e512.x + (_e514.x * 0.016666668f));\n    let _e522 = c_19;\n    let _e524 = d_5;\n    c_19.y = min((_e522.y * _e524.y), 1f);\n    let _e529 = ve;\n    let _e530 = d_5;\n    ve = (_e529 * _e530.z);\n    let _e533 = c_19;\n    if (_e533.z <= 1f) {\n        let _e537 = ve;\n        ve = clamp(_e537, 0f, 1f);\n    }\n    let _e542 = enc;\n    if _e542 {\n        let _e543 = ve;\n        let _e544 = decS1_(_e543);\n        local_9 = _e544;\n    } else {\n        let _e545 = ve;\n        local_9 = _e545;\n    }\n    let _e547 = local_9;\n    c_19.z = _e547;\n    let _e548 = c_19;\n    let _e549 = hsv6ToRgb(_e548);\n    return _e549;\n}\n\nfn toneAt(x_22: f32) -> f32 {\n    var x_23: f32;\n    var n: i32;\n    var p_8: f32;\n    var i_1: i32;\n\n    x_23 = x_22;\n    let _e280 = textureDimensions(uTone, 0i);\n    n = vec2<i32>(_e280).x;\n    let _e284 = x_23;\n    let _e288 = n;\n    p_8 = (clamp(_e284, 0f, 1f) * f32((_e288 - 1i)));\n    let _e294 = p_8;\n    let _e296 = n;\n    i_1 = min(i32(_e294), (_e296 - 2i));\n    let _e301 = i_1;\n    let _e305 = textureLoad(uTone, vec2<i32>(_e301, 0i), 0i);\n    let _e307 = i_1;\n    let _e313 = textureLoad(uTone, vec2<i32>((_e307 + 1i), 0i), 0i);\n    let _e315 = p_8;\n    let _e316 = i_1;\n    return mix(_e305.x, _e313.x, (_e315 - f32(_e316)));\n}\n\nfn rgbTone(c_20: vec3<f32>) -> vec3<f32> {\n    var c_21: vec3<f32>;\n    var mx_2: f32;\n    var mn_2: f32;\n    var tmx: f32;\n    var tmn: f32;\n\n    c_21 = c_20;\n    let _e279 = c_21;\n    c_21 = clamp(_e279, vec3(0f), vec3(1f));\n    let _e285 = c_21;\n    let _e287 = c_21;\n    let _e289 = c_21;\n    mx_2 = max(_e285.x, max(_e287.y, _e289.z));\n    let _e294 = c_21;\n    let _e296 = c_21;\n    let _e298 = c_21;\n    mn_2 = min(_e294.x, min(_e296.y, _e298.z));\n    let _e303 = mx_2;\n    let _e304 = toneAt(_e303);\n    tmx = _e304;\n    let _e306 = mn_2;\n    let _e307 = toneAt(_e306);\n    tmn = _e307;\n    let _e309 = mx_2;\n    let _e310 = mn_2;\n    if ((_e309 - _e310) <= 0f) {\n        let _e314 = tmx;\n        return vec3(_e314);\n    }\n    let _e316 = tmn;\n    let _e317 = tmx;\n    let _e318 = tmn;\n    let _e320 = c_21;\n    let _e321 = mn_2;\n    let _e325 = mx_2;\n    let _e326 = mn_2;\n    return (vec3(_e316) + (((_e317 - _e318) * (_e320 - vec3(_e321))) / vec3((_e325 - _e326))));\n}\n\nfn easeWhite(x_24: vec3<f32>) -> vec3<f32> {\n    var x_25: vec3<f32>;\n    var k_7: f32 = 0.95f;\n\n    x_25 = x_24;\n    let _e281 = x_25;\n    let _e282 = k_7;\n    let _e284 = k_7;\n    let _e287 = x_25;\n    let _e288 = k_7;\n    let _e293 = k_7;\n    let _e303 = k_7;\n    let _e304 = x_25;\n    return mix(_e281, (vec3(_e282) + ((1f - _e284) * (vec3(1f) - exp((-((_e287 - vec3(_e288))) / vec3((1f - _e293))))))), step(vec3(_e303), _e304));\n}\n\nfn disp(y_2: f32) -> f32 {\n    var y_3: f32;\n    var local_10: f32;\n\n    y_3 = y_2;\n    let _e279 = y_3;\n    y_3 = max(_e279, 0f);\n    let _e282 = global.uDcp;\n    let _e285 = global.uToneMap;\n    if ((_e282 > 0.5f) && (_e285 < 0.5f)) {\n        let _e289 = y_3;\n        let _e290 = toneAt(_e289);\n        let _e291 = encS1_(_e290);\n        local_10 = _e291;\n    } else {\n        let _e292 = y_3;\n        let _e293 = shoulder1_(_e292);\n        let _e295 = encode(vec3(_e293));\n        local_10 = _e295.x;\n    }\n    let _e298 = local_10;\n    return _e298;\n}\n\nfn intoRange(lin_2: vec3<f32>) -> vec3<f32> {\n    var lin_3: vec3<f32>;\n    var y_4: f32;\n    var mn_3: f32;\n    var local_11: vec3<f32>;\n\n    lin_3 = lin_2;\n    let _e279 = lin_3;\n    y_4 = dot(_e279, W709_);\n    let _e282 = lin_3;\n    let _e284 = lin_3;\n    let _e286 = lin_3;\n    mn_3 = min(_e282.x, min(_e284.y, _e286.z));\n    let _e291 = mn_3;\n    if (_e291 < 0f) {\n        let _e294 = y_4;\n        if (_e294 > 0f) {\n            let _e297 = y_4;\n            let _e298 = lin_3;\n            let _e299 = y_4;\n            let _e302 = y_4;\n            let _e303 = y_4;\n            let _e304 = mn_3;\n            local_11 = (vec3(_e297) + ((_e298 - vec3(_e299)) * (_e302 / ((_e303 - _e304) + 0.000001f))));\n        } else {\n            local_11 = vec3(0f);\n        }\n        let _e315 = local_11;\n        lin_3 = _e315;\n    }\n    let _e316 = lin_3;\n    return max(_e316, vec3(0f));\n}\n\nfn hash(q_1: vec2<f32>) -> f32 {\n    var q_2: vec2<f32>;\n\n    q_2 = q_1;\n    let _e279 = q_2;\n    return fract((sin(dot(_e279, vec2<f32>(127.1f, 311.7f))) * 43758.547f));\n}\n\nfn vnoise(q_3: vec2<f32>) -> f32 {\n    var q_4: vec2<f32>;\n    var i_2: vec2<f32>;\n    var f_1: vec2<f32>;\n\n    q_4 = q_3;\n    let _e279 = q_4;\n    i_2 = floor(_e279);\n    let _e282 = q_4;\n    f_1 = fract(_e282);\n    let _e285 = f_1;\n    let _e286 = f_1;\n    let _e290 = f_1;\n    f_1 = ((_e285 * _e286) * (vec2(3f) - (2f * _e290)));\n    let _e295 = i_2;\n    let _e296 = hash(_e295);\n    let _e297 = i_2;\n    let _e302 = hash((_e297 + vec2<f32>(1f, 0f)));\n    let _e303 = f_1;\n    let _e306 = i_2;\n    let _e311 = hash((_e306 + vec2<f32>(0f, 1f)));\n    let _e312 = i_2;\n    let _e316 = hash((_e312 + vec2(1f)));\n    let _e317 = f_1;\n    let _e320 = f_1;\n    return mix(mix(_e296, _e302, _e303.x), mix(_e311, _e316, _e317.x), _e320.y);\n}\n\nfn main_1() {\n    var local_12: f32;\n    var cq: vec2<f32>;\n    var ori: vec2<f32>;\n    var n_1: vec2<f32>;\n    var hn: vec3<f32>;\n    var r2_: f32;\n    var p_9: vec2<f32>;\n    var lv: vec2<f32>;\n    var lr2_: f32;\n    var lin_4: vec3<f32>;\n    var lin0_: vec3<f32>;\n    var LA: vec4<f32> = vec4(0f);\n    var LB: vec4<f32> = vec4(0f);\n    var LC: vec4<f32> = vec4(0f);\n    var LD: vec4<f32> = vec4(0f);\n    var LE: vec4<f32> = vec4(0f);\n    var LF: vec4<f32> = vec4(0f);\n    var LG: f32 = 0f;\n    var mw: array<f32, 16>;\n    var i_3: i32 = 0i;\n    var shownW: f32 = 0f;\n    var muv: vec2<f32>;\n    var m0_: vec4<f32>;\n    var local_13: vec4<f32>;\n    var m1_1: vec4<f32>;\n    var local_14: vec4<f32>;\n    var m2_1: vec4<f32>;\n    var local_15: vec4<f32>;\n    var m3_: vec4<f32>;\n    var yl: f32;\n    var i_4: i32 = 0i;\n    var local_16: f32;\n    var local_17: f32;\n    var local_18: f32;\n    var w_1: f32;\n    var r_2: vec4<f32>;\n    var sm: f32;\n    var nrLum: f32;\n    var nrColor: f32;\n    var exposure: f32;\n    var highlights: f32;\n    var shadows: f32;\n    var whites: f32;\n    var blacks: f32;\n    var texAmt: f32;\n    var clarity: f32;\n    var dehaze: f32;\n    var sharpen: f32;\n    var y0_: f32;\n    var lsum: vec3<f32>;\n    var lw: f32 = 1f;\n    var csum: vec3<f32>;\n    var cw: f32 = 1f;\n    var sigma: f32;\n    var cr: f32;\n    var i_5: i32 = 0i;\n    var a_4: f32;\n    var dir: vec2<f32>;\n    var n1_: vec3<f32>;\n    var y1_1: f32;\n    var d_6: f32;\n    var w_2: f32;\n    var n2_: vec3<f32>;\n    var n3_: vec3<f32>;\n    var yl_1: f32;\n    var yb: f32;\n    var w_3: f32;\n    var w_4: f32;\n    var yb_1: f32;\n    var y0_1: f32;\n    var l0_: f32;\n    var g_1: vec2<f32>;\n    var dEdge: f32;\n    var base: f32;\n    var detail: f32;\n    var bd: f32;\n    var shLift: f32 = 0f;\n    var lw_1: f32;\n    var dl: f32;\n    var bw: f32;\n    var mid_1: f32;\n    var l1_: f32;\n    var th: f32;\n    var local_19: f32;\n    var hp: f32;\n    var limit: f32;\n    var edge: f32;\n    var local_20: f32;\n    var mask: f32;\n    var fine: f32;\n    var ys: f32;\n    var air: f32;\n    var haze: f32;\n    var t_6: f32;\n    var local_21: f32;\n    var glowAmt: f32;\n    var local_22: vec3<f32>;\n    var gl: vec3<f32>;\n    var lc: vec3<f32>;\n    var w_5: f32;\n    var mapped: vec3<f32>;\n    var pp_3: vec3<f32>;\n    var local_23: vec3<f32>;\n    var local_24: vec3<f32>;\n    var local_25: vec3<f32>;\n    var d_7: vec3<f32>;\n    var dl_1: vec3<f32>;\n    var yg: f32;\n    var ga: vec3<f32>;\n    var e_1: f32;\n    var spill: vec3<f32>;\n    var yp: f32;\n    var y_5: f32;\n    var y2_1: f32;\n    var q_5: f32;\n    var dk: f32;\n    var local_26: f32;\n    var local_27: vec3<f32>;\n    var local_28: vec3<f32>;\n    var ck: f32;\n    var hi_1: f32;\n    var lo_1: f32;\n    var hi2_: f32;\n    var lo2_: f32;\n    var local_29: vec3<f32>;\n    var ck_1: f32;\n    var kl: f32;\n    var y_6: f32;\n    var y2_2: f32;\n    var local_30: vec3<f32>;\n    var dl_2: vec3<f32>;\n    var hi_2: f32;\n    var lo_2: f32;\n    var hi2_1: f32;\n    var lo2_1: f32;\n    var local_31: vec3<f32>;\n    var dh: vec3<f32>;\n    var cs: f32;\n    var yc: f32;\n    var mx_3: f32;\n    var local_32: f32;\n    var sv: f32;\n    var dc: vec3<f32>;\n    var hi_3: f32;\n    var lo_3: f32;\n    var hi2_2: f32;\n    var lo2_2: f32;\n    var local_33: vec3<f32>;\n    var yc0_: f32;\n    var yc_1: f32;\n    var i_6: i32 = 0i;\n    var row: f32;\n    var c_22: vec3<f32>;\n    var yc0_1: f32;\n    var yc_2: f32;\n    var h_7: vec3<f32>;\n    var chroma_1: f32;\n    var pp_4: vec3<f32>;\n    var q_6: vec3<f32>;\n    var adj: vec4<f32>;\n    var local_34: f32;\n    var local_35: f32;\n    var sv_1: f32;\n    var ps: f32;\n    var local_36: f32;\n    var local_37: f32;\n    var f_2: f32;\n    var o_2: vec3<f32>;\n    var yt: f32;\n    var pointShow: f32 = -1f;\n    var i_7: i32 = 0i;\n    var hp_1: vec3<f32>;\n    var dh_1: f32;\n    var dist_1: f32;\n    var width: f32;\n    var near: f32;\n    var k_8: f32;\n    var yp_1: f32;\n    var edge_1: f32;\n    var hd: vec3<f32>;\n    var purple: f32;\n    var green: f32;\n    var k_9: f32;\n    var yk: f32;\n    var yb_2: f32;\n    var lk: f32;\n    var bl: f32;\n    var up: f32;\n    var c_23: f32;\n    var local_38: f32;\n    var w_6: f32;\n    var sh_1: f32;\n    var hi_4: f32;\n    var mi: f32;\n    var dd: vec3<f32>;\n    var lum: f32;\n    var local_39: vec3<f32>;\n    var q_7: vec2<f32>;\n    var r_3: f32;\n    var local_40: vec2<f32>;\n    var qs: vec2<f32>;\n    var pw_1: f32;\n    var dist_2: f32;\n    var m0_1: f32;\n    var f_3: f32;\n    var mask_1: f32;\n    var amt: f32;\n    var local_41: vec3<f32>;\n    var d0_: vec3<f32>;\n    var local_42: vec3<f32>;\n    var grainAmt: f32;\n    var t_7: f32;\n    var size: f32;\n    var rough: f32;\n    var g_2: vec2<f32>;\n    var nz: f32;\n    var yg_1: f32;\n    var local_43: vec3<f32>;\n    var fw: f32;\n    var edge_2: f32;\n    var soft: f32;\n    var lines: f32;\n\n    let _e278 = gl_FragCoord_1;\n    let _e280 = global.frFlip;\n    if (_e280 > 0.5f) {\n        let _e283 = global.frH;\n        let _e284 = gl_FragCoord_1;\n        local_12 = (_e283 - _e284.y);\n    } else {\n        let _e287 = gl_FragCoord_1;\n        local_12 = _e287.y;\n    }\n    let _e290 = local_12;\n    let _e291 = gl_FragCoord_1;\n    let _e292 = _e291.zw;\n    frFC = vec4<f32>(_e278.x, _e290, _e292.x, _e292.y);\n    let _e296 = global.uOut2Crop;\n    let _e297 = frFC;\n    let _e298 = _e297.xy;\n    cq = (_e296 * vec3<f32>(_e298.x, _e298.y, 1f)).xy;\n    let _e306 = cq;\n    let _e311 = cq;\n    if ((abs(_e306.x) > 1.001f) || (abs(_e311.y) > 1.001f)) {\n        {\n            let _e317 = global.uBg;\n            o_3 = vec4<f32>(_e317.x, _e317.y, _e317.z, 1f);\n            return;\n        }\n    }\n    let _e323 = global.uOut2Ori;\n    let _e324 = frFC;\n    let _e325 = _e324.xy;\n    ori = (_e323 * vec3<f32>(_e325.x, _e325.y, 1f)).xy;\n    let _e333 = ori;\n    let _e334 = global.uOriCenter;\n    let _e336 = global.uOriHalf;\n    n_1 = ((_e333 - _e334) / vec2(_e336));\n    let _e340 = global.uPersp;\n    let _e341 = n_1;\n    hn = (_e340 * vec3<f32>(_e341.x, _e341.y, 1f));\n    let _e348 = hn;\n    let _e350 = hn;\n    n_1 = (_e348.xy / vec2(_e350.z));\n    let _e354 = n_1;\n    let _e355 = n_1;\n    let _e357 = global.uCornerR2_;\n    r2_ = (dot(_e354, _e355) / _e357);\n    let _e360 = n_1;\n    let _e362 = global.uDistort;\n    let _e363 = r2_;\n    n_1 = (_e360 * (1f - (_e362 * _e363)));\n    let _e367 = global.uOri2Photo;\n    let _e368 = n_1;\n    let _e369 = global.uOriHalf;\n    let _e371 = global.uOriCenter;\n    let _e372 = ((_e368 * _e369) + _e371);\n    p_9 = (_e367 * vec3<f32>(_e372.x, _e372.y, 1f)).xy;\n    let _e380 = p_9;\n    let _e381 = global.uLensC;\n    let _e383 = global.uLensN;\n    lv = ((_e380 - _e381) * _e383);\n    let _e386 = lv;\n    let _e387 = lv;\n    lr2_ = dot(_e386, _e387);\n    let _e390 = global.uLensC;\n    let _e391 = p_9;\n    let _e392 = global.uLensC;\n    let _e395 = lr2_;\n    let _e396 = global.uLensK;\n    let _e398 = lr2_;\n    let _e399 = global.uLensK;\n    let _e401 = lr2_;\n    let _e402 = global.uLensK;\n    let _e411 = global.uLensK;\n    p_9 = (_e390 + (((_e391 - _e392) * (1f + (_e395 * (_e396.x + (_e398 * (_e399.y + (_e401 * _e402.z))))))) * _e411.w));\n    let _e415 = hn;\n    let _e419 = p_9;\n    let _e424 = p_9;\n    let _e429 = p_9;\n    let _e434 = p_9;\n    if (((((_e415.z <= 0f) || (_e419.x < 0f)) || (_e424.y < 0f)) || (_e429.x > 1f)) || (_e434.y > 1f)) {\n        {\n            let _e439 = global.uBg;\n            o_3 = vec4<f32>(_e439.x, _e439.y, _e439.z, 1f);\n            return;\n        }\n    }\n    let _e445 = p_9;\n    let _e446 = cam_2(_e445);\n    let _e447 = toLinear(_e446);\n    lin_4 = _e447;\n    let _e449 = lin_4;\n    lin0_ = _e449;\n    loop {\n        let _e474 = i_3;\n        if !((_e474 < 16i)) {\n            break;\n        }\n        let _e481 = i_3;\n        mw[_e481] = 0f;\n        continuing {\n            let _e478 = i_3;\n            i_3 = (_e478 + 1i);\n        }\n    }\n    let _e486 = global.uMaskN;\n    if (_e486 > 0f) {\n        {\n            let _e489 = ori;\n            let _e490 = global.uOriSize;\n            muv = (_e489 / _e490);\n            let _e493 = muv;\n            let _e494 = textureSample(uMask0_, uMask0_s, _e493);\n            m0_ = _e494;\n            let _e496 = global.uMaskN;\n            if (_e496 > 4f) {\n                let _e499 = muv;\n                let _e500 = textureSample(uMask1_, uMask1_s, _e499);\n                local_13 = _e500;\n            } else {\n                local_13 = vec4(0f);\n            }\n            let _e504 = local_13;\n            m1_1 = _e504;\n            let _e506 = global.uMaskN;\n            if (_e506 > 8f) {\n                let _e509 = muv;\n                let _e510 = textureSample(uMask2_, uMask2_s, _e509);\n                local_14 = _e510;\n            } else {\n                local_14 = vec4(0f);\n            }\n            let _e514 = local_14;\n            m2_1 = _e514;\n            let _e516 = global.uMaskN;\n            if (_e516 > 12f) {\n                let _e519 = muv;\n                let _e520 = textureSample(uMask3_, uMask3_s, _e519);\n                local_15 = _e520;\n            } else {\n                local_15 = vec4(0f);\n            }\n            let _e524 = local_15;\n            m3_ = _e524;\n            let _e526 = lin0_;\n            let _e528 = global.uExposure;\n            let _e531 = disp((dot(_e526, W709_) * exp2(_e528)));\n            yl = _e531;\n            loop {\n                let _e535 = i_4;\n                if !((_e535 < 16i)) {\n                    break;\n                }\n                {\n                    let _e542 = i_4;\n                    let _e544 = global.uMaskN;\n                    if (f32(_e542) >= _e544) {\n                        break;\n                    }\n                    let _e546 = i_4;\n                    if (_e546 < 4i) {\n                        let _e549 = i_4;\n                        let _e551 = m0_[_e549];\n                        local_18 = _e551;\n                    } else {\n                        let _e552 = i_4;\n                        if (_e552 < 8i) {\n                            let _e555 = i_4;\n                            let _e559 = m1_1[(_e555 - 4i)];\n                            local_17 = _e559;\n                        } else {\n                            let _e560 = i_4;\n                            if (_e560 < 12i) {\n                                let _e563 = i_4;\n                                let _e567 = m2_1[(_e563 - 8i)];\n                                local_16 = _e567;\n                            } else {\n                                let _e568 = i_4;\n                                let _e572 = m3_[(_e568 - 12i)];\n                                local_16 = _e572;\n                            }\n                            let _e574 = local_16;\n                            local_17 = _e574;\n                        }\n                        let _e576 = local_17;\n                        local_18 = _e576;\n                    }\n                    let _e578 = local_18;\n                    w_1 = _e578;\n                    let _e580 = i_4;\n                    let _e582 = global.uMR[_e580];\n                    r_2 = _e582;\n                    let _e584 = r_2;\n                    if ((_e584.w - (floor((_e584.w / 2f)) * 2f)) >= 1f) {\n                        {\n                            let _e593 = r_2;\n                            sm = max((_e593.z * 0.5f), 0.004f);\n                            let _e600 = w_1;\n                            let _e601 = r_2;\n                            let _e603 = sm;\n                            let _e605 = r_2;\n                            let _e607 = yl;\n                            let _e610 = r_2;\n                            let _e612 = r_2;\n                            let _e614 = sm;\n                            let _e616 = yl;\n                            w_1 = (_e600 * (smoothstep((_e601.x - _e603), _e605.x, _e607) * (1f - smoothstep(_e610.y, (_e612.y + _e614), _e616))));\n                        }\n                    }\n                    let _e621 = r_2;\n                    if (_e621.w >= 2f) {\n                        let _e626 = w_1;\n                        w_1 = (1f - _e626);\n                    }\n                    let _e628 = i_4;\n                    let _e630 = global.uMaskView;\n                    if (f32(_e628) == _e630) {\n                        let _e632 = w_1;\n                        shownW = _e632;\n                    }\n                    let _e633 = w_1;\n                    let _e634 = i_4;\n                    let _e636 = global.uMD[_e634];\n                    w_1 = (_e633 * _e636.w);\n                    let _e639 = i_4;\n                    let _e641 = w_1;\n                    mw[_e639] = _e641;\n                    let _e642 = LG;\n                    let _e643 = i_4;\n                    let _e645 = global.uMS[_e643];\n                    let _e647 = w_1;\n                    LG = (_e642 + (_e645.w * _e647));\n                    let _e650 = LA;\n                    let _e651 = i_4;\n                    let _e653 = global.uMA[_e651];\n                    let _e654 = w_1;\n                    LA = (_e650 + (_e653 * _e654));\n                    let _e657 = LB;\n                    let _e658 = i_4;\n                    let _e660 = global.uMB[_e658];\n                    let _e661 = w_1;\n                    LB = (_e657 + (_e660 * _e661));\n                    let _e664 = LC;\n                    let _e665 = i_4;\n                    let _e667 = global.uMC[_e665];\n                    let _e668 = w_1;\n                    LC = (_e664 + (_e667 * _e668));\n                    let _e671 = LD;\n                    let _e672 = i_4;\n                    let _e674 = global.uMD[_e672];\n                    let _e675 = w_1;\n                    LD = (_e671 + (_e674 * _e675));\n                    let _e678 = LE;\n                    let _e679 = i_4;\n                    let _e681 = global.uME[_e679];\n                    let _e682 = w_1;\n                    LE = (_e678 + (_e681 * _e682));\n                    let _e685 = LF;\n                    let _e686 = i_4;\n                    let _e688 = global.uMF[_e686];\n                    let _e689 = w_1;\n                    LF = (_e685 + (_e688 * _e689));\n                }\n                continuing {\n                    let _e539 = i_4;\n                    i_4 = (_e539 + 1i);\n                }\n            }\n        }\n    }\n    let _e692 = global.uNrLum;\n    let _e693 = LD;\n    nrLum = clamp((_e692 + _e693.z), 0f, 1f);\n    let _e700 = global.uNrColor;\n    let _e701 = LE;\n    nrColor = clamp((_e700 + _e701.w), 0f, 1f);\n    let _e708 = global.uExposure;\n    let _e709 = LA;\n    exposure = (_e708 + _e709.x);\n    let _e713 = global.uHighlights;\n    let _e714 = LA;\n    highlights = (_e713 + _e714.z);\n    let _e718 = global.uShadows;\n    let _e719 = LA;\n    shadows = (_e718 + _e719.w);\n    let _e723 = global.uWhites;\n    let _e724 = LB;\n    whites = (_e723 + _e724.x);\n    let _e728 = global.uBlacks;\n    let _e729 = LB;\n    blacks = (_e728 + _e729.y);\n    let _e733 = global.uTexture;\n    let _e734 = LB;\n    texAmt = (_e733 + _e734.z);\n    let _e738 = global.uClarity;\n    let _e739 = LB;\n    clarity = (_e738 + _e739.w);\n    let _e743 = global.uDehaze;\n    let _e744 = LC;\n    dehaze = clamp((_e743 + _e744.x), -1f, 1f);\n    let _e752 = global.uSharpen;\n    let _e753 = LD;\n    sharpen = (_e752 + (_e753.y * 1.1f));\n    let _e759 = nrLum;\n    let _e762 = nrColor;\n    if ((_e759 > 0f) || (_e762 > 0f)) {\n        {\n            let _e766 = lin_4;\n            y0_ = max(dot(_e766, W709_), 0.00001f);\n            let _e771 = lin_4;\n            lsum = _e771;\n            let _e775 = lin_4;\n            let _e776 = chroma(_e775);\n            csum = _e776;\n            let _e781 = nrLum;\n            let _e786 = global.uNrLumDetail;\n            sigma = ((0.02f + (_e781 * 0.25f)) * (1.5f - _e786));\n            let _e792 = global.uNrColorDetail;\n            cr = (4f * (1.5f - _e792));\n            loop {\n                let _e798 = i_5;\n                if !((_e798 < 8i)) {\n                    break;\n                }\n                {\n                    let _e805 = i_5;\n                    a_4 = (f32(_e805) * 0.785398f);\n                    let _e810 = a_4;\n                    let _e812 = a_4;\n                    dir = vec2<f32>(cos(_e810), sin(_e812));\n                    let _e816 = p_9;\n                    let _e817 = dir;\n                    let _e818 = global.uPhotoPx;\n                    let _e823 = cam_2((_e816 + ((_e817 * _e818) * 1.5f)));\n                    let _e824 = toLinear(_e823);\n                    n1_ = _e824;\n                    let _e826 = n1_;\n                    y1_1 = max(dot(_e826, W709_), 0.00001f);\n                    let _e831 = y1_1;\n                    let _e833 = y0_;\n                    d_6 = (log2(_e831) - log2(_e833));\n                    let _e837 = d_6;\n                    let _e839 = d_6;\n                    let _e842 = sigma;\n                    let _e844 = sigma;\n                    let _e848 = nrLum;\n                    w_2 = (exp(((-(_e837) * _e839) / ((2f * _e842) * _e844))) * _e848);\n                    let _e851 = lsum;\n                    let _e852 = n1_;\n                    let _e853 = w_2;\n                    lsum = (_e851 + (_e852 * _e853));\n                    let _e856 = lw;\n                    let _e857 = w_2;\n                    lw = (_e856 + _e857);\n                    let _e859 = nrColor;\n                    if (_e859 > 0f) {\n                        {\n                            let _e862 = p_9;\n                            let _e863 = dir;\n                            let _e864 = global.uPhotoPx;\n                            let _e866 = cr;\n                            let _e869 = cam_2((_e862 + ((_e863 * _e864) * _e866)));\n                            let _e870 = toLinear(_e869);\n                            n2_ = _e870;\n                            let _e872 = csum;\n                            let _e873 = n2_;\n                            let _e874 = chroma(_e873);\n                            let _e875 = nrColor;\n                            csum = (_e872 + (_e874 * _e875));\n                            let _e878 = cw;\n                            let _e879 = nrColor;\n                            cw = (_e878 + _e879);\n                            let _e881 = global.uNrColorSmooth;\n                            if (_e881 > 0f) {\n                                {\n                                    let _e884 = p_9;\n                                    let _e885 = dir;\n                                    let _e886 = global.uPhotoPx;\n                                    let _e888 = cr;\n                                    let _e893 = cam_2((_e884 + (((_e885 * _e886) * _e888) * 2.5f)));\n                                    let _e894 = toLinear(_e893);\n                                    n3_ = _e894;\n                                    let _e896 = csum;\n                                    let _e897 = n3_;\n                                    let _e898 = chroma(_e897);\n                                    let _e899 = nrColor;\n                                    let _e901 = global.uNrColorSmooth;\n                                    csum = (_e896 + ((_e898 * _e899) * _e901));\n                                    let _e904 = cw;\n                                    let _e905 = nrColor;\n                                    let _e906 = global.uNrColorSmooth;\n                                    cw = (_e904 + (_e905 * _e906));\n                                }\n                            }\n                        }\n                    }\n                }\n                continuing {\n                    let _e802 = i_5;\n                    i_5 = (_e802 + 1i);\n                }\n            }\n            let _e909 = lsum;\n            let _e910 = lw;\n            lin_4 = (_e909 / vec3(_e910));\n            let _e913 = global.uNrLumContrast;\n            if (_e913 > 0f) {\n                let _e916 = lin_4;\n                let _e917 = y0_;\n                let _e919 = lin_4;\n                let _e925 = global.uNrLumContrast;\n                lin_4 = (_e916 * exp2((((log2(_e917) - log2(max(dot(_e919, W709_), 0.00001f))) * _e925) * 0.6f)));\n            }\n            let _e931 = nrColor;\n            if (_e931 > 0f) {\n                {\n                    let _e934 = lin_4;\n                    yl_1 = dot(_e934, W709_);\n                    let _e937 = yl_1;\n                    let _e938 = csum;\n                    let _e939 = cw;\n                    let _e942 = yl_1;\n                    lin_4 = (vec3(_e937) + ((_e938 / vec3(_e939)) * max(_e942, CHROMA_FLOOR)));\n                }\n            }\n        }\n    }\n    let _e947 = global.uDcp;\n    let _e950 = global.uHsmDims;\n    if ((_e947 > 0.5f) && (_e950.x > 0f)) {\n        let _e955 = global.uP2S;\n        let _e956 = global.uHsmDims;\n        let _e957 = global.uS2P;\n        let _e958 = lin_4;\n        let _e963 = hueSatMap(uHsm, _e956, max((_e957 * _e958), vec3(0f)));\n        lin_4 = (_e955 * _e963);\n    }\n    let _e965 = global.uBaseSat;\n    if (_e965 != 1f) {\n        {\n            let _e968 = lin_4;\n            yb = dot(_e968, W709_);\n            let _e971 = yb;\n            let _e972 = lin_4;\n            let _e973 = yb;\n            let _e976 = global.uBaseSat;\n            lin_4 = (vec3(_e971) + ((_e972 - vec3(_e973)) * _e976));\n        }\n    }\n    let _e980 = global.uLensVig;\n    if (_e980 != 0f) {\n        {\n            let _e983 = global.uLensVigMid;\n            let _e987 = r2_;\n            w_3 = smoothstep((_e983 * 0.6f), 1f, sqrt(_e987));\n            let _e991 = lin_4;\n            let _e992 = global.uLensVig;\n            let _e995 = w_3;\n            let _e997 = w_3;\n            lin_4 = (_e991 * exp2((((_e992 * 1.6f) * _e995) * _e997)));\n        }\n    }\n    let _e1001 = global.uShadowTint;\n    if (_e1001 != 0f) {\n        {\n            let _e1007 = lin_4;\n            w_4 = (1f - smoothstep(0f, 0.2f, dot(_e1007, W709_)));\n            let _e1013 = lin_4;\n            let _e1016 = global.uShadowTint;\n            let _e1019 = w_4;\n            lin_4.y = (_e1013.y * (1f - ((_e1016 * 0.18f) * _e1019)));\n        }\n    }\n    let _e1023 = LC;\n    let _e1027 = LC;\n    if ((_e1023.z != 0f) || (_e1027.w != 0f)) {\n        {\n            let _e1032 = lin_4;\n            yb_1 = dot(_e1032, W709_);\n            let _e1035 = lin_4;\n            let _e1036 = LC;\n            let _e1040 = LC;\n            let _e1045 = LC;\n            lin_4 = (_e1035 * exp2(vec3<f32>((_e1036.z * 0.45f), (-(_e1040.w) * 0.35f), (-(_e1045.z) * 0.45f))));\n            let _e1053 = lin_4;\n            let _e1054 = yb_1;\n            let _e1056 = lin_4;\n            lin_4 = (_e1053 * (max(_e1054, CHROMA_FLOOR) / max(dot(_e1056, W709_), CHROMA_FLOOR)));\n        }\n    }\n    let _e1061 = lin_4;\n    y0_1 = max(dot(_e1061, W709_), 0.00001f);\n    let _e1066 = y0_1;\n    l0_ = log2(_e1066);\n    let _e1069 = p_9;\n    let _e1070 = textureSample(uGuide, uGuide_s, _e1069);\n    g_1 = _e1070.xy;\n    let _e1073 = l0_;\n    let _e1074 = g_1;\n    dEdge = (_e1073 - _e1074.x);\n    let _e1078 = g_1;\n    let _e1080 = dEdge;\n    let _e1082 = dEdge;\n    let _e1084 = dEdge;\n    base = (_e1078.x + (_e1080 * (1f - exp(((-(_e1082) * _e1084) / 0.1f)))));\n    let _e1093 = l0_;\n    let _e1094 = base;\n    detail = (_e1093 - _e1094);\n    let _e1097 = base;\n    let _e1098 = exposure;\n    base = (_e1097 + _e1098);\n    let _e1100 = base;\n    let _e1102 = disp(exp2(_e1100));\n    bd = _e1102;\n    let _e1106 = highlights;\n    let _e1109 = shadows;\n    if ((_e1106 != 0f) || (_e1109 != 0f)) {\n        {\n            let _e1114 = p_9;\n            let _e1115 = ring(_e1114, LIFT_R);\n            let _e1116 = p_9;\n            let _e1120 = ring(_e1116, 8f);\n            lw_1 = (0.5f * (_e1115 + _e1120));\n            let _e1124 = l0_;\n            let _e1125 = lw_1;\n            dl = (_e1124 - _e1125);\n            let _e1128 = lw_1;\n            let _e1129 = dl;\n            let _e1131 = dl;\n            let _e1133 = dl;\n            lw_1 = (_e1128 + (_e1129 * (1f - exp(((-(_e1131) * _e1133) / LIFT_EDGE)))));\n            let _e1140 = lw_1;\n            let _e1141 = exposure;\n            let _e1144 = disp(exp2((_e1140 + _e1141)));\n            bw = _e1144;\n            let _e1146 = base;\n            let _e1147 = highlights;\n            let _e1150 = bw;\n            let _e1154 = global.uHlTop;\n            let _e1155 = bd;\n            let _e1161 = global.uContrastSat;\n            let _e1162 = LA;\n            base = (_e1146 + ((((_e1147 * HL_K) * smoothstep(HL_LO, 1f, _e1150)) * (1f - (_e1154 * smoothstep(HL_T0_, HL_T1_, _e1155)))) * (1f - (HL_X * max(-((_e1161 + _e1162.y)), 0f)))));\n            let _e1172 = shadows;\n            let _e1175 = bw;\n            let _e1182 = bw;\n            let _e1189 = blacks;\n            shLift = ((_e1172 * ((SH_K * (1f - smoothstep(0f, SH_HI, _e1175))) + (SH_DEEP * (1f - smoothstep(0f, 0.2f, _e1182))))) * (1f - (SH_X * max(_e1189, 0f))));\n            let _e1195 = base;\n            let _e1196 = shLift;\n            base = (_e1195 + _e1196);\n        }\n    }\n    let _e1200 = bd;\n    let _e1205 = bd;\n    mid_1 = (smoothstep(0.03f, 0.35f, _e1200) * (1f - smoothstep(0.8f, 1f, _e1205)));\n    let _e1210 = detail;\n    let _e1213 = clarity;\n    let _e1216 = mid_1;\n    detail = (_e1210 * max(0f, (1f + ((_e1213 * 0.9f) * _e1216))));\n    let _e1221 = base;\n    let _e1222 = detail;\n    l1_ = (_e1221 + _e1222);\n    let _e1225 = texAmt;\n    if (_e1225 != 0f) {\n        {\n            let _e1228 = l0_;\n            let _e1229 = p_9;\n            let _e1231 = ring(_e1229, 3f);\n            th = (_e1228 - _e1231);\n            let _e1234 = l1_;\n            let _e1235 = texAmt;\n            let _e1238 = th;\n            let _e1242 = mid_1;\n            let _e1246 = texAmt;\n            if (_e1246 < 0f) {\n                let _e1252 = th;\n                local_19 = (1f - smoothstep(0.08f, 0.25f, abs(_e1252)));\n            } else {\n                local_19 = 1f;\n            }\n            let _e1258 = local_19;\n            l1_ = (_e1234 + ((((_e1235 * 0.9f) * _e1238) * (0.4f + (0.6f * _e1242))) * _e1258));\n        }\n    }\n    let _e1261 = sharpen;\n    if (_e1261 > 0f) {\n        {\n            let _e1264 = l0_;\n            let _e1265 = p_9;\n            let _e1266 = global.uSharpenRadius;\n            let _e1267 = ring(_e1265, _e1266);\n            hp = (_e1264 - _e1267);\n            let _e1271 = global.uSharpenDetail;\n            limit = (0.06f + (_e1271 * 0.6f));\n            let _e1276 = l0_;\n            let _e1277 = p_9;\n            let _e1278 = global.uSharpenRadius;\n            let _e1281 = ring(_e1277, (_e1278 * 2f));\n            edge = abs((_e1276 - _e1281));\n            let _e1285 = global.uSharpenMasking;\n            if (_e1285 > 0f) {\n                let _e1288 = global.uSharpenMasking;\n                let _e1291 = global.uSharpenMasking;\n                let _e1296 = edge;\n                local_20 = smoothstep((_e1288 * 0.25f), ((_e1291 * 0.25f) + 0.08f), _e1296);\n            } else {\n                local_20 = 1f;\n            }\n            let _e1300 = local_20;\n            mask = _e1300;\n            let _e1302 = l1_;\n            let _e1303 = sharpen;\n            let _e1304 = hp;\n            let _e1305 = limit;\n            let _e1307 = limit;\n            let _e1310 = mask;\n            l1_ = (_e1302 + ((_e1303 * clamp(_e1304, -(_e1305), _e1307)) * _e1310));\n        }\n    } else {\n        let _e1313 = sharpen;\n        if (_e1313 < 0f) {\n            let _e1316 = l1_;\n            let _e1317 = sharpen;\n            let _e1321 = l0_;\n            let _e1322 = p_9;\n            let _e1324 = ring(_e1322, 1.5f);\n            l1_ = (_e1316 + (max(_e1317, -1f) * (_e1321 - _e1324)));\n        }\n    }\n    let _e1328 = l1_;\n    let _e1329 = base;\n    fine = (_e1328 - _e1329);\n    let _e1332 = lin_4;\n    let _e1333 = l1_;\n    let _e1334 = l0_;\n    lin_4 = (_e1332 * exp2((_e1333 - _e1334)));\n    let _e1338 = shLift;\n    if (_e1338 > 0f) {\n        {\n            let _e1341 = lin_4;\n            ys = dot(_e1341, W709_);\n            let _e1344 = ys;\n            let _e1345 = lin_4;\n            let _e1346 = ys;\n            let _e1351 = shLift;\n            lin_4 = (vec3(_e1344) + ((_e1345 - vec3(_e1346)) * exp2((-0.3f * _e1351))));\n        }\n    }\n    let _e1357 = dehaze;\n    if (_e1357 != 0f) {\n        {\n            let _e1360 = global.uAirY;\n            let _e1361 = exposure;\n            air = (_e1360 * exp2(_e1361));\n            let _e1365 = g_1;\n            let _e1367 = exposure;\n            let _e1370 = air;\n            haze = clamp(((_e1365.y * exp2(_e1367)) / max(_e1370, 0.0001f)), 0f, 1f);\n            let _e1378 = dehaze;\n            if (_e1378 > 0f) {\n                {\n                    let _e1383 = dehaze;\n                    let _e1385 = haze;\n                    t_6 = max((1f - ((0.95f * _e1383) * _e1385)), 0.2f);\n                    let _e1391 = lin_4;\n                    let _e1392 = air;\n                    let _e1394 = t_6;\n                    let _e1399 = t_6;\n                    lin_4 = ((_e1391 - vec3((_e1392 * (1f - _e1394)))) / vec3(_e1399));\n                }\n            } else {\n                {\n                    let _e1402 = lin_4;\n                    let _e1403 = air;\n                    let _e1407 = dehaze;\n                    let _e1413 = haze;\n                    lin_4 = mix(_e1402, vec3((_e1403 * 0.85f)), vec3(((-(_e1407) * 0.45f) * (0.4f + (0.6f * _e1413)))));\n                }\n            }\n        }\n    }\n    let _e1419 = global.uGlowMix;\n    if (_e1419.w > 0.5f) {\n        let _e1423 = global.uGlowMix;\n        let _e1425 = LG;\n        local_21 = clamp((_e1423.x + _e1425), 0f, 1f);\n    } else {\n        local_21 = 0f;\n    }\n    let _e1432 = local_21;\n    glowAmt = _e1432;\n    let _e1434 = glowAmt;\n    if (_e1434 > 0f) {\n        let _e1437 = p_9;\n        let _e1438 = textureSample(uGlow, uGlow_s, _e1437);\n        local_22 = _e1438.xyz;\n    } else {\n        local_22 = vec3(0f);\n    }\n    let _e1443 = local_22;\n    gl = _e1443;\n    let _e1445 = glowAmt;\n    let _e1448 = global.uGlowMix;\n    if ((_e1445 > 0f) && (_e1448.y > 1.5f)) {\n        {\n            let _e1453 = lin_4;\n            lc = clamp(_e1453, vec3(0f), vec3(1f));\n            let _e1460 = global.uGlowF;\n            let _e1462 = global.uGlowF;\n            let _e1464 = lc;\n            w_5 = smoothstep(_e1460.z, _e1462.w, dot(_e1464, W709_));\n            let _e1468 = lin_4;\n            let _e1469 = glowAmt;\n            let _e1470 = w_5;\n            let _e1472 = global.uGlowF;\n            let _e1474 = gl;\n            let _e1475 = lin_4;\n            let _e1478 = global.uGlowF;\n            let _e1480 = lc;\n            let _e1483 = lc;\n            lin_4 = (_e1468 + ((_e1469 * _e1470) * ((_e1472.x * (_e1474 - _e1475)) + ((_e1478.y * _e1480) * (vec3(1f) - _e1483)))));\n        }\n    }\n    let _e1491 = global.uDcp;\n    let _e1494 = global.uToneMap;\n    if ((_e1491 > 0.5f) && (_e1494 < 0.5f)) {\n        {\n            let _e1498 = global.uS2P;\n            let _e1499 = lin_4;\n            pp_3 = max((_e1498 * _e1499), vec3(0f));\n            let _e1505 = global.uLookADims;\n            if (_e1505.x > 0f) {\n                let _e1509 = global.uLookADims;\n                let _e1510 = pp_3;\n                let _e1511 = hueSatMap(uLookA, _e1509, _e1510);\n                pp_3 = _e1511;\n            }\n            let _e1512 = global.uLookBDims;\n            if (_e1512.x > 0f) {\n                let _e1516 = global.uLookBDims;\n                let _e1517 = pp_3;\n                let _e1518 = hueSatMap(uLookB, _e1516, _e1517);\n                pp_3 = _e1518;\n            }\n            let _e1519 = global.uP2S;\n            let _e1520 = pp_3;\n            let _e1521 = easeWhite(_e1520);\n            let _e1522 = rgbTone(_e1521);\n            let _e1524 = intoRange((_e1519 * _e1522));\n            mapped = _e1524;\n        }\n    } else {\n        {\n            let _e1525 = lin_4;\n            let _e1526 = intoRange(_e1525);\n            lin_4 = _e1526;\n            let _e1527 = global.uToneMap;\n            if (_e1527 < 0.5f) {\n                let _e1530 = lin_4;\n                let _e1531 = shoulder(_e1530);\n                local_25 = _e1531;\n            } else {\n                let _e1532 = global.uToneMap;\n                if (_e1532 < 1.5f) {\n                    let _e1535 = lin_4;\n                    let _e1536 = sigmoidMap(_e1535);\n                    local_24 = _e1536;\n                } else {\n                    let _e1537 = global.uToneMap;\n                    if (_e1537 < 2.5f) {\n                        let _e1540 = lin_4;\n                        let _e1541 = agxMap(_e1540);\n                        local_23 = _e1541;\n                    } else {\n                        let _e1542 = lin_4;\n                        let _e1543 = filmicMap(_e1542);\n                        local_23 = _e1543;\n                    }\n                    let _e1545 = local_23;\n                    local_24 = _e1545;\n                }\n                let _e1547 = local_24;\n                local_25 = _e1547;\n            }\n            let _e1549 = local_25;\n            mapped = _e1549;\n        }\n    }\n    let _e1550 = mapped;\n    let _e1551 = encode(_e1550);\n    d_7 = _e1551;\n    let _e1553 = glowAmt;\n    let _e1556 = global.uGlowMix;\n    if ((_e1553 > 0f) && (_e1556.y < 1.5f)) {\n        {\n            let _e1561 = d_7;\n            let _e1562 = decodeS(_e1561);\n            dl_1 = _e1562;\n            let _e1564 = global.uGlowMix;\n            if (_e1564.y < 0.5f) {\n                {\n                    let _e1568 = gl;\n                    let _e1569 = glowAmt;\n                    gl = (_e1568 * _e1569);\n                    let _e1571 = gl;\n                    yg = max(dot(_e1571, W709_), 0f);\n                    let _e1576 = gl;\n                    let _e1578 = yg;\n                    let _e1579 = global.uGlowF;\n                    let _e1582 = global.uGlowF;\n                    ga = (_e1576 * (1f - exp(-(pow((_e1578 / _e1579.x), _e1582.y)))));\n                    let _e1592 = dl_1;\n                    let _e1600 = ga;\n                    dl_1 = (vec3(1f) - ((vec3(1f) - clamp(_e1592, vec3(0f), vec3(1f))) * exp(-(_e1600))));\n                }\n            } else {\n                {\n                    let _e1606 = gl;\n                    let _e1608 = glowAmt;\n                    let _e1610 = global.uGlowF;\n                    e_1 = ((_e1606.x * _e1608) * _e1610.x);\n                    let _e1615 = global.uGlowF2_;\n                    let _e1617 = global.uGlowF2_;\n                    let _e1620 = e_1;\n                    let _e1621 = global.uGlowF2_;\n                    spill = (vec3<f32>(0f, _e1615.x, _e1617.y) * max((_e1620 - _e1621.z), 0f));\n                    let _e1628 = dl_1;\n                    let _e1629 = e_1;\n                    let _e1630 = global.uGlowF;\n                    let _e1632 = e_1;\n                    let _e1634 = global.uGlowF;\n                    let _e1636 = e_1;\n                    let _e1639 = spill;\n                    dl_1 = (_e1628 + (vec3<f32>(_e1629, (_e1630.y * _e1632), (_e1634.z * _e1636)) + _e1639));\n                }\n            }\n            let _e1642 = dl_1;\n            let _e1643 = encode(_e1642);\n            d_7 = _e1643;\n        }\n    }\n    let _e1644 = whites;\n    let _e1647 = blacks;\n    if ((_e1644 != 0f) || (_e1647 != 0f)) {\n        {\n            let _e1651 = d_7;\n            yp = clamp(dot(_e1651, W709_), 0f, 1f);\n            let _e1657 = yp;\n            let _e1658 = fine;\n            y_5 = clamp((_e1657 * exp2((-(_e1658) * WB_LOCAL))), 0f, 1f);\n            let _e1667 = y_5;\n            y2_1 = _e1667;\n            let _e1669 = whites;\n            if (_e1669 < 0f) {\n                {\n                    let _e1672 = y2_1;\n                    q_5 = (_e1672 / 0.9f);\n                    let _e1676 = q_5;\n                    let _e1677 = q_5;\n                    let _e1678 = q_5;\n                    q_5 = (_e1676 * (_e1677 * _e1678));\n                    let _e1681 = y2_1;\n                    let _e1682 = whites;\n                    let _e1684 = y2_1;\n                    let _e1686 = y2_1;\n                    let _e1688 = y2_1;\n                    let _e1691 = q_5;\n                    let _e1692 = q_5;\n                    y2_1 = (_e1681 + (((((_e1682 * WH_NEG) * _e1684) * _e1686) * _e1688) / (1f + (_e1691 * _e1692))));\n                }\n            } else {\n                let _e1697 = whites;\n                if (_e1697 > 0f) {\n                    let _e1700 = y2_1;\n                    let _e1702 = whites;\n                    let _e1704 = y2_1;\n                    y2_1 = (_e1700 * (1f + ((_e1702 * WH_POS) * _e1704)));\n                }\n            }\n            let _e1708 = y2_1;\n            let _e1710 = y2_1;\n            dk = (_e1708 * pow((1f - min(_e1710, 1f)), BL_N));\n            let _e1717 = y2_1;\n            let _e1718 = blacks;\n            if (_e1718 < 0f) {\n                let _e1721 = blacks;\n                let _e1723 = dk;\n                local_26 = ((_e1721 * BL_NEG) * _e1723);\n            } else {\n                let _e1725 = blacks;\n                let _e1726 = dk;\n                let _e1729 = y2_1;\n                local_26 = (_e1725 * ((BL_POS * _e1726) + (BL_LIFT * (1f - _e1729))));\n            }\n            let _e1735 = local_26;\n            y2_1 = (_e1717 + _e1735);\n            let _e1737 = y2_1;\n            y2_1 = max(_e1737, 0f);\n            let _e1740 = y_5;\n            if (_e1740 > 0.0001f) {\n                let _e1743 = y2_1;\n                let _e1744 = y_5;\n                if (_e1743 > _e1744) {\n                    let _e1746 = d_7;\n                    let _e1747 = y2_1;\n                    let _e1748 = y_5;\n                    let _e1751 = d_7;\n                    let _e1752 = y2_1;\n                    let _e1753 = y_5;\n                    let _e1755 = yp;\n                    let _e1757 = y_5;\n                    local_27 = mix((_e1746 * (_e1747 / _e1748)), (_e1751 + vec3((((_e1752 - _e1753) * _e1755) / _e1757))), vec3(0.9f));\n                } else {\n                    let _e1764 = d_7;\n                    let _e1765 = y2_1;\n                    let _e1766 = y_5;\n                    local_27 = (_e1764 * (_e1765 / _e1766));\n                }\n                let _e1770 = local_27;\n                local_28 = _e1770;\n            } else {\n                let _e1771 = y2_1;\n                local_28 = vec3(_e1771);\n            }\n            let _e1774 = local_28;\n            d_7 = _e1774;\n        }\n    }\n    let _e1775 = d_7;\n    d_7 = clamp(_e1775, vec3(0f), vec3(1f));\n    {\n        let _e1781 = global.uContrast;\n        ck = _e1781;\n        let _e1783 = d_7;\n        let _e1785 = d_7;\n        let _e1787 = d_7;\n        hi_1 = max(_e1783.x, max(_e1785.y, _e1787.z));\n        let _e1792 = d_7;\n        let _e1794 = d_7;\n        let _e1796 = d_7;\n        lo_1 = min(_e1792.x, min(_e1794.y, _e1796.z));\n        let _e1801 = hi_1;\n        let _e1802 = ck;\n        let _e1803 = hi_1;\n        let _e1804 = hi_1;\n        let _e1808 = hi_1;\n        let _e1812 = hi_1;\n        hi2_ = (_e1801 + (_e1802 * (((_e1803 * _e1804) * (3f - (2f * _e1808))) - _e1812)));\n        let _e1817 = lo_1;\n        let _e1818 = ck;\n        let _e1819 = lo_1;\n        let _e1820 = lo_1;\n        let _e1824 = lo_1;\n        let _e1828 = lo_1;\n        lo2_ = (_e1817 + (_e1818 * (((_e1819 * _e1820) * (3f - (2f * _e1824))) - _e1828)));\n        let _e1833 = hi_1;\n        let _e1834 = lo_1;\n        if ((_e1833 - _e1834) > 0.00001f) {\n            let _e1838 = lo2_;\n            let _e1839 = d_7;\n            let _e1840 = lo_1;\n            let _e1843 = hi2_;\n            let _e1844 = lo2_;\n            let _e1846 = hi_1;\n            let _e1847 = lo_1;\n            local_29 = (vec3(_e1838) + ((_e1839 - vec3(_e1840)) * ((_e1843 - _e1844) / (_e1846 - _e1847))));\n        } else {\n            let _e1853 = hi2_;\n            local_29 = vec3(_e1853);\n        }\n        let _e1856 = local_29;\n        d_7 = _e1856;\n    }\n    {\n        let _e1857 = global.uContrastSat;\n        let _e1858 = LA;\n        ck_1 = (CON_K * (_e1857 + _e1858.y));\n        let _e1863 = ck_1;\n        if (_e1863 != 0f) {\n            {\n                let _e1866 = fine;\n                kl = exp2((-(_e1866) * CON_LOCAL));\n                let _e1871 = d_7;\n                let _e1873 = kl;\n                y_6 = clamp((dot(_e1871, W709_) * _e1873), 0f, 1f);\n                let _e1879 = y_6;\n                let _e1880 = ck_1;\n                let _e1881 = conCurve(_e1879, _e1880);\n                y2_2 = _e1881;\n                let _e1883 = y_6;\n                if (_e1883 > 0.0001f) {\n                    let _e1886 = d_7;\n                    let _e1887 = y2_2;\n                    let _e1888 = y_6;\n                    local_30 = (_e1886 * (_e1887 / _e1888));\n                } else {\n                    let _e1891 = y2_2;\n                    local_30 = vec3(_e1891);\n                }\n                let _e1894 = local_30;\n                dl_2 = _e1894;\n                let _e1896 = d_7;\n                let _e1898 = d_7;\n                let _e1900 = d_7;\n                hi_2 = max(_e1896.x, max(_e1898.y, _e1900.z));\n                let _e1905 = d_7;\n                let _e1907 = d_7;\n                let _e1909 = d_7;\n                lo_2 = min(_e1905.x, min(_e1907.y, _e1909.z));\n                let _e1914 = hi_2;\n                let _e1915 = kl;\n                let _e1920 = ck_1;\n                let _e1921 = conCurve(clamp((_e1914 * _e1915), 0f, 1f), _e1920);\n                let _e1922 = kl;\n                hi2_1 = (_e1921 / _e1922);\n                let _e1925 = lo_2;\n                let _e1926 = kl;\n                let _e1931 = ck_1;\n                let _e1932 = conCurve(clamp((_e1925 * _e1926), 0f, 1f), _e1931);\n                let _e1933 = kl;\n                lo2_1 = (_e1932 / _e1933);\n                let _e1936 = hi_2;\n                let _e1937 = lo_2;\n                if ((_e1936 - _e1937) > 0.00001f) {\n                    let _e1941 = lo2_1;\n                    let _e1942 = d_7;\n                    let _e1943 = lo_2;\n                    let _e1946 = hi2_1;\n                    let _e1947 = lo2_1;\n                    let _e1949 = hi_2;\n                    let _e1950 = lo_2;\n                    local_31 = (vec3(_e1941) + ((_e1942 - vec3(_e1943)) * ((_e1946 - _e1947) / (_e1949 - _e1950))));\n                } else {\n                    let _e1956 = hi2_1;\n                    local_31 = vec3(_e1956);\n                }\n                let _e1959 = local_31;\n                dh = _e1959;\n                let _e1961 = dh;\n                let _e1962 = dl_2;\n                d_7 = mix(_e1961, _e1962, vec3(0.6f));\n            }\n        }\n    }\n    let _e1966 = global.uContrastSat;\n    let _e1967 = LA;\n    cs = (_e1966 + _e1967.y);\n    let _e1971 = cs;\n    if (_e1971 != 0f) {\n        {\n            let _e1974 = d_7;\n            yc = dot(_e1974, W709_);\n            let _e1977 = d_7;\n            let _e1979 = d_7;\n            let _e1981 = d_7;\n            mx_3 = max(_e1977.x, max(_e1979.y, _e1981.z));\n            let _e1986 = mx_3;\n            if (_e1986 > 0f) {\n                let _e1989 = mx_3;\n                let _e1990 = d_7;\n                let _e1992 = d_7;\n                let _e1994 = d_7;\n                let _e1999 = mx_3;\n                local_32 = ((_e1989 - min(_e1990.x, min(_e1992.y, _e1994.z))) / _e1999);\n            } else {\n                local_32 = 0f;\n            }\n            let _e2003 = local_32;\n            sv = _e2003;\n            let _e2005 = yc;\n            let _e2006 = d_7;\n            let _e2007 = yc;\n            let _e2011 = cs;\n            let _e2013 = sv;\n            let _e2017 = sv;\n            d_7 = (vec3(_e2005) + ((_e2006 - vec3(_e2007)) * max((1f + (_e2011 * (CS_K + ((CS_V * (1f - _e2013)) * (1f - _e2017))))), 0f)));\n        }\n    }\n    let _e2028 = d_7;\n    let _e2029 = decodeS(_e2028);\n    let _e2036 = encode(clamp((SRGB_TO_PP * _e2029), vec3(0f), vec3(1f)));\n    d_7 = _e2036;\n    {\n        let _e2038 = d_7;\n        let _e2040 = d_7;\n        let _e2042 = d_7;\n        hi_3 = max(_e2038.x, max(_e2040.y, _e2042.z));\n        let _e2047 = d_7;\n        let _e2049 = d_7;\n        let _e2051 = d_7;\n        lo_3 = min(_e2047.x, min(_e2049.y, _e2051.z));\n        let _e2056 = hi_3;\n        let _e2059 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2056, 0.5f));\n        hi2_2 = _e2059.x;\n        let _e2062 = lo_3;\n        let _e2065 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2062, 0.5f));\n        lo2_2 = _e2065.x;\n        let _e2068 = hi_3;\n        let _e2069 = lo_3;\n        if ((_e2068 - _e2069) > 0.00001f) {\n            let _e2073 = lo2_2;\n            let _e2074 = d_7;\n            let _e2075 = lo_3;\n            let _e2078 = hi2_2;\n            let _e2079 = lo2_2;\n            let _e2081 = hi_3;\n            let _e2082 = lo_3;\n            local_33 = (vec3(_e2073) + ((_e2074 - vec3(_e2075)) * ((_e2078 - _e2079) / (_e2081 - _e2082))));\n        } else {\n            let _e2088 = hi2_2;\n            local_33 = vec3(_e2088);\n        }\n        let _e2091 = local_33;\n        dc = _e2091;\n    }\n    let _e2092 = global.uRefineSat;\n    if (_e2092 < 1f) {\n        {\n            let _e2095 = d_7;\n            yc0_ = dot(_e2095, W709_);\n            let _e2098 = yc0_;\n            let _e2101 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2098, 0.5f));\n            yc_1 = _e2101.x;\n            let _e2104 = yc_1;\n            let _e2105 = d_7;\n            let _e2106 = yc0_;\n            let _e2109 = yc_1;\n            let _e2110 = yc0_;\n            let _e2117 = dc;\n            let _e2118 = global.uRefineSat;\n            d_7 = mix((vec3(_e2104) + ((_e2105 - vec3(_e2106)) * (_e2109 / max(_e2110, 0.001f)))), _e2117, vec3(_e2118));\n        }\n    } else {\n        let _e2121 = dc;\n        d_7 = _e2121;\n    }\n    let _e2122 = d_7;\n    d_7 = clamp(_e2122, vec3(0f), vec3(1f));\n    let _e2128 = d_7;\n    let _e2132 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2128.x, 0.5f));\n    let _e2134 = d_7;\n    let _e2138 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2134.y, 0.5f));\n    let _e2140 = d_7;\n    let _e2144 = textureSample(uCurve, uCurve_s, vec2<f32>(_e2140.z, 0.5f));\n    d_7 = vec3<f32>(_e2132.y, _e2138.z, _e2144.w);\n    let _e2147 = d_7;\n    let _e2148 = decodeS(_e2147);\n    let _e2150 = encode((PP_TO_SRGB * _e2148));\n    d_7 = _e2150;\n    let _e2151 = global.uMaskN;\n    if (_e2151 > 0f) {\n        {\n            loop {\n                let _e2156 = i_6;\n                if !((_e2156 < 16i)) {\n                    break;\n                }\n                {\n                    let _e2163 = i_6;\n                    let _e2165 = global.uMaskN;\n                    if (f32(_e2163) >= _e2165) {\n                        break;\n                    }\n                    let _e2167 = i_6;\n                    let _e2169 = global.uMS[_e2167];\n                    let _e2173 = i_6;\n                    let _e2175 = mw[_e2173];\n                    if ((_e2169.y < 0.5f) || (_e2175 <= 0f)) {\n                        continue;\n                    }\n                    let _e2179 = i_6;\n                    row = ((f32(_e2179) + 0.5f) / 16f);\n                    let _e2186 = d_7;\n                    let _e2188 = row;\n                    let _e2190 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2186.x, _e2188));\n                    let _e2192 = d_7;\n                    let _e2194 = row;\n                    let _e2196 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2192.y, _e2194));\n                    let _e2198 = d_7;\n                    let _e2200 = row;\n                    let _e2202 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2198.z, _e2200));\n                    c_22 = vec3<f32>(_e2190.x, _e2196.x, _e2202.x);\n                    let _e2206 = d_7;\n                    yc0_1 = dot(_e2206, W709_);\n                    let _e2209 = yc0_1;\n                    let _e2210 = row;\n                    let _e2212 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2209, _e2210));\n                    yc_2 = _e2212.x;\n                    let _e2215 = yc_2;\n                    let _e2216 = d_7;\n                    let _e2217 = yc0_1;\n                    let _e2220 = yc_2;\n                    let _e2221 = yc0_1;\n                    let _e2228 = c_22;\n                    let _e2229 = i_6;\n                    let _e2231 = global.uMS[_e2229];\n                    c_22 = mix((vec3(_e2215) + ((_e2216 - vec3(_e2217)) * (_e2220 / max(_e2221, 0.001f)))), _e2228, vec3(_e2231.z));\n                    let _e2235 = c_22;\n                    c_22 = clamp(_e2235, vec3(0f), vec3(1f));\n                    let _e2241 = c_22;\n                    let _e2243 = row;\n                    let _e2245 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2241.x, _e2243));\n                    let _e2247 = c_22;\n                    let _e2249 = row;\n                    let _e2251 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2247.y, _e2249));\n                    let _e2253 = c_22;\n                    let _e2255 = row;\n                    let _e2257 = textureSample(uMaskCurve, uMaskCurve_s, vec2<f32>(_e2253.z, _e2255));\n                    c_22 = vec3<f32>(_e2245.y, _e2251.z, _e2257.w);\n                    let _e2260 = d_7;\n                    let _e2261 = c_22;\n                    let _e2262 = i_6;\n                    let _e2264 = mw[_e2262];\n                    d_7 = mix(_e2260, _e2261, vec3(min(_e2264, 1f)));\n                }\n                continuing {\n                    let _e2160 = i_6;\n                    i_6 = (_e2160 + 1i);\n                }\n            }\n        }\n    }\n    let _e2269 = d_7;\n    let _e2270 = hsv(_e2269);\n    h_7 = _e2270;\n    let _e2274 = h_7;\n    chroma_1 = smoothstep(0.02f, 0.25f, _e2274.y);\n    let _e2278 = d_7;\n    let _e2279 = srgbToLin(_e2278);\n    pp_4 = (SRGB_TO_PP * _e2279);\n    let _e2282 = pp_4;\n    let _e2286 = rgbToHsv6_(max(_e2282, vec3(0f)));\n    q_6 = _e2286;\n    let _e2288 = q_6;\n    let _e2298 = textureSample(uHue, uHue_s, vec2<f32>((((_e2288.x * 60f) + 0.5f) / 360f), 0.5f));\n    let _e2300 = q_6;\n    adj = (_e2298 * smoothstep(0f, MIX_S, _e2300.y));\n    let _e2305 = adj;\n    let _e2309 = adj;\n    let _e2314 = adj;\n    if (((_e2305.x != 0f) || (_e2309.y != 0f)) || (_e2314.z != 0f)) {\n        {\n            let _e2320 = q_6;\n            let _e2322 = adj;\n            q_6.x = (_e2320.x + ((_e2322.x * MIX_HUE) / 60f));\n            let _e2329 = q_6;\n            let _e2332 = adj;\n            let _e2334 = adj;\n            if (_e2334.y > 0f) {\n                local_34 = MIX_SAT_UP;\n            } else {\n                local_34 = MIX_SAT_DOWN;\n            }\n            let _e2339 = local_34;\n            let _e2342 = adj;\n            q_6.y = (_e2329.y * max(((1f + (_e2332.y * _e2339)) - (_e2342.z * MIX_LUM_SAT)), 0f));\n            let _e2350 = q_6;\n            q_6.y = min(_e2350.y, 1f);\n            let _e2355 = q_6;\n            let _e2358 = adj;\n            let _e2360 = adj;\n            if (_e2360.z > 0f) {\n                local_35 = MIX_LUM_UP;\n            } else {\n                local_35 = MIX_LUM_DOWN;\n            }\n            let _e2365 = local_35;\n            q_6.z = (_e2355.z * max((1f + (_e2358.z * _e2365)), 0f));\n            let _e2371 = q_6;\n            let _e2372 = hsv6ToRgb(_e2371);\n            let _e2374 = linToSrgb((PP_TO_SRGB * _e2372));\n            d_7 = _e2374;\n        }\n    }\n    let _e2375 = LD;\n    if (_e2375.x != 0f) {\n        let _e2379 = d_7;\n        let _e2380 = LD;\n        let _e2384 = chroma_1;\n        let _e2386 = rotateHue(_e2379, ((_e2380.x * 60f) * _e2384));\n        d_7 = _e2386;\n    }\n    let _e2387 = global.uSaturation;\n    let _e2388 = LC;\n    sv_1 = (_e2387 + _e2388.y);\n    let _e2392 = sv_1;\n    let _e2395 = global.uVibrance;\n    if ((_e2392 != 0f) || (_e2395 != 0f)) {\n        {\n            let _e2399 = d_7;\n            let _e2400 = srgbToLin(_e2399);\n            let _e2405 = rgbToHsv6_(max((SRGB_TO_PP * _e2400), vec3(0f)));\n            ps = _e2405.y;\n            let _e2409 = sv_1;\n            let _e2410 = sv_1;\n            if (_e2410 > 0f) {\n                local_36 = 0.8f;\n            } else {\n                local_36 = 0.92f;\n            }\n            let _e2416 = local_36;\n            let _e2420 = global.uVibrance;\n            let _e2421 = global.uVibrance;\n            if (_e2421 > 0f) {\n                let _e2426 = ps;\n                local_37 = (1.29f * pow(clamp((1f - (_e2426 / 0.96f)), 0f, 1f), 0.77f));\n            } else {\n                local_37 = 0.77f;\n            }\n            let _e2438 = local_37;\n            f_2 = ((1f + (_e2409 * _e2416)) * (1f + (_e2420 * _e2438)));\n            let _e2443 = d_7;\n            let _e2444 = toOklab(_e2443);\n            o_2 = _e2444;\n            let _e2446 = o_2;\n            let _e2448 = o_2;\n            let _e2450 = f_2;\n            let _e2453 = (_e2448.yz * max(_e2450, 0f));\n            o_2.y = _e2453.x;\n            o_2.z = _e2453.y;\n            let _e2458 = o_2;\n            let _e2459 = fromOklab(_e2458);\n            d_7 = _e2459;\n        }\n    }\n    let _e2460 = LF;\n    let _e2464 = LF;\n    let _e2469 = LF;\n    if (((_e2460.y != 0f) || (_e2464.z != 0f)) || (_e2469.w != 0f)) {\n        {\n            let _e2474 = d_7;\n            yt = dot(_e2474, W709_);\n            let _e2477 = d_7;\n            let _e2479 = LF;\n            d_7 = (_e2477 * (vec3(1f) + (_e2479.yzw * 2.4f)));\n            let _e2486 = d_7;\n            let _e2487 = yt;\n            let _e2489 = d_7;\n            d_7 = (_e2486 * (max(_e2487, CHROMA_FLOOR) / max(dot(_e2489, W709_), CHROMA_FLOOR)));\n        }\n    }\n    let _e2497 = global.uMaskN;\n    if (_e2497 > 0f) {\n        {\n            loop {\n                let _e2502 = i_7;\n                if !((_e2502 < 16i)) {\n                    break;\n                }\n                {\n                    let _e2509 = i_7;\n                    let _e2511 = global.uMaskN;\n                    if (f32(_e2509) >= _e2511) {\n                        break;\n                    }\n                    let _e2513 = i_7;\n                    let _e2515 = global.uMP[_e2513];\n                    if (_e2515.w < 0.5f) {\n                        continue;\n                    }\n                    let _e2519 = d_7;\n                    let _e2520 = hsv(_e2519);\n                    hp_1 = _e2520;\n                    let _e2522 = hp_1;\n                    let _e2524 = i_7;\n                    let _e2526 = global.uMP[_e2524];\n                    dh_1 = abs((_e2522.x - _e2526.x));\n                    let _e2531 = dh_1;\n                    let _e2533 = dh_1;\n                    dh_1 = (min(_e2531, (360f - _e2533)) / 180f);\n                    let _e2538 = dh_1;\n                    let _e2541 = hp_1;\n                    let _e2543 = i_7;\n                    let _e2545 = global.uMP[_e2543];\n                    let _e2549 = i_7;\n                    let _e2551 = global.uMP[_e2549];\n                    let _e2556 = dh_1;\n                    let _e2560 = hp_1;\n                    let _e2562 = i_7;\n                    let _e2564 = global.uMP[_e2562];\n                    let _e2569 = hp_1;\n                    let _e2571 = i_7;\n                    let _e2573 = global.uMP[_e2571];\n                    dist_1 = length(vec3<f32>(((((_e2538 * 2.2f) * min(_e2541.y, _e2545.y)) / max(_e2551.y, 0.05f)) + (_e2556 * 0.4f)), ((_e2560.y - _e2564.y) * 0.9f), ((_e2569.z - _e2573.z) * 0.6f)));\n                    let _e2581 = i_7;\n                    let _e2583 = global.uMQ[_e2581];\n                    width = _e2583.w;\n                    let _e2587 = width;\n                    let _e2590 = i_7;\n                    let _e2592 = global.uMS[_e2590];\n                    let _e2597 = width;\n                    let _e2598 = dist_1;\n                    near = (1f - smoothstep((_e2587 * (1f - (0.85f * _e2592.x))), _e2597, _e2598));\n                    let _e2602 = i_7;\n                    let _e2604 = global.uPointView;\n                    if (f32(_e2602) == _e2604) {\n                        let _e2606 = near;\n                        pointShow = _e2606;\n                    }\n                    let _e2607 = near;\n                    let _e2608 = i_7;\n                    let _e2610 = mw[_e2608];\n                    k_8 = (_e2607 * _e2610);\n                    let _e2613 = k_8;\n                    if (_e2613 <= 0f) {\n                        continue;\n                    }\n                    let _e2616 = i_7;\n                    let _e2618 = global.uMQ[_e2616];\n                    if (_e2618.x != 0f) {\n                        let _e2622 = d_7;\n                        let _e2623 = i_7;\n                        let _e2625 = global.uMQ[_e2623];\n                        let _e2627 = k_8;\n                        let _e2629 = rotateHue(_e2622, (_e2625.x * _e2627));\n                        d_7 = _e2629;\n                    }\n                    let _e2630 = d_7;\n                    yp_1 = dot(_e2630, W709_);\n                    let _e2633 = yp_1;\n                    let _e2634 = d_7;\n                    let _e2635 = yp_1;\n                    let _e2639 = i_7;\n                    let _e2641 = global.uMQ[_e2639];\n                    let _e2643 = k_8;\n                    d_7 = (vec3(_e2633) + ((_e2634 - vec3(_e2635)) * max((1f + (_e2641.y * _e2643)), 0f)));\n                    let _e2651 = d_7;\n                    let _e2653 = i_7;\n                    let _e2655 = global.uMQ[_e2653];\n                    let _e2659 = k_8;\n                    d_7 = (_e2651 * (1f + ((_e2655.z * 0.8f) * _e2659)));\n                }\n                continuing {\n                    let _e2506 = i_7;\n                    i_7 = (_e2506 + 1i);\n                }\n            }\n        }\n    }\n    let _e2663 = global.uDefringeP;\n    let _e2666 = global.uDefringeG;\n    let _e2670 = LF;\n    if (((_e2663 > 0f) || (_e2666 > 0f)) || (_e2670.x > 0f)) {\n        {\n            let _e2677 = l0_;\n            let _e2678 = p_9;\n            let _e2680 = ring(_e2678, 2f);\n            edge_1 = smoothstep(0.15f, 0.6f, abs((_e2677 - _e2680)));\n            let _e2685 = d_7;\n            let _e2686 = hsv(_e2685);\n            hd = _e2686;\n            let _e2690 = hd;\n            let _e2696 = hd;\n            purple = (smoothstep(240f, 265f, _e2690.x) * (1f - smoothstep(320f, 345f, _e2696.x)));\n            let _e2704 = hd;\n            let _e2710 = hd;\n            green = (smoothstep(75f, 95f, _e2704.x) * (1f - smoothstep(150f, 170f, _e2710.x)));\n            let _e2716 = edge_1;\n            let _e2717 = purple;\n            let _e2718 = global.uDefringeP;\n            let _e2719 = LF;\n            let _e2725 = green;\n            let _e2726 = global.uDefringeG;\n            let _e2727 = LF;\n            k_9 = clamp((_e2716 * ((_e2717 * (_e2718 + max(_e2719.x, 0f))) + (_e2725 * (_e2726 + max(_e2727.x, 0f))))), 0f, 1f);\n            let _e2739 = d_7;\n            yk = dot(_e2739, W709_);\n            let _e2742 = d_7;\n            let _e2743 = yk;\n            let _e2745 = k_9;\n            d_7 = mix(_e2742, vec3(_e2743), vec3(_e2745));\n        }\n    }\n    let _e2748 = global.uBW;\n    if (_e2748 > 0f) {\n        {\n            let _e2751 = d_7;\n            let _e2754 = adj;\n            let _e2756 = chroma_1;\n            yb_2 = (dot(_e2751, W709_) * (1f + ((_e2754.w * _e2756) * 1.2f)));\n            let _e2763 = yb_2;\n            d_7 = vec3(max(_e2763, 0f));\n        }\n    }\n    let _e2767 = global.uGradeOn;\n    if (_e2767 > 0f) {\n        {\n            let _e2770 = d_7;\n            let _e2771 = toOklab(_e2770);\n            lk = _e2771.x;\n            let _e2774 = global.uGradeShape;\n            bl = _e2774.x;\n            let _e2777 = bl;\n            up = max((_e2777 - 0.5f), 0f);\n            let _e2783 = global.uGradeShape;\n            c_23 = (GRADE_C - (_e2783.y * 0.3f));\n            let _e2789 = bl;\n            if (_e2789 >= 0.5f) {\n                let _e2793 = up;\n                local_38 = (1f + (_e2793 * 4f));\n            } else {\n                let _e2798 = bl;\n                local_38 = ((0.1f + (_e2798 * 0.4f)) / 0.3f);\n            }\n            let _e2805 = local_38;\n            w_6 = (GRADE_W * _e2805);\n            let _e2810 = lk;\n            let _e2811 = c_23;\n            let _e2814 = w_6;\n            sh_1 = (1f / (1f + exp((((_e2810 - _e2811) + GRADE_OFF) / _e2814))));\n            let _e2822 = c_23;\n            let _e2824 = lk;\n            let _e2826 = w_6;\n            hi_4 = (1f / (1f + exp((((_e2822 + GRADE_OFF) - _e2824) / _e2826))));\n            let _e2833 = sh_1;\n            let _e2835 = hi_4;\n            mi = clamp(((1f - _e2833) - _e2835), 0f, 1f);\n            let _e2841 = d_7;\n            dd = clamp(_e2841, vec3(0f), vec3(1f));\n            let _e2848 = d_7;\n            let _e2849 = sh_1;\n            let _e2850 = global.uGradeS;\n            let _e2852 = mi;\n            let _e2853 = global.uGradeM;\n            let _e2856 = hi_4;\n            let _e2857 = global.uGradeH;\n            let _e2861 = up;\n            let _e2866 = global.uGradeG;\n            let _e2869 = dd;\n            let _e2872 = dd;\n            d_7 = (_e2848 + ((((((_e2849 * _e2850) + (_e2852 * _e2853)) + (_e2856 * _e2857)) * (1f + (_e2861 * 2f))) + _e2866) * pow(((4f * _e2869) * (vec3(1f) - _e2872)), vec3(0.4262f))));\n            let _e2881 = global.uGradeLum;\n            let _e2883 = sh_1;\n            let _e2885 = global.uGradeLum;\n            let _e2887 = mi;\n            let _e2890 = global.uGradeLum;\n            let _e2892 = hi_4;\n            let _e2895 = global.uGradeLum;\n            lum = ((((_e2881.x * _e2883) + (_e2885.y * _e2887)) + (_e2890.z * _e2892)) + _e2895.w);\n            let _e2899 = lum;\n            if (_e2899 >= 0f) {\n                let _e2904 = d_7;\n                let _e2908 = lum;\n                local_39 = (vec3(1f) - ((vec3(1f) - _e2904) * (1f - (_e2908 * 0.5f))));\n            } else {\n                let _e2915 = d_7;\n                let _e2917 = lum;\n                local_39 = (_e2915 * (1f + (_e2917 * 0.5f)));\n            }\n            let _e2923 = local_39;\n            d_7 = _e2923;\n        }\n    }\n    let _e2924 = global.uVignette;\n    if (_e2924 != 0f) {\n        {\n            let _e2927 = global.uOut2Vig;\n            let _e2928 = frFC;\n            let _e2929 = _e2928.xy;\n            q_7 = (_e2927 * vec3<f32>(_e2929.x, _e2929.y, 1f)).xy;\n            let _e2937 = global.uVigRound;\n            r_3 = _e2937;\n            let _e2939 = q_7;\n            let _e2940 = r_3;\n            if (_e2940 > 0f) {\n                let _e2944 = global.uCropAspect;\n                let _e2945 = r_3;\n                let _e2950 = global.uCropAspect;\n                let _e2953 = r_3;\n                local_40 = (vec2<f32>(mix(1f, _e2944, _e2945), 1f) / vec2(mix(1f, max(_e2950, 1f), _e2953)));\n            } else {\n                local_40 = vec2(1f);\n            }\n            let _e2960 = local_40;\n            qs = (_e2939 * _e2960);\n            let _e2964 = r_3;\n            pw_1 = (2f + (max(-(_e2964), 0f) * 6f));\n            let _e2972 = qs;\n            let _e2975 = pw_1;\n            let _e2977 = qs;\n            let _e2980 = pw_1;\n            let _e2984 = pw_1;\n            dist_2 = pow((pow(abs(_e2972.x), _e2975) + pow(abs(_e2977.y), _e2980)), (1f / _e2984));\n            let _e2989 = global.uVigMid;\n            m0_1 = (1.374f - (_e2989 * 0.9f));\n            let _e2995 = global.uVigFeather;\n            f_3 = (0.08f + (_e2995 * 1.476f));\n            let _e3000 = m0_1;\n            let _e3001 = f_3;\n            let _e3005 = m0_1;\n            let _e3006 = f_3;\n            let _e3010 = dist_2;\n            mask_1 = smoothstep((_e3000 - (_e3001 * 0.5f)), (_e3005 + (_e3006 * 0.5f)), _e3010);\n            let _e3013 = global.uVignette;\n            let _e3015 = mask_1;\n            amt = ((abs(_e3013) * _e3015) * 1.58f);\n            let _e3020 = global.uVigStyle;\n            if (_e3020 > 2.5f) {\n                let _e3023 = d_7;\n                let _e3024 = global.uVignette;\n                if (_e3024 > 0f) {\n                    local_41 = vec3(1f);\n                } else {\n                    local_41 = vec3(0f);\n                }\n                let _e3032 = local_41;\n                let _e3033 = amt;\n                d_7 = mix(_e3023, _e3032, vec3(_e3033));\n            } else {\n                {\n                    let _e3036 = d_7;\n                    d0_ = _e3036;\n                    let _e3038 = global.uVignette;\n                    if (_e3038 > 0f) {\n                        let _e3043 = d_7;\n                        let _e3047 = amt;\n                        local_42 = (vec3(1f) - ((vec3(1f) - _e3043) * (1f - _e3047)));\n                    } else {\n                        let _e3052 = d_7;\n                        let _e3054 = amt;\n                        local_42 = (_e3052 * (1f - _e3054));\n                    }\n                    let _e3058 = local_42;\n                    d_7 = _e3058;\n                    let _e3059 = global.uVigStyle;\n                    if (_e3059 < 1.5f) {\n                        let _e3062 = d_7;\n                        let _e3063 = d0_;\n                        let _e3066 = global.uVigHighlights;\n                        let _e3071 = global.uVigHighlights;\n                        let _e3074 = d0_;\n                        let _e3076 = d0_;\n                        let _e3078 = d0_;\n                        d_7 = mix(_e3062, _e3063, vec3(((0.83f + (0.17f * _e3066)) * smoothstep(mix(0.68f, 0.55f, _e3071), 1f, max(_e3074.x, max(_e3076.y, _e3078.z))))));\n                    } else {\n                        let _e3086 = d_7;\n                        let _e3087 = d0_;\n                        let _e3088 = global.uVigHighlights;\n                        let _e3093 = d0_;\n                        let _e3095 = d0_;\n                        let _e3097 = d0_;\n                        d_7 = mix(_e3086, _e3087, vec3(((_e3088 * 0.5f) * smoothstep(0.7f, 1f, max(_e3093.x, max(_e3095.y, _e3097.z))))));\n                    }\n                }\n            }\n        }\n    }\n    let _e3105 = global.uGrain;\n    let _e3107 = LE;\n    grainAmt = (_e3105.x + _e3107.x);\n    let _e3111 = grainAmt;\n    if (_e3111 > 0f) {\n        {\n            let _e3114 = LE;\n            let _e3116 = grainAmt;\n            t_7 = (_e3114.x / _e3116);\n            let _e3119 = global.uGrain;\n            let _e3121 = LE;\n            let _e3123 = LE;\n            let _e3128 = t_7;\n            size = mix(_e3119.y, (_e3121.y / max(_e3123.x, 0.0001f)), _e3128);\n            let _e3131 = global.uGrain;\n            let _e3133 = LE;\n            let _e3135 = LE;\n            let _e3140 = t_7;\n            rough = mix(_e3131.z, (_e3133.z / max(_e3135.x, 0.0001f)), _e3140);\n            let _e3143 = ori;\n            let _e3144 = size;\n            g_2 = (_e3143 / vec2(_e3144));\n            let _e3148 = g_2;\n            let _e3149 = vnoise(_e3148);\n            nz = (_e3149 - 0.5f);\n            let _e3153 = nz;\n            let _e3154 = g_2;\n            let _e3160 = vnoise(((_e3154 * 2.3f) + vec2(17f)));\n            let _e3163 = rough;\n            nz = mix(_e3153, (_e3160 - 0.5f), (_e3163 * 0.6f));\n            let _e3167 = d_7;\n            yg_1 = dot(_e3167, W709_);\n            let _e3170 = d_7;\n            let _e3171 = nz;\n            let _e3172 = grainAmt;\n            let _e3181 = yg_1;\n            d_7 = (_e3170 + vec3((((_e3171 * min(_e3172, 1.5f)) * 0.35f) * (0.3f + (0.7f * (1f - abs(((_e3181 * 2f) - 1f))))))));\n        }\n    }\n    let _e3193 = global.uMelissa;\n    if (_e3193 > 0.5f) {\n        let _e3196 = d_7;\n        let _e3197 = decodeS(_e3196);\n        let _e3204 = encode(clamp((SRGB_TO_PP * _e3197), vec3(0f), vec3(1f)));\n        local_43 = _e3204;\n    } else {\n        let _e3205 = d_7;\n        let _e3206 = gamutIn(_e3205);\n        local_43 = _e3206;\n    }\n    let _e3208 = local_43;\n    d_7 = _e3208;\n    let _e3209 = global.uMaskView;\n    if (_e3209 >= 0f) {\n        {\n            let _e3212 = shownW;\n            let _e3213 = fwidth(_e3212);\n            let _e3216 = global.uMaskLine;\n            fw = (max(_e3213, 0.0001f) * _e3216);\n            let _e3221 = fw;\n            let _e3222 = shownW;\n            edge_2 = (1f - smoothstep(0f, _e3221, abs((_e3222 - 0.5f))));\n            let _e3231 = fw;\n            let _e3234 = shownW;\n            let _e3242 = fw;\n            let _e3245 = shownW;\n            soft = (max((1f - smoothstep(0f, (_e3231 * 0.7f), abs((_e3234 - 0.08f)))), (1f - smoothstep(0f, (_e3242 * 0.7f), abs((_e3245 - 0.92f))))) * 0.55f);\n            let _e3255 = soft;\n            let _e3257 = shownW;\n            let _e3258 = fwidth(_e3257);\n            let _e3260 = global.uMaskFeather;\n            soft = (_e3255 * (step(0.002f, _e3258) * _e3260));\n            let _e3263 = edge_2;\n            let _e3264 = soft;\n            lines = max(_e3263, _e3264);\n            let _e3267 = global.uMaskStyle;\n            if (_e3267 < 0.5f) {\n                let _e3270 = d_7;\n                let _e3271 = global.uMaskColor;\n                let _e3272 = shownW;\n                let _e3273 = global.uMaskOpacity;\n                d_7 = mix(_e3270, _e3271, vec3((_e3272 * _e3273)));\n            } else {\n                let _e3277 = global.uMaskStyle;\n                if (_e3277 < 1.5f) {\n                    let _e3280 = d_7;\n                    let _e3281 = global.uMaskColor;\n                    let _e3282 = shownW;\n                    let _e3283 = global.uMaskOpacity;\n                    let _e3289 = global.uMaskColor;\n                    let _e3290 = lines;\n                    d_7 = mix(mix(_e3280, _e3281, vec3(((_e3282 * _e3283) * 0.6f))), _e3289, vec3(_e3290));\n                } else {\n                    let _e3293 = global.uMaskStyle;\n                    if (_e3293 < 2.5f) {\n                        let _e3296 = d_7;\n                        let _e3297 = global.uMaskColor;\n                        let _e3298 = lines;\n                        let _e3299 = global.uMaskOpacity;\n                        d_7 = mix(_e3296, _e3297, vec3((_e3298 * max(_e3299, 0.35f))));\n                    } else {\n                        let _e3305 = global.uMaskStyle;\n                        if (_e3305 < 3.5f) {\n                            let _e3308 = shownW;\n                            d_7 = vec3(_e3308);\n                        } else {\n                            let _e3310 = d_7;\n                            let _e3311 = shownW;\n                            d_7 = (_e3310 * _e3311);\n                        }\n                    }\n                }\n            }\n        }\n    }\n    let _e3313 = pointShow;\n    if (_e3313 >= 0f) {\n        let _e3316 = d_7;\n        let _e3321 = d_7;\n        let _e3322 = pointShow;\n        d_7 = mix(vec3((dot(_e3316, W709_) * 0.6f)), _e3321, vec3(_e3322));\n    }\n    let _e3325 = global.uShowClip;\n    if (_e3325 > 0f) {\n        {\n            let _e3328 = d_7;\n            let _e3330 = d_7;\n            let _e3332 = d_7;\n            if (max(_e3328.x, max(_e3330.y, _e3332.z)) >= 0.998f) {\n                d_7 = vec3<f32>(1f, 0.15f, 0.2f);\n            } else {\n                let _e3342 = d_7;\n                let _e3344 = d_7;\n                let _e3346 = d_7;\n                if (max(_e3342.x, max(_e3344.y, _e3346.z)) <= 0.004f) {\n                    d_7 = vec3<f32>(0.2f, 0.45f, 1f);\n                }\n            }\n        }\n    }\n    let _e3356 = d_7;\n    o_3 = vec4<f32>(_e3356.x, _e3356.y, _e3356.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e353 = o_3;\n    return FragmentOutput(_e353);\n}\n",
  "size": 3616,
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
   "uGlowF": [
    112,
    "vec4",
    0
   ],
   "uGlowF2": [
    128,
    "vec4",
    0
   ],
   "uOut2Ori": [
    144,
    "mat3",
    0
   ],
   "uOri2Photo": [
    192,
    "mat3",
    0
   ],
   "uOut2Crop": [
    240,
    "mat3",
    0
   ],
   "uOriCenter": [
    288,
    "vec2",
    0
   ],
   "uOriHalf": [
    296,
    "float",
    0
   ],
   "uCornerR2": [
    300,
    "float",
    0
   ],
   "uPersp": [
    304,
    "mat3",
    0
   ],
   "uDistort": [
    352,
    "float",
    0
   ],
   "uLensK": [
    368,
    "vec4",
    0
   ],
   "uLensC": [
    384,
    "vec2",
    0
   ],
   "uLensN": [
    392,
    "vec2",
    0
   ],
   "uLensVig": [
    400,
    "float",
    0
   ],
   "uLensVigMid": [
    404,
    "float",
    0
   ],
   "uDefringeP": [
    408,
    "float",
    0
   ],
   "uDefringeG": [
    412,
    "float",
    0
   ],
   "uShadowTint": [
    416,
    "float",
    0
   ],
   "uPhotoPx": [
    424,
    "vec2",
    0
   ],
   "uOut2Vig": [
    432,
    "mat3",
    0
   ],
   "uCropAspect": [
    480,
    "float",
    0
   ],
   "uBg": [
    496,
    "vec3",
    0
   ],
   "uExposure": [
    508,
    "float",
    0
   ],
   "uContrast": [
    512,
    "float",
    0
   ],
   "uContrastSat": [
    516,
    "float",
    0
   ],
   "uConPivot": [
    520,
    "float",
    0
   ],
   "uToneMap": [
    524,
    "float",
    0
   ],
   "uTmA": [
    528,
    "vec4",
    0
   ],
   "uTmB": [
    544,
    "vec4",
    0
   ],
   "uTmHue": [
    560,
    "float",
    0
   ],
   "uHighlights": [
    564,
    "float",
    0
   ],
   "uShadows": [
    568,
    "float",
    0
   ],
   "uWhites": [
    572,
    "float",
    0
   ],
   "uBlacks": [
    576,
    "float",
    0
   ],
   "uHlTop": [
    580,
    "float",
    0
   ],
   "uTexture": [
    584,
    "float",
    0
   ],
   "uClarity": [
    588,
    "float",
    0
   ],
   "uDehaze": [
    592,
    "float",
    0
   ],
   "uVibrance": [
    596,
    "float",
    0
   ],
   "uSaturation": [
    600,
    "float",
    0
   ],
   "uAirY": [
    604,
    "float",
    0
   ],
   "uSharpen": [
    608,
    "float",
    0
   ],
   "uSharpenRadius": [
    612,
    "float",
    0
   ],
   "uSharpenDetail": [
    616,
    "float",
    0
   ],
   "uSharpenMasking": [
    620,
    "float",
    0
   ],
   "uNrLum": [
    624,
    "float",
    0
   ],
   "uNrColor": [
    628,
    "float",
    0
   ],
   "uNrLumDetail": [
    632,
    "float",
    0
   ],
   "uNrLumContrast": [
    636,
    "float",
    0
   ],
   "uNrColorDetail": [
    640,
    "float",
    0
   ],
   "uNrColorSmooth": [
    644,
    "float",
    0
   ],
   "uVignette": [
    648,
    "float",
    0
   ],
   "uVigMid": [
    652,
    "float",
    0
   ],
   "uVigRound": [
    656,
    "float",
    0
   ],
   "uVigFeather": [
    660,
    "float",
    0
   ],
   "uVigStyle": [
    664,
    "float",
    0
   ],
   "uVigHighlights": [
    668,
    "float",
    0
   ],
   "uRefineSat": [
    672,
    "float",
    0
   ],
   "uBW": [
    676,
    "float",
    0
   ],
   "uGradeS": [
    688,
    "vec3",
    0
   ],
   "uGradeM": [
    704,
    "vec3",
    0
   ],
   "uGradeH": [
    720,
    "vec3",
    0
   ],
   "uGradeG": [
    736,
    "vec3",
    0
   ],
   "uGradeLum": [
    752,
    "vec4",
    0
   ],
   "uGradeShape": [
    768,
    "vec2",
    0
   ],
   "uGradeOn": [
    776,
    "float",
    0
   ],
   "uGrain": [
    784,
    "vec3",
    0
   ],
   "uShowClip": [
    796,
    "float",
    0
   ],
   "uMelissa": [
    800,
    "float",
    0
   ],
   "uOriSize": [
    808,
    "vec2",
    0
   ],
   "uMaskN": [
    816,
    "float",
    0
   ],
   "uMA": [
    832,
    "vec4",
    16
   ],
   "uMB": [
    1088,
    "vec4",
    16
   ],
   "uMC": [
    1344,
    "vec4",
    16
   ],
   "uMD": [
    1600,
    "vec4",
    16
   ],
   "uMR": [
    1856,
    "vec4",
    16
   ],
   "uME": [
    2112,
    "vec4",
    16
   ],
   "uMF": [
    2368,
    "vec4",
    16
   ],
   "uMP": [
    2624,
    "vec4",
    16
   ],
   "uMQ": [
    2880,
    "vec4",
    16
   ],
   "uMS": [
    3136,
    "vec4",
    16
   ],
   "uDcp": [
    3392,
    "float",
    0
   ],
   "uBaseSat": [
    3396,
    "float",
    0
   ],
   "uHsmDims": [
    3408,
    "vec4",
    0
   ],
   "uLookADims": [
    3424,
    "vec4",
    0
   ],
   "uLookBDims": [
    3440,
    "vec4",
    0
   ],
   "uS2P": [
    3456,
    "mat3",
    0
   ],
   "uP2S": [
    3504,
    "mat3",
    0
   ],
   "uPointView": [
    3552,
    "float",
    0
   ],
   "uMaskView": [
    3556,
    "float",
    0
   ],
   "uMaskColor": [
    3568,
    "vec3",
    0
   ],
   "uMaskOpacity": [
    3580,
    "float",
    0
   ],
   "uMaskStyle": [
    3584,
    "float",
    0
   ],
   "uMaskLine": [
    3588,
    "float",
    0
   ],
   "uMaskFeather": [
    3592,
    "float",
    0
   ],
   "frFlip": [
    3596,
    "float",
    0
   ],
   "frH": [
    3600,
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
  "hash": "9938b98d",
  "frag": "diagnostic(off, derivative_uniformity);\nstruct FrU {\n    uWB: vec3<f32>,\n    uCam: mat3x3<f32>,\n    uOutSize: vec2<f32>,\n    uGlowGain: f32,\n    uGlowMode: f32,\n    uGlowW: vec4<f32>,\n    uDcp: f32,\n    uContrast: f32,\n    frFlip: f32,\n    frH: f32,\n}\n\nstruct FragmentOutput {\n    @location(0) o: vec4<f32>,\n}\n\nconst W709_: vec3<f32> = vec3<f32>(0.2126f, 0.7152f, 0.0722f);\n\n@group(0) @binding(0) \nvar<uniform> global: FrU;\n@group(0) @binding(1) \nvar uSrc: texture_2d<f32>;\n@group(0) @binding(2) \nvar uSrc_s: sampler;\n@group(0) @binding(3) \nvar uTone: texture_2d<f32>;\n@group(0) @binding(4) \nvar uTone_s: sampler;\nvar<private> frFC: vec4<f32>;\nvar<private> o: vec4<f32>;\nvar<private> gl_FragCoord_1: vec4<f32>;\n\nfn toLinear(cam: vec3<f32>) -> vec3<f32> {\n    var cam_1: vec3<f32>;\n    var c: vec3<f32>;\n    var bal: vec3<f32>;\n    var clip: f32;\n\n    cam_1 = cam;\n    let _e28 = cam_1;\n    c = max(_e28, vec3(0f));\n    let _e33 = c;\n    let _e34 = global.uWB;\n    bal = min((_e33 * _e34), vec3(1f));\n    let _e42 = c;\n    let _e44 = c;\n    let _e46 = c;\n    clip = smoothstep(0.88f, 0.97f, max(_e42.x, max(_e44.y, _e46.z)));\n    let _e52 = bal;\n    let _e53 = bal;\n    let _e55 = bal;\n    let _e57 = bal;\n    let _e62 = clip;\n    bal = mix(_e52, vec3(max(_e53.x, max(_e55.y, _e57.z))), vec3(_e62));\n    let _e65 = global.uCam;\n    let _e66 = bal;\n    return (_e65 * _e66);\n}\n\nfn shown(y: f32) -> f32 {\n    var y_1: f32;\n    var t: f32;\n    var n: i32;\n    var p: f32;\n    var i: i32;\n    var local: f32;\n    var local_1: f32;\n    var d: f32;\n    var local_2: f32;\n\n    y_1 = y;\n    let _e30 = global.uDcp;\n    if (_e30 > 0.5f) {\n        {\n            let _e34 = textureDimensions(uTone, 0i);\n            n = vec2<i32>(_e34).x;\n            let _e38 = y_1;\n            let _e42 = n;\n            p = (clamp(_e38, 0f, 1f) * f32((_e42 - 1i)));\n            let _e48 = p;\n            let _e50 = n;\n            i = min(i32(_e48), (_e50 - 2i));\n            let _e55 = i;\n            let _e59 = textureLoad(uTone, vec2<i32>(_e55, 0i), 0i);\n            let _e61 = i;\n            let _e67 = textureLoad(uTone, vec2<i32>((_e61 + 1i), 0i), 0i);\n            let _e69 = p;\n            let _e70 = i;\n            t = mix(_e59.x, _e67.x, (_e69 - f32(_e70)));\n        }\n    } else {\n        let _e74 = y_1;\n        if (_e74 < 0.72f) {\n            let _e77 = y_1;\n            local = _e77;\n        } else {\n            let _e81 = y_1;\n            local = (0.72f + (0.28f * (1f - exp((-((_e81 - 0.72f)) / 0.28f)))));\n        }\n        let _e92 = local;\n        t = _e92;\n    }\n    let _e93 = t;\n    if (_e93 <= 0.0031308f) {\n        let _e96 = t;\n        local_1 = (_e96 * 12.92f);\n    } else {\n        let _e100 = t;\n        local_1 = ((1.055f * pow(_e100, 0.41666666f)) - 0.055f);\n    }\n    let _e109 = local_1;\n    d = _e109;\n    let _e111 = d;\n    let _e112 = global.uContrast;\n    let _e113 = d;\n    let _e114 = d;\n    let _e118 = d;\n    let _e122 = d;\n    d = clamp((_e111 + (_e112 * (((_e113 * _e114) * (3f - (2f * _e118))) - _e122))), 0f, 1f);\n    let _e129 = d;\n    if (_e129 <= 0.04045f) {\n        let _e132 = d;\n        local_2 = (_e132 / 12.92f);\n    } else {\n        let _e135 = d;\n        local_2 = pow(((_e135 + 0.055f) / 1.055f), 2.4f);\n    }\n    let _e143 = local_2;\n    return _e143;\n}\n\nfn main_1() {\n    var local_3: f32;\n    var cell: vec2<f32>;\n    var foot: f32;\n    var sum: vec3<f32> = vec3(0f);\n    var j: i32 = 0i;\n    var i_1: i32;\n    var uv: vec2<f32>;\n    var l: vec3<f32>;\n    var c_1: vec3<f32>;\n    var y_2: f32;\n    var y_3: f32;\n    var y_4: f32;\n\n    let _e28 = gl_FragCoord_1;\n    let _e30 = global.frFlip;\n    if (_e30 > 0.5f) {\n        let _e33 = global.frH;\n        let _e34 = gl_FragCoord_1;\n        local_3 = (_e33 - _e34.y);\n    } else {\n        let _e37 = gl_FragCoord_1;\n        local_3 = _e37.y;\n    }\n    let _e40 = local_3;\n    let _e41 = gl_FragCoord_1;\n    let _e42 = _e41.zw;\n    frFC = vec4<f32>(_e28.x, _e40, _e42.x, _e42.y);\n    let _e47 = global.uOutSize;\n    cell = (vec2(1f) / _e47);\n    let _e51 = global.uGlowW;\n    foot = _e51.w;\n    loop {\n        let _e59 = j;\n        if !((_e59 < 6i)) {\n            break;\n        }\n        i_1 = 0i;\n        loop {\n            let _e68 = i_1;\n            if !((_e68 < 6i)) {\n                break;\n            }\n            {\n                let _e75 = frFC;\n                let _e77 = i_1;\n                let _e79 = j;\n                let _e91 = foot;\n                let _e94 = cell;\n                uv = ((_e75.xy + ((((vec2<f32>(f32(_e77), f32(_e79)) + vec2(0.5f)) / vec2(6f)) - vec2(0.5f)) * _e91)) * _e94);\n                let _e97 = global.uCam;\n                let _e98 = uv;\n                let _e99 = textureSample(uSrc, uSrc_s, _e98);\n                let _e104 = global.uWB;\n                let _e110 = global.uGlowGain;\n                l = max(((_e97 * min((max(_e99.xyz, vec3(0f)) * _e104), vec3(1f))) * _e110), vec3(0f));\n                let _e116 = l;\n                let _e119 = l;\n                l = (_e116 * min(1f, (1f / max(dot(_e119, W709_), 0.00001f))));\n                let _e126 = sum;\n                let _e127 = l;\n                sum = (_e126 + _e127);\n            }\n            continuing {\n                let _e72 = i_1;\n                i_1 = (_e72 + 1i);\n            }\n        }\n        continuing {\n            let _e63 = j;\n            j = (_e63 + 1i);\n        }\n    }\n    let _e129 = sum;\n    c_1 = (_e129 / vec3(36f));\n    let _e134 = global.uGlowMode;\n    if (_e134 < 1.5f) {\n        {\n            let _e137 = c_1;\n            y_2 = dot(_e137, W709_);\n            let _e140 = y_2;\n            if (_e140 > 0.00001f) {\n                let _e143 = c_1;\n                let _e144 = y_2;\n                let _e145 = shown(_e144);\n                let _e146 = y_2;\n                c_1 = (_e143 * (_e145 / _e146));\n            }\n        }\n    }\n    let _e149 = global.uGlowMode;\n    if (_e149 < 0.5f) {\n        {\n            let _e152 = c_1;\n            y_3 = clamp(dot(_e152, W709_), 0f, 1f);\n            let _e158 = c_1;\n            let _e159 = global.uGlowW;\n            let _e161 = global.uGlowW;\n            let _e163 = y_3;\n            let _e166 = global.uGlowW;\n            let _e169 = y_3;\n            let _e174 = global.uGlowW;\n            c_1 = (_e158 * (_e159.z * pow(max(((_e161.x * _e163) / ((1f + _e166.x) - _e169)), 0f), _e174.y)));\n        }\n    } else {\n        let _e179 = global.uGlowMode;\n        if (_e179 < 1.5f) {\n            {\n                let _e182 = c_1;\n                y_4 = clamp(dot(_e182, W709_), 0f, 1f);\n                let _e188 = y_4;\n                let _e189 = global.uGlowW;\n                let _e193 = global.uGlowW;\n                let _e200 = global.uGlowW;\n                c_1 = vec3(pow(clamp(((_e188 - _e189.x) / (1f - _e193.x)), 0f, 1f), _e200.y));\n            }\n        }\n    }\n    let _e204 = c_1;\n    o = vec4<f32>(_e204.x, _e204.y, _e204.z, 1f);\n    return;\n}\n\n@fragment \nfn main(@builtin(position) gl_FragCoord: vec4<f32>) -> FragmentOutput {\n    gl_FragCoord_1 = gl_FragCoord;\n    main_1();\n    let _e37 = o;\n    return FragmentOutput(_e37);\n}\n",
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
   "uGlowMode": [
    76,
    "float",
    0
   ],
   "uGlowW": [
    80,
    "vec4",
    0
   ],
   "uDcp": [
    96,
    "float",
    0
   ],
   "uContrast": [
    100,
    "float",
    0
   ],
   "frFlip": [
    104,
    "float",
    0
   ],
   "frH": [
    108,
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
