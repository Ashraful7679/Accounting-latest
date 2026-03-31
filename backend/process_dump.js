const fs = require('fs');

const sql = fs.readFileSync('local_data_export.sql', 'utf8');

const processedLines = [
    '-- Cleanup existing seed data to allow local IDs to be inserted',
    'DELETE FROM "UserRole";',
    'DELETE FROM "User";',
    'DELETE FROM "Role";',
    'DELETE FROM "Currency";',
    'DELETE FROM "AccountType";',
    ''
];
let skipSection = false;
const lines = sql.split('\n');

for (let line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('\\')) continue; // Skip meta-commands
    
    // Skip incompatible SET commands
    if (trimmedLine.startsWith('SET transaction_timeout')) continue;
    if (trimmedLine.startsWith('SET row_security')) continue; // Sometimes fails on older versions if not superuser
    
    if (line.includes('-- Data for Name: _prisma_migrations')) {
        skipSection = true;
        continue;
    }
    if (skipSection && line.startsWith('--')) {
        skipSection = false;
    }
    
    if (skipSection) continue;
    if (trimmedLine.startsWith('INSERT INTO public._prisma_migrations')) continue;
    if (trimmedLine.startsWith('INSERT INTO "_prisma_migrations"')) continue;

    // Add ON CONFLICT DO NOTHING to standard INSERTs
    if (trimmedLine.startsWith('INSERT INTO')) {
        line = line.replace(/;$/, ' ON CONFLICT DO NOTHING;');
    }
    processedLines.push(line);
}

fs.writeFileSync('local_data_final.sql', processedLines.join('\n'));
console.log('Processed SQL saved to local_data_final.sql (skipped _prisma_migrations)');
