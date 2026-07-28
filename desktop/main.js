const { app, BrowserWindow } = require('electron');

// Thin desktop shell -- loads the live deployed app rather than bundling a
// static copy, so every future content/bugfix update ships automatically
// the next time the app launches, exactly like reopening a browser tab.
// Only the shell itself (icon, window size, app name) needs a rebuild.
const APP_URL = 'https://budget-tracker-tau-liart.vercel.app/';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Hearth',
    backgroundColor: '#0b1418',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(APP_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
