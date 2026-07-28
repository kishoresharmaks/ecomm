"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@indihub/ui";
import { Download, ShieldCheck } from "lucide-react";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { apiBaseUrl, indihubFetch, userFacingApiErrorMessage, type IndihubAuthHeaders } from "@/lib/api";

type SellerDocumentAccess =
  | {
      provider: "s3";
      url: string;
      expiresAt: string;
      fileName: string;
      contentType: string;
    }
  | {
      provider: "local";
      fileName: string;
      contentType: string;
    };

export function AdminPrivateDocumentViewerClient() {
  const auth = useAdminAuth();
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("sellerId") ?? "";
  const documentId = searchParams.get("documentId") ?? "";
  const label = searchParams.get("label") ?? "Seller document";
  const [status, setStatus] = useState<"idle" | "opening" | "opened" | "error">("idle");
  const [error, setError] = useState("");

  const canOpen = useMemo(
    () => auth.isReady && auth.isAuthenticated && sellerId.trim().length > 0 && documentId.trim().length > 0,
    [documentId, auth.isAuthenticated, auth.isReady, sellerId],
  );

  useEffect(() => {
    if (!canOpen || status !== "idle") {
      return;
    }

    void openDocument();
  }, [canOpen, status]);

  async function openDocument() {
    if (!sellerId || !documentId) {
      setError("Seller or document reference is missing.");
      setStatus("error");
      return;
    }

    setError("");
    setStatus("opening");
    try {
      await openAdminSellerDocument(auth.authHeaders, sellerId, documentId);
      setStatus("opened");
    } catch (openError) {
      setError(userFacingApiErrorMessage(openError));
      setStatus("error");
    }
  }

  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-[#ECFDF3] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0F8A5F]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Secure admin document
          </div>
          <h2 className="mt-4 text-2xl font-black text-[#0B1F3A]">{label}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#667085]">
            This link opens the private seller document through your active admin session. Raw private storage URLs are not exposed in the Excel file.
          </p>
        </div>
        <Button type="button" onClick={() => void openDocument()} disabled={!canOpen || status === "opening"}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {status === "opening" ? "Opening..." : "Open document"}
        </Button>
      </div>

      <div className="mt-5 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#475467]">
        {!auth.isReady ? "Checking admin session..." : null}
        {auth.isReady && !auth.isAuthenticated ? "Please sign in as admin to open this private document." : null}
        {auth.isAuthenticated && (!sellerId || !documentId) ? "Seller or document reference is missing from the link." : null}
        {status === "idle" && canOpen ? "Preparing secure document access..." : null}
        {status === "opening" ? "Requesting a secure document access link..." : null}
        {status === "opened" ? "Document opened in a new browser tab. You can reopen it from this page if needed." : null}
        {status === "error" ? error : null}
      </div>
    </div>
  );
}

async function openAdminSellerDocument(
  auth: IndihubAuthHeaders,
  sellerId: string,
  documentId: string,
) {
  const popup = window.open("", "_blank");

  try {
    const safeSellerId = encodeURIComponent(sellerId);
    const safeDocumentId = encodeURIComponent(documentId);
    const access = await indihubFetch<SellerDocumentAccess>(
      `/api/admin/sellers/${safeSellerId}/documents/${safeDocumentId}/access`,
      undefined,
      auth,
    );

    if (access.provider === "s3") {
      openPopupOrNavigate(popup, access.url);
      return;
    }

    const response = await fetch(
      `${apiBaseUrl}/api/admin/sellers/${safeSellerId}/documents/${safeDocumentId}/file`,
      {
        headers: {
          Authorization: `Bearer ${auth.bearerToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Unable to open this private document.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    openPopupOrNavigate(popup, url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

function openPopupOrNavigate(popup: Window | null, url: string) {
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
    return;
  }

  window.location.href = url;
}
