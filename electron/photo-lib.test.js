import { describe, expect, it } from 'vitest';
import lib from './photo-lib.cjs';

const LR_SIDECAR = `<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   xmp:Rating="2"
   crs:Exposure2012="+0.35">
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>`;

describe('XMP ratings', () => {
  it('creates a sidecar Lightroom can read', () => {
    const x = lib.setRating(null, 4);
    expect(lib.readRating(x)).toBe(4);
    expect(x).toContain('xmlns:xmp="http://ns.adobe.com/xap/1.0/"');
  });

  it('changes only the rating in an existing Lightroom sidecar', () => {
    const x = lib.setRating(LR_SIDECAR, 5);
    expect(lib.readRating(x)).toBe(5);
    expect(x.replace('xmp:Rating="5"', 'xmp:Rating="2"')).toBe(LR_SIDECAR);
  });

  it('adds a rating to a sidecar that has none', () => {
    const noRating = LR_SIDECAR.replace('\n   xmp:Rating="2"', '').replace('\n    xmlns:xmp="http://ns.adobe.com/xap/1.0/"', '');
    const x = lib.setRating(noRating, 3);
    expect(lib.readRating(x)).toBe(3);
    expect(x).toContain('crs:Exposure2012="+0.35"');
    expect(x).toContain('xmlns:xmp=');
  });

  it('handles the element form and ignores Microsoft percent ratings', () => {
    const elem = '<rdf:Description><xmp:Rating>1</xmp:Rating><MicrosoftPhoto:Rating>99</MicrosoftPhoto:Rating></rdf:Description>';
    expect(lib.readRating(elem)).toBe(1);
    expect(lib.readRating(lib.setRating(elem, 0))).toBe(0);
    expect(lib.readRating('<x MicrosoftPhoto:Rating="75"/>')).toBe(null);
  });
});

describe('JPEG files', () => {
  // SOI, APP0 (JFIF), SOF0 for 300x200, EOI.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 6, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xc0, 0, 11, 8, 0, 200, 1, 44, 1, 1, 0x11, 0, 0xff, 0xd9]);

  it('reads the image size', () => {
    expect(lib.jpegSize(jpeg)).toEqual({ width: 300, height: 200 });
  });

  it('writes and rewrites the rating inside the file', async () => {
    const once = lib.setJpegRating(jpeg, 3);
    const twice = lib.setJpegRating(once, 5);
    const get = async (o, l) => twice.subarray(o, o + l);
    const info = await lib.readPhotoInfo(get, '.jpg');
    expect(info.fileRating).toBe(5);
    expect(info.preview).toMatchObject({ width: 300, height: 200 });
    expect(twice.length).toBe(once.length);
    expect(twice.subarray(-14)).toEqual(jpeg.subarray(-14)); // image data untouched
  });
});

describe('folder listing', () => {
  it('pairs RAW+JPEG, finds sidecars, and sorts like Explorer', () => {
    const photos = lib.groupPhotos(['DSC_10.NEF', 'DSC_9.NEF', 'DSC_9.JPG', 'DSC_9.xmp', 'solo.jpg', 'clip.MP4', 'notes.txt']);
    expect(photos.map((p) => p.file)).toEqual(['DSC_9.NEF', 'DSC_10.NEF', 'solo.jpg']);
    expect(photos[0]).toMatchObject({ raw: 'DSC_9.NEF', jpeg: 'DSC_9.JPG', sidecar: 'DSC_9.xmp', ratingIn: 'sidecar' });
    expect(photos[2].ratingIn).toBe('file');
  });
});
