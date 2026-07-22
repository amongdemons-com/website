const express = require('express');
const {
  renderHunterOgFallbackImage,
  renderHunterOgImage
} = require('../../lib/hunter-og-image');
const { ensureSchemaReady } = require('./lib/schema');

const router = express.Router();
const FOUND_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const FALLBACK_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60';
router.get('/og/hunter/:username.png', async (req, res) => {
  try {
    await ensureSchemaReady();
    const result = await renderHunterOgImage(req.params.username);
    sendPng(res, result.png, result.found ? FOUND_CACHE_CONTROL : FALLBACK_CACHE_CONTROL);
  } catch (error) {
    console.error('Failed to render hunter OG image:', error);

    try {
      const png = await renderHunterOgFallbackImage(req.params.username);
      sendPng(res, png, 'no-store');
    } catch (fallbackError) {
      console.error('Failed to render hunter OG fallback image:', fallbackError);
      res.status(500).json({ error: 'Unable to render image.' });
    }
  }
});

function sendPng(res, png, cacheControl) {
  res
    .status(200)
    .set({
      'Cache-Control': cacheControl,
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff'
    })
    .send(png);
}

module.exports = router;
