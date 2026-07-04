import { useAuth } from "@clerk/clerk-expo";
import { Stack } from "expo-router";
import { Text } from "react-native";
import { Button, Card, Screen } from "../src/components/screen";
import { webBaseUrl } from "../src/lib/api";
import * as Linking from "expo-linking";

export default function AccessBlockedScreen() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Access pending" }} />
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 24, fontWeight: "900" }}>Delivery approval required</Text>
        <Text style={{ color: "#6B7280", lineHeight: 20 }}>
          This app is only for approved 1HandIndia delivery partners. Register or wait for admin approval, then sign in again.
        </Text>
        <Button title="Register on website" onPress={() => void Linking.openURL(`${webBaseUrl()}/delivery/register`)} />
        <Button title="Sign out" tone="secondary" onPress={() => void signOut()} />
      </Card>
    </Screen>
  );
}

