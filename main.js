const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http'); // Use built-in HTTP module instead of fetch
const path = require('path');
const fs = require('fs');

require('dotenv').config();

let mainWindow;
let streamlitProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

if (process.platform === 'darwin') {
  // Ensure we're in the right directory for macOS app bundles
  if (app.isPackaged) {
    process.chdir(path.dirname(process.execPath));
  }
}

// Add crash reporting
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process gone:', details);
});

app.disableHardwareAcceleration(); // Sometimes helps with crashes
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    },
    show: false,
    // Add these to prevent restoration issues
    titleBarStyle: 'default',
    restorable: false // Disable window restoration
  });

  // Show loading screen immediately
  showLoadingScreen();
  
  // Start Streamlit in background
  startStreamlit();

  // Try to connect to Streamlit every 2 seconds
  const maxAttempts = 30; // 60 seconds total
  let attempts = 0;
  
  const checkStreamlit = setInterval(() => {
    attempts++;
    
    // Use built-in http module instead of fetch
    const req = http.request({
      hostname: 'localhost',
      port: 8501,
      path: '/',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      if (res.statusCode === 200) {
        // Streamlit is ready!
        clearInterval(checkStreamlit);
        mainWindow.loadURL('http://localhost:8501');
        console.log(`Streamlit ready after ${attempts * 2} seconds`);
      }
    });

    req.on('error', (error) => {
      // Streamlit not ready yet
      console.log(`Attempt ${attempts}: Streamlit not ready yet...`);
      
      if (attempts >= maxAttempts) {
        clearInterval(checkStreamlit);
        showErrorScreen();
      }
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`Attempt ${attempts}: Request timed out`);
      
      if (attempts >= maxAttempts) {
        clearInterval(checkStreamlit);
        showErrorScreen();
      }
    });

    req.end();
  }, 2000); // Check every 2 seconds

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (streamlitProcess) {
      streamlitProcess.kill();
    }
  });
}

// Keep all your existing showLoadingScreen, showErrorScreen, and startStreamlit functions exactly the same
function showLoadingScreen() {
  const loadingHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Lumina - Loading</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background: linear-gradient(135deg, #3C4C80 0%, #D0A98B 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          text-align: center;
        }
        
        .loading-container {
          max-width: 400px;
          padding: 40px;
        }
        
        .logo {
          font-size: 48px;
          margin-bottom: 20px;
        }
        
        .title {
          font-size: 28px;
          font-weight: 300;
          margin-bottom: 10px;
        }
        
        .subtitle {
          font-size: 16px;
          opacity: 0.8;
          margin-bottom: 40px;
        }
        
        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 3px solid white;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-text {
          font-size: 14px;
          opacity: 0.9;
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.5; }
        }
      </style>
    </head>
    <body>
      <div class="loading-container">
        <div class="logo">🍀</div>
        <div class="title">Lumina</div>
        <div class="subtitle">Health & Nutrition Tracker</div>
        <div class="spinner"></div>
        <div class="loading-text">
          Starting application...
        </div>
      </div>
      
      <script>
        let loadingMessages = [
          'Starting application...',
          'Loading Python environment...',
          'Initializing Streamlit...',
          'Preparing your dashboard...',
          'Almost ready...'
        ];
        
        let messageIndex = 0;
        const loadingText = document.querySelector('.loading-text');
        
        setInterval(() => {
          messageIndex = (messageIndex + 1) % loadingMessages.length;
          loadingText.textContent = loadingMessages[messageIndex];
        }, 3000);
      </script>
    </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html,${encodeURIComponent(loadingHtml)}`);
  mainWindow.show();
}

// Keep your existing showErrorScreen and startStreamlit functions unchanged
function showErrorScreen() {
  const errorHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Lumina - Error</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          text-align: center;
        }
        
        .error-container {
          max-width: 400px;
          padding: 40px;
        }
        
        .error-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        
        .title {
          font-size: 24px;
          font-weight: 300;
          margin-bottom: 20px;
        }
        
        .message {
          font-size: 14px;
          opacity: 0.9;
          line-height: 1.5;
        }
        
        .retry-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 10px 20px;
          border-radius: 6px;
          margin-top: 20px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="title">Failed to Start</div>
        <div class="message">
          The application failed to start properly.<br>
          Please check that Python and Streamlit are installed.
        </div>
        <button class="retry-btn" onclick="window.location.reload()">
          Retry
        </button>
      </div>
    </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
}

function startStreamlit() {
  // Determine paths
  let streamlitAppPath;
  let dataDir;

  if (isDev) {
    streamlitAppPath = path.join(__dirname, 'streamlit_app', 'lumina_app.py');
    dataDir = path.join(__dirname, 'streamlit_app', 'data');
  } else {
    // In production, try multiple possible locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'streamlit_app', 'lumina_app.py'),
      path.join(app.getAppPath(), 'streamlit_app', 'lumina_app.py'),
      path.join(__dirname, 'streamlit_app', 'lumina_app.py')
    ];

    streamlitAppPath = possiblePaths.find(p => fs.existsSync(p));
    
    if (streamlitAppPath) {
      dataDir = path.join(path.dirname(streamlitAppPath), 'data');
    }
  }

  console.log('Streamlit app path:', streamlitAppPath);
  console.log('Data directory:', dataDir);
  console.log('Streamlit app exists:', fs.existsSync(streamlitAppPath || ''));

  if (!streamlitAppPath || !fs.existsSync(streamlitAppPath)) {
    console.error('ERROR: Cannot find streamlit app at any expected location');
    console.error('Tried paths:', isDev ? [path.join(__dirname, 'streamlit_app', 'lumina_app.py')] : [
      path.join(process.resourcesPath, 'streamlit_app', 'lumina_app.py'),
      path.join(app.getAppPath(), 'streamlit_app', 'lumina_app.py'),
      path.join(__dirname, 'streamlit_app', 'lumina_app.py')
    ]);
    return;
  }

  // Create data directory
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Created data directory:', dataDir);
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  // Check Python availability
  const pythonCommands = ['python3', 'python'];
  let pythonCmd = null;

  for (const cmd of pythonCommands) {
    try {
      const { execSync } = require('child_process');
      execSync(`${cmd} --version`, { stdio: 'pipe' });
      pythonCmd = cmd;
      console.log(`Found Python: ${cmd}`);
      break;
    } catch (error) {
      console.log(`${cmd} not available`);
    }
  }

  if (!pythonCmd) {
    console.error('ERROR: No Python installation found');
    return;
  }

  // Environment setup
  const env = {
    ...process.env,
    STREAMLIT_APP_DIR: path.dirname(streamlitAppPath),
    STREAMLIT_DATA_DIR: dataDir,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY
  };

  console.log('Starting Streamlit with:', pythonCmd);
  console.log('Working directory:', path.dirname(streamlitAppPath));

  // Start Streamlit
  streamlitProcess = spawn(pythonCmd, [
    '-m', 'streamlit', 'run',
    streamlitAppPath,
    '--server.port=8501',
    '--server.headless=true',
    '--server.address=localhost',
    '--browser.gatherUsageStats=false'
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.dirname(streamlitAppPath),
    env: env
  });

  streamlitProcess.stdout.on('data', (data) => {
    console.log('Streamlit stdout:', data.toString());
  });

  streamlitProcess.stderr.on('data', (data) => {
    console.error('Streamlit stderr:', data.toString());
  });

  streamlitProcess.on('close', (code) => {
    console.log(`Streamlit process exited with code ${code}`);
  });

  streamlitProcess.on('error', (error) => {
    console.error('Failed to start Streamlit:', error);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (streamlitProcess) {
    streamlitProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});