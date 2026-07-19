/* eslint-disable @typescript-eslint/no-require-imports */
/* global module, process, require */

const fs = require("node:fs");

const sentryOrganization = process.env.SENTRY_ORG ?? process.env.EXPO_PUBLIC_SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT ?? process.env.EXPO_PUBLIC_SENTRY_PROJECT;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "e77779de-aa9a-447c-a0eb-91802cf2deb0";
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
          "@sentry/react-native/expo",
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
    owner: "onehandindiasteam",
    name: "1HandIndia Delivery",
    slug: "onehandindia-delivery",
    scheme: "onehandindia-delivery",
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
      package: "com.onehandindia.delivery",
      versionCode: 1,
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFCFB",
      },
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.CAMERA"
      ],
      blockedPermissions: [
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE_LOCATION"
      ],
    },
    ios: {
      bundleIdentifier: "com.onehandindia.delivery",
      buildNumber: "1",
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserNotificationsUsageDescription:
          "Allow 1HandIndia Delivery to send assigned-order, return pickup, COD, and route alerts.",
        UIBackgroundModes: ["remote-notification"],
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#ED3500",
          defaultChannel: "delivery-alerts",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow 1HandIndia Delivery to use your location while managing assigned deliveries.",
          isAndroidBackgroundLocationEnabled: false,
          isIosBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Allow 1HandIndia Delivery to choose delivery proof images.",
          cameraPermission: "Allow 1HandIndia Delivery to capture delivery proof photos.",
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
      ...sentryPlugin,
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  },
};
