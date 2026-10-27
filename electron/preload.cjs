const { contextBridge, ipcRenderer } = require('electron');

// Lets the Settings page show the app version and the background update status.
contextBridge.exposeInMainWorld('gearcheck', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  onUpdateStatus: (fn) => {
    const listener = (_e, status) => fn(status);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },
});
