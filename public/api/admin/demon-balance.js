const express = require('express');

const router = express.Router();

router.post('/admin/demon-balance', async (req, res) => {
  res.status(501).json({
    error: 'Balance editing is not implemented for the prototype. Edit public/api/data intentionally when this becomes an admin feature.'
  });
});

module.exports = router;
