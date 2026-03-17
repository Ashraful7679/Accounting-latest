const http = require('http');
const fs = require('fs');
const path = require('path');

let debugInfo = "Starting debug session...\n";

async function runTest() {
  try {
    debugInfo += `Checking path: ${path.join(__dirname, 'dist', 'index.js')}\n`;
    if (fs.existsSync(path.join(__dirname, 'dist', 'index.js'))) {
      debugInfo += "dist/index.js exists. Trying to require...\n";
      // This will attempt to load all dependencies (including Prisma)
      require('./dist/index.js');
      debugInfo += "SUCCESS: Main app dependencies loaded successfully.\n";
    } else {
      debugInfo += "ERROR: dist/index.js NOT FOUND.\n";
    }
  } catch (err) {
    debugInfo += `CRASH DETECTED: ${err.message}\n`;
    if (err.stack) {
      debugInfo += `STACK TRACE:\n${err.stack}\n`;
    }
  }
}

// Start a server to display the results
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`DEBUG LOG:\n====================\n${debugInfo}\n====================\n`);
});

const port = process.env.PORT || 5002;
server.listen(port, () => {
  console.log('Debug server running');
  runTest();
});
