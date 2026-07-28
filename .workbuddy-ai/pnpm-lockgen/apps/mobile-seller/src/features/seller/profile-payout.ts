export type SellerPayoutProfileFormFields = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
};

export type SellerPayoutProfilePayload = {
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
};

function trimmed(value: string) {
  const next = value.trim();
  return next.length ? next : undefined;
}

export function buildSellerPayoutProfilePayload(
  fields: SellerPayoutProfileFormFields,
): SellerPayoutProfilePayload | undefined {
  const payload: SellerPayoutProfilePayload = {};
  const accountHolderName = trimmed(fields.accountHolderName);
  const bankName = trimmed(fields.bankName);
  const accountNumber = trimmed(fields.accountNumber);
  const ifscCode = trimmed(fields.ifscCode);
  const upiId = trimmed(fields.upiId);

  if (accountHolderName) payload.accountHolderName = accountHolderName;
  if (bankName) payload.bankName = bankName;
  if (accountNumber) payload.accountNumber = accountNumber;
  if (ifscCode) payload.ifscCode = ifscCode;
  if (upiId) payload.upiId = upiId;

  return Object.keys(payload).length ? payload : undefined;
}
