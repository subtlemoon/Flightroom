# Flightroom

A Windows app for photographers: cull a shoot fast, develop the RAW files with
Lightroom-style controls, and plan camera kits. (It was called GearCheck up to
version 1.5; GearCheck installs update into Flightroom on their own and keep
their gear, groups, settings and culling folders.)

Kit planning: add your gear, see full specs, and check what works together:
lens mounts and adapters (like the Nikon FTZ), firmware requirements, batteries,
memory cards, filters, flashes, mics, gimbal and tripod payload, and whether
Lightroom, Premiere Pro and DaVinci Resolve can open each camera's files.

It is a [Tauri](https://tauri.app) app: a Rust desktop side and a React window
shown by the system's WebView2, so there is no bundled browser.

## Developing

    npm install
    npm run dev      # UI only, in the browser at http://localhost:5173
    npm start        # the desktop app with live reload (needs Rust)
    npm test         # JS tests
    npm run test:rust
    npm run dist     # Windows installer (build it on Windows; CI does)

## Where things live

- `src/data/gear.js` starter catalog of bodies, lenses and accessories
- `src/data/software.js` editing app support per file format
- `src/data/presets.js` starter groups and presets
- `src/engine/compat.js` compatibility rules
- `src/components/` UI; `src/bridge.js` the window's calls to the desktop side
- `src-tauri/src/lib.rs` window, `gcimg://` file protocol, command list
- `src-tauri/src/photos.rs`, `photolib.rs` culling: folder listing, embedded
  JPEG previews, thumbnail cache, XMP star ratings
- `src-tauri/src/develop.rs` RAW decoding (rawler), demosaicing, JPEG export
- `src-tauri/src/xmp.rs` reading and writing `.xmp` sidecars
- `src-tauri/src/updater.rs` updates; `migrate.rs` taking over GearCheck's data
- `src-tauri/installer-hooks.nsh` removes the old GearCheck program on install
- `src/cull/`, `src/develop/` culling previews and the develop renderer

## Updates

The app version is the `version` in `package.json`, as major.minor.patch:
a new feature or tab bumps minor (1.1.10 → 1.2.0), a fix bumps patch
(1.2.0 → 1.2.1), and a big overhaul bumps major (2.0.0). Every push to `main`
runs `.github/workflows/release.yml` on a Windows runner: it runs the tests and,
if that version has no GitHub release yet, builds the installer and publishes it
as release `v<version>`. Pushes that keep the version (catalog or news updates)
publish nothing. Installed copies check for a new release on launch and every hour,
download it in the background (checking its SHA-256 from `latest.json`), and
install it when the app closes. Each release also carries `latest.yml`, which
GearCheck 1.x's updater reads, so old GearCheck installs update into Flightroom.
CI also tests that hand-over on Windows: it installs GearCheck 1.5.0, runs the
new installer the way GearCheck's updater does, and checks the result.

(Releases up to v1.1.10 were numbered 1.1.<build number> automatically.)

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

## Culling

The Culling tab opens a folder of NEF/RAW/JPEG files. It never decodes RAW data:
it reads the JPEG previews the camera embedded (a 640 px one for thumbnails and a
full-size one for viewing), decodes them off the UI thread at screen size, and
decodes the neighbouring photos ahead of time. Thumbnails are cached in the app
data folder. Star ratings are written as `xmp:Rating` to a `.xmp` sidecar next to
each RAW file (Lightroom/Bridge/Capture One convention), or inside standalone JPEGs.

## Develop

The Develop tab decodes the real RAW data (not the embedded JPEG) with
[rawler](https://github.com/dnglab/dnglab): white balance and the camera's
colour matrices come from the file. The desktop side sends the window a
screen-sized version of the photo as half-float linear RGB, plus full-resolution
demosaiced crops when you zoom in, and all the adjustments run as WebGL2 shaders,
so sliders update live.

Edits are never written into the RAW file. They are saved as Lightroom
(Camera Raw) settings in the photo's `.xmp` sidecar (`crs:Exposure2012`,
`crs:Contrast2012`, tone curve, HSL, crop, and so on), the same file Lightroom
reads, alongside the star rating. Export renders the full-resolution photo in
tiles and saves sRGB JPEGs with the camera's Exif.

The panels follow Lightroom's: Basic (profile, treatment, white balance presets
and selector, Auto), Tone Curve (parametric with splits, point and RGB curves,
Refine Saturation), Color Mixer (and the B&W mix), Color Grading, Detail,
Lens Corrections (manual distortion, vignetting, defringe), Transform, Effects
and Calibration, each written under Lightroom's own `crs:` name. Lightroom's AI
tools (Denoise, Super Resolution, Lens Blur), Point Color, Upright and lens
profiles aren't previewed; "Enable profile corrections" is passed on for
Lightroom to apply.
