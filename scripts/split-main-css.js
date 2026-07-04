// One-time (re-runnable) splitter: public/app/css/main.css → base.css +
// battle.css + camp.css + collection.css + world.css, preserving rule order
// within each file. Rules are classified by selector family; anything shared
// or unrecognized stays in base.css, which every page loads first, so a
// misclassification can only mean "loaded where unneeded", never "missing".
//
// Usage: node scripts/split-main-css.js
const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', 'public', 'app', 'css');
const SOURCE = path.join(CSS_DIR, 'main.css');

// Priority matters: a selector mentioning .world- AND .dungeon- is world-page
// markup (e.g. the world battle modal) and belongs with the page that shows it.
const BUCKET_MATCHERS = [
  ['world', /\.world-|#world[A-Z]/],
  ['camp', /\.camp-|#camp[A-Z]/],
  ['battle', /\.collection-reinforcement-|is-collection-reinforcement|\.dungeon-hand-cards|\.dungeon-hand-empty/],
  ['collection', /\.collection-|#collection[A-Z]/],
  ['battle', /\.dungeon-|\.battle-|\.fight-|\.vs-divider|#dungeon[A-Z]|#battleLog|#combatPanel|#enemyGrid|#teamGrid|#run(Panel|Empty|Loading)|#fightLog|#cashout|#shortTeamModal|#teamChoiceModal|#teamSideTitle|#enemySideTitle/]
];
const BUCKET_ORDER = ['base', 'battle', 'camp', 'collection', 'world'];

function classify(selector) {
  for (const [bucket, matcher] of BUCKET_MATCHERS) {
    if (matcher.test(selector)) return bucket;
  }
  return 'base';
}

// Scans past strings and comments so braces inside content:"..." don't confuse
// block matching.
function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' || char === "'") {
      const quote = char;
      i += 1;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i += 1;
        i += 1;
      }
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
      if (i === 0) return text.length - 1;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced braces after index ${openIndex}`);
}

// Returns [{bucket, text}] preserving source order.
function splitRules(css) {
  const chunks = [];
  let index = 0;
  let pendingComment = '';

  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index])) index += 1;
    if (index >= css.length) break;

    if (css[index] === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      if (end === -1) break;
      pendingComment += `${css.slice(index, end + 2)}\n`;
      index = end + 2;
      continue;
    }

    const braceIndex = css.indexOf('{', index);
    const semiIndex = css.indexOf(';', index);
    if (braceIndex === -1 || (semiIndex !== -1 && semiIndex < braceIndex)) {
      // Blockless at-rule (@import/@charset) — keep at the top of base.
      const end = semiIndex === -1 ? css.length : semiIndex + 1;
      chunks.push({ bucket: 'base', text: pendingComment + css.slice(index, end) });
      pendingComment = '';
      index = end;
      continue;
    }

    const prelude = css.slice(index, braceIndex).trim();
    const closeIndex = findMatchingBrace(css, braceIndex);
    const body = css.slice(braceIndex + 1, closeIndex);
    const fullBlock = css.slice(index, closeIndex + 1);
    index = closeIndex + 1;

    if (/^@(media|supports)/.test(prelude)) {
      // Split the inner rules, then re-wrap each bucket's share in the query.
      const inner = splitRules(body);
      const byBucket = new Map();
      for (const chunk of inner) {
        if (!byBucket.has(chunk.bucket)) byBucket.set(chunk.bucket, []);
        byBucket.get(chunk.bucket).push(chunk.text);
      }
      let first = true;
      for (const bucket of BUCKET_ORDER) {
        if (!byBucket.has(bucket)) continue;
        const comment = first ? pendingComment : '';
        first = false;
        chunks.push({ bucket, text: `${comment}${prelude} {\n${byBucket.get(bucket).join('\n\n')}\n}` });
      }
      pendingComment = '';
      continue;
    }

    // @keyframes, @font-face, :root, html/body defaults: global by design.
    const bucket = prelude.startsWith('@') ? 'base' : classify(prelude);
    chunks.push({ bucket, text: pendingComment + fullBlock });
    pendingComment = '';
  }

  if (pendingComment) chunks.push({ bucket: 'base', text: pendingComment });
  return chunks;
}

function main() {
  const css = fs.readFileSync(SOURCE, 'utf8');
  const chunks = splitRules(css);
  const outputs = new Map(BUCKET_ORDER.map((bucket) => [bucket, []]));
  for (const chunk of chunks) outputs.get(chunk.bucket).push(chunk.text);

  const HEADERS = {
    base: 'Shared shell: variables, nav, buttons, landing, auth, settings, rankings, notifications. Loaded by every page, first.',
    battle: 'Battle surfaces: dungeon arena, demon cards, combat FX, fight log. Loaded by dungeon, world, collection, hunter and settings pages.',
    camp: 'Camp lobby and training. Loaded by camp.html only.',
    collection: 'Collection grid. Loaded by collection.html only.',
    world: 'Hunter world map, side panel, world team editor and world battle modal. Loaded by world.html only.'
  };

  let total = 0;
  for (const bucket of BUCKET_ORDER) {
    const file = path.join(CSS_DIR, `${bucket}.css`);
    const banner = `/* ${bucket}.css — split from main.css by scripts/split-main-css.js.\n   ${HEADERS[bucket]}\n   Edit these files directly; main.css no longer exists. */\n\n`;
    const body = outputs.get(bucket).join('\n\n');
    fs.writeFileSync(file, banner + body + '\n');
    total += body.length;
    console.log(`${bucket}.css: ${Math.round(body.length / 1024)}KB, ${outputs.get(bucket).length} chunks`);
  }
  console.log(`coverage: ${total} of ${css.length} source bytes redistributed`);
}

main();
