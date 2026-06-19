/* eslint-disable @typescript-eslint/no-require-imports */
/* global module, process, require */

const fs = require("node:fs");

const sentryOrganization = process.env.SENTRY_ORG ?? process.env.EXPO_PUBLIC_SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT ?? process.env.EXPO_PUBLIC_SENTRY_PROJECT;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "beab5054-3e1d-46a5-aeb0-11767e1bbdb0";
const androidGoogleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);
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
    name: "1HandIndia",
    slug: "onehandindia-customer",
    scheme: "onehandindia",
    version: "0.1.1",
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
      package: "com.onehandindia.customer",
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host: "1handindia.com", pathPrefix: "/stores" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/stores" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/store" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/store" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/product" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/product" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/products" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/products" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/category" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/category" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/categories" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/categories" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/orders" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/orders" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/checkout/success" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/checkout/success" },
            { scheme: "https", host: "1handindia.com", pathPrefix: "/track-order" },
            { scheme: "https", host: "www.1handindia.com", pathPrefix: "/track-order" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFCFB",
      },
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
    ios: {
      bundleIdentifier: "com.onehandindia.customer",
      buildNumber: "2",
      supportsTablet: true,
      associatedDomains: ["applinks:1handindia.com", "applinks:www.1handindia.com"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserNotificationsUsageDescription:
          "Allow 1HandIndia to send you order updates, deal alerts, and promotional notifications.",
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          color: "#ED3500",
          defaultChannel: "customer-alerts",
        },
      ],
      ...sentryPlugin,
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Allow 1HandIndia to use your location to help fill delivery addresses.",
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
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
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
    owner: "kishorekrishks",
  },
};
