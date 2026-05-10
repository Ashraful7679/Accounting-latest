import * as fs from 'fs';
import * as path from 'path';

interface MemoryEntry {
  modified: string;
  features: string[];
  lastChange?: string;
  agent?: string;
}

interface Memory {
  schemaVersion: string;
  projectName: string;
  lastUpdated: string;
  lastAgent: string;
  description?: string;
  architecture?: object;
  directoryStructure?: object;
  files: Record<string, MemoryEntry>;
  implementations: Record<string, object>;
  workflows?: object;
  knownIssues?: object[];
  buildCommands?: object;
  environment?: object;
  apiEndpoints?: object;
}

const MEMORY_FILE = '.project-memory.json';

function loadMemory(): Memory {
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

function saveMemory(memory: Memory): void {
  memory.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  console.log(`[memory-hook] Updated ${MEMORY_FILE}`);
}

function updateFile(filePath: string, features: string[], agent?: string): void {
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

function addImplementation(key: string, impl: object): void {
  const memory = loadMemory();
  memory.implementations[key] = {
    ...impl as object,
    updatedAt: new Date().toISOString()
  };
  saveMemory(memory);
}

function updateDirectory(path: string, description: string): void {
  const memory = loadMemory();
  if (!memory.directoryStructure) memory.directoryStructure = {};
  (memory.directoryStructure as Record<string, string>)[path] = description;
  saveMemory(memory);
}

function getFileFeatures(filePath: string): string[] {
  const memory = loadMemory();
  const normalizedPath = path.normalize(filePath);
  return memory.files[normalizedPath]?.features || [];
}

function getImplementation(key: string): object | null {
  const memory = loadMemory();
  return memory.implementations[key] || null;
}

function listRecentChanges(limit: number = 10): MemoryEntry[] {
  const memory = loadMemory();
  return Object.entries(memory.files)
    .map(([file, data]) => ({ file, ...data }))
    .filter((e) => e.lastChange)
    .sort((a, b) => new Date(b.lastChange!).getTime() - new Date(a.lastChange!).getTime())
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
    console.error('Usage: node memory-update.ts --update --file=path --feature="description" [--agent=name]');
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
} else if (args[0] === '--features' || args[0] === '-f') {
  const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
  if (fileArg) {
    const features = getFileFeatures(fileArg);
    console.log(`Features for ${fileArg}:`);
    features.forEach((f) => console.log(`  - ${f}`));
  }
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
Project Memory Hook - Usage:

  node memory-update.ts [command] [options]

Commands:
  --update, -u          Update file features
  --impl, -i           Add implementation record
  --list, -l           List recent changes
  --features, -f        Get features for a file
  --help, -h           Show this help

Examples:
  # Update a file with new features
  node memory-update.ts --update --file="backend/src/modules/foo.ts" --feature="new feature added"

  # Add implementation record
  node memory-update.ts --impl --key="feature-name" --desc="Description" --files="file1.ts,file2.ts"

  # List recent changes
  node memory-update.ts --list --limit=5

  # Get features for a file
  node memory-update.ts --features --file="backend/src/modules/foo.ts"
`);
} else {
  console.log('Project Memory Hook');
  console.log('Run --help for usage');
}

export { updateFile, addImplementation, updateDirectory, getFileFeatures, getImplementation, listRecentChanges };