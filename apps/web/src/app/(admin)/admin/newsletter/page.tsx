import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminNewsletterSubscribersClient } from "@/components/admin/admin-newsletter-subscribers-client";

export default function AdminNewsletterPage() {
  return (
    <AdminPortalShell
      title="Newsletter subscribers"
      description="Manage newsletter subscriptions, search subscribers, and resend welcome emails."
    >
      <AdminNewsletterSubscribersClient />
    </AdminPortalShell>
  );
}
