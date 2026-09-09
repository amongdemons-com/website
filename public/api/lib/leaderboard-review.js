const DEFAULT_LEADERBOARD_REVIEW_USERNAMES = ['Morvanor'];

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function getConfiguredReviewUsernames() {
  const configured = process.env.LEADERBOARD_REVIEW_USERNAMES;
  const values = configured === undefined
    ? DEFAULT_LEADERBOARD_REVIEW_USERNAMES
    : configured.split(',');

  return [...new Set(values.map(normalizeUsername).filter(Boolean))];
}

const LEADERBOARD_REVIEW_USERNAMES = new Set(getConfiguredReviewUsernames());

function isLeaderboardReviewPlayer(player) {
  return LEADERBOARD_REVIEW_USERNAMES.has(normalizeUsername(
    typeof player === 'string' ? player : player?.username
  ));
}

function getLeaderboardReviewUsernames() {
  return [...LEADERBOARD_REVIEW_USERNAMES];
}

module.exports = {
  getLeaderboardReviewUsernames,
  isLeaderboardReviewPlayer
};
