// How each editing app handles each camera file format.
//   native  opens directly
//   plugin  needs a free plugin or add-on
//   limited works with caveats
//   none    not supported
// Support changes with each app release, so these are a starting point to verify.

export const EDITING_APPS = [
  { id: 'lightroom', name: 'Lightroom Classic', kind: 'photo' },
  { id: 'premiere', name: 'Premiere Pro', kind: 'video' },
  { id: 'resolve', name: 'DaVinci Resolve (free)', kind: 'video' },
  { id: 'resolveStudio', name: 'DaVinci Resolve Studio', kind: 'video' },
];

// Every RAW stills format in the catalog is read natively by Lightroom.
export const RAW_PHOTO_SUPPORT = {
  ARW: { lightroom: 'native' },
  CR3: { lightroom: 'native' },
  NEF: { lightroom: 'native' },
  RAF: { lightroom: 'native' },
  RW2: { lightroom: 'native' },
  DNG: { lightroom: 'native' },
};

const HEVC_NOTE = '10-bit 4:2:2 H.265 plays far smoother with hardware decoding, which needs Resolve Studio.';

export const VIDEO_SUPPORT = {
  'XAVC S': { premiere: 'native', resolve: 'native', resolveStudio: 'native' },
  'XAVC HS': { premiere: 'native', resolve: ['limited', HEVC_NOTE], resolveStudio: 'native' },
  'XAVC S-I': { premiere: 'native', resolve: 'native', resolveStudio: 'native' },
  'XF-AVC': { premiere: 'native', resolve: 'native', resolveStudio: 'native' },
  'H.264': { premiere: 'native', resolve: 'native', resolveStudio: 'native' },
  'H.265 (HEVC)': { premiere: 'native', resolve: ['limited', HEVC_NOTE], resolveStudio: 'native' },
  'ProRes 422 HQ': { premiere: 'native', resolve: 'native', resolveStudio: 'native' },
  'ProRes RAW': {
    premiere: 'native',
    resolve: ['none', 'Resolve has not supported ProRes RAW. Check the latest release notes.'],
    resolveStudio: ['none', 'Resolve has not supported ProRes RAW. Check the latest release notes.'],
  },
  'N-RAW': {
    premiere: ['limited', 'Check that your Premiere Pro version lists Nikon N-RAW support.'],
    resolve: 'native',
    resolveStudio: 'native',
  },
  'Cinema RAW Light': {
    premiere: ['plugin', 'Install Canon RAW Plugin for Premiere Pro.'],
    resolve: 'native',
    resolveStudio: 'native',
  },
  'Blackmagic RAW': {
    premiere: ['plugin', 'Install the Blackmagic RAW plugin (part of Blackmagic RAW installer).'],
    resolve: 'native',
    resolveStudio: 'native',
  },
};

// Resolve (free) delivers up to UHD 60p; larger resolutions need Studio.
export const RESOLVE_FREE_MAX = '4K';

export function supportFor(table, format, appId) {
  const entry = table[format]?.[appId];
  if (!entry) return { status: 'unknown', note: '' };
  return Array.isArray(entry) ? { status: entry[0], note: entry[1] } : { status: entry, note: '' };
}
