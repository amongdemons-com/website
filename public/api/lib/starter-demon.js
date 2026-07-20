const { createDemon } = require('./demon-factory');
const { createRng } = require('./rng');
const { saveCollectionDemon } = require('./collection-demons');

const STARTER_TYPE_IDS = [1, 2];
const STARTER_RARITY = 'common';

// Every new hunter — guest or registered — starts with one common demon of each
// starter type so the collection, world team, and dungeon are immediately
// playable instead of opening on an empty roster. Best-effort: a starter
// failure must never block account creation, so callers wrap this and swallow
// errors.
async function grantStarterDemons(playerId, queryable = undefined) {
  if (!playerId) return [];

  const granted = [];
  for (const typeId of STARTER_TYPE_IDS) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    const rng = createRng(seed);
    const demon = await createDemon(rng, { typeId, rarity: STARTER_RARITY });
    const saved = queryable
      ? await saveCollectionDemon(playerId, demon, queryable)
      : await saveCollectionDemon(playerId, demon);
    granted.push(saved.demon);
  }

  return granted;
}

module.exports = { STARTER_RARITY, STARTER_TYPE_IDS, grantStarterDemons };
