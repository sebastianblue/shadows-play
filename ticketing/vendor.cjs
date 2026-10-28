const fs = require('node:fs');
const path = require('node:path');
const dest = path.join(__dirname, 'vendor');
fs.mkdirSync(dest, { recursive: true });
for (const [source, name] of [
  ['pdf-lib/dist/pdf-lib.min.js', 'pdf-lib.min.js'],
  ['pdf-lib/LICENSE.md', 'pdf-lib-LICENSE.md'],
  ['@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'fontkit.umd.min.js']
]) fs.copyFileSync(require.resolve(source), path.join(dest, name));
console.log('Vendored PDF libraries for buildless GitHub Pages.');
