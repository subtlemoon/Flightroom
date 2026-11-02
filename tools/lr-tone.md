# How Flightroom's Basic tone sliders were matched to Lightroom

## The base rendering (profiles)
Built in, with nothing else installed, Adobe Standard and Adobe Color render
through Adobe's DNG SDK pipeline with the camera's own colour matrices (Adobe's,
from rawler) and Adobe's default tone curve; Adobe Color adds its point curve.
Adobe's per-camera profile files can't be shipped, but with Lightroom Classic
or the free Adobe DNG Converter on the computer, Develop renders Adobe
Standard, Adobe Color and Camera Standard from those files (`src-tauri/src/adobe.rs`,
`src/develop/adobe.js`), step for step as Adobe's DNG SDK (`dng_render.cpp`,
`dng_reference.cpp`, `dng_color_spec.cpp`): forward matrix to ProPhoto, the
hue/saturation map, exposure, the look tables (the profile's, then Adobe
Color's), and the profile's tone curve (Adobe's default curve when it has
none) applied hue-preserving (`RefBaselineRGBTone`). Adobe Color adds its
look's point curve before the photo's own.

NEF files carry no baseline exposure, so `BASELINE_EXPOSURE` (0.072 EV) puts
middle grey where the fitted look below had it. The fitted looks (`LOOKS` in
`renderer.js`) are only used for Camera Standard without Adobe's profile.

The constants are `HL_*`, `SH_*`, `WH_*` and `BL_*` in `src/develop/shaders.js`.

## Measured against Lightroom's own exports (2.9.6)
JWL_7451.NEF rendered by the real pipeline (headless Chromium) with Lightroom's
Z 7II Adobe Standard profile, against four Lightroom Classic exports of it:
defaults, the Basic tone sliders only (Exposure -0.10, Contrast -95,
Highlights -93, Shadows +96, Whites -92, Blacks +85), those plus the point
curve (97->21, 176->209), and the full edit. Lightroom's exports are
lens-corrected (Nikon Z's built-in profile), so Flightroom's render is aligned
to them by a radial fit (8.8% zoom, k1 0.056) first.

Mean dE76 of the regions (sky, white suits, skin, red suits, trees, grass,
road, black suit), and the median over all pixels:

| export | 2.9.4 | 2.9.5 | 2.9.6 |
|---|---|---|---|
| defaults | 4.1 | 1.6 | 1.4 (median 2.1) |
| tone sliders | 7.2 | 3.2 | 3.2 (median 2.2) |
| tone sliders + curve | 6.5 | 5.3 | 2.4 (median 4.3) |
| full edit | 4.7 | 4.6 | 3.8 (median 4.0) |

What was fitted, and how:
- Base at defaults: +0.08 EV, contrast +0.19 (Contrast +25), 12% more
  saturation on scene light (`BASE` in renderer.js).
- Blacks/Whites brightening is 75% added grey (`LIFT_GREY`).
- Highlights 1.1; the Highlights/Shadows base follows edges from a third of
  a stop (small bright things get it fully).
- The point curve: Lightroom's own pixels (Tone Slider export -> Tone Curve
  export) show it's per channel in Melissa RGB, through Adobe's C2 cubic
  spline (dng_spline_solver, which dips below black between steep points),
  rms 0.013 against 0.033 for a monotone curve (`pointCurve` in luts.js).
- Contrast changes colour, weak colours most (`CS_K`, `CS_V`): Lightroom's
  Contrast -95 takes the sky to 40% of its colour.

Left: the full edit's colourful parts are a few C* weak (Saturation -8 seems
stronger than Lightroom's; not separable from these exports), and white suits
and the road about 2.5-3 L* bright.

## Targets

### Change per L* band at -100 (+100 for Shadows)
These are Lightroom Classic black-box measurements (PV2012), published in
storytold/lightcraft PR #2313 and issue #523: medians over three Canon scenes, plus Nikon for Shadows.

| band (L*)   | 0-10 | 10-20 | 20-30 | 30-40 | 40-50 | 50-60 | 60-70 | 70-80 | 80-90 | 90-100 |
|-------------|------|-------|-------|-------|-------|-------|-------|-------|-------|--------|
| Whites -100 | 0    | -0.5  | -0.8  | -1.3  | -2.3  | -3.4  | -4.6  | -7.1  | -9.5  | -9.9   |
| Blacks -100 | -5.5 | -14.2 | -22.0 | -20.7 | -16.3 | -12.8 | -9.0  | -5.3  | -2.4  | -1.0   |
| Highl. -100 | -0.2 | -0.9  | -1.5  | -2.1  | -3.5  | -5.9  | -8.9  | -14.0 | -19.3 | -15.6  |
| Shad. +100  |      | +5    | +9    | +8    | +7    | +5.5  | +3.5  | +1.8  | +0.6  |        |

### Tone controls and the tone curve
Lightroom works in ProPhoto primaries with the sRGB tone response ("Melissa RGB"),
per Peachpit's "The Lightroom RGB" chapter. The point curve is applied in that space.

### A full Lightroom export
Jaewon's JWL_7451.NEF, exported from Lightroom with Contrast -95, Highlights -93,
Shadows +96, Whites -92, Blacks +85 and an S curve. Positive Blacks has no
published numbers, so `BL_LIFT` is fitted to this export.

## Shapes
Whites and Blacks act on the encoded screen brightness `y` (colours scale with it):
- Whites -: `y -= 0.13·|w|·y²`
- Whites +: `y *= 1 + 0.3·w·y`
- Blacks: `y += b·k·y·(1-y)^2.36`, with `k` = 1.4 for negative and 1.0 for positive.
  Positive Blacks also adds `0.12·b·(1-y)`.

Highlights and Shadows shift the edge-aware base in stops:
- Highlights: `0.9 · smoothstep(0.2, 1, base)`
- Shadows: `0.72 · (1 - smoothstep(0, 0.9, base))`

## Result on JWL_7451, Flightroom vs Lightroom (rendered in the browser rig)
- Single sliders: within about 1-3 L* of the table in the bands the photo covers
  (it has nothing above L* 90).
- The full edit: median per tone band within about 0.05. Saturation (mean max-min)
  is 0.137 in Flightroom and 0.139 in Lightroom; before the ProPhoto curve it was 0.084.

## How to measure
1. `FLIGHTROOM_RAW_DUMP=x.NEF cargo test raw_dump` writes `x.frim` and `x.json`.
2. Render them in the Playwright rig (mocked Tauri) with single-slider overrides
   and the curves removed.
3. Bin the pixels by the neutral render's L*, then take the median change per band.
