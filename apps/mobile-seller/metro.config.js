/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, module, process, require */

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withSentryConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
const enableSentry = appEnv !== "development" || process.env.EXPO_PUBLIC_ENABLE_SENTRY === "true";

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = false;

module.exports = enableSentry ? withSentryConfig(config) : config;
