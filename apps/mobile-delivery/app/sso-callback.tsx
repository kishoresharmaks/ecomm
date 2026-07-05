import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Text } from "react-native";
import { Card, Screen } from "../src/components/screen";

WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    router.replace(isSignedIn ? "/" : "/auth/sign-in");
  }, [isLoaded, isSignedIn]);

  return (
    <Screen>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 20, fontWeight: "900" }}>Completing sign in...</Text>
        <Text style={{ color: "#6B7280" }}>Taking you back to delivery workspace.</Text>
      </Card>
    </Screen>
  );
}
