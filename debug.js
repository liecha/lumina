// debug.js - Comprehensive debugging script for Lumina Electron App
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('='.repeat(60));
console.log('🔍 Lumina Electron App Debug Tool');
console.log('='.repeat(60));

// Environment detection
const isDev = process.env.NODE_ENV === 'development' || !process.pkg;
const isPackaged = process.pkg || process.argv.includes('--packaged');

console.log('\n📋 ENVIRONMENT INFORMATION');
console.log('-'.repeat(30));
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Current working directory:', process.cwd());
console.log('Script directory:', __dirname);
console.log('Is development:', isDev);
console.log('Is packaged:', isPackaged);
console.log('Process arguments:', process.argv.slice(2));

if (process.env.npm_package_name) {
    console.log('NPM package name:', process.env.npm_package_name);
}

// Path analysis
console.log('\n📁 PATH ANALYSIS');
console.log('-'.repeat(30));

const possiblePaths = [
    __dirname,
    process.cwd(),
    path.dirname(process.execPath),
    process.resourcesPath,
    path.join(process.resourcesPath || '', 'app.asar.unpacked'),
    path.join(process.resourcesPath || '', 'extraResources')
];

possiblePaths.forEach((testPath, index) => {
    if (testPath) {
        const exists = fs.existsSync(testPath);
        console.log(`Path ${index + 1}: ${testPath} - ${exists ? '✓ EXISTS' : '❌ NOT FOUND'}`);
        
        if (exists) {
            try {
                const contents = fs.readdirSync(testPath);
                const hasStreamlitApp = contents.includes('streamlit_app');
                const hasMainJs = contents.includes('main.js');
                const hasPackageJson = contents.includes('package.json');
                
                console.log(`   Contents: ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''}`);
                console.log(`   Has streamlit_app: ${hasStreamlitApp ? '✓' : '❌'}`);
                console.log(`   Has main.js: ${hasMainJs ? '✓' : '❌'}`);
                console.log(`   Has package.json: ${hasPackageJson ? '✓' : '❌'}`);
            } catch (error) {
                console.log(`   Error reading directory: ${error.message}`);
            }
        }
    }
});

// Streamlit app analysis
console.log('\n🐍 STREAMLIT APP ANALYSIS');
console.log('-'.repeat(30));

const streamlitPaths = [
    path.join(__dirname, 'streamlit_app'),
    path.join(process.cwd(), 'streamlit_app'),
    path.join(process.resourcesPath || '', 'streamlit_app'),
    path.join(process.resourcesPath || '', 'extraResources', 'streamlit_app')
];

let streamlitAppPath = null;

streamlitPaths.forEach((testPath, index) => {
    if (testPath && fs.existsSync(testPath)) {
        console.log(`Streamlit path ${index + 1}: ${testPath} - ✓ FOUND`);
        
        if (!streamlitAppPath) {
            streamlitAppPath = testPath;
        }
        
        try {
            const contents = fs.readdirSync(testPath);
            const hasMainPy = contents.includes('lumina_app.py');
            const hasDataDir = contents.includes('data');
            const hasConfigDir = contents.includes('.streamlit');
            
            console.log(`   Contents: ${contents.join(', ')}`);
            console.log(`   Has lumina_app.py: ${hasMainPy ? '✓' : '❌'}`);
            console.log(`   Has data directory: ${hasDataDir ? '✓' : '❌'}`);
            console.log(`   Has .streamlit config: ${hasConfigDir ? '✓' : '❌'}`);
            
            if (hasDataDir) {
                const dataPath = path.join(testPath, 'data');
                const dataContents = fs.readdirSync(dataPath);
                console.log(`   Data files: ${dataContents.join(', ')}`);
            }
        } catch (error) {
            console.log(`   Error reading streamlit directory: ${error.message}`);
        }
    } else {
        console.log(`Streamlit path ${index + 1}: ${testPath} - ❌ NOT FOUND`);
    }
});

// Python environment check
console.log('\n🐍 PYTHON ENVIRONMENT CHECK');
console.log('-'.repeat(30));

const pythonCommands = ['python', 'python3', 'py'];
let workingPython = null;

pythonCommands.forEach(cmd => {
    try {
        const version = execSync(`${cmd} --version`, { 
            encoding: 'utf8', 
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        console.log(`${cmd}: ✓ ${version}`);
        
        if (!workingPython) {
            workingPython = cmd;
        }
        
        // Check Python path
        try {
            const pythonPath = execSync(`${cmd} -c "import sys; print(sys.executable)"`, { 
                encoding: 'utf8', 
                timeout: 5000 
            }).trim();
            console.log(`   Executable: ${pythonPath}`);
        } catch (e) {
            console.log(`   Could not get executable path: ${e.message}`);
        }
        
    } catch (error) {
        console.log(`${cmd}: ❌ Not available`);
    }
});

if (workingPython) {
    console.log(`\nUsing Python command: ${workingPython}`);
    
    // Check required packages
    const requiredPackages = ['streamlit', 'pandas', 'altair'];
    
    console.log('\n📦 PYTHON PACKAGES CHECK');
    console.log('-'.repeat(30));
    
    requiredPackages.forEach(pkg => {
        try {
            const result = execSync(`${workingPython} -c "import ${pkg}; print(${pkg}.__version__)"`, { 
                encoding: 'utf8', 
                timeout: 10000,
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
            console.log(`${pkg}: ✓ ${result}`);
        } catch (error) {
            console.log(`${pkg}: ❌ Not installed or error: ${error.message}`);
        }
    });
    
    // Test Streamlit command
    console.log('\n🚀 STREAMLIT COMMAND TEST');
    console.log('-'.repeat(30));
    
    try {
        const streamlitVersion = execSync(`${workingPython} -m streamlit --version`, { 
            encoding: 'utf8', 
            timeout: 10000 
        }).trim();
        console.log('Streamlit command: ✓', streamlitVersion);
        
        // Test if we can run a basic Streamlit app
        if (streamlitAppPath) {
            const mainPyPath = path.join(streamlitAppPath, 'lumina_app.py');
            if (fs.existsSync(mainPyPath)) {
                console.log('Main app file found:', mainPyPath);
                
                // Try to validate the Python file
                try {
                    execSync(`${workingPython} -m py_compile "${mainPyPath}"`, { 
                        timeout: 10000,
                        stdio: 'ignore'
                    });
                    console.log('Python syntax check: ✓ Valid');
                } catch (error) {
                    console.log('Python syntax check: ❌ Errors found');
                    console.log('Syntax error details:', error.message);
                }
            } else {
                console.log('❌ Main app file not found:', mainPyPath);
            }
        }
        
    } catch (error) {
        console.log('Streamlit command: ❌ Error:', error.message);
    }
} else {
    console.log('\n❌ No working Python installation found!');
}

// Network connectivity test
console.log('\n🌐 NETWORK CONNECTIVITY TEST');
console.log('-'.repeat(30));

function testPort(port, callback) {
    const server = http.createServer();
    
    server.listen(port, 'localhost', () => {
        console.log(`Port ${port}: ✓ Available`);
        server.close();
        callback(true);
    });
    
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port}: ⚠ In use (may be Streamlit)`);
        } else {
            console.log(`Port ${port}: ❌ Error - ${err.message}`);
        }
        callback(false);
    });
}

// Test if Streamlit is already running
function testStreamlitConnection() {
    console.log('Testing Streamlit connection on localhost:8501...');
    
    const req = http.request({
        hostname: 'localhost',
        port: 8501,
        path: '/',
        method: 'GET',
        timeout: 2000
    }, (res) => {
        console.log(`Streamlit connection: ✓ Responding (status: ${res.statusCode})`);
    });

    req.on('error', (error) => {
        console.log('Streamlit connection: ❌ Not responding -', error.message);
    });

    req.on('timeout', () => {
        console.log('Streamlit connection: ❌ Timeout');
        req.destroy();
    });

    req.end();
}

testPort(8501, (available) => {
    if (!available) {
        // Port is in use, test if it's Streamlit
        setTimeout(testStreamlitConnection, 1000);
    }
});

// Environment variables check
console.log('\n🔧 ENVIRONMENT VARIABLES');
console.log('-'.repeat(30));

const relevantEnvVars = [
    'NODE_ENV',
    'PATH',
    'PYTHONPATH',
    'STREAMLIT_SERVER_PORT',
    'STREAMLIT_SERVER_ADDRESS'
];

relevantEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        // Truncate very long values (like PATH)
        const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
        console.log(`${varName}: ${displayValue}`);
    } else {
        console.log(`${varName}: Not set`);
    }
});

// File permissions check (Unix-like systems)
if (process.platform !== 'win32' && streamlitAppPath) {
    console.log('\n🔒 FILE PERMISSIONS CHECK');
    console.log('-'.repeat(30));
    
    try {
        const mainPyPath = path.join(streamlitAppPath, 'lumina_app.py');
        if (fs.existsSync(mainPyPath)) {
            const stats = fs.statSync(mainPyPath);
            console.log(`lumina_app.py permissions: ${stats.mode.toString(8)}`);
            console.log(`File is readable: ${fs.constants.R_OK & stats.mode ? '✓' : '❌'}`);
        }
        
        const dataPath = path.join(streamlitAppPath, 'data');
        if (fs.existsSync(dataPath)) {
            const stats = fs.statSync(dataPath);
            console.log(`data directory permissions: ${stats.mode.toString(8)}`);
            console.log(`Directory is readable: ${fs.constants.R_OK & stats.mode ? '✓' : '❌'}`);
            console.log(`Directory is writable: ${fs.constants.W_OK & stats.mode ? '✓' : '❌'}`);
        }
    } catch (error) {
        console.log('Error checking permissions:', error.message);
    }
}

// Summary and recommendations
console.log('\n💡 SUMMARY AND RECOMMENDATIONS');
console.log('='.repeat(60));

const issues = [];
const recommendations = [];

if (!workingPython) {
    issues.push('No working Python installation found');
    recommendations.push('Install Python 3.8+ from https://python.org');
}

if (!streamlitAppPath) {
    issues.push('Streamlit app directory not found');
    recommendations.push('Ensure streamlit_app is included in build process');
}

if (issues.length === 0) {
    console.log('✅ No major issues detected!');
    console.log('\nIf the app still fails to start, try:');
    console.log('1. Run: streamlit run streamlit_app/lumina_app.py');
    console.log('2. Check the Electron console for detailed error messages');
    console.log('3. Verify all CSV files exist in streamlit_app/data/');
} else {
    console.log('❌ Issues found:');
    issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
    });
    
    console.log('\n🔧 Recommended fixes:');
    recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
    });
}

console.log('\n📝 Additional debugging steps:');
console.log('1. Enable DevTools in Electron to see console errors');
console.log('2. Try running the Python app manually first');
console.log('3. Check system logs for Python/Streamlit errors');
console.log('4. Verify network connectivity and firewall settings');

console.log('\n='.repeat(60));