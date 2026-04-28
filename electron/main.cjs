// Electron main process for Mantrabe (desktop / Linux).
//
// Loads the Vite-built dist/index.html in a single window, exposes a tiny
// `mantrabe.notify(...)` bridge to the renderer for system notifications,
// and tries to keep the app running in the tray when the window is closed
// so reminders still fire.

const { app, BrowserWindow, Notification, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');
const SVG_PATH = path.join(__dirname, '..', 'public', 'icon.svg');
const INDEX_HTML = path.join(__dirname, '..', 'dist', 'index.html');

function appIcon() {
  if (fs.existsSync(ICON_PATH)) return nativeImage.createFromPath(ICON_PATH);
  if (fs.existsSync(SVG_PATH)) return nativeImage.createFromPath(SVG_PATH);
  return nativeImage.createEmpty();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: 'Mantrabe',
    icon: appIcon(),
    backgroundColor: '#161a26',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // No menu bar by default — keeps the meditative feel.
  mainWindow.setMenuBarVisibility(false);

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else if (fs.existsSync(INDEX_HTML)) {
    mainWindow.loadFile(INDEX_HTML);
  } else {
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<h1 style="font-family:sans-serif;color:#e8ecf5;background:#161a26;padding:24px">Run <code>npm run build</code> first.</h1>',
        ),
    );
  }

  mainWindow.on('close', (event) => {
    // On non-macOS, hide to tray so the renderer's setTimeout-based scheduler
    // keeps running. The user can fully quit via the tray menu.
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    tray = new Tray(appIcon());
    tray.setToolTip('Mantrabe');
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Mantrabe',
        click: () => {
          if (!mainWindow) createWindow();
          else {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => {
      if (!mainWindow) createWindow();
      else if (mainWindow.isVisible()) mainWindow.hide();
      else mainWindow.show();
    });
  } catch (e) {
    // Tray support varies across Linux desktop environments — failing to
    // create one shouldn't crash the app.
    console.warn('Could not create tray:', e?.message);
    tray = null;
  }
}

ipcMain.handle('mantrabe:notify', (_event, payload) => {
  const { title, body } = payload || {};
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title: title || 'Mantrabe',
    body: body || '',
    icon: appIcon(),
    silent: true, // we play our own bell from the renderer
  });
  n.on('click', () => {
    if (!mainWindow) createWindow();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  n.show();
  return true;
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep running in the background on Linux/Windows so reminders fire.
  // macOS apps traditionally stay alive via the dock; we already do too.
  if (process.platform === 'darwin') return;
  if (!tray) app.quit();
});
