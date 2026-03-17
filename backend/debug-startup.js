const fs = require('fs');
const path = require('path');

async function debug() {
  const logFile = path.join(__dirname, 'debug_error.log');
  fs.writeFileSync(logFile, `Debug session started at ${new Date().toISOString()}\n`);
  
  try {
    fs.appendFileSync(logFile, "Checking if dist/index.js exists...\n");
    if (!fs.existsSync(path.join(__dirname, 'dist', 'index.js'))) {
      fs.appendFileSync(logFile, "dist/index.js NOT FOUND\n");
    }

    fs.appendFileSync(logFile, "Attempting to require main app...\n");
    // We don't want to actually start the server on the same port here, 
    // just try to load the dependencies and see if it crashes.
    require('./dist/index.js');
    fs.appendFileSync(logFile, "Main app required successfully (Dependencies OK)\n");

  } catch (err) {
    fs.appendFileSync(logFile, `CRASH DETECTED: ${err.message}\n`);
    if (err.stack) {
      fs.appendFileSync(logFile, `STACK TRACE: ${err.stack}\n`);
    }
  }
}

debug();
