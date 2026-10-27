// Starter gear catalog. Specs are approximate and meant as a starting point:
// every item can be edited in the app, and custom gear can be added.

export const MOUNTS = {
  'Sony E': 'Sony E',
  'Canon RF': 'Canon RF',
  'Canon EF': 'Canon EF',
  'Nikon Z': 'Nikon Z',
  'Nikon F': 'Nikon F',
  'Fujifilm X': 'Fujifilm X',
  'L-Mount': 'L-Mount',
};

// Sensor sizes, largest first. A lens covers its own format and everything smaller.
export const SENSORS = ['Full Frame', 'APS-C', 'Super 35', 'Micro Four Thirds'];

// Crop sensors that an APS-C lens still covers.
export const CROP_SENSORS = ['APS-C', 'Super 35', 'Micro Four Thirds'];

const body = (b) => ({ type: 'body', firmware: '', firmwareFeatures: [], ...b });
const lens = (l) => ({ type: 'lens', ...l });
const acc = (a) => ({ type: 'accessory', ...a });

export const BODIES = [
  // Sony
  body({ id: 'sony-a7iv', brand: 'Sony', model: 'α7 IV', mount: 'Sony E', sensor: 'Full Frame', megapixels: 33, ibis: true, maxVideo: '4K 60p (S35 crop)', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['CFexpress A / SD', 'SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 658, year: 2021 }),
  body({ id: 'sony-a7siii', brand: 'Sony', model: 'α7S III', mount: 'Sony E', sensor: 'Full Frame', megapixels: 12, ibis: true, maxVideo: '4K 120p', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['CFexpress A / SD', 'CFexpress A / SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 699, year: 2020 }),
  body({ id: 'sony-a7rv', brand: 'Sony', model: 'α7R V', mount: 'Sony E', sensor: 'Full Frame', megapixels: 61, ibis: true, maxVideo: '8K 24p', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['CFexpress A / SD', 'CFexpress A / SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 723, year: 2022 }),
  body({ id: 'sony-a1', brand: 'Sony', model: 'α1', mount: 'Sony E', sensor: 'Full Frame', megapixels: 50, ibis: true, maxVideo: '8K 30p', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['CFexpress A / SD', 'CFexpress A / SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 737, year: 2021 }),
  body({ id: 'sony-fx3', brand: 'Sony', model: 'FX3', mount: 'Sony E', sensor: 'Full Frame', megapixels: 12, ibis: true, maxVideo: '4K 120p', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['CFexpress A / SD', 'CFexpress A / SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 715, year: 2021 }),
  body({ id: 'sony-fx30', brand: 'Sony', model: 'FX30', mount: 'Sony E', sensor: 'APS-C', megapixels: 26, ibis: true, maxVideo: '4K 120p (crop)', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['CFexpress A / SD', 'CFexpress A / SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 646, year: 2022 }),
  body({ id: 'sony-a6700', brand: 'Sony', model: 'α6700', mount: 'Sony E', sensor: 'APS-C', megapixels: 26, ibis: true, maxVideo: '4K 120p', rawFormat: 'ARW', videoFormats: ['XAVC S', 'XAVC HS', 'XAVC S-I'], cardSlots: ['SD'], battery: 'NP-FZ100', shoe: 'Sony MI', weight: 493, year: 2023 }),
  body({ id: 'sony-a6400', brand: 'Sony', model: 'α6400', mount: 'Sony E', sensor: 'APS-C', megapixels: 24, ibis: false, maxVideo: '4K 30p', rawFormat: 'ARW', videoFormats: ['XAVC S'], cardSlots: ['SD'], battery: 'NP-FW50', shoe: 'Sony MI', digitalAudio: false, weight: 403, year: 2019 }),
  // Canon
  body({ id: 'canon-r5', brand: 'Canon', model: 'EOS R5', mount: 'Canon RF', sensor: 'Full Frame', megapixels: 45, ibis: true, maxVideo: '8K 30p RAW', rawFormat: 'CR3', videoFormats: ['Cinema RAW Light', 'H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'LP-E6NH', shoe: 'Canon Multi-function', weight: 738, year: 2020 }),
  body({ id: 'canon-r5ii', brand: 'Canon', model: 'EOS R5 Mark II', mount: 'Canon RF', sensor: 'Full Frame', megapixels: 45, ibis: true, maxVideo: '8K 60p RAW', rawFormat: 'CR3', videoFormats: ['Cinema RAW Light', 'XF-AVC', 'H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'LP-E6P', batteryAlso: [{ model: 'LP-E6NH', note: 'Works, but some high-speed and video functions are limited.' }], shoe: 'Canon Multi-function', weight: 746, year: 2024 }),
  body({ id: 'canon-r6ii', brand: 'Canon', model: 'EOS R6 Mark II', mount: 'Canon RF', sensor: 'Full Frame', megapixels: 24, ibis: true, maxVideo: '4K 60p', rawFormat: 'CR3', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['SD', 'SD'], battery: 'LP-E6NH', shoe: 'Canon Multi-function', weight: 670, year: 2022 }),
  body({ id: 'canon-r7', brand: 'Canon', model: 'EOS R7', mount: 'Canon RF', sensor: 'APS-C', megapixels: 33, ibis: true, maxVideo: '4K 60p', rawFormat: 'CR3', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['SD', 'SD'], battery: 'LP-E6NH', shoe: 'Canon Multi-function', weight: 612, year: 2022 }),
  body({ id: 'canon-r8', brand: 'Canon', model: 'EOS R8', mount: 'Canon RF', sensor: 'Full Frame', megapixels: 24, ibis: false, maxVideo: '4K 60p', rawFormat: 'CR3', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['SD'], battery: 'LP-E17', shoe: 'Canon Multi-function', weight: 461, year: 2023 }),
  // Nikon
  body({ id: 'nikon-z9', brand: 'Nikon', model: 'Z9', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 45, ibis: true, maxVideo: '8K 60p RAW', rawFormat: 'NEF', videoFormats: ['N-RAW', 'ProRes RAW', 'ProRes 422 HQ', 'H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'CFexpress B'], battery: 'EN-EL18d', shoe: 'Nikon i-TTL', weight: 1340, year: 2021,
    firmwareFeatures: [{ feature: 'Internal N-RAW / ProRes RAW video', formats: ['N-RAW', 'ProRes RAW'], minFirmware: '3.00' }] }),
  body({ id: 'nikon-z8', brand: 'Nikon', model: 'Z8', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 45, ibis: true, maxVideo: '8K 60p RAW', rawFormat: 'NEF', videoFormats: ['N-RAW', 'ProRes RAW', 'ProRes 422 HQ', 'H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'EN-EL15c', shoe: 'Nikon i-TTL', weight: 910, year: 2023 }),
  body({ id: 'nikon-z6iii', brand: 'Nikon', model: 'Z6III', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 24.5, ibis: true, maxVideo: '6K 60p RAW', rawFormat: 'NEF', videoFormats: ['N-RAW', 'ProRes RAW', 'ProRes 422 HQ', 'H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'EN-EL15c', shoe: 'Nikon i-TTL', weight: 760, year: 2024 }),
  body({ id: 'nikon-z7ii', brand: 'Nikon', model: 'Z7II', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 45.7, ibis: true, maxVideo: '4K 60p', rawFormat: 'NEF', videoFormats: ['H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'EN-EL15c', shoe: 'Nikon i-TTL', weight: 705, year: 2020 }),
  body({ id: 'nikon-z6ii', brand: 'Nikon', model: 'Z6II', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 24.5, ibis: true, maxVideo: '4K 60p', rawFormat: 'NEF', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'EN-EL15c', shoe: 'Nikon i-TTL', weight: 705, year: 2020 }),
  body({ id: 'nikon-z6', brand: 'Nikon', model: 'Z6', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 24.5, ibis: true, maxVideo: '4K 30p', rawFormat: 'NEF', videoFormats: ['H.264'], cardSlots: ['XQD'], battery: 'EN-EL15b', shoe: 'Nikon i-TTL', weight: 675, year: 2018,
    firmwareFeatures: [{ feature: 'CFexpress Type B cards', cards: ['CFexpress B'], minFirmware: '2.20' }] }),
  body({ id: 'nikon-z5', brand: 'Nikon', model: 'Z5', mount: 'Nikon Z', sensor: 'Full Frame', megapixels: 24, ibis: true, maxVideo: '4K 30p (crop)', rawFormat: 'NEF', videoFormats: ['H.264'], cardSlots: ['SD', 'SD'], battery: 'EN-EL15c', shoe: 'Nikon i-TTL', weight: 675, year: 2020 }),
  body({ id: 'nikon-zfc', brand: 'Nikon', model: 'Z fc', mount: 'Nikon Z', sensor: 'APS-C', megapixels: 21, ibis: false, maxVideo: '4K 30p', rawFormat: 'NEF', videoFormats: ['H.264'], cardSlots: ['SD'], battery: 'EN-EL25', shoe: 'Nikon i-TTL', weight: 445, year: 2021 }),
  // Fujifilm
  body({ id: 'fuji-xt5', brand: 'Fujifilm', model: 'X-T5', mount: 'Fujifilm X', sensor: 'APS-C', megapixels: 40, ibis: true, maxVideo: '6.2K 30p', rawFormat: 'RAF', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['SD', 'SD'], battery: 'NP-W235', shoe: 'Fujifilm TTL', weight: 557, year: 2022 }),
  body({ id: 'fuji-xh2s', brand: 'Fujifilm', model: 'X-H2S', mount: 'Fujifilm X', sensor: 'APS-C', megapixels: 26, ibis: true, maxVideo: '6.2K 30p / 4K 120p', rawFormat: 'RAF', videoFormats: ['ProRes 422 HQ', 'H.265 (HEVC)', 'H.264'], cardSlots: ['CFexpress B', 'SD'], battery: 'NP-W235', shoe: 'Fujifilm TTL', weight: 660, year: 2022 }),
  body({ id: 'fuji-xs20', brand: 'Fujifilm', model: 'X-S20', mount: 'Fujifilm X', sensor: 'APS-C', megapixels: 26, ibis: true, maxVideo: '6.2K 30p', rawFormat: 'RAF', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['SD'], battery: 'NP-W235', shoe: 'Fujifilm TTL', weight: 491, year: 2023 }),
  // Panasonic
  body({ id: 'pana-s5ii', brand: 'Panasonic', model: 'Lumix S5II', mount: 'L-Mount', sensor: 'Full Frame', megapixels: 24, ibis: true, maxVideo: '6K 30p', rawFormat: 'RW2', videoFormats: ['H.265 (HEVC)', 'H.264'], cardSlots: ['SD', 'SD'], battery: 'DMW-BLK22', shoe: 'Panasonic TTL', weight: 740, year: 2023 }),
  // Blackmagic
  body({ id: 'bmd-p6kpro', brand: 'Blackmagic', model: 'Pocket Cinema Camera 6K Pro', mount: 'Canon EF', sensor: 'Super 35', megapixels: 21, ibis: false, maxVideo: '6K 50p BRAW', rawFormat: null, videoFormats: ['Blackmagic RAW', 'ProRes 422 HQ'], cardSlots: ['CFast 2.0', 'SD'], battery: 'NP-F570', shoe: 'Standard (no TTL)', weight: 1238, year: 2021 }),
];

// fType applies to Nikon F lenses: how they focus, which decides adapter support.
export const LENSES = [
  // Sony E
  lens({ id: 'sony-2470gm2', brand: 'Sony', model: 'FE 24-70mm F2.8 GM II', mount: 'Sony E', coverage: 'Full Frame', focal: '24-70mm', aperture: 'f/2.8', stabilized: false, filterThread: 82, weight: 695 }),
  lens({ id: 'sony-70200gm2', brand: 'Sony', model: 'FE 70-200mm F2.8 GM OSS II', mount: 'Sony E', coverage: 'Full Frame', focal: '70-200mm', aperture: 'f/2.8', stabilized: true, filterThread: 77, weight: 1045 }),
  lens({ id: 'sony-200600g', brand: 'Sony', model: 'FE 200-600mm F5.6-6.3 G OSS', mount: 'Sony E', coverage: 'Full Frame', focal: '200-600mm', aperture: 'f/5.6-6.3', stabilized: true, filterThread: 95, weight: 2115 }),
  lens({ id: 'sony-35gm', brand: 'Sony', model: 'FE 35mm F1.4 GM', mount: 'Sony E', coverage: 'Full Frame', focal: '35mm', aperture: 'f/1.4', stabilized: false, filterThread: 67, weight: 524 }),
  lens({ id: 'sony-85f18', brand: 'Sony', model: 'FE 85mm F1.8', mount: 'Sony E', coverage: 'Full Frame', focal: '85mm', aperture: 'f/1.8', stabilized: false, filterThread: 67, weight: 371 }),
  lens({ id: 'sony-1635pz', brand: 'Sony', model: 'FE PZ 16-35mm F4 G', mount: 'Sony E', coverage: 'Full Frame', focal: '16-35mm', aperture: 'f/4', stabilized: false, filterThread: 72, weight: 353 }),
  lens({ id: 'sony-18135', brand: 'Sony', model: 'E 18-135mm F3.5-5.6 OSS', mount: 'Sony E', coverage: 'APS-C', focal: '18-135mm', aperture: 'f/3.5-5.6', stabilized: true, filterThread: 55, weight: 325 }),
  lens({ id: 'sigma-1850-e', brand: 'Sigma', model: '18-50mm F2.8 DC DN | C (E)', mount: 'Sony E', coverage: 'APS-C', focal: '18-50mm', aperture: 'f/2.8', stabilized: false, filterThread: 55, weight: 290 }),
  lens({ id: 'sigma-2470art-e', brand: 'Sigma', model: '24-70mm F2.8 DG DN II | Art (E)', mount: 'Sony E', coverage: 'Full Frame', focal: '24-70mm', aperture: 'f/2.8', stabilized: false, filterThread: 82, weight: 735 }),
  // Canon RF
  lens({ id: 'canon-rf2470', brand: 'Canon', model: 'RF 24-70mm F2.8 L IS USM', mount: 'Canon RF', coverage: 'Full Frame', focal: '24-70mm', aperture: 'f/2.8', stabilized: true, filterThread: 82, weight: 900 }),
  lens({ id: 'canon-rf70200', brand: 'Canon', model: 'RF 70-200mm F2.8 L IS USM', mount: 'Canon RF', coverage: 'Full Frame', focal: '70-200mm', aperture: 'f/2.8', stabilized: true, filterThread: 77, weight: 1070 }),
  lens({ id: 'canon-rf100500', brand: 'Canon', model: 'RF 100-500mm F4.5-7.1 L IS USM', mount: 'Canon RF', coverage: 'Full Frame', focal: '100-500mm', aperture: 'f/4.5-7.1', stabilized: true, filterThread: 77, weight: 1370 }),
  lens({ id: 'canon-rf50', brand: 'Canon', model: 'RF 50mm F1.8 STM', mount: 'Canon RF', coverage: 'Full Frame', focal: '50mm', aperture: 'f/1.8', stabilized: false, filterThread: 43, weight: 160 }),
  lens({ id: 'canon-rf1535', brand: 'Canon', model: 'RF 15-35mm F2.8 L IS USM', mount: 'Canon RF', coverage: 'Full Frame', focal: '15-35mm', aperture: 'f/2.8', stabilized: true, filterThread: 82, weight: 840 }),
  lens({ id: 'canon-rfs18150', brand: 'Canon', model: 'RF-S 18-150mm F3.5-6.3 IS STM', mount: 'Canon RF', coverage: 'APS-C', focal: '18-150mm', aperture: 'f/3.5-6.3', stabilized: true, filterThread: 55, weight: 310 }),
  // Canon EF
  lens({ id: 'canon-ef70200iii', brand: 'Canon', model: 'EF 70-200mm f/2.8L IS III USM', mount: 'Canon EF', coverage: 'Full Frame', focal: '70-200mm', aperture: 'f/2.8', stabilized: true, filterThread: 77, weight: 1480 }),
  lens({ id: 'canon-ef24105ii', brand: 'Canon', model: 'EF 24-105mm f/4L IS II USM', mount: 'Canon EF', coverage: 'Full Frame', focal: '24-105mm', aperture: 'f/4', stabilized: true, filterThread: 77, weight: 795 }),
  lens({ id: 'sigma-1835-ef', brand: 'Sigma', model: '18-35mm F1.8 DC HSM | Art (EF)', mount: 'Canon EF', coverage: 'APS-C', focal: '18-35mm', aperture: 'f/1.8', stabilized: false, filterThread: 72, weight: 810 }),
  // Nikon Z
  lens({ id: 'nikon-z2470s', brand: 'Nikon', model: 'NIKKOR Z 24-70mm f/2.8 S', mount: 'Nikon Z', coverage: 'Full Frame', focal: '24-70mm', aperture: 'f/2.8', stabilized: false, filterThread: 82, weight: 805 }),
  lens({ id: 'nikon-z70200s', brand: 'Nikon', model: 'NIKKOR Z 70-200mm f/2.8 VR S', mount: 'Nikon Z', coverage: 'Full Frame', focal: '70-200mm', aperture: 'f/2.8', stabilized: true, filterThread: 77, weight: 1440 }),
  lens({ id: 'nikon-z180600', brand: 'Nikon', model: 'NIKKOR Z 180-600mm f/5.6-6.3 VR', mount: 'Nikon Z', coverage: 'Full Frame', focal: '180-600mm', aperture: 'f/5.6-6.3', stabilized: true, filterThread: 95, weight: 1955 }),
  lens({ id: 'nikon-z50s', brand: 'Nikon', model: 'NIKKOR Z 50mm f/1.8 S', mount: 'Nikon Z', coverage: 'Full Frame', focal: '50mm', aperture: 'f/1.8', stabilized: false, filterThread: 62, weight: 415 }),
  lens({ id: 'nikon-z2470f4', brand: 'Nikon', model: 'NIKKOR Z 24-70mm f/4 S', mount: 'Nikon Z', coverage: 'Full Frame', focal: '24-70mm', aperture: 'f/4', stabilized: false, filterThread: 72, weight: 500 }),
  lens({ id: 'nikon-z1430s', brand: 'Nikon', model: 'NIKKOR Z 14-30mm f/4 S', mount: 'Nikon Z', coverage: 'Full Frame', focal: '14-30mm', aperture: 'f/4', stabilized: false, filterThread: 82, weight: 485 }),
  lens({ id: 'nikon-zdx1650', brand: 'Nikon', model: 'NIKKOR Z DX 16-50mm f/3.5-6.3 VR', mount: 'Nikon Z', coverage: 'APS-C', focal: '16-50mm', aperture: 'f/3.5-6.3', stabilized: true, filterThread: 46, weight: 135 }),
  // Nikon F
  lens({ id: 'nikon-f70200e', brand: 'Nikon', model: 'AF-S 70-200mm f/2.8E FL ED VR', mount: 'Nikon F', fType: 'AF-S', coverage: 'Full Frame', focal: '70-200mm', aperture: 'f/2.8', stabilized: true, filterThread: 77, weight: 1430 }),
  lens({ id: 'nikon-f70300p', brand: 'Nikon', model: 'AF-P 70-300mm f/4.5-5.6E ED VR', mount: 'Nikon F', fType: 'AF-P', coverage: 'Full Frame', focal: '70-300mm', aperture: 'f/4.5-5.6', stabilized: true, filterThread: 67, weight: 680 }),
  lens({ id: 'nikon-f50d', brand: 'Nikon', model: 'AF 50mm f/1.8D', mount: 'Nikon F', fType: 'AF-D', coverage: 'Full Frame', focal: '50mm', aperture: 'f/1.8', stabilized: false, filterThread: 52, weight: 155 }),
  lens({ id: 'nikon-f50ais', brand: 'Nikon', model: 'Ai-S 50mm f/1.4', mount: 'Nikon F', fType: 'AI-S', coverage: 'Full Frame', focal: '50mm', aperture: 'f/1.4', stabilized: false, filterThread: 52, weight: 250 }),
  lens({ id: 'nikon-f2870d', brand: 'Nikon', model: 'AF-S 28-70mm f/2.8D IF-ED', mount: 'Nikon F', fType: 'AF-S', coverage: 'Full Frame', focal: '28-70mm', aperture: 'f/2.8', stabilized: false, filterThread: 77, weight: 935 }),
  lens({ id: 'tamron-70210-f', brand: 'Tamron', model: 'SP 70-210mm F/4 Di VC USD (A034, F mount)', mount: 'Nikon F', fType: 'AF-S', coverage: 'Full Frame', focal: '70-210mm', aperture: 'f/4', stabilized: true, filterThread: 67, weight: 860,
    notes: 'Built-in USD focus motor, so it can autofocus through the FTZ. Lens firmware is updated with the Tamron TAP-in Console.' }),
  lens({ id: 'sigma-70200sports-f', brand: 'Sigma', model: '70-200mm F2.8 DG OS HSM | Sports (F mount)', mount: 'Nikon F', fType: 'AF-S', coverage: 'Full Frame', focal: '70-200mm', aperture: 'f/2.8', stabilized: true, filterThread: 82, weight: 1805,
    notes: 'Built-in HSM focus motor, so it can autofocus through the FTZ. Lens firmware is updated with the Sigma USB Dock UD-01.' }),
  // Fujifilm X
  lens({ id: 'fuji-1655', brand: 'Fujifilm', model: 'XF 16-55mm F2.8 R LM WR', mount: 'Fujifilm X', coverage: 'APS-C', focal: '16-55mm', aperture: 'f/2.8', stabilized: false, filterThread: 77, weight: 655 }),
  lens({ id: 'fuji-100400', brand: 'Fujifilm', model: 'XF 100-400mm F4.5-5.6 R LM OIS WR', mount: 'Fujifilm X', coverage: 'APS-C', focal: '100-400mm', aperture: 'f/4.5-5.6', stabilized: true, filterThread: 77, weight: 1375 }),
  lens({ id: 'fuji-33', brand: 'Fujifilm', model: 'XF 33mm F1.4 R LM WR', mount: 'Fujifilm X', coverage: 'APS-C', focal: '33mm', aperture: 'f/1.4', stabilized: false, filterThread: 58, weight: 360 }),
  lens({ id: 'fuji-1855', brand: 'Fujifilm', model: 'XF 18-55mm F2.8-4 R LM OIS', mount: 'Fujifilm X', coverage: 'APS-C', focal: '18-55mm', aperture: 'f/2.8-4', stabilized: true, filterThread: 58, weight: 310 }),
  // L-Mount
  lens({ id: 'pana-24105', brand: 'Panasonic', model: 'Lumix S 24-105mm F4 Macro O.I.S.', mount: 'L-Mount', coverage: 'Full Frame', focal: '24-105mm', aperture: 'f/4', stabilized: true, filterThread: 77, weight: 680 }),
  lens({ id: 'sigma-2870-l', brand: 'Sigma', model: '28-70mm F2.8 DG DN | C (L)', mount: 'L-Mount', coverage: 'Full Frame', focal: '28-70mm', aperture: 'f/2.8', stabilized: false, filterThread: 67, weight: 470 }),
];

// Adapter AF support levels:
//   full    full autofocus and electronic control
//   good    autofocus works, some modes may be slower
//   limited autofocus may be slow or unreliable
//   mf      manual focus only
//   none    does not work
export const ACCESSORIES = [
  // Adapters
  acc({ id: 'nikon-ftz2', thirdParty: 'good', category: 'Adapter', brand: 'Nikon', model: 'Mount Adapter FTZ II', fromMount: 'Nikon F', toMount: 'Nikon Z', weight: 135,
    afByFType: { 'AF-S': 'full', 'AF-P': 'full', 'AF-I': 'full', 'AF-D': 'mf', AF: 'mf', 'AI-S': 'mf', AI: 'mf' },
    notes: 'AF-S, AF-P and AF-I lenses autofocus. Screw-drive AF/AF-D lenses are manual focus only. Ai/Ai-S lenses need non-CPU lens data set in the camera.' }),
  acc({ id: 'nikon-ftz', thirdParty: 'good', category: 'Adapter', brand: 'Nikon', model: 'Mount Adapter FTZ', fromMount: 'Nikon F', toMount: 'Nikon Z', weight: 135,
    afByFType: { 'AF-S': 'full', 'AF-P': 'full', 'AF-I': 'full', 'AF-D': 'mf', AF: 'mf', 'AI-S': 'mf', AI: 'mf' },
    notes: 'Same lens support as the FTZ II, with a built-in tripod foot.' }),
  acc({ id: 'canon-efeosr', category: 'Adapter', brand: 'Canon', model: 'Mount Adapter EF-EOS R', fromMount: 'Canon EF', toMount: 'Canon RF', weight: 110, af: 'full',
    notes: 'Full support for EF and EF-S lenses. EF-S lenses switch full-frame bodies to crop mode.' }),
  acc({ id: 'sigma-mc11', category: 'Adapter', brand: 'Sigma', model: 'MC-11 (EF to E)', fromMount: 'Canon EF', toMount: 'Sony E', weight: 120, af: 'limited', afByBrand: { Sigma: 'full' },
    notes: 'Designed for Sigma EF lenses. Other brands are not officially supported. Keep the adapter firmware updated for newer Sigma lenses.' }),
  acc({ id: 'metabones-efe5', category: 'Adapter', brand: 'Metabones', model: 'EF to E Smart Adapter V', fromMount: 'Canon EF', toMount: 'Sony E', weight: 130, af: 'good',
    notes: 'Autofocus works with most Canon EF lenses. Continuous AF can be slower than native lenses.' }),
  acc({ id: 'fringer-effx2', category: 'Adapter', brand: 'Fringer', model: 'EF-FX Pro II', fromMount: 'Canon EF', toMount: 'Fujifilm X', weight: 155, af: 'good',
    notes: 'Autofocus works with most Canon and Sigma EF lenses. Check Fringer’s compatibility list for your lens.' }),
  acc({ id: 'sigma-mc21', category: 'Adapter', brand: 'Sigma', model: 'MC-21 (EF to L)', fromMount: 'Canon EF', toMount: 'L-Mount', weight: 125, af: 'limited', afByBrand: { Sigma: 'full' },
    notes: 'Full support for Sigma EF lenses. Other brands are not officially supported.' }),
  acc({ id: 'megadap-etz21', category: 'Adapter', brand: 'Megadap', model: 'ETZ21 Pro (E to Z)', fromMount: 'Sony E', toMount: 'Nikon Z', weight: 60, af: 'good',
    notes: 'Autofocus works with most Sony E lenses. Check Megadap’s list for your lens.' }),
  // Batteries
  acc({ id: 'bat-npfz100', category: 'Battery', brand: 'Sony', model: 'NP-FZ100', batteryModel: 'NP-FZ100', weight: 83 }),
  acc({ id: 'bat-npfw50', category: 'Battery', brand: 'Sony', model: 'NP-FW50', batteryModel: 'NP-FW50', weight: 47 }),
  acc({ id: 'bat-lpe6nh', category: 'Battery', brand: 'Canon', model: 'LP-E6NH', batteryModel: 'LP-E6NH', weight: 80 }),
  acc({ id: 'bat-lpe6p', category: 'Battery', brand: 'Canon', model: 'LP-E6P', batteryModel: 'LP-E6P', weight: 80 }),
  acc({ id: 'bat-lpe17', category: 'Battery', brand: 'Canon', model: 'LP-E17', batteryModel: 'LP-E17', weight: 45 }),
  acc({ id: 'bat-enel15c', category: 'Battery', brand: 'Nikon', model: 'EN-EL15c', batteryModel: 'EN-EL15c', weight: 80, alsoFits: ['EN-EL15b'] }),
  acc({ id: 'bat-enel18d', category: 'Battery', brand: 'Nikon', model: 'EN-EL18d', batteryModel: 'EN-EL18d', weight: 160 }),
  acc({ id: 'bat-npw235', category: 'Battery', brand: 'Fujifilm', model: 'NP-W235', batteryModel: 'NP-W235', weight: 77 }),
  acc({ id: 'bat-npf570', category: 'Battery', brand: 'Sony', model: 'NP-F570 (L-series)', batteryModel: 'NP-F570', weight: 120 }),
  // Memory cards
  acc({ id: 'card-cfa', category: 'Memory card', brand: 'Sony', model: 'CFexpress Type A TOUGH 160GB', cardType: 'CFexpress A' }),
  acc({ id: 'card-cfb', category: 'Memory card', brand: 'ProGrade', model: 'CFexpress Type B Gold 512GB', cardType: 'CFexpress B' }),
  acc({ id: 'card-sd2', category: 'Memory card', brand: 'SanDisk', model: 'Extreme PRO SD UHS-II 128GB', cardType: 'SD' }),
  acc({ id: 'card-xqd', category: 'Memory card', brand: 'Sony', model: 'XQD G-series 120GB', cardType: 'XQD' }),
  acc({ id: 'card-cfast', category: 'Memory card', brand: 'Angelbird', model: 'AV PRO CFast 2.0 256GB', cardType: 'CFast 2.0' }),
  // Filters
  acc({ id: 'filter-vnd82', category: 'Filter', brand: 'PolarPro', model: 'Peter McKinnon VND 82mm', threadSize: 82, weight: 60 }),
  acc({ id: 'filter-cpl77', category: 'Filter', brand: 'B+W', model: 'Circular Polarizer 77mm', threadSize: 77, weight: 40 }),
  acc({ id: 'filter-cpl67', category: 'Filter', brand: 'B+W', model: 'Circular Polarizer 67mm', threadSize: 67, weight: 30 }),
  acc({ id: 'filter-uv58', category: 'Filter', brand: 'Hoya', model: 'HD UV 58mm', threadSize: 58, weight: 20 }),
  // Flashes
  acc({ id: 'flash-godox-v1s', category: 'Flash', brand: 'Godox', model: 'V1-S (Sony)', shoe: 'Sony MI', weight: 530 }),
  acc({ id: 'flash-godox-v1c', category: 'Flash', brand: 'Godox', model: 'V1-C (Canon)', shoe: 'Canon Multi-function', weight: 530 }),
  acc({ id: 'flash-godox-v1n', category: 'Flash', brand: 'Godox', model: 'V1-N (Nikon)', shoe: 'Nikon i-TTL', weight: 530 }),
  acc({ id: 'flash-godox-v1f', category: 'Flash', brand: 'Godox', model: 'V1-F (Fujifilm)', shoe: 'Fujifilm TTL', weight: 530 }),
  // Audio
  acc({ id: 'mic-ecmb10', category: 'Microphone', brand: 'Sony', model: 'ECM-B10', connection: 'Sony MI', weight: 37 }),
  acc({ id: 'mic-videomicngo', category: 'Microphone', brand: 'RØDE', model: 'VideoMic NTG', connection: '3.5mm', weight: 94 }),
  // Support
  acc({ id: 'gimbal-rs4', category: 'Gimbal', brand: 'DJI', model: 'RS 4', maxPayload: 3000, weight: 1066 }),
  acc({ id: 'gimbal-rs4pro', category: 'Gimbal', brand: 'DJI', model: 'RS 4 Pro', maxPayload: 4500, weight: 1600 }),
  acc({ id: 'gimbal-rs3mini', category: 'Gimbal', brand: 'DJI', model: 'RS 3 Mini', maxPayload: 2000, weight: 795 }),
  acc({ id: 'tripod-leofoto', category: 'Tripod', brand: 'Leofoto', model: 'LS-324C + LH-40', maxPayload: 15000, weight: 1750 }),
  acc({ id: 'tripod-travel', category: 'Tripod', brand: 'Peak Design', model: 'Travel Tripod (Carbon)', maxPayload: 9100, weight: 1270 }),
];

export const CATALOG = [...BODIES, ...LENSES, ...ACCESSORIES];

export const ACCESSORY_CATEGORIES = ['Adapter', 'Battery', 'Memory card', 'Filter', 'Flash', 'Microphone', 'Gimbal', 'Tripod', 'Other'];
