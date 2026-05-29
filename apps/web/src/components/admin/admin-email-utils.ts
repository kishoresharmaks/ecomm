export type EmailTemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type EmailThemeStatus = EmailTemplateStatus;
export type EmailTemplateCategory =
  | "CUSTOMER"
  | "SELLER"
  | "B2B"
  | "ORDER"
  | "PAYMENT"
  | "PRODUCT"
  | "SUPPORT"
  | "ADMIN"
  | "SYSTEM";
export type EmailRecipientType =
  | "CUSTOMER"
  | "SELLER"
  | "BUSINESS_BUYER"
  | "ADMIN"
  | "SUPPORT_REQUESTER";
export type EmailThemeButtonStyle = "SOLID" | "OUTLINE";
export type EmailThemeFontFamily = "Arial" | "Inter" | "Georgia" | "Verdana" | "Tahoma";

export type EmailThemeTokens = {
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonStyle: EmailThemeButtonStyle;
  footerText: string;
  borderRadius: number;
  fontFamily: EmailThemeFontFamily;
};

export type EmailTemplateFormState = {
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  status: EmailTemplateStatus;
  themeId: string | null;
  styleOverrides: Partial<EmailThemeTokens>;
};

export type EmailThemeFormState = {
  code: string;
  name: string;
  status: EmailThemeStatus;
  tokens: EmailThemeTokens;
};

export type EmailProviderConfig = {
  brevoApiKey: string;
  brevoApiKeyConfigured?: boolean;
  resendApiKey: string;
  resendApiKeyConfigured?: boolean;
  sendgridApiKey: string;
  sendgridApiKeyConfigured?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpPasswordConfigured?: boolean;
  smtpSecure: boolean;
  smtpBridgeUrl: string;
};

export type EmailSettingPayloadInput = {
  provider: string;
  senderName: string;
  senderEmail: string;
  adminRecipients?: string | null;
  isEnabled: boolean;
  providerConfig?: EmailProviderConfig | null;
  updatedAt?: string | null;
};

export const defaultEmailThemeTokens: EmailThemeTokens = {
  logoUrl: "",
  brandColor: "#ED3500",
  accentColor: "#163B5C",
  backgroundColor: "#FFFCFB",
  surfaceColor: "#FFFFFF",
  textColor: "#1F2933",
  mutedTextColor: "#667085",
  buttonBackgroundColor: "#ED3500",
  buttonTextColor: "#FFFFFF",
  buttonStyle: "SOLID",
  footerText: "You received this transactional email from 1HandIndia.",
  borderRadius: 8,
  fontFamily: "Arial",
};

export const emailThemeFontOptions: EmailThemeFontFamily[] = [
  "Arial",
  "Inter",
  "Georgia",
  "Verdana",
  "Tahoma",
];

export const emailWorkspaceTabLabels = [
  "Overview",
  "Templates",
  "Themes",
  "Triggers",
  "Settings",
  "Logs",
] as const;

export const emailTemplateCategories: EmailTemplateCategory[] = [
  "CUSTOMER",
  "SELLER",
  "B2B",
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "SUPPORT",
  "ADMIN",
  "SYSTEM",
];

export function buildEmailLogQueryPath({
  status,
  templateCode,
  category,
  eventCode,
  recipientType,
  recipient,
  limit = 50,
}: {
  status?: string | undefined;
  templateCode?: string | undefined;
  category?: string | undefined;
  eventCode?: string | undefined;
  recipientType?: string | undefined;
  recipient?: string | undefined;
  limit?: number | undefined;
}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (status) {
    params.set("status", status);
  }
  if (templateCode) {
    params.set("templateCode", templateCode);
  }
  if (category) {
    params.set("category", category);
  }
  if (eventCode) {
    params.set("eventCode", eventCode);
  }
  if (recipientType) {
    params.set("recipientType", recipientType);
  }
  if (recipient?.trim()) {
    params.set("recipient", recipient.trim());
  }

  return `/api/admin/email/logs?${params.toString()}`;
}

export function emailTemplatePatchPayload(form: EmailTemplateFormState) {
  return {
    name: form.name.trim(),
    category: form.category,
    subject: form.subject.trim(),
    body: form.body.trim(),
    status: form.status,
    themeId: form.themeId || null,
    styleOverrides: cleanThemeTokenOverrides(form.styleOverrides),
  };
}

export function emailTemplateCreatePayload(form: EmailTemplateFormState) {
  return emailTemplatePatchPayload(form);
}

export function emailTriggerUpdatePayload(form: {
  templateId: string | null;
  isEnabled: boolean;
  delayMinutes: number;
}) {
  return {
    templateId: form.templateId || null,
    isEnabled: form.isEnabled,
    delayMinutes: Number.isFinite(form.delayMinutes)
      ? Math.max(0, Math.min(10080, Math.round(form.delayMinutes)))
      : 0,
  };
}

export function emailThemeCreatePayload(form: EmailThemeFormState) {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    status: form.status,
    tokens: sanitizeThemeTokens(form.tokens),
  };
}

export function emailThemePatchPayload(form: EmailThemeFormState) {
  return {
    name: form.name.trim(),
    status: form.status,
    tokens: sanitizeThemeTokens(form.tokens),
  };
}

export function emailSettingPayload(form: EmailSettingPayloadInput) {
  return {
    provider: form.provider,
    senderName: form.senderName.trim(),
    senderEmail: form.senderEmail.trim(),
    adminRecipients: sanitizeRecipientList(form.adminRecipients ?? ""),
    isEnabled: form.isEnabled,
    providerConfig: sanitizeProviderConfig(form.providerConfig),
  };
}

export function validateEmailSettingForm(form: EmailSettingPayloadInput) {
  if (!form.senderName.trim()) {
    return "Sender name is required.";
  }

  if (!form.senderEmail.trim()) {
    return "Sender email is required.";
  }

  const invalidRecipient = invalidRecipientAddress(form.adminRecipients ?? "");
  if (invalidRecipient) {
    return `Invalid admin alert recipient: ${invalidRecipient}.`;
  }

  const config = form.providerConfig;
  const smtpPort = Number(config?.smtpPort ?? 0);
  if (config?.smtpBridgeUrl.trim() && !isSafeHttpUrl(config.smtpBridgeUrl.trim())) {
    return "SMTP bridge URL must start with http:// or https://.";
  }

  if (!form.isEnabled) {
    return "";
  }

  if (form.provider === "smtp") {
    const hasBridge = Boolean(config?.smtpBridgeUrl.trim());
    const hasDirectSmtp = Boolean(config?.smtpHost.trim() && smtpPort >= 1 && smtpPort <= 65535);
    if (!hasBridge && !hasDirectSmtp) {
      return "SMTP host and port, or SMTP bridge URL, are required before enabling SMTP.";
    }
  }

  if (form.provider === "brevo" && !config?.brevoApiKey.trim() && !config?.brevoApiKeyConfigured) {
    return "Brevo API key is required before enabling Brevo.";
  }

  if (
    form.provider === "resend" &&
    !config?.resendApiKey.trim() &&
    !config?.resendApiKeyConfigured
  ) {
    return "Resend API key is required before enabling Resend.";
  }

  if (
    form.provider === "sendgrid" &&
    !config?.sendgridApiKey.trim() &&
    !config?.sendgridApiKeyConfigured
  ) {
    return "SendGrid API key is required before enabling SendGrid.";
  }

  return "";
}

export function validateEmailTemplateForm(form: EmailTemplateFormState) {
  if (!form.name.trim()) {
    return "Template name is required.";
  }

  if (!form.subject.trim()) {
    return "Subject is required.";
  }

  if (!form.body.trim()) {
    return "Body is required.";
  }

  if (
    typeof form.styleOverrides.logoUrl === "string" &&
    form.styleOverrides.logoUrl.trim() &&
    !isSafeHttpUrl(form.styleOverrides.logoUrl.trim())
  ) {
    return "Logo URL override must start with http:// or https://.";
  }

  for (const color of emailThemeColorFields) {
    const value = form.styleOverrides[color];
    if (value !== undefined && value !== "" && !isHexColor(value)) {
      return `${emailThemeTokenLabels[color]} override must be a 6-digit hex color.`;
    }
  }

  if (form.styleOverrides.borderRadius !== undefined) {
    if (
      !Number.isFinite(form.styleOverrides.borderRadius) ||
      form.styleOverrides.borderRadius < 0 ||
      form.styleOverrides.borderRadius > 24
    ) {
      return "Border radius override must be between 0 and 24.";
    }
  }

  return "";
}

export function unknownTemplateVariables(templateText: string, allowedVariables: string[]) {
  const allowed = new Set(allowedVariables);
  return extractTemplateVariables(templateText).filter((variable) => !allowed.has(variable));
}

export function validateEmailTriggerForm(form: {
  templateId: string | null;
  isEnabled: boolean;
  delayMinutes: number;
  unknownVariables: string[];
  templateStatus?: EmailTemplateStatus | undefined;
}) {
  if (!Number.isFinite(form.delayMinutes) || form.delayMinutes < 0 || form.delayMinutes > 10080) {
    return "Delay must be between 0 minutes and 7 days.";
  }

  if (!form.isEnabled) {
    return "";
  }

  if (!form.templateId) {
    return "Enabled triggers require a selected template.";
  }

  if (form.templateStatus !== "PUBLISHED") {
    return "Enabled triggers require a published template.";
  }

  if (form.unknownVariables.length) {
    return `Template uses unsupported variables for this trigger: ${form.unknownVariables.join(", ")}.`;
  }

  return "";
}

export function validateEmailThemeForm(form: EmailThemeFormState, { requireCode = true } = {}) {
  if (requireCode && !form.code.trim()) {
    return "Theme code is required.";
  }

  if (form.code.trim() && !/^[A-Z0-9_]+$/.test(form.code.trim().toUpperCase())) {
    return "Theme code can use only uppercase letters, numbers, and underscores.";
  }

  if (!form.name.trim()) {
    return "Theme name is required.";
  }

  if (form.tokens.logoUrl.trim() && !isSafeHttpUrl(form.tokens.logoUrl.trim())) {
    return "Logo URL must start with http:// or https://.";
  }

  for (const color of emailThemeColorFields) {
    if (!isHexColor(form.tokens[color])) {
      return `${emailThemeTokenLabels[color]} must be a 6-digit hex color.`;
    }
  }

  if (
    !Number.isFinite(form.tokens.borderRadius) ||
    form.tokens.borderRadius < 0 ||
    form.tokens.borderRadius > 24
  ) {
    return "Border radius must be between 0 and 24.";
  }

  return "";
}

export function mergeEmailThemeTokens(
  tokens?: Partial<EmailThemeTokens> | null,
  overrides?: Partial<EmailThemeTokens> | null,
): EmailThemeTokens {
  return sanitizeThemeTokens({
    ...defaultEmailThemeTokens,
    ...(tokens ?? {}),
    ...(overrides ?? {}),
  });
}

export function themedEmailPreviewHtml({
  body,
  variables,
  tokens,
}: {
  body: string;
  variables: Record<string, string>;
  tokens: EmailThemeTokens | Partial<EmailThemeTokens>;
}) {
  const merged = mergeEmailThemeTokens(tokens);
  const renderedBody = renderTemplatePreview(body, variables);
  const fontFamily = fontStack(merged.fontFamily);
  const logo = merged.logoUrl
    ? `<img src="${escapeAttribute(merged.logoUrl)}" alt="1HandIndia" style="display:block;max-width:144px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<div style="display:inline-block;color:${merged.brandColor};font-size:22px;font-weight:800;line-height:1;">1HandIndia</div>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:${merged.backgroundColor};color:${merged.textColor};font-family:${fontFamily};"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${merged.backgroundColor};"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:560px;background:${merged.surfaceColor};border:1px solid #E5E7EB;border-radius:${merged.borderRadius}px;overflow:hidden;"><tr><td style="padding:24px 24px 16px;border-bottom:4px solid ${merged.brandColor};">${logo}</td></tr><tr><td style="padding:24px;">${textToPreviewParagraphs(renderedBody, merged)}</td></tr><tr><td style="padding:18px 24px;background:${merged.backgroundColor};color:${merged.mutedTextColor};font-size:12px;line-height:18px;">${escapeHtml(merged.footerText)}</td></tr></table></td></tr></table></body></html>`;
}

export function extractTemplateVariables(value: string) {
  return [
    ...new Set(
      [...value.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)]
        .map((match) => match[1])
        .filter((variable): variable is string => Boolean(variable)),
    ),
  ].sort();
}

export function sampleTemplateVariables(variables: string[]) {
  return Object.fromEntries(variables.map((variable) => [variable, sampleVariableValue(variable)]));
}

export function renderTemplatePreview(template: string, variables: Record<string, string>) {
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
    (_, key: string) => variables[key] ?? "",
  );
}

export const emailThemeColorFields: Array<
  keyof Pick<
    EmailThemeTokens,
    | "brandColor"
    | "accentColor"
    | "backgroundColor"
    | "surfaceColor"
    | "textColor"
    | "mutedTextColor"
    | "buttonBackgroundColor"
    | "buttonTextColor"
  >
> = [
  "brandColor",
  "accentColor",
  "backgroundColor",
  "surfaceColor",
  "textColor",
  "mutedTextColor",
  "buttonBackgroundColor",
  "buttonTextColor",
];

export const emailThemeTokenLabels: Record<keyof EmailThemeTokens, string> = {
  logoUrl: "Logo URL",
  brandColor: "Brand color",
  accentColor: "Accent color",
  backgroundColor: "Background color",
  surfaceColor: "Surface color",
  textColor: "Text color",
  mutedTextColor: "Muted text color",
  buttonBackgroundColor: "Button background",
  buttonTextColor: "Button text",
  buttonStyle: "Button style",
  footerText: "Footer text",
  borderRadius: "Border radius",
  fontFamily: "Font",
};

function sanitizeThemeTokens(tokens: Partial<EmailThemeTokens>): EmailThemeTokens {
  const base = defaultEmailThemeTokens;

  return {
    logoUrl: sanitizeLogoUrl(tokens.logoUrl, base.logoUrl),
    brandColor: sanitizeHex(tokens.brandColor, base.brandColor),
    accentColor: sanitizeHex(tokens.accentColor, base.accentColor),
    backgroundColor: sanitizeHex(tokens.backgroundColor, base.backgroundColor),
    surfaceColor: sanitizeHex(tokens.surfaceColor, base.surfaceColor),
    textColor: sanitizeHex(tokens.textColor, base.textColor),
    mutedTextColor: sanitizeHex(tokens.mutedTextColor, base.mutedTextColor),
    buttonBackgroundColor: sanitizeHex(tokens.buttonBackgroundColor, base.buttonBackgroundColor),
    buttonTextColor: sanitizeHex(tokens.buttonTextColor, base.buttonTextColor),
    buttonStyle: tokens.buttonStyle === "OUTLINE" ? "OUTLINE" : "SOLID",
    footerText: sanitizeText(tokens.footerText, base.footerText),
    borderRadius: sanitizeRadius(tokens.borderRadius, base.borderRadius),
    fontFamily: emailThemeFontOptions.includes(tokens.fontFamily as EmailThemeFontFamily)
      ? (tokens.fontFamily as EmailThemeFontFamily)
      : base.fontFamily,
  };
}

function sanitizeProviderConfig(config?: EmailProviderConfig | null) {
  const smtpPort = Number(config?.smtpPort ?? 587);

  return {
    brevoApiKey: config?.brevoApiKey.trim() ?? "",
    resendApiKey: config?.resendApiKey.trim() ?? "",
    sendgridApiKey: config?.sendgridApiKey.trim() ?? "",
    smtpHost: config?.smtpHost.trim() ?? "",
    smtpPort: Number.isInteger(smtpPort) ? smtpPort : 587,
    smtpUsername: config?.smtpUsername.trim() ?? "",
    smtpPassword: config?.smtpPassword.trim() ?? "",
    smtpSecure: Boolean(config?.smtpSecure),
    smtpBridgeUrl: config?.smtpBridgeUrl.trim() ?? "",
  };
}

function sanitizeRecipientList(value: string) {
  return uniqueRecipients(value).join(", ");
}

function invalidRecipientAddress(value: string) {
  return uniqueRecipients(value).find((recipient) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient));
}

function uniqueRecipients(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function cleanThemeTokenOverrides(tokens: Partial<EmailThemeTokens>) {
  const cleaned: Partial<EmailThemeTokens> = {};

  if (tokens.logoUrl !== undefined) {
    cleaned.logoUrl = sanitizeLogoUrl(tokens.logoUrl, "");
  }

  if (tokens.footerText !== undefined) {
    cleaned.footerText = String(tokens.footerText).trim();
  }

  for (const field of emailThemeColorFields) {
    if (tokens[field] && isHexColor(tokens[field])) {
      cleaned[field] = tokens[field];
    }
  }

  if (tokens.buttonStyle === "SOLID" || tokens.buttonStyle === "OUTLINE") {
    cleaned.buttonStyle = tokens.buttonStyle;
  }

  if (tokens.borderRadius !== undefined) {
    const numeric = Number(tokens.borderRadius);
    if (Number.isFinite(numeric)) {
      cleaned.borderRadius = sanitizeRadius(numeric, defaultEmailThemeTokens.borderRadius);
    }
  }

  if (emailThemeFontOptions.includes(tokens.fontFamily as EmailThemeFontFamily)) {
    cleaned.fontFamily = tokens.fontFamily as EmailThemeFontFamily;
  }

  return cleaned;
}

function sanitizeLogoUrl(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return !trimmed || isSafeHttpUrl(trimmed) ? trimmed : fallback;
}

function sanitizeText(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeHex(value: unknown, fallback: string) {
  return typeof value === "string" && isHexColor(value) ? value : fallback;
}

function sanitizeRadius(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(24, Math.max(0, Math.round(numeric))) : fallback;
}

function isHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function textToPreviewParagraphs(value: string, tokens: EmailThemeTokens) {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const raw = line.trim();
      if (!raw) {
        return `<div style="height:12px;line-height:12px;">&nbsp;</div>`;
      }

      if (isSafeHttpUrl(raw)) {
        return previewButtonHtml(raw, tokens);
      }

      const html = escapeHtml(raw);
      return `<p style="margin:0 0 14px;color:${tokens.textColor};font-size:15px;line-height:24px;font-weight:600;">${html}</p>`;
    })
    .join("");
}

function previewButtonHtml(url: string, tokens: EmailThemeTokens) {
  const background =
    tokens.buttonStyle === "OUTLINE" ? tokens.surfaceColor : tokens.buttonBackgroundColor;
  const color =
    tokens.buttonStyle === "OUTLINE" ? tokens.buttonBackgroundColor : tokens.buttonTextColor;

  return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:4px 0 18px;"><tr><td><a href="${escapeAttribute(url)}" style="display:inline-block;background:${background};border:1px solid ${tokens.buttonBackgroundColor};border-radius:${tokens.borderRadius}px;color:${color};font-size:14px;font-weight:800;line-height:20px;padding:12px 18px;text-decoration:none;">Open link</a></td></tr></table>`;
}

function fontStack(font: EmailThemeFontFamily) {
  if (font === "Georgia") {
    return "Georgia, 'Times New Roman', serif";
  }
  if (font === "Verdana") {
    return "Verdana, Geneva, sans-serif";
  }
  if (font === "Tahoma") {
    return "Tahoma, Geneva, sans-serif";
  }
  if (font === "Inter") {
    return "Inter, Arial, Helvetica, sans-serif";
  }

  return "Arial, Helvetica, sans-serif";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sampleVariableValue(variable: string) {
  const key = variable.toLowerCase();
  if (key.includes("ordernumber")) {
    return "1HI202605270001";
  }
  if (key.includes("customer") || key.includes("buyer")) {
    return "Sample Customer";
  }
  if (key.includes("seller") || key.includes("store")) {
    return "Sample Store";
  }
  if (key.includes("amount") || key.includes("total") || key.includes("price")) {
    return "INR 1,250.00";
  }
  if (key.includes("status")) {
    return "Confirmed";
  }
  if (key.includes("date")) {
    return "27 May 2026";
  }

  return "Sample value";
}
