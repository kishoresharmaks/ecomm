"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Clock,
  FileText,
  Mail,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  XCircle,
} from "lucide-react";
import { Button, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import {
  AdminListbox,
  AdminPanel,
  AdminStatusNotice,
  AdminSwitch,
  AdminTabs,
  type AdminSelectOption,
} from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import {
  buildEmailLogQueryPath,
  defaultEmailThemeTokens,
  emailTemplateCategories,
  emailTemplateCreatePayload,
  emailThemeColorFields,
  emailThemeCreatePayload,
  emailThemeFontOptions,
  emailThemePatchPayload,
  emailThemeTokenLabels,
  emailSettingPayload,
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
  type EmailProviderConfig,
  type EmailRecipientType,
  type EmailTemplateCategory,
  type EmailThemeFormState,
  type EmailThemeStatus,
  type EmailThemeTokens,
  type EmailTemplateFormState,
  type EmailTemplateStatus,
} from "@/components/admin/admin-email-utils";
import { IndihubApiError, indihubFetch, type IndihubAuthHeaders } from "@/lib/api";

type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type EmailTemplateRecord = {
  id: string;
  code: string;
  name: string;
  category: EmailTemplateCategory;
  channel: string;
  subject: string;
  body: string;
  status: EmailTemplateStatus;
  themeId?: string | null;
  styleOverrides?: Partial<EmailThemeTokens> | null;
  theme?: EmailThemeRecord | null;
  triggerRules?: Array<{ id: string; eventCode: string; recipientType: EmailRecipientType }>;
  updatedAt?: string | null;
};

type EmailThemeRecord = {
  id: string;
  code: string;
  name: string;
  status: EmailThemeStatus;
  tokens: Partial<EmailThemeTokens>;
  updatedAt?: string | null;
};

type EmailSettingRecord = {
  provider: string;
  senderName: string;
  senderEmail: string;
  adminRecipients?: string | null;
  isEnabled: boolean;
  providerConfig?: EmailProviderConfig | null;
  updatedAt?: string | null;
};

type EmailLogRecord = {
  id: string;
  channel: string;
  templateCode: string;
  eventCode?: string | null;
  recipientType?: EmailRecipientType | null;
  scheduledFor?: string | null;
  sentAt?: string | null;
  recipient: string;
  subject?: string | null;
  body?: string | null;
  variables?: Record<string, unknown> | null;
  status: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
};

type EmailTriggerRecord = {
  id: string;
  eventCode: string;
  eventName: string;
  category: EmailTemplateCategory;
  recipientType: EmailRecipientType;
  templateId?: string | null;
  template?: EmailTemplateRecord | null;
  isEnabled: boolean;
  delayMinutes: number;
  defaultTemplateCode?: string | null;
  variableKeys: string[];
  lastSentAt?: string | null;
  recentFailureCount: number;
  updatedAt?: string | null;
};

type EmailStatusCounts = Record<"PENDING" | "SENT" | "FAILED" | "SKIPPED", number>;
type EmailContentStatusCounts = Record<
  "DRAFT" | "IN_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED",
  number
>;
type EmailOverviewRecord = {
  generatedAt: string;
  pipelineMode: "IMMEDIATE";
  windowDays: number;
  setting: {
    provider: string;
    isEnabled: boolean;
    providerConfigured: boolean;
    senderEmail: string;
    adminRecipientCount: number;
    updatedAt?: string | null;
  };
  logs: {
    totals: EmailStatusCounts;
    recentWindowTotals: EmailStatusCounts;
    lastSentAt?: string | null;
    oldestPendingAt?: string | null;
    pendingDeliveryLockActive: boolean;
    recent: {
      failures: EmailLogRecord[];
      pending: EmailLogRecord[];
      skipped: EmailLogRecord[];
    };
  };
  triggers: {
    total: number;
    enabled: number;
    disabled: number;
    missingTemplate: number;
  };
  templates: {
    statusCounts: EmailContentStatusCounts;
  };
  themes: {
    statusCounts: EmailContentStatusCounts;
  };
};

type EmailStatusFilter = "ALL" | "PENDING" | "SENT" | "FAILED" | "SKIPPED";

const emailTemplateStatusOptions: AdminSelectOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

const emailThemeStatusOptions = emailTemplateStatusOptions;

const emailStatusOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All delivery status" },
  { value: "PENDING", label: "Pending" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
];

const emailProviderOptions: AdminSelectOption[] = [
  { value: "smtp", label: "SMTP" },
  { value: "brevo", label: "Brevo" },
  { value: "resend", label: "Resend" },
  { value: "sendgrid", label: "SendGrid" },
];
const defaultEmailProviderConfig: EmailProviderConfig = {
  brevoApiKey: "",
  brevoApiKeyConfigured: false,
  resendApiKey: "",
  resendApiKeyConfigured: false,
  sendgridApiKey: "",
  sendgridApiKeyConfigured: false,
  smtpHost: "",
  smtpPort: 587,
  smtpUsername: "",
  smtpPassword: "",
  smtpPasswordConfigured: false,
  smtpSecure: false,
  smtpBridgeUrl: "",
};

const emailCategoryOptions: AdminSelectOption[] = [
  { value: "ALL", label: "All categories" },
  ...emailTemplateCategories.map((category) => ({ value: category, label: humanize(category) })),
];

const emailTextFields: Array<[keyof Omit<EmailSettingRecord, "isEnabled" | "updatedAt">, string]> =
  [
    ["senderName", "Sender name"],
    ["senderEmail", "Sender email"],
  ];

export function AdminEmailWorkspaceClient() {
  const auth = useAdminAuth();
  const templatesQuery = useEmailTemplates(auth.authHeaders);
  const themesQuery = useEmailThemes(auth.authHeaders);
  const triggersQuery = useEmailTriggers(auth.authHeaders);
  const settingsQuery = useEmailSettings(auth.authHeaders);
  const overviewQuery = useEmailOverview(auth.authHeaders);

  return (
    <div className="space-y-5">
      <AdminTabs
        tabs={[
          {
            key: "overview",
            label: emailWorkspaceTabLabels[0],
            panel: (
              <EmailOverviewPanel
                templates={templatesQuery.data ?? []}
                themes={themesQuery.data ?? []}
                setting={settingsQuery.data}
                triggers={triggersQuery.data ?? []}
                overview={overviewQuery.data}
                isLoading={
                  templatesQuery.isLoading ||
                  themesQuery.isLoading ||
                  triggersQuery.isLoading ||
                  settingsQuery.isLoading ||
                  overviewQuery.isLoading
                }
                onRefresh={() => overviewQuery.refetch()}
              />
            ),
          },
          {
            key: "templates",
            label: emailWorkspaceTabLabels[1],
            badge: templatesQuery.data?.length ?? 0,
            panel: (
              <EmailTemplatesPanel
                templatesQuery={templatesQuery}
                themesQuery={themesQuery}
                triggersQuery={triggersQuery}
              />
            ),
          },
          {
            key: "themes",
            label: emailWorkspaceTabLabels[2],
            badge: themesQuery.data?.length ?? 0,
            panel: <EmailThemesPanel themesQuery={themesQuery} />,
          },
          {
            key: "triggers",
            label: emailWorkspaceTabLabels[3],
            badge: triggersQuery.data?.filter((trigger) => trigger.isEnabled).length ?? 0,
            panel: (
              <EmailTriggersPanel triggersQuery={triggersQuery} templatesQuery={templatesQuery} />
            ),
          },
          {
            key: "settings",
            label: emailWorkspaceTabLabels[4],
            panel: <EmailSettingsPanel />,
          },
          {
            key: "logs",
            label: emailWorkspaceTabLabels[5],
            panel: <EmailLogsPanel />,
          },
        ]}
      />
    </div>
  );
}

export function AdminEmailLogsPageClient() {
  return <EmailLogsPanel />;
}

function EmailOverviewPanel({
  templates,
  themes,
  setting,
  triggers,
  overview,
  isLoading,
  onRefresh,
}: {
  templates: EmailTemplateRecord[];
  themes: EmailThemeRecord[];
  setting?: EmailSettingRecord | undefined;
  triggers: EmailTriggerRecord[];
  overview?: EmailOverviewRecord | undefined;
  isLoading?: boolean | undefined;
  onRefresh?: (() => void) | undefined;
}) {
  const templateStatusCounts = overview?.templates.statusCounts;
  const themeStatusCounts = overview?.themes.statusCounts;
  const published =
    templateStatusCounts?.PUBLISHED ??
    templates.filter((template) => template.status === "PUBLISHED").length;
  const draft =
    templateStatusCounts?.DRAFT ??
    templates.filter((template) => template.status === "DRAFT").length;
  const archived =
    templateStatusCounts?.ARCHIVED ??
    templates.filter((template) => template.status === "ARCHIVED").length;
  const themeTotal = themeStatusCounts
    ? Object.values(themeStatusCounts).reduce((total, count) => total + count, 0)
    : themes.length;
  const publishedThemes =
    themeStatusCounts?.PUBLISHED ?? themes.filter((theme) => theme.status === "PUBLISHED").length;
  const enabledTriggers =
    overview?.triggers.enabled ?? triggers.filter((trigger) => trigger.isEnabled).length;
  const pendingTotal = overview?.logs.totals.PENDING ?? 0;
  const failedTotal = overview?.logs.totals.FAILED ?? 0;
  const skippedTotal = overview?.logs.totals.SKIPPED ?? 0;
  const sentLastWindow = overview?.logs.recentWindowTotals.SENT ?? 0;
  const failureItems = overview?.logs.recent.failures ?? [];
  const pendingItems = overview?.logs.recent.pending ?? [];
  const skippedItems = overview?.logs.recent.skipped ?? [];
  const currentSetting = overview?.setting ?? {
    provider: setting?.provider ?? "smtp",
    isEnabled: setting?.isEnabled ?? false,
    providerConfigured: setting ? providerConfigured(setting) : false,
    senderEmail: setting?.senderEmail ?? "no-reply@example.com",
    adminRecipientCount: recipientCount(setting?.adminRecipients),
  };

  return (
    <div className="space-y-5">
      <AdminPanel className="border-[#FBD2C4] bg-gradient-to-br from-white to-[#FFFCFB]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="success">Immediate delivery</StatusBadge>
              <StatusBadge tone={currentSetting.isEnabled ? "success" : "warning"}>
                {currentSetting.isEnabled ? "Sending enabled" : "Sending disabled"}
              </StatusBadge>
              <StatusBadge tone={currentSetting.providerConfigured ? "success" : "warning"}>
                {currentSetting.providerConfigured ? "Provider ready" : "Provider setup needed"}
              </StatusBadge>
            </div>
            <h2 className="mt-4 text-2xl font-black text-[#1F2933]">
              Transactional email command center
            </h2>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-[#667085]">
              Order, seller, payment, B2B, support, and account emails are logged, rendered,
              claimed, and delivered immediately when the app action happens.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StatusSummary
                label={`${overview?.windowDays ?? 7} day sent`}
                value={sentLastWindow}
                tone="success"
              />
              <StatusSummary
                label="Open issues"
                value={failedTotal + pendingTotal}
                tone={failedTotal + pendingTotal > 0 ? "danger" : "success"}
              />
              <StatusSummary
                label="Missing templates"
                value={overview?.triggers.missingTemplate ?? 0}
                tone={(overview?.triggers.missingTemplate ?? 0) > 0 ? "danger" : "success"}
              />
            </div>
          </div>
          <div className="w-full rounded-lg border border-[#FBD2C4] bg-white p-4 shadow-sm sm:w-80">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Provider</p>
            <p className="mt-2 text-xl font-black text-[#163B5C]">
              {humanize(currentSetting.provider)}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#667085]">
              {currentSetting.senderEmail}
            </p>
            <div className="mt-4 space-y-2 text-xs font-semibold text-[#667085]">
              <p>Admin alert recipients: {currentSetting.adminRecipientCount || "Role users"}</p>
              <p>Last sent: {formatDate(overview?.logs.lastSentAt)}</p>
              <p>Oldest pending: {formatDate(overview?.logs.oldestPendingAt)}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={onRefresh}
              disabled={isLoading || !onRefresh}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh health
            </Button>
          </div>
        </div>
      </AdminPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EmailMetricCard
          label="Email sending"
          value={currentSetting.isEnabled ? "Enabled" : "Disabled"}
          tone={currentSetting.isEnabled ? "success" : "warning"}
        />
        <EmailMetricCard
          label="Provider"
          value={humanize(currentSetting.provider)}
          tone={currentSetting.providerConfigured ? "success" : "warning"}
        />
        <EmailMetricCard
          label="Published templates"
          value={`${published}`}
          tone={published ? "success" : "warning"}
        />
        <EmailMetricCard
          label="Reusable themes"
          value={`${themeTotal}`}
          tone={publishedThemes ? "success" : "warning"}
        />
        <EmailMetricCard
          label="Enabled triggers"
          value={`${enabledTriggers}`}
          tone={enabledTriggers ? "success" : "warning"}
        />
        <EmailMetricCard
          label="Pending logs"
          value={`${pendingTotal}`}
          tone={pendingTotal > 0 ? "warning" : "success"}
        />
        <EmailMetricCard
          label="Recent failures"
          value={`${failedTotal}`}
          tone={failedTotal > 0 ? "danger" : "success"}
        />
        <EmailMetricCard
          label="Skipped logs"
          value={`${skippedTotal}`}
          tone={skippedTotal > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminPanel>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1F2933]">Email health</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                Transactional email readiness and recent delivery failures.
              </p>
            </div>
            {isLoading ? <StatusBadge tone="warning">Refreshing</StatusBadge> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatusSummary label="Draft" value={draft} tone="warning" />
            <StatusSummary label="Published" value={published} tone="success" />
            <StatusSummary label="Archived" value={archived} tone="danger" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatusSummary label="Immediate" value={enabledTriggers} tone="success" />
            <StatusSummary
              label="Pending"
              value={pendingTotal}
              tone={pendingTotal > 0 ? "warning" : "success"}
            />
            <StatusSummary
              label="Skipped"
              value={skippedTotal}
              tone={skippedTotal > 0 ? "warning" : "success"}
            />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <EmailLogPreview
              title="Pending review"
              items={pendingItems}
              emptyMessage="No pending email logs."
              tone="warning"
            />
            <EmailLogPreview
              title="Skipped review"
              items={skippedItems}
              emptyMessage="No skipped email logs."
              tone="warning"
            />
          </div>
        </AdminPanel>

        <AdminPanel>
          <h2 className="mb-4 text-lg font-black text-[#1F2933]">Recent failures</h2>
          <div className="space-y-3">
            {failureItems.map((log) => (
              <div key={log.id} className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3">
                <p className="text-sm font-black text-[#8A1F1F]">{log.templateCode}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[#667085]">
                  {log.recipient}
                </p>
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-[#8A1F1F]">
                  {log.errorMessage ?? "No provider error stored."}
                </p>
              </div>
            ))}
            {!failureItems.length ? (
              <p className="rounded-md border border-[#BFEAD9] bg-[#E9F7F1] p-3 text-sm font-semibold text-[#064C35]">
                No failed email logs in the current view.
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}

function EmailLogPreview({
  title,
  items,
  emptyMessage,
  tone,
}: {
  title: string;
  items: EmailLogRecord[];
  emptyMessage: string;
  tone: StatusTone;
}) {
  return (
    <div className="rounded-md border border-[#D8E2EA] bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[#1F2933]">{title}</p>
        <StatusBadge tone={items.length ? tone : "success"}>
          {items.length ? `${items.length}` : "Clear"}
        </StatusBadge>
      </div>
      <div className="space-y-2">
        {items.map((log) => (
          <div key={log.id} className="rounded-md border border-[#E4EAF0] bg-[#F8FAFC] p-2">
            <p className="truncate text-xs font-black text-[#1F2933]">{log.templateCode}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[#667085]">{log.recipient}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[#667085]">
              {log.providerMessageId?.startsWith("delivery-lock:")
                ? "Delivery lock active"
                : formatDate(log.scheduledFor ?? log.createdAt)}
            </p>
          </div>
        ))}
        {!items.length ? (
          <p className="rounded-md border border-[#BFEAD9] bg-[#E9F7F1] p-2 text-xs font-semibold text-[#064C35]">
            {emptyMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EmailTemplatesPanel({
  templatesQuery,
  themesQuery,
  triggersQuery,
}: {
  templatesQuery: ReturnType<typeof useEmailTemplates>;
  themesQuery: ReturnType<typeof useEmailThemes>;
  triggersQuery: ReturnType<typeof useEmailTriggers>;
}) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const templates = templatesQuery.data ?? [];
  const themes = themesQuery.data ?? [];
  const triggers = triggersQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | EmailTemplateCategory>("ALL");
  const [selectedId, setSelectedId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<EmailTemplateFormState>({
    name: "",
    category: "CUSTOMER",
    subject: "",
    body: "",
    status: "DRAFT",
    themeId: null,
    styleOverrides: {},
  });
  const [notice, setNotice] = useState<string | null>(null);
  const filteredTemplates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory = categoryFilter === "ALL" || template.category === categoryFilter;
      const matchesSearch =
        !needle ||
        `${template.code} ${template.name} ${template.subject} ${template.status} ${template.category}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, search, templates]);

  useEffect(() => {
    if (!isCreating && !selectedId && templates[0]) {
      setSelectedId(templates[0].id);
    }
  }, [isCreating, selectedId, templates]);

  const detailQuery = useQuery({
    queryKey: ["admin-email-template", auth.authHeaders, selectedId],
    enabled: Boolean(auth.isAuthenticated && selectedId && !isCreating),
    queryFn: () =>
      indihubFetch<EmailTemplateRecord>(
        `/api/admin/email/templates/${selectedId}`,
        undefined,
        auth.authHeaders,
      ),
  });
  const selectedTemplate = !isCreating
    ? (detailQuery.data ?? templates.find((template) => template.id === selectedId))
    : null;

  useEffect(() => {
    if (selectedTemplate) {
      setForm({
        name: selectedTemplate.name || humanize(selectedTemplate.code),
        category: selectedTemplate.category,
        subject: selectedTemplate.subject,
        body: selectedTemplate.body,
        status: selectedTemplate.status,
        themeId: selectedTemplate.themeId ?? null,
        styleOverrides: selectedTemplate.styleOverrides ?? {},
      });
      setNotice(null);
    }
  }, [
    isCreating,
    selectedTemplate?.id,
    selectedTemplate?.name,
    selectedTemplate?.category,
    selectedTemplate?.subject,
    selectedTemplate?.body,
    selectedTemplate?.status,
    selectedTemplate?.themeId,
    selectedTemplate?.styleOverrides,
  ]);

  const saveTemplate = useMutation({
    mutationFn: (payload: EmailTemplateFormState) =>
      isCreating
        ? adminRequest<EmailTemplateRecord>("/api/admin/email/templates", auth.authHeaders, {
            method: "POST",
            body: JSON.stringify(emailTemplateCreatePayload(payload)),
          })
        : adminRequest<EmailTemplateRecord>(
            `/api/admin/email/templates/${selectedId}`,
            auth.authHeaders,
            {
              method: "PATCH",
              body: JSON.stringify(emailTemplatePatchPayload(payload)),
            },
          ),
    onSuccess: async (savedTemplate) => {
      setNotice(isCreating ? "Email template created." : "Email template saved.");
      setIsCreating(false);
      setSelectedId(savedTemplate.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin-email-template", auth.authHeaders, selectedId],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-themes"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-triggers"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-overview"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save email template."),
  });
  const validationMessage = validateEmailTemplateForm(form);
  const variables = extractTemplateVariables(`${form.subject}\n${form.body}`);
  const assignedTriggers = triggers.filter((trigger) => trigger.templateId === selectedId);
  const allowedVariables = [
    ...new Set(assignedTriggers.flatMap((trigger) => trigger.variableKeys)),
  ];
  const unsupportedVariables = allowedVariables.length
    ? unknownTemplateVariables(`${form.subject}\n${form.body}`, allowedVariables)
    : [];
  const sampleVariables = sampleTemplateVariables(variables);
  const defaultTheme = themes.find((theme) => theme.code === "DEFAULT_1HANDINDIA");
  const selectedTheme = themes.find((theme) => theme.id === form.themeId);
  const baseTheme = selectedTheme ?? defaultTheme;
  const previewTokens = mergeEmailThemeTokens(baseTheme?.tokens, form.styleOverrides);
  const themeOptions = [
    { value: "__DEFAULT__", label: "Default 1HandIndia theme" },
    ...themes
      .filter((theme) => theme.code !== "DEFAULT_1HANDINDIA")
      .map((theme) => ({
        value: theme.id,
        label: `${theme.name} (${humanize(theme.status)})`,
      })),
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.2fr)]">
      <AdminPanel>
        <WorkspaceHeader
          icon={<FileText className="h-5 w-5" />}
          title="Transactional templates"
          description="Create transactional variants, group them by workflow, and assign them to safe trigger rules."
          isFetching={templatesQuery.isFetching}
          onRefresh={() => templatesQuery.refetch()}
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {emailCategoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategoryFilter(option.value as "ALL" | EmailTemplateCategory)}
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-black transition",
                categoryFilter === option.value
                  ? "border-[#ED3500] bg-[#FFF0EC] text-[#B42318]"
                  : "border-[#D8E2EA] bg-white text-[#667085] hover:border-[#ED3500]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, code, subject, or status"
            className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
          />
        </div>
        <Button
          type="button"
          className="mb-4 w-full justify-center"
          onClick={() => {
            setIsCreating(true);
            setSelectedId("");
            setForm({
              name: "",
              category: categoryFilter === "ALL" ? "CUSTOMER" : categoryFilter,
              subject: "",
              body: "",
              status: "DRAFT",
              themeId: null,
              styleOverrides: {},
            });
            setNotice(null);
          }}
        >
          <Plus className="h-4 w-4" />
          Create template
        </Button>
        {templatesQuery.error ? <EmailErrorNotice error={templatesQuery.error} /> : null}
        <EmailDataTable
          items={filteredTemplates}
          isLoading={templatesQuery.isLoading}
          emptyTitle="No email templates found"
          columns={[
            {
              header: "Template",
              cell: (item) => (
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "block w-full rounded-md px-2 py-1 text-left transition hover:bg-[#FFF0EC]",
                    item.id === selectedId && "bg-[#FFF0EC]",
                  )}
                >
                  <span className="block text-sm font-black text-[#1F2933]">
                    {item.name || item.code}
                  </span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[#667085]">
                    {item.code} / {item.subject}
                  </span>
                </button>
              ),
            },
            {
              header: "Category",
              cell: (item) => <StatusBadge tone="info">{humanize(item.category)}</StatusBadge>,
            },
            {
              header: "Status",
              cell: (item) => (
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
              ),
            },
            {
              header: "Theme",
              cell: (item) => (
                <span className="text-xs font-semibold text-[#667085]">
                  {item.theme?.name ?? "Default"}
                </span>
              ),
            },
            {
              header: "Used by",
              cell: (item) => (
                <span className="text-xs font-semibold text-[#667085]">
                  {item.triggerRules?.length ?? 0} triggers
                </span>
              ),
            },
            {
              header: "Updated",
              cell: (item) => (
                <span className="text-xs font-semibold text-[#667085]">
                  {formatDate(item.updatedAt)}
                </span>
              ),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <WorkspaceHeader
          icon={<Pencil className="h-5 w-5" />}
          title={isCreating ? "Create template" : "Template editor"}
          description="Draft and archived templates are kept out of live transactional sending."
          isFetching={detailQuery.isFetching}
        />
        {detailQuery.error ? <EmailErrorNotice error={detailQuery.error} /> : null}
        {selectedTemplate || isCreating ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <ReadOnlyField
                label="Template code"
                value={selectedTemplate?.code ?? "Auto-generated after create"}
              />
              <ReadOnlyField label="Channel" value={selectedTemplate?.channel ?? "EMAIL"} />
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <AdminListbox
                label="Category"
                value={form.category}
                options={emailTemplateCategories.map((category) => ({
                  value: category,
                  label: humanize(category),
                }))}
                onChange={(category) =>
                  setForm((current) => ({
                    ...current,
                    category: category as EmailTemplateCategory,
                  }))
                }
                buttonClassName="bg-white"
              />
              <AdminListbox
                label="Status"
                value={form.status}
                options={emailTemplateStatusOptions}
                onChange={(status) =>
                  setForm((current) => ({ ...current, status: status as EmailTemplateStatus }))
                }
                buttonClassName="bg-white"
              />
              <AdminListbox
                label="Theme"
                value={form.themeId ?? "__DEFAULT__"}
                options={themeOptions}
                onChange={(themeId) =>
                  setForm((current) => ({
                    ...current,
                    themeId: themeId === "__DEFAULT__" ? null : themeId,
                  }))
                }
                buttonClassName="bg-white"
              />
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Subject
                </span>
                <input
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Body
                </span>
                <textarea
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, body: event.target.value }))
                  }
                  rows={10}
                  className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold leading-6 text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <TemplateStyleOverrideControls
                inheritedTokens={mergeEmailThemeTokens(baseTheme?.tokens)}
                overrides={form.styleOverrides}
                onChange={(styleOverrides) =>
                  setForm((current) => ({ ...current, styleOverrides }))
                }
              />
              {validationMessage ? (
                <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
                  {validationMessage}
                </p>
              ) : null}
              {notice ? (
                <p
                  className={`rounded-md border p-3 text-sm font-semibold ${saveTemplate.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}
                >
                  {notice}
                </p>
              ) : null}
              <Button
                type="button"
                onClick={() => saveTemplate.mutate(form)}
                disabled={
                  Boolean(validationMessage) ||
                  saveTemplate.isPending ||
                  (!isCreating && !selectedId)
                }
              >
                <Save className="h-4 w-4" />
                {saveTemplate.isPending
                  ? isCreating
                    ? "Creating"
                    : "Saving"
                  : isCreating
                    ? "Create template"
                    : "Save template"}
              </Button>
            </div>

            <div className="space-y-4">
              <VariableHelper
                variables={variables}
                allowedVariables={allowedVariables}
                unknownVariables={unsupportedVariables}
              />
              {assignedTriggers.length ? (
                <SmallStack
                  lines={[
                    "Assigned triggers",
                    ...assignedTriggers.map(
                      (trigger) => `${trigger.eventName} / ${humanize(trigger.recipientType)}`,
                    ),
                  ]}
                />
              ) : null}
              <PreviewPanel
                subject={renderTemplatePreview(form.subject, sampleVariables)}
                bodyHtml={themedEmailPreviewHtml({
                  body: form.body,
                  variables: sampleVariables,
                  tokens: previewTokens,
                })}
              />
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            Select an email template to edit.
          </p>
        )}
      </AdminPanel>
    </div>
  );
}

function EmailThemesPanel({ themesQuery }: { themesQuery: ReturnType<typeof useEmailThemes> }) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const themes = themesQuery.data ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<EmailThemeFormState>({
    code: "",
    name: "",
    status: "DRAFT",
    tokens: defaultEmailThemeTokens,
  });

  useEffect(() => {
    if (!selectedId && !isCreating && themes[0]) {
      setSelectedId(themes[0].id);
    }
  }, [isCreating, selectedId, themes]);

  const selectedTheme = themes.find((theme) => theme.id === selectedId);

  useEffect(() => {
    if (isCreating) {
      setForm({
        code: "",
        name: "",
        status: "DRAFT",
        tokens: defaultEmailThemeTokens,
      });
      setNotice(null);
      return;
    }

    if (selectedTheme) {
      setForm({
        code: selectedTheme.code,
        name: selectedTheme.name,
        status: selectedTheme.status,
        tokens: mergeEmailThemeTokens(selectedTheme.tokens),
      });
      setNotice(null);
    }
  }, [
    isCreating,
    selectedTheme?.id,
    selectedTheme?.code,
    selectedTheme?.name,
    selectedTheme?.status,
    selectedTheme?.tokens,
  ]);

  const saveTheme = useMutation({
    mutationFn: (payload: EmailThemeFormState) =>
      isCreating
        ? adminRequest<EmailThemeRecord>("/api/admin/email/themes", auth.authHeaders, {
            method: "POST",
            body: JSON.stringify(emailThemeCreatePayload(payload)),
          })
        : adminRequest<EmailThemeRecord>(
            `/api/admin/email/themes/${selectedId}`,
            auth.authHeaders,
            {
              method: "PATCH",
              body: JSON.stringify(emailThemePatchPayload(payload)),
            },
          ),
    onSuccess: async (saved) => {
      setNotice(isCreating ? "Email theme created." : "Email theme saved.");
      setIsCreating(false);
      setSelectedId(saved.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-themes"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-overview"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save email theme."),
  });
  const validationMessage = validateEmailThemeForm(form, { requireCode: isCreating });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.25fr)]">
      <AdminPanel>
        <WorkspaceHeader
          icon={<Palette className="h-5 w-5" />}
          title="Reusable themes"
          description="Create guided, email-safe design systems for transactional templates."
          isFetching={themesQuery.isFetching}
          onRefresh={() => themesQuery.refetch()}
        />
        <Button
          type="button"
          variant="outline"
          className="mb-4"
          onClick={() => {
            setIsCreating(true);
            setSelectedId("");
          }}
        >
          <Plus className="h-4 w-4" />
          New theme
        </Button>
        {themesQuery.error ? <EmailErrorNotice error={themesQuery.error} /> : null}
        <EmailDataTable
          items={themes}
          isLoading={themesQuery.isLoading}
          emptyTitle="No email themes found"
          columns={[
            {
              header: "Theme",
              cell: (item) => (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedId(item.id);
                  }}
                  className={cn(
                    "block w-full rounded-md px-2 py-1 text-left transition hover:bg-[#FFF0EC]",
                    item.id === selectedId && !isCreating && "bg-[#FFF0EC]",
                  )}
                >
                  <span className="block text-sm font-black text-[#1F2933]">{item.name}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[#667085]">
                    {item.code}
                  </span>
                </button>
              ),
            },
            {
              header: "Status",
              cell: (item) => (
                <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
              ),
            },
            {
              header: "Updated",
              cell: (item) => (
                <span className="text-xs font-semibold text-[#667085]">
                  {formatDate(item.updatedAt)}
                </span>
              ),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <WorkspaceHeader
          icon={<Pencil className="h-5 w-5" />}
          title={isCreating ? "Create theme" : "Theme editor"}
          description="Use guided logo, color, button, footer, radius, and font controls."
          isFetching={themesQuery.isFetching}
        />
        {selectedTheme || isCreating ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Theme code
                </span>
                <input
                  value={form.code}
                  readOnly={!isCreating}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-black text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white disabled:text-[#667085]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
                  Theme name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
                />
              </label>
              <AdminListbox
                label="Status"
                value={form.status}
                options={emailThemeStatusOptions}
                onChange={(status) =>
                  setForm((current) => ({ ...current, status: status as EmailThemeStatus }))
                }
                buttonClassName="bg-white"
              />
              <ThemeTokenControls
                tokens={form.tokens}
                onChange={(tokens) => setForm((current) => ({ ...current, tokens }))}
              />
              {validationMessage ? (
                <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
                  {validationMessage}
                </p>
              ) : null}
              {notice ? (
                <p
                  className={`rounded-md border p-3 text-sm font-semibold ${saveTheme.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}
                >
                  {notice}
                </p>
              ) : null}
              <Button
                type="button"
                onClick={() => saveTheme.mutate(form)}
                disabled={Boolean(validationMessage) || saveTheme.isPending}
              >
                <Save className="h-4 w-4" />
                {saveTheme.isPending ? "Saving" : isCreating ? "Create theme" : "Save theme"}
              </Button>
            </div>
            <ThemePreviewPanel tokens={form.tokens} />
          </div>
        ) : (
          <p className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            Select or create an email theme.
          </p>
        )}
      </AdminPanel>
    </div>
  );
}

function EmailTriggersPanel({
  triggersQuery,
  templatesQuery,
}: {
  triggersQuery: ReturnType<typeof useEmailTriggers>;
  templatesQuery: ReturnType<typeof useEmailTemplates>;
}) {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const triggers = triggersQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | EmailTemplateCategory>("ALL");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    templateId: null as string | null,
    isEnabled: true,
    delayMinutes: 0,
  });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && triggers[0]) {
      setSelectedId(triggers[0].id);
    }
  }, [selectedId, triggers]);

  const selectedTrigger = triggers.find((trigger) => trigger.id === selectedId);
  const selectedTemplate = templates.find((template) => template.id === form.templateId);

  useEffect(() => {
    if (selectedTrigger) {
      setForm({
        templateId: selectedTrigger.templateId ?? null,
        isEnabled: selectedTrigger.isEnabled,
        delayMinutes: 0,
      });
      setNotice(null);
    }
  }, [
    selectedTrigger?.id,
    selectedTrigger?.templateId,
    selectedTrigger?.isEnabled,
  ]);

  const templateOptions = useMemo(
    () => [
      { value: "__NONE__", label: "No template selected" },
      ...templates.map((template) => ({
        value: template.id,
        label: `${template.name || template.code} (${humanize(template.status)})`,
      })),
    ],
    [templates],
  );
  const filteredTriggers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return triggers.filter((trigger) => {
      const matchesCategory = categoryFilter === "ALL" || trigger.category === categoryFilter;
      const matchesSearch =
        !needle ||
        `${trigger.eventCode} ${trigger.eventName} ${trigger.recipientType} ${trigger.template?.name ?? ""} ${trigger.template?.code ?? ""}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, search, triggers]);
  const unsupportedVariables =
    selectedTemplate && selectedTrigger
      ? unknownTemplateVariables(
          `${selectedTemplate.subject}\n${selectedTemplate.body}`,
          selectedTrigger.variableKeys,
        )
      : [];
  const validationMessage = validateEmailTriggerForm({
    ...form,
    templateStatus: selectedTemplate?.status,
    unknownVariables: unsupportedVariables,
  });
  const updateTrigger = useMutation({
    mutationFn: () =>
      adminRequest<EmailTriggerRecord>(
        `/api/admin/email/triggers/${selectedId}`,
        auth.authHeaders,
        {
          method: "PATCH",
          body: JSON.stringify(emailTriggerUpdatePayload(form)),
        },
      ),
    onSuccess: async () => {
      setNotice("Email trigger saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-triggers"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-overview"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save email trigger."),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1.1fr)]">
      <AdminPanel>
        <WorkspaceHeader
          icon={<Bell className="h-5 w-5" />}
          title="Email triggers"
          description="Map safe app-owned events to templates. Transactional emails send immediately when the app action happens."
          isFetching={triggersQuery.isFetching}
          onRefresh={() => triggersQuery.refetch()}
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {emailCategoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategoryFilter(option.value as "ALL" | EmailTemplateCategory)}
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-black transition",
                categoryFilter === option.value
                  ? "border-[#ED3500] bg-[#FFF0EC] text-[#B42318]"
                  : "border-[#D8E2EA] bg-white text-[#667085] hover:border-[#ED3500]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events or selected templates"
            className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
          />
        </div>
        {triggersQuery.error ? <EmailErrorNotice error={triggersQuery.error} /> : null}
        <EmailDataTable
          items={filteredTriggers}
          isLoading={triggersQuery.isLoading}
          emptyTitle="No email triggers found"
          columns={[
            {
              header: "Event",
              cell: (item) => (
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "block w-full rounded-md px-2 py-1 text-left transition hover:bg-[#FFF0EC]",
                    item.id === selectedId && "bg-[#FFF0EC]",
                  )}
                >
                  <span className="block text-sm font-black text-[#1F2933]">{item.eventName}</span>
                  <span className="mt-1 block text-xs font-semibold text-[#667085]">
                    {item.eventCode} / {humanize(item.recipientType)}
                  </span>
                </button>
              ),
            },
            {
              header: "State",
              cell: (item) => (
                <StatusBadge tone={item.isEnabled ? "success" : "warning"}>
                  {item.isEnabled ? "Enabled" : "Disabled"}
                </StatusBadge>
              ),
            },
            {
              header: "Send",
              cell: (item) => (
                <span className="text-xs font-black text-[#0F8A5F]">
                  {item.isEnabled ? "Immediate" : "Disabled"}
                </span>
              ),
            },
            {
              header: "Failures",
              cell: (item) => (
                <StatusBadge tone={item.recentFailureCount ? "danger" : "success"}>
                  {item.recentFailureCount}
                </StatusBadge>
              ),
            },
          ]}
        />
      </AdminPanel>

      <AdminPanel>
        <WorkspaceHeader
          icon={<Clock className="h-5 w-5" />}
          title="Trigger controls"
          description="Recipients are resolved by the app. Admins choose the template and enabled state; sends are immediate."
          isFetching={templatesQuery.isFetching}
        />
        {selectedTrigger ? (
          <div className="space-y-4">
            <ReadOnlyField label="Event" value={selectedTrigger.eventName} />
            <ReadOnlyField label="Recipient type" value={humanize(selectedTrigger.recipientType)} />
            <ReadOnlyField label="Category" value={humanize(selectedTrigger.category)} />
            <AdminSwitch
              checked={form.isEnabled}
              onChange={(isEnabled) => setForm((current) => ({ ...current, isEnabled }))}
              label="Enable this email trigger"
              description="Disabled triggers write a skipped log and do not send email."
            />
            <AdminListbox
              label="Template"
              value={form.templateId ?? "__NONE__"}
              options={templateOptions}
              onChange={(templateId) =>
                setForm((current) => ({
                  ...current,
                  templateId: templateId === "__NONE__" ? null : templateId,
                }))
              }
              buttonClassName="bg-white"
            />
            <ReadOnlyField label="Send timing" value="Immediately after the action happens" />
            <VariableHelper
              variables={
                selectedTemplate
                  ? extractTemplateVariables(
                      `${selectedTemplate.subject}\n${selectedTemplate.body}`,
                    )
                  : []
              }
              allowedVariables={selectedTrigger.variableKeys}
              unknownVariables={unsupportedVariables}
            />
            <SmallStack
              lines={[
                `Default template: ${selectedTrigger.defaultTemplateCode ?? "Not configured"}`,
                "Delay: disabled for transactional action emails",
                `Last sent: ${formatDate(selectedTrigger.lastSentAt)}`,
                `Recent failures: ${selectedTrigger.recentFailureCount}`,
              ]}
            />
            {validationMessage ? (
              <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
                {validationMessage}
              </p>
            ) : null}
            {notice ? (
              <p
                className={`rounded-md border p-3 text-sm font-semibold ${updateTrigger.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}
              >
                {notice}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={() => updateTrigger.mutate()}
              disabled={Boolean(validationMessage) || updateTrigger.isPending}
            >
              <Save className="h-4 w-4" />
              {updateTrigger.isPending ? "Saving" : "Save trigger"}
            </Button>
          </div>
        ) : (
          <p className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] p-4 text-sm font-semibold text-[#667085]">
            Select an email trigger to manage.
          </p>
        )}
      </AdminPanel>
    </div>
  );
}

export function EmailSettingsPanel() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const query = useEmailSettings(auth.authHeaders);
  const [notice, setNotice] = useState<string | null>(null);
  const updateEmail = useMutation({
    mutationFn: (payload: EmailSettingRecord) =>
      adminRequest<EmailSettingRecord>("/api/admin/email/settings/current", auth.authHeaders, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      setNotice("Email settings saved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-overview"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to save email settings."),
  });

  return (
    <AdminPanel>
      <WorkspaceHeader
        icon={<Settings className="h-5 w-5" />}
        title="Sender and provider settings"
        description="Provider credentials, SMTP details, sender identity, and admin recipients are saved in admin settings with masked readback. Environment values are only fallback bootstrap values."
        isFetching={query.isFetching}
        onRefresh={() => query.refetch()}
      />
      {query.error ? <EmailErrorNotice error={query.error} /> : null}
      <EmailSettingsForm
        setting={query.data}
        onSubmit={(payload) => updateEmail.mutate(payload)}
        disabled={updateEmail.isPending}
      />
      {notice ? (
        <p
          className={`mt-4 rounded-md border p-3 text-sm font-semibold ${updateEmail.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}
        >
          {notice}
        </p>
      ) : null}
    </AdminPanel>
  );
}

function EmailLogsPanel() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const templatesQuery = useEmailTemplates(auth.authHeaders);
  const triggersQuery = useEmailTriggers(auth.authHeaders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | EmailTemplateCategory>("ALL");
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [notice, setNotice] = useState<string | null>(null);
  const templateOptions = useMemo(
    () => [
      { value: "ALL", label: "All templates" },
      ...(templatesQuery.data ?? []).map((template) => ({
        value: template.code,
        label: humanize(template.code),
      })),
    ],
    [templatesQuery.data],
  );
  const eventOptions = useMemo(
    () => [
      { value: "ALL", label: "All events" },
      ...(triggersQuery.data ?? []).map((trigger) => ({
        value: trigger.eventCode,
        label: trigger.eventName,
      })),
    ],
    [triggersQuery.data],
  );
  const queryPath = useMemo(
    () =>
      buildEmailLogQueryPath({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        templateCode: templateFilter === "ALL" ? undefined : templateFilter,
        category: categoryFilter === "ALL" ? undefined : categoryFilter,
        eventCode: eventFilter === "ALL" ? undefined : eventFilter,
        recipient: search,
        limit: 50,
      }),
    [categoryFilter, eventFilter, search, statusFilter, templateFilter],
  );
  const logsQuery = useQuery({
    queryKey: ["admin-email-logs", auth.authHeaders, queryPath],
    enabled: Boolean(auth.isAuthenticated),
    queryFn: () => indihubFetch<PageResult<EmailLogRecord>>(queryPath, undefined, auth.authHeaders),
  });
  const retry = useMutation({
    mutationFn: (logId: string) =>
      adminRequest(`/api/admin/email/logs/${logId}/retry`, auth.authHeaders, {
        method: "POST",
      }),
    onSuccess: async () => {
      setNotice("Email retry submitted.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-email-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-email-overview"] }),
      ]);
    },
    onError: (error) =>
      setNotice(error instanceof Error ? error.message : "Unable to retry email log."),
  });
  const logs = logsQuery.data?.items ?? [];
  const hasFilters =
    Boolean(search.trim()) ||
    statusFilter !== "ALL" ||
    templateFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    eventFilter !== "ALL";

  return (
    <AdminPanel>
      <WorkspaceHeader
        icon={<Mail className="h-5 w-5" />}
        title="Email delivery logs"
        description="Review app-owned transactional email delivery and retry failed or skipped logs."
        isFetching={logsQuery.isFetching}
        onRefresh={() => logsQuery.refetch()}
      />
      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(13rem,0.8fr)_minmax(13rem,0.8fr)_minmax(18rem,1fr)_minmax(18rem,1fr)_minmax(16rem,1fr)_auto]">
        <AdminListbox
          value={statusFilter}
          options={emailStatusOptions}
          onChange={(value) => setStatusFilter(value as EmailStatusFilter)}
          compact
          buttonClassName="h-12 bg-white"
        />
        <AdminListbox
          value={categoryFilter}
          options={emailCategoryOptions}
          onChange={(value) => setCategoryFilter(value as "ALL" | EmailTemplateCategory)}
          compact
          buttonClassName="h-12 bg-white"
        />
        <AdminListbox
          value={templateFilter}
          options={templateOptions}
          onChange={setTemplateFilter}
          compact
          buttonClassName="h-12 bg-white"
        />
        <AdminListbox
          value={eventFilter}
          options={eventOptions}
          onChange={setEventFilter}
          compact
          buttonClassName="h-12 bg-white"
        />
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search recipient email"
            className="h-12 w-full rounded-md border border-[#D8E2EA] bg-white pl-9 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-12 px-5"
          onClick={() => {
            setSearch("");
            setStatusFilter("ALL");
            setCategoryFilter("ALL");
            setTemplateFilter("ALL");
            setEventFilter("ALL");
          }}
          disabled={!hasFilters}
        >
          <XCircle className="h-4 w-4" />
          Reset
        </Button>
      </div>
      {logsQuery.error ? <EmailErrorNotice error={logsQuery.error} /> : null}
      {notice ? (
        <p
          className={`mb-4 rounded-md border p-3 text-sm font-semibold ${retry.isError ? "border-[#F5B7B7] bg-[#FDECEC] text-[#8A1F1F]" : "border-[#BFEAD9] bg-[#E9F7F1] text-[#064C35]"}`}
        >
          {notice}
        </p>
      ) : null}
      <EmailDataTable
        items={logs}
        isLoading={logsQuery.isLoading}
        emptyTitle="No email logs found"
        columns={[
          {
            header: "Template",
            cell: (item) => (
              <EntityTitle
                title={item.templateCode}
                subtitle={`${item.eventCode ?? item.channel} / ${item.recipientType ? humanize(item.recipientType) : item.recipient}`}
              />
            ),
          },
          {
            header: "Status",
            cell: (item) => (
              <StatusBadge tone={statusTone(item.status)}>{humanize(item.status)}</StatusBadge>
            ),
          },
          {
            header: "Subject and context",
            className: "min-w-[280px]",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.subject ?? "No subject stored",
                  item.recipient,
                  notificationBodyPreview(item.body),
                  ...notificationVariableLines(item.variables),
                ]}
              />
            ),
          },
          {
            header: "Provider",
            cell: (item) => (
              <SmallStack
                lines={[
                  item.providerMessageId ?? "No provider id",
                  item.errorMessage ?? "No error",
                  item.scheduledFor ? `Scheduled ${formatDate(item.scheduledFor)}` : "",
                  item.sentAt ? `Sent ${formatDate(item.sentAt)}` : "",
                ]}
              />
            ),
          },
          {
            header: "Created",
            cell: (item) => (
              <span className="text-sm font-semibold text-[#667085]">
                {formatDate(item.createdAt)}
              </span>
            ),
          },
          {
            header: "Action",
            cell: (item) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retry.mutate(item.id)}
                disabled={retry.isPending || !["FAILED", "SKIPPED"].includes(item.status)}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            ),
          },
        ]}
      />
    </AdminPanel>
  );
}

function EmailSettingsForm({
  setting,
  onSubmit,
  disabled,
}: {
  setting?: EmailSettingRecord | undefined;
  onSubmit: (payload: EmailSettingRecord) => void;
  disabled?: boolean;
}) {
  const [form, setForm] = useState<EmailSettingRecord>({
    provider: "smtp",
    senderName: "1HandIndia",
    senderEmail: "no-reply@example.com",
    adminRecipients: "",
    isEnabled: false,
    providerConfig: defaultEmailProviderConfig,
  });

  useEffect(() => {
    if (setting) {
      setForm({
        provider: setting.provider.toLowerCase(),
        senderName: setting.senderName,
        senderEmail: setting.senderEmail,
        adminRecipients: setting.adminRecipients ?? "",
        isEnabled: setting.isEnabled,
        providerConfig: {
          ...defaultEmailProviderConfig,
          ...(setting.providerConfig ?? {}),
          brevoApiKey: "",
          resendApiKey: "",
          sendgridApiKey: "",
          smtpPassword: "",
        },
      });
    }
  }, [setting]);
  const validationMessage = validateEmailSettingForm(form);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <AdminListbox
          label="Provider"
          value={form.provider}
          options={emailProviderOptions}
          onChange={(provider) => setForm((current) => ({ ...current, provider }))}
          buttonClassName="bg-white"
        />
        {emailTextFields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              {label}
            </span>
            <input
              value={String(form[key])}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Admin alert recipients
          </span>
          <textarea
            value={form.adminRecipients ?? ""}
            onChange={(event) =>
              setForm((current) => ({ ...current, adminRecipients: event.target.value }))
            }
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
          />
        </label>
        <ProviderConfigFields
          config={form.providerConfig ?? defaultEmailProviderConfig}
          onChange={(providerConfig) => setForm((current) => ({ ...current, providerConfig }))}
        />
        <AdminSwitch
          label="Enable transactional email sending"
          description="Controls whether the configured adapter sends transactional messages."
          checked={form.isEnabled}
          onChange={(isEnabled) => setForm((current) => ({ ...current, isEnabled }))}
        />
        {validationMessage ? (
          <p className="rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-sm font-semibold text-[#8A1F1F]">
            {validationMessage}
          </p>
        ) : null}
        <Button
          type="button"
          onClick={() => onSubmit(emailSettingPayload(form))}
          disabled={disabled || Boolean(validationMessage)}
        >
          <Save className="h-4 w-4" />
          {disabled ? "Saving" : "Save email settings"}
        </Button>
      </div>
      <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
        <p className="text-sm font-black text-[#1F2933]">Current sender</p>
        <div className="mt-4 space-y-3 text-sm font-semibold text-[#667085]">
          <p>{form.senderName || "1HandIndia"}</p>
          <p>{form.senderEmail || "no-reply@example.com"}</p>
          <p>{form.adminRecipients?.trim() ? "Admin alerts configured" : "Admin role users"}</p>
          <StatusBadge tone={form.isEnabled ? "success" : "warning"}>
            {form.isEnabled ? "Sending enabled" : "Sending disabled"}
          </StatusBadge>
          <StatusBadge tone={providerConfigured(form) ? "success" : "warning"}>
            {providerConfigured(form) ? "Provider configured" : "Provider needs config"}
          </StatusBadge>
        </div>
        <div className="mt-5 rounded-md border border-[#D8E2EA] bg-white p-3">
          <p className="text-sm font-black text-[#1F2933]">Delivery safety</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge tone="success">Duplicate lock active</StatusBadge>
            <StatusBadge tone="success">Old queue guard active</StatusBadge>
            <StatusBadge tone="success">Retry window active</StatusBadge>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#667085]">
            A log is claimed before provider delivery, marked sent immediately after provider
            success, and old queued sends are blocked from going out late.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProviderConfigFields({
  config,
  onChange,
}: {
  config: EmailProviderConfig;
  onChange: (config: EmailProviderConfig) => void;
}) {
  const updateConfig = <K extends keyof EmailProviderConfig>(
    key: K,
    value: EmailProviderConfig[K],
  ) => onChange({ ...config, [key]: value });

  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#1F2933]">Provider configuration</p>
      <div className="mt-4 grid gap-4">
        <SecretInput
          label="Brevo API key"
          value={config.brevoApiKey}
          configured={Boolean(config.brevoApiKeyConfigured)}
          onChange={(value) => updateConfig("brevoApiKey", value)}
        />
        <SecretInput
          label="Resend API key"
          value={config.resendApiKey}
          configured={Boolean(config.resendApiKeyConfigured)}
          onChange={(value) => updateConfig("resendApiKey", value)}
        />
        <SecretInput
          label="SendGrid API key"
          value={config.sendgridApiKey}
          configured={Boolean(config.sendgridApiKeyConfigured)}
          onChange={(value) => updateConfig("sendgridApiKey", value)}
        />
        <div className="grid gap-3 rounded-md border border-[#E4EAF0] bg-white p-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              SMTP host
            </span>
            <input
              value={config.smtpHost}
              onChange={(event) => updateConfig("smtpHost", event.target.value)}
              placeholder="smtp.example.com"
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              SMTP port
            </span>
            <input
              type="number"
              min={1}
              max={65535}
              value={config.smtpPort}
              onChange={(event) => updateConfig("smtpPort", Number(event.target.value))}
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              Security
            </span>
            <select
              value={config.smtpSecure ? "TLS" : "STARTTLS"}
              onChange={(event) => updateConfig("smtpSecure", event.target.value === "TLS")}
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
            >
              <option value="STARTTLS">STARTTLS / plain</option>
              <option value="TLS">SSL/TLS</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
              SMTP username
            </span>
            <input
              value={config.smtpUsername}
              onChange={(event) => updateConfig("smtpUsername", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
            />
          </label>
          <div className="sm:col-span-2">
            <SecretInput
              label="SMTP password"
              value={config.smtpPassword}
              configured={Boolean(config.smtpPasswordConfigured)}
              onChange={(value) => updateConfig("smtpPassword", value)}
            />
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            SMTP bridge URL
          </span>
          <input
            value={config.smtpBridgeUrl}
            onChange={(event) => updateConfig("smtpBridgeUrl", event.target.value)}
            placeholder="https://..."
            className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
      </div>
    </div>
  );
}

function SecretInput({
  label,
  value,
  configured,
  onChange,
}: {
  label: string;
  value: string;
  configured: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[#667085]">
        {label}
        {configured ? <StatusBadge tone="success">Configured</StatusBadge> : null}
      </span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={configured ? "Configured" : ""}
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
      />
    </label>
  );
}

function providerConfigured(setting: EmailSettingRecord) {
  const config = setting.providerConfig;
  if (setting.provider === "brevo") {
    return Boolean(config?.brevoApiKey || config?.brevoApiKeyConfigured);
  }

  if (setting.provider === "resend") {
    return Boolean(config?.resendApiKey || config?.resendApiKeyConfigured);
  }

  if (setting.provider === "sendgrid") {
    return Boolean(config?.sendgridApiKey || config?.sendgridApiKeyConfigured);
  }

  return Boolean(config?.smtpBridgeUrl || (config?.smtpHost && config.smtpPort));
}

function ThemeTokenControls({
  tokens,
  onChange,
}: {
  tokens: EmailThemeTokens;
  onChange: (tokens: EmailThemeTokens) => void;
}) {
  const updateToken = <Key extends keyof EmailThemeTokens>(
    key: Key,
    value: EmailThemeTokens[Key],
  ) => onChange({ ...tokens, [key]: value });

  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#1F2933]">Theme design</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Logo URL
          </span>
          <input
            value={tokens.logoUrl}
            onChange={(event) => updateToken("logoUrl", event.target.value)}
            placeholder="https://..."
            className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
        {emailThemeColorFields.map((field) => (
          <ColorTokenField
            key={field}
            label={emailThemeTokenLabels[field]}
            value={tokens[field]}
            onChange={(value) => updateToken(field, value)}
          />
        ))}
        <AdminListbox
          label="Font"
          value={tokens.fontFamily}
          options={emailThemeFontOptions.map((font) => ({ value: font, label: font }))}
          onChange={(font) => updateToken("fontFamily", font as EmailThemeTokens["fontFamily"])}
          buttonClassName="bg-white"
        />
        <AdminListbox
          label="Button style"
          value={tokens.buttonStyle}
          options={[
            { value: "SOLID", label: "Solid" },
            { value: "OUTLINE", label: "Outline" },
          ]}
          onChange={(style) => updateToken("buttonStyle", style as EmailThemeTokens["buttonStyle"])}
          buttonClassName="bg-white"
        />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Border radius
          </span>
          <input
            type="number"
            min={0}
            max={24}
            value={tokens.borderRadius}
            onChange={(event) => updateToken("borderRadius", Number(event.target.value))}
            className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Footer text
          </span>
          <textarea
            value={tokens.footerText}
            rows={3}
            onChange={(event) => updateToken("footerText", event.target.value)}
            className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-white px-3 py-3 text-sm font-semibold leading-6 text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
      </div>
    </div>
  );
}

function TemplateStyleOverrideControls({
  inheritedTokens,
  overrides,
  onChange,
}: {
  inheritedTokens: EmailThemeTokens;
  overrides: Partial<EmailThemeTokens>;
  onChange: (overrides: Partial<EmailThemeTokens>) => void;
}) {
  const setOverride = <Key extends keyof EmailThemeTokens>(
    key: Key,
    value: EmailThemeTokens[Key] | undefined,
  ) => {
    const next = { ...overrides };
    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value as never;
    }
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#1F2933]">Per-template style overrides</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {emailThemeColorFields.map((field) => (
          <ColorOverrideField
            key={field}
            label={emailThemeTokenLabels[field]}
            inherited={inheritedTokens[field]}
            value={overrides[field]}
            onChange={(value) => setOverride(field, value)}
            onClear={() => setOverride(field, undefined)}
          />
        ))}
        <AdminListbox
          label="Font override"
          value={overrides.fontFamily ?? "__INHERIT__"}
          options={[
            { value: "__INHERIT__", label: `Use theme (${inheritedTokens.fontFamily})` },
            ...emailThemeFontOptions.map((font) => ({ value: font, label: font })),
          ]}
          onChange={(font) =>
            setOverride(
              "fontFamily",
              font === "__INHERIT__" ? undefined : (font as EmailThemeTokens["fontFamily"]),
            )
          }
          buttonClassName="bg-white"
        />
        <AdminListbox
          label="Button override"
          value={overrides.buttonStyle ?? "__INHERIT__"}
          options={[
            { value: "__INHERIT__", label: `Use theme (${humanize(inheritedTokens.buttonStyle)})` },
            { value: "SOLID", label: "Solid" },
            { value: "OUTLINE", label: "Outline" },
          ]}
          onChange={(style) =>
            setOverride(
              "buttonStyle",
              style === "__INHERIT__" ? undefined : (style as EmailThemeTokens["buttonStyle"]),
            )
          }
          buttonClassName="bg-white"
        />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Border radius override
          </span>
          <input
            type="number"
            min={0}
            max={24}
            value={overrides.borderRadius ?? ""}
            placeholder={String(inheritedTokens.borderRadius)}
            onChange={(event) =>
              setOverride(
                "borderRadius",
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
            className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-black uppercase tracking-wide text-[#667085]">
            Footer override
          </span>
          <input
            value={overrides.footerText ?? ""}
            placeholder={inheritedTokens.footerText}
            onChange={(event) => setOverride("footerText", event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
          />
        </label>
      </div>
    </div>
  );
}

function ColorTokenField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <span className="mt-2 grid grid-cols-[44px_minmax(0,1fr)] gap-2">
        <input
          type="color"
          value={safeColorInputValue(value, "#000000")}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-11 rounded-md border border-[#D8E2EA] bg-white p-1"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
        />
      </span>
    </label>
  );
}

function ColorOverrideField({
  label,
  inherited,
  value,
  onChange,
  onClear,
}: {
  label: string;
  inherited: string;
  value?: string | undefined;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <span className="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
        <input
          type="color"
          value={safeColorInputValue(value, inherited)}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-11 rounded-md border border-[#D8E2EA] bg-white p-1"
        />
        <input
          value={value ?? ""}
          placeholder={inherited}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 w-11 px-0"
          onClick={onClear}
          disabled={!value}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </span>
    </label>
  );
}

function ThemePreviewPanel({ tokens }: { tokens: EmailThemeTokens }) {
  const previewVariables = sampleTemplateVariables(["customerName", "orderNumber", "status"]);
  const previewHtml = themedEmailPreviewHtml({
    body: "Hello {{ customerName }},\nYour order {{ orderNumber }} status is {{ status }}.",
    variables: previewVariables,
    tokens,
  });
  const buttonStyles =
    tokens.buttonStyle === "OUTLINE"
      ? {
          background: tokens.surfaceColor,
          color: tokens.buttonBackgroundColor,
          border: `1px solid ${tokens.buttonBackgroundColor}`,
        }
      : {
          background: tokens.buttonBackgroundColor,
          color: tokens.buttonTextColor,
          border: `1px solid ${tokens.buttonBackgroundColor}`,
        };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#D8E2EA] bg-white p-4">
        <p className="text-sm font-black text-[#1F2933]">Theme preview</p>
        <div
          className="mt-4 max-h-[420px] overflow-auto rounded-md border border-[#E5E7EB]"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
        />
      </div>
      <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
        <p className="text-sm font-black text-[#1F2933]">Button sample</p>
        <span
          className="mt-4 inline-flex h-11 items-center justify-center px-5 text-sm font-black"
          style={{
            ...buttonStyles,
            borderRadius: `${tokens.borderRadius}px`,
            fontFamily: tokens.fontFamily,
          }}
        >
          View order
        </span>
      </div>
    </div>
  );
}

function WorkspaceHeader({
  icon,
  title,
  description,
  isFetching,
  onRefresh,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  isFetching?: boolean | undefined;
  onRefresh?: (() => void) | undefined;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-[#1F2933]">{title}</h2>
            {isFetching ? <StatusBadge tone="warning">Refreshing</StatusBadge> : null}
          </div>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
            {description}
          </p>
        </div>
      </div>
      {onRefresh ? (
        <Button type="button" variant="outline" onClick={onRefresh} disabled={isFetching}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      ) : null}
    </div>
  );
}

function VariableHelper({
  variables,
  allowedVariables = [],
  unknownVariables = [],
}: {
  variables: string[];
  allowedVariables?: string[];
  unknownVariables?: string[];
}) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-[#F8FAFC] p-4">
      <p className="text-sm font-black text-[#1F2933]">Variables used</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {variables.map((variable) => (
          <span
            key={variable}
            className="rounded-md border border-[#D8E2EA] bg-white px-2 py-1 text-xs font-black text-[#163B5C]"
          >
            {`{{ ${variable} }}`}
          </span>
        ))}
        {!variables.length ? (
          <span className="text-sm font-semibold text-[#667085]">
            No placeholders in this template.
          </span>
        ) : null}
      </div>
      {allowedVariables.length ? (
        <>
          <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#667085]">
            Allowed by selected trigger
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedVariables.map((variable) => (
              <span
                key={variable}
                className="rounded-md border border-[#BFEAD9] bg-white px-2 py-1 text-xs font-black text-[#064C35]"
              >
                {`{{ ${variable} }}`}
              </span>
            ))}
          </div>
        </>
      ) : null}
      {unknownVariables.length ? (
        <p className="mt-3 rounded-md border border-[#F5B7B7] bg-[#FDECEC] p-3 text-xs font-semibold text-[#8A1F1F]">
          Unsupported for this trigger: {unknownVariables.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function PreviewPanel({ subject, bodyHtml }: { subject: string; bodyHtml: string }) {
  return (
    <div className="rounded-lg border border-[#D8E2EA] bg-white p-4">
      <p className="text-sm font-black text-[#1F2933]">Preview</p>
      <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-3">
        <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Subject</p>
        <p className="mt-2 text-sm font-black text-[#1F2933]">{subject || "Subject preview"}</p>
      </div>
      <div className="mt-3 rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-3">
        <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Body</p>
        <div
          className="mt-2 max-h-[420px] overflow-auto rounded-md border border-[#E5E7EB]"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml) }}
        />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</span>
      <input
        value={value}
        readOnly
        className="mt-2 h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-black text-[#667085]"
      />
    </label>
  );
}

function EmailMetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <AdminPanel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#667085]">{label}</p>
          <p className="mt-3 text-2xl font-black text-[#163B5C]">{value}</p>
        </div>
        <StatusBadge tone={tone}>{tone === "success" ? "Healthy" : humanize(tone)}</StatusBadge>
      </div>
    </AdminPanel>
  );
}

function StatusSummary({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-2xl font-black text-[#1F2933]">{value}</span>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
    </div>
  );
}

function EmailErrorNotice({ error }: { error: unknown }) {
  return (
    <AdminStatusNotice
      title="Admin email request failed"
      message={error instanceof Error ? error.message : "Unable to load email data."}
      tone="danger"
      {...(error instanceof IndihubApiError ? { status: error.status } : {})}
      className="mb-4"
    />
  );
}

function EmailDataTable<T extends { id: string }>({
  items,
  columns,
  isLoading,
  emptyTitle,
}: {
  items: T[];
  columns: Array<{ header: string; className?: string; cell: (item: T) => ReactNode }>;
  isLoading?: boolean | undefined;
  emptyTitle: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#D8E2EA] bg-white shadow-sm">
      <table className="min-w-full text-left">
        <thead className="bg-[#F8FAFC]">
          <tr className="border-b border-[#E5E7EB] text-xs font-black uppercase tracking-wide text-[#667085]">
            {columns.map((column) => (
              <th key={column.header} className={`px-4 py-3 ${column.className ?? ""}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              {columns.map((column) => (
                <td key={column.header} className={`px-4 py-4 ${column.className ?? ""}`}>
                  {column.cell(item)}
                </td>
              ))}
            </tr>
          ))}
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
              >
                Loading email records...
              </td>
            </tr>
          ) : null}
          {!isLoading && !items.length ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm font-semibold text-[#667085]"
              >
                {emptyTitle}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function EntityTitle({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <div className="min-w-0">
      <p className="font-black text-[#1F2933]">{title}</p>
      {subtitle ? (
        <p className="mt-1 max-w-xs truncate text-xs font-semibold text-[#667085]">{subtitle}</p>
      ) : null}
    </div>
  );
}

function SmallStack({ lines }: { lines: Array<string | number | null | undefined> }) {
  return (
    <div className="space-y-1">
      {lines.filter(Boolean).map((line, index) => (
        <p
          key={`${line}-${index}`}
          className={
            index === 0
              ? "text-sm font-black text-[#1F2933]"
              : "text-xs font-semibold text-[#667085]"
          }
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function useEmailTemplates(authHeaders: IndihubAuthHeaders) {
  return useQuery({
    queryKey: ["admin-email-templates", authHeaders],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<EmailTemplateRecord[]>("/api/admin/email/templates", undefined, authHeaders),
  });
}

function useEmailThemes(authHeaders: IndihubAuthHeaders) {
  return useQuery({
    queryKey: ["admin-email-themes", authHeaders],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<EmailThemeRecord[]>("/api/admin/email/themes", undefined, authHeaders),
  });
}

function useEmailTriggers(authHeaders: IndihubAuthHeaders) {
  return useQuery({
    queryKey: ["admin-email-triggers", authHeaders],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<EmailTriggerRecord[]>("/api/admin/email/triggers", undefined, authHeaders),
  });
}

function useEmailSettings(authHeaders: IndihubAuthHeaders) {
  return useQuery({
    queryKey: ["admin-email-settings", authHeaders],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<EmailSettingRecord>("/api/admin/email/settings/current", undefined, authHeaders),
  });
}

function useEmailOverview(authHeaders: IndihubAuthHeaders) {
  return useQuery({
    queryKey: ["admin-email-overview", authHeaders],
    enabled: Boolean(authHeaders.bearerToken),
    queryFn: () =>
      indihubFetch<EmailOverviewRecord>("/api/admin/email/overview", undefined, authHeaders),
  });
}

function adminRequest<T = unknown>(
  path: string,
  authHeaders: IndihubAuthHeaders,
  init?: RequestInit,
) {
  return indihubFetch<T>(path, init, authHeaders);
}

function notificationBodyPreview(body?: string | null) {
  if (!body) {
    return "No body stored";
  }

  const readable = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const preview = readable || body;

  return preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
}

function safeColorInputValue(value: string | undefined, fallback: string) {
  if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) {
    return value;
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(fallback)) {
    return fallback;
  }

  return "#000000";
}

function notificationVariableLines(variables?: Record<string, unknown> | null) {
  if (!variables || typeof variables !== "object") {
    return ["No variables stored"];
  }

  return Object.entries(variables).map(([key, value]) => `${key}: ${String(value)}`);
}

function recipientCount(value?: string | null) {
  if (!value?.trim()) {
    return 0;
  }

  return new Set(
    value
      .split(/[\n,]/)
      .map((recipient) => recipient.trim().toLowerCase())
      .filter(Boolean),
  ).size;
}

function statusTone(status?: string | null): StatusTone {
  const normalized = status ?? "";
  if (
    [
      "ACTIVE",
      "APPROVED",
      "PAID",
      "DELIVERED",
      "SENT",
      "COMPLETED",
      "PUBLISHED",
      "RESPONDED",
      "BUYER_CONFIRMED",
      "ADMIN_APPROVED",
      "FINALISED",
    ].includes(normalized)
  ) {
    return "success";
  }
  if (
    [
      "PENDING",
      "PENDING_APPROVAL",
      "PLACED",
      "PROCESSING",
      "IN_REVIEW",
      "DRAFT",
      "SKIPPED",
      "OPEN",
    ].includes(normalized)
  ) {
    return "warning";
  }
  if (
    ["REJECTED", "SUSPENDED", "DISABLED", "FAILED", "CANCELLED", "ARCHIVED"].includes(normalized)
  ) {
    return "danger";
  }
  return "info";
}

function humanize(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
