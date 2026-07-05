/* global module, process */

const sentryOrganization = process.env.SENTRY_ORG ?? process.env.EXPO_PUBLIC_SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT ?? process.env.EXPO_PUBLIC_SENTRY_PROJECT;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
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
    owner: "kishorekrishks",

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
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFCFB",
      },
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.CAMERA"
      ],
    },
    ios: {
      bundleIdentifier: "com.onehandindia.delivery",
      buildNumber: "1",
      supportsTablet: false,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["location", "remote-notification"],
      },
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ED3500",
          defaultChannel: "delivery-alerts",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow 1HandIndia Delivery to track active assigned deliveries for operational safety and support.",
          locationWhenInUsePermission:
            "Allow 1HandIndia Delivery to use your location while managing assigned deliveries.",
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true,
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
