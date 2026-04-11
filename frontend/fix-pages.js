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
  if (content.includes('];') && content.includes('}')) {
    const oldLength = content.length;
    
    // Replace standalone ]; \n } that follows use client
    content = content.replace(/(['"]use client['"];?\s*)\];\s*\r?\n\s*\}\s*\r?\n/, '$1\n');
    // Catch if it's just at the absolute start of the file
    content = content.replace(/^\s*\];\s*\r?\n\s*\}\s*\r?\n/, '');
    
    if (content.length !== oldLength) {
      fs.writeFileSync(file, content);
      fixed++;
      console.log('Cleaned orphans in ' + file);
    }
  }
});
console.log('Total fixed: ' + fixed);
