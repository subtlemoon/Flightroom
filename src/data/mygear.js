// Gear Jaewon owns. Each id is marked as owned once, on first launch of a version
// that lists it, so removing it in the app later sticks.
export const MY_GEAR = [
  'nikon-z7ii', 'nikon-z2470f4', 'nikon-f2870d', 'tamron-70210-f', 'sigma-70200sports-f',
  'tripod-smallrig-ct20', 'card-sandisk-cfb128', 'card-amzn-microsd512', 'filter-bw-007-77',
];

// Groups added once in the same way, so existing installs get them too.
export const MY_GROUPS = [
  {
    id: 'g-mine', name: 'My kit', icon: '📸', color: '#9775fa',
    presets: [
      {
        id: 'p-my-z7ii', name: 'My Z7 II kit',
        bodyIds: ['nikon-z7ii'],
        lensIds: ['nikon-z2470f4', 'nikon-f2870d', 'tamron-70210-f', 'sigma-70200sports-f'],
        accessoryIds: ['card-sandisk-cfb128', 'card-amzn-microsd512', 'filter-bw-007-77', 'tripod-smallrig-ct20'],
        notes: 'Everything I own.',
      },
    ],
  },
];
