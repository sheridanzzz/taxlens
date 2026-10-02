const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// The ATO rules (tax-calculator, depreciation, constants…) are imported
// straight from the web app's src/lib via the @shared alias, so there's one
// copy of every rate and threshold. Metro only bundles files it watches.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, "../src/lib")];

module.exports = config;
