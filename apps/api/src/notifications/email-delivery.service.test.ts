import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailJobPayload } from "./email-job";
import { EmailDeliveryService } from "./email-delivery.service";

const sendMailMock = vi.hoisted(() => vi.fn());
const createTransportMock = vi.hoisted(() => vi.fn(() => ({ sendMail: sendMailMock })));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

describe("EmailDeliveryService", () => {
  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    createTransportMock.mockClear();
    sendMailMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends Brevo transactional email payloads and returns the provider message id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "<202605261350.123@relay.brevo.test>" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new EmailDeliveryService();
    const result = await service.deliver(
      createPayload({
        provider: "brevo",
        providerConfig: { brevoApiKey: "brevo_test_key" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": "brevo_test_key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: "no-reply@1handindia.test", name: "1HandIndia" },
        to: [{ email: "customer@example.com" }],
        subject: "Order placed",
        htmlContent: "<p>Your order is placed.</p>",
      }),
    });
    expect(result).toEqual({ providerMessageId: "<202605261350.123@relay.brevo.test>" });
  });

  it("requires a configured Brevo API key for Brevo delivery", async () => {
    const service = new EmailDeliveryService();

    await expect(service.deliver(createPayload({ provider: "brevo" }))).rejects.toThrow(
      "Brevo API key is required",
    );
  });

  it("sends SMTP email through configured host details before using the dev log fallback", async () => {
    sendMailMock.mockResolvedValue({ messageId: "<smtp-message-1@1handindia.test>" });
    const service = new EmailDeliveryService();

    const result = await service.deliver(
      createPayload({
        provider: "smtp",
        providerConfig: {
          smtpHost: "smtp.1handindia.test",
          smtpPort: 587,
          smtpUsername: "mailer@1handindia.test",
          smtpPassword: "smtp-secret",
          smtpSecure: false,
        },
      }),
    );

    expect(createTransportMock).toHaveBeenCalledWith({
      host: "smtp.1handindia.test",
      port: 587,
      secure: false,
      auth: {
        user: "mailer@1handindia.test",
        pass: "smtp-secret",
      },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "1HandIndia <no-reply@1handindia.test>",
      to: "customer@example.com",
      subject: "Order placed",
      html: "<p>Your order is placed.</p>",
    });
    expect(result).toEqual({ providerMessageId: "<smtp-message-1@1handindia.test>" });
  });
});

function createPayload(overrides: Partial<EmailJobPayload> = {}): EmailJobPayload {
  return {
    notificationLogId: "log_1",
    provider: "smtp",
    recipient: "customer@example.com",
    subject: "Order placed",
    body: "<p>Your order is placed.</p>",
    fromName: "1HandIndia",
    fromEmail: "no-reply@1handindia.test",
    templateCode: "ORDER_PLACED_CUSTOMER",
    ...overrides,
  };
}
