const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

let mainWindow;
let streamlitProcess;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// CRITICAL: Disable automatic state restoration
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--allow-running-insecure-content');

// Disable window state restoration completely
app.disableHardwareAcceleration();

// Get proper resource paths
function getResourcePath() {
  if (isDev) {
    return __dirname;
  } else {
    // In packaged apps, files are directly in process.resourcesPath
    // which should be Contents/Resources/
    console.log('process.resourcesPath:', process.resourcesPath);
    return process.resourcesPath;
  }
}

function getStreamlitAppPath() {
  const resourcePath = getResourcePath();
  const streamlitPath = path.join(resourcePath, 'streamlit_app');
  
  console.log('Looking for Streamlit app at:', streamlitPath);
  console.log('Path exists:', fs.existsSync(streamlitPath));
  
  if (fs.existsSync(streamlitPath)) {
    return streamlitPath;
  }
  
  // List all available directories to help debug
  console.log('Available directories in resourcesPath:', resourcePath);
  try {
    const contents = fs.readdirSync(resourcePath);
    console.log('Contents:', contents);
    
    // Check specifically for streamlit_app in the contents
    if (contents.includes('streamlit_app')) {
      console.log('streamlit_app found in directory listing but path check failed');
      console.log('This might be a permissions issue');
    }
  } catch (e) {
    console.log('Could not read resourcesPath:', e.message);
  }
  
  throw new Error(`Streamlit app directory not found at: ${streamlitPath}`);
}

// Add crash reporting
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process gone:', details);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      webSecurity: false  // Allow local connections
    },
    show: false,
    titleBarStyle: 'default',
    restorable: false,
    enableRemoteModule: false,
    autoHideMenuBar: true,
    skipTaskbar: false
  });

  // Note: setRestorable doesn't exist in Electron, using other methods to prevent restoration
  
  // Show loading screen immediately
  showLoadingScreen();
  
  // Start Streamlit in background
  startStreamlit();

  // Try to connect to Streamlit every 2 seconds
  const maxAttempts = 30;
  let attempts = 0;
  
  const checkStreamlit = setInterval(() => {
    attempts++;
    console.log(`Connection attempt ${attempts}...`);
    
    const req = http.request({
      hostname: 'localhost',
      port: 8501,
      path: '/',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      console.log('HTTP Response status:', res.statusCode);
      if (res.statusCode === 200) {
        clearInterval(checkStreamlit);
        console.log(`Streamlit ready after ${attempts * 2} seconds`);
        mainWindow.loadURL('http://localhost:8501');
        mainWindow.show(); // Show window when ready
      }
    });

    req.on('error', (error) => {
      console.log(`Attempt ${attempts}: Streamlit not ready - ${error.message}`);
      
      if (attempts >= maxAttempts) {
        clearInterval(checkStreamlit);
        console.error('Failed to connect to Streamlit after maximum attempts');
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
  }, 2000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (streamlitProcess) {
      console.log('Killing Streamlit process...');
      streamlitProcess.kill('SIGTERM');
      setTimeout(() => {
        if (streamlitProcess && !streamlitProcess.killed) {
          streamlitProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  });

  // Note: Using window events instead of setRestorable (which doesn't exist)
}

function showLoadingScreen() {
  const loadingHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Loading Lumina...</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                color: white;
            }
            .container {
                text-align: center;
            }
            .spinner {
                border: 4px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top: 4px solid white;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            h1 { margin: 0 0 10px 0; }
            p { margin: 5px 0; opacity: 0.8; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="spinner"></div>
            <h1>Loading Lumina</h1>
            <p>Starting Streamlit application...</p>
            <p>This may take a moment</p>
        </div>
    </body>
    </html>
  `;
  
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHTML)}`);
  mainWindow.show();
}

function showErrorScreen() {
  const errorHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Lumina - Error</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: #f5f5f5;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                max-width: 500px;
            }
            .error-icon {
                font-size: 48px;
                color: #e74c3c;
                margin-bottom: 20px;
            }
            h1 { color: #2c3e50; margin: 0 0 20px 0; }
            p { color: #7f8c8d; margin: 10px 0; }
            .troubleshooting {
                text-align: left;
                margin-top: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 5px;
            }
            ul { padding-left: 20px; }
            li { margin: 5px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="error-icon">⚠️</div>
            <h1>Failed to Start Lumina</h1>
            <p>The Streamlit application could not be started.</p>
            
            <div class="troubleshooting">
                <h3>Troubleshooting Steps:</h3>
                <ul>
                    <li>Ensure Python is installed and accessible</li>
                    <li>Check that all required Python packages are installed</li>
                    <li>Verify the streamlit_app directory exists</li>
                    <li>Try running the app manually: <code>streamlit run streamlit_app/lumina_app.py</code></li>
                    <li>Check the console for detailed error messages</li>
                </ul>
            </div>
        </div>
    </body>
    </html>
  `;
  
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`);
  mainWindow.show();
}

function startStreamlit() {
  try {
    const streamlitAppPath = getStreamlitAppPath();
    const mainPyPath = path.join(streamlitAppPath, 'lumina_app.py');
    
    console.log('='.repeat(50));
    console.log('STREAMLIT STARTUP DEBUG INFO');
    console.log('='.repeat(50));
    console.log('Starting Streamlit from:', mainPyPath);
    console.log('Working directory:', streamlitAppPath);
    console.log('isDev:', isDev);
    console.log('app.isPackaged:', app.isPackaged);
    console.log('process.resourcesPath:', process.resourcesPath);
    console.log('__dirname:', __dirname);
    console.log('process.cwd():', process.cwd());
    
    if (!fs.existsSync(mainPyPath)) {
      throw new Error(`Streamlit main file not found: ${mainPyPath}`);
    }
    
    // Check if data directory exists
    const dataDir = path.join(streamlitAppPath, 'data');
    console.log('Data directory exists:', fs.existsSync(dataDir));
    if (fs.existsSync(dataDir)) {
      const dataFiles = fs.readdirSync(dataDir);
      console.log('Data files:', dataFiles);
    }

    // Try different Python commands with full paths for packaged apps
    const pythonCommands = isDev ? 
      ['python', 'python3', 'py'] : 
      ['/opt/anaconda3/bin/python', '/opt/anaconda3/bin/python3', 'python', 'python3', 'py'];
    
    let pythonCmd = null;
    
    // Test which Python command works
    for (const cmd of pythonCommands) {
      try {
        console.log(`Testing Python command: ${cmd}`);
        require('child_process').execSync(`${cmd} --version`, { 
          stdio: 'ignore',
          timeout: 5000
        });
        pythonCmd = cmd;
        console.log(`✓ Using Python command: ${pythonCmd}`);
        break;
      } catch (e) {
        console.log(`✗ Failed to use ${cmd}: ${e.message}`);
        continue;
      }
    }
    
    if (!pythonCmd) {
      throw new Error('No working Python command found. Tried: ' + pythonCommands.join(', '));
    }
    
    // Test if Streamlit module is accessible
    try {
      console.log('Testing Streamlit module access...');
      require('child_process').execSync(`${pythonCmd} -m streamlit --version`, { 
        stdio: 'pipe',
        timeout: 10000
      });
      console.log('✓ Streamlit module is accessible');
    } catch (e) {
      console.error('✗ Streamlit module test failed:', e.message);
      throw new Error('Streamlit module is not accessible: ' + e.message);
    }

    // Set environment variables for the Streamlit process
    const env = Object.assign({}, process.env, {
      PYTHONPATH: streamlitAppPath,
      STREAMLIT_SERVER_PORT: '8501',
      STREAMLIT_SERVER_ADDRESS: 'localhost',
      STREAMLIT_SERVER_HEADLESS: 'true',
      STREAMLIT_BROWSER_GATHER_USAGE_STATS: 'false',
      // Add Anaconda path to ensure Python packages are found
      PATH: `/opt/anaconda3/bin:${process.env.PATH}`
    });

    console.log('Environment variables for Streamlit:');
    console.log('PYTHONPATH:', env.PYTHONPATH);
    console.log('PATH:', env.PATH.substring(0, 100) + '...');

    const streamlitArgs = [
      '-m', 'streamlit', 'run', 
      mainPyPath,
      '--server.port=8501',
      '--server.address=localhost',
      '--server.headless=true',
      '--browser.gatherUsageStats=false',
      '--server.enableCORS=false',
      '--server.enableXsrfProtection=false'
    ];
    
    console.log('Streamlit command:', pythonCmd, streamlitArgs.join(' '));
    console.log('='.repeat(50));

    streamlitProcess = spawn(pythonCmd, streamlitArgs, {
      cwd: streamlitAppPath,
      env: env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    streamlitProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Streamlit stdout:', output);
    });

    streamlitProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('Streamlit stderr:', output);
    });

    streamlitProcess.on('error', (error) => {
      console.error('Failed to start Streamlit process:', error);
      setTimeout(() => showErrorScreen(), 1000);
    });

    streamlitProcess.on('close', (code, signal) => {
      console.log(`Streamlit process exited with code ${code}, signal ${signal}`);
      if (code !== 0 && code !== null) {
        console.error('Streamlit process failed with exit code:', code);
        setTimeout(() => showErrorScreen(), 1000);
      }
    });

    console.log('Streamlit process started with PID:', streamlitProcess.pid);
    
  } catch (error) {
    console.error('Error starting Streamlit:', error);
    console.error('Error stack:', error.stack);
    setTimeout(() => showErrorScreen(), 1000);
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.lumina.healthtracker');
  console.log('App is ready, creating window...');
  console.log('Is development mode:', isDev);
  console.log('App is packaged:', app.isPackaged);
  console.log('Resource path:', getResourcePath());
  createWindow();
});

app.on('window-all-closed', () => {
  if (streamlitProcess) {
    console.log('Cleaning up Streamlit process...');
    streamlitProcess.kill('SIGTERM');
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

app.on('before-quit', () => {
  // Clean up processes before quitting
  if (streamlitProcess) {
    streamlitProcess.kill('SIGTERM');
  }
});