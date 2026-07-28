import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Button, ConfirmDialog, Toast } from "./screen";

export function SellerHubHandoffButton({
  buttonTitle,
  message,
  title,
  url,
}: {
  buttonTitle: string;
  message: string;
  title: string;
  url: string;
}) {
  const [visible, setVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);

  async function openSellerHub() {
    setVisible(false);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setErrorVisible(true);
    }
  }

  return (
    <>
      <Button
        title={buttonTitle}
        tone="secondary"
        accessibilityHint="Shows a confirmation before opening this page in the secure web Seller Hub."
        onPress={() => setVisible(true)}
      />
      <ConfirmDialog
        visible={visible}
        title={title}
        message={message}
        cancelLabel="Not now"
        confirmLabel="Open Seller Hub"
        onCancel={() => setVisible(false)}
        onConfirm={() => void openSellerHub()}
      />
      <Toast
        visible={errorVisible}
        message="Seller Hub could not be opened. Please try again."
        type="error"
        onDismiss={() => setErrorVisible(false)}
      />
    </>
  );
}
