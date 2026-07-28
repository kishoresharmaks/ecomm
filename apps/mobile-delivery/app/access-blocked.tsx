import { useAuth } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { mobileDeliveryAuthErrorMessage } from "../src/auth/mobile-delivery-auth-context";
import { Button, Card, Screen } from "../src/components/screen";
import { revokeCurrentDeliveryPushToken } from "../src/features/delivery/use-delivery-push-notifications";
import { webBaseUrl } from "../src/lib/api";
import * as Linking from "expo-linking";

export default function AccessBlockedScreen() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);

  const checkAccess = async () => {
    setCheckingAccess(true);
    try {
      await queryClient.refetchQueries({ queryKey: ["delivery-access"], type: "active" });
    } finally {
      setCheckingAccess(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await revokeCurrentDeliveryPushToken();
      await signOut();
    } catch (error) {
      setSignOutError(mobileDeliveryAuthErrorMessage(error));
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <Screen onRefresh={checkAccess} refreshing={checkingAccess}>
      <Stack.Screen options={{ headerShown: true, title: "Access pending" }} />
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 24, fontWeight: "900" }}>Delivery approval required</Text>
        <Text style={{ color: "#6B7280", lineHeight: 20 }}>
          This app is only for approved 1HandIndia delivery partners. Register or wait for approval, then check again.
        </Text>
        <Button title="Register on website" onPress={() => void Linking.openURL(`${webBaseUrl()}/delivery/register`)} />
        <Button title="Check approval" loading={checkingAccess} onPress={() => void checkAccess()} />
        {signOutError ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{signOutError}</Text> : null}
        <Button title="Sign out" tone="secondary" loading={signingOut} onPress={() => void handleSignOut()} />
      </Card>
    </Screen>
  );
}
