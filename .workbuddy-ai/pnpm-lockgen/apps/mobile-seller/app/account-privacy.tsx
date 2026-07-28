import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { useMobileSellerAuth } from "../src/auth/mobile-seller-auth-context";
import {
  Button,
  Card,
  ConfirmDialog,
  Screen,
  Toast,
} from "../src/components/screen";
import { OperationsHeader } from "../src/components/operations-ui";
import { requestSellerAccountDeletion } from "../src/features/seller/seller-api";
import { colors } from "../src/theme";

const PRIVACY_POLICY_URL = "https://1handindia.com/privacy-policy";
const ACCOUNT_DELETION_URL = "https://1handindia.com/account-deletion";

export default function SellerAccountPrivacyScreen() {
  const auth = useMobileSellerAuth();
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    visible: boolean;
  }>({ message: "", type: "success", visible: false });

  const deletionMutation = useMutation({
    mutationFn: () => requestSellerAccountDeletion(auth.authHeaders),
    onSuccess: () => {
      setConfirming(false);
      setSubmitted(true);
      setToast({
        message: "Account deletion request submitted. Support will verify the request by email.",
        type: "success",
        visible: true,
      });
    },
    onError: (error) => {
      setConfirming(false);
      setToast({
        message: error instanceof Error ? error.message : "Account deletion request failed.",
        type: "error",
        visible: true,
      });
    },
  });

  return (
    <Screen>
      <OperationsHeader
        onBack={() => router.back()}
        title="Account & privacy"
        subtitle="Review how seller data is handled and request account deletion."
      />

      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>
          Privacy and data use
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Review the information collected for seller verification, marketplace operations,
          payouts, security, and legal compliance.
        </Text>
        <Button
          tone="secondary"
          title="Open privacy policy"
          onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
        />
      </Card>

      <Card>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>
          Delete seller account
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Submit a verified deletion request for your seller account and associated personal
          data. Tax, payout, transaction, fraud-prevention, and audit records may be retained
          when required by law or marketplace obligations.
        </Text>
        <Button
          tone="secondary"
          title="Read deletion process"
          onPress={() => void WebBrowser.openBrowserAsync(ACCOUNT_DELETION_URL)}
        />
        <Button
          disabled={submitted || deletionMutation.isPending || !auth.enabled}
          loading={deletionMutation.isPending}
          tone="danger"
          title={submitted ? "Deletion requested" : "Request account deletion"}
          onPress={() => setConfirming(true)}
        />
      </Card>

      <ConfirmDialog
        visible={confirming}
        title="Request account deletion?"
        message="Support will verify the request by email before disabling access and deleting eligible personal data. This action may affect store operations, listings, payouts, and subscriptions."
        cancelLabel="Keep account"
        confirmLabel="Submit request"
        onCancel={() => setConfirming(false)}
        onConfirm={() => deletionMutation.mutate()}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );
}
