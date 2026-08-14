const RANKED_BOT_ID_PATTERN = 'ranked-bot:%';
const FEATURE_TEST_ACCOUNT_ID_PREFIX = 'ranked-bot:feature-test:';

function isFeatureTestAccountId(playerId) {
  return String(playerId || '').startsWith(FEATURE_TEST_ACCOUNT_ID_PREFIX);
}

module.exports = {
  FEATURE_TEST_ACCOUNT_ID_PREFIX,
  RANKED_BOT_ID_PATTERN,
  isFeatureTestAccountId
};
