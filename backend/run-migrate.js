const { spawn } = require('child_process');

const child = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'sync_schema_changes'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
});

// Provide 'y' and enter to stdin just in case it prompts
setTimeout(() => {
    child.stdin.write('y\n');
}, 5000);

setTimeout(() => {
    child.stdin.write('y\n');
}, 10000);

child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    process.exit(code);
});
