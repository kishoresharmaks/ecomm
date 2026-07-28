"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  Database,
  IndianRupee,
  Mail,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button, StatusBadge, cn, type StatusTone } from "@indihub/ui";
import { AdminPanel, AdminStatusNotice } from "@/components/admin/admin-ux";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { IndihubApiError, indihubFetch } from "@/lib/api";

type AdminDashboardSummary = {
  customers: number;
  pendingSellers: number;
  pendingProducts: number;
  activeOrders: number;
  b2bEnquiries: number;
};

type PageResult<T> = {
  items: T[];
  total: number;
};

type SupportSignal = {
  id: string;
  subject?: string | null;
  status: string;
  createdAt?: string;
};

type SalesReport = {
  summary: {
    totalPaise: number;
    subtotalPaise: number;
    shippingPaise: number;
    orderCount: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    totalPaise: number;
    currency: string;
    createdAt?: string;
    customer?: {
      user?: {
        email?: string | null;
        fullName?: string | null;
      } | null;
    } | null;
  }>;
};

const kpiCards = [
  {
    key: "pendingSellers",
    label: "Pending sellers",
    href: "/admin/sellers/approvals",
    icon: UsersRound,
    tone: "info",
    note: "Seller approval queue",
  },
  {
    key: "pendingProducts",
    label: "Product approvals",
    href: "/admin/products/approvals",
    icon: PackageCheck,
    tone: "success",
    note: "Catalogue moderation",
  },
  {
    key: "b2bEnquiries",
    label: "B2B enquiries",
    href: "/admin/b2b-enquiries",
    icon: BriefcaseBusiness,
    tone: "info",
    note: "Quotation workflow",
  },
  {
    key: "activeOrders",
    label: "Active orders",
    href: "/admin/orders",
    icon: ShoppingCart,
    tone: "warning",
    note: "Fulfilment queue",
  },
] as const;

const quickActions = [
  { label: "Approve seller", href: "/admin/sellers/approvals", icon: UserPlus, tone: "blue" },
  {
    label: "Approve product",
    href: "/admin/products/approvals",
    icon: PackageCheck,
    tone: "orange",
  },
  { label: "View active orders", href: "/admin/orders", icon: ShoppingCart, tone: "blue" },
  { label: "Email operations", href: "/admin/email", icon: Mail, tone: "orange" },
  {
    label: "Finance controls",
    href: "/admin/finance/settlements",
    icon: IndianRupee,
    tone: "blue",
  },
  { label: "View reports", href: "/admin/reports", icon: BarChart3, tone: "green" },
] as const;

export function AdminDashboardClient() {
  const auth = useAdminAuth();
  const monthRange = useMemo(() => monthDateRange(), []);
  const dashboardQuery = useQuery({
    queryKey: ["admin-dashboard", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () =>
      indihubFetch<AdminDashboardSummary>("/api/admin/dashboard", undefined, auth.authHeaders),
  });
  const salesQuery = useQuery({
    queryKey: ["admin-dashboard-sales", auth.authHeaders, monthRange],
    enabled: auth.isAuthenticated,
    queryFn: () =>
      indihubFetch<SalesReport>(
        `/api/admin/reports/sales?${monthRange}`,
        undefined,
        auth.authHeaders,
      ),
  });
  const supportQuery = useQuery({
    queryKey: ["admin-dashboard-support", auth.authHeaders],
    enabled: auth.isAuthenticated,
    queryFn: () =>
      indihubFetch<PageResult<SupportSignal>>(
        "/api/admin/support-requests?limit=6",
        undefined,
        auth.authHeaders,
      ),
  });
  const supportOpenCount = useMemo(() => {
    return (supportQuery.data?.items ?? []).filter(
      (item) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(item.status),
    ).length;
  }, [supportQuery.data?.items]);

  const operationSeries = useMemo(
    () =>
      buildOperationSeries({
        orders: salesQuery.data?.recentOrders ?? [],
        b2bCount: dashboardQuery.data?.b2bEnquiries ?? 0,
        sellerCount: dashboardQuery.data?.pendingSellers ?? 0,
      }),
    [
      dashboardQuery.data?.b2bEnquiries,
      dashboardQuery.data?.pendingSellers,
      salesQuery.data?.recentOrders,
    ],
  );
  const gmvPath = useMemo(
    () => sparklinePath(operationSeries.map((point) => point.ordersValue)),
    [operationSeries],
  );
  const ordersPath = useMemo(
    () => sparklinePath(operationSeries.map((point) => point.orders)),
    [operationSeries],
  );

  return (
    <div className="grid gap-4">
      <DashboardHero
        isRefreshing={dashboardQuery.isFetching || salesQuery.isFetching || supportQuery.isFetching}
        onRefresh={() => {
          void dashboardQuery.refetch();
          void salesQuery.refetch();
          void supportQuery.refetch();
        }}
      />

      {dashboardQuery.error ? (
        <AdminStatusNotice
          tone="danger"
          title="Dashboard API blocked"
          message={
            dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "Unable to load admin dashboard."
          }
          status={
            dashboardQuery.error instanceof IndihubApiError
              ? dashboardQuery.error.status
              : undefined
          }
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => {
          const value = dashboardQuery.data?.[card.key] ?? 0;
          return (
            <KpiCard
              key={card.key}
              label={card.label}
              href={card.href}
              icon={card.icon}
              tone={card.tone}
              note={card.note}
              value={dashboardQuery.isLoading ? null : value}
            />
          );
        })}
        <KpiCard
          label="GMV this month"
          href="/admin/reports"
          icon={IndianRupee}
          tone="purple"
          note={`${salesQuery.data?.summary.orderCount ?? 0} reportable orders`}
          value={
            salesQuery.isLoading
              ? null
              : formatCompactMoney(salesQuery.data?.summary.totalPaise ?? 0)
          }
        />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
        <OperationsOverview series={operationSeries} />
        <QuickActions />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
        <RecentOrders
          orders={salesQuery.data?.recentOrders ?? []}
          isLoading={salesQuery.isLoading}
        />
        <PlatformHealth
          apiOk={!dashboardQuery.error}
          databaseOk={Boolean(dashboardQuery.data)}
          supportOpenCount={supportOpenCount}
        />
      </div>

      <SalesAnalytics
        totalPaise={salesQuery.data?.summary.totalPaise ?? 0}
        orderCount={salesQuery.data?.summary.orderCount ?? 0}
        gmvPath={gmvPath}
        ordersPath={ordersPath}
      />
    </div>
  );
}

function DashboardHero({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <AdminPanel className="border-[#E5E7EB] bg-white p-3 md:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">
            Admin operations
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-[#102A43]">
            Welcome back, Admin
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            Here is what needs attention across sellers, products, orders, finance, and support.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto xl:min-w-[520px]">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]"
              aria-hidden="true"
            />
            <input
              disabled
              value=""
              placeholder="Search sellers, orders, products, reports..."
              className="h-10 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#667085]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-10"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>
    </AdminPanel>
  );
}

function KpiCard({
  label,
  href,
  icon: Icon,
  tone,
  note,
  value,
}: {
  label: string;
  href: string;
  icon: typeof UsersRound;
  tone: "info" | "success" | "warning" | "purple";
  note: string;
  value: string | number | null;
}) {
  return (
    <Link href={href} className="group block">
      <AdminPanel className="h-full p-3 transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-md">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-md",
              kpiToneClasses(tone),
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{label}</p>
            <p className="mt-1 text-2xl font-black leading-none text-[#102A43]">
              {formatKpiValue(value)}
            </p>
            <p className="mt-2 text-xs font-bold text-[#0F9F6E]">{note}</p>
          </div>
        </div>
      </AdminPanel>
    </Link>
  );
}

function OperationsOverview({ series }: { series: OperationPoint[] }) {
  const ordersPath = sparklinePath(series.map((point) => point.orders));
  const b2bPath = sparklinePath(series.map((point) => point.b2b));
  const sellersPath = sparklinePath(series.map((point) => point.sellers));

  return (
    <AdminPanel className="p-4">
      <PanelHeader title="Operations overview" actionLabel="This week" />
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-[#667085]">
        <Legend color="#ED3500" label="Orders" />
        <Legend color="#2F7EF7" label="B2B enquiries" />
        <Legend color="#20B486" label="New sellers" />
      </div>
      <div className="mt-3 h-52 rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-3">
        <svg
          viewBox="0 0 640 220"
          className="h-full w-full"
          role="img"
          aria-label="Operations overview chart"
        >
          {[0, 1, 2, 3, 4].map((line) => (
            <line
              key={line}
              x1="24"
              x2="620"
              y1={30 + line * 40}
              y2={30 + line * 40}
              stroke="#E5E7EB"
              strokeDasharray="4 4"
            />
          ))}
          <path d={ordersPath.area} fill="#ED3500" opacity="0.11" />
          <path
            d={ordersPath.line}
            fill="none"
            stroke="#ED3500"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={b2bPath.line}
            fill="none"
            stroke="#2F7EF7"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={sellersPath.line}
            fill="none"
            stroke="#20B486"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {series.map((point, index) => (
            <text
              key={point.label}
              x={40 + index * 92}
              y="214"
              fill="#667085"
              fontSize="12"
              fontWeight="700"
            >
              {point.label}
            </text>
          ))}
        </svg>
      </div>
    </AdminPanel>
  );
}

function QuickActions() {
  return (
    <AdminPanel className="p-4">
      <PanelHeader title="Quick actions" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
        {quickActions.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "grid min-h-20 place-items-center rounded-md border p-3 text-center transition hover:-translate-y-0.5 hover:border-[#ED3500] hover:shadow-sm",
                quickActionClasses(item.tone),
              )}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
              <span className="mt-2 text-xs font-black text-[#102A43]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </AdminPanel>
  );
}

function RecentOrders({
  orders,
  isLoading,
}: {
  orders: SalesReport["recentOrders"];
  isLoading: boolean;
}) {
  return (
    <AdminPanel className="p-4">
      <PanelHeader title="Recent orders" href="/admin/orders" actionLabel="View all orders" />
      <div className="mt-3 overflow-hidden rounded-md border border-[#E5E7EB]">
        <div className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr] gap-3 bg-[#F8FAFC] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#667085]">
          <span>Order ID</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {orders.slice(0, 5).map((order) => (
          <Link
            key={order.id}
            href={`/admin/orders/${order.orderNumber}`}
            className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr] gap-3 border-t border-[#E5E7EB] px-3 py-2 text-sm transition hover:bg-[#FFFCFB]"
          >
            <span className="min-w-0 truncate font-bold text-[#344054]">{order.orderNumber}</span>
            <span className="min-w-0 truncate font-semibold text-[#667085]">
              {order.customer?.user?.fullName || order.customer?.user?.email || "Customer"}
            </span>
            <span className="font-black text-[#102A43]">
              {formatMoney(order.totalPaise, order.currency)}
            </span>
            <span>
              <StatusBadge tone={statusTone(order.orderStatus)}>
                {humanize(order.orderStatus)}
              </StatusBadge>
            </span>
          </Link>
        ))}
        {isLoading ? (
          <div className="border-t border-[#E5E7EB] px-3 py-4 text-sm font-semibold text-[#667085]">
            Loading recent orders...
          </div>
        ) : null}
        {!isLoading && orders.length === 0 ? (
          <div className="border-t border-[#E5E7EB] px-3 py-4 text-sm font-semibold text-[#667085]">
            No recent orders yet.
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}

function PlatformHealth({
  apiOk,
  databaseOk,
  supportOpenCount,
}: {
  apiOk: boolean;
  databaseOk: boolean;
  supportOpenCount: number;
}) {
  const rows = [
    {
      label: "API status",
      value: apiOk ? "Operational" : "Needs check",
      note: "Admin API",
      icon: ShieldCheck,
      tone: apiOk ? "success" : "danger",
    },
    {
      label: "Database",
      value: databaseOk ? "Healthy" : "Waiting",
      note: "Dashboard query",
      icon: Database,
      tone: databaseOk ? "success" : "warning",
    },
    {
      label: "Support load",
      value: `${supportOpenCount}`,
      note: "Open requests",
      icon: Bell,
      tone: supportOpenCount > 0 ? "warning" : "success",
    },
  ] as const;

  return (
    <AdminPanel className="p-4">
      <PanelHeader title="Platform health" href="/admin/storage" actionLabel="View details" />
      <div className="mt-3 overflow-hidden rounded-md border border-[#E5E7EB]">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-3 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#F0F7FF] text-[#2F7EF7]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#102A43]">{row.label}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{row.note}</p>
                </div>
              </div>
              <div className="text-right">
                <StatusBadge tone={row.tone as StatusTone}>{row.value}</StatusBadge>
              </div>
            </div>
          );
        })}
      </div>
    </AdminPanel>
  );
}

function SalesAnalytics({
  totalPaise,
  orderCount,
  gmvPath,
  ordersPath,
}: {
  totalPaise: number;
  orderCount: number;
  gmvPath: SparklinePath;
  ordersPath: SparklinePath;
}) {
  return (
    <AdminPanel className="p-4">
      <PanelHeader title="Sales analytics" href="/admin/reports" actionLabel="This month" />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SparklineCard
          title="Gross merchandise value"
          value={formatMoney(totalPaise)}
          path={gmvPath.line}
          color="#20B486"
        />
        <SparklineCard
          title="Total orders"
          value={orderCount.toLocaleString("en-IN")}
          path={ordersPath.line}
          color="#2F7EF7"
        />
      </div>
    </AdminPanel>
  );
}

function SparklineCard({
  title,
  value,
  path,
  color,
}: {
  title: string;
  value: string;
  path: string;
  color: string;
}) {
  return (
    <div className="rounded-md border border-[#E5E7EB] bg-[#FFFCFB] p-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{title}</p>
      <p className="mt-2 text-xl font-black text-[#102A43]">{value}</p>
      <svg viewBox="0 0 260 80" className="mt-2 h-16 w-full" role="img" aria-label={title}>
        <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PanelHeader({
  title,
  href,
  actionLabel,
}: {
  title: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-black text-[#102A43]">{title}</h3>
      {href && actionLabel ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href}>
            {actionLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : actionLabel ? (
        <span className="rounded-md border border-[#D8E2EA] bg-white px-3 py-2 text-xs font-black text-[#344054]">
          {actionLabel}
        </span>
      ) : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

type OperationPoint = {
  label: string;
  orders: number;
  b2b: number;
  sellers: number;
  ordersValue: number;
};

type SparklinePath = {
  line: string;
  area: string;
};

function buildOperationSeries({
  orders,
  b2bCount,
  sellerCount,
}: {
  orders: SalesReport["recentOrders"];
  b2bCount: number;
  sellerCount: number;
}): OperationPoint[] {
  const days = lastSevenDays();
  const orderMap = new Map(days.map((day) => [day.key, { count: 0, value: 0 }]));

  for (const order of orders) {
    const key = dateKey(order.createdAt);
    const bucket = orderMap.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.value += order.totalPaise;
    }
  }

  return days.map((day, index) => {
    const bucket = orderMap.get(day.key) ?? { count: 0, value: 0 };
    const spreadB2B = Math.max(0, Math.round((b2bCount / 7) * (0.65 + index / 10)));
    const spreadSellers = Math.max(0, Math.round((sellerCount / 7) * (0.7 + (index % 3) / 8)));
    return {
      label: day.label,
      orders: bucket.count,
      ordersValue: bucket.value,
      b2b: spreadB2B,
      sellers: spreadSellers,
    };
  });
}

function sparklinePath(values: number[]): SparklinePath {
  const width = 620;
  const height = 170;
  const left = 24;
  const top = 20;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = left + (index / Math.max(values.length - 1, 1)) * (width - left);
    const y = top + height - (value / max) * height;
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${width.toFixed(1)} ${(top + height).toFixed(1)} L ${left.toFixed(1)} ${(top + height).toFixed(1)} Z`;
  return { line, area };
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    return {
      key: dateKey(date.toISOString()),
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(date),
    };
  });
}

function dateKey(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

function monthDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const params = new URLSearchParams();
  params.set("dateFrom", start.toISOString());
  params.set("dateTo", now.toISOString());
  return params.toString();
}

function kpiToneClasses(tone: "info" | "success" | "warning" | "purple") {
  if (tone === "success") {
    return "bg-[#DDF8EC] text-[#0F9F6E]";
  }
  if (tone === "warning") {
    return "bg-[#FFF0EC] text-[#ED3500]";
  }
  if (tone === "purple") {
    return "bg-[#F0E7FF] text-[#7C3AED]";
  }
  return "bg-[#EEF4FF] text-[#2F7EF7]";
}

function quickActionClasses(tone: "blue" | "orange" | "green") {
  if (tone === "orange") {
    return "border-[#FFE1D8] bg-[#FFFCFB] text-[#ED3500]";
  }
  if (tone === "green") {
    return "border-[#CFEFE2] bg-[#F4FBF8] text-[#0F9F6E]";
  }
  return "border-[#D8E7FF] bg-[#F8FAFF] text-[#2F7EF7]";
}

function statusTone(status: string): StatusTone {
  if (
    ["ACTIVE", "APPROVED", "DELIVERED", "PAID", "RESOLVED", "CLOSED", "CONFIRMED"].includes(status)
  ) {
    return "success";
  }

  if (["PENDING", "IN_REVIEW", "OPEN", "SUBMITTED", "PROCESSING", "PLACED"].includes(status)) {
    return "warning";
  }

  if (["REJECTED", "CANCELLED", "FAILED", "SUSPENDED"].includes(status)) {
    return "danger";
  }

  return "info";
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMoney(value?: number | null, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format((value ?? 0) / 100);
}

function formatCompactMoney(value?: number | null) {
  const amount = (value ?? 0) / 100;
  if (amount >= 10000000) {
    return `INR ${(amount / 10000000).toFixed(2)}Cr`;
  }
  if (amount >= 100000) {
    return `INR ${(amount / 100000).toFixed(2)}L`;
  }
  if (amount >= 1000) {
    return `INR ${(amount / 1000).toFixed(1)}K`;
  }
  return `INR ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatKpiValue(value: string | number | null) {
  if (value === null) {
    return "...";
  }

  return typeof value === "number" ? value.toLocaleString("en-IN") : value;
}
