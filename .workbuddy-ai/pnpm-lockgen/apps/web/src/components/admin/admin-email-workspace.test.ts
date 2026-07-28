import { describe, expect, it } from "vitest";
import {
  buildEmailLogQueryPath,
  defaultEmailThemeTokens,
  emailThemeCreatePayload,
  emailThemePatchPayload,
  emailSettingPayload,
  emailTemplateCreatePayload,
  emailTemplatePatchPayload,
  emailTriggerUpdatePayload,
  emailWorkspaceTabLabels,
  extractTemplateVariables,
  mergeEmailThemeTokens,
  renderTemplatePreview,
  sampleTemplateVariables,
  themedEmailPreviewHtml,
  unknownTemplateVariables,
  validateEmailSettingForm,
  validateEmailTriggerForm,
  validateEmailThemeForm,
  validateEmailTemplateForm,
} from "./admin-email-utils";

describe("admin email workspace helpers", () => {
  it("exposes the admin email workspace tabs", () => {
    expect(emailWorkspaceTabLabels).toEqual([
      "Overview",
      "Templates",
      "Themes",
      "Triggers",
      "Settings",
      "Logs",
    ]);
  });

  it("builds template edit payloads without mutable code or channel fields", () => {
    expect(
      emailTemplatePatchPayload({
        name: "  Customer update  ",
        category: "CUSTOMER",
        subject: "  Updated {{ customerName }}  ",
        body: "  Hello {{ orderNumber }}  ",
        status: "PUBLISHED",
        themeId: "theme_1",
        styleOverrides: {
          brandColor: "#163B5C",
          logoUrl: "javascript:bad",
          footerText: "  Custom footer  ",
        },
      }),
    ).toEqual({
      name: "Customer update",
      category: "CUSTOMER",
      subject: "Updated {{ customerName }}",
      body: "Hello {{ orderNumber }}",
      status: "PUBLISHED",
      themeId: "theme_1",
      styleOverrides: {
        brandColor: "#163B5C",
        footerText: "Custom footer",
        logoUrl: "",
      },
    });
    expect(
      validateEmailTemplateForm({
        name: "",
        category: "CUSTOMER",
        subject: "Subject",
        body: "Body",
        status: "DRAFT",
        themeId: null,
        styleOverrides: {},
      }),
    ).toBe("Template name is required.");
    expect(
      validateEmailTemplateForm({
        name: "Name",
        category: "CUSTOMER",
        subject: "",
        body: "Body",
        status: "DRAFT",
        themeId: null,
        styleOverrides: {},
      }),
    ).toBe("Subject is required.");
    expect(
      validateEmailTemplateForm({
        name: "Name",
        category: "CUSTOMER",
        subject: "Subject",
        body: "",
        status: "DRAFT",
        themeId: null,
        styleOverrides: {},
      }),
    ).toBe("Body is required.");
    expect(
      validateEmailTemplateForm({
        name: "Name",
        category: "CUSTOMER",
        subject: "Subject",
        body: "Body",
        status: "DRAFT",
        themeId: null,
        styleOverrides: { brandColor: "orange" },
      }),
    ).toBe("Brand color override must be a 6-digit hex color.");
    expect(
      validateEmailTemplateForm({
        name: "Name",
        category: "CUSTOMER",
        subject: "Subject",
        body: "Body",
        status: "DRAFT",
        themeId: null,
        styleOverrides: { logoUrl: "javascript:bad" },
      }),
    ).toBe("Logo URL override must start with http:// or https://.");
    expect(
      validateEmailTemplateForm({
        name: "Name",
        category: "CUSTOMER",
        subject: "Subject",
        body: "Body",
        status: "DRAFT",
        themeId: null,
        styleOverrides: { borderRadius: Number.NaN },
      }),
    ).toBe("Border radius override must be between 0 and 24.");
    expect(
      emailTemplateCreatePayload({
        name: "Welcome",
        category: "CUSTOMER",
        subject: "Hi",
        body: "Hello",
        status: "DRAFT",
        themeId: null,
        styleOverrides: {},
      }),
    ).not.toHaveProperty("code");
  });

  it("builds trigger update payloads and validates trigger variables", () => {
    expect(
      emailTriggerUpdatePayload({
        templateId: "template_1",
        isEnabled: true,
        delayMinutes: 90.4,
      }),
    ).toEqual({
      templateId: "template_1",
      isEnabled: true,
      delayMinutes: 0,
    });
    expect(
      unknownTemplateVariables("Hello {{ customerName }} {{ bad }}", ["customerName"]),
    ).toEqual(["bad"]);
    expect(
      validateEmailTriggerForm({
        templateId: "template_1",
        isEnabled: true,
        delayMinutes: 0,
        templateStatus: "PUBLISHED",
        unknownVariables: [],
      }),
    ).toBe("");
    expect(
      validateEmailTriggerForm({
        templateId: "template_1",
        isEnabled: true,
        delayMinutes: 0,
        templateStatus: "PUBLISHED",
        unknownVariables: ["bad"],
      }),
    ).toContain("unsupported variables");
  });

  it("validates guided theme fields and builds theme payloads", () => {
    const form = {
      code: " order_theme ",
      name: "  Order theme  ",
      status: "PUBLISHED" as const,
      tokens: {
        ...defaultEmailThemeTokens,
        logoUrl: "https://cdn.1handindia.test/logo.png",
        brandColor: "#163B5C",
        borderRadius: 10,
      },
    };

    expect(validateEmailThemeForm(form)).toBe("");
    expect(emailThemeCreatePayload(form)).toMatchObject({
      code: "ORDER_THEME",
      name: "Order theme",
      status: "PUBLISHED",
      tokens: expect.objectContaining({
        logoUrl: "https://cdn.1handindia.test/logo.png",
        brandColor: "#163B5C",
        borderRadius: 10,
      }),
    });
    expect(emailThemePatchPayload(form)).not.toHaveProperty("code");
    expect(
      validateEmailThemeForm({
        ...form,
        tokens: { ...form.tokens, brandColor: "orange" },
      }),
    ).toBe("Brand color must be a 6-digit hex color.");
    expect(
      validateEmailThemeForm({
        ...form,
        tokens: { ...form.tokens, borderRadius: Number.NaN },
      }),
    ).toBe("Border radius must be between 0 and 24.");
  });

  it("builds email settings payloads without server readback metadata", () => {
    expect(
      emailSettingPayload({
        provider: "smtp",
        senderName: "  1HandIndia  ",
        senderEmail: "  no-reply@1handindia.test  ",
        adminRecipients: " Ops@1HandIndia.test, support@1handindia.test\nops@1handindia.test ",
        isEnabled: true,
        providerConfig: {
          brevoApiKey: " brevo-secret ",
          brevoApiKeyConfigured: false,
          resendApiKey: "",
          resendApiKeyConfigured: true,
          sendgridApiKey: "",
          sendgridApiKeyConfigured: false,
          smtpHost: " smtp.1handindia.test ",
          smtpPort: 587,
          smtpUsername: " no-reply@1handindia.test ",
          smtpPassword: " smtp-secret ",
          smtpPasswordConfigured: false,
          smtpSecure: false,
          smtpBridgeUrl: " https://email-bridge.1handindia.test/send ",
        },
        updatedAt: "2026-05-27T00:00:00.000Z",
      }),
    ).toEqual({
      provider: "smtp",
      senderName: "1HandIndia",
      senderEmail: "no-reply@1handindia.test",
      adminRecipients: "ops@1handindia.test, support@1handindia.test",
      isEnabled: true,
      providerConfig: {
        brevoApiKey: "brevo-secret",
        resendApiKey: "",
        sendgridApiKey: "",
        smtpHost: "smtp.1handindia.test",
        smtpPort: 587,
        smtpUsername: "no-reply@1handindia.test",
        smtpPassword: "smtp-secret",
        smtpSecure: false,
        smtpBridgeUrl: "https://email-bridge.1handindia.test/send",
      },
    });
    expect(
      validateEmailSettingForm({
        provider: "brevo",
        senderName: "1HandIndia",
        senderEmail: "no-reply@1handindia.test",
        adminRecipients: "bad-recipient",
        isEnabled: true,
      }),
    ).toBe("Invalid admin alert recipient: bad-recipient.");
    expect(
      validateEmailSettingForm({
        provider: "brevo",
        senderName: "1HandIndia",
        senderEmail: "no-reply@1handindia.test",
        isEnabled: true,
        providerConfig: {
          brevoApiKey: "",
          brevoApiKeyConfigured: false,
          resendApiKey: "",
          sendgridApiKey: "",
          smtpHost: "",
          smtpPort: 587,
          smtpUsername: "",
          smtpPassword: "",
          smtpSecure: false,
          smtpBridgeUrl: "",
        },
      }),
    ).toBe("Brevo API key is required before enabling Brevo.");
    expect(
      validateEmailSettingForm({
        provider: "brevo",
        senderName: "1HandIndia",
        senderEmail: "no-reply@1handindia.test",
        isEnabled: true,
        providerConfig: {
          brevoApiKey: "",
          brevoApiKeyConfigured: true,
          resendApiKey: "",
          sendgridApiKey: "",
          smtpHost: "",
          smtpPort: 587,
          smtpUsername: "",
          smtpPassword: "",
          smtpSecure: false,
          smtpBridgeUrl: "",
        },
      }),
    ).toBe("");
  });

  it("extracts variables and renders sample previews for the template editor", () => {
    const variables = extractTemplateVariables(
      "Hello {{ customerName }}, order {{ orderNumber }} for {{ customerName }}",
    );
    const sampleVariables = sampleTemplateVariables(variables);

    expect(variables).toEqual(["customerName", "orderNumber"]);
    expect(
      renderTemplatePreview("Hello {{ customerName }} - {{ orderNumber }}", sampleVariables),
    ).toBe("Hello Sample Customer - 1HI202605270001");
  });

  it("applies sample variables and theme tokens to the preview helper", () => {
    const tokens = mergeEmailThemeTokens(defaultEmailThemeTokens, {
      brandColor: "#163B5C",
      backgroundColor: "#FAF7F0",
      buttonBackgroundColor: "#163B5C",
      buttonStyle: "OUTLINE",
      footerText: "Custom footer",
    });
    const html = themedEmailPreviewHtml({
      body: "Hello {{ customerName }}\nhttps://1handindia.test/orders/1HI202605270001",
      variables: { customerName: "Preview Buyer" },
      tokens,
    });

    expect(html).toContain("Preview Buyer");
    expect(html).toContain("#163B5C");
    expect(html).toContain('href="https://1handindia.test/orders/1HI202605270001"');
    expect(html).toContain("Open link");
    expect(html).toContain("background:#FFFFFF");
    expect(html).toContain("Custom footer");
  });

  it("keeps log filters in the new admin email logs endpoint", () => {
    expect(
      buildEmailLogQueryPath({
        status: "FAILED",
        templateCode: "ORDER_PLACED_CUSTOMER",
        category: "ORDER",
        eventCode: "ORDER_PLACED_CUSTOMER",
        recipient: " customer@example.com ",
        limit: 25,
      }),
    ).toBe(
      "/api/admin/email/logs?limit=25&status=FAILED&templateCode=ORDER_PLACED_CUSTOMER&category=ORDER&eventCode=ORDER_PLACED_CUSTOMER&recipient=customer%40example.com",
    );
  });
});
