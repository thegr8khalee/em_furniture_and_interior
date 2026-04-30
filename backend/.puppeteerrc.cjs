const { join } = require('path');

// Render wipes the default ~/.cache between deploys, so puppeteer's postinstall
// download is gone by the time the app starts. Put the browser inside the
// project so it ships with the build artifact.
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
