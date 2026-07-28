import type { MobileServiceBookingFormValues } from "./types";

type DraftEntry = {
  draft: MobileServiceBookingFormValues;
  updatedAt: number;
};

export const SERVICE_BOOKING_DRAFT_MAX_AGE_MS = 60 * 60 * 1000;
export const SERVICE_BOOKING_DRAFT_MAX_ENTRIES = 25;

const drafts = new Map<string, DraftEntry>();

export function saveServiceBookingDraft(slug: string, draft: MobileServiceBookingFormValues) {
  pruneServiceBookingDrafts();
  drafts.set(slug, { draft, updatedAt: Date.now() });
  enforceDraftLimit();
}

export function readServiceBookingDraft(slug: string) {
  pruneServiceBookingDrafts();
  return drafts.get(slug)?.draft ?? null;
}

export function clearServiceBookingDraft(slug: string) {
  drafts.delete(slug);
}

function pruneServiceBookingDrafts(now = Date.now()) {
  for (const [slug, entry] of drafts) {
    if (now - entry.updatedAt > SERVICE_BOOKING_DRAFT_MAX_AGE_MS) {
      drafts.delete(slug);
    }
  }
}

function enforceDraftLimit() {
  if (drafts.size <= SERVICE_BOOKING_DRAFT_MAX_ENTRIES) {
    return;
  }

  const entries = [...drafts.entries()].sort(([, left], [, right]) => left.updatedAt - right.updatedAt);
  for (const [slug] of entries.slice(0, drafts.size - SERVICE_BOOKING_DRAFT_MAX_ENTRIES)) {
    drafts.delete(slug);
  }
}
