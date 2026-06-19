/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports */

const { withDangerousMod, withInfoPlist } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PROGUARD_RULES = [
  "-keepattributes *Annotation*",
  "-dontwarn com.razorpay.**",
  "-keep class com.razorpay.** {*;}",
  "-optimizations !method/inlining/",
  "-keepclasseswithmembers class * { public void onPayment*(...); }",
];

const UPI_SCHEMES = ["tez", "phonepe", "paytmmp"];

function withRazorpayNativeConfig(config) {
  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const proguardPath = path.join(modConfig.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const existing = fs.existsSync(proguardPath) ? fs.readFileSync(proguardPath, "utf8") : "";
      const missingRules = PROGUARD_RULES.filter((rule) => !existing.includes(rule));

      if (missingRules.length > 0) {
        const nextContent = `${existing.trimEnd()}\n\n# Razorpay Checkout release-mode protection\n${missingRules.join("\n")}\n`;
        fs.writeFileSync(proguardPath, nextContent);
      }

      return modConfig;
    },
  ]);

  config = withInfoPlist(config, (modConfig) => {
    const current = Array.isArray(modConfig.modResults.LSApplicationQueriesSchemes)
      ? modConfig.modResults.LSApplicationQueriesSchemes
      : [];
    modConfig.modResults.LSApplicationQueriesSchemes = Array.from(new Set([...current, ...UPI_SCHEMES]));
    return modConfig;
  });

  return config;
}

module.exports = withRazorpayNativeConfig;
