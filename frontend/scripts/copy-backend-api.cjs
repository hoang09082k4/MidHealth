const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const source = path.join(repoRoot, 'backend', 'src');
const target = path.join(frontendRoot, 'backend', 'src');

if (!fs.existsSync(source)) {
  console.error(`Backend source not found: ${source}`);
  process.exit(1);
}

fs.rmSync(path.join(frontendRoot, 'backend'), { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.cpSync(source, target, { recursive: true });

console.log(`Copied backend API source to ${path.relative(frontendRoot, target)}`);
