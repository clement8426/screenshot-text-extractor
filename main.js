const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Tesseract = require('tesseract.js');
const screenshot = require('screenshot-desktop');
const { nativeImage, clipboard } = require('electron');

let mainWindow;
let captureWindow;
let history = [];

// Crée la fenêtre principale
async function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile('index.html');
}

// Fonction pour créer la fenêtre de capture en plein écran
async function createCaptureWindow(imageDataUrl) {
    const { width, height, scaleFactor } = screen.getPrimaryDisplay().size; // Dimensions réelles de l'écran avec le facteur d'échelle

    captureWindow = new BrowserWindow({
        width,
        height,
        frame: false,
        alwaysOnTop: true,
        fullscreen: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    captureWindow.loadFile(path.join(__dirname, 'capture.html'));
    captureWindow.webContents.once('did-finish-load', () => {
        captureWindow.webContents.send('load-image', imageDataUrl);
    });

    captureWindow.on('closed', () => {
        captureWindow = null;
    });
}

// Prend une capture d'écran complète et ouvre la fenêtre de sélection
ipcMain.on('start-screen-capture', async () => {
    const imgBuffer = await screenshot({ format: 'png' });
    const imageDataUrl = nativeImage.createFromBuffer(imgBuffer).toDataURL();
    createCaptureWindow(imageDataUrl);
});

// Recevoir les coordonnées de la sélection et traiter l'image
ipcMain.on('capture-selected-area', async (event, { x, y, width, height }) => {
    const display = screen.getPrimaryDisplay();
    const scaleFactor = display.scaleFactor || 1; // Facteur d'échelle (DPI) de l'écran

    const { width: screenWidth, height: screenHeight } = display.size;
    const { width: windowWidth, height: windowHeight } = captureWindow.getBounds();

    // Ajustement des coordonnées avec le facteur d'échelle DPI
    const adjustedX = Math.round((x / windowWidth) * screenWidth * scaleFactor);
    const adjustedY = Math.round((y / windowHeight) * screenHeight * scaleFactor);
    const adjustedWidth = Math.round((width / windowWidth) * screenWidth * scaleFactor);
    const adjustedHeight = Math.round((height / windowHeight) * screenHeight * scaleFactor);

    captureWindow.close();

    // Capture la zone ajustée de l'écran
    const imgBuffer = await screenshot({ format: 'png' });
    const image = nativeImage.createFromBuffer(imgBuffer);
    const croppedImage = image.crop({
        x: adjustedX,
        y: adjustedY,
        width: adjustedWidth,
        height: adjustedHeight,
    });

    processImage(croppedImage);
});

// Traite l'image capturée avec Tesseract et copie le texte
function processImage(image) {
    Tesseract.recognize(image.toPNG(), 'eng')
        .then(({ data: { text } }) => {
            clipboard.writeText(text);
            history.push({ text, image: image.toDataURL() });
            mainWindow.webContents.send('new-entry', { text, image: image.toDataURL() });
        })
        .catch(err => console.error("Erreur OCR :", err));
}

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
