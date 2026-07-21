"use client";

import { Building2, Download, FileText, MapPin, ReceiptText } from "lucide-react";
import { Button, StatusBadge } from "@indihub/ui";
import {
  formatGstAddress,
  humanizeGstValue,
} from "@/lib/gst-document-presentation";
import type { GstReportDocument } from "@/lib/gst-report-api";
import { formatMoney } from "@/lib/storefront-api";
import { SideDrawer } from "./side-drawer";

export function GstDocumentDetailsDrawer({
  document,
  onClose,
  onDownload,
  downloading,
  downloadError,
}: {
  document: GstReportDocument | null;
  onClose: () => void;
  onDownload: (document: GstReportDocument) => void;
  downloading: boolean;
  downloadError?: string | null;
}) {
  return (
    <SideDrawer
      open={Boolean(document)}
      onClose={onClose}
      title={document?.documentNumber ?? "GST document details"}
      {...(document
        ? {
            description: `${humanizeGstValue(document.documentType)} issued ${formatDate(document.issueDate)}`,
          }
        : {})}
      widthClassName="max-w-2xl"
    >
      {document ? (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={document.documentType === "CREDIT_NOTE" ? "warning" : "info"}>
                {humanizeGstValue(document.documentType)}
              </StatusBadge>
              <StatusBadge tone="neutral">
                {document.gstrSupplySection ?? "Outside regular GSTR"}
              </StatusBadge>
            </div>
            <Button type="button" onClick={() => onDownload(document)} disabled={downloading}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading ? "Preparing PDF" : "Download PDF"}
            </Button>
          </div>

          {downloadError ? (
            <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] px-3 py-2 text-sm font-bold text-[#8A1F1F]">
              {downloadError}
            </p>
          ) : null}

          <DetailSection icon={ReceiptText} title="Document">
            <DetailGrid
              rows={[
                ["Order reference", document.orderNumber ?? "Not recorded"],
                ["Financial year", document.financialYear],
                ["Original document", document.originalDocumentNumber ?? "Not applicable"],
                ["Place of supply", document.placeOfSupplyStateCode ?? "Not recorded"],
                ["Supply type", humanizeGstValue(document.supplyType)],
                ["Reverse charge", document.reverseCharge ? "Yes" : "No"],
                ["Reason", document.reason ?? "Not applicable"],
              ]}
            />
          </DetailSection>

          <DetailSection icon={Building2} title="Supplier">
            <DetailGrid
              rows={[
                ["Legal name", document.sellerName],
                ["Registration", humanizeGstValue(document.sellerTaxRegistrationStatus)],
                ["GSTIN", document.sellerGstin ?? "Not GST registered"],
              ]}
            />
          </DetailSection>

          <DetailSection icon={MapPin} title="Recipient">
            <DetailGrid
              rows={[
                ["Legal name", document.buyerLegalName],
                ["GSTIN", document.buyerGstin ?? "Consumer sale"],
                ["Invoice address", formatGstAddress(document.buyerAddress)],
                ["State code", document.buyerAddress.stateCode || "Not recorded"],
                ["Country code", document.buyerAddress.countryCode || "Not recorded"],
              ]}
            />
          </DetailSection>

          <DetailSection icon={FileText} title="Tax breakdown">
            <DetailGrid
              rows={[
                ["Taxable value", formatMoney(document.taxableValuePaise, document.currency)],
                ["CGST", formatMoney(document.cgstPaise, document.currency)],
                ["SGST", formatMoney(document.sgstPaise, document.currency)],
                ["IGST", formatMoney(document.igstPaise, document.currency)],
                ["Cess", formatMoney(document.cessPaise, document.currency)],
                ["Total GST", formatMoney(document.totalTaxPaise, document.currency)],
                ["Document value", formatMoney(document.invoiceValuePaise, document.currency)],
              ]}
            />
            <div className="mt-4 overflow-x-auto border-t border-[#EEF2F6] pt-4">
              <table className="min-w-[620px] w-full border-collapse text-left text-sm">
                <thead className="text-xs font-black uppercase text-[#667085]">
                  <tr>
                    <th className="pb-2 pr-3">Line</th>
                    <th className="pb-2 pr-3">HSN/SAC</th>
                    <th className="pb-2 pr-3">Qty</th>
                    <th className="pb-2 pr-3 text-right">Rate</th>
                    <th className="pb-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {document.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-3 pr-3 font-semibold text-[#344054]">
                        {line.description}
                      </td>
                      <td className="py-3 pr-3 text-[#667085]">{line.hsnSacCode ?? "-"}</td>
                      <td className="py-3 pr-3 text-[#667085]">
                        {line.quantity} {line.uqc}
                      </td>
                      <td className="py-3 pr-3 text-right text-[#667085]">
                        {line.gstRatePercent}%
                      </td>
                      <td className="py-3 text-right font-black text-[#1F2933]">
                        {formatMoney(line.lineValuePaise, document.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          <DetailSection icon={FileText} title="Compliance references">
            <DetailGrid
              rows={[
                ["E-invoice status", humanizeGstValue(document.compliance.eInvoiceStatus)],
                ["IRN", document.compliance.irn ?? "Not recorded"],
                [
                  "Acknowledgement",
                  document.compliance.acknowledgementNumber ?? "Not recorded",
                ],
                ["E-way status", humanizeGstValue(document.compliance.eWayBillStatus)],
                ["E-way bill number", document.compliance.eWayBillNumber ?? "Not recorded"],
              ]}
            />
          </DetailSection>
        </div>
      ) : null}
    </SideDrawer>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#ED3500]" aria-hidden="true" />
        <h3 className="text-sm font-black uppercase text-[#344054]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function DetailGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="border-b border-[#EEF2F6] pb-3">
          <dt className="text-xs font-black uppercase text-[#667085]">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold leading-6 text-[#1F2933]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "on an unavailable date";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
