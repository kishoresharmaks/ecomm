import { indihubFetch, type IndihubAuthHeaders } from "./api";
import { downloadAuthenticatedFile } from "./gst-report-api";

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type B2BOperationalLine = {
  id: string;
  lineNumber: number;
  description: string;
  sku?: string | null;
  hsnSacCode?: string | null;
  quantity: number;
  unitPricePaise: number;
  lineValuePaise: number;
  gstRatePercent?: string | number | null;
  productId?: string | null;
  productVariantId?: string | null;
  progress?: {
    state: string;
    plannedQuantity: number;
    readyQuantity: number;
    pickedQuantity: number;
    packedQuantity: number;
    shippedQuantity: number;
    deliveredQuantity: number;
    acceptedQuantity: number;
  };
  reservations?: Array<{ id: string; quantity: number; status: string }>;
  fulfilmentPlan?: {
    id: string;
    source: string;
    plannedQuantity: number;
    readyQuantity: number;
    status: string;
    expectedReadyAt?: string | null;
    procurementOrder?: B2BProcurementOrder | null;
    productionJob?: B2BProductionJob | null;
  } | null;
};

export type B2BProcurementOrder = {
  id: string;
  procurementNumber: string;
  status: string;
  orderedQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  supplierName?: string | null;
  supplierReference?: string | null;
  expectedAt?: string | null;
};

export type B2BProductionJob = {
  id: string;
  productionNumber: string;
  status: string;
  plannedQuantity: number;
  completedQuantity: number;
  rejectedQuantity: number;
  expectedAt?: string | null;
  materialNotes?: string | null;
};

export type B2BOperationalOrder = {
  id: string;
  orderNumber: string;
  status: string;
  version: number;
  currency: string;
  buyerPayableAmountPaise: number;
  paidAmountPaise: number;
  paymentStatus: string;
  paymentTermType: string;
  paymentDueAt: string;
  purchaseOrderNumber?: string | null;
  taxInvoiceNumber?: string | null;
  deliveryAddressSnapshot?: Record<string, unknown> | null;
  businessBuyer?: {
    id: string;
    companyName: string;
    gstNumber?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    addresses?: Array<Record<string, unknown>>;
    creditProfile?: {
      creditLimitPaise: number;
      approvedExposurePaise: number;
      allowedTerms: string[];
      isActive: boolean;
      holdReason?: string | null;
    } | null;
  } | null;
  seller?: { id: string; storeName: string; gstNumber?: string | null } | null;
  lines: B2BOperationalLine[];
  poReview?: {
    status: string;
    documentMatched: boolean;
    priceMatched: boolean;
    quantityMatched: boolean;
    deliveryTermsMatched: boolean;
    stockChecked: boolean;
    taxDataChecked: boolean;
    creditChecked: boolean;
    exceptionCodes?: unknown;
    notes?: string | null;
  } | null;
  creditDecisions: Array<{
    id: string;
    status: string;
    paymentTermType: string;
    requestedAmountPaise: number;
    approvedAmountPaise?: number | null;
    exposureAtDecisionPaise: number;
    overrideExpiresAt?: string | null;
    note?: string | null;
    createdAt: string;
  }>;
  paymentSchedules: Array<{
    id: string;
    installmentNumber: number;
    label: string;
    amountPaise: number;
    paidAmountPaise: number;
    dueAt: string;
    fulfilmentGate: boolean;
    dispatchGate: boolean;
    status: string;
  }>;
  warehouseTasks: Array<{
    id: string;
    taskNumber: string;
    taskType: string;
    status: string;
    items: Array<{
      id: string;
      b2bOrderLineId: string;
      requiredQuantity: number;
      completedQuantity: number;
      rejectedQuantity: number;
    }>;
  }>;
  packages: Array<{
    id: string;
    packageNumber: string;
    sequence: number;
    weightGrams?: number | null;
    lengthCm?: number | null;
    breadthCm?: number | null;
    heightCm?: number | null;
  }>;
  qcInspections: Array<{
    id: string;
    packageId?: string | null;
    status: string;
    failureReason?: string | null;
    inspectedAt?: string | null;
    createdAt: string;
  }>;
  shipments: Array<{
    id: string;
    shipmentNumber: string;
    status: string;
    acceptanceStatus: string;
    transporterName?: string | null;
    lrNumber?: string | null;
    awbNumber?: string | null;
    vehicleNumber?: string | null;
    dispatchedAt?: string | null;
    deliveredAt?: string | null;
    acceptanceDueAt?: string | null;
    disputeReason?: string | null;
    assignedDeliveryUser?: {
      id: string;
      fullName?: string | null;
      email: string;
    } | null;
    proofOfDelivery?: {
      id: string;
      receiverName: string;
      deliveredAt: string;
      proofFileKeys: unknown;
      signatureFileKey?: string | null;
    } | null;
    events: Array<{ id: string; status: string; note?: string | null; createdAt: string }>;
  }>;
  taxDocuments: Array<{
    id: string;
    documentNumber?: string | null;
    documentType: string;
    status: string;
    invoiceValuePaise: number;
    compliance?: {
      eInvoiceStatus: string;
      irn?: string | null;
      eWayBillStatus: string;
      eWayBillNumber?: string | null;
      providerError?: string | null;
    } | null;
  }>;
  receivable?: {
    id: string;
    originalAmountPaise: number;
    outstandingAmountPaise: number;
    dueAt: string;
    status: string;
    ageingBucket: string;
    collectionTasks: Array<{
      id: string;
      status: string;
      dueAt: string;
      promiseToPayAt?: string | null;
      nextReminderAt?: string | null;
      reminderCount: number;
      note?: string | null;
    }>;
  } | null;
  paymentRecords: Array<{
    id: string;
    method: string;
    status: string;
    amountPaise: number;
    referenceNumber?: string | null;
    createdAt: string;
    receiptVoucher?: {
      id: string;
      voucherNumber: string;
      fileKey?: string | null;
      issuedAt: string;
    } | null;
  }>;
  supportCases: Array<{
    id: string;
    caseNumber: string;
    caseType: string;
    status: string;
    subject: string;
    description: string;
    b2bOrderLineId?: string | null;
    shipmentId?: string | null;
    resolution?: string | null;
    createdAt: string;
  }>;
  amendments: Array<{
    id: string;
    amendmentNumber: string;
    status: string;
    baseOrderVersion: number;
    reason: string;
    lineChanges?: unknown;
    deliveryAddressSnapshot?: unknown;
    paymentDueAt?: string | null;
    decisionReason?: string | null;
    requestedAt: string;
    decidedAt?: string | null;
    requestedBy: { id: string; fullName?: string | null; email: string };
    decidedBy?: { id: string; fullName?: string | null; email: string } | null;
  }>;
  disputeResolutions: Array<{
    id: string;
    resolutionNumber: string;
    supportCaseId: string;
    resolutionType: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    returnQuantity: number;
    replacementQuantity: number;
    refundAmountPaise: number;
    receivableAdjustmentPaise: number;
    reason: string;
    resolvedAt: string;
    creditNote?: {
      id: string;
      documentNumber?: string | null;
      status: string;
    } | null;
    replacementEnquiry?: { id: string; status: string } | null;
  }>;
  financialReconciliations: Array<{
    id: string;
    reconciliationNumber: string;
    status: string;
    expectedPaidAmountPaise: number;
    actualPaidAmountPaise: number;
    expectedOutstandingPaise: number;
    actualOutstandingPaise?: number | null;
    corrected: boolean;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    status: string;
    note?: string | null;
    createdAt: string;
  }>;
};

export type B2BOperationsQuery = Record<
  string,
  string | number | boolean | undefined
>;

export type B2BReceivableItem = {
  id: string;
  originalAmountPaise: number;
  outstandingAmountPaise: number;
  dueAt: string;
  status: string;
  ageingBucket: string;
  collectionTasks: Array<{
    id: string;
    status: string;
    dueAt: string;
    nextReminderAt?: string | null;
    reminderCount: number;
    note?: string | null;
  }>;
  order: {
    orderNumber: string;
    seller?: { storeName: string } | null;
    businessBuyer: { companyName: string };
  };
};

export type B2BErpConnection = {
  id: string;
  name: string;
  status: string;
  baseUrl: string;
  subscribedEvents: string[];
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type B2BErpExportJob = {
  id: string;
  exportNumber: string;
  exportType: string;
  format: "CSV" | "JSON";
  status: string;
  filters?: unknown;
  fileName?: string | null;
  contentType?: string | null;
  contentHash?: string | null;
  rowCount: number;
  error?: string | null;
  completedAt?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    fullName?: string | null;
    email: string;
  } | null;
};

export type B2BOnlinePaymentOrder = {
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  orderNumber: string;
  paymentRecordId: string;
  paymentMethod: "RAZORPAY" | "UPI";
};

export type B2BOutboxEvent = {
  id: string;
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: string;
  attemptCount: number;
  nextAttemptAt?: string | null;
  responseCode?: number | null;
  lastError?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
};

export type B2BDeliveryPartner = {
  id: string;
  fullName?: string | null;
  email: string;
  phone?: string | null;
  deliveryProfile?: {
    isAvailable: boolean;
    serviceCityCode?: string | null;
    vehicleType?: string | null;
  } | null;
};

export type B2BExceptionItem = {
  id: string;
  orderNumber: string;
  status: string;
  legacyMigrationReviewRequired: boolean;
  updatedAt: string;
  businessBuyer: { companyName: string };
  seller?: { storeName: string } | null;
  poReview?: {
    status: string;
    exceptionCodes: string[];
    note?: string | null;
  } | null;
  taxDocuments: Array<{
    documentNumber?: string | null;
    compliance?: {
      eInvoiceError?: string | null;
      eWayBillError?: string | null;
    } | null;
  }>;
};

export type B2BSupportCaseItem = {
  id: string;
  caseNumber: string;
  caseType: string;
  status: string;
  subject: string;
  description: string;
  resolution?: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    businessBuyer: { companyName: string };
    seller?: { storeName: string } | null;
  };
  assignedTo?: { id: string; fullName?: string | null; email: string } | null;
  createdBy: { id: string; fullName?: string | null; email: string };
};

export function listBuyerB2BOperations(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BOperationalOrder>>(
    `/api/b2b/v2/orders${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getBuyerB2BOperation(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<B2BOperationalOrder>(
    `/api/b2b/v2/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function getSellerB2BOperation(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<B2BOperationalOrder>(
    `/api/seller/b2b-operations/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function getAdminB2BOperation(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<B2BOperationalOrder>(
    `/api/admin/b2b-operations/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function listFinanceB2BOrders(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BOperationalOrder>>(
    `/api/finance/b2b/orders${queryString(query)}`,
    undefined,
    auth,
  );
}

export function getFinanceB2BOperation(auth: IndihubAuthHeaders, orderNumber: string) {
  return indihubFetch<B2BOperationalOrder>(
    `/api/finance/b2b/orders/${encodeURIComponent(orderNumber)}`,
    undefined,
    auth,
  );
}

export function listFinanceB2BReceivables(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BReceivableItem>>(
    `/api/finance/b2b/receivables${queryString(query)}`,
    undefined,
    auth,
  );
}

export function listAssignedB2BShipments(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BOperationalOrder["shipments"][number] & {
    order: { orderNumber: string; businessBuyer: { companyName: string } };
    packages: B2BOperationalOrder["packages"];
  }>>(`/api/delivery/b2b-shipments${queryString(query)}`, undefined, auth);
}

export function getAssignedB2BShipment(auth: IndihubAuthHeaders, shipmentId: string) {
  return indihubFetch<
    B2BOperationalOrder["shipments"][number] & {
      order: B2BOperationalOrder;
      packages: B2BOperationalOrder["packages"];
    }
  >(`/api/delivery/b2b-shipments/${encodeURIComponent(shipmentId)}`, undefined, auth);
}

export function listB2BErpConnections(auth: IndihubAuthHeaders) {
  return indihubFetch<B2BErpConnection[]>(
    "/api/admin/b2b-integrations/connections",
    undefined,
    auth,
  );
}

export function listB2BOutbox(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BOutboxEvent>>(
    `/api/admin/b2b-integrations/outbox${queryString(query)}`,
    undefined,
    auth,
  );
}

export function listB2BErpExportJobs(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BErpExportJob>>(
    `/api/admin/b2b-integrations/exports${queryString(query)}`,
    undefined,
    auth,
  );
}

export function createB2BErpOrderExport(
  auth: IndihubAuthHeaders,
  format: "csv" | "json",
) {
  return indihubFetch<B2BErpExportJob>(
    `/api/admin/b2b-integrations/exports/orders?format=${format}`,
    { method: "POST" },
    auth,
  );
}

export function listAdminB2BDeliveryPartners(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BDeliveryPartner>>(
    `/api/admin/b2b-operations/delivery-partners${queryString(query)}`,
    undefined,
    auth,
  );
}

export function listAdminB2BExceptions(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BExceptionItem>>(
    `/api/admin/b2b-operations/exceptions${queryString(query)}`,
    undefined,
    auth,
  );
}

export function listB2BSupportCases(
  auth: IndihubAuthHeaders,
  query: B2BOperationsQuery = {},
) {
  return indihubFetch<PageResult<B2BSupportCaseItem>>(
    `/api/support/b2b-cases${queryString(query)}`,
    undefined,
    auth,
  );
}

export function downloadB2BErpOrders(
  auth: IndihubAuthHeaders,
  format: "csv" | "json",
) {
  return downloadB2BDocument(
    auth,
    `/api/admin/b2b-integrations/exports/orders?format=${format}`,
    `b2b-orders.${format}`,
  );
}

export function downloadB2BErpExportJob(
  auth: IndihubAuthHeaders,
  job: Pick<B2BErpExportJob, "id" | "fileName" | "format">,
) {
  return downloadB2BDocument(
    auth,
    `/api/admin/b2b-integrations/exports/${encodeURIComponent(job.id)}/download`,
    job.fileName ?? `b2b-orders.${job.format.toLowerCase()}`,
  );
}

export function createBuyerB2BOnlinePayment(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: {
    method: "RAZORPAY" | "UPI";
    amountPaise: number;
    paymentScheduleId?: string;
  },
  key: string,
) {
  return b2bAction<B2BOnlinePaymentOrder>(
    auth,
    `/api/b2b/v2/orders/${encodeURIComponent(orderNumber)}/payments/online/order`,
    payload,
    "POST",
    key,
  );
}

export function verifyBuyerB2BOnlinePayment(
  auth: IndihubAuthHeaders,
  orderNumber: string,
  payload: {
    paymentRecordId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
  key: string,
) {
  return b2bAction<B2BOperationalOrder>(
    auth,
    `/api/b2b/v2/orders/${encodeURIComponent(orderNumber)}/payments/online/verify`,
    payload,
    "POST",
    key,
  );
}

export function b2bAction<T>(
  auth: IndihubAuthHeaders,
  path: string,
  payload: unknown,
  method: "POST" | "PATCH" | "PUT" = "POST",
  idempotencyKey?: string,
) {
  return indihubFetch<T>(
    path,
    {
      method,
      ...(idempotencyKey
        ? { headers: { "Idempotency-Key": idempotencyKey } }
        : {}),
      body: JSON.stringify(payload),
    },
    auth,
  );
}

export function idempotencyKey(scope: string) {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${scope}:${suffix}`.slice(0, 160);
}

export function downloadB2BDocument(
  auth: IndihubAuthHeaders,
  path: string,
  fallbackFileName: string,
) {
  return downloadAuthenticatedFile(
    auth,
    path,
    fallbackFileName,
    "The B2B document could not be downloaded.",
  );
}

function queryString(query: B2BOperationsQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
