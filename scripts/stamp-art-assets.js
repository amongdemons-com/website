// Version replaced image URLs, including template-generated demon paths.
// The atlas has its own content hash and is deliberately excluded.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const imageRoot = path.join(root, 'public/app/images');
const files = ['demons', 'assets/background', 'assets/world'].flatMap(dir => walk(path.join(imageRoot, dir))).filter(f => /\.(?:png|webp|avif)$/.test(f)).sort();
const hash = crypto.createHash('sha256');
for (const file of files) hash.update(path.relative(imageRoot, file).replace(/\\/g, '/')).update(fs.readFileSync(file));
const version = `art-${hash.digest('hex').slice(0, 12)}`;
const sources = ['public/app/js', 'public/app/css', 'public/api/lib', 'lib'].flatMap(dir => walk(path.join(root, dir)));
sources.push(...fs.readdirSync(path.join(root, 'public/app')).filter(f => f.endsWith('.html')).map(f => path.join(root, 'public/app', f)));
const pattern = /(\/(?:app\/)?images\/(?:demons|assets\/(?:background|world))\/[^"'`\s<>]+?\.(?:png|webp|avif))(?:\?v=[\w-]+)?/g;
let changed = 0;
for (const file of sources.filter(f => /\.(?:js|html|css)$/.test(f))) {
  if (file.endsWith('demon-map-atlas.js')) continue;
  const source = fs.readFileSync(file, 'utf8');
  const next = source.replace(pattern, (match, url) => url.includes('map-atlas.webp') ? match : `${url}?v=${version}`);
  if (source !== next) { fs.writeFileSync(file, next); changed++; }
}
fs.writeFileSync(path.join(root, 'docs/art/asset-version.json'), JSON.stringify({ version }, null, 2) + '\n');
console.log(`Artwork ${version}: refreshed references in ${changed} files.`);
