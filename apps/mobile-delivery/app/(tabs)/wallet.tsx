import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Header, Metric, QueryState, Screen, StatusChip, formatDateTime, formatPaise, humanize } from "../../src/components/screen";
import { getDeliveryProfile, getDeliveryWallet, requestDeliveryWalletPayout } from "../../src/features/delivery/delivery-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

export default function DeliveryWalletScreen() {
  const auth = useMobileDeliveryAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const walletQuery = useQuery({
    queryKey: ["delivery-wallet", auth.authKey],
    queryFn: () => getDeliveryWallet(auth.authHeaders, { limit: 50 }),
    enabled: auth.enabled,
  });
  const profileQuery = useQuery({
    queryKey: ["delivery-profile", auth.authKey, "wallet"],
    queryFn: () => getDeliveryProfile(auth.authHeaders),
    enabled: auth.enabled,
  });
  const payoutMutation = useMutation({
    mutationFn: () => requestDeliveryWalletPayout(auth.authHeaders, note.trim() || undefined),
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["delivery-wallet"] });
    },
  });
  const summary = walletQuery.data?.summary;

  return (
    <Screen>
      <Header title="Wallet" subtitle="Local delivery earnings and manual payout requests." />
      <QueryState loading={walletQuery.isLoading} error={walletQuery.error} onRetry={() => void walletQuery.refetch()} />
      <QueryState loading={false} error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Metric label="Available" value={formatPaise(summary?.availableBalancePaise ?? 0, summary?.currency ?? "INR")} />
        <Metric label="Earned" value={formatPaise(summary?.totalEarnedPaise ?? 0, summary?.currency ?? "INR")} />
        <Metric label="Pending payout" value={formatPaise(summary?.pendingPayoutPaise ?? 0, summary?.currency ?? "INR")} />
        <Metric label="Threshold" value={formatPaise(summary?.minimumPayoutPaise ?? 0, summary?.currency ?? "INR")} />
      </View>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>COD handover</Text>
        {profileQuery.data?.deliveryProfile.razorpayVirtualUpiId ? (
          <>
            <Text selectable style={{ color: "#ED3500", fontSize: 18, fontWeight: "900", marginTop: 8 }}>
              {profileQuery.data.deliveryProfile.razorpayVirtualUpiId}
            </Text>
            <Text style={{ color: "#6B7280", marginTop: 8 }}>
              Deposit collected COD here to reduce COD exposure automatically after Razorpay confirms the transfer.
            </Text>
          </>
        ) : (
          <Text style={{ color: "#6B7280", marginTop: 8 }}>COD handover UPI is not available yet.</Text>
        )}
      </Card>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>Request payout</Text>
        <Text style={{ color: "#6B7280" }}>
          Active requests: {summary?.activePayoutRequestCount ?? 0}. Requests are available only after the admin-set threshold.
        </Text>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional payout note" multiline />
        {payoutMutation.error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{payoutMutation.error.message}</Text> : null}
        {payoutMutation.isSuccess ? <StatusChip label="Payout request sent" tone="success" /> : null}
        <Button title="Request payout" disabled={!summary?.canRequestPayout} loading={payoutMutation.isPending} onPress={() => payoutMutation.mutate()} />
      </Card>
      <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>Ledger</Text>
      {(walletQuery.data?.items ?? []).map((entry) => (
        <Card key={entry.id}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#123A5A", flex: 1, fontWeight: "900" }}>{humanize(entry.entryType)}</Text>
            <StatusChip label={entry.direction} tone={entry.direction === "CREDIT" ? "success" : "warning"} />
          </View>
          <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>{formatPaise(entry.amountPaise, entry.currency)}</Text>
          <Text style={{ color: "#6B7280" }}>{entry.description ?? formatDateTime(entry.createdAt)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
