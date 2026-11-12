// EXIF orientation -> clockwise rotation in degrees (mirrored values are rare in
// camera files and are shown unmirrored).
export const ROTATION = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

/** A box in fractions of the camera's unrotated frame ({x, y, w, h}, top left) on the upright photo. */
export function uprightBox(b, orientation) {
  switch (ROTATION[orientation] || 0) {
    case 90: return { x: 1 - b.y - b.h, y: b.x, w: b.h, h: b.w };
    case 180: return { x: 1 - b.x - b.w, y: 1 - b.y - b.h, w: b.w, h: b.h };
    case 270: return { x: b.y, y: 1 - b.x - b.w, w: b.h, h: b.w };
    default: return { x: b.x, y: b.y, w: b.w, h: b.h };
  }
}
