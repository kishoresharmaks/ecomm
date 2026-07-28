import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  Card,
  CollapsibleSection,
  Field,
  Header,
  LoadingState,
  QueryErrorState,
  Screen,
  StatusChip,
  Toast,
} from "../../src/components/screen";
import {
  getSellerPayoutAvailability,
  getSellerProfile,
  listSellerLedger,
  listSellerPayouts,
  listSellerStatements,
  requestSellerPayout,
} from "../../src/features/seller/seller-api";
import {
  sellerLedgerAmount,
  sellerPayoutStatusLabel,
} from "../../src/features/seller/payout-flow";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

type ToastState = {
  visible: boolean;
  message: string;
  type: "success" | "error";
};

export default function SellerFinanceScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

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
    queryFn: () => listSellerPayouts(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled,
    refetchInterval: 60 * 1000,
  });
  const ledgerQuery = useQuery({
    queryKey: ["seller-ledger", auth.authKey],
    queryFn: () => listSellerLedger(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled,
  });
  const statementsQuery = useQuery({
    queryKey: ["seller-statements", auth.authKey],
    queryFn: () => listSellerStatements(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled,
  });
  const payoutMutation = useMutation({
    mutationFn: () =>
      requestSellerPayout(auth.authHeaders, {
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: async () => {
      setNote("");
      setToast({
        visible: true,
        message: "Payout request submitted for finance approval.",
        type: "success",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["seller-payout-availability", auth.authKey],
        }),
        queryClient.invalidateQueries({
          queryKey: ["seller-payouts", auth.authKey],
        }),
        queryClient.invalidateQueries({
          queryKey: ["seller-ledger", auth.authKey],
        }),
      ]);
    },
    onError: (error: Error) => {
      setToast({
        visible: true,
        message: error.message || "The payout request could not be submitted.",
        type: "error",
      });
    },
  });

  const dismissToast = useCallback(
    () => setToast((current) => ({ ...current, visible: false })),
    [],
  );
  const refreshAll = useCallback(async () => {
    await Promise.all([
      profileQuery.refetch(),
      availabilityQuery.refetch(),
      payoutsQuery.refetch(),
      ledgerQuery.refetch(),
      statementsQuery.refetch(),
    ]);
  }, [
    availabilityQuery,
    ledgerQuery,
    payoutsQuery,
    profileQuery,
    statementsQuery,
  ]);
  const refreshing =
    profileQuery.isRefetching ||
    availabilityQuery.isRefetching ||
    payoutsQuery.isRefetching ||
    ledgerQuery.isRefetching ||
    statementsQuery.isRefetching;

  if (!auth.enabled || availabilityQuery.isLoading) {
    return <LoadingState message="Loading finance..." />;
  }

  if (availabilityQuery.isError && !availabilityQuery.data) {
    return (
      <Screen>
        <Header
          title="Finance"
          subtitle="Track wallet, payout availability, payout requests, and statements."
        />
        <QueryErrorState
          title="Finance could not be loaded"
          message={errorMessage(availabilityQuery.error)}
          onRetry={() => void availabilityQuery.refetch()}
          retrying={availabilityQuery.isFetching}
        />
      </Screen>
    );
  }

  const availability = availabilityQuery.data;
  const payoutProfile = profileQuery.data?.payoutProfile;
  const currency = availability?.currency ?? "INR";

  return (
    <Screen
      contentContainerStyle={styles.content}
      refreshing={refreshing}
      onRefresh={() => void refreshAll()}
    >
      <Header
        title="Finance"
        subtitle="Track wallet, payout availability, payout requests, and statements."
      />

      <Card style={styles.wallet}>
        <Text style={styles.eyebrow}>Available now</Text>
        <Text style={styles.walletAmount}>
          {formatMoney(availability?.netPayablePaise, currency)}
        </Text>
        <View style={styles.metricGrid}>
          <FinanceMetric
            label="Eligible activity"
            value={String(
              (availability?.eligibleSplitCount ?? 0) +
                (availability?.eligibleB2BOrderCount ?? 0) +
                (availability?.eligibleServiceSettlementCount ?? 0),
            )}
          />
          <FinanceMetric
            label="Pending payouts"
            value={formatMoney(availability?.pendingPayoutsPaise, currency)}
          />
          <FinanceMetric
            label="Paid payouts"
            value={formatMoney(availability?.paidPayoutsPaise, currency)}
          />
          <FinanceMetric
            label="Minimum request"
            value={formatMoney(availability?.minimumPayoutPaise, currency)}
          />
        </View>
        {(availability?.sellerCashReceivableOutstandingPaise ?? 0) > 0 ? (
          <View style={styles.warningBand}>
            <Text style={styles.warningTitle}>
              Seller-collected COD platform due
            </Text>
            <Text style={styles.warningValue}>
              {formatMoney(
                availability?.sellerCashReceivableOutstandingPaise,
                currency,
              )}
            </Text>
            <Text style={styles.muted}>
              {formatMoney(
                availability?.sellerCashReceivableOffsetPaise,
                currency,
              )}{" "}
              will be deducted from the next eligible payout.
            </Text>
          </View>
        ) : null}
      </Card>

      <CollapsibleSection title="Payout details" defaultOpen>
        {profileQuery.isLoading ? (
          <Text style={styles.muted}>Loading saved payout details...</Text>
        ) : profileQuery.isError ? (
          <View style={styles.stack}>
            <Text style={styles.errorText}>
              Saved payout details could not be loaded.
            </Text>
            <Button
              tone="secondary"
              title="Retry"
              onPress={() => void profileQuery.refetch()}
            />
          </View>
        ) : payoutProfile ? (
          <View style={styles.stack}>
            <DetailRow
              label="Account holder"
              value={payoutProfile.accountHolderName ?? "Not set"}
            />
            <DetailRow
              label="Bank"
              value={payoutProfile.bankName ?? "Not set"}
            />
            <DetailRow
              label="Account"
              value={payoutProfile.maskedAccountNumber ?? "Not set"}
            />
            <DetailRow
              label="IFSC"
              value={payoutProfile.ifscCode ?? "Not set"}
            />
            <DetailRow
              label="UPI"
              value={payoutProfile.maskedUpiId ?? "Not set"}
            />
            <StatusChip
              label={
                payoutProfile.isVerified
                  ? "Verified by finance"
                  : "Verification pending"
              }
              tone={payoutProfile.isVerified ? "success" : "warning"}
            />
            <Button
              tone="secondary"
              title="Update payout details"
              onPress={() => router.push("/(tabs)/profile" as Href)}
            />
          </View>
        ) : (
          <View style={styles.stack}>
            <Text style={styles.muted}>
              Add a bank account or UPI ID before requesting a payout.
            </Text>
            <Button
              tone="secondary"
              title="Add payout details"
              onPress={() => router.push("/(tabs)/profile" as Href)}
            />
          </View>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Payout calculation" defaultOpen>
        <DetailRow label="Gross eligible earnings" value={formatMoney(availability?.grossSalesPaise, currency)} />
        <DetailRow label="Marketplace commission" value={formatMoney(-(availability?.commissionPaise ?? 0), currency)} />
        <DetailRow label="GST on marketplace fees" value={formatMoney(-(availability?.gstOnCommissionPaise ?? 0), currency)} />
        <DetailRow label="TDS" value={formatMoney(-(availability?.tdsPaise ?? 0), currency)} />
        <DetailRow label="TCS" value={formatMoney(-(availability?.tcsPaise ?? 0), currency)} />
        <DetailRow label="Seller settlement fee" value={formatMoney(-(availability?.platformFeePaise ?? 0), currency)} />
        <DetailRow label="Refund adjustment" value={formatMoney(availability?.refundAdjustmentPaise, currency)} />
        <DetailRow label="Service cash offset" value={formatMoney(-(availability?.serviceReceivableOffsetPaise ?? 0), currency)} />
        <DetailRow label="Seller-collected COD offset" value={formatMoney(-(availability?.sellerCashReceivableOffsetPaise ?? 0), currency)} />
        <DetailRow label="Prior wallet debt offset" value={formatMoney(-(availability?.ledgerDebtOffsetPaise ?? 0), currency)} />
        <DetailRow label="Net request amount" value={formatMoney(availability?.netPayablePaise, currency)} />
      </CollapsibleSection>

      <Card>
        <Text style={styles.sectionTitle}>Request payout</Text>
        {availability?.blockers?.length ? (
          <View style={styles.stack}>
            {availability.blockers.map((blocker) => (
              <Text key={blocker} style={styles.errorText}>
                {blocker}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>
            The full eligible amount will be locked into one payout request.
          </Text>
        )}
        <Field
          label="Note for finance"
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
        />
        <Button
          disabled={!availability?.canRequest || payoutMutation.isPending}
          title={payoutMutation.isPending ? "Requesting..." : "Request payout"}
          onPress={() => payoutMutation.mutate()}
        />
        {payoutMutation.data ? (
          <StatusChip
            label={sellerPayoutStatusLabel(payoutMutation.data.status)}
            tone="warning"
          />
        ) : null}
      </Card>

      {payoutsQuery.isError ? (
        <QueryErrorState
          title="Payout history could not be loaded"
          message={errorMessage(payoutsQuery.error)}
          onRetry={() => void payoutsQuery.refetch()}
          retrying={payoutsQuery.isFetching}
        />
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>Payout history</Text>
          {payoutsQuery.isLoading ? (
            <Text style={styles.muted}>Loading payout requests...</Text>
          ) : payoutsQuery.data?.items.length ? (
            payoutsQuery.data.items.map((payout) => (
              <View key={payout.id} style={styles.historyRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{payout.payoutNumber}</Text>
                  <Text style={styles.muted}>
                    {formatDate(payout.createdAt)}
                  </Text>
                </View>
                <View style={styles.rowValue}>
                  <Text style={styles.amount}>
                    {formatMoney(
                      payout.netPayablePaise,
                      payout.currency ?? currency,
                    )}
                  </Text>
                  <Text style={styles.muted}>
                    {sellerPayoutStatusLabel(payout.status)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No payout requests yet.</Text>
          )}
        </Card>
      )}

      {ledgerQuery.isError ? (
        <QueryErrorState
          title="Ledger could not be loaded"
          message={errorMessage(ledgerQuery.error)}
          onRetry={() => void ledgerQuery.refetch()}
          retrying={ledgerQuery.isFetching}
        />
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>Ledger</Text>
          {ledgerQuery.isLoading ? (
            <Text style={styles.muted}>Loading ledger activity...</Text>
          ) : ledgerQuery.data?.items.length ? (
            ledgerQuery.data.items.map((entry) => {
              const amount = sellerLedgerAmount(entry);
              return (
                <View key={entry.id} style={styles.historyRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      {entry.description ?? entry.entryType ?? "Ledger entry"}
                    </Text>
                    <Text style={styles.muted}>
                      {formatDate(entry.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.rowValue}>
                    <Text
                      style={[
                        styles.amount,
                        amount.label === "Debit"
                          ? styles.debitText
                          : styles.creditText,
                      ]}
                    >
                      {amount.label}{" "}
                      {formatMoney(
                        amount.amountPaise,
                        entry.currency ?? currency,
                      )}
                    </Text>
                    <Text style={styles.muted}>
                      Balance{" "}
                      {formatMoney(
                        entry.balanceAfterPaise,
                        entry.currency ?? currency,
                      )}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.muted}>
              Ledger entries appear after finance activity is posted.
            </Text>
          )}
        </Card>
      )}

      {statementsQuery.isError ? (
        <QueryErrorState
          title="Statements could not be loaded"
          message={errorMessage(statementsQuery.error)}
          onRetry={() => void statementsQuery.refetch()}
          retrying={statementsQuery.isFetching}
        />
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>Statements</Text>
          {statementsQuery.isLoading ? (
            <Text style={styles.muted}>Loading statements...</Text>
          ) : statementsQuery.data?.items.length ? (
            statementsQuery.data.items.map((statement) => (
              <View key={statement.id} style={styles.historyRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>
                    {statement.statementNumber ?? statement.id}
                  </Text>
                  <Text style={styles.muted}>
                    {formatDate(statement.generatedAt)}
                  </Text>
                </View>
                <View style={styles.rowValue}>
                  <Text style={styles.amount}>
                    {formatMoney(
                      statement.netPayablePaise,
                      statement.currency ?? currency,
                    )}
                  </Text>
                  <Text style={styles.muted}>
                    {displayStatus(statement.status ?? "GENERATED")}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>
              Statements appear after an approved payout is processed.
            </Text>
          )}
        </Card>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={dismissToast}
      />
    </Screen>
  );
}

function FinanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "Date unavailable";
}

function displayStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  wallet: { gap: spacing.md },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  walletAmount: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 72,
    padding: spacing.md,
  },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  metricValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  warningBand: {
    backgroundColor: "#FFF8E6",
    borderColor: "#F4C27A",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  warningTitle: { color: "#7A4A00", fontSize: 12, fontWeight: "900" },
  warningValue: { color: "#B42318", fontSize: 18, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  stack: { gap: spacing.sm },
  muted: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  errorText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  detailLabel: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  detailValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  historyRow: {
    alignItems: "flex-start",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 56,
    paddingTop: spacing.sm,
  },
  rowCopy: { flex: 1, gap: 3 },
  rowValue: { alignItems: "flex-end", flexShrink: 0, gap: 3, maxWidth: "48%" },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  amount: { color: colors.ink, fontSize: 13, fontWeight: "900", textAlign: "right" },
  creditText: { color: "#166534" },
  debitText: { color: "#B42318" },
});
