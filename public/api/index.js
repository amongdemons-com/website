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

router.use(ensureSchema);

router.use(require('./auth/register'));
router.use(require('./auth/login'));
router.use(require('./auth/me'));
router.use(require('./account/progression'));
router.use(require('./demons/list'));
router.use(require('./demons/show'));
router.use(require('./demons/save'));
router.use(require('./runs/start'));
router.use(require('./runs/show'));
router.use(require('./runs/battle'));
router.use(require('./runs/reward'));
router.use(require('./runs/recruit'));
router.use(require('./runs/end'));
router.use(require('./game/demon-types'));
router.use(require('./game/demons'));
router.use(require('./leaderboard'));
router.use(require('./admin/demon-balance'));

router.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected API error.' });
});

module.exports = router;
