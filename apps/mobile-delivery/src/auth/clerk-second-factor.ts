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

export function secondFactorOptions(factors?: SupportedSecondFactor[] | null): SecondFactorOption[] {
  return (factors ?? []).reduce<SecondFactorOption[]>((options, factor) => {
    if (factor.strategy === "email_code" && factor.emailAddressId) {
      options.push({
        strategy: "email_code",
        label: "Email code",
        ...(factor.safeIdentifier ? { destination: factor.safeIdentifier } : {}),
        emailAddressId: factor.emailAddressId,
      });
    } else if (factor.strategy === "phone_code" && factor.phoneNumberId) {
      options.push({
        strategy: "phone_code",
        label: "Text message",
        ...(factor.safeIdentifier ? { destination: factor.safeIdentifier } : {}),
        phoneNumberId: factor.phoneNumberId,
      });
    } else if (factor.strategy === "totp") {
      options.push({ strategy: "totp", label: "Authenticator app" });
    } else if (factor.strategy === "backup_code") {
      options.push({ strategy: "backup_code", label: "Backup code" });
    }

    return options;
  }, []);
}

export function preferredSecondFactor(options: SecondFactorOption[]) {
  return options.find((option) => option.strategy === "email_code")
    ?? options.find((option) => option.strategy === "phone_code")
    ?? options[0]
    ?? null;
}

export function secondFactorPrepareParams(option: SecondFactorOption) {
  if (option.strategy === "email_code" && option.emailAddressId) {
    return { strategy: "email_code" as const, emailAddressId: option.emailAddressId };
  }
  if (option.strategy === "phone_code" && option.phoneNumberId) {
    return { strategy: "phone_code" as const, phoneNumberId: option.phoneNumberId };
  }
  return null;
}

export function secondFactorAttemptParams(option: SecondFactorOption, code: string) {
  return { strategy: option.strategy, code: code.trim() };
}

export function canResendSecondFactor(option: SecondFactorOption | null) {
  return option?.strategy === "email_code" || option?.strategy === "phone_code";
}

export function secondFactorKey(option: SecondFactorOption) {
  return `${option.strategy}:${option.emailAddressId ?? option.phoneNumberId ?? option.destination ?? "account"}`;
}
