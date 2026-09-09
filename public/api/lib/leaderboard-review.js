function isLeaderboardReviewPlayer(player) {
  return Boolean(
    player
    && typeof player === 'object'
    && (player.leaderboardExcluded === true || Number(player.leaderboardExcluded) === 1)
  );
}

module.exports = {
  isLeaderboardReviewPlayer
};
