const { app, BrowserWindow, ipcMain, dialog, screen, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { startServer } = require('./server/index.js');
const { initDb, searchSongs, addSong, getNextId } = require('./database/db.js');

let io; // Declare io in module scope
let projectorWindow = null;
let currentServerStatus = { status: 'Disconnected', ip: 'Unknown', connections: 0 };

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#ffffff',
            symbolColor: '#000000',
            height: 40
        },
        autoHideMenuBar: true,
        title: 'LyriX Desktop',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, '../public/icon.ico')
    });

    mainWindow.maximize();

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer_dist/index.html'));
    }

    // DevTools can still be opened via Application Controls in Settings tab

    // Set title and icon if DevTools is detached into its own window
    mainWindow.webContents.on('devtools-opened', () => {
        const devToolsWebContents = mainWindow.webContents.devToolsWebContents;
        if (devToolsWebContents) {
            const devToolsWindow = BrowserWindow.fromWebContents(devToolsWebContents);
            if (devToolsWindow && devToolsWindow !== mainWindow) {
                const setCustomTitle = () => {
                    devToolsWindow.setTitle('LyriX Developer Console');
                    devToolsWindow.setIcon(path.join(__dirname, '../public/icon.ico'));
                };

                setCustomTitle();

                devToolsWindow.on('page-title-updated', (e) => {
                    e.preventDefault();
                    setCustomTitle();
                });
            }
        }
    });
}

// Global hook for DB to convert updates
global.broadcastScheduleUpdate = (schedule) => {
    if (io) {
        io.emit('schedule-updated', schedule);
    }
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(w => w.webContents.send('schedule-updated', schedule));
};

global.broadcastSongsUpdate = (songs) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(w => w.webContents.send('songs-updated', songs));
};

app.whenReady().then(() => {
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.lyrix.desktop');
    }
    nativeTheme.themeSource = 'light';
    initDb();
    createWindow();
    console.log("App Ready");

    // Updater Configuration
    autoUpdater.autoDownload = false; // We want manual control

    if (process.env.NODE_ENV !== 'development') {
        try {
            // Check if app-update.yml exists in resources
            const resourcesPath = path.join(process.resourcesPath);
            const updateConfigPath = path.join(resourcesPath, 'app-update.yml');

            if (!fs.existsSync(updateConfigPath)) {
                console.log("app-update.yml missing in resources. Creating fallback in userData...");
                const fallbackConfigPath = path.join(app.getPath('userData'), 'app-update.yml');
                const configContent = `owner: justforaitoolz-ops\nrepo: LyriX-Church-System\nprovider: github`;
                fs.writeFileSync(fallbackConfigPath, configContent);
                autoUpdater.updateConfigPath = fallbackConfigPath;
                console.log(`Updater config path set to: ${fallbackConfigPath}`);
            }
        } catch (e) {
            console.error("Failed to setup update fallback config:", e);
        }
    }

    // Bypass missing app-update.yml by setting feed manually
    try {
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'justforaitoolz-ops',
            repo: 'LyriX-Church-System'
        });
        console.log("Updater feed configured manually.");
    } catch (e) {
        console.error("Failed to set manual feed URL:", e);
    }

    autoUpdater.on('checking-for-update', () => {
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('update-status', 'checking'));
    });

    autoUpdater.on('update-available', (info) => {
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('update-status', 'available', info));
    });

    autoUpdater.on('update-not-available', (info) => {
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('update-status', 'not-available'));
    });

    autoUpdater.on('error', (err) => {
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('update-status', 'error', err.message));
    });

    autoUpdater.on('download-progress', (progressObj) => {
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('update-progress', progressObj.percent));
    });

    autoUpdater.on('update-downloaded', (info) => {
        BrowserWindow.getAllWindows().forEach(win => win.webContents.send('update-status', 'downloaded'));
        // Optionally ask user to install now
    });

    ipcMain.handle('check-for-updates', async () => {
        try {
            return await autoUpdater.checkForUpdates();
        } catch (e) {
            console.error("Update check failed:", e);
            throw e;
        }
    });

    ipcMain.handle('start-download', async () => {
        return await autoUpdater.downloadUpdate();
    });

    ipcMain.handle('install-update', () => {
        autoUpdater.quitAndInstall(true, true);
    });

    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    // IPC Handlers for Renderer
    ipcMain.handle('search-songs', async (event, query, category) => {
        return searchSongs(query, category);
    });

    ipcMain.handle('get-next-id', async (event, category) => {
        return getNextId(category);
    });

    ipcMain.handle('add-song', async (event, songData) => {
        return addSong(songData);
    });

    ipcMain.handle('update-song', async (event, songData) => {
        const { updateSong } = require('./database/db.js');
        // updateSong takes songData directly
        return updateSong(songData);
    });

    ipcMain.handle('get-song', async (event, id) => {
        const { getSong } = require('./database/db.js');
        return getSong(id);
    });

    ipcMain.handle('delete-song', async (event, id) => {
        const { deleteSong } = require('./database/db.js');
        return deleteSong(id);
    });

    // Schedule Handlers
    const { getSchedule, addToSchedule, removeFromSchedule, reorderSchedule, clearSchedule } = require('./database/db.js');

    ipcMain.handle('get-schedule', async () => getSchedule());
    ipcMain.handle('add-to-schedule', async (event, songId) => addToSchedule(songId));
    ipcMain.handle('remove-from-schedule', async (event, instanceId) => removeFromSchedule(instanceId));
    ipcMain.handle('reorder-schedule', async (event, newOrder) => reorderSchedule(newOrder));
    ipcMain.handle('clear-schedule', async () => clearSchedule());

    ipcMain.handle('search-lyrics', async (event, query) => {
        console.log(`[Search] Searching using Browser: ${query}`);
        let searchWindow = new BrowserWindow({
            show: false,
            width: 800,
            height: 600,
            webPreferences: {
                offscreen: true,
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        try {
            const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + ' lyrics')}`;
            console.log(`[Search] Loading: ${searchUrl}`);
            await searchWindow.loadURL(searchUrl);

            console.log("[Search] Page loaded, waiting for results...");

            const results = await searchWindow.webContents.executeJavaScript(`
                new Promise(resolve => {
                    setTimeout(() => {
                        const items = [];
                        document.querySelectorAll('article').forEach(el => {
                            const titleEl = el.querySelector('h2 a');
                            const linkEl = el.querySelector('h2 a');
                            const snippetEl = el.querySelector('div > div > div');
                            
                            if (titleEl && linkEl) {
                                items.push({
                                    title: titleEl.innerText,
                                    url: linkEl.href,
                                    snippet: snippetEl ? snippetEl.innerText : ''
                                });
                            }
                        });
                        
                        if (items.length === 0) {
                            document.querySelectorAll('#links .result__a').forEach(el => {
                                items.push({ title: el.innerText, url: el.href, snippet: '' });
                            });
                        }
                        resolve(items);
                    }, 2000); 
                });
            `);

            console.log(`[Search] Found ${results.length} results.`);
            return results.slice(0, 15);

        } catch (e) {
            console.error("[Search] Browser Error:", e);
            return [];
        } finally {
            if (searchWindow && !searchWindow.isDestroyed()) {
                searchWindow.destroy();
            }
        }
    });

    ipcMain.handle('app-control', (event, command) => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return;

        switch (command) {
            case 'reload': win.reload(); break;
            case 'fullscreen': win.setFullScreen(!win.isFullScreen()); break;
            case 'zoom-in': win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5); break;
            case 'zoom-out': win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5); break;
            case 'zoom-reset': win.webContents.setZoomLevel(0); break;
            case 'devtools': win.webContents.toggleDevTools(); break;
        }
    });

    ipcMain.handle('close-projector-window', () => {
        if (projectorWindow) {
            projectorWindow.close();
            return false; // Tells UI it is closed
        }
        return false;
    });

    ipcMain.handle('toggle-projector-window', () => {
        if (projectorWindow) {
            projectorWindow.close();
            // The close event handler will notify clients and nullify the variable
            return false;
        }

        const displays = screen.getAllDisplays();
        const externalDisplay = displays.find((display) => {
            return display.bounds.x !== 0 || display.bounds.y !== 0;
        });

        let winOptions = {
            width: 800,
            height: 600,
            autoHideMenuBar: true,
            title: 'LyriX Stage',
            backgroundColor: '#000000',
            icon: path.join(__dirname, '../public/icon.ico'),
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        };

        if (externalDisplay) {
            winOptions.x = externalDisplay.bounds.x + 50;
            winOptions.y = externalDisplay.bounds.y + 50;
            winOptions.fullscreen = true;
        }

        projectorWindow = new BrowserWindow(winOptions);

        if (externalDisplay) {
            projectorWindow.setFullScreen(true);
        }

        projectorWindow.loadFile(path.join(__dirname, '../public/projector.html'));

        // Handle Native Keys on Projector Window
        projectorWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'Escape' && projectorWindow) {
                projectorWindow.close();
                event.preventDefault();
            } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(input.key)) {
                // Forward slide navigation keys back to main window
                BrowserWindow.getAllWindows().forEach(win => {
                    if (win !== projectorWindow && !win.isDestroyed()) {
                        win.webContents.send('projector-key-press', input.key);
                    }
                });
                event.preventDefault();
            }
        });

        projectorWindow.on('closed', () => {
            projectorWindow = null;
            BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('projector-state-changed', false);
                }
            });
        });

        return true;
    });

    ipcMain.handle('fetch-lyrics-content', async (event, url) => {
        let fetchWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                offscreen: true,
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        try {
            console.log(`[Fetch] Loading: ${url}`);
            await fetchWindow.loadURL(url);

            const content = await fetchWindow.webContents.executeJavaScript(`
                new Promise(resolve => {
                    setTimeout(() => {
                        const removables = ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'img', 'svg', 'button', 'form'];
                        removables.forEach(tag => document.querySelectorAll(tag).forEach(el => el.remove()));
                        
                        let container = document.querySelector('[class*="Lyrics__Container"]');
                        if (!container) container = document.querySelector('.lyrics'); 
                        if (!container) container = document.querySelector('.lyricbox'); 
                        
                        if (!container) {
                            const divs = Array.from(document.querySelectorAll('div'));
                            divs.sort((a, b) => b.getElementsByTagName('br').length - a.getElementsByTagName('br').length);
                            if (divs.length > 0 && divs[0].getElementsByTagName('br').length > 5) {
                                container = divs[0];
                            }
                        }
                        
                        if (!container) container = document.body;

                        if (container) {
                            // Preserve newlines
                            // Use a unique token for BR so we can distinguish hard breaks from layout spacing if needed
                            container.querySelectorAll('br').forEach(br => br.replaceWith('__BR__'));
                            container.querySelectorAll('p').forEach(p => p.append('__BR____BR__'));
                            resolve(container.innerText);
                        } else {
                            resolve("Could not auto-detect lyrics.");
                        }
                    }, 100); // Reduced delay to make it snappier
                });
            `);

            // Post-processing
            let text = content.replace(/__BR__/g, '\n');

            // Normalize: 
            // 1. Trim every line
            // 2. Preserve stanza breaks (single empty line) but collapse multiple

            return text
                .split('\n')
                .map(l => l.trim())
                .reduce((acc, line) => {
                    const last = acc[acc.length - 1];
                    // If current line is empty
                    if (!line || line.length === 0) {
                        // Only add if the previous line wasn't also empty
                        if (acc.length > 0 && last !== '') {
                            acc.push('');
                        }
                    } else {
                        acc.push(line);
                    }
                    return acc;
                }, [])
                .join('\n')
                .substring(0, 10000);

        } catch (e) {
            console.error("[Fetch] Browser Error:", e);
            return "Failed to fetch content.";
        } finally {
            if (fetchWindow && !fetchWindow.isDestroyed()) {
                fetchWindow.destroy();
            }
        }
    });

    io = startServer((data) => {
        console.log("Server Status:", data);
        currentServerStatus = data;
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('status-update', data);
        });
    });

    ipcMain.handle('get-server-status', () => currentServerStatus);

    let globalMaxDevices = 1;

    if (io) {
        io.on('connection', (socket) => {
            if (io.engine.clientsCount > globalMaxDevices) {
                console.log("Main Process: Connection rejected (Max devices reached).");
                socket.emit('connection-rejected', { reason: 'Device limit reached' });
                socket.disconnect(true);
                return;
            }

            console.log("Main Process: Client Connected", socket.id);

            // Send initial schedule
            socket.emit('schedule-updated', getSchedule());

            socket.on('fetch-schedule', () => {
                socket.emit('schedule-updated', getSchedule());
            });

            socket.on('search', (query) => {
                const results = searchSongs(query);
                socket.emit('search-results', results);
            });

            socket.on('add-to-schedule', (songId) => {
                const list = addToSchedule(songId);
                io.emit('schedule-updated', list); // Broadcast to all mobiles
                // Also update renderer windows
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('schedule-updated', list));
            });

            socket.on('remove-from-schedule', (instanceId) => {
                const list = removeFromSchedule(instanceId);
                io.emit('schedule-updated', list);
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('schedule-updated', list));
            });

            socket.on('reorder-schedule', (newOrder) => {
                const list = reorderSchedule(newOrder);
                io.emit('schedule-updated', list);
                BrowserWindow.getAllWindows().forEach(win => win.webContents.send('schedule-updated', list));
            });

            socket.on('command', (cmd) => {
                console.log("Main Process Cmd:", cmd);
                if (cmd.action === 'search-song') {
                    // Legacy single song load support
                    const songs = searchSongs(cmd.query || '');
                    if (songs.length > 0) {
                        BrowserWindow.getAllWindows().forEach(win => {
                            win.webContents.send('remote-command', { action: 'set-song', song: songs[0] });
                        });
                    }
                } else if (cmd.action === 'set-song-by-id') {
                    const song = getSong(cmd.id);
                    if (song) {
                        BrowserWindow.getAllWindows().forEach(win => {
                            win.webContents.send('remote-command', { action: 'set-song', song: song });
                        });
                    }
                } else if (cmd.action === 'blank-screen') {
                    // Forward blank screen toggle to all renderer windows to maintain React state
                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('remote-command', { action: 'blank-screen' });
                    });
                } else {
                    BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('remote-command', cmd);
                    });
                }
            });
        });
    }

    ipcMain.handle('projector-sync', (event, data) => {
        if (io) {
            if (data.type === 'slide') {
                io.emit('current-slide', { slide: data.content });
                if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('current-slide', { slide: data.content });
            } else if (data.type === 'black') {
                io.emit('blank-screen', data.isBlack);
                if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('blank-screen', data.isBlack);
            }
        }
    });

    ipcMain.handle('update-projector-settings', (event, settings) => {
        if (settings.maxRemoteDevices !== undefined) {
            globalMaxDevices = settings.maxRemoteDevices;
        }
        if (io) {
            io.emit('settings-update', settings);
            if (projectorWindow && !projectorWindow.isDestroyed()) projectorWindow.webContents.send('settings-update', settings);
        }
    });

    ipcMain.handle('select-image-file', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }]
        });
        if (!result.canceled && result.filePaths.length > 0) {
            // Return file protocol path for rendering
            return `file://${result.filePaths[0].replace(/\\/g, '/')}`;
        }
        return null;
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
