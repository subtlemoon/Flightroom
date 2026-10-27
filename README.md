# GearCheck

A Windows app for planning camera kits. Add your gear, see full specs, and check
what works together: lens mounts and adapters (like the Nikon FTZ), firmware
requirements, batteries, memory cards, filters, flashes, mics, gimbal and tripod
payload, and whether Lightroom, Premiere Pro and DaVinci Resolve can open each
camera's files.

## Developing

    npm install
    npm run dev      # UI in the browser at http://localhost:5173
    npm start        # build and open in Electron
    npm test         # compatibility engine tests
    npm run dist     # Windows installer + portable exe in release/ (on Linux needs wine + wine32)

## Where things live

- `src/data/gear.js` starter catalog of bodies, lenses and accessories
- `src/data/software.js` editing app support per file format
- `src/data/presets.js` starter groups and presets
- `src/engine/compat.js` compatibility rules
- `src/components/` UI
- `electron/main.cjs` desktop window

## Updates

Every push to `main` runs `.github/workflows/release.yml` on a Windows runner:
it runs the tests, sets the version to `1.1.<build number>`, builds the
installer and publishes it as a GitHub release. Installed copies check for a
new release on launch, download it in the background, and offer to restart.

## Live gear catalog

`catalog.json` (generated from `src/data` by `npm run catalog`) is fetched by the
app from GitHub on launch and every 30 minutes, so gear and "my gear" changes
reach the app as soon as they are pushed, without an app update. The last
fetched copy is cached for offline use, and the built-in list is the fallback.
A test fails if `catalog.json` is out of date.

## Monthly news

`news.json` holds one entry per month (summary, a "for your kit" line, and
announced items linked to catalog ids). The app's News tab loads it live from
GitHub like the catalog; the bundled copy is the offline fallback. A monthly
routine adds the previous month's entry and new catalog items.
