const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { setupPhotos } = require('./photos.cjs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0d12',
    title: 'GearCheck',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  // Links open in the normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
}

// New versions are published as GitHub releases by the build workflow. They
// download silently in the background and install silently when the app closes.
// Status is shown in Settings and written to update.log in the app data folder.
let updateStatus = { state: 'idle', message: 'Not checked yet' };

function setStatus(state, message) {
  updateStatus = { state, message, at: Date.now() };
  win?.webContents.send('update:status', updateStatus);
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'update.log'), `${new Date().toISOString()} ${state}: ${message}\n`);
  } catch {}
}

function checkForUpdates() {
  if (!app.isPackaged) return setStatus('idle', 'Updates are only checked in the installed app');
  return autoUpdater.checkForUpdates().catch(() => {});
}

function setupUpdates() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => setStatus('checking', 'Checking for updates…'));
  autoUpdater.on('update-not-available', () => setStatus('current', 'Up to date'));
  autoUpdater.on('update-available', (info) => setStatus('downloading', `Downloading version ${info.version}…`));
  autoUpdater.on('download-progress', (p) => setStatus('downloading', `Downloading update… ${Math.round(p.percent)}%`));
  autoUpdater.on('update-downloaded', (info) => setStatus('ready', `Version ${info.version} will install when you close GearCheck`));
  autoUpdater.on('error', (err) => setStatus('error', `Update failed: ${err.message.split('\n')[0]}`));
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('update:status', () => updateStatus);
  ipcMain.handle('update:check', () => checkForUpdates());
  checkForUpdates();
  setInterval(checkForUpdates, 60 * 60 * 1000);
}

app.whenReady().then(() => {
  createWindow();
  setupPhotos(() => win);
  setupUpdates();
});
app.on('window-all-closed', () => app.quit());
