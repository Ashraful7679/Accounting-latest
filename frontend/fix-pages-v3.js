const fs = require('fs');
const path = require('path');

const targets = [
  './src/app/company/[id]/accounts/page.tsx',
  './src/app/company/[id]/purchase/orders/page.tsx',
  './src/app/company/[id]/sales/invoices/page.tsx',
  './src/app/company/[id]/sales/pis/page.tsx'
];

targets.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // The previous script removed `];\n}` from `Account[];\n}` 
    // Which left things like `Account[export`
    // We reverse this by adding back the `];\n}\n\n`
    content = content.replace(/\[\s*(export\s+default\s+function)/g, '[];\n}\n\n$1');
    content = content.replace(/\[\s*(import\s+)/g, '[];\n}\n\n$1');
    
    fs.writeFileSync(file, content);
    console.log('Restored interface syntax in ' + file);
  }
});
