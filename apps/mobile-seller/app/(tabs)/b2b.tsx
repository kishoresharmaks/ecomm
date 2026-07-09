import { Chat01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Screen } from "../../src/components/screen";

export default function B2BTabScreen() {
  return (
    <Screen contentContainerStyle={{ gap: 16 }}>
      <Header title="B2B" subtitle="Manage business buyer interactions." />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <HugeiconsIcon icon={Chat01Icon} size={24} color="#ED3500" style={{ marginRight: 12 }} />
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>B2B Enquiries</Text>
          </View>
          <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 12 }}>
            View and respond to business buyer quotation requests.
          </Text>
          <Button
            title="View Enquiries"
            onPress={() => router.push("/b2b-enquiries" as Href)}
          />
        </Card>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <HugeiconsIcon icon={ShoppingBag01Icon} size={24} color="#ED3500" style={{ marginRight: 12 }} />
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>B2B Orders</Text>
          </View>
          <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 12 }}>
            Track approved purchase orders and fulfilment status.
          </Text>
          <Button
            title="View Orders"
            onPress={() => router.push("/b2b-orders" as Href)}
          />
        </Card>
    </Screen>
  );
}
