const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
let streamlitProcess;

// Check if we're in development or production
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false
  });

  // Start Streamlit server
  startStreamlit();

  // Load the Streamlit app
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:8501');
    mainWindow.show();
  }, 5000); // Increased wait time for Streamlit to start

  // Handle external links
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

function startStreamlit() {
  // Get the path to the streamlit app
  const streamlitApp = path.join(__dirname, 'streamlit_app', 'lumina_app.py');
  
  // Ensure the data directory exists
  const dataDir = path.join(__dirname, 'streamlit_app', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
  }

  // Create empty CSV files if they don't exist
  const csvFiles = [
    'updated-database-results.csv',
    'livsmedelsdatabas.csv', 
    'recipie_databas.csv',
    'meal_databas.csv'
  ];

  csvFiles.forEach(filename => {
    const filepath = path.join(dataDir, filename);
    if (!fs.existsSync(filepath)) {
      // Create basic CSV headers based on the file type
      let headers = '';
      if (filename === 'updated-database-results.csv') {
        headers = 'date,time,label,activity,distance,energy,pro,carb,fat,note,energy_acc,protein_acc,duration,pace,steps\n';
      } else if (filename === 'livsmedelsdatabas.csv') {
        headers = 'livsmedel,calorie,protein,carb,fat\n';
      } else if (filename === 'recipie_databas.csv' || filename === 'meal_databas.csv') {
        headers = 'name,livsmedel,amount,code,favorite\n';
      }
      
      fs.writeFileSync(filepath, headers);
      console.log('Created CSV file:', filepath);
    }
  });

  console.log('Starting Streamlit from:', streamlitApp);
  console.log('Data directory:', dataDir);
  
  // Set environment variables for the Streamlit process
  const env = {
    ...process.env,
    STREAMLIT_APP_DIR: path.join(__dirname, 'streamlit_app'),
    STREAMLIT_DATA_DIR: dataDir,
    SUPABASE_URL: 'https://eqyrpsmcujrbmskpwnlz.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxeXJwc21jdWpyYm1za3B3bmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MDk5NjQsImV4cCI6MjA3MjI4NTk2NH0.mf8n__NtBiJj9ZKOQrkFX8HWP4ZvgFyBdNgPIKtydoI'
  };
  
  // Start Streamlit with proper working directory
  streamlitProcess = spawn('streamlit', [
    'run', 
    streamlitApp, 
    '--server.port=8501', 
    '--server.headless=true',
    '--server.address=localhost',
    '--browser.gatherUsageStats=false'
  ], {
    stdio: 'inherit',
    cwd: path.join(__dirname, 'streamlit_app'), // Set working directory to streamlit_app
    env: env
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

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}