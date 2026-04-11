const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execPromise = util.promisify(exec);

async function testZip() {
  const jsonFilePath = path.join(process.cwd(), 'temp_test.json');
  fs.writeFileSync(jsonFilePath, JSON.stringify({ test: true }));
  
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads dir for testing...');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'test_file.txt'), 'test content');
  }

  const outputZipPath = path.join(process.cwd(), 'temp_test.zip');
  if (fs.existsSync(outputZipPath)) fs.unlinkSync(outputZipPath);

  const sources = [jsonFilePath];
  if (fs.existsSync(uploadsDir)) sources.push(uploadsDir);

  try {
    if (process.platform === 'win32') {
      const srcArray = sources.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
      const cmd = `powershell -NoProfile -Command "Compress-Archive -Force -Path @(${srcArray}) -DestinationPath '${outputZipPath}'"`;
      console.log('Running:', cmd);
      await execPromise(cmd);
    } else {
      const srcList = sources.map(s => `"${s}"`).join(' ');
      await execPromise(`zip -r "${outputZipPath}" ${srcList}`);
    }
    
    if (fs.existsSync(outputZipPath)) {
      const stats = fs.statSync(outputZipPath);
      console.log('Success! ZIP created. Size:', stats.size);
    } else {
      console.log('Failed! ZIP not found.');
    }
  } catch (e) {
    console.error('Error during zipping:', e.message);
  } finally {
    if (fs.existsSync(jsonFilePath)) fs.unlinkSync(jsonFilePath);
  }
}

testZip();
