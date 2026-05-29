import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ContentStatus,
  EmailRecipientType,
  EmailTemplateCategory,
  NotificationChannel,
  NotificationStatus,
  Prisma,
  RoleCode,
  UserStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { paginationFromQuery } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateEmailTemplateDto,
  CreateEmailThemeDto,
  EmailTemplateQueryDto,
  EmailThemeTokensDto,
  UpdateEmailTemplateDto,
  UpdateEmailThemeDto,
} from "./dto/email-template.dto";
import { UpdateEmailTriggerRuleDto } from "./dto/email-trigger.dto";
import { EmailDeliveryService } from "./email-delivery.service";
import { emailTriggerCatalog, findEmailTriggerCatalogItem } from "./email-trigger-catalog";
import type { EmailJobPayload, EmailProviderConfig } from "./email-job";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationQueueService } from "./notification-queue.service";

type TemplateVariables = Record<string, string | number | boolean | null | undefined>;

type NotificationInput = {
  templateCode: string;
  recipient: string;
  userId?: string | null;
  variables?: TemplateVariables;
};

type TriggerNotificationInput = {
  eventCode: string;
  recipientType: EmailRecipientType;
  recipient: string;
  userId?: string | null;
  variables?: TemplateVariables;
};

type NotificationLogContext = {
  eventCode?: string;
  recipientType?: EmailRecipientType;
  triggerRuleId?: string | null;
  scheduledFor?: Date | null;
};

type RenderedEmail = {
  subject: string;
  body: string;
};

type EmailThemeTokens = {
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonStyle: "SOLID" | "OUTLINE";
  footerText: string;
  borderRadius: number;
  fontFamily: "Arial" | "Inter" | "Georgia" | "Verdana" | "Tahoma";
};

type ThemeableTemplate = {
  subject: string;
  body: string;
  styleOverrides?: Prisma.JsonValue | null;
  theme?: {
    status: ContentStatus;
    tokens: Prisma.JsonValue;
  } | null;
};

const DEFAULT_EMAIL_THEME_CODE = "DEFAULT_1HANDINDIA";
const DEFAULT_EMAIL_THEME_TOKENS: EmailThemeTokens = {
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
const EMAIL_RETRY_SEND_WINDOW_MINUTES = nonNegativeEnvNumber(
  "EMAIL_RETRY_SEND_WINDOW_MINUTES",
  60,
);
const EMAIL_DELIVERY_LOCK_PREFIX = "delivery-lock:";
const EMAIL_DELIVERY_LOCK_STALE_MINUTES = nonNegativeEnvNumber(
  "EMAIL_DELIVERY_LOCK_STALE_MINUTES",
  10,
);

const safeFontFallbacks: Record<EmailThemeTokens["fontFamily"], string> = {
  Arial: "Arial, Helvetica, sans-serif",
  Inter: "Inter, Arial, Helvetica, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Verdana: "Verdana, Geneva, sans-serif",
  Tahoma: "Tahoma, Geneva, sans-serif",
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationQueueService) private readonly queue: NotificationQueueService,
    @Inject(EmailDeliveryService) private readonly emailDelivery: EmailDeliveryService,
  ) {}

  async notify(input: NotificationInput) {
    try {
      return await this.notifyOrThrow(input);
    } catch (error) {
      this.logger.warn(
        `Notification ${input.templateCode} failed for ${input.recipient}: ${String(error)}`,
      );
      return null;
    }
  }

  async notifyAdmins(templateCode: string, variables?: TemplateVariables) {
    const recipients = await this.resolveAdminRecipients();
    await Promise.all(
      recipients.map((recipient) =>
        this.notify({
          templateCode,
          recipient,
          ...(variables ? { variables } : {}),
        }),
      ),
    );
  }

  async notifyEvent(input: TriggerNotificationInput) {
    try {
      return await this.notifyEventOrThrow(input);
    } catch (error) {
      this.logger.warn(
        `Notification event ${input.eventCode}/${input.recipientType} failed for ${input.recipient}: ${String(error)}`,
      );
      return null;
    }
  }

  async notifyAdminEvent(eventCode: string, variables?: TemplateVariables) {
    const recipients = await this.resolveAdminRecipients();
    await Promise.all(
      recipients.map((recipient) =>
        this.notifyEvent({
          eventCode,
          recipientType: EmailRecipientType.ADMIN,
          recipient,
          ...(variables ? { variables } : {}),
        }),
      ),
    );
  }

  async listLogs(query: NotificationQueryDto) {
    const { page, skip, take } = paginationFromQuery(query, { defaultLimit: 50 });
    const templateCodesForCategory = query.category
      ? await this.prisma.client.notificationTemplate.findMany({
          where: { category: query.category, channel: NotificationChannel.EMAIL },
          select: { code: true },
        })
      : [];
    const categoryTemplateCodes = templateCodesForCategory.map((item) => item.code);
    const templateCodeFilter =
      query.templateCode && query.category
        ? categoryTemplateCodes.includes(query.templateCode)
          ? query.templateCode
          : "__NO_MATCH__"
        : query.templateCode;
    const where: Prisma.NotificationLogWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(templateCodeFilter
        ? { templateCode: templateCodeFilter }
        : query.category
          ? { templateCode: { in: categoryTemplateCodes } }
          : {}),
      ...(query.eventCode ? { eventCode: query.eventCode } : {}),
      ...(query.recipientType ? { recipientType: query.recipientType } : {}),
      ...(query.recipient
        ? { recipient: { contains: query.recipient, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.notificationLog.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      });
      const total = await tx.notificationLog.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  listTemplates(query: EmailTemplateQueryDto = {}) {
    const search = query.search?.trim();
    const where: Prisma.NotificationTemplateWhereInput = {
      channel: NotificationChannel.EMAIL,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status as ContentStatus } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.client.notificationTemplate.findMany({
      where,
      include: { theme: true, triggerRules: true },
      orderBy: [{ category: "asc" }, { name: "asc" }, { code: "asc" }],
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.client.notificationTemplate.findUnique({
      where: { id },
      include: { theme: true, triggerRules: true },
    });

    if (!template || template.channel !== NotificationChannel.EMAIL) {
      throw new NotFoundException("Email template not found.");
    }

    return template;
  }

  async createTemplate(actor: RequestUser, dto: CreateEmailTemplateDto) {
    const name = dto.name.trim();
    const subject = dto.subject.trim();
    const body = dto.body.trim();

    if (!name) {
      throw new BadRequestException("Email template name is required.");
    }

    if (!subject) {
      throw new BadRequestException("Email template subject is required.");
    }

    if (!body) {
      throw new BadRequestException("Email template body is required.");
    }

    if (dto.themeId) {
      await this.assertEmailThemeExists(dto.themeId);
    }

    const created = await this.prisma.client.notificationTemplate.create({
      data: {
        code: await this.createTemplateCode(dto.category, name),
        name,
        category: dto.category,
        channel: NotificationChannel.EMAIL,
        subject,
        body,
        status: (dto.status ?? "DRAFT") as ContentStatus,
        ...(dto.themeId ? { theme: { connect: { id: dto.themeId } } } : {}),
        ...(dto.styleOverrides !== undefined
          ? {
              styleOverrides:
                (this.normalizeStyleOverrides(
                  dto.styleOverrides,
                ) as Prisma.InputJsonObject | null) ?? Prisma.JsonNull,
            }
          : {}),
      },
      include: { theme: true, triggerRules: true },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "email.template.created",
        entityType: "notification_template",
        entityId: created.id,
        newValue: this.templateAuditValue(created),
      },
    });

    return created;
  }

  async updateTemplate(actor: RequestUser, id: string, dto: UpdateEmailTemplateDto) {
    const existing = await this.getTemplate(id);
    const name = dto.name === undefined ? existing.name : dto.name.trim();
    const subject = (dto.subject ?? existing.subject).trim();
    const body = (dto.body ?? existing.body).trim();
    const status = (dto.status ?? existing.status) as ContentStatus;
    const category = dto.category ?? existing.category;
    const themeId = dto.themeId === undefined ? existing.themeId : dto.themeId || null;

    if (!name) {
      throw new BadRequestException("Email template name is required.");
    }

    if (!subject) {
      throw new BadRequestException("Email template subject is required.");
    }

    if (!body) {
      throw new BadRequestException("Email template body is required.");
    }

    if (themeId) {
      await this.assertEmailThemeExists(themeId);
    }

    const data: Prisma.NotificationTemplateUpdateInput = {
      name,
      category,
      subject,
      body,
      status,
      ...(dto.themeId !== undefined
        ? themeId
          ? { theme: { connect: { id: themeId } } }
          : { theme: { disconnect: true } }
        : {}),
      ...(dto.styleOverrides !== undefined
        ? {
            styleOverrides:
              (this.normalizeStyleOverrides(dto.styleOverrides) as Prisma.InputJsonObject | null) ??
              Prisma.JsonNull,
          }
        : {}),
    };

    const updated = await this.prisma.client.notificationTemplate.update({
      where: { id },
      data,
      include: { theme: true, triggerRules: true },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "email.template.updated",
        entityType: "notification_template",
        entityId: updated.id,
        oldValue: this.templateAuditValue(existing),
        newValue: this.templateAuditValue(updated),
      },
    });

    return updated;
  }

  async listTriggers() {
    await this.ensureEmailTriggerRules();
    const rules = await this.prisma.client.emailTriggerRule.findMany({
      include: { template: { include: { theme: true } } },
      orderBy: [{ category: "asc" }, { eventCode: "asc" }, { recipientType: "asc" }],
    });

    return Promise.all(
      rules.map(async (rule) => {
        const [lastSent, recentFailures] = await Promise.all([
          this.prisma.client.notificationLog.findMany({
            where: { triggerRuleId: rule.id, status: NotificationStatus.SENT },
            orderBy: { sentAt: "desc" },
            take: 1,
          }),
          this.prisma.client.notificationLog.count({
            where: {
              triggerRuleId: rule.id,
              status: { in: [NotificationStatus.FAILED, NotificationStatus.SKIPPED] },
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
        ]);
        const catalog = findEmailTriggerCatalogItem(rule.eventCode, rule.recipientType);

        return {
          ...rule,
          eventName: catalog?.eventName ?? this.humanizeCode(rule.eventCode),
          defaultTemplateCode: catalog?.defaultTemplateCode ?? null,
          variableKeys: catalog?.variableKeys ?? [],
          lastSentAt: lastSent[0]?.sentAt ?? lastSent[0]?.createdAt ?? null,
          recentFailureCount: recentFailures,
        };
      }),
    );
  }

  async updateTrigger(actor: RequestUser, id: string, dto: UpdateEmailTriggerRuleDto) {
    const existing = await this.prisma.client.emailTriggerRule.findUnique({
      where: { id },
      include: { template: true },
    });

    if (!existing) {
      throw new NotFoundException("Email trigger rule not found.");
    }

    const catalog = findEmailTriggerCatalogItem(existing.eventCode, existing.recipientType);
    if (!catalog) {
      throw new BadRequestException(
        "Email trigger rule is not part of the supported event catalog.",
      );
    }

    const nextEnabled = dto.isEnabled ?? existing.isEnabled;
    const nextDelayMinutes = dto.delayMinutes ?? existing.delayMinutes;
    const nextTemplateId =
      dto.templateId === undefined ? existing.templateId : dto.templateId || null;
    const nextTemplate = nextTemplateId
      ? await this.prisma.client.notificationTemplate.findUnique({
          where: { id: nextTemplateId },
          include: { theme: true },
        })
      : null;

    if (nextTemplateId && (!nextTemplate || nextTemplate.channel !== NotificationChannel.EMAIL)) {
      throw new BadRequestException("Selected email template was not found.");
    }

    if (nextEnabled) {
      if (!nextTemplate) {
        throw new BadRequestException("Enabled email triggers require a selected template.");
      }

      if (nextTemplate.status !== ContentStatus.PUBLISHED) {
        throw new BadRequestException("Enabled email triggers require a published template.");
      }

      const unknownVariables = this.unknownTemplateVariables(nextTemplate, catalog.variableKeys);
      if (unknownVariables.length) {
        throw new BadRequestException(
          `Template uses unsupported variables for this trigger: ${unknownVariables.join(", ")}.`,
        );
      }
    }

    const updated = await this.prisma.client.emailTriggerRule.update({
      where: { id },
      data: {
        isEnabled: nextEnabled,
        delayMinutes: nextDelayMinutes,
        category: catalog.category,
        ...(dto.templateId !== undefined
          ? nextTemplateId
            ? { template: { connect: { id: nextTemplateId } } }
            : { template: { disconnect: true } }
          : {}),
      },
      include: { template: { include: { theme: true } } },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "email.trigger.updated",
        entityType: "email_trigger_rule",
        entityId: updated.id,
        oldValue: this.triggerAuditValue(existing),
        newValue: this.triggerAuditValue(updated),
      },
    });

    return {
      ...updated,
      eventName: catalog.eventName,
      defaultTemplateCode: catalog.defaultTemplateCode,
      variableKeys: catalog.variableKeys,
      lastSentAt: null,
      recentFailureCount: 0,
    };
  }

  async listThemes() {
    await this.ensureDefaultEmailTheme();
    return this.prisma.client.emailTheme.findMany({
      orderBy: [{ code: "asc" }],
    });
  }

  async createTheme(actor: RequestUser, dto: CreateEmailThemeDto) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException("Email theme name is required.");
    }

    try {
      const created = await this.prisma.client.emailTheme.create({
        data: {
          code,
          name,
          status: (dto.status ?? "DRAFT") as ContentStatus,
          tokens: this.normalizeThemeTokens(dto.tokens) as Prisma.InputJsonObject,
        },
      });

      await this.prisma.client.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "email.theme.created",
          entityType: "email_theme",
          entityId: created.id,
          newValue: this.themeAuditValue(created),
        },
      });

      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Email theme code already exists.");
      }

      throw error;
    }
  }

  async getTheme(id: string) {
    await this.ensureDefaultEmailTheme();
    const theme = await this.prisma.client.emailTheme.findUnique({
      where: { id },
    });

    if (!theme) {
      throw new NotFoundException("Email theme not found.");
    }

    return theme;
  }

  async updateTheme(actor: RequestUser, id: string, dto: UpdateEmailThemeDto) {
    const existing = await this.getTheme(id);
    const name = dto.name === undefined ? existing.name : dto.name.trim();

    if (!name) {
      throw new BadRequestException("Email theme name is required.");
    }

    const updated = await this.prisma.client.emailTheme.update({
      where: { id },
      data: {
        name,
        status: (dto.status ?? existing.status) as ContentStatus,
        ...(dto.tokens !== undefined
          ? {
              tokens: this.normalizeThemeTokens(
                dto.tokens,
                this.normalizeThemeTokens(existing.tokens),
              ) as Prisma.InputJsonObject,
            }
          : {}),
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "email.theme.updated",
        entityType: "email_theme",
        entityId: updated.id,
        oldValue: this.themeAuditValue(existing),
        newValue: this.themeAuditValue(updated),
      },
    });

    return updated;
  }

  async retryLog(logId: string, actor?: RequestUser) {
    const log = await this.prisma.client.notificationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      return null;
    }

    await this.prisma.client.auditLog.create({
      data: {
        ...(actor?.id ? { actorUserId: actor.id } : {}),
        action: "email.log.retry_requested",
        entityType: "notification_log",
        entityId: log.id,
        newValue: {
          previousStatus: log.status,
          templateCode: log.templateCode,
          eventCode: log.eventCode,
          recipientType: log.recipientType,
        },
      },
    });

    const retryBlockedMessage = this.emailRetryBlockedMessage(log);
    if (retryBlockedMessage) {
      return this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.SKIPPED,
          errorMessage: retryBlockedMessage,
        },
      });
    }

    const [template, emailSetting] = await Promise.all([
      this.prisma.client.notificationTemplate.findUnique({
        where: { code: log.templateCode },
        include: { theme: true },
      }),
      this.prisma.client.emailSetting.findFirst({ orderBy: { createdAt: "asc" } }),
    ]);

    if (
      !template ||
      template.status !== ContentStatus.PUBLISHED ||
      template.channel !== NotificationChannel.EMAIL
    ) {
      return this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.SKIPPED,
          errorMessage: "Email template is missing, unpublished, or not an email template.",
        },
      });
    }

    const setting = emailSetting ?? {
      provider: process.env.EMAIL_PROVIDER ?? "smtp",
      senderName: process.env.EMAIL_FROM_NAME ?? "1HandIndia",
      senderEmail: process.env.EMAIL_FROM_ADDRESS ?? "no-reply@example.com",
      isEnabled: false,
      providerConfig: {},
    };

    if (!setting.isEnabled) {
      return this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.SKIPPED,
          errorMessage: "Email sending is disabled in email settings.",
        },
      });
    }

    await this.prisma.client.notificationLog.update({
      where: { id: log.id },
      data: {
        status: NotificationStatus.PENDING,
        errorMessage: null,
        providerMessageId: null,
        scheduledFor: null,
        sentAt: null,
      },
    });

    const variables = this.logVariables(log.variables);
    const rendered = await this.renderEmail(template, variables);
    const payload: EmailJobPayload = {
      notificationLogId: log.id,
      provider: setting.provider,
      providerConfig: this.emailProviderConfig(setting.providerConfig),
      recipient: log.recipient,
      subject: rendered.subject,
      body: rendered.body,
      fromName: setting.senderName,
      fromEmail: setting.senderEmail,
      templateCode: template.code,
    };
    await this.prisma.client.notificationLog.update({
      where: { id: log.id },
      data: rendered,
    });

    const queued = await this.queue.enqueueEmail(payload);
    if (!queued) {
      await this.deliverAndUpdateLog(payload);
    }

    return this.prisma.client.notificationLog.findUnique({
      where: { id: log.id },
    });
  }

  private async notifyEventOrThrow(input: TriggerNotificationInput) {
    if (!input.recipient) {
      return null;
    }

    const resolved = await this.resolveTriggerRule(input.eventCode, input.recipientType);
    if (!resolved) {
      return this.createLog(
        this.triggerLogInput(input, input.eventCode),
        NotificationStatus.SKIPPED,
        "Email trigger event is not supported.",
        undefined,
        {
          eventCode: input.eventCode,
          recipientType: input.recipientType,
        },
      );
    }

    const { rule, catalog } = resolved;
    const context = {
      eventCode: rule.eventCode,
      recipientType: rule.recipientType,
      triggerRuleId: rule.id,
    };

    if (!rule.isEnabled) {
      return this.createLog(
        this.triggerLogInput(input, rule.template?.code ?? catalog.defaultTemplateCode),
        NotificationStatus.SKIPPED,
        "Email trigger is disabled.",
        undefined,
        context,
      );
    }

    const template = rule.template;
    if (
      !template ||
      template.status !== ContentStatus.PUBLISHED ||
      template.channel !== NotificationChannel.EMAIL
    ) {
      return this.createLog(
        this.triggerLogInput(input, template?.code ?? catalog.defaultTemplateCode),
        NotificationStatus.SKIPPED,
        "Email trigger template is missing, unpublished, or not an email template.",
        undefined,
        context,
      );
    }

    const unknownVariables = this.unknownTemplateVariables(template, catalog.variableKeys);
    if (unknownVariables.length) {
      return this.createLog(
        this.triggerLogInput(input, template.code),
        NotificationStatus.SKIPPED,
        `Email trigger template uses unsupported variables: ${unknownVariables.join(", ")}.`,
        undefined,
        context,
      );
    }

    const rendered = await this.renderEmail(template, input.variables);
    const emailSetting = await this.prisma.client.emailSetting.findFirst({
      orderBy: { createdAt: "asc" },
    });
    const setting = emailSetting ?? {
      provider: process.env.EMAIL_PROVIDER ?? "smtp",
      senderName: process.env.EMAIL_FROM_NAME ?? "1HandIndia",
      senderEmail: process.env.EMAIL_FROM_ADDRESS ?? "no-reply@example.com",
      isEnabled: false,
      providerConfig: {},
    };

    if (!setting.isEnabled) {
      return this.createLog(
        this.triggerLogInput(input, template.code),
        NotificationStatus.SKIPPED,
        "Email sending is disabled in email settings.",
        rendered,
        context,
      );
    }

    const delayMs = Math.max(0, rule.delayMinutes) * 60 * 1000;
    const scheduledFor = delayMs ? new Date(Date.now() + delayMs) : null;
    const logInput = this.triggerLogInput(input, template.code);

    if (delayMs && !this.queue.isAvailable()) {
      return this.createLog(
        logInput,
        NotificationStatus.SKIPPED,
        "Delayed email requires the Redis email queue. Configure REDIS_URL and run the worker before enabling delayed trigger sends.",
        rendered,
        { ...context, scheduledFor },
      );
    }

    const log = await this.createLog(logInput, NotificationStatus.PENDING, undefined, rendered, {
      ...context,
      scheduledFor,
    });
    const payload: EmailJobPayload = {
      notificationLogId: log.id,
      provider: setting.provider,
      providerConfig: this.emailProviderConfig(setting.providerConfig),
      recipient: input.recipient,
      subject: rendered.subject,
      body: rendered.body,
      fromName: setting.senderName,
      fromEmail: setting.senderEmail,
      templateCode: template.code,
    };

    const queued = await this.queue.enqueueEmail(payload, delayMs ? { delayMs } : undefined);
    if (!queued) {
      if (delayMs) {
        return this.prisma.client.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationStatus.SKIPPED,
            errorMessage:
              "Delayed email could not be queued. Configure REDIS_URL and run the worker before enabling delayed trigger sends.",
          },
        });
      }

      await this.deliverAndUpdateLog(payload);
    }

    return this.prisma.client.notificationLog.findUnique({
      where: { id: log.id },
    });
  }

  private async notifyOrThrow(input: NotificationInput) {
    if (!input.recipient) {
      return null;
    }

    const [template, emailSetting] = await Promise.all([
      this.prisma.client.notificationTemplate.findUnique({
        where: { code: input.templateCode },
        include: { theme: true },
      }),
      this.prisma.client.emailSetting.findFirst({
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (
      !template ||
      template.status !== ContentStatus.PUBLISHED ||
      template.channel !== NotificationChannel.EMAIL
    ) {
      return this.createLog(
        input,
        NotificationStatus.SKIPPED,
        "Email template is missing, unpublished, or not an email template.",
      );
    }

    const rendered = await this.renderEmail(template, input.variables);

    const setting = emailSetting ?? {
      provider: process.env.EMAIL_PROVIDER ?? "smtp",
      senderName: process.env.EMAIL_FROM_NAME ?? "1HandIndia",
      senderEmail: process.env.EMAIL_FROM_ADDRESS ?? "no-reply@example.com",
      isEnabled: false,
      providerConfig: {},
    };

    if (!setting.isEnabled) {
      return this.createLog(
        input,
        NotificationStatus.SKIPPED,
        "Email sending is disabled in email settings.",
        rendered,
      );
    }

    const log = await this.createLog(input, NotificationStatus.PENDING, undefined, rendered);
    const payload: EmailJobPayload = {
      notificationLogId: log.id,
      provider: setting.provider,
      providerConfig: this.emailProviderConfig(setting.providerConfig),
      recipient: input.recipient,
      subject: rendered.subject,
      body: rendered.body,
      fromName: setting.senderName,
      fromEmail: setting.senderEmail,
      templateCode: template.code,
    };

    const queued = await this.queue.enqueueEmail(payload);
    if (!queued) {
      await this.deliverAndUpdateLog(payload);
    }

    return this.prisma.client.notificationLog.findUnique({
      where: { id: log.id },
    });
  }

  private async deliverAndUpdateLog(payload: EmailJobPayload) {
    const deliveryLockId = this.deliveryLockId(payload.notificationLogId);
    const claimed = await this.claimNotificationLogForDelivery(
      payload.notificationLogId,
      deliveryLockId,
    );
    if (!claimed) {
      this.logger.warn(
        `Email notification ${payload.notificationLogId} was already sent or claimed; skipping duplicate delivery.`,
      );
      return;
    }

    try {
      const result = await this.emailDelivery.deliver(payload);
      const providerMessageId =
        result.providerMessageId ?? `sent-without-provider-id:${payload.notificationLogId}`;
      const updated = await this.prisma.client.notificationLog.updateMany({
        where: {
          id: payload.notificationLogId,
          status: NotificationStatus.PENDING,
          providerMessageId: deliveryLockId,
        },
        data: {
          status: NotificationStatus.SENT,
          providerMessageId,
          errorMessage: null,
          sentAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        this.logger.warn(
          `Email notification ${payload.notificationLogId} was sent, but the log was changed before it could be marked SENT.`,
        );
      }
    } catch (error) {
      await this.prisma.client.notificationLog.updateMany({
        where: { id: payload.notificationLogId, providerMessageId: deliveryLockId },
        data: {
          status: NotificationStatus.FAILED,
          providerMessageId: null,
          errorMessage: String(error),
        },
      });
    }
  }

  private async claimNotificationLogForDelivery(notificationLogId: string, deliveryLockId: string) {
    const result = await this.prisma.client.notificationLog.updateMany({
      where: {
        id: notificationLogId,
        status: NotificationStatus.PENDING,
        providerMessageId: null,
        sentAt: null,
      },
      data: {
        providerMessageId: deliveryLockId,
        errorMessage: "Email delivery in progress. Duplicate sends are blocked by a delivery lock.",
      },
    });

    return result.count === 1;
  }

  private deliveryLockId(notificationLogId: string) {
    return `${EMAIL_DELIVERY_LOCK_PREFIX}${notificationLogId}:${Date.now()}`;
  }

  private createLog(
    input: NotificationInput,
    status: NotificationStatus,
    errorMessage?: string,
    rendered?: RenderedEmail,
    context?: NotificationLogContext,
  ) {
    const variables = this.logVariablesJson(input.variables);

    return this.prisma.client.notificationLog.create({
      data: {
        channel: NotificationChannel.EMAIL,
        templateCode: input.templateCode,
        ...(context?.eventCode ? { eventCode: context.eventCode } : {}),
        ...(context?.recipientType ? { recipientType: context.recipientType } : {}),
        ...(context?.triggerRuleId
          ? { triggerRule: { connect: { id: context.triggerRuleId } } }
          : {}),
        recipient: input.recipient,
        ...(rendered ? { subject: rendered.subject, body: rendered.body } : {}),
        ...(variables ? { variables } : {}),
        status,
        ...(context?.scheduledFor ? { scheduledFor: context.scheduledFor } : {}),
        ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      },
    });
  }

  private triggerLogInput(
    input: TriggerNotificationInput,
    templateCode: string,
  ): NotificationInput {
    return {
      templateCode,
      recipient: input.recipient,
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.variables !== undefined ? { variables: input.variables } : {}),
    };
  }

  private async resolveTriggerRule(eventCode: string, recipientType: EmailRecipientType) {
    const catalog = findEmailTriggerCatalogItem(eventCode, recipientType);
    if (!catalog) {
      return null;
    }

    const existing = await this.prisma.client.emailTriggerRule.findUnique({
      where: { eventCode_recipientType: { eventCode, recipientType } },
      include: { template: { include: { theme: true } } },
    });

    if (existing) {
      return { rule: existing, catalog };
    }

    const defaultTemplate = await this.prisma.client.notificationTemplate.findUnique({
      where: { code: catalog.defaultTemplateCode },
      select: { id: true },
    });
    const created = await this.prisma.client.emailTriggerRule.create({
      data: {
        eventCode: catalog.eventCode,
        recipientType: catalog.recipientType,
        category: catalog.category,
        isEnabled: true,
        delayMinutes: 0,
        ...(defaultTemplate ? { template: { connect: { id: defaultTemplate.id } } } : {}),
      },
      include: { template: { include: { theme: true } } },
    });

    return { rule: created, catalog };
  }

  private async ensureEmailTriggerRules() {
    await Promise.all(
      emailTriggerCatalog.map(async (item) => {
        const defaultTemplate = await this.prisma.client.notificationTemplate.findUnique({
          where: { code: item.defaultTemplateCode },
          select: { id: true },
        });

        await this.prisma.client.emailTriggerRule.upsert({
          where: {
            eventCode_recipientType: {
              eventCode: item.eventCode,
              recipientType: item.recipientType,
            },
          },
          update: {
            category: item.category,
          },
          create: {
            eventCode: item.eventCode,
            recipientType: item.recipientType,
            category: item.category,
            isEnabled: true,
            delayMinutes: 0,
            ...(defaultTemplate ? { template: { connect: { id: defaultTemplate.id } } } : {}),
          },
        });
      }),
    );
  }

  private async renderEmail(
    template: ThemeableTemplate,
    variables?: TemplateVariables,
  ): Promise<RenderedEmail> {
    const renderedBody = this.render(template.body, variables);
    const tokens = await this.resolveThemeTokens(template);

    return {
      subject: this.render(template.subject, variables),
      body: this.wrapEmailBody(renderedBody, tokens),
    };
  }

  private async resolveThemeTokens(template: ThemeableTemplate): Promise<EmailThemeTokens> {
    const themeTokens = await this.resolveBaseThemeTokens(template);
    const overrides = this.normalizeStyleOverrides(template.styleOverrides);

    return overrides ? { ...themeTokens, ...overrides } : themeTokens;
  }

  private async resolveBaseThemeTokens(template: ThemeableTemplate): Promise<EmailThemeTokens> {
    if (template.theme?.status === ContentStatus.PUBLISHED) {
      return this.normalizeThemeTokens(template.theme.tokens);
    }

    const defaultTheme = await this.ensureDefaultEmailTheme();
    return defaultTheme.status === ContentStatus.PUBLISHED
      ? this.normalizeThemeTokens(defaultTheme.tokens)
      : DEFAULT_EMAIL_THEME_TOKENS;
  }

  private wrapEmailBody(renderedBody: string, tokens: EmailThemeTokens) {
    const fontFamily = safeFontFallbacks[tokens.fontFamily];
    const bodyHtml = this.textToHtmlParagraphs(renderedBody, tokens);
    const footerText = this.escapeHtml(tokens.footerText);
    const radius = `${tokens.borderRadius}px`;
    const logo = tokens.logoUrl
      ? `<img src="${this.escapeAttribute(tokens.logoUrl)}" width="144" alt="1HandIndia" style="display:block;max-width:144px;height:auto;border:0;outline:none;text-decoration:none;" />`
      : `<div style="display:inline-block;color:${tokens.brandColor};font-size:22px;font-weight:800;line-height:1;">1HandIndia</div>`;

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1HandIndia</title></head><body style="margin:0;padding:0;background:${tokens.backgroundColor};color:${tokens.textColor};font-family:${fontFamily};"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${tokens.backgroundColor};"><tr><td align="center" style="padding:28px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:${tokens.surfaceColor};border:1px solid #E5E7EB;border-radius:${radius};overflow:hidden;"><tr><td style="padding:28px 28px 18px;border-bottom:4px solid ${tokens.brandColor};">${logo}</td></tr><tr><td style="padding:28px;">${bodyHtml}</td></tr><tr><td style="padding:20px 28px;background:${tokens.backgroundColor};color:${tokens.mutedTextColor};font-size:12px;line-height:18px;">${footerText}</td></tr></table></td></tr></table></body></html>`;
  }

  private textToHtmlParagraphs(value: string, tokens: EmailThemeTokens) {
    const paragraphs = value.split(/\r?\n/);

    return paragraphs
      .map((paragraph) => {
        const raw = paragraph.trim();
        if (!raw) {
          return `<div style="height:12px;line-height:12px;">&nbsp;</div>`;
        }

        if (this.isSafeHttpUrl(raw)) {
          return this.emailButtonHtml(raw, tokens);
        }

        const html = this.escapeHtml(raw);
        return `<p style="margin:0 0 14px;color:${tokens.textColor};font-size:15px;line-height:24px;font-weight:600;">${html}</p>`;
      })
      .join("");
  }

  private emailButtonHtml(url: string, tokens: EmailThemeTokens) {
    const background =
      tokens.buttonStyle === "OUTLINE" ? tokens.surfaceColor : tokens.buttonBackgroundColor;
    const color =
      tokens.buttonStyle === "OUTLINE" ? tokens.buttonBackgroundColor : tokens.buttonTextColor;

    return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:4px 0 18px;"><tr><td><a href="${this.escapeAttribute(url)}" style="display:inline-block;background:${background};border:1px solid ${tokens.buttonBackgroundColor};border-radius:${tokens.borderRadius}px;color:${color};font-size:14px;font-weight:800;line-height:20px;padding:12px 18px;text-decoration:none;">Open link</a></td></tr></table>`;
  }

  private normalizeThemeTokens(
    value?: EmailThemeTokensDto | Prisma.JsonValue | null,
    base: EmailThemeTokens = DEFAULT_EMAIL_THEME_TOKENS,
  ): EmailThemeTokens {
    const input =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    return {
      logoUrl: this.logoToken(input.logoUrl, base.logoUrl),
      brandColor: this.colorToken(input.brandColor, base.brandColor),
      accentColor: this.colorToken(input.accentColor, base.accentColor),
      backgroundColor: this.colorToken(input.backgroundColor, base.backgroundColor),
      surfaceColor: this.colorToken(input.surfaceColor, base.surfaceColor),
      textColor: this.colorToken(input.textColor, base.textColor),
      mutedTextColor: this.colorToken(input.mutedTextColor, base.mutedTextColor),
      buttonBackgroundColor: this.colorToken(
        input.buttonBackgroundColor,
        base.buttonBackgroundColor,
      ),
      buttonTextColor: this.colorToken(input.buttonTextColor, base.buttonTextColor),
      buttonStyle:
        input.buttonStyle === "SOLID" || input.buttonStyle === "OUTLINE"
          ? input.buttonStyle
          : base.buttonStyle,
      footerText: this.trimToken(input.footerText, base.footerText),
      borderRadius: this.numberToken(input.borderRadius, base.borderRadius),
      fontFamily: this.fontToken(input.fontFamily, base.fontFamily),
    };
  }

  private normalizeStyleOverrides(
    value?: EmailThemeTokensDto | Prisma.JsonValue | null,
  ): Partial<EmailThemeTokens> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const input = value as Record<string, unknown>;
    const output: Partial<EmailThemeTokens> = {};
    if (typeof input.logoUrl === "string") {
      output.logoUrl = this.logoToken(input.logoUrl, "");
    }

    if (typeof input.footerText === "string") {
      output.footerText = input.footerText.trim();
    }

    const colorFields: Array<keyof EmailThemeTokens> = [
      "brandColor",
      "accentColor",
      "backgroundColor",
      "surfaceColor",
      "textColor",
      "mutedTextColor",
      "buttonBackgroundColor",
      "buttonTextColor",
    ];

    for (const key of colorFields) {
      if (typeof input[key] === "string" && /^#[0-9A-Fa-f]{6}$/.test(input[key])) {
        output[key] = input[key] as never;
      }
    }

    if (input.buttonStyle === "SOLID" || input.buttonStyle === "OUTLINE") {
      output.buttonStyle = input.buttonStyle;
    }

    if (
      typeof input.borderRadius === "number" &&
      input.borderRadius >= 0 &&
      input.borderRadius <= 24
    ) {
      output.borderRadius = Math.round(input.borderRadius);
    }

    if (
      input.fontFamily === "Arial" ||
      input.fontFamily === "Inter" ||
      input.fontFamily === "Georgia" ||
      input.fontFamily === "Verdana" ||
      input.fontFamily === "Tahoma"
    ) {
      output.fontFamily = input.fontFamily;
    }

    return Object.keys(output).length ? output : null;
  }

  private async ensureDefaultEmailTheme() {
    return this.prisma.client.emailTheme.upsert({
      where: { code: DEFAULT_EMAIL_THEME_CODE },
      update: {},
      create: {
        code: DEFAULT_EMAIL_THEME_CODE,
        name: "Default 1HandIndia",
        status: ContentStatus.PUBLISHED,
        tokens: DEFAULT_EMAIL_THEME_TOKENS as Prisma.InputJsonObject,
      },
    });
  }

  private trimToken(value: unknown, fallback: string) {
    return typeof value === "string" ? value.trim() : fallback;
  }

  private logoToken(value: unknown, fallback: string) {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    return !trimmed || this.isSafeHttpUrl(trimmed) ? trimmed : fallback;
  }

  private colorToken(value: unknown, fallback: string) {
    return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
  }

  private numberToken(value: unknown, fallback: number) {
    return typeof value === "number" && value >= 0 && value <= 24 ? Math.round(value) : fallback;
  }

  private fontToken(value: unknown, fallback: EmailThemeTokens["fontFamily"]) {
    if (
      value === "Arial" ||
      value === "Inter" ||
      value === "Georgia" ||
      value === "Verdana" ||
      value === "Tahoma"
    ) {
      return value;
    }

    return fallback;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private escapeAttribute(value: string) {
    return this.escapeHtml(value).replaceAll("`", "&#96;");
  }

  private isSafeHttpUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  private async assertEmailThemeExists(themeId: string) {
    const theme = await this.prisma.client.emailTheme.findUnique({
      where: { id: themeId },
      select: { id: true },
    });

    if (!theme) {
      throw new BadRequestException("Selected email theme was not found.");
    }
  }

  private async createTemplateCode(category: EmailTemplateCategory, name: string) {
    const base =
      `${category}_${name}`
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_")
        .slice(0, 56) || `${category}_TEMPLATE`;

    for (let index = 0; index < 1000; index += 1) {
      const code = index === 0 ? base : `${base.slice(0, 56)}_${index + 1}`;
      const existing = await this.prisma.client.notificationTemplate.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException("Unable to generate a unique email template code.");
  }

  private extractTemplateVariables(subject: string, body: string) {
    const matches = `${subject}\n${body}`.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g);
    return [
      ...new Set(
        [...matches].map((match) => match[1]).filter((value): value is string => Boolean(value)),
      ),
    ];
  }

  private unknownTemplateVariables(
    template: { subject: string; body: string },
    allowedVariables: string[],
  ) {
    const allowed = new Set(allowedVariables);
    return this.extractTemplateVariables(template.subject, template.body).filter(
      (variable) => !allowed.has(variable),
    );
  }

  private humanizeCode(code: string) {
    return code
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private templateAuditValue(template: {
    id: string;
    code: string;
    name: string;
    category: EmailTemplateCategory;
    channel: NotificationChannel;
    subject: string;
    body: string;
    status: ContentStatus;
    themeId?: string | null;
    styleOverrides?: Prisma.JsonValue | null;
  }): Prisma.InputJsonObject {
    return {
      id: template.id,
      code: template.code,
      name: template.name,
      category: template.category,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      status: template.status,
      themeId: template.themeId ?? null,
      styleOverrides:
        template.styleOverrides &&
        typeof template.styleOverrides === "object" &&
        !Array.isArray(template.styleOverrides)
          ? (template.styleOverrides as Prisma.InputJsonObject)
          : null,
    };
  }

  private triggerAuditValue(trigger: {
    id: string;
    eventCode: string;
    recipientType: EmailRecipientType;
    category: EmailTemplateCategory;
    templateId?: string | null;
    isEnabled: boolean;
    delayMinutes: number;
  }): Prisma.InputJsonObject {
    return {
      id: trigger.id,
      eventCode: trigger.eventCode,
      recipientType: trigger.recipientType,
      category: trigger.category,
      templateId: trigger.templateId ?? null,
      isEnabled: trigger.isEnabled,
      delayMinutes: trigger.delayMinutes,
    };
  }

  private themeAuditValue(theme: {
    id: string;
    code: string;
    name: string;
    status: ContentStatus;
    tokens: Prisma.JsonValue;
  }): Prisma.InputJsonObject {
    return {
      id: theme.id,
      code: theme.code,
      name: theme.name,
      status: theme.status,
      tokens:
        theme.tokens && typeof theme.tokens === "object" && !Array.isArray(theme.tokens)
          ? (theme.tokens as Prisma.InputJsonObject)
          : DEFAULT_EMAIL_THEME_TOKENS,
    };
  }

  private logVariables(value: Prisma.JsonValue | null | undefined): TemplateVariables {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] => {
        const entryValue = entry[1];
        return entryValue === null || ["string", "number", "boolean"].includes(typeof entryValue);
      }),
    );
  }

  private emailProviderConfig(value: Prisma.JsonValue | null | undefined): EmailProviderConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const input = value as Record<string, unknown>;
    const config: EmailProviderConfig = {};

    if (typeof input.brevoApiKey === "string" && input.brevoApiKey.trim()) {
      config.brevoApiKey = input.brevoApiKey.trim();
    }

    if (typeof input.resendApiKey === "string" && input.resendApiKey.trim()) {
      config.resendApiKey = input.resendApiKey.trim();
    }

    if (typeof input.sendgridApiKey === "string" && input.sendgridApiKey.trim()) {
      config.sendgridApiKey = input.sendgridApiKey.trim();
    }

    if (typeof input.smtpHost === "string" && input.smtpHost.trim()) {
      config.smtpHost = input.smtpHost.trim();
    }

    const smtpPort =
      typeof input.smtpPort === "number"
        ? input.smtpPort
        : typeof input.smtpPort === "string" && input.smtpPort.trim()
          ? Number(input.smtpPort)
          : Number.NaN;
    if (Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535) {
      config.smtpPort = smtpPort;
    }

    if (typeof input.smtpUsername === "string" && input.smtpUsername.trim()) {
      config.smtpUsername = input.smtpUsername.trim();
    }

    if (typeof input.smtpPassword === "string" && input.smtpPassword.trim()) {
      config.smtpPassword = input.smtpPassword.trim();
    }

    if (typeof input.smtpSecure === "boolean") {
      config.smtpSecure = input.smtpSecure;
    }

    if (typeof input.smtpBridgeUrl === "string" && input.smtpBridgeUrl.trim()) {
      config.smtpBridgeUrl = input.smtpBridgeUrl.trim();
    }

    return config;
  }

  private logVariablesJson(variables?: TemplateVariables): Prisma.InputJsonObject | undefined {
    if (!variables) {
      return undefined;
    }

    const entries = Object.entries(variables)
      .filter(
        (entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined,
      )
      .map(([key, value]) => [key, value] as const);

    if (!entries.length) {
      return undefined;
    }

    return Object.fromEntries(entries) as Prisma.InputJsonObject;
  }

  private render(template: string, variables: TemplateVariables = {}) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => {
      const value = variables[key];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  private emailRetryBlockedMessage(log: {
    status: NotificationStatus;
    providerMessageId: string | null;
    errorMessage: string | null;
    createdAt: Date;
    scheduledFor: Date | null;
  }) {
    if (
      log.status === NotificationStatus.PENDING &&
      this.isStaleDeliveryLock(log.providerMessageId)
    ) {
      return null;
    }

    if (
      log.status !== NotificationStatus.FAILED &&
      log.status !== NotificationStatus.SKIPPED
    ) {
      return "Only failed or skipped email logs can be retried.";
    }

    if (
      log.status === NotificationStatus.SKIPPED &&
      log.errorMessage?.toLowerCase().includes("email sending is disabled")
    ) {
      return "This email was skipped while email sending was disabled and will not be resent later. This prevents old transactional emails from being sent unexpectedly.";
    }

    if (EMAIL_RETRY_SEND_WINDOW_MINUTES <= 0) {
      return null;
    }

    const dueAt = log.scheduledFor ?? log.createdAt;
    const ageMs = Date.now() - dueAt.getTime();
    if (ageMs > EMAIL_RETRY_SEND_WINDOW_MINUTES * 60 * 1000) {
      return `Email retry blocked because this log is older than the ${EMAIL_RETRY_SEND_WINDOW_MINUTES}-minute retry window. This prevents old transactional emails from being sent unexpectedly.`;
    }

    return null;
  }

  private isStaleDeliveryLock(providerMessageId: string | null | undefined) {
    if (!providerMessageId?.startsWith(EMAIL_DELIVERY_LOCK_PREFIX)) {
      return false;
    }

    if (EMAIL_DELIVERY_LOCK_STALE_MINUTES <= 0) {
      return true;
    }

    const lockParts = providerMessageId.split(":");
    const lockedAt = Number(lockParts[lockParts.length - 1]);
    return (
      Number.isFinite(lockedAt) &&
      Date.now() - lockedAt > EMAIL_DELIVERY_LOCK_STALE_MINUTES * 60 * 1000
    );
  }

  private async resolveAdminRecipients() {
    const emailSetting = await this.prisma.client.emailSetting.findFirst({
      orderBy: { createdAt: "asc" },
      select: { adminRecipients: true },
    });
    const configured =
      emailSetting?.adminRecipients?.trim() ||
      process.env.EMAIL_ADMIN_RECIPIENTS ||
      process.env.INDIHUB_ADMIN_EMAIL ||
      "";
    const configuredRecipients = configured
      .split(/[\n,]/)
      .map((recipient) => recipient.trim())
      .filter(Boolean);

    if (configuredRecipients.length) {
      return [...new Set(configuredRecipients)];
    }

    const adminUsers = await this.prisma.client.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: {
              code: RoleCode.ADMIN,
            },
          },
        },
      },
      select: { email: true },
    });

    return [...new Set(adminUsers.map((user) => user.email).filter(Boolean))];
  }
}

function nonNegativeEnvNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
