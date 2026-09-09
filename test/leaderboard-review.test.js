const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(...segments) {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

test('leaderboard exclusion is driven by the player database flag', () => {
  const review = require(path.join(ROOT, 'public', 'api', 'lib', 'leaderboard-review'));
  const leaderboard = require(path.join(ROOT, 'public', 'api', 'leaderboard'));
  const filter = leaderboard._test.getLeaderboardVisibilityFilter();

  assert.equal(review.isLeaderboardReviewPlayer({ leaderboardExcluded: true }), true);
  assert.equal(review.isLeaderboardReviewPlayer({ leaderboardExcluded: 1 }), true);
  assert.equal(review.isLeaderboardReviewPlayer({ leaderboardExcluded: false }), false);
  assert.equal(review.isLeaderboardReviewPlayer({ username: 'Morvanor' }), false);
  assert.match(filter.sql, /p\.leaderboard_excluded = 0/);
  assert.deepEqual(filter.params, ['ranked-bot:%']);
  assert.match(read('public', 'api', 'lib', 'schema.js'), /leaderboard_excluded TINYINT\(1\) NOT NULL DEFAULT 0/);
  assert.match(read('public', 'api', 'lib', 'schema.js'), /\['morvanor'\]/);
});

test('Camp privately notifies reviewed players once per browser', () => {
  const bootstrap = read('public', 'api', 'bootstrap.js');
  const campHtml = read('public', 'app', 'camp.html');
  const campSource = read('public', 'app', 'js', 'camp-ui.js');

  assert.match(bootstrap, /leaderboardReview: isLeaderboardReviewPlayer\(req\.player\)/);
  assert.match(campHtml, /id="leaderboardReviewModal"/);
  assert.match(campHtml, /Your leaderboard eligibility is temporarily under review due to unusual activity patterns\./);
  assert.match(campHtml, /You can continue using the game normally, but your account may not appear in public leaderboards during the review\./);
  assert.match(campSource, /LEADERBOARD_REVIEW_NOTICE_SEEN_KEY/);
  assert.match(campSource, /showLeaderboardReviewNotice\(\);/);
  assert.match(campSource, /localStorage\.getItem\(LEADERBOARD_REVIEW_NOTICE_SEEN_KEY\)/);
  assert.match(campSource, /modal\.getOrCreateInstance\(elements\.leaderboardReviewModal\)\.show\(\)/);
});
