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

## Each slider on its own (2.9.9)
Lightroom exports of JWL_7451 with one slider moved from defaults (Adobe
Standard): Shadows +96, Blacks +85, Contrast -96, plus Camera Standard at
defaults. The earlier fits were made on the combined edit, where errors
cancelled: Blacks lifted twice as much as Lightroom's, Shadows lifted the
deepest darks a third as much and reached too far up, Contrast pivoted too low
and didn't take colour out. Each is now fitted on its own export:

| slider | brightness per band | region error |
|---|---|---|
| Shadows +96 | within ~1 L* (`SH_K` 1.3 to `SH_HI` 0.65, `SH_DEEP` 0.8 below 0.2; colour held, `SH_C`) | 1.8 dE |
| Blacks +85 | within ~1 L* (`BL_POS` 0.55, `BL_LIFT` 0.035, 90% added grey) | 1.0 dE |
| Contrast -96 | within ~1 L* (S-curve around 0.6, 60% on brightness; `CON_*`, `CS_K` 0.25) | 1.3 dE |

2.9.10 adds Highlights -93 and Whites -92 exports:

| slider | fit | region error |
|---|---|---|
| Highlights -93 | `HL_K` 1.0 (2.9.9 had 0.5 from the combined edit) | 3.2 dE |
| Whites -92 | on the cube of brightness, `WH_NEG` 0.24 (only the brightest) | 2.4 dE |

Alone, every slider now matches; together at this edit's extremes they
overlapped, so Highlights eases by half as Contrast goes to -100 (`HL_X`) and
Shadows by a fifth as Blacks goes to +100 (`SH_X`), which leaves each slider
alone as fitted. Combined: tone sliders 1.8 dE (median 1.7), with the curve
2.2 (3.5), the full edit 3.9 (3.1). The red suits' brightness now matches with
the curve; their hue is still about 4-5 degrees pinker than Lightroom's.

2.10.2, from the histogram: Lightroom's Highlights is strongest on upper
midtones and eases off on the brightest areas themselves. At -93 it takes
L* 70-75 down 13.8 but L* 80-85 (the bright sky) only 10.2; Flightroom kept
growing to 14.4 there, which flattened the sky into a spike at the top of the
histogram (brightest 0.5% at 161 vs Lightroom's 174, on 0-255). The weight is
now `HL_K 1.3 · smoothstep(0.35, 1, wide) · (1 - 0.55 · smoothstep(0.65, 0.85, base))`:
the taper follows the edge-aware base, since inside a big sky the wide
neighbourhood never gets near white. Highlights alone now tops out at 171
(Lightroom 174); region errors unchanged (Highlights 3.4, full 3.9).

The histogram itself was compared as counts: per channel the two overlap by
85-91%, medians within 2-4 levels. What looked different was mostly the
drawing, which 2.10.2 makes Lightroom's: counts to scale (it was a square
root, which stretched the low parts up), lightly smoothed, channels added so
all three together show grey.

## Fine detail (2.9.7): hair, skin, and Develop's view
Measured on the top-left driver's hair, full resolution, against Lightroom's
full-edit export (mean |Laplacian| of the hair: Lightroom 21.6):
- Negative Texture smoothed hair strands as much as skin (17.6). Lightroom's
  spares strong detail: Flightroom's now fades out from 0.08 to 0.25 stops of
  local contrast (19.5).
- Highlights/Shadows decided each pixel's lift from an edge-hugging base, so a
  lighter strand got less lift than the dark gap beside it, and the contrast
  between them flattened. 2.9.7 took the lift from the coarse guide instead,
  which kept the strands but let the bright sky into the hair's neighbourhood:
  the hair got less Shadows and came out 10 L* too dark. 2.9.8 takes it from
  a strand-sized neighbourhood (rings of 4 and 8 px, following edges past
  1 stop: `LIFT_R`, `LIFT_EDGE`): hair L* 32.5 (Lightroom 31.8), fine detail
  24.7 (Lightroom 21.6); region error full edit 3.8, tone + curve 2.4.
- Contrast keeps hue (brightest and darkest channel, the middle one in
  between), as Adobe's tone curves do: per channel it turned strong reds pink.
- Still open: the red suits are about 4-5 degrees pinker and, with the curve,
  about 2 L* brighter than Lightroom. Lightroom's own Tone Slider export put
  through the point curve reproduces its Tone Curve export exactly, so the
  curve is right; the reds going into it carry a red channel about 0.02 high
  (already at defaults).
- Develop, smaller than 100%, now shows the view processed again from
  full-resolution raw data and scaled down through mipmaps once it settles
  (Renderer.refine), instead of only the 2x2-merged preview.

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

## A second photo: adaptive Shadows and Blacks, Whites, colour grading (2.10.5)
Lightroom export of JWL_7345 (same shoot, ISO 3600, 0.86 stop brighter than
JWL_7451 at defaults) with Contrast -95, Highlights -94, Shadows +91, Whites -95,
Blacks +91, the point curve (121->51, 175->183), Red saturation -24 and colour
grading (shadows 217/45, midtones 11/20, blending 50). Compared after a dense
optical-flow alignment (Lightroom's export is lens-corrected). A second export
of a virtual copy with the grading at 0 (test-4.jpg) separates the tone from
the grade: fit the tone against the ungraded export, then the grade as the
change between the two exports.

- Darks came out 6-9 L* light. Lightroom's PV2012 sliders adapt to the photo:
  `liftScale` (renderer.js) scales positive Shadows and Blacks by
  2^(-0.4 * (key - -3.97)), key = median scene brightness (log2, from the
  guide), clamped 0.6-1.3; `highlightTop` tapers the Highlights top end the same
  way. Whites below 0 pull the top in with a soft knee (shaders.js) so the sky
  keeps its cloud texture.
- Colour grading is fitted in OKLab (shaders.js, luts.js `gradeTints`):
  logistic regions on OKLab L (centre 0.639, offset 0.165, width 0.0943 at
  blending 50), each adds K=0.0787 * amount * L^0.361 along the wheel hue's
  OKLab direction turned -45.5 degrees, scales existing chroma by
  1 - 0.18 * amount, and darkens L by 0.248 * amount, less for colours already
  leaning the tint's way (1 - 7 * ab.dir). An RGB multiply fitted the bands but
  turned red suits maroon; Lightroom keeps them within ~2 L*.

Result: median dE 8.6 -> 5.3. The grade's shift matches Lightroom's within
~1 L* and ~1.5 a*/b* per band; the sky is L 72.5 a +1.6 b -5.3 against
Lightroom's 70.6 / +1.5 / -7.7 (2.10.4: 75.5 / +1.0 / -2.0). Left: the
ungraded base is ~1.7 L* brighter and ~2 b* less blue in the sky, saturated
reds ~4 L* darker, and the orange kart renders red.

## Sharpness and lens geometry (2.11.0)
- Jaewon found Flightroom's view "mushed" next to Lightroom's. The full-quality
  view (Renderer.refine) shrank its full-resolution tiles with trilinear
  mipmaps, which keeps only ~80% of the finest detail a proper resize does.
  It now uses Lanczos-2 over the mip level with 1.5-3 texels per screen pixel
  (shaders.js RESAMPLE): within 2% of an area resize at every scale.
- Contrast and Whites/Blacks act on the local brightness (the guide base) and
  carry the detail around it along (CON_LOCAL, WB_LOCAL), as Lightroom's
  edge-aware sliders keep local contrast: median dE 5.3 -> 5.0.
- Lightroom applies the Nikon Z lens's built-in distortion correction (the
  NEF's NikonNEFInfo, src-tauri lens.rs) whatever the profile checkbox says.
  With it, the JWL_7345 render lines up with Lightroom's export at scale
  1.0000 and 0.14 px median residual (1400 px wide), so comparisons no longer
  need optical flow: direct median dE 4.85.
- Left: the brightest sunlit cloud (Lightroom L* ~98) tops out at ~92; the
  corners are ~0.1 stop darker than Lightroom's (vignetting not applied).

## Night shots: adaptive Shadows/Blacks (2.11.2)
- JWL_7530 (night kart shot, Shadows +90, Blacks +90, Highlights/Whites -89,
  Contrast -92) rendered ~25 L* brighter and flatter than Lightroom with the
  same xmp: Lightroom's positive Shadows/Blacks do almost nothing here.
- The key (median log2 brightness) doesn't explain it: JWL_7530's median is
  -4.04, like JWL_7451 (-3.98), where the sliders work in full. What differs
  is the range above the middle, span = p99.9 - p50 of the guide:
  7451 1.96, 7345 2.97, 7530 4.04 (bright lights). The lift now follows a
  logistic on span (SPAN_MID 3.24, SPAN_W 0.205): 1, 0.79, ~0.01.
  JWL_7530 median dE 29.8 -> 5.0; JWL_7345 unchanged (4.8).
- Tried and dropped: subtracting a per-channel black floor (0.1% percentile)
  brought the darkest band to 0 L* but median dE 5.8 (k 0.5: 4.9), and it
  would darken photos with no true blacks.
- Left on JWL_7530: L* 10-50 is ~+5 L* and ~+9 b* (too yellow). Its Shadow
  wheel is hue 221 sat 92; ours moves the darks ~8 b* bluer, Lightroom ~17.
  A superlinear saturation response (sat^2, matched at 45) fixes the darks
  but costs JWL_7345 (4.8 -> 5.9) through its weaker midtone 20, so it needs
  more photos with high wheel saturation before changing.
