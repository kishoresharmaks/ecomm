import {
  Add01Icon,
  Alert01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  ChartIcon,
  Chat01Icon,
  Notification01Icon,
  PackageIcon,
  ShoppingBag01Icon,
  ToolsIcon,
  UserCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, type Href } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  Card,
  Field,
  Header,
  LoadingState,
  QueryErrorState,
  Screen,
  SelectField,
  Skeleton,
  StatusChip,
} from "../../src/components/screen";
import { formatMoney } from "../../src/lib/money";
import { uploadSellerPrivateDocument, type MobileUploadFile } from "../../src/features/seller/mobile-upload";
import {
  getSellerProfile,
  getSellerSalesReport,
  onboardSeller,
  type SellerDocumentType,
  type SellerProfile,
  type SellerSalesReport,
  type SellerTaxRegistrationStatus,
  type SellerVerificationDocumentPayload,
} from "../../src/features/seller/seller-api";
import { sellerDashboardMode, type SellerDashboardMode } from "../../src/features/seller/seller-dashboard";
import { sellerReportDateQuery, type SellerReportPeriod } from "../../src/features/seller/report-navigation";
import {
  SELLER_TAX_REGISTRATION_OPTIONS,
  missingOnboardingDocumentTypes,
  normalizeGstin,
  requiredOnboardingDocumentTypes,
  validateGstin,
} from "../../src/features/seller/seller-tax";
import { sellerWorkspaceState } from "../../src/features/seller/seller-state";
import {
  useSellerPushNotificationStatus,
  type SellerPushPermissionState,
} from "../../src/features/seller/use-seller-push-notifications";
import { colors, spacing } from "../../src/theme";

const SELLER_TYPE_OPTIONS = [
  { label: "Marketplace seller", value: "MARKETPLACE_SELLER" },
  { label: "Hyperlocal store", value: "HYPERLOCAL_STORE" },
  { label: "Wholesale distributor", value: "WHOLESALE_DISTRIBUTOR" },
];

const BUSINESS_TYPE_OPTIONS = [
  { label: "Individual", value: "INDIVIDUAL" },
  { label: "Proprietorship", value: "PROPRIETORSHIP" },
  { label: "Partnership", value: "PARTNERSHIP" },
  { label: "LLP", value: "LLP" },
  { label: "Private limited", value: "PRIVATE_LIMITED" },
  { label: "Public limited", value: "PUBLIC_LIMITED" },
  { label: "Other", value: "OTHER" },
];

type DashboardPeriod = Extract<SellerReportPeriod, "today" | "7d" | "month">;

const DASHBOARD_PERIODS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "This month", value: "month" },
];

const activityDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

export default function SellerDashboardScreen() {
  const auth = useMobileSellerAuth();
  const pushNotifications = useSellerPushNotificationStatus();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [refreshing, setRefreshing] = useState(false);
  const dateQuery = useMemo(() => sellerReportDateQuery(period), [period]);
  const profileQuery = useQuery({
    queryKey: ["seller-profile", auth.authKey],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });
  const profileState = sellerWorkspaceState(profileQuery.data, profileQuery.error && "status" in profileQuery.error ? Number(profileQuery.error.status) : undefined);
  const reportQuery = useQuery({
    queryKey: ["seller-sales-report", auth.authKey, "dashboard", period],
    queryFn: () => getSellerSalesReport(auth.authHeaders, dateQuery),
    enabled: auth.enabled && profileState === "approved",
    placeholderData: (previous) => previous,
    retry: false,
  });

  async function refreshDashboard() {
    setRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), reportQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  if (auth.status === "signed-out") {
    return <Redirect href="/auth/sign-in" />;
  }
  if (!auth.enabled || profileQuery.isLoading) {
    return <LoadingState message="Preparing seller workspace..." />;
  }
  if (profileState === "needs-onboarding") {
    return <OnboardingScreen />;
  }
  if (profileState === "pending-approval") {
    return (
      <Screen>
        <Header title="Approval pending" subtitle="Your seller registration is submitted. Verification is required before catalogue and order tools unlock." />
        <Card>
          <StatusChip label={profileQuery.data?.approvalStatus ?? "PENDING_APPROVAL"} tone="warning" />
          <Text style={{ color: "#6B7280" }}>We will keep this app ready for products, orders, finance, and profile management once the store is approved.</Text>
        </Card>
      </Screen>
    );
  }
  if (profileState === "blocked") {
    return (
      <Screen>
        <Header title="Seller account blocked" subtitle="This store cannot currently use seller operations. Contact support for the next step." />
        <Card>
          <StatusChip label={profileQuery.data?.status ?? "BLOCKED"} tone="danger" />
        </Card>
      </Screen>
    );
  }

  const report = reportQuery.data;
  const profile = profileQuery.data;
  const mode = sellerDashboardMode(profile, report);
  const isTablet = width >= 700;
  const currency = report?.currency ?? profile?.operatingCurrency ?? "INR";
  const pendingB2B = countStatuses(report?.b2b?.byEnquiryStatus, ["SUBMITTED", "IN_REVIEW"]);
  const serviceRequests = countStatuses(report?.services?.byBookingStatus, ["REQUESTED"]);
  const quickActions = dashboardQuickActions(mode, pendingB2B > 0);

  return (
    <Screen
      contentContainerStyle={dashboardStyles.content}
      refreshing={refreshing}
      onRefresh={() => {
        void refreshDashboard();
      }}
    >
      <DashboardHeader profile={profile} />
      <NotificationStatusBanner state={pushNotifications.state} onRefresh={pushNotifications.refresh} />

      <View style={dashboardStyles.section}>
        <View style={dashboardStyles.sectionHeader}>
          <View style={dashboardStyles.sectionHeadingCopy}>
            <Text style={dashboardStyles.sectionTitle}>Performance</Text>
            <Text style={dashboardStyles.sectionSubtitle}>Sales and activity for the selected period.</Text>
          </View>
          {reportQuery.isFetching && report ? <Text style={dashboardStyles.refreshText}>Updating...</Text> : null}
        </View>
        <PeriodSelector period={period} onChange={setPeriod} />
        {reportQuery.isLoading && !report ? (
          <DashboardMetricSkeleton isTablet={isTablet} />
        ) : report ? (
          <MetricGrid
            isTablet={isTablet}
            items={dashboardMetrics(mode, report, currency)}
          />
        ) : null}
      </View>

      {reportQuery.error ? (
        <QueryErrorState
          title="Dashboard activity could not be loaded"
          message={reportQuery.error instanceof Error ? reportQuery.error.message : undefined}
          onRetry={() => {
            void reportQuery.refetch();
          }}
          retrying={reportQuery.isFetching}
        />
      ) : null}

      {report ? (
        <AttentionSection
          isTablet={isTablet}
          lowStockCount={report.summary.lowStockCount}
          payoutProfile={profile?.payoutProfile}
          pendingB2B={pendingB2B}
          serviceRequests={serviceRequests}
        />
      ) : null}

      <DashboardSection
        title="Quick actions"
        subtitle="Open the seller tools used most often."
      >
        <View style={dashboardStyles.actionGrid}>
          {quickActions.map((action) => (
            <QuickActionTile key={action.label} action={action} isTablet={isTablet} />
          ))}
        </View>
      </DashboardSection>

      {report ? (
        <>
          {mode !== "service" ? <RecentOrders report={report} /> : null}
          {mode !== "retail" ? <RecentServiceBookings report={report} /> : null}
          {mode !== "service" && report.lowStockProducts.length ? <StockWatch report={report} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

function DashboardHeader({ profile }: { profile: SellerProfile | undefined }) {
  return (
    <View style={dashboardStyles.dashboardHeader}>
      <View style={dashboardStyles.dashboardHeaderCopy}>
        <Text style={dashboardStyles.brandLabel}>1HandIndia Seller Hub</Text>
        <Text style={dashboardStyles.storeName} numberOfLines={2}>
          {profile?.storeName ?? "Seller workspace"}
        </Text>
        <View style={dashboardStyles.headerStatus}>
          <StatusChip label="Approved seller" tone="success" />
          {profile?.subscriptionPlan?.name ? (
            <Text style={dashboardStyles.planLabel} numberOfLines={1}>
              {profile.subscriptionPlan.name}
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityHint="Opens store, business, and payout details"
        accessibilityLabel="Open seller profile"
        accessibilityRole="button"
        onPress={() => router.push("/(tabs)/profile")}
        style={({ pressed }) => [dashboardStyles.profileButton, pressed ? dashboardStyles.pressed : null]}
      >
        <HugeiconsIcon icon={UserCircleIcon} color={colors.primary} size={25} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function NotificationStatusBanner({
  onRefresh,
  state,
}: {
  onRefresh: () => void;
  state: SellerPushPermissionState;
}) {
  if (state === "registered" || state === "checking") {
    return null;
  }

  const message =
    state === "permission-denied"
      ? "Notifications are off. Enable alerts to receive new order and B2B enquiry updates on this device."
      : state === "device-unsupported"
        ? "Push notifications need a real Android or iOS device."
        : state === "expo-go-unsupported"
          ? "Push notifications need a development build or EAS build. Expo Go cannot receive Android seller alerts."
        : "Notification registration could not be completed. Retry after checking network and app settings.";

  return (
    <View style={dashboardStyles.notificationBanner}>
      <View style={dashboardStyles.notificationIcon}>
        <HugeiconsIcon icon={Notification01Icon} color={colors.warning} size={22} strokeWidth={2.2} />
      </View>
      <View style={dashboardStyles.notificationCopy}>
        <Text style={dashboardStyles.notificationTitle}>Seller alerts need attention</Text>
        <Text style={dashboardStyles.notificationMessage}>{message}</Text>
      </View>
      <Pressable
        accessibilityLabel="Retry seller notification setup"
        accessibilityRole="button"
        onPress={onRefresh}
        style={({ pressed }) => [dashboardStyles.retryButton, pressed ? dashboardStyles.pressed : null]}
      >
        <Text style={dashboardStyles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function PeriodSelector({
  onChange,
  period,
}: {
  onChange: (period: DashboardPeriod) => void;
  period: DashboardPeriod;
}) {
  return (
    <View accessibilityLabel="Dashboard reporting period" style={dashboardStyles.periodSelector}>
      {DASHBOARD_PERIODS.map((option) => {
        const selected = option.value === period;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              dashboardStyles.periodButton,
              selected ? dashboardStyles.periodButtonSelected : null,
              pressed ? dashboardStyles.pressed : null,
            ]}
          >
            <Text style={[dashboardStyles.periodText, selected ? dashboardStyles.periodTextSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type MetricItem = {
  label: string;
  note: string;
  value: string;
  warning?: boolean;
};

function dashboardMetrics(
  mode: SellerDashboardMode,
  report: SellerSalesReport,
  currency: string,
): MetricItem[] {
  const retailMetrics: MetricItem[] = [
    { label: "Net product sales", value: formatMoney(report.summary.netSalesPaise, currency), note: "Selected period" },
    { label: "Product orders", value: String(report.summary.orderCount), note: "Selected period" },
  ];
  const serviceMetrics: MetricItem[] = [
    {
      label: "Service revenue",
      value: formatMoney(report.summary.serviceRevenuePaise ?? report.services?.paidPaymentPaise, currency),
      note: "Paid in selected period",
    },
    {
      label: "Service bookings",
      value: String(report.summary.serviceBookings ?? report.services?.bookingCount ?? 0),
      note: "Selected period",
    },
  ];

  if (mode === "hybrid") return [...retailMetrics, ...serviceMetrics];
  if (mode === "service") {
    return [
      ...serviceMetrics,
      { label: "Active services", value: String(report.services?.activeListingCount ?? 0), note: "Live catalogue" },
      { label: "Paid payments", value: String(report.services?.paidPaymentCount ?? 0), note: "Selected period" },
    ];
  }
  return [
    ...retailMetrics,
    { label: "Products", value: String(report.summary.products), note: "Live catalogue" },
    {
      label: "Low stock",
      value: String(report.summary.lowStockCount),
      note: "Live inventory",
      warning: report.summary.lowStockCount > 0,
    },
  ];
}

function MetricGrid({ isTablet, items }: { isTablet: boolean; items: MetricItem[] }) {
  return (
    <View style={dashboardStyles.metricGrid}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            dashboardStyles.metricTile,
            isTablet ? dashboardStyles.fourColumnItem : dashboardStyles.twoColumnItem,
            item.warning ? dashboardStyles.metricTileWarning : null,
          ]}
        >
          <Text style={dashboardStyles.metricLabel}>{item.label}</Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={dashboardStyles.metricValue}>
            {item.value}
          </Text>
          <Text style={dashboardStyles.metricNote}>{item.note}</Text>
        </View>
      ))}
    </View>
  );
}

function DashboardMetricSkeleton({ isTablet }: { isTablet: boolean }) {
  return (
    <View style={dashboardStyles.metricGrid}>
      {[0, 1, 2, 3].map((item) => (
        <View
          key={item}
          style={[
            dashboardStyles.metricTile,
            isTablet ? dashboardStyles.fourColumnItem : dashboardStyles.twoColumnItem,
          ]}
        >
          <Skeleton height={12} />
          <Skeleton height={24} />
          <Skeleton height={10} />
        </View>
      ))}
    </View>
  );
}

type AttentionItem = {
  detail: string;
  href: Href;
  icon: IconSvgElement;
  title: string;
};

function AttentionSection({
  isTablet,
  lowStockCount,
  payoutProfile,
  pendingB2B,
  serviceRequests,
}: {
  isTablet: boolean;
  lowStockCount: number;
  payoutProfile: SellerProfile["payoutProfile"];
  pendingB2B: number;
  serviceRequests: number;
}) {
  const items: AttentionItem[] = [];

  if (lowStockCount > 0) {
    items.push({
      title: `${lowStockCount} low-stock ${lowStockCount === 1 ? "variant" : "variants"}`,
      detail: "Review stock before products become unavailable.",
      href: "/(tabs)/products",
      icon: Alert01Icon,
    });
  }
  const hasPayoutMethod = Boolean(payoutProfile?.maskedAccountNumber || payoutProfile?.maskedUpiId);
  if (!hasPayoutMethod) {
    items.push({
      title: "Add payout details",
      detail: "Bank or UPI details are required before requesting payouts.",
      href: "/(tabs)/profile",
      icon: Wallet01Icon,
    });
  } else if (!payoutProfile?.isVerified) {
    items.push({
      title: "Payout details awaiting verification",
      detail: "Review the saved information while verification is pending.",
      href: "/(tabs)/profile",
      icon: Wallet01Icon,
    });
  }
  if (pendingB2B > 0) {
    items.push({
      title: `${pendingB2B} B2B ${pendingB2B === 1 ? "enquiry" : "enquiries"} awaiting response`,
      detail: "Open buyer requirements and prepare a quotation.",
      href: "/b2b-enquiries",
      icon: Chat01Icon,
    });
  }
  if (serviceRequests > 0) {
    items.push({
      title: `${serviceRequests} new service ${serviceRequests === 1 ? "request" : "requests"}`,
      detail: "Review the requested work and scheduling details.",
      href: "/(tabs)/services?view=jobs" as Href,
      icon: ToolsIcon,
    });
  }

  return (
    <DashboardSection
      title="Needs attention"
      subtitle="Live tasks that may affect sales or payouts."
    >
      {items.length ? (
        <View style={dashboardStyles.attentionGrid}>
          {items.map((item) => (
            <AttentionTile key={item.title} item={item} isTablet={isTablet} />
          ))}
        </View>
      ) : (
        <View style={dashboardStyles.clearState}>
          <Text style={dashboardStyles.clearStateTitle}>Operations look clear</Text>
          <Text style={dashboardStyles.clearStateText}>There are no current stock, payout, B2B, or service alerts.</Text>
        </View>
      )}
    </DashboardSection>
  );
}

function AttentionTile({ isTablet, item }: { isTablet: boolean; item: AttentionItem }) {
  return (
    <Pressable
      accessibilityHint={item.detail}
      accessibilityRole="button"
      onPress={() => router.push(item.href)}
      style={({ pressed }) => [
        dashboardStyles.attentionTile,
        isTablet ? dashboardStyles.twoColumnItem : dashboardStyles.fullWidthItem,
        pressed ? dashboardStyles.pressed : null,
      ]}
    >
      <View style={dashboardStyles.attentionIcon}>
        <HugeiconsIcon icon={item.icon} color={colors.primary} size={21} strokeWidth={2.1} />
      </View>
      <View style={dashboardStyles.attentionCopy}>
        <Text style={dashboardStyles.attentionTitle}>{item.title}</Text>
        <Text style={dashboardStyles.attentionDetail}>{item.detail}</Text>
      </View>
      <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={19} strokeWidth={2} />
    </Pressable>
  );
}

type QuickAction = {
  detail: string;
  href: Href;
  icon: IconSvgElement;
  label: string;
};

function dashboardQuickActions(mode: SellerDashboardMode, hasB2BWork: boolean): QuickAction[] {
  const actions: QuickAction[] =
    mode === "service"
      ? [
          { label: "Add service", detail: "Create a listing", href: "/services/new", icon: Add01Icon },
          { label: "Service jobs", detail: "Review bookings", href: "/(tabs)/services?view=jobs" as Href, icon: ToolsIcon },
        ]
      : mode === "hybrid"
        ? [
            { label: "Add product", detail: "Create a listing", href: "/products/new", icon: Add01Icon },
            { label: "Add service", detail: "Create a service", href: "/services/new", icon: ToolsIcon },
            { label: "Orders", detail: "Manage fulfilment", href: "/(tabs)/orders", icon: PackageIcon },
            { label: "Service jobs", detail: "Review bookings", href: "/(tabs)/services?view=jobs" as Href, icon: Briefcase01Icon },
          ]
        : [
            { label: "Add product", detail: "Create a listing", href: "/products/new", icon: Add01Icon },
            { label: "Orders", detail: "Manage fulfilment", href: "/(tabs)/orders", icon: PackageIcon },
          ];

  actions.push(
    { label: "Finance", detail: "Payouts and ledger", href: "/(tabs)/finance", icon: Wallet01Icon },
    hasB2BWork
      ? { label: "B2B enquiries", detail: "Reply to buyers", href: "/b2b-enquiries", icon: Chat01Icon }
      : { label: "Reports", detail: "Sales and stock", href: "/(tabs)/sales", icon: ChartIcon },
  );
  return actions;
}

function QuickActionTile({ action, isTablet }: { action: QuickAction; isTablet: boolean }) {
  return (
    <Pressable
      accessibilityHint={action.detail}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={() => router.push(action.href)}
      style={({ pressed }) => [
        dashboardStyles.actionTile,
        isTablet ? dashboardStyles.fourColumnItem : dashboardStyles.twoColumnItem,
        pressed ? dashboardStyles.pressed : null,
      ]}
    >
      <View style={dashboardStyles.actionIcon}>
        <HugeiconsIcon icon={action.icon} color={colors.primary} size={22} strokeWidth={2.2} />
      </View>
      <Text style={dashboardStyles.actionLabel} numberOfLines={1}>
        {action.label}
      </Text>
      <Text style={dashboardStyles.actionDetail} numberOfLines={1}>
        {action.detail}
      </Text>
    </Pressable>
  );
}

function RecentOrders({ report }: { report: SellerSalesReport }) {
  const orders = report.recentOrders.slice(0, 4);
  return (
    <DashboardSection
      title="Recent orders"
      subtitle="Latest product orders in the selected period."
      actionLabel="View all"
      onAction={() => router.push("/(tabs)/orders")}
    >
      {orders.length ? (
        <View style={dashboardStyles.listSurface}>
          {orders.map((split, index) => (
            <ActivityRow
              key={split.id}
              amount={formatMoney(split.sellerSubtotalPaise, split.order.currency ?? report.currency ?? "INR")}
              date={split.order.createdAt ?? split.createdAt}
              divider={index > 0}
              href={`/orders/${encodeURIComponent(split.order.orderNumber)}` as Href}
              icon={PackageIcon}
              status={split.sellerStatus}
              title={split.order.orderNumber}
            />
          ))}
        </View>
      ) : (
        <CompactEmptyState
          title="No product orders in this period"
          message="New orders containing your products will appear here."
        />
      )}
    </DashboardSection>
  );
}

function RecentServiceBookings({ report }: { report: SellerSalesReport }) {
  const bookings = report.services?.recentBookings.slice(0, 4) ?? [];
  return (
    <DashboardSection
      title="Recent service jobs"
      subtitle="Latest customer bookings in the selected period."
      actionLabel="View jobs"
      onAction={() => router.push("/(tabs)/services?view=jobs" as Href)}
    >
      {bookings.length ? (
        <View style={dashboardStyles.listSurface}>
          {bookings.map((booking, index) => (
            <ActivityRow
              key={booking.id}
              amount={formatMoney(booking.totalPayablePaise, booking.currency)}
              date={booking.createdAt}
              divider={index > 0}
              href={`/service-bookings/${encodeURIComponent(booking.bookingNumber)}` as Href}
              icon={ToolsIcon}
              status={booking.status}
              title={booking.listing?.title ?? booking.bookingNumber}
            />
          ))}
        </View>
      ) : (
        <CompactEmptyState
          title="No service jobs in this period"
          message="New customer service bookings will appear here."
        />
      )}
    </DashboardSection>
  );
}

function ActivityRow({
  amount,
  date,
  divider,
  href,
  icon,
  status,
  title,
}: {
  amount: string;
  date: string | undefined;
  divider: boolean;
  href: Href;
  icon: IconSvgElement;
  status: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}, ${statusLabel(status)}, ${amount}`}
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        dashboardStyles.activityRow,
        divider ? dashboardStyles.rowDivider : null,
        pressed ? dashboardStyles.pressed : null,
      ]}
    >
      <View style={dashboardStyles.activityIcon}>
        <HugeiconsIcon icon={icon} color={colors.primary} size={21} strokeWidth={2.1} />
      </View>
      <View style={dashboardStyles.activityCopy}>
        <Text style={dashboardStyles.activityTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={dashboardStyles.activityMeta} numberOfLines={1}>
          {statusLabel(status)} · {formatActivityDate(date)}
        </Text>
      </View>
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={dashboardStyles.activityAmount}>
        {amount}
      </Text>
      <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={18} strokeWidth={2} />
    </Pressable>
  );
}

function StockWatch({ report }: { report: SellerSalesReport }) {
  return (
    <DashboardSection
      title="Stock watch"
      subtitle="Variants at five units or below."
      actionLabel="View products"
      onAction={() => router.push("/(tabs)/products")}
    >
      <View style={dashboardStyles.listSurface}>
        {report.lowStockProducts.slice(0, 4).map((variant, index) => (
          <Pressable
            key={variant.id}
            accessibilityLabel={`${variant.product.name}, ${variant.stockQuantity ?? 0} units remaining`}
            accessibilityRole="button"
            onPress={() => router.push(`/products/detail/${encodeURIComponent(variant.product.id)}`)}
            style={({ pressed }) => [
              dashboardStyles.stockRow,
              index > 0 ? dashboardStyles.rowDivider : null,
              pressed ? dashboardStyles.pressed : null,
            ]}
          >
            <View style={dashboardStyles.stockIcon}>
              <HugeiconsIcon icon={ShoppingBag01Icon} color={colors.danger} size={20} strokeWidth={2.1} />
            </View>
            <View style={dashboardStyles.activityCopy}>
              <Text style={dashboardStyles.activityTitle} numberOfLines={1}>
                {variant.product.name}
              </Text>
              <Text style={dashboardStyles.activityMeta} numberOfLines={1}>
                {variant.variantName ?? variant.sku ?? "Default variant"}
              </Text>
            </View>
            <Text style={dashboardStyles.stockCount}>{variant.stockQuantity ?? 0} left</Text>
          </Pressable>
        ))}
      </View>
    </DashboardSection>
  );
}

function DashboardSection({
  actionLabel,
  children,
  onAction,
  subtitle,
  title,
}: {
  actionLabel?: string;
  children: ReactNode;
  onAction?: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={dashboardStyles.section}>
      <View style={dashboardStyles.sectionHeader}>
        <View style={dashboardStyles.sectionHeadingCopy}>
          <Text style={dashboardStyles.sectionTitle}>{title}</Text>
          <Text style={dashboardStyles.sectionSubtitle}>{subtitle}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [dashboardStyles.sectionAction, pressed ? dashboardStyles.pressed : null]}
          >
            <Text style={dashboardStyles.sectionActionText}>{actionLabel}</Text>
            <HugeiconsIcon icon={ArrowRight01Icon} color={colors.primary} size={17} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function CompactEmptyState({ message, title }: { message: string; title: string }) {
  return (
    <View style={dashboardStyles.emptyState}>
      <Text style={dashboardStyles.emptyTitle}>{title}</Text>
      <Text style={dashboardStyles.emptyText}>{message}</Text>
    </View>
  );
}

function countStatuses(
  rows: Array<{ count: number; status: string }> | undefined,
  statuses: string[],
) {
  return (rows ?? []).reduce((total, row) => total + (statuses.includes(row.status) ? row.count : 0), 0);
}

function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatActivityDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : activityDateFormatter.format(date);
}

const dashboardStyles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  dashboardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  dashboardHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  brandLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  storeName: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  headerStatus: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  planLabel: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  profileButton: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  pressed: {
    opacity: 0.72,
  },
  notificationBanner: {
    alignItems: "center",
    backgroundColor: "#FFF8E8",
    borderColor: "#F5D98C",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  notificationIcon: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  notificationCopy: {
    flex: 1,
    gap: 2,
  },
  notificationTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  notificationMessage: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  retryButton: {
    alignItems: "center",
    borderColor: "#E2B84B",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 60,
    paddingHorizontal: spacing.sm,
  },
  retryButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    paddingTop: 4,
  },
  sectionAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingLeft: spacing.sm,
  },
  sectionActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  periodSelector: {
    backgroundColor: "#F4EFEC",
    borderRadius: 8,
    flexDirection: "row",
    padding: spacing.xs,
  },
  periodButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  periodButtonSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  periodText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  periodTextSelected: {
    color: colors.primary,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    justifyContent: "space-between",
    minHeight: 104,
    padding: spacing.md,
  },
  metricTileWarning: {
    borderColor: "#F0B8A8",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  metricNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  twoColumnItem: {
    flexBasis: "47%",
  },
  fourColumnItem: {
    flexBasis: "23%",
  },
  fullWidthItem: {
    flexBasis: "100%",
  },
  attentionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  attentionTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexGrow: 1,
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  attentionIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  attentionCopy: {
    flex: 1,
    gap: 2,
  },
  attentionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  attentionDetail: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  clearState: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBE7C8",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  clearStateTitle: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "900",
  },
  clearStateText: {
    color: "#3F6F4B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 112,
    padding: spacing.md,
  },
  actionIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 40,
  },
  actionLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  actionDetail: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  listSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  activityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  activityIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  activityCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  activityTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  activityMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  activityAmount: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    maxWidth: 104,
  },
  stockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stockIcon: {
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  stockCount: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});

function OnboardingScreen() {
  const auth = useMobileSellerAuth();
  const [sellerType, setSellerType] = useState<"MARKETPLACE_SELLER" | "HYPERLOCAL_STORE" | "WHOLESALE_DISTRIBUTOR">("MARKETPLACE_SELLER");
  const [storeName, setStoreName] = useState("");
  const [businessLegalName, setBusinessLegalName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [taxRegistrationStatus, setTaxRegistrationStatus] = useState<SellerTaxRegistrationStatus>("NOT_REGISTERED");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [documents, setDocuments] = useState<SellerVerificationDocumentPayload[]>([]);
  const [uploadingDocument, setUploadingDocument] = useState<SellerDocumentType | null>(null);
  const [documentError, setDocumentError] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      const gstError = validateGstin(taxRegistrationStatus, gstNumber);
      if (gstError) throw new Error(gstError);
      const missingDocuments = missingOnboardingDocumentTypes(taxRegistrationStatus, documents);
      if (missingDocuments.length) {
        throw new Error(`Upload ${missingDocuments.map(documentLabel).join(", ")} before submitting.`);
      }
      return onboardSeller(auth.authHeaders, {
        sellerType,
        storeName,
        contactName,
        contactPhone,
        taxRegistrationStatus,
        ...(businessLegalName ? { businessLegalName } : {}),
        ...(businessType ? { businessType } : {}),
        ...(taxRegistrationStatus !== "NOT_REGISTERED" ? { gstNumber: normalizeGstin(gstNumber) } : {}),
        ...(panNumber ? { panNumber } : {}),
        ...(businessDescription ? { businessDescription } : {}),
        documents,
        address: { line1, line2, area, city, state, pincode, country: "India", countryCode: "IN" },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-profile", auth.authKey] });
    },
  });
  const missingDocuments = missingOnboardingDocumentTypes(taxRegistrationStatus, documents);
  const canSubmit = Boolean(
    storeName.trim() &&
      contactName.trim() &&
      contactPhone.trim() &&
      line1.trim() &&
      !validateGstin(taxRegistrationStatus, gstNumber) &&
      missingDocuments.length === 0,
  );

  async function uploadDocument(documentType: SellerDocumentType) {
    setUploadingDocument(documentType);
    setDocumentError("");
    try {
      const result = await pickOnboardingDocument();
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const file: MobileUploadFile = {
        uri: asset.uri,
        name: asset.name ?? `seller-document-${Date.now()}`,
        mimeType: asset.mimeType ?? "application/pdf",
        sizeBytes: asset.size,
      };
      const uploaded = await uploadSellerPrivateDocument(auth.authHeaders, file, documentType);
      setDocuments((current) => [
        ...current.filter((document) => document.documentType !== documentType),
        { documentType, fileUrl: uploaded.assetKey },
      ]);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setUploadingDocument(null);
    }
  }

  return (
    <Screen>
      <Header title="Register as seller" subtitle="Create the store profile our team will review before product operations open." />
      <Card>
        <SelectField label="Seller type" options={SELLER_TYPE_OPTIONS} selectedValue={sellerType} onSelect={(value) => setSellerType(value as typeof sellerType)} />
        <Field label="Store name" value={storeName} onChangeText={setStoreName} />
        <Field label="Business legal name" value={businessLegalName} onChangeText={setBusinessLegalName} />
        <SelectField label="Business type" options={BUSINESS_TYPE_OPTIONS} selectedValue={businessType} onSelect={setBusinessType} />
        <SelectField
          label="GST registration"
          options={SELLER_TAX_REGISTRATION_OPTIONS}
          selectedValue={taxRegistrationStatus}
          onSelect={(value) => {
            setTaxRegistrationStatus(value as SellerTaxRegistrationStatus);
            if (value === "NOT_REGISTERED") setGstNumber("");
          }}
        />
        {taxRegistrationStatus !== "NOT_REGISTERED" ? (
          <Field
            label="GSTIN"
            value={gstNumber}
            onChangeText={(value) => setGstNumber(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={15}
            error={validateGstin(taxRegistrationStatus, gstNumber)}
          />
        ) : null}
        <Field label="PAN number" value={panNumber} onChangeText={setPanNumber} autoCapitalize="characters" />
        <Field label="Contact name" value={contactName} onChangeText={setContactName} />
        <Field keyboardType="phone-pad" label="Contact phone" value={contactPhone} onChangeText={setContactPhone} />
        <Field label="Business description" value={businessDescription} onChangeText={setBusinessDescription} multiline />
        <Field label="Address line" value={line1} onChangeText={setLine1} />
        <Field label="Address line 2" value={line2} onChangeText={setLine2} />
        <Field label="Area" value={area} onChangeText={setArea} />
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="State" value={state} onChangeText={setState} />
        <Field keyboardType="number-pad" label="Pincode" value={pincode} onChangeText={setPincode} />
        <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900" }}>Verification documents</Text>
        <Text style={{ color: "#6B7280", fontSize: 12, lineHeight: 18 }}>
          Upload identity, signature, address and bank proof. GST sellers must also upload the GST certificate.
        </Text>
        {requiredOnboardingDocumentTypes(taxRegistrationStatus).map((documentType) => {
          const uploaded = documents.some((document) => document.documentType === documentType);
          return (
            <Button
              key={documentType}
              tone="secondary"
              title={
                uploadingDocument === documentType
                  ? "Uploading..."
                  : `${uploaded ? "Replace" : "Upload"} ${documentLabel(documentType)}`
              }
              loading={uploadingDocument === documentType}
              onPress={() => void uploadDocument(documentType)}
            />
          );
        })}
        {documentError ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{documentError}</Text> : null}
        {missingDocuments.length ? (
          <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "800" }}>
            Required: {missingDocuments.map(documentLabel).join(", ")}
          </Text>
        ) : null}
        {mutation.error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{mutation.error instanceof Error ? mutation.error.message : "Registration failed."}</Text> : null}
        <Button disabled={mutation.isPending || !canSubmit} title={mutation.isPending ? "Submitting..." : "Submit registration"} onPress={() => mutation.mutate()} />
      </Card>
    </Screen>
  );
}

function documentLabel(type: SellerDocumentType) {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

async function pickOnboardingDocument() {
  const DocumentPicker = await import("expo-document-picker");
  return DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/jpeg", "image/png"],
    copyToCacheDirectory: true,
  });
}
