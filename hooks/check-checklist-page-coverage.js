#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const checklistPath = path.join(repoRoot, 'CHECKLIST.md');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name === 'page.tsx') {
      out.push(path.relative(repoRoot, full).replace(/\\/g, '/'));
    }
  }
  return out;
}

if (!fs.existsSync(checklistPath)) {
  console.error('CHECKLIST.md not found.');
  process.exit(1);
}

const checklistContent = fs.readFileSync(checklistPath, 'utf8');
const listedPaths = new Set(
  [...checklistContent.matchAll(/`(frontend\/src\/app(?:\/[^`]+)?\/page\.tsx)`/g)].map((m) => m[1])
);
const discoveredPaths = new Set(walk(path.join(repoRoot, 'frontend', 'src', 'app')));

const missingFromChecklist = [...discoveredPaths].filter((p) => !listedPaths.has(p)).sort();
const staleChecklistEntries = [...listedPaths].filter((p) => !discoveredPaths.has(p)).sort();

const header = '[Checklist Page Coverage]';
console.log(`${header} discovered=${discoveredPaths.size}, listed=${listedPaths.size}`);

if (missingFromChecklist.length || staleChecklistEntries.length) {
  if (missingFromChecklist.length) {
    console.error(`\n${header} Missing from CHECKLIST.md (${missingFromChecklist.length}):`);
    missingFromChecklist.forEach((p) => console.error(`- ${p}`));
  }

  if (staleChecklistEntries.length) {
    console.error(`\n${header} Listed but missing on disk (${staleChecklistEntries.length}):`);
    staleChecklistEntries.forEach((p) => console.error(`- ${p}`));
  }

  process.exit(1);
}

console.log(`${header} ✅ Coverage is in sync.`);
