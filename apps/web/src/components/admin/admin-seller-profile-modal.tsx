"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Description } from "@headlessui/react";
import { X, CheckCircle2, XCircle, FileText, Download, ShieldCheck, MapPin } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "./admin-auth-context";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { adminRequest, type SellerRecord } from "./admin-operations";

type SellerVerificationDocument = NonNullable<SellerRecord["documents"]>[number];

function humanize(value?: string | null) {
  return value
    ? value
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Not set";
}

function statusTone(status?: string | null) {
  if (["ACTIVE", "APPROVED", "COMPLETED", "VERIFIED"].includes(status ?? "")) return "success";
  if (["PENDING", "PENDING_APPROVAL", "SUBMITTED"].includes(status ?? "")) return "warning";
  if (["REJECTED", "SUSPENDED", "CANCELLED", "FAILED"].includes(status ?? "")) return "danger";
  return "info";
}

function DetailBlock({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#1F2933]">{value || "Not provided"}</p>
    </div>
  );
}

export function AdminSellerProfileModal({
  seller,
  open,
  onClose,
  onSellerUpdated,
}: {
  seller: SellerRecord | null;
  open: boolean;
  onClose: () => void;
  onSellerUpdated?: (seller: SellerRecord) => void;
}) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();

  const updateDocumentStatus = useMutation({
    mutationFn: ({ documentId, status }: { documentId: string; status: "APPROVED" | "REJECTED" }) =>
      adminRequest<SellerVerificationDocument>(
        `/api/admin/sellers/${seller?.id}/documents/${documentId}/status`,
        auth.authHeaders,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      ),
    onSuccess: (updatedDocument: SellerVerificationDocument) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sellers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seller-approvals"] });
      if (seller && onSellerUpdated) {
        onSellerUpdated({
          ...seller,
          documents: (seller.documents ?? []).map((doc) =>
            doc.id === updatedDocument.id ? updatedDocument : doc
          ),
        });
      }
    },
  });

  if (!seller) return null;

  const baseAddress = seller.addresses?.[0]; // assuming first is pickup/base

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[90]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#101828]/50 transition duration-200 data-closed:opacity-0"
      />
      <div className="fixed inset-0 w-screen overflow-y-auto px-4 py-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            className="w-full max-w-5xl overflow-hidden rounded-lg bg-[#F8FAFC] shadow-2xl transition duration-200 data-closed:scale-95 data-closed:opacity-0"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] bg-white px-5 py-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#175CD3]">
                  Seller Profile & Verification
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <DialogTitle className="text-2xl font-black text-[#0B1F3A]">
                    {seller.storeName}
                  </DialogTitle>
                  <StatusBadge tone={statusTone(seller.status)}>{humanize(seller.status)}</StatusBadge>
                  <StatusBadge tone={statusTone(seller.approvalStatus)}>{humanize(seller.approvalStatus)}</StatusBadge>
                </div>
                <Description className="mt-1 text-sm font-semibold text-[#667085]">
                  Review business details, verify uploaded documents, and check location coverage.
                </Description>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#667085] transition hover:border-[#ED3500] hover:text-[#ED3500]"
                aria-label="Close profile"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[82svh] overflow-y-auto p-5">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column: Details */}
                <div className="grid gap-6 lg:col-span-1">
                  <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-black text-[#163B5C]">
                      <ShieldCheck className="h-4 w-4" /> Business Identity
                    </h3>
                    <div className="mt-4 grid gap-4">
                      <DetailBlock label="Legal Name" value={seller.profile?.businessLegalName} />
                      <DetailBlock label="Business Type" value={humanize(seller.profile?.businessType)} />
                      <DetailBlock label="PAN Number" value={seller.profile?.panNumber} />
                      <DetailBlock label="GST Number" value={seller.profile?.gstNumber} />
                    </div>
                  </section>

                  <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-black text-[#163B5C]">
                      <MapPin className="h-4 w-4" /> Contact & Location
                    </h3>
                    <div className="mt-4 grid gap-4">
                      <DetailBlock label="Contact Name" value={seller.profile?.contactName || seller.user?.fullName} />
                      <DetailBlock label="Email" value={seller.profile?.contactEmail || seller.user?.email} />
                      <DetailBlock label="Phone" value={seller.profile?.contactPhone || seller.user?.phone} />
                      <DetailBlock
                        label="Registered Address"
                        value={
                          baseAddress
                            ? `${baseAddress.line1 ?? ""}, ${baseAddress.area ?? ""} ${baseAddress.city ?? ""}, ${baseAddress.state ?? ""} - ${baseAddress.pincode ?? ""}`
                            : "No address registered"
                        }
                      />
                    </div>
                  </section>
                </div>

                {/* Right Column: Documents */}
                <div className="lg:col-span-2">
                  <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-lg font-black text-[#163B5C]">
                      <FileText className="h-5 w-5" /> Document Verification
                    </h3>
                    <p className="mt-1 mb-5 text-sm font-semibold text-[#667085]">
                      Review the uploaded proofs and approve or reject them individually.
                    </p>

                    <div className="grid gap-4">
                      {seller.documents?.length ? (
                        seller.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className={cn(
                              "flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center",
                              doc.status === "APPROVED" ? "border-[#32B877] bg-[#F0FDF6]" :
                              doc.status === "REJECTED" ? "border-[#F5B7B7] bg-[#FFF8F8]" :
                              "border-[#D9E2EA] bg-[#F8FAFC]"
                            )}
                          >
                            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-md border border-[#D9E2EA] bg-white">
                               <StorefrontImage src={doc.fileUrl} fallbackLabel="DOC" alt={doc.documentType} sizes="100px" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-[#1F2933]">
                                  {humanize(doc.documentType)}
                                </h4>
                                <StatusBadge tone={statusTone(doc.status)}>{humanize(doc.status)}</StatusBadge>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <a
                                  href={`/admin/storage/private-document?sellerId=${seller.id}&documentId=${doc.id}&label=${encodeURIComponent(doc.documentType)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded bg-white px-2.5 py-1 text-xs font-bold text-[#163B5C] border border-[#D9E2EA] hover:border-[#163B5C] transition"
                                >
                                  <Download className="h-3 w-3" /> View full file
                                </a>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                              <Button
                                size="sm"
                                variant="outline"
                                className="!border-[#0F8A5F] !text-[#0F8A5F] hover:!bg-[#F0FDF6]"
                                disabled={updateDocumentStatus.isPending || doc.status === "APPROVED"}
                                onClick={() => updateDocumentStatus.mutate({ documentId: doc.id, status: "APPROVED" })}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="!border-[#B42318] !text-[#B42318] hover:!bg-[#FFF8F8]"
                                disabled={updateDocumentStatus.isPending || doc.status === "REJECTED"}
                                onClick={() => updateDocumentStatus.mutate({ documentId: doc.id, status: "REJECTED" })}
                              >
                                <XCircle className="mr-1 h-4 w-4" /> Reject
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed border-[#D9E2EA] bg-[#F8FAFC] p-8 text-center">
                          <p className="text-sm font-semibold text-[#667085]">No documents uploaded by this seller yet.</p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
