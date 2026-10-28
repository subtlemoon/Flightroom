import { describe, expect, it } from 'vitest';
import { CURVE_PRESETS, defaults, fromXmp, isEdited, resetSection, sectionEdited, toXmp } from './params.js';
import { curveTable } from './luts.js';

const asShot = { temp: 5450, tint: 15 };

describe('develop settings in the sidecar', () => {
  it('round-trips every panel through Lightroom names', () => {
    const s = {
      ...defaults(asShot), profile: 'camera', bw: true, wb: 'Tungsten', temp: 2850, tint: 0,
      exposure: 0.35, gShadowHue: 220, gShadowSat: 40, gBalance: -20, perspVertical: 30, perspScale: 90,
      distortion: -12, removeCA: true, vignetteStyle: 3, grain: 25, redHue: 10, gray4: -60, refineSat: 40,
      curveR: [[0, 0], [128, 150], [255, 255]], constrainCrop: true, crop: { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9, angle: 2 },
    };
    const { set, seqs } = toXmp(s);
    expect(set).toMatchObject({ CameraProfile: 'Camera Standard', ConvertToGrayscale: 'True', WhiteBalance: 'Tungsten', SplitToningShadowHue: '220', ColorGradeMidtoneHue: '0', PerspectiveVertical: '+30', PerspectiveScale: '90', AutoLateralCA: '1', PostCropVignetteStyle: '3', GrayMixerAqua: '-60', CropConstrainToWarp: '1' });
    const back = fromXmp(set, seqs, asShot);
    for (const k of Object.keys(s)) {
      if (k === 'crop') expect(back.crop.left).toBeCloseTo(0.1);
      else expect(back[k]).toEqual(s[k]);
    }
  });

  it('knows which sections are edited and resets one alone', () => {
    const s = { ...defaults(asShot), grain: 30, exposure: 1 };
    expect(sectionEdited(s, 'effects', asShot)).toBe(true);
    expect(sectionEdited(s, 'detail', asShot)).toBe(false);
    const r = resetSection(s, 'effects', asShot);
    expect(r.grain).toBe(0);
    expect(r.exposure).toBe(1);
    expect(isEdited(resetSection(r, 'basic', asShot), asShot)).toBe(false);
  });

  it('lets a curve fall (inverting the photo)', () => {
    const t = curveTable({ ...defaults(asShot), curve: [[0, 255], [255, 0]] });
    expect(t[0]).toBeCloseTo(1);
    expect(t[(t.length / 4 - 1) * 4]).toBeCloseTo(0);
    expect(CURVE_PRESETS.length).toBe(3);
  });
});
