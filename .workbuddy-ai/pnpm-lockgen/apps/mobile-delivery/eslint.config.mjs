import config from "@indihub/eslint-config";

export default [
  ...config,
  {
    ignores: [".expo/**", ".expo-test-export/**", "babel.config.js"],
  },
];
