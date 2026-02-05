const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get version from manifest.json
const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
const version = manifest.version;
const pluginName = manifest.id || 'local-llm-helper';

// Create output directory
const outputDir = path.join(__dirname, 'output', `${pluginName}_${version}`);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Files to include in the plugin package
const filesToCopy = [
    'main.js',
    'manifest.json',
    'styles.css'
];

console.log(`Packaging plugin ${pluginName} version ${version}...`);

// Attempt to build the plugin first
try {
    console.log('Attempting to build the plugin...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Build completed successfully.');
} catch (error) {
    console.log('Build failed or not available. Looking for existing built files...');
}

// Copy files to output directory
filesToCopy.forEach(file => {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(outputDir, file);
    
    if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied ${file} to ${outputDir}`);
    } else {
        console.log(`Warning: ${file} not found in source directory`);
    }
});

console.log(`Plugin packaged successfully to: ${outputDir}`);
console.log('Package contents:');
const files = fs.readdirSync(outputDir);
files.forEach(file => {
    const filePath = path.join(outputDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  ${file} (${Math.round(stats.size)} bytes)`);
});