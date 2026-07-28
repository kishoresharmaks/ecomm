const fs = require("node:fs");

const originalUnlinkSync = fs.unlinkSync;
fs.unlinkSync = function unlinkSyncWithoutPnpmTempCleanup(path, ...args) {
  if (String(path).includes("_tmp_")) return;
  return originalUnlinkSync.call(this, path, ...args);
};
