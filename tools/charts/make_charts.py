"""Test-chart DNGs for fitting Flightroom to Lightroom (tools/lr-tone.md).

Each chart is a linear DNG that Lightroom treats as a Nikon Z 7II raw file
(Adobe Standard profile, D65 white so only the profile's D65 tables apply),
with its develop settings embedded, so a batch export from Lightroom gives one
JPEG per slider setting. The same camera data is written as a .frim/.json pair
for the Develop test rig, so Flightroom renders exactly the same input.

  python3 tools/charts/make_charts.py <JWL_7345.json from raw_dump> <out dir>
"""
import json, struct, sys, os
import numpy as np

W, H, CELL, PATCH = 1200, 800, 40, 34
PP2XYZ = np.array([[0.7977, 0.1352, 0.0313], [0.2880, 0.7119, 0.0001], [0.0, 0.0, 0.8249]])
D65 = np.array([0.95047, 1.0, 1.08883])
BASELINE = 0.072  # src/develop/adobe.js BASELINE_EXPOSURE (Lightroom's for this camera's NEFs)


def oklab_to_xyz65(L, a, b):
    l_, m_, s_ = L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.2914855480 * b
    lms = np.array([l_ ** 3, m_ ** 3, s_ ** 3])
    srgb = np.array([[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965], [-0.0041960863, -0.7034186147, 1.7076147010]]) @ lms
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    return m @ srgb


BRAD65_50 = np.array([[1.0478112, 0.0228866, -0.0501270], [0.0295424, 0.9904844, -0.0170491], [-0.0092345, 0.0150436, 0.7521316]])


def patches():
    """(name, linear ProPhoto D50) for the grey ramp, then colours on an OKLab grid."""
    out = [(f'grey{i:02d}', np.full(3, 2.0 ** e)) for i, e in enumerate(np.linspace(-10, 0, 21))]
    xyz2pp = np.linalg.inv(PP2XYZ)
    for L in (0.35, 0.5, 0.65, 0.8):
        for C in (0.05, 0.1, 0.16):
            for h in range(0, 360, 30):
                a, b = C * np.cos(np.radians(h + 15)), C * np.sin(np.radians(h + 15))
                pp = xyz2pp @ (BRAD65_50 @ oklab_to_xyz65(L, a, b))
                if pp.min() >= 0: out.append((f'L{L}_C{C}_h{h + 15}', pp))
    for i, (L, a, b) in enumerate([(0.75, 0.04, 0.05), (0.62, 0.05, 0.06), (0.5, 0.05, 0.05), (0.4, 0.04, 0.04)]):  # skin
        out.append((f'skin{i}', xyz2pp @ (BRAD65_50 @ oklab_to_xyz65(L, a, b))))
    return out


SCENES = {  # background linear ProPhoto grey, bright lights
    'mid': (0.18, False),
    'night': (0.006, True),
    'bright': (0.55, False),
}


def scene(bg, lights, cam_of):
    img = np.tile(cam_of(np.full(3, bg)), (H, W, 1)).astype(np.float64)
    cells, cols = [], (W * 3 // 5) // CELL
    for k, (name, pp) in enumerate(patches()):
        r, c = divmod(k, cols)
        y, x = 20 + r * CELL, 20 + c * CELL
        img[y:y + PATCH, x:x + PATCH] = cam_of(pp)
        cells.append({'name': name, 'x': x + PATCH // 2, 'y': y + PATCH // 2, 'pp': [round(v, 6) for v in pp]})
    if lights:  # street lights: white cores just under clipping, neutral glow fading out (~4% of the frame)
        yy, xx = np.mgrid[0:H, 0:W]
        core, glow_c = cam_of(np.full(3, 1.9)), cam_of(np.full(3, 1.0))
        for cx, cy, rad in [(820, 150, 22), (950, 300, 30), (1100, 120, 18), (880, 600, 26), (1080, 520, 20)]:
            d = np.hypot(xx - cx, yy - cy)
            glow = (d >= rad) & (d < rad * 4)
            img[glow] = np.maximum(img[glow], np.outer(np.exp(-(d[glow] - rad) / (rad * 0.8)), glow_c))
            img[d < rad] = core
    return np.clip(img, 0, 1), cells


def variants():
    v = [('mid', 'reset', {}), ('night', 'reset', {}), ('bright', 'reset', {})]
    for k, vals in [('Exposure2012', ['-1.00', '+1.00']), ('Contrast2012', ['-100', '-50', '+50', '+100']),
                    ('Highlights2012', ['-100', '-50', '+50', '+100']), ('Shadows2012', ['-100', '-50', '+50', '+100']),
                    ('Whites2012', ['-100', '-50', '+50', '+100']), ('Blacks2012', ['-100', '-50', '+50', '+100']),
                    ('Vibrance', ['-50', '+50', '+100']), ('Saturation', ['-50', '+50', '+100']),
                    ('Clarity2012', ['-50', '+50']), ('Dehaze', ['-50', '+50']), ('Texture', ['+50'])]:
        v += [('mid', f'{k}{x}', {k: x}) for x in vals]
    for k in ('Shadows2012', 'Blacks2012', 'Highlights2012', 'Whites2012', 'Contrast2012'):
        for s in ('night', 'bright'):
            v += [(s, f'{k}{x}', {k: x}) for x in ('-100', '+100')]
    for c in ('Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'):
        for kind in ('Saturation', 'Hue', 'Luminance'):
            v += [('mid', f'{kind}{c}{x}', {f'{kind}Adjustment{c}': x}) for x in ('-50', '+50')]
    v += [('mid', f'SaturationRed{x}', {'SaturationAdjustmentRed': x}) for x in ('-100', '-24', '+100')]
    for reg, hk, sk in [('Shadow', 'SplitToningShadowHue', 'SplitToningShadowSaturation'), ('Mid', 'ColorGradeMidtoneHue', 'ColorGradeMidtoneSat'),
                        ('High', 'SplitToningHighlightHue', 'SplitToningHighlightSaturation'), ('Global', 'ColorGradeGlobalHue', 'ColorGradeGlobalSat')]:
        for hue in (30, 220):
            v += [('mid', f'Grade{reg}_h{hue}_s{s}', {hk: str(hue), sk: str(s)}) for s in (25, 50, 100)]
    v += [('mid', 'GradeShadow_h220_s50_bal+50', {'SplitToningShadowHue': '220', 'SplitToningShadowSaturation': '50', 'SplitToningBalance': '+50'}),
          ('mid', 'GradeShadow_h220_s50_blend100', {'SplitToningShadowHue': '220', 'SplitToningShadowSaturation': '50', 'ColorGradeBlending': '100'}),
          ('mid', 'Curve_S', {'_curve': [[0, 0], [64, 40], [192, 215], [255, 255]]}),
          ('mid', 'Curve_S_refine50', {'_curve': [[0, 0], [64, 40], [192, 215], [255, 255]], 'CurveRefineSaturation': '50'}),
          ('night', 'JWL_7530_settings', '7530'), ('mid', 'JWL_7345_settings', '7345')]
    return v


BASE = {'ProcessVersion': '11.0', 'Version': '15.0', 'CameraProfile': 'Adobe Standard', 'WhiteBalance': 'As Shot', 'HasSettings': 'True',
        'AlreadyApplied': 'False', 'Exposure2012': '0.00', 'Contrast2012': '0', 'Highlights2012': '0', 'Shadows2012': '0', 'Whites2012': '0',
        'Blacks2012': '0', 'Texture': '0', 'Clarity2012': '0', 'Dehaze': '0', 'Vibrance': '0', 'Saturation': '0', 'Sharpness': '0',
        'LuminanceSmoothing': '0', 'ColorNoiseReduction': '0', 'LensProfileEnable': '0', 'AutoLateralCA': '0', 'ToneCurveName2012': 'Linear',
        'CurveRefineSaturation': '100', 'ColorGradeBlending': '50', 'SplitToningBalance': '0', 'ParametricShadows': '0', 'ParametricDarks': '0',
        'ParametricLights': '0', 'ParametricHighlights': '0', 'ParametricShadowSplit': '25', 'ParametricMidtoneSplit': '50',
        'ParametricHighlightSplit': '75', 'PostCropVignetteAmount': '0', 'VignetteAmount': '0', 'GrainAmount': '0', 'HasCrop': 'False',
        **{f'{k}Adjustment{c}': '0' for k in ('Hue', 'Saturation', 'Luminance') for c in ('Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta')},
        **{k: '0' for k in ('SplitToningShadowHue', 'SplitToningShadowSaturation', 'SplitToningHighlightHue', 'SplitToningHighlightSaturation',
                            'ColorGradeMidtoneHue', 'ColorGradeMidtoneSat', 'ColorGradeGlobalHue', 'ColorGradeGlobalSat', 'ColorGradeShadowLum',
                            'ColorGradeMidtoneLum', 'ColorGradeHighlightLum', 'ColorGradeGlobalLum')}}
LINEAR = [[0, 0], [255, 255]]


def xmp(settings, curve):
    attrs = '\n'.join(f'   crs:{k}="{v}"' for k, v in settings.items())
    seq = lambda tag, pts: f'   <crs:{tag}><rdf:Seq>' + ''.join(f'<rdf:li>{x}, {y}</rdf:li>' for x, y in pts) + f'</rdf:Seq></crs:{tag}>\n'
    curves = seq('ToneCurvePV2012', curve) + ''.join(seq(f'ToneCurvePV2012{c}', LINEAR) for c in ('Red', 'Green', 'Blue'))
    return ('<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
            '  <rdf:Description rdf:about="" xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"\n' + attrs + '>\n' + curves +
            '  </rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>').encode()


def dng(path, cam16, xmp_bytes, cm1, cm2, fm1, fm2, neutral):
    h, w, _ = cam16.shape
    data = cam16.astype('<u2').tobytes()
    srat = lambda vals: b''.join(struct.pack('<ii', int(round(x * 10000)), 10000) for x in vals)
    urat = lambda vals: b''.join(struct.pack('<II', int(round(x * 1000000)), 1000000) for x in vals)
    asc = lambda s: s.encode() + b'\0'
    tags = [(254, 4, [0]), (256, 4, [w]), (257, 4, [h]), (258, 3, [16, 16, 16]), (259, 3, [1]), (262, 3, [34892]),
            (271, 2, asc('NIKON CORPORATION')), (272, 2, asc('NIKON Z 7_2')), (273, 4, None), (274, 3, [1]), (277, 3, [3]),
            (278, 4, [h]), (279, 4, [len(data)]), (284, 3, [1]), (305, 2, asc('Flightroom test chart')), (700, 1, xmp_bytes),
            (50706, 1, bytes([1, 4, 0, 0])), (50707, 1, bytes([1, 1, 0, 0])), (50708, 2, asc('Nikon Z 7 2')),
            (50714, 4, [0, 0, 0]), (50717, 4, [65535] * 3), (50721, 10, srat(cm1)), (50722, 10, srat(cm2)),
            (50728, 5, urat(neutral)), (50730, 10, srat([BASELINE])), (50778, 3, [17]), (50779, 3, [21]),
            (50964, 10, srat(fm1)), (50965, 10, srat(fm2))]
    size = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 10: 8}
    ifd_len = 2 + 12 * len(tags) + 4
    extra_off = 8 + ifd_len
    entries, extra = [], b''
    for tag, typ, val in tags:
        if tag == 273: entries.append((tag, typ, 1, None)); continue
        raw = val if isinstance(val, bytes) else b''.join(struct.pack({3: '<H', 4: '<I'}[typ], x) for x in val)
        count = len(raw) // size[typ]
        if len(raw) <= 4: entries.append((tag, typ, count, raw.ljust(4, b'\0')))
        else:
            if (extra_off + len(extra)) % 2: extra += b'\0'
            entries.append((tag, typ, count, struct.pack('<I', extra_off + len(extra)))); extra += raw
    strip = extra_off + len(extra) + ((extra_off + len(extra)) % 2)
    ifd = struct.pack('<H', len(tags)) + b''.join(struct.pack('<HHI', t, ty, c) + (struct.pack('<I', strip) if v is None else v) for t, ty, c, v in entries) + b'\0\0\0\0'
    with open(path, 'wb') as f:
        f.write(b'II*\0' + struct.pack('<I', 8) + ifd + extra + b'\0' * (strip - extra_off - len(extra)) + data)


def main(ref_json, out):
    os.makedirs(out, exist_ok=True); os.makedirs(os.path.join(out, 'rig'), exist_ok=True)
    ref = json.load(open(ref_json))
    ill = ref['adobe']['profiles']['Adobe Standard']['illuminants']
    cm1, cm2 = np.array(ill[0]['color']).reshape(3, 3), np.array(ill[1]['color']).reshape(3, 3)
    fm1, fm2 = np.array(ill[0]['forward']).reshape(3, 3), np.array(ill[1]['forward']).reshape(3, 3)
    neutral = cm2 @ D65; neutral /= neutral.max()
    # DNG: XYZ(D50) = FM2 . diag(1/neutral) . cam, so cam = diag(neutral) . FM2^-1 . XYZ(D50); 0.5 headroom below white.
    to_cam = np.diag(neutral) @ np.linalg.inv(fm2) @ PP2XYZ
    cam_of = lambda pp: to_cam @ np.asarray(pp) * 0.5
    other = {'7530': '/tmp/r7530/JWL_7530.json', '7345': ref_json}
    meta = {}
    for sc, (bg, lights) in SCENES.items():
        img, cells = scene(bg, lights, cam_of)
        meta[sc] = cells
        q = np.round(img * 65535).astype(np.uint16)
        np.save(os.path.join(out, 'rig', f'{sc}.npy'), q)
        # The rig's copy: the frame Flightroom's decoder would hand Develop (camera RGB, white 1, half floats).
        frim = struct.pack('<4sIII', b'FRIM', W, H, 3) + (q.astype(np.float32) / 65535).astype('<f2').tobytes()
        open(os.path.join(out, 'rig', f'{sc}.frim'), 'wb').write(frim)
    for i, (sc, name, ch) in enumerate(variants()):
        if isinstance(ch, str):  # a real photo's settings on the chart
            j = json.load(open(other[ch])); s = {**BASE, **{k: v for k, v in j['settings'].items() if k in BASE or 'Adjustment' in k or 'ColorGrade' in k or 'SplitToning' in k or k.startswith('Curve')}}
            s['LensProfileEnable'] = '0'; curve = [[int(float(t)) for t in p.split(',')] for p in j['curves'].get('ToneCurvePV2012', ['0, 0', '255, 255'])]
        else:
            s = {**BASE, **{k: v for k, v in ch.items() if not k.startswith('_')}}
            curve = ch.get('_curve', LINEAR)
            if '_curve' in ch: s['ToneCurveName2012'] = 'Custom'
        fname = f'{i:03d}_{sc}_{name}'
        q = np.load(os.path.join(out, 'rig', f'{sc}.npy'))
        dng(os.path.join(out, fname + '.dng'), q, xmp(s, curve), cm1.flat, cm2.flat, fm1.flat, fm2.flat, neutral)
        os.symlink(f'{sc}.frim', os.path.join(out, 'rig', fname + '.frim'))
        rj = {**ref, 'width': W, 'height': H, 'orientation': 1, 'lens': None, 'asShot': list(1 / neutral), 'own': {},
              'settings': s, 'curves': {'ToneCurvePV2012': [f'{x}, {y}' for x, y in curve], **{f'ToneCurvePV2012{c}': ['0, 0', '255, 255'] for c in ('Red', 'Green', 'Blue')}}}
        json.dump(rj, open(os.path.join(out, 'rig', fname + '.json'), 'w'))
    json.dump(meta, open(os.path.join(out, 'rig', 'patches.json'), 'w'))
    print(len(variants()), 'charts,', len(meta['mid']), 'patches')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
