import { SupportChatClient } from "@/components/support/support-chat-client";
import { SupportChatShell } from "@/components/support/support-chat-shell";

export default function SupportChatPage() {
  return (
    <SupportChatShell
      title="Chat support inbox"
      description="Claim normal support conversations, reply to users, and use safe read-only context without full admin access."
    >
      <SupportChatClient />
    </SupportChatShell>
  );
}
