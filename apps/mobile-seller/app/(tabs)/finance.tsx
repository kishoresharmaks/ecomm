import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, CollapsibleSection, EmptyState, Field, Header, LoadingState, Screen, StatusChip } from "../../src/components/screen";
import { getSellerPayoutAvailability, getSellerProfile, listSellerLedger, listSellerPayouts, listSellerStatements, requestSellerPayout } from "../../src/features/seller/seller-api";
import { sellerPayoutStatusLabel } from "../../src/features/seller/payout-flow";
import { formatMoney } from "../../src/lib/money";

export default function SellerFinanceScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  
  const profileQuery = useQuery({
    queryKey: ["seller-profile", auth.authKey],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
  });
  
  const availabilityQuery = useQuery({
    queryKey: ["seller-payout-availability", auth.authKey],
    queryFn: () => getSellerPayoutAvailability(auth.authHeaders),
    enabled: auth.enabled,
    refetchInterval: 60 * 1000,
  });
  const payoutsQuery = useQuery({
    queryKey: ["seller-payouts", auth.authKey],
    queryFn: () => listSellerPayouts(auth.authHeaders, { limit: 10 }),
    enabled: auth.enabled,
    refetchInterval: 60 * 1000,
  });
  const ledgerQuery = useQuery({
    queryKey: ["seller-ledger", auth.authKey],
    queryFn: () => listSellerLedger(auth.authHeaders, { limit: 5 }),
    enabled: auth.enabled,
  });
  const statementsQuery = useQuery({
    queryKey: ["seller-statements", auth.authKey],
    queryFn: () => listSellerStatements(auth.authHeaders, { limit: 5 }),
    enabled: auth.enabled,
  });
  const payoutMutation = useMutation({
    mutationFn: () => requestSellerPayout(auth.authHeaders, { ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: async () => {
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller-payout-availability", auth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["seller-payouts", auth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["seller-ledger", auth.authKey] }),
      ]);
    },
  });

  if (!auth.enabled || availabilityQuery.isLoading) {
    return <LoadingState message="Loading finance..." />;
  }

  const availability = availabilityQuery.data;
  const payoutProfile = profileQuery.data?.payoutProfile;
  return (
    <Screen>
      <Header title="Finance" subtitle="Track wallet ledger, payout availability, payout requests, and statements." />
      
      <CollapsibleSection title="Payout Details" defaultOpen>
        {payoutProfile ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Your saved payout details for manual payouts</Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "800" }}>Account holder</Text>
                <Text style={{ color: "#111827", fontSize: 13, fontWeight: "700" }}>{payoutProfile.accountHolderName ?? "Not set"}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "800" }}>Bank name</Text>
                <Text style={{ color: "#111827", fontSize: 13, fontWeight: "700" }}>{payoutProfile.bankName ?? "Not set"}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "800" }}>Account number</Text>
                <Text style={{ color: "#111827", fontSize: 13, fontWeight: "700" }}>{payoutProfile.maskedAccountNumber ?? "Not set"}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "800" }}>IFSC code</Text>
                <Text style={{ color: "#111827", fontSize: 13, fontWeight: "700" }}>{payoutProfile.ifscCode ?? "Not set"}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "800" }}>UPI ID</Text>
                <Text style={{ color: "#111827", fontSize: 13, fontWeight: "700" }}>{payoutProfile.maskedUpiId ?? "Not set"}</Text>
              </View>
              {payoutProfile.isVerified ? (
                <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "800" }}>✓ Verified by admin</Text>
              ) : (
                <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "800" }}>⚠ Pending verification</Text>
              )}
            </View>
            <Button tone="secondary" title="Update payout details" onPress={() => router.push("/(tabs)/profile" as Href)} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ color: "#6B7280", fontSize: 12 }}>Add payout details to enable manual payout requests</Text>
            <Button tone="secondary" title="Add payout details" onPress={() => router.push("/(tabs)/profile" as Href)} />
          </View>
        )}
      </CollapsibleSection>
      
      <Card>
        <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Available payout</Text>
        <Text style={{ color: "#111827", fontSize: 26, fontWeight: "900" }}>{formatMoney(availability?.netPayablePaise, availability?.currency ?? "INR")}</Text>
        {availability?.blockers?.map((blocker) => (
          <Text key={blocker} style={{ color: "#D64545", fontWeight: "800" }}>
            {blocker}
          </Text>
        ))}
        <Field label="Payout note" value={note} onChangeText={setNote} />
        <Button disabled={!availability?.canRequest || payoutMutation.isPending} title={payoutMutation.isPending ? "Requesting..." : "Request payout"} onPress={() => payoutMutation.mutate()} />
        {payoutMutation.data ? <StatusChip label={sellerPayoutStatusLabel(payoutMutation.data.status)} tone="warning" /> : null}
      </Card>
      <Card>
        <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Payout requests</Text>
        {payoutsQuery.data?.items.length ? (
          payoutsQuery.data.items.map((payout) => (
            <Text key={payout.id} style={{ color: "#6B7280", fontWeight: "800" }}>
              {payout.payoutNumber} - {sellerPayoutStatusLabel(payout.status)} - {formatMoney(payout.netPayablePaise, payout.currency ?? "INR")}
            </Text>
          ))
        ) : (
          <Text style={{ color: "#6B7280" }}>No payout requests yet.</Text>
        )}
      </Card>
      <Card>
        <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Recent ledger</Text>
        {ledgerQuery.data?.items.map((entry) => (
          <Text key={entry.id} style={{ color: "#6B7280", fontWeight: "700" }}>
            {entry.description ?? entry.entryType ?? "Ledger"} - {formatMoney(entry.amountPaise, entry.currency ?? "INR")}
          </Text>
        )) || <EmptyState title="No ledger entries" message="Paid/delivered seller order ledger entries will appear here." />}
      </Card>
      <Card>
        <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>Statements</Text>
        {statementsQuery.data?.items.length ? (
          statementsQuery.data.items.map((statement) => (
            <Text key={statement.id} style={{ color: "#6B7280", fontWeight: "700" }}>
              {statement.statementNumber ?? statement.id} - {statement.status ?? "GENERATED"}
            </Text>
          ))
        ) : (
          <Text style={{ color: "#6B7280" }}>No statements generated yet.</Text>
        )}
      </Card>
    </Screen>
  );
}
