import { describe, expect, it } from 'vitest';
import {
  setUseInstalledProfiles,
  ADOBE_COLOR_CURVE, PP_TO_SRGB, SRGB_TO_PP, acr3, adobeRendering, applyHueSat, dcpTransform, hueSatFor,
  illuminantWeight, rgbToHsv, rgbTone, splineCurve, toneTable, withAdobe,
} from './adobe.js';
import { apply3, asShotTempTint, neutralToXy, tempTintToXy } from './color.js';
import { defaults, fromXmp, toXmp } from './params.js';

// A profile shaped like Adobe's (the Z7 II's matrices from rawler).
const CM_A = [1.4496, -0.8028, 0.0682, -0.465, 1.2681, 0.2185, -0.021, 0.0781, 0.8334];
const CM_D65 = [1.3705, -0.6004, -0.14, -0.5464, 1.3568, 0.2062, -0.094, 0.1706, 0.7618];
const FM = [0.7, 0.18, 0.08, 0.28, 0.8, -0.08, 0.02, -0.1, 0.9];
const identityMap = (h, s, v = 1) => ({ dims: [h, s, v], srgb: false, data: Array.from({ length: h * s * v }, () => [0, 1, 1]).flat() });
const profile = (extra = {}) => ({
  name: 'Adobe Standard', camera: 'Nikon Z 7_2', exposure_offset: 0, look: null, tone: null,
  illuminants: [
    { temp: 2850, color: CM_A, forward: FM, hue_sat: identityMap(6, 3) },
    { temp: 6500, color: CM_D65, forward: FM, hue_sat: { ...identityMap(6, 3), data: identityMap(6, 3).data.map((v, i) => (i % 3 === 1 ? 1.2 : v)) } },
  ],
  ...extra,
});
const close = (a, b, d = 1e-4) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(d)));

describe("Adobe's tone curves", () => {
  it('has the default curve of the DNG SDK', () => {
    expect(acr3(0)).toBe(0);
    expect(acr3(1)).toBe(1);
    expect(acr3(0.18)).toBeCloseTo(0.3881, 4);
    for (let x = 0; x < 1; x += 0.01) expect(acr3(x + 0.01)).toBeGreaterThanOrEqual(acr3(x));
  });

  it('solves splines through their points', () => {
    const f = splineCurve([[0, 0], [0.25, 0.15], [0.5, 0.55], [1, 1]]);
    expect(f(0.25)).toBeCloseTo(0.15, 9);
    expect(f(0.5)).toBeCloseTo(0.55, 9);
    expect(f(-1)).toBe(0);
    expect(f(2)).toBe(1);
    const line = splineCurve([[0, 0], [1, 1]]);
    expect(line(0.3)).toBeCloseTo(0.3, 9);
  });

  it("uses the profile's own curve, else the default", () => {
    expect(toneTable(profile())[2048]).toBeCloseTo(acr3(2048 / 4095), 6);
    const t = toneTable(profile({ tone: [0, 0, 1, 1] }));
    expect(t[1000]).toBeCloseTo(1000 / 4095, 6);
  });

  it('keeps hue through the tone curve', () => {
    const c = [0.5, 0.3, 0.1];
    const out = rgbTone(acr3, c);
    expect(rgbToHsv(out)[0]).toBeCloseTo(rgbToHsv(c)[0], 6);
    expect(out[0]).toBeCloseTo(acr3(0.5), 6);
    expect(out[2]).toBeCloseTo(acr3(0.1), 6);
    close(rgbTone(acr3, [0.2, 0.2, 0.2]), [acr3(0.2), acr3(0.2), acr3(0.2)]);
  });
});

describe('camera colour', () => {
  it('mixes the illuminants by temperature', () => {
    const dcp = profile();
    expect(illuminantWeight(dcp, tempTintToXy(2000, 0))).toBe(1);
    expect(illuminantWeight(dcp, tempTintToXy(9000, 0))).toBe(0);
    const g = illuminantWeight(dcp, tempTintToXy(4000, 0));
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThan(1);
  });

  it('turns the white point into white, with and without forward matrices', () => {
    for (const fm of [FM, null]) {
      const dcp = profile();
      dcp.illuminants.forEach((i) => { i.forward = fm; });
      for (const [temp, tint] of [[3000, 0], [5500, 10], [7100, 11]]) {
        const { wb, matrix } = dcpTransform(dcp, tempTintToXy(temp, tint));
        expect(Math.min(...wb)).toBeCloseTo(1, 9);
        // The camera's colour of the white point, balanced, is (1, 1, 1).
        close(apply3(matrix, [1, 1, 1]), [1, 1, 1], 1e-3);
      }
    }
  });

  it("works white balance out from Adobe's matrices", () => {
    const info = withAdobe({ adobe: { profiles: { 'Adobe Standard': profile() }, looks: {} }, asShot: [2.1, 1, 1.45], matrices: [] });
    expect(info.matrices).toEqual([[2850, CM_A], [6500, CM_D65]]);
    const { temp } = asShotTempTint(info);
    expect(temp).toBeGreaterThan(4000);
    expect(temp).toBeLessThan(8000);
    // As shot, the camera's neutral comes out white.
    const xy = neutralToXy(info.matrices, info.asShot.map((m) => 1 / m));
    close(dcpTransform(info.adobe.profiles['Adobe Standard'], xy).wb, [2.1, 1, 1.45], 1e-6);
  });

  it('blends the hue/sat maps for the white point', () => {
    const dcp = profile();
    expect(hueSatFor(dcp, 1).data[4]).toBe(1);
    expect(hueSatFor(dcp, 0).data[4]).toBeCloseTo(1.2, 6);
    expect(hueSatFor(dcp, 0.5).data[4]).toBeCloseTo(1.1, 6);
  });

  it('round-trips linear sRGB and ProPhoto', () => {
    close(apply3(PP_TO_SRGB, apply3(SRGB_TO_PP, [0.2, 0.5, 0.7])), [0.2, 0.5, 0.7], 1e-9);
    close(apply3(SRGB_TO_PP, [1, 1, 1]), [1, 1, 1], 1e-3);
  });
});

describe('hue/saturation maps', () => {
  it('leaves colours alone with an identity map', () => {
    for (const c of [[0.5, 0.3, 0.2], [0.1, 0.4, 0.8], [0.3, 0.3, 0.3], [0.9, 0.05, 0.6]]) close(applyHueSat(identityMap(90, 30), c), c, 1e-6);
    const m3 = { ...identityMap(36, 8, 16), srgb: true };
    close(applyHueSat(m3, [0.5, 0.3, 0.2]), [0.5, 0.3, 0.2], 1e-6);
  });

  it('shifts hue and scales saturation and value', () => {
    const m = identityMap(6, 2);
    for (let k = 0; k < m.data.length; k += 3) { m.data[k] = 60; m.data[k + 1] = 0.5; m.data[k + 2] = 0.8; }
    // Pure red: 60 degrees on is yellow; half the saturation; 80% of the value.
    const [h, s, v] = rgbToHsv(applyHueSat(m, [1, 0, 0]));
    expect(h).toBeCloseTo(1, 6);
    expect(s).toBeCloseTo(0.5, 6);
    expect(v).toBeCloseTo(0.8, 6);
  });
});

describe('profiles and looks', () => {
  setUseInstalledProfiles(true);
  const info = { adobe: { profiles: { 'Adobe Standard': profile(), 'Camera Standard': profile({ name: 'Camera Standard', exposure_offset: 0.25 }) }, looks: {} } };

  it('renders Adobe Standard, Adobe Color and Camera Standard from Lightroom’s profiles', () => {
    expect(adobeRendering(info, 'standard').curve).toBeNull();
    expect(adobeRendering(info, 'adobe').curve).toBe(ADOBE_COLOR_CURVE);
    const cam = adobeRendering(info, 'camera');
    expect(cam.name).toBe('Camera Standard');
    expect(cam.exposure - adobeRendering(info, 'standard').exposure).toBeCloseTo(0.25, 9);
    expect(adobeRendering(info, 'agx')).toBeNull();
    expect(adobeRendering({}, 'adobe')).toBeNull();
  });

  it('renders Adobe Standard and Adobe Color built in, from the camera\'s matrices', () => {
    const plain = { matrices: [[2856, CM_A], [6504, CM_D65]], adobe: { profiles: {}, looks: {} } };
    const r = adobeRendering(plain, 'standard');
    expect(r.dcp.builtIn).toBe(true);
    expect(r.dcp.illuminants.map((i) => i.temp)).toEqual([2856, 6504]);
    expect(r.tables).toEqual([]);
    // The same object each time (the graphics card's tables are made once).
    expect(adobeRendering(plain, 'adobe').dcp).toBe(r.dcp);
    expect(adobeRendering(plain, 'adobe').curve).toBe(ADOBE_COLOR_CURVE);
    expect(adobeRendering(plain, 'camera')).toBeNull();
    const { matrix } = dcpTransform(r.dcp, tempTintToXy(6000, 5));
    close(apply3(matrix, [1, 1, 1]), [1, 1, 1], 1e-3);
  });

  it("uses Adobe Color's own table and curve when Lightroom's copy is here", () => {
    const table = identityMap(36, 8, 16);
    const withLook = { adobe: { ...info.adobe, looks: { 'Adobe Color': { name: 'Adobe Color', table, curve: [[0, 0], [255, 255]] } } } };
    const r = adobeRendering(withLook, 'adobe');
    expect(r.tables).toEqual([table]);
    expect(r.curve).toEqual([[0, 0], [255, 255]]);
  });

  it('reads and writes the profile the way Lightroom does', () => {
    const asShot = { temp: 5500, tint: 0 };
    expect(fromXmp({}, {}, asShot).profile).toBe('adobe');
    expect(fromXmp({ CameraProfile: 'Adobe Standard' }, {}, asShot).profile).toBe('standard');
    expect(fromXmp({ CameraProfile: 'Adobe Standard' }, {}, asShot, {}, 'Adobe Color').profile).toBe('adobe');
    expect(fromXmp({ CameraProfile: 'Camera Standard' }, {}, asShot).profile).toBe('camera');
    const std = toXmp({ ...defaults(asShot), profile: 'standard' });
    expect(std.set.CameraProfile).toBe('Adobe Standard');
    expect(std.remove).toContain('Look');
    const color = toXmp({ ...defaults(asShot), profile: 'adobe' });
    expect(color.remove).toContain('CameraProfile');
    expect(color.remove).not.toContain('Look');
  });
});
