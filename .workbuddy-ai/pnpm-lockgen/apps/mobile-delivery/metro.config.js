/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, module, process, require */

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withSentryConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
const sentryOrganization = process.env.SENTRY_ORG ?? process.env.EXPO_PUBLIC_SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT ?? process.env.EXPO_PUBLIC_SENTRY_PROJECT;
const enableSentry = Boolean(sentryOrganization && sentryProject && process.env.SENTRY_AUTH_TOKEN);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = false;

module.exports = enableSentry ? withSentryConfig(config) : config;
