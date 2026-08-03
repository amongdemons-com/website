const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

test('dynamic API responses advertise the deployed browser client', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

  assert.match(server, /X-Among-Demons-Client/);
  assert.match(server, /browserManifest\.clientVersion/);
  assert.match(server, /world\\\/map/);
});

test('the browser replaces a stale web client once', async () => {
  const harness = createSessionHarness({ clientVersion: 'client-old', serverVersion: 'client-new' });

  harness.api('/api/test');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(harness.replacements.length, 1);
  assert.equal(new URL(harness.replacements[0]).searchParams.get('_client'), 'client-new');
  assert.equal(JSON.parse(harness.storage.get('amongdemons-client-refresh-v1')).to, 'client-new');
});

test('matching and packaged browser clients continue without reloading', async () => {
  const current = createSessionHarness({ clientVersion: 'client-current', serverVersion: 'client-current' });
  const packaged = createSessionHarness({ clientVersion: 'client-old', serverVersion: 'client-new', packaged: true });

  assert.equal((await current.api('/api/test')).ok, true);
  assert.equal((await packaged.api('/api/test')).ok, true);
  assert.equal(current.replacements.length, 0);
  assert.equal(packaged.replacements.length, 0);
});

test('browser HTML references the runtime recorded in the build manifest', () => {
  const appDir = path.join(ROOT, 'public', 'app');
  const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'dist', 'manifest.json'), 'utf8'));
  const htmlFiles = fs.readdirSync(appDir).filter((name) => {
    if (!name.endsWith('.html')) return false;
    const html = fs.readFileSync(path.join(appDir, name), 'utf8');
    return html.includes('/app/dist/runtime.bundle.js');
  });

  for (const name of htmlFiles) {
    const html = fs.readFileSync(path.join(appDir, name), 'utf8');
    assert.match(html, new RegExp(escapeRegExp(manifest.runtime)), name);
    assert.match(
      html,
      new RegExp(`<meta name="among-demons-client-version" content="${escapeRegExp(manifest.clientVersion)}">`),
      name
    );
  }
});

test('browser asset hashes are stable across Windows and production line endings', () => {
  const buildScript = fs.readFileSync(path.join(ROOT, 'scripts', 'build-browser.js'), 'utf8');
  assert.match(buildScript, /replace\(\/\\r\\n\/g, '\\n'\)/);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createSessionHarness({ clientVersion, serverVersion, packaged = false }) {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'session.js'), 'utf8');
  const storage = new Map();
  const replacements = [];
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  const window = {
    AmongDemons: {
      isPackagedRuntime: () => packaged
    },
    location: {
      href: 'https://amongdemons.com/world',
      origin: 'https://amongdemons.com',
      replace: (url) => replacements.push(url)
    }
  };
  const response = {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'x-among-demons-client') return serverVersion;
        if (String(name).toLowerCase() === 'content-type') return 'application/json';
        return null;
      }
    },
    text: async () => JSON.stringify({ ok: true })
  };

  vm.runInNewContext(source, {
    URL,
    document: {
      querySelector: (selector) => selector.includes('among-demons-client-version')
        ? { content: clientVersion }
        : null
    },
    fetch: async () => response,
    localStorage,
    sessionStorage: localStorage,
    window
  });

  return {
    api: window.AmongDemons.api,
    replacements,
    storage
  };
}
