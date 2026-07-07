/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, module, process, require */

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withSentryConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
const enableSentryMetro =
  process.env.EXPO_PUBLIC_ENABLE_SENTRY_METRO === "true" &&
  Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = false;

module.exports = enableSentryMetro ? withSentryConfig(config) : config;
