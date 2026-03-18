const fs = require('fs');
const path = require('path');

// --- CRITICAL FIX: Ensure Prisma binaries are executable on Namecheap ---
const engineDir = path.join(__dirname, 'dist', 'generated', 'client');
if (fs.existsSync(engineDir)) {
  const files = fs.readdirSync(engineDir);
  files.forEach(file => {
    if (file.startsWith('query-engine-')) {
      const fullPath = path.join(engineDir, file);
      try {
        fs.chmodSync(fullPath, '755');
        console.log(`Fixed permissions for ${file}`);
      } catch (err) {
        console.error(`Failed to chmod ${file}:`, err.message);
      }
    }
  });
}

// Start the app
require('./dist/index.js');
