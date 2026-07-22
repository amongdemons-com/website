const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'public', 'app');
const OUT_DIR = path.join(APP_DIR, 'dist');
const COMMON_SCRIPT_PATTERN = /\s*<script src="(?:https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap@5\.3\.2\/dist\/js\/bootstrap\.bundle\.min\.js|\/app\/js\/(?:lucide-subset|icons|api-config|session|steam|audio|navigation|demon-cards)\.js|\/app\/dist\/runtime\.bundle\.js)(?:\?v=[^"]+)?"><\/script>/g;
const DUNGEON_SCRIPT_PATTERN = /<script(?: type="module")? src="(?:\/app\/js\/dungeon\.js|\/app\/dist\/dungeon\.bundle\.js)(?:\?v=[^"]+)?"><\/script>/;
const WORLD_SCRIPT_PATTERN = /<script(?: type="module")? src="(?:\/app\/js\/world-ui\.js|\/app\/dist\/world\.bundle\.js)(?:\?v=[^"]+)?"><\/script>/;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const runtime = await bundle(path.join(__dirname, 'browser-runtime-entry.js'));
  const dungeon = await bundle(path.join(APP_DIR, 'js', 'dungeon.js'));
  const world = await bundle(path.join(APP_DIR, 'js', 'world-ui.js'));
  const runtimeHash = contentHash(runtime);
  const dungeonHash = contentHash(dungeon);
  const worldHash = contentHash(world);

  fs.writeFileSync(path.join(OUT_DIR, 'runtime.bundle.js'), runtime);
  fs.writeFileSync(path.join(OUT_DIR, 'dungeon.bundle.js'), dungeon);
  fs.writeFileSync(path.join(OUT_DIR, 'world.bundle.js'), world);
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify({
    runtime: `/app/dist/runtime.bundle.js?v=${runtimeHash}`,
    dungeon: `/app/dist/dungeon.bundle.js?v=${dungeonHash}`,
    world: `/app/dist/world.bundle.js?v=${worldHash}`
  }, null, 2)}\n`);

  updateHtmlFiles(runtimeHash, dungeonHash, worldHash);
  console.log(`Browser bundles: runtime ${formatBytes(runtime.length)}, dungeon ${formatBytes(dungeon.length)}, world ${formatBytes(world.length)}.`);
}

async function bundle(entryPoint) {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['chrome100', 'firefox100', 'safari15'],
    write: false,
    legalComments: 'none'
  });
  return result.outputFiles[0].contents;
}

function updateHtmlFiles(runtimeHash, dungeonHash, worldHash) {
  const runtimeTag = `<script src="/app/dist/runtime.bundle.js?v=${runtimeHash}"></script>`;
  const dungeonTag = `<script src="/app/dist/dungeon.bundle.js?v=${dungeonHash}"></script>`;
  const worldTag = `<script src="/app/dist/world.bundle.js?v=${worldHash}"></script>`;

  for (const name of fs.readdirSync(APP_DIR).filter((entry) => entry.endsWith('.html'))) {
    const filePath = path.join(APP_DIR, name);
    const source = fs.readFileSync(filePath, 'utf8');
    let insertedRuntime = false;
    let html = source
      .replace('https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css', '/vendor/bootstrap/css/bootstrap.min.css?v=5.3.2')
      .replace(/\/vendor\/bootstrap\/css\/bootstrap\.min\.css(?:\?v=[^"']+)?/g, '/vendor/bootstrap/css/bootstrap.min.css?v=5.3.2')
      .replace(COMMON_SCRIPT_PATTERN, (match) => {
      if (insertedRuntime) return '';
      insertedRuntime = true;
      return `\n    ${runtimeTag}`;
      });
    html = html.replace(DUNGEON_SCRIPT_PATTERN, dungeonTag);
    html = html.replace(WORLD_SCRIPT_PATTERN, worldTag);
    html = html.replace(
      /(["'])(\/app\/(?:css|js|dist)\/[^"'?]+\.(?:css|js))(?:\?v=[^"']+)?\1/g,
      (match, quote, assetPath) => `${quote}${versionAppAsset(assetPath)}${quote}`
    );
    if (html !== source) fs.writeFileSync(filePath, html);
  }
}

function versionAppAsset(assetPath) {
  const filePath = path.join(APP_DIR, assetPath.replace(/^\/app\//, ''));
  try {
    return `${assetPath}?v=${contentHash(fs.readFileSync(filePath))}`;
  } catch (error) {
    return assetPath;
  }
}

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function formatBytes(bytes) {
  return `${(Number(bytes) / 1024).toFixed(1)} KB`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
