const fs = require('node:fs');
const path = require('node:path');

const [, , sourceArg, targetArg] = process.argv;

if (!sourceArg || !targetArg) {
  console.error('Usage: node scripts/copy-dist.cjs <source> <target>');
  process.exit(1);
}

const source = path.resolve(process.cwd(), sourceArg);
const target = path.resolve(process.cwd(), targetArg);

if (!fs.existsSync(source)) {
  console.error(`Build output not found: ${source}`);
  process.exit(1);
}

if (source === target) {
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
