import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailDeliveryService } from "../notifications/email-delivery.service";
import type { EmailJobPayload, EmailProviderConfig } from "../notifications/email-job";

export type NewsletterStatus = "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED";

const NEWSLETTER_WELCOME_SUBJECT = "Welcome to 1HandIndia!";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildWelcomeHtml(name?: string): string {
  const safeName = name ? escapeHtml(name) : "";
  const greeting = safeName ? `Hi ${safeName},` : "Hi there,";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#FFFCFB;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
        <tr><td style="padding-bottom:24px">
          <h1 style="font-size:24px;margin:0;color:#ED3500">1HandIndia</h1>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #F1D7CF">
          <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6">
            Thanks for subscribing to the <strong>1HandIndia</strong> newsletter!
          </p>
          <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6">
            You'll now receive the best deals, marketplace updates, and exclusive offers right in your inbox.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#ED3500;border-radius:9999px;padding:12px 24px">
              <a href="https://www.1handindia.com/deals" style="color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">Browse Latest Deals</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:13px;color:#667085">
            If you didn't sign up, you can ignore this email or reply to unsubscribe.
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;font-size:12px;color:#667085;text-align:center">
          (c) ${new Date().getFullYear()} 1HandIndia. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailDeliveryService) private readonly emailDeliveryService: EmailDeliveryService,
  ) {}

  async subscribe(input: {
    email: string;
    name?: string | null | undefined;
    source?: string | null | undefined;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
  }): Promise<{ success: boolean; message: string; status: NewsletterStatus }> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.client.newsletterSubscriber.findUnique({
      where: { email },
      select: { status: true, name: true },
    });

    if (existing?.status === "ACTIVE") {
      return { success: true, message: "You are already subscribed.", status: "ACTIVE" };
    }

    if (existing?.status === "UNSUBSCRIBED") {
      await this.prisma.client.newsletterSubscriber.update({
        where: { email },
        data: {
          status: "ACTIVE",
          name: input.name ?? existing.name ?? null,
          source: input.source ?? "footer",
          unsubscribedAt: null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      await this.sendWelcomeEmail(email, input.name ?? existing.name ?? undefined);
      return { success: true, message: "Welcome back! You've been re-subscribed.", status: "ACTIVE" };
    }

    await this.prisma.client.newsletterSubscriber.create({
      data: {
        email,
        name: input.name ?? null,
        source: input.source ?? "footer",
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    await this.sendWelcomeEmail(email, input.name ?? undefined);
    return { success: true, message: "Welcome aboard! Check your inbox.", status: "ACTIVE" };
  }

  async listSubscribers(query: {
    page: number;
    limit: number;
    search?: string | undefined;
    status?: string | undefined;
    source?: string | undefined;
  }) {
    const { page, limit, search, status, source } = query;
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (source) {
      where.source = source;
    }

    const [items, total] = await Promise.all([
      this.prisma.client.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.newsletterSubscriber.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async unsubscribe(email: string): Promise<{ success: boolean; message: string }> {
    const trimmed = email.trim().toLowerCase();

    const existing = await this.prisma.client.newsletterSubscriber.findUnique({
      where: { email: trimmed },
      select: { email: true, status: true },
    });

    if (!existing) {
      return { success: true, message: "You were not subscribed." };
    }

    if (existing.status === "UNSUBSCRIBED") {
      return { success: true, message: "You are already unsubscribed." };
    }

    await this.prisma.client.newsletterSubscriber.update({
      where: { email: trimmed },
      data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
    });

    return { success: true, message: "You've been unsubscribed." };
  }

  async resendWelcome(email: string, name?: string | undefined): Promise<{ success: boolean; message: string }> {
    const trimmed = email.trim().toLowerCase();
    const existing = await this.prisma.client.newsletterSubscriber.findUnique({
      where: { email: trimmed },
      select: { status: true, name: true },
    });

    if (!existing || existing.status !== "ACTIVE") {
      throw new NotFoundException("Active subscriber not found.");
    }

    await this.sendWelcomeEmail(trimmed, name ?? existing.name ?? undefined);
    return { success: true, message: "Welcome email resent." };
  }

  private async sendWelcomeEmail(email: string, name?: string | undefined): Promise<void> {
    try {
      const fromEmail =
        (await this.prisma.client.emailSetting.findFirst({
          where: { isEnabled: true },
          select: { senderEmail: true, senderName: true },
        })) ??
        (await this.prisma.client.emailSetting.findFirst({
          select: { senderEmail: true, senderName: true },
        }));

      const fromName = fromEmail?.senderName ?? "1HandIndia";
      const fromAddr = fromEmail?.senderEmail ?? "noreply@1handindia.com";

      const providerConfig: EmailProviderConfig = {};
      if (process.env.RESEND_API_KEY) {
        providerConfig.resendApiKey = process.env.RESEND_API_KEY;
      }
      if (process.env.SENDGRID_API_KEY) {
        providerConfig.sendgridApiKey = process.env.SENDGRID_API_KEY;
      }

      const hasProviderConfig = Object.keys(providerConfig).length > 0;
      const provider = providerConfig.resendApiKey
        ? "resend"
        : providerConfig.sendgridApiKey
          ? "sendgrid"
          : "smtp";

      const payload: EmailJobPayload = {
        notificationLogId: randomUUID(),
        provider,
        ...(hasProviderConfig ? { providerConfig } : {}),
        recipient: email,
        subject: NEWSLETTER_WELCOME_SUBJECT,
        body: buildWelcomeHtml(name ?? undefined),
        fromName,
        fromEmail: fromAddr,
        templateCode: "NEWSLETTER_WELCOME",
        jobMetadata: {
          schemaVersion: 1 as const,
          idempotencyKey: `newsletter-welcome-${email}`,
          correlationId: randomUUID(),
        },
      };

      await this.emailDeliveryService.deliver(payload);
    } catch (error) {
      this.logger.warn(`Failed to send newsletter welcome email to ${email}: ${(error as Error).message}`);
    }
  }
}
