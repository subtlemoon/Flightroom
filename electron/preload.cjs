const { contextBridge, ipcRenderer } = require('electron');

// Lets the Settings page show the app version and the background update status,
// and gives the Culling tab access to photo folders.
contextBridge.exposeInMainWorld('gearcheck', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  onUpdateStatus: (fn) => {
    const listener = (_e, status) => fn(status);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },
  // Culling tab: folders, previews, and star ratings written to the photos.
  cull: {
    pickFolder: () => ipcRenderer.invoke('cull:pick'),
    scan: (folder) => ipcRenderer.invoke('cull:scan', folder),
    meta: (ids) => ipcRenderer.invoke('cull:meta', ids),
    rate: (photo, rating) => ipcRenderer.invoke('cull:rate', { id: photo.id, ratingIn: photo.ratingIn, sidecar: photo.sidecar, rating }),
    saveThumb: (id, bytes) => ipcRenderer.invoke('cull:saveThumb', id, bytes),
    cacheSize: () => ipcRenderer.invoke('cull:cacheSize'),
    clearCache: () => ipcRenderer.invoke('cull:clearCache'),
  },
});
