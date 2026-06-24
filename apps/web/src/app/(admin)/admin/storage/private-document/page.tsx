import { Suspense } from "react";
import { AdminPortalShell } from "@/components/admin/admin-portal-shell";
import { AdminPrivateDocumentViewerClient } from "./admin-private-document-viewer-client";

export default function AdminPrivateDocumentViewerPage() {
  return (
    <AdminPortalShell
      title="Private document"
      description="Open seller verification files through secure admin document access."
    >
      <Suspense fallback={<div className="rounded-lg border border-[#D8E2EA] bg-white p-5 text-sm font-semibold text-[#667085] shadow-sm">Preparing secure document viewer...</div>}>
        <AdminPrivateDocumentViewerClient />
      </Suspense>
    </AdminPortalShell>
  );
}
