export type IdentifierMode = "email" | "phone";

export type ResetPasswordStrategy = "reset_password_email_code" | "reset_password_phone_code";

export type SupportedSecondFactor = {
  strategy: string;
  safeIdentifier?: string;
  phoneNumberId?: string;
  emailAddressId?: string;
};

export type SecondFactorOption = {
  strategy: "phone_code" | "email_code" | "totp" | "backup_code";
  label: string;
  destination?: string;
  phoneNumberId?: string;
  emailAddressId?: string;
};

export function normalizePhoneIdentifier(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return digits ? `+${digits}` : "";
}

export function validateIdentifier(identifierMode: IdentifierMode, identifier: string) {
  if (identifierMode === "phone") {
    return /^\+\d{8,15}$/.test(identifier) ? null : "Enter a valid phone number with country code.";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier) ? null : "Enter a valid email address.";
}

export function validatePasswordAuth(identifierMode: IdentifierMode, identifier: string, password: string) {
  return validateIdentifier(identifierMode, identifier) || (!password ? "Enter your password." : null);
}

export function validateSignUp(identifierMode: IdentifierMode, identifier: string, password: string, fullName: string) {
  if (!fullName.trim()) {
    return "Enter your full name.";
  }

  return validateIdentifier(identifierMode, identifier) || (password.length < 8 ? "Password must be at least 8 characters." : null);
}

export function resetPasswordStrategy(identifierMode: IdentifierMode): ResetPasswordStrategy {
  return identifierMode === "phone" ? "reset_password_phone_code" : "reset_password_email_code";
}

export function secondFactorOptions(factors?: SupportedSecondFactor[] | null): SecondFactorOption[] {
  return (factors ?? []).reduce<SecondFactorOption[]>((options, factor) => {
    if (factor.strategy === "phone_code" && factor.phoneNumberId) {
      options.push({
        strategy: "phone_code" as const,
        label: "Text message",
        ...(factor.safeIdentifier ? { destination: factor.safeIdentifier } : {}),
        phoneNumberId: factor.phoneNumberId,
      });
      return options;
    }

    if (factor.strategy === "email_code" && factor.emailAddressId) {
      options.push({
        strategy: "email_code" as const,
        label: "Email code",
        ...(factor.safeIdentifier ? { destination: factor.safeIdentifier } : {}),
        emailAddressId: factor.emailAddressId,
      });
      return options;
    }

    if (factor.strategy === "totp") {
      options.push({ strategy: "totp" as const, label: "Authenticator app" });
      return options;
    }

    if (factor.strategy === "backup_code") {
      options.push({ strategy: "backup_code" as const, label: "Backup code" });
      return options;
    }

    return options;
  }, []);
}

export function secondFactorPrepareParams(option: SecondFactorOption) {
  if (option.strategy === "phone_code" && option.phoneNumberId) {
    return { strategy: "phone_code" as const, phoneNumberId: option.phoneNumberId };
  }

  if (option.strategy === "email_code" && option.emailAddressId) {
    return { strategy: "email_code" as const, emailAddressId: option.emailAddressId };
  }

  return null;
}

export function secondFactorAttemptParams(option: SecondFactorOption, code: string) {
  return { strategy: option.strategy, code: code.trim() };
}
