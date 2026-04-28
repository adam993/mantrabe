// Renderer <-> main bridge. Exposes a minimal `mantrabe` API that the web
// notification layer detects and prefers over `window.Notification` when
// available. Everything else stays sandboxed.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mantrabe', {
  isElectron: true,
  notify: (payload) => ipcRenderer.invoke('mantrabe:notify', payload),
});
