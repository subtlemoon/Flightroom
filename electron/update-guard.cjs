// Keeps GearCheck from opening while an update is installing.
//
// Updates install when the app closes: the old app quits and the installer
// replaces its files for 10-20 seconds. If GearCheck is opened during that time,
// the old version would start (or the half-replaced files would). So just before
// the installer starts, the app leaves a note in its data folder. When the app
// starts and finds the note while the installer is still running, it shows a
// short "updating" message instead of opening, steps out of the installer's way,
// and has Windows open the new version as soon as the installer finishes.
const { app, BrowserWindow } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const notePath = () => path.join(app.getPath('userData'), 'updating.json');
const INSTALLER = 'GearCheck-Setup'; // installer process name prefix (see package.json nsis.artifactName)

function markInstalling(version) {
  try { fs.writeFileSync(notePath(), JSON.stringify({ version, at: Date.now() })); } catch {}
}

function readNote() {
  try { return JSON.parse(fs.readFileSync(notePath(), 'utf8')); } catch { return null; }
}

const clearNote = () => { try { fs.unlinkSync(notePath()); } catch {} };

function installerRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', `IMAGENAME eq ${INSTALLER}*`, '/NH', '/FO', 'CSV'], { windowsHide: true, timeout: 5000 },
      (err, out) => resolve(!err && out.toLowerCase().includes(INSTALLER.toLowerCase())));
  });
}

// Resolves true when this launch should stop because an update is installing.
async function updateInProgress() {
  if (process.platform !== 'win32' || !app.isPackaged) return false;
  const note = readNote();
  if (!note) return false;
  if (note.version === app.getVersion() || Date.now() - note.at > 10 * 60 * 1000) {
    clearNote(); // the update finished (this is the new version), or the note is stale
    return false;
  }
  // The installer starts a moment after the old app quits, so give it a few seconds to appear.
  for (let i = 0; i < 8; i++) {
    if (await installerRunning()) return true;
    if (Date.now() - note.at > 15000) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Opens GearCheck again once the installer has finished (waits at most 5 minutes).
function reopenWhenInstalled() {
  const exe = app.getPath('exe').replace(/'/g, "''");
  const script = [
    '$t = 0',
    `while ((Get-Process -Name '${INSTALLER}*' -ErrorAction SilentlyContinue) -and $t -lt 300) { Start-Sleep -Seconds 1; $t++ }`,
    'Start-Sleep -Seconds 2',
    `Start-Process -FilePath '${exe}'`,
  ].join('; ');
  try {
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
      { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {}
}

const PAGE = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0b0d12;color:#eef1f6;font:14px 'Segoe UI',system-ui,sans-serif;-webkit-user-select:none;-webkit-app-region:drag}
body{display:flex;align-items:center;gap:16px;padding:0 24px;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);border-radius:14px}
.spin{width:28px;height:28px;border-radius:50%;border:3px solid rgba(139,123,255,.25);border-top-color:#8b7bff;animation:s 1s linear infinite;flex-shrink:0}
@keyframes s{to{transform:rotate(360deg)}}b{display:block;font-size:15px;margin-bottom:3px}span{color:#8b93a7;font-size:12.5px}
</style><div class="spin"></div><div><b>GearCheck is updating</b><span>It will open by itself in a few seconds.</span></div>`;

// Shows the message briefly, then quits so the installer can finish replacing files.
function showUpdatingAndQuit() {
  reopenWhenInstalled();
  const w = new BrowserWindow({
    width: 380, height: 92, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#0b0d12', show: false,
  });
  w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(PAGE)}`);
  w.once('ready-to-show', () => w.show());
  setTimeout(() => app.exit(0), 2500);
}

module.exports = { markInstalling, updateInProgress, showUpdatingAndQuit, clearNote };
