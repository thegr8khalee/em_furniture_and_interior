const { join } = require('path');

// Render wipes the default ~/.cache between deploys, so puppeteer's download is
// gone by the time the app starts. Keeping the browser inside the project means
// it ships with the build artifact instead.
//
// This lives at the repository root, not in apps/api: npm workspaces hoist
// puppeteer to the root node_modules and run install from the root, so a config
// file inside the workspace is never read.
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
