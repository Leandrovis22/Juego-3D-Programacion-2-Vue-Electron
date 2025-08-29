import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

console.log('isDev:', isDev)
console.log('NODE_ENV:', process.env.NODE_ENV)

function createWindow() {
    // Create the browser window
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: false // Solo para desarrollo, permitir carga de recursos locales
        },
        titleBarStyle: 'default',
        resizable: true,
        show: false
    })

    mainWindow.maximize()

    // Cargar la aplicación
    if (isDev) {
        const devUrl = 'http://localhost:5173'
        console.log('Loading dev URL:', devUrl)
        mainWindow.loadURL(devUrl)
        mainWindow.webContents.openDevTools()

        // Handle load failures in development
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error('Failed to load:', errorDescription, 'URL:', validatedURL)
            console.log('Make sure the Vite dev server is running on http://localhost:5173')
        })
    } else {
        const indexPath = join(__dirname, '../dist/index.html')
        console.log('Loading production file:', indexPath)
        mainWindow.loadFile(indexPath)
    }

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.on('closed', () => {
        app.quit()
    })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})