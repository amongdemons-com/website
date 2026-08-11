const { addEcho } = require('./echo-bag');

const STARTER_ECHO_TYPE_ID = 3;
const STARTER_ECHO_RARITY = 'common';

async function grantStarterEcho(playerId, queryable = undefined) {
  if (!playerId) return null;
  return addEcho(playerId, {
    typeId: STARTER_ECHO_TYPE_ID,
    rarity: STARTER_ECHO_RARITY
  }, {
    ...(queryable ? { queryable } : {}),
    natural: true
  });
}

module.exports = {
  STARTER_ECHO_RARITY,
  STARTER_ECHO_TYPE_ID,
  grantStarterEcho
};
