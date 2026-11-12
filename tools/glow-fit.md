# Glow: fitted to Lightroom

Lightroom Classic 16's Glow was measured on a test chart (8-bit sRGB TIFF, 4000 x 2667:
grey squares, white dots of five sizes, coloured dots, a thin line with a cross, a
gradient bar and a white block on black) and on a night NEF, one setting changed per
export (JPEG q100 sRGB). Glow 0 of the TIFF is the TIFF itself, so each export minus
the chart is the light Glow adds. Fits were done in linear sRGB at a quarter of the
size (1000 px wide); sizes are kept as fractions of the long edge.

| Style | Model | rms (levels of 255) |
| --- | --- | --- |
| Bloom | slight blur (0.084%), weight K (eY / (1 + e - Y))^n, gaussian blur 1.606%, faint glow faded below Y 0.031 | 3.98 |
| Halation | slight blur (0.076%), threshold ((Y - 0.52) / 0.48)^10, blurs 0.05% (0.24) + 0.66% (0.76), red with orange spill | 2.5 |
| Motion | Bloom-like weight, one-sided exponential trail 6.85%, 0.17% across | 3.78 |
| Streak | Bloom-like weight, two-sided exponential 8.1%, Softness sets 0.07-0.34% across | 6.6 |
| Diffusion | inside bright areas only (smoothstep 0.33-0.61): toward a 0.43% blur, plus a lift | 2.25 |

Range (0 / 50 / 100) and Spread (0 / 50 / 100) and Warmth (+-100) were measured on
Bloom; glow.js has the values and interpolates on a log scale. Lightroom's Direction
turns clockwise on screen (+45 points down-right).

Checked in a WebGL rig (Renderer with an identity look, chart as the source): the glow
profile around the big dot is within about 10% of Lightroom's, and the Motion / Streak
trails point and fade the same way.
