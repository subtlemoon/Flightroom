// Example groups and presets the app starts with. All of them can be edited or deleted.
export const SEED_GROUPS = [
  {
    id: 'g-filming', name: 'Filming', icon: '🎬', color: '#ff6b6b',
    presets: [
      { id: 'p-fx3', name: 'Run & gun cinema', bodyIds: ['sony-fx3'], lensIds: ['sony-2470gm2', 'sony-35gm'], accessoryIds: ['bat-npfz100', 'card-cfa', 'filter-vnd82', 'mic-ecmb10', 'gimbal-rs4'], notes: 'Compact full-frame kit for documentary and events.' },
      { id: 'p-z9raw', name: '8K RAW production', bodyIds: ['nikon-z9'], lensIds: ['nikon-z2470s', 'nikon-z70200s'], accessoryIds: ['bat-enel18d', 'card-cfb', 'filter-vnd82', 'gimbal-rs4pro'], notes: 'Internal N-RAW for maximum grading latitude.' },
      { id: 'p-bmpcc', name: 'Blackmagic indie kit', bodyIds: ['bmd-p6kpro'], lensIds: ['sigma-1835-ef', 'canon-ef24105ii'], accessoryIds: ['bat-npf570', 'card-cfast', 'mic-videomicngo'], notes: 'Super 35 BRAW with EF glass.' },
    ],
  },
  {
    id: 'g-sports', name: 'Sports', icon: '🏟️', color: '#4dabf7',
    presets: [
      { id: 'p-r5ii', name: 'Field sports telephoto', bodyIds: ['canon-r5ii'], lensIds: ['canon-rf100500', 'canon-rf70200', 'canon-ef70200iii'], accessoryIds: ['canon-efeosr', 'bat-lpe6p', 'bat-lpe6nh', 'card-cfb', 'tripod-leofoto'], notes: 'Reusing an EF 70-200 through the Canon adapter.' },
      { id: 'p-z8ftz', name: 'Indoor court (adapted F glass)', bodyIds: ['nikon-z8'], lensIds: ['nikon-f70200e', 'nikon-z2470s'], accessoryIds: ['nikon-ftz2', 'bat-enel15c', 'card-cfb', 'flash-godox-v1n'], notes: 'Classic F-mount 70-200 on the Z8 through FTZ II.' },
    ],
  },
  {
    id: 'g-nature', name: 'Nature', icon: '🌿', color: '#51cf66',
    presets: [
      { id: 'p-wildlife', name: 'Wildlife long lens', bodyIds: ['nikon-z6iii'], lensIds: ['nikon-z180600', 'nikon-f70300p'], accessoryIds: ['nikon-ftz2', 'bat-enel15c', 'card-cfb', 'tripod-leofoto'], notes: 'Birds and wildlife from a hide.' },
      { id: 'p-landscape', name: 'Lightweight landscape', bodyIds: ['fuji-xt5'], lensIds: ['fuji-1655', 'fuji-100400'], accessoryIds: ['bat-npw235', 'card-sd2', 'filter-cpl77', 'tripod-travel'], notes: '40MP APS-C hiking kit.' },
      { id: 'p-vintage', name: 'Vintage glass walkabout', bodyIds: ['nikon-z6'], lensIds: ['nikon-f50d', 'nikon-f50ais'], accessoryIds: ['nikon-ftz', 'bat-enel15c', 'card-cfb', 'filter-uv58'], notes: 'Old F-mount primes on an original Z6.' },
    ],
  },
];
