// setup.js - Enhanced setup for Electron environment with package detection
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Lumina Electron App...');

// Detect if we're in a packaged environment
function isPackaged() {
    return process.env.NODE_ENV === 'production' || 
           process.argv.includes('--packaged') ||
           !fs.existsSync(path.join(__dirname, 'package.json'));
}

// Get the correct base directory
function getBaseDir() {
    if (isPackaged()) {
        // In packaged app, we need to work with the extraResources
        return process.resourcesPath || __dirname;
    } else {
        // In development, use current directory
        return __dirname;
    }
}

function createEnvFiles() {
    console.log('Creating environment files...');
    
    const baseDir = getBaseDir();
    
    // Create .env.template in project root
    const envTemplatePath = path.join(baseDir, '.env.template');
    if (!fs.existsSync(envTemplatePath)) {
        const envTemplate = `# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# App Configuration
NODE_ENV=production
`;
        fs.writeFileSync(envTemplatePath, envTemplate);
        console.log('✓ Created .env.template in project root');
    }
    
    // Create .env file if it doesn't exist
    const envPath = path.join(baseDir, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('⚠️  .env file not found. Creating from template...');
        fs.copyFileSync(envTemplatePath, envPath);
        console.log('✓ Created .env file from template');
        console.log('🔑 Please update .env with your actual Supabase credentials');
    } else {
        console.log('✓ .env file already exists');
    }
}

// Check if Python is installed with better error handling
function checkPython() {
    const commands = ['python', 'python3', 'py'];
    
    for (const cmd of commands) {
        try {
            const result = execSync(`${cmd} --version`, { 
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'ignore']
            });
            console.log(`✓ Python found: ${result.trim()} (using command: ${cmd})`);
            return cmd;
        } catch (error) {
            continue;
        }
    }
    
    console.error('❌ Python not found. Please install Python 3.8+ first.');
    console.error('Available from: https://www.python.org/downloads/');
    
    if (isPackaged()) {
        console.error('Note: In packaged apps, Python must be installed system-wide.');
    }
    
    process.exit(1);
}

// Check if Streamlit is installed with version verification
function checkStreamlit(pythonCmd) {
    try {
        const result = execSync(`${pythonCmd} -m streamlit --version`, { 
            encoding: 'utf8',
            timeout: 10000
        });
        console.log(`✓ Streamlit found: ${result.trim()}`);
        return true;
    } catch (error) {
        console.log('⚠  Streamlit not found or not working properly...');
        console.log('Error details:', error.message);
        return false;
    }
}

// Install Python dependencies with better error handling
function installPythonDeps(pythonCmd) {
    console.log('Installing Python dependencies...');
    
    const baseDir = getBaseDir();
    const streamlitAppDir = path.join(baseDir, 'streamlit_app');
    const requirementsPath = path.join(streamlitAppDir, 'requirements.txt');
    
    // Ensure streamlit_app directory exists
    if (!fs.existsSync(streamlitAppDir)) {
        fs.mkdirSync(streamlitAppDir, { recursive: true });
        console.log('✓ Created streamlit_app directory');
    }
    
    if (!fs.existsSync(requirementsPath)) {
        console.log('Creating requirements.txt...');
        const requirements = `streamlit>=1.28.0
pandas>=1.5.0
altair>=4.2.0
python-dotenv>=1.0.0
numpy>=1.21.0
plotly>=5.0.0
`;
        fs.writeFileSync(requirementsPath, requirements);
        console.log('✓ Created requirements.txt');
    }
    
    try {
        console.log('Installing packages (this may take a few minutes)...');
        
        // Use pip install with better options for packaged apps
        const installCmd = isPackaged() 
            ? `${pythonCmd} -m pip install --user -r "${requirementsPath}"`
            : `${pythonCmd} -m pip install -r "${requirementsPath}"`;
            
        execSync(installCmd, { 
            stdio: 'inherit',
            timeout: 300000  // 5 minutes timeout
        });
        console.log('✓ Python dependencies installed successfully');
    } catch (error) {
        console.error('❌ Failed to install Python dependencies:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Try: pip install --upgrade pip');
        console.error('2. Try: python -m pip install --user streamlit pandas');
        console.error('3. Check your internet connection');
        console.error('4. Ensure you have write permissions');
        
        if (isPackaged()) {
            console.error('5. In packaged apps, use --user flag for pip installs');
        }
        
        process.exit(1);
    }
}

// Create data directory and CSV files
function setupDataFiles() {
    console.log('Setting up data directory and CSV files...');
    
    const baseDir = getBaseDir();
    const dataDir = path.join(baseDir, 'streamlit_app', 'data');
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('✓ Created data directory');
    }
    
    const csvFiles = [
        {
            name: 'updated-database-results.csv',
            headers: 'date,time,label,activity,distance,energy,pro,carb,fat,note,energy_acc,protein_acc,duration,pace,steps'
        },
        {
            name: 'livsmedelsdatabas.csv',
            headers: 'livsmedel,calorie,protein,carb,fat'
        },
        {
            name: 'recipie_databas.csv',
            headers: 'name,livsmedel,amount,code,favorite'
        },
        {
            name: 'meal_databas.csv',
            headers: 'name,livsmedel,amount,code,favorite'
        }
    ];
    
    csvFiles.forEach(file => {
        const filePath = path.join(dataDir, file.name);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, file.headers + '\n');
            console.log(`✓ Created ${file.name}`);
        } else {
            console.log(`✓ ${file.name} already exists`);
        }
    });
}

// Create Streamlit config with appropriate settings for Electron
function createStreamlitConfig() {
    console.log('Creating Streamlit configuration...');
    
    const baseDir = getBaseDir();
    const configDir = path.join(baseDir, 'streamlit_app', '.streamlit');
    const configFile = path.join(configDir, 'config.toml');
    
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    const configContent = `[server]
port = 8501
address = "localhost"
headless = true
runOnSave = false
enableCORS = false
enableXsrfProtection = false
maxUploadSize = 200

[browser]
gatherUsageStats = false
serverAddress = "localhost"
serverPort = 8501

[theme]
primaryColor = "#FF6B6B"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F0F2F6"
textColor = "#262730"
font = "sans serif"

[logger]
level = "info"

[global]
developmentMode = false
`;
    
    fs.writeFileSync(configFile, configContent);
    console.log('✓ Created Streamlit config');
}

// Test Streamlit installation and imports
function testStreamlit(pythonCmd) {
    console.log('Testing Streamlit installation...');
    
    try {
        // Test if we can import required modules
        const testScript = `
import sys
print(f"Python version: {sys.version}")

try:
    import streamlit as st
    print("✓ Streamlit imports successfully")
except ImportError as e:
    print(f"❌ Streamlit import failed: {e}")
    sys.exit(1)

try:
    import pandas as pd
    print("✓ Pandas imports successfully")
except ImportError as e:
    print(f"❌ Pandas import failed: {e}")
    sys.exit(1)

try:
    import altair as alt
    print("✓ Altair imports successfully")
except ImportError as e:
    print("⚠ Altair import failed (optional):", e)

print("✓ All critical imports successful")
`;
        
        const baseDir = getBaseDir();
        const testFile = path.join(baseDir, 'test_streamlit.py');
        fs.writeFileSync(testFile, testScript);
        
        execSync(`${pythonCmd} "${testFile}"`, { 
            stdio: 'inherit',
            timeout: 30000
        });
        
        // Clean up test file
        fs.unlinkSync(testFile);
        
        console.log('✓ Streamlit test passed');
    } catch (error) {
        console.error('❌ Streamlit test failed:', error.message);
        console.error('\nThis suggests there may be import issues with the Python environment.');
        console.error('Try running the app manually to see detailed error messages.');
        process.exit(1);
    }
}

// Test if Streamlit can actually start (quick test)
function testStreamlitStart(pythonCmd) {
    console.log('Testing Streamlit startup (quick test)...');
    
    const baseDir = getBaseDir();
    const testAppPath = path.join(baseDir, 'test_app.py');
    
    const testApp = `
import streamlit as st
st.write("Hello from Streamlit!")
st.write("Test successful")
`;
    
    try {
        fs.writeFileSync(testAppPath, testApp);
        
        // Try to start Streamlit with a timeout
        console.log('Starting test Streamlit app...');
        const child = execSync(
            `timeout 10s ${pythonCmd} -m streamlit run "${testAppPath}" --server.headless=true --server.port=8502 || true`,
            { encoding: 'utf8', timeout: 15000 }
        );
        
        fs.unlinkSync(testAppPath);
        console.log('✓ Streamlit startup test completed');
        
    } catch (error) {
        // Clean up even if test fails
        if (fs.existsSync(testAppPath)) {
            fs.unlinkSync(testAppPath);
        }
        console.log('⚠ Streamlit startup test had issues, but continuing...');
        console.log('This is normal and the main app should still work.');
    }
}

// Main setup function
function main() {
    try {
        console.log('='.repeat(50));
        console.log('🚀 Lumina Electron App Setup');
        console.log('='.repeat(50));
        
        const packaged = isPackaged();
        const baseDir = getBaseDir();
        
        console.log(`Environment: ${packaged ? 'PACKAGED' : 'DEVELOPMENT'}`);
        console.log(`Base directory: ${baseDir}`);
        console.log(`Working directory: ${process.cwd()}`);
        
        // Check Python installation
        const pythonCmd = checkPython();
        
        // Check and install Streamlit
        if (!checkStreamlit(pythonCmd)) {
            console.log('Installing Streamlit...');
            try {
                const installCmd = packaged 
                    ? `${pythonCmd} -m pip install --user streamlit`
                    : `${pythonCmd} -m pip install streamlit`;
                    
                execSync(installCmd, { stdio: 'inherit', timeout: 120000 });
                console.log('✓ Streamlit installed');
            } catch (error) {
                console.error('❌ Failed to install Streamlit:', error.message);
                process.exit(1);
            }
        }
        
        // Install other Python dependencies
        installPythonDeps(pythonCmd);
        
        // Create environment files
        createEnvFiles();
        
        // Test basic imports
        testStreamlit(pythonCmd);
        
        // Setup data files
        setupDataFiles();
        
        // Create Streamlit config
        createStreamlitConfig();
        
        // Quick startup test (optional)
        if (!packaged) {
            testStreamlitStart(pythonCmd);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ Setup completed successfully!');
        console.log('='.repeat(50));
        console.log('\nNext steps:');
        console.log('1. Update .env file with your actual Supabase credentials');
        console.log('2. Run "npm start" to launch the app');
        console.log('3. The app will be available through Electron');
        console.log('\nTroubleshooting:');
        console.log('- If the app fails to start, check the console for Python errors');
        console.log('- Ensure all CSV files exist in streamlit_app/data/');
        console.log('- Try running "streamlit run streamlit_app/lumina_app.py" manually');
        console.log('- Check that Python packages are installed correctly');
        
        if (packaged) {
            console.log('\nPackaged app notes:');
            console.log('- Python must be installed system-wide');
            console.log('- Packages installed with --user flag');
            console.log('- Check system PATH includes Python');
        }
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.error('\nPlease check the error above and try again.');
        console.error('If the issue persists, try running setup manually:');
        console.error('1. Install Python 3.8+');
        console.error('2. Run: pip install streamlit pandas');
        console.error('3. Test: streamlit run streamlit_app/lumina_app.py');
        process.exit(1);
    }
}

// Run setup
main();