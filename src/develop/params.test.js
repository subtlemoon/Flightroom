import { describe, expect, it } from 'vitest';
import { CURVE_PRESETS, defaults, fromXmp, isEdited, resetSection, sectionEdited, toXmp } from './params.js';
import { curveTable } from './luts.js';
import { newMask, newPart } from './masks.js';

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

  it('keeps masks in its own field and writes Lightroom mask records', () => {
    const m = newMask('linear', []);
    m.parts[0] = { ...m.parts[0], placed: true };
    m.parts.push({ ...newPart('brush', 'subtract'), strokes: [{ erase: false, size: 0.02, feather: 50, flow: 100, pts: [[0.123456789, 0.5], [0.2, 0.5]] }] });
    m.adj = { exposure: -1.5, clarity: 20 };
    const out = toXmp({ ...defaults(asShot), masks: [m] });
    expect(out.xml.GradientBasedCorrections).toContain('crs:LocalExposure2012="-1.500000"');
    expect(out.xml.GradientBasedCorrections).toContain('crs:LocalClarity2012="0.200000"');
    expect(out.xml.MaskGroupBasedCorrections).toBe('');
    const back = fromXmp(out.set, out.seqs, asShot, out.own);
    expect(back.masks[0].adj).toEqual(m.adj);
    expect(back.masks[0].parts[1].strokes[0].pts[0]).toEqual([0.1235, 0.5]);
    expect(isEdited(back, asShot)).toBe(true);
    // Deleting every mask clears both copies; a photo never masked here leaves Lightroom's alone.
    const cleared = toXmp({ ...back, masks: [] });
    expect(cleared.own.Masks).toBe('');
    expect(cleared.xml.GradientBasedCorrections).toBe('');
    expect(toXmp(defaults(asShot)).xml).toBeUndefined();
  });
});
