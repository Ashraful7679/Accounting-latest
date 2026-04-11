const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('page.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/app/company/[id]');

let fixed = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // The orphaned brace block might be sitting right before `export default function`
  // We can safely match "]; \n }" that occurs outside of block scopes.
  // The simplest is to find `]; \n } \n export default`
  
  const oldLength = content.length;
  
  content = content.replace(/\];\s*\r?\n\s*\}\s*\r?\n(\s*export\s+default\s+function)/, '$1');
  
  // also standalone just in case
  content = content.replace(/\];\s*\r?\n\s*\}\s*\r?\n(\s*import\s+)/, '$1');
  
  if (content.length !== oldLength) {
    fs.writeFileSync(file, content);
    fixed++;
    console.log('Cleaned floating orphans in ' + file);
  }
});
console.log('Total fixed: ' + fixed);
