const fs = require('node:fs');

// Replace the directory entry instead of truncating an image that Windows may
// have memory-mapped for a thumbnail or active preview.
function writeAsset(file, data) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, data);
  fs.renameSync(temporary, file);
}
module.exports = writeAsset;
