const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Handle beautified URL: /demons/type/:type
app.get('/demons/type/:type', (req, res) => {
  const pageType = req.params.type.toString();
  
  if (!pageType.match(/^\d+$/)) {
    return res.status(400).send('Invalid type parameter. Must be a number.');
  }
  
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/', (req, res) => {
  // If no type parameter is present, redirect to /demons/type/1
  if (!req.query.type) {
    return res.redirect(302, '/demons/type/1');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

app.use(express.static('public'));