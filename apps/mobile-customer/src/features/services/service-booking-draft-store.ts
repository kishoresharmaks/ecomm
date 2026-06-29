import type { MobileServiceBookingFormValues } from "./types";

const drafts = new Map<string, MobileServiceBookingFormValues>();

export function saveServiceBookingDraft(slug: string, draft: MobileServiceBookingFormValues) {
  drafts.set(slug, draft);
}

export function readServiceBookingDraft(slug: string) {
  return drafts.get(slug) ?? null;
}

export function clearServiceBookingDraft(slug: string) {
  drafts.delete(slug);
}
