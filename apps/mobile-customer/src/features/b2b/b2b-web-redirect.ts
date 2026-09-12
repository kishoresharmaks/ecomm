import { Linking } from "react-native";

const WEB_BASE = "https://www.1handindia.com";

export function openB2BWeb(path: string): void {
  const url = `${WEB_BASE}${path}`;
  Linking.openURL(url).catch(() => {
    // fallback: do nothing; user can manually open the browser
  });
}
