import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { SupportChatClient } from "@/components/support/support-chat-client";

export default function AdminChatPage() {
  return (
    <AdminPortalShell
      title="Chat support"
      description="Manage chatbot handovers, support assignments, SLA-sensitive queues, and sensitive chat escalation."
    >
      <SupportChatClient />
    </AdminPortalShell>
  );
}
