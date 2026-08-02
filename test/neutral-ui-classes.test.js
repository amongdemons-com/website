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
  const lucideSubset = fs.readFileSync(path.join(APP_ROOT, 'js', 'lucide-subset.js'), 'utf8');

  assert.match(source, /'game-icon'/);
  assert.match(source, /'game-icon-poison'/);
  assert.match(source, /'game-icon-fill'/);
  assert.match(source, /cross:\s*'Cross'/);
  assert.match(lucideSubset, /"Cross":/);
  assert.doesNotMatch(source, /'ad-icon/);
});

test('navbar logo has no decorative shadow or glow', () => {
  const source = fs.readFileSync(path.join(APP_ROOT, 'css', 'base.css'), 'utf8');
  const logoRule = source.match(/\.game-shell-brand \.logo-nav\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(logoRule, /box-shadow:\s*none;/);
  assert.match(logoRule, /filter:\s*none;/);
  assert.doesNotMatch(logoRule, /drop-shadow/);
});
