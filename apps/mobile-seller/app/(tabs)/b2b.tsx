import { Chat01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Screen } from "../../src/components/screen";
import { SellerHubHandoffButton } from "../../src/components/seller-hub-handoff-button";
import { sellerPortalB2BEnquiriesUrl, sellerPortalB2BOrdersUrl } from "../../src/features/seller/b2b-navigation";

export default function B2BTabScreen() {
  return (
    <Screen contentContainerStyle={{ gap: 16 }}>
      <Header title="B2B" subtitle="Manage business buyer interactions." />
        <Card>
          <Text style={{ color: "#ED3500", fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Available in app</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <HugeiconsIcon icon={Chat01Icon} size={24} color="#ED3500" style={{ marginRight: 12 }} />
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>B2B Enquiries</Text>
          </View>
          <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 12 }}>
            View and respond to business buyer quotation requests.
          </Text>
          <Button
            title="View enquiries in app"
            onPress={() => router.push("/b2b-enquiries" as Href)}
          />
          <View style={{ height: 1, backgroundColor: "#F3E7E2" }} />
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Detailed quotation and negotiation tools open securely in Seller Hub.</Text>
          <SellerHubHandoffButton
            buttonTitle="Open full enquiry workspace"
            title="Open B2B enquiries in Seller Hub?"
            message="Use Seller Hub for detailed quotations, negotiation messages, and complete enquiry history. Sign in with the same seller account to continue."
            url={sellerPortalB2BEnquiriesUrl()}
          />
        </Card>
        <Card>
          <Text style={{ color: "#ED3500", fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Available in app</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <HugeiconsIcon icon={ShoppingBag01Icon} size={24} color="#ED3500" style={{ marginRight: 12 }} />
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>B2B Orders</Text>
          </View>
          <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 12 }}>
            Track approved purchase orders and fulfilment status.
          </Text>
          <Button
            title="View orders in app"
            onPress={() => router.push("/b2b-orders" as Href)}
          />
          <View style={{ height: 1, backgroundColor: "#F3E7E2" }} />
          <Text style={{ color: "#6B7280", fontSize: 12 }}>Operational actions open the exact order in Seller Hub.</Text>
          <SellerHubHandoffButton
            buttonTitle="Open full order workspace"
            title="Open B2B orders in Seller Hub?"
            message="Use Seller Hub for fulfilment planning, procurement, warehouse, QC, invoicing, shipment, and dispatch actions."
            url={sellerPortalB2BOrdersUrl()}
          />
        </Card>
    </Screen>
  );
}
