const fs = require('fs');
const path = require('path');

const MEMORY_FILE = '.project-memory.json';

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load memory:', e);
  }
  return {
    schemaVersion: '1.0',
    projectName: 'Unknown',
    lastUpdated: new Date().toISOString(),
    lastAgent: 'unknown',
    files: {},
    implementations: {}
  };
}

function saveMemory(memory) {
  memory.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  console.log(`[memory-hook] Updated ${MEMORY_FILE}`);
}

function updateFile(filePath, features, agent) {
  const memory = loadMemory();
  const normalizedPath = path.normalize(filePath);

  if (!memory.files[normalizedPath]) {
    memory.files[normalizedPath] = { modified: '', features: [] };
  }

  memory.files[normalizedPath].modified = new Date().toISOString();
  memory.files[normalizedPath].lastChange = new Date().toISOString();
  memory.files[normalizedPath].agent = agent || 'unknown';

  for (const feature of features) {
    if (!memory.files[normalizedPath].features.includes(feature)) {
      memory.files[normalizedPath].features.push(feature);
    }
  }

  if (agent) memory.lastAgent = agent;
  saveMemory(memory);
}

function addImplementation(key, impl) {
  const memory = loadMemory();
  memory.implementations[key] = {
    ...impl,
    updatedAt: new Date().toISOString()
  };
  saveMemory(memory);
}

function listRecentChanges(limit = 10) {
  const memory = loadMemory();
  return Object.entries(memory.files)
    .map(([file, data]) => ({ file, ...data }))
    .filter((e) => e.lastChange)
    .sort((a, b) => new Date(b.lastChange).getTime() - new Date(a.lastChange).getTime())
    .slice(0, limit);
}

// CLI Interface
const args = process.argv.slice(2);

if (args[0] === '--update' || args[0] === '-u') {
  const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
  const featureArg = args.find((a) => a.startsWith('--feature='))?.split('=')[1];
  const agentArg = args.find((a) => a.startsWith('--agent='))?.split('=')[1];
  const features = featureArg ? [featureArg] : [];

  if (fileArg && features.length > 0) {
    updateFile(fileArg, features, agentArg);
    console.log(`[memory-hook] Updated: ${fileArg} - ${features.join(', ')}`);
  } else {
    console.error('Usage: node memory-update.js --update --file=path --feature="description" [--agent=name]');
    process.exit(1);
  }
} else if (args[0] === '--impl' || args[0] === '-i') {
  const keyArg = args.find((a) => a.startsWith('--key='))?.split('=')[1];
  const descArg = args.find((a) => a.startsWith('--desc='))?.split('=')[1];
  const filesArg = args.find((a) => a.startsWith('--files='))?.split('=')[1];

  if (keyArg && descArg) {
    addImplementation(keyArg, {
      date: new Date().toISOString().split('T')[0],
      description: descArg,
      files: filesArg ? filesArg.split(',') : [],
      status: 'complete'
    });
    console.log(`[memory-hook] Added implementation: ${keyArg}`);
  }
} else if (args[0] === '--list' || args[0] === '-l') {
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '10');
  const changes = listRecentChanges(limit);
  console.log('\nRecent Changes:');
  changes.forEach((c) => {
    console.log(`\n${c.file}`);
    console.log(`  Modified: ${c.lastChange}`);
    console.log(`  Features: ${c.features.join(', ')}`);
  });
} else if (args[0] === '--read') {
  console.log(JSON.stringify(loadMemory(), null, 2));
} else {
  console.log('Project Memory Hook');
  console.log('Run: node memory-update.js --help');
}