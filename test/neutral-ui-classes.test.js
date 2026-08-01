const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP_ROOT = path.join(__dirname, '..', 'public', 'app');
const SCANNED_EXTENSIONS = new Set(['.css', '.html', '.js']);

function collectSourceFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'dist') continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(filePath, files);
    else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) files.push(filePath);
  }
  return files;
}

test('rendered UI classes avoid ad-blocker-sensitive ad prefixes', () => {
  const violations = [];

  for (const filePath of collectSourceFiles(APP_ROOT)) {
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (/class(?:Name)?[=:][^\r\n]*\bad-|\.ad-[A-Za-z0-9_-]+/.test(line)) {
        violations.push(`${path.relative(APP_ROOT, filePath)}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(violations, []);
});

test('icon renderer emits neutral game icon classes', () => {
  const source = fs.readFileSync(path.join(APP_ROOT, 'js', 'icons.js'), 'utf8');

  assert.match(source, /'game-icon'/);
  assert.match(source, /'game-icon-poison'/);
  assert.match(source, /'game-icon-fill'/);
  assert.doesNotMatch(source, /'ad-icon/);
});
