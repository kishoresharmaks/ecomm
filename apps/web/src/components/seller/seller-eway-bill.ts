export const EWAY_BILL_LOCK_WARNING =
  "Important: Please double-check your 12-digit E-Way Bill Number before saving. Once recorded, it becomes permanently non-editable for statutory GST compliance and courier audit integrity.";

export function isValidEWayBillNumber(value: string) {
  return /^\d{12}$/.test(value);
}
