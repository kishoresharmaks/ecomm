/* eslint-disable @typescript-eslint/no-require-imports */
/* global module, process, require */

const fs = require("node:fs");

const sentryOrganization = process.env.SENTRY_ORG ?? process.env.EXPO_PUBLIC_SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT ?? process.env.EXPO_PUBLIC_SENTRY_PROJECT;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "6cf13828-ce64-4e04-aadf-cfd59256a3db";
const apsEnvironment = process.env.EXPO_PUBLIC_APP_ENV === "production" ? "production" : "development";
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync("./google-services.json")
    ? "./google-services.json"
    : fs.existsSync("./android/app/google-services.json")
      ? "./android/app/google-services.json"
      : undefined);
const sentryPlugin =
  sentryOrganization && sentryProject
    ? [
        [
          "@sentry/react-native",
          {
            organization: sentryOrganization,
            project: sentryProject,
            url: "https://sentry.io/",
          },
        ],
      ]
    : [];

module.exports = {
  expo: {
    name: "1HandIndia Seller",
    slug: "onehandindia-seller",
    owner: "onehandindiasteam",
    scheme: "onehandindia-seller",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    backgroundColor: "#FFFCFB",
    primaryColor: "#ED3500",
    splash: {
      image: "./assets/splash-logo.png",
      resizeMode: "contain",
      backgroundColor: "#FFFCFB",
    },
    android: {
      package: "com.onehandindia.seller",
      versionCode: 1,
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFCFB",
      },
      permissions: ["android.permission.POST_NOTIFICATIONS"],
    },
    ios: {
      bundleIdentifier: "com.onehandindia.seller",
      buildNumber: "1",
      supportsTablet: true,
      entitlements: {
        "aps-environment": apsEnvironment,
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserNotificationsUsageDescription:
          "Allow 1HandIndia Seller to send you new order, B2B enquiry, subscription, and payout alerts.",
        UIBackgroundModes: ["remote-notification"],
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#ED3500",
          defaultChannel: "seller-alerts",
        },
      ],
      "./plugins/with-razorpay-native-config",
      ...sentryPlugin,
      [
        "expo-image-picker",
        {
          photosPermission: "Allow 1HandIndia Seller to choose product and store images.",
          cameraPermission: "Allow 1HandIndia Seller to capture product and store images.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-logo.png",
          imageWidth: 280,
          resizeMode: "contain",
          backgroundColor: "#FFFCFB",
        },
      ],
      "expo-sharing",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  },
};
