// setup.js - Enhanced setup for Electron environment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up Lumina Electron App...');

function createEnvFiles() {
    console.log('Creating environment files...');
    
    // Create .env.template in project root
    const envTemplatePath = path.join(__dirname, '.env.template');
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
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.log('⚠️  .env file not found. Creating from template...');
        fs.copyFileSync(envTemplatePath, envPath);
        console.log('✓ Created .env file from template');
        console.log('🔑 Please update .env with your actual Supabase credentials');
    } else {
        console.log('✓ .env file already exists');
    }
}

// Check if Python is installed
function checkPython() {
    try {
        const pythonVersion = execSync('python --version', { encoding: 'utf8' });
        console.log(`✓ Python found: ${pythonVersion.trim()}`);
        return 'python';
    } catch (error) {
        try {
            const python3Version = execSync('python3 --version', { encoding: 'utf8' });
            console.log(`✓ Python found: ${python3Version.trim()}`);
            return 'python3';
        } catch (error2) {
            console.error('❌ Python not found. Please install Python 3.8+ first.');
            process.exit(1);
        }
    }
}

// Check if Streamlit is installed
function checkStreamlit(pythonCmd) {
    try {
        const streamlitVersion = execSync(`${pythonCmd} -m streamlit --version`, { encoding: 'utf8' });
        console.log(`✓ Streamlit found: ${streamlitVersion.trim()}`);
        return true;
    } catch (error) {
        console.log('⚠ Streamlit not found, installing...');
        return false;
    }
}

// Install Python dependencies
function installPythonDeps(pythonCmd) {
    console.log('Installing Python dependencies...');
    
    const requirementsPath = path.join(__dirname, 'streamlit_app', 'requirements.txt');
    
    if (!fs.existsSync(requirementsPath)) {
        console.log('Creating requirements.txt...');
        const requirements = `streamlit>=1.28.0
pandas>=1.5.0
altair>=4.2.0
st-supabase-connection>=0.2.0
supabase>=1.0.0
python-dotenv>=1.0.0
`;
        fs.writeFileSync(requirementsPath, requirements);
    }
    
    try {
        execSync(`${pythonCmd} -m pip install -r "${requirementsPath}"`, { stdio: 'inherit' });
        console.log('✓ Python dependencies installed successfully');
    } catch (error) {
        console.error('❌ Failed to install Python dependencies:', error.message);
        process.exit(1);
    }
}

// Create data directory and CSV files
function setupDataFiles() {
    console.log('Setting up data directory and CSV files...');
    
    const dataDir = path.join(__dirname, 'streamlit_app', 'data');
    
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

// Create Streamlit config
function createStreamlitConfig() {
    console.log('Creating Streamlit configuration...');
    
    const configDir = path.join(__dirname, 'streamlit_app', '.streamlit');
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
`;
    
    fs.writeFileSync(configFile, configContent);
    console.log('✓ Created Streamlit config');
}

// Create environment file template
function createEnvTemplate() {
    const envPath = path.join(__dirname, 'streamlit_app', '.env.template');
    
    if (!fs.existsSync(envPath)) {
        const envContent = `# Supabase Configuration (Optional)
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# App Configuration
NODE_ENV=production
`;
        
        fs.writeFileSync(envPath, envContent);
        console.log('✓ Created .env.template');
        console.log('  → Copy .env.template to .env and add your Supabase credentials if using database mode');
    }
}

// Test Streamlit installation
function testStreamlit(pythonCmd) {
    console.log('Testing Streamlit installation...');
    
    try {
        // Test if we can import streamlit
        const testScript = `
import streamlit as st
import pandas as pd
print("✓ Streamlit imports successfully")
`;
        
        const testFile = path.join(__dirname, 'test_streamlit.py');
        fs.writeFileSync(testFile, testScript);
        
        execSync(`${pythonCmd} "${testFile}"`, { stdio: 'inherit' });
        
        // Clean up test file
        fs.unlinkSync(testFile);
        
        console.log('✓ Streamlit test passed');
    } catch (error) {
        console.error('❌ Streamlit test failed:', error.message);
        process.exit(1);
    }
}

// Main setup function
function main() {
    try {
        console.log('='.repeat(50));
        console.log('🚀 Lumina Electron App Setup');
        console.log('='.repeat(50));
        
        // Check Python installation
        const pythonCmd = checkPython();
        
        // Check and install Streamlit
        if (!checkStreamlit(pythonCmd)) {
            console.log('Installing Streamlit...');
            execSync(`${pythonCmd} -m pip install streamlit`, { stdio: 'inherit' });
            console.log('✓ Streamlit installed');
        }
        
        // Install other Python dependencies
        installPythonDeps(pythonCmd);

        // Create environment file template
        createEnvFiles();
        
        // Test Streamlit
        testStreamlit(pythonCmd);
        
        // Setup data files
        setupDataFiles();
        
        // Create Streamlit config
        createStreamlitConfig();
        
        // Create environment template
        createEnvTemplate();

        console.log('\n' + '='.repeat(50));
        console.log('✅ Setup completed successfully!');
        console.log('='.repeat(50));
        console.log('\nNext steps:');
        console.log('1. Update .env file with your actual Supabase credentials');
        console.log('2. Run "npm start" to launch the app');
        console.log('3. The .env file is excluded from git for security');
        console.log('4. The app will be available at http://localhost:8501');
        console.log('\nTroubleshooting:');
        console.log('- If Streamlit fails to start, try running "streamlit run streamlit_app/lumina_app.py" manually');
        console.log('- Check that all CSV files exist in streamlit_app/data/');
        console.log('- Ensure Python and pip are properly installed');
        
    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.error('\nPlease check the error above and try again.');
        process.exit(1);
    }
}

// Run setup
main();