const express = require('express');
const { initializeSchema } = require('./lib/schema');

const router = express.Router();
let schemaReady;

function ensureSchema(req, res, next) {
  if (!schemaReady) {
    schemaReady = initializeSchema();
  }

  schemaReady
    .then(() => next())
    .catch((error) => {
      console.error('Database initialization failed:', error);
      res.status(500).json({ error: 'Database is unavailable.' });
    });
}

router.use(require('./game/demon-types'));
router.use(require('./game/demons'));

router.use(ensureSchema);

router.use(require('./auth/register'));
router.use(require('./auth/login'));
router.use(require('./auth/oauth'));
router.use(require('./auth/me'));
router.use(require('./account/profile'));
router.use(require('./account/progression'));
router.use(require('./account/stat-points'));
router.use(require('./account/quests'));
router.use(require('./demons/list'));
router.use(require('./demons/show'));
router.use(require('./demons/train'));
router.use(require('./runs/start'));
router.use(require('./runs/show'));
router.use(require('./runs/formation'));
router.use(require('./runs/battle'));
router.use(require('./runs/buff'));
router.use(require('./runs/reward'));
router.use(require('./runs/recruit'));
router.use(require('./runs/cashout'));
router.use(require('./runs/end'));
router.use(require('./world'));
router.use(require('./leaderboard'));
router.use(require('./hunters'));

router.use((error, req, res, next) => {
  console.error(error);
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'Unexpected API error.' : error.message });
});

module.exports = router;
