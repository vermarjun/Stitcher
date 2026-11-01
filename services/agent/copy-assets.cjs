// Keep non-TypeScript resources next to the modules that read them at runtime.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
for (const dir of ['assets', 'prompts', 'validation']) {
  fs.cpSync(path.join(root, 'src', dir), path.join(root, 'dist', dir), {
    recursive: true,
    filter: (file) => fs.statSync(file).isDirectory() || !/\.(ts|pyc)$/.test(file),
  });
}
