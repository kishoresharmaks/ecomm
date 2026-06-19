const sellerPhonePattern = /^\+?[0-9][0-9\s()-]{6,24}$/;

export function validateSellerContactPhone(value: string) {
  const phone = value.trim();
  if (!phone) {
    return undefined;
  }

  return sellerPhonePattern.test(phone)
    ? undefined
    : "Enter a valid phone number with 7 to 25 digits/symbols.";
}
