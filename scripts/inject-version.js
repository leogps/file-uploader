const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const filePath = path.join(__dirname, '../src/globals.ts');

let content = fs.readFileSync(filePath, 'utf8');

const versionBlockRegex = /\/\/ version:start[\s\S]*?\/\/ version:end/;

const newBlock = `// version:start
export const APP_VERSION = '${pkg.version}';
// version:end`;

if (!versionBlockRegex.test(content)) {
    throw new Error('Version block markers not found in globals.ts');
}

content = content.replace(versionBlockRegex, newBlock);

fs.writeFileSync(filePath, content, 'utf8');

console.log(`APP_VERSION updated to ${pkg.version}`);
