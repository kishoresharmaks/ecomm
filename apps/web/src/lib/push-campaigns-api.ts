import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type PushCampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
export type PushCampaignBatchStatus = "PENDING" | "CLAIMED" | "DONE";

export type PushCampaignSegmentFilter = {
  countryCode?: string;
  stateCode?: string;
  city?: string;
  limit?: number;
};

export type PushCampaignPayload = {
  title: string;
  body: string;
  imageAssetKey?: string;
  href?: string;
  segmentFilter?: PushCampaignSegmentFilter;
};

export type PushCampaignFormState = {
  title: string;
  body: string;
  imageAssetKey: string;
  href: string;
  countryCode: string;
  stateCode: string;
  city: string;
  limit: string;
};

export type PushCampaign = {
  id: string;
  title: string;
  body: string;
  imageAssetKey?: string | null;
  imageUrl?: string | null;
  href?: string | null;
  segmentFilter: PushCampaignSegmentFilter;
  status: PushCampaignStatus;
  previewCount: number;
  targetedCount: number;
  sentCount: number;
  failedCount: number;
  revokedCount: number;
  scheduledAt?: string | null;
  sentAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  batches?: PushCampaignBatch[];
};

export type PushCampaignBatch = {
  id: string;
  campaignId: string;
  status: PushCampaignBatchStatus;
  recipientTokenIds: string[];
  ticketIds: string[];
  ticketErrors?: unknown;
  claimedBy?: string | null;
  claimedAt?: string | null;
  doneAt?: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PushCampaignAuditLog = {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  createdAt: string;
};

export type PushCampaignPage = {
  items: PushCampaign[];
  total: number;
  page: number;
  limit: number;
  pageCount?: number;
};

export const pushCampaignStatuses: Array<PushCampaignStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "CANCELLED",
];

export const pushCampaignHrefExamples = [
  "/deals",
  "/orders/1HI202606190001",
  "/product/sample-product",
  "/products/sample-product",
  "/store/sample-store",
  "/stores/sample-store",
  "/category/sample-category",
  "/categories/sample-category",
];

const allowedHrefPatterns = [
  /^\/deals$/,
  /^\/orders\/[A-Za-z0-9._-]+$/,
  /^\/products?\/[A-Za-z0-9._-]+$/,
  /^\/stores?\/[A-Za-z0-9._-]+$/,
  /^\/categories?\/[A-Za-z0-9._-]+$/,
];

const campaignImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxCampaignImageBytes = 5 * 1024 * 1024;
const maxCampaignImageEdge = 4096;

export function emptyPushCampaignForm(): PushCampaignFormState {
  return {
    title: "",
    body: "",
    imageAssetKey: "",
    href: "/deals",
    countryCode: "IN",
    stateCode: "",
    city: "",
    limit: "",
  };
}

export function formFromPushCampaign(campaign: PushCampaign): PushCampaignFormState {
  return {
    title: campaign.title,
    body: campaign.body,
    imageAssetKey: campaign.imageAssetKey ?? "",
    href: campaign.href ?? "",
    countryCode: campaign.segmentFilter?.countryCode ?? "",
    stateCode: campaign.segmentFilter?.stateCode ?? "",
    city: campaign.segmentFilter?.city ?? "",
    limit: campaign.segmentFilter?.limit ? String(campaign.segmentFilter.limit) : "",
  };
}

export function validatePushCampaignForm(form: PushCampaignFormState) {
  if (form.title.trim().length < 2) {
    return "Campaign title is required.";
  }
  if (form.title.trim().length > 120) {
    return "Campaign title must be 120 characters or less.";
  }
  if (form.body.trim().length < 2) {
    return "Campaign body is required.";
  }
  if (form.body.trim().length > 240) {
    return "Campaign body must be 240 characters or less.";
  }
  if (form.href.trim() && !isAllowedPushCampaignHref(form.href)) {
    return "Deep link must match an approved customer app route.";
  }
  if (form.imageAssetKey.trim() && !isManagedCampaignImageKey(form.imageAssetKey)) {
    return "Image must be an uploaded 1HandIndia JPG, PNG, or WebP asset key.";
  }
  if (form.limit.trim()) {
    const limit = Number(form.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100000) {
      return "Segment limit must be a whole number from 1 to 100000.";
    }
  }
  return "";
}

export function pushCampaignPayloadFromForm(form: PushCampaignFormState): PushCampaignPayload {
  const segmentFilter: PushCampaignSegmentFilter = {
    ...(form.countryCode.trim() ? { countryCode: form.countryCode.trim().toUpperCase() } : {}),
    ...(form.stateCode.trim() ? { stateCode: form.stateCode.trim() } : {}),
    ...(form.city.trim() ? { city: form.city.trim() } : {}),
    ...(form.limit.trim() ? { limit: Number(form.limit) } : {}),
  };

  return {
    title: form.title.trim(),
    body: form.body.trim(),
    ...(form.imageAssetKey.trim() ? { imageAssetKey: form.imageAssetKey.trim() } : {}),
    ...(form.href.trim() ? { href: form.href.trim() } : {}),
    ...(Object.keys(segmentFilter).length ? { segmentFilter } : {}),
  };
}

export function isAllowedPushCampaignHref(value: string) {
  const href = value.trim();
  return Boolean(href && allowedHrefPatterns.some((pattern) => pattern.test(href)));
}

export function isManagedCampaignImageKey(value: string) {
  const key = value.trim();
  return /^indihub\/.+\.(jpe?g|png|webp)$/i.test(key) && !key.includes("..") && !key.includes("://");
}

export function validatePushCampaignImageFile(file: Pick<File, "type" | "size" | "name">) {
  if (!campaignImageTypes.has(file.type)) {
    return "Campaign image must be JPG, PNG, or WebP.";
  }
  if (file.size > maxCampaignImageBytes) {
    return "Campaign image must be 5 MB or smaller.";
  }
  if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return "Campaign image file extension must match JPG, PNG, or WebP.";
  }
  return "";
}

export async function validatePushCampaignImageDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Campaign image could not be read."));
      image.src = url;
    });

    if (!dimensions.width || !dimensions.height) {
      return "Campaign image dimensions could not be read.";
    }
    if (dimensions.width > maxCampaignImageEdge || dimensions.height > maxCampaignImageEdge) {
      return "Campaign image dimensions must be 4096px or smaller.";
    }
    return "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildPushCampaignListPath(query: { status?: PushCampaignStatus | "ALL"; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (query.status && query.status !== "ALL") {
    params.set("status", query.status);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.limit) {
    params.set("limit", String(query.limit));
  }
  return `/api/admin/push-campaigns${params.size ? `?${params.toString()}` : ""}`;
}

export function listPushCampaigns(
  auth: IndihubAuthHeaders,
  query: { status?: PushCampaignStatus | "ALL"; page?: number; limit?: number } = {},
) {
  return indihubFetch<PushCampaignPage>(buildPushCampaignListPath(query), undefined, auth);
}

export function getPushCampaign(auth: IndihubAuthHeaders, campaignId: string) {
  return indihubFetch<PushCampaign>(`/api/admin/push-campaigns/${encodeURIComponent(campaignId)}`, undefined, auth);
}

export function createPushCampaign(auth: IndihubAuthHeaders, payload: PushCampaignPayload) {
  return indihubFetch<PushCampaign>(
    "/api/admin/push-campaigns",
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function updatePushCampaign(auth: IndihubAuthHeaders, campaignId: string, payload: PushCampaignPayload) {
  return indihubFetch<PushCampaign>(
    `/api/admin/push-campaigns/${encodeURIComponent(campaignId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    auth,
  );
}

export function previewPushCampaign(auth: IndihubAuthHeaders, payload: PushCampaignPayload) {
  return indihubFetch<{ count: number; segmentFilter: PushCampaignSegmentFilter }>(
    "/api/admin/push-campaigns/preview",
    { method: "POST", body: JSON.stringify(payload) },
    auth,
  );
}

export function sendPushCampaignNow(auth: IndihubAuthHeaders, campaignId: string) {
  return indihubFetch<PushCampaign>(
    `/api/admin/push-campaigns/${encodeURIComponent(campaignId)}/send-now`,
    { method: "POST" },
    auth,
  );
}

export function schedulePushCampaign(auth: IndihubAuthHeaders, campaignId: string, scheduledAt: string) {
  return indihubFetch<PushCampaign>(
    `/api/admin/push-campaigns/${encodeURIComponent(campaignId)}/schedule`,
    { method: "POST", body: JSON.stringify({ scheduledAt }) },
    auth,
  );
}

export function cancelPushCampaign(auth: IndihubAuthHeaders, campaignId: string) {
  return indihubFetch<PushCampaign>(
    `/api/admin/push-campaigns/${encodeURIComponent(campaignId)}/cancel`,
    { method: "POST" },
    auth,
  );
}

export function listPushCampaignAuditLog(auth: IndihubAuthHeaders, campaignId: string) {
  return indihubFetch<PushCampaignAuditLog[]>(
    `/api/admin/push-campaigns/${encodeURIComponent(campaignId)}/audit-log`,
    undefined,
    auth,
  );
}
