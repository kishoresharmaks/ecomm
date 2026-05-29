import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type pino from "pino";
import type { EmailDeliveryResult, EmailJobPayload } from "./email-job";

export class WorkerEmailDelivery {
  constructor(private readonly logger: pino.Logger) {}

  async deliver(payload: EmailJobPayload): Promise<EmailDeliveryResult> {
    const provider = payload.provider.toLowerCase();

    if (provider === "resend") {
      return this.deliverViaResend(payload);
    }

    if (provider === "sendgrid") {
      return this.deliverViaSendGrid(payload);
    }

    if (provider === "brevo") {
      return this.deliverViaBrevo(payload);
    }

    return this.deliverViaSmtpBridgeOrLog(payload);
  }

  private async deliverViaResend(payload: EmailJobPayload): Promise<EmailDeliveryResult> {
    const apiKey = payload.providerConfig?.resendApiKey ?? process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Resend API key is required for Resend email delivery.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${payload.fromName} <${payload.fromEmail}>`,
        to: [payload.recipient],
        subject: payload.subject,
        html: payload.body,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Resend email failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as { id?: string };
    return data.id ? { providerMessageId: data.id } : {};
  }

  private async deliverViaSendGrid(payload: EmailJobPayload): Promise<EmailDeliveryResult> {
    const apiKey = payload.providerConfig?.sendgridApiKey ?? process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error("SendGrid API key is required for SendGrid email delivery.");
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.recipient }] }],
        from: { email: payload.fromEmail, name: payload.fromName },
        subject: payload.subject,
        content: [{ type: "text/html", value: payload.body }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `SendGrid email failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const messageId = response.headers.get("x-message-id");
    return messageId ? { providerMessageId: messageId } : {};
  }

  private async deliverViaBrevo(payload: EmailJobPayload): Promise<EmailDeliveryResult> {
    const apiKey = payload.providerConfig?.brevoApiKey ?? process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("Brevo API key is required for Brevo email delivery.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: payload.fromEmail, name: payload.fromName },
        to: [{ email: payload.recipient }],
        subject: payload.subject,
        htmlContent: payload.body,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Brevo email failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as { messageId?: string };
    return data.messageId ? { providerMessageId: data.messageId } : {};
  }

  private async deliverViaSmtpBridgeOrLog(payload: EmailJobPayload): Promise<EmailDeliveryResult> {
    const smtpBridgeUrl = payload.providerConfig?.smtpBridgeUrl ?? process.env.SMTP_BRIDGE_URL;

    if (payload.providerConfig?.smtpHost && payload.providerConfig.smtpPort) {
      const transportOptions: SMTPTransport.Options = {
        host: payload.providerConfig.smtpHost,
        port: payload.providerConfig.smtpPort,
        secure: payload.providerConfig.smtpSecure ?? payload.providerConfig.smtpPort === 465,
      };

      if (payload.providerConfig.smtpUsername) {
        transportOptions.auth = {
          user: payload.providerConfig.smtpUsername,
          pass: payload.providerConfig.smtpPassword ?? "",
        };
      }

      const transport = nodemailer.createTransport(transportOptions);
      const info = await transport.sendMail({
        from: `${payload.fromName} <${payload.fromEmail}>`,
        to: payload.recipient,
        subject: payload.subject,
        html: payload.body,
      });

      return info.messageId ? { providerMessageId: info.messageId } : {};
    }

    if (smtpBridgeUrl) {
      const response = await fetch(smtpBridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `SMTP bridge failed with status ${response.status}: ${await response.text()}`,
        );
      }

      const messageId = response.headers.get("x-message-id");
      return messageId ? { providerMessageId: messageId } : {};
    }

    this.logger.info(
      {
        recipient: payload.recipient,
        subject: payload.subject,
        templateCode: payload.templateCode,
      },
      "SMTP/dev email delivery logged. Configure SMTP host details or another email provider in Admin Email Settings for live sending.",
    );

    return { providerMessageId: `smtp-dev-${payload.notificationLogId}` };
  }
}
