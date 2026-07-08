"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect } from "react";
import { ArrowRight, PackageCheck, Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button, SectionHeading } from "@indihub/ui";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { formatMoney } from "@/lib/storefront-api";
import { listSellerOrders, primarySellerImage } from "@/lib/seller-api";
import { resolveImageSource } from "@/lib/image-url";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSkeleton,
  SellerStatusPill,
  formatDateTime,
  isSellerOnboardingRequiredError,
  useSellerAuth
} from "./seller-ui";

const orderStatuses = ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const deliveryStatuses = ["NOT_ASSIGNED", "PENDING", "PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];
const paymentMethods = ["RAZORPAY", "COD", "BANK_TRANSFER", "MANUAL"];

function CheckboxGroup({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (val: string[]) => void }) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((x) => x !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold text-[#1F2933]">{label}</p>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 rounded border-[#D8E2EA] text-[#ED3500] focus:ring-[#ED3500]"
            />
            <span className="text-sm font-medium text-[#475467]">{opt.replace(/_/g, " ")}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function SellerOrdersClient() {
  const sellerAuth = useSellerAuth();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState<string[]>([]);
  const [deliveryStatus, setDeliveryStatus] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string[]>([]);

  const debouncedOrderStatus = useDebounce(orderStatus, 500);
  const debouncedDeliveryStatus = useDebounce(deliveryStatus, 500);
  const debouncedPaymentMethod = useDebounce(paymentMethod, 500);

  const ordersQuery = useQuery({
    queryKey: ["seller-orders", sellerAuth.authKey, submittedSearch, debouncedOrderStatus, debouncedDeliveryStatus, debouncedPaymentMethod],
    queryFn: () =>
      listSellerOrders(sellerAuth.authHeaders, {
        search: submittedSearch,
        orderStatus: debouncedOrderStatus,
        deliveryStatus: debouncedDeliveryStatus,
        paymentMethod: debouncedPaymentMethod,
        limit: 30
      }),
    enabled: sellerAuth.enabled,
    retry: false
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (ordersQuery.error && isSellerOnboardingRequiredError(ordersQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before reviewing seller orders." />;
  }

  const orders = ordersQuery.data?.items ?? [];
  const activeFiltersCount = orderStatus.length + deliveryStatus.length + paymentMethod.length;

  return (
    <SellerPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading title="Order queue" description="Orders containing this store's products with payment, delivery, and fulfilment state." />
        <div className="flex w-full gap-2 lg:max-w-md">
          <form onSubmit={submit} className="relative flex-1">
            <span className="sr-only">Search order number</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order number"
              className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
            />
            <button type="submit" className="hidden" aria-hidden="true" />
          </form>

          <Popover className="relative">
            <PopoverButton as={Button} variant="outline" className="gap-2 relative">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ED3500] text-[10px] font-bold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </PopoverButton>
            <PopoverPanel className="absolute right-0 top-full z-10 mt-2 w-72 origin-top-right rounded-md border border-[#E5E7EB] bg-white p-4 shadow-lg ring-1 ring-black/5 focus:outline-none max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col gap-6">
                <CheckboxGroup label="Order Status" options={orderStatuses} selected={orderStatus} onChange={setOrderStatus} />
                <CheckboxGroup label="Delivery Status" options={deliveryStatuses} selected={deliveryStatus} onChange={setDeliveryStatus} />
                <CheckboxGroup label="Payment Method" options={paymentMethods} selected={paymentMethod} onChange={setPaymentMethod} />
                {(activeFiltersCount > 0) && (
                  <Button variant="ghost" size="sm" onClick={() => { setOrderStatus([]); setDeliveryStatus([]); setPaymentMethod([]); }} className="w-full text-[#ED3500] hover:text-[#C52A00]">
                    Clear Filters
                  </Button>
                )}
              </div>
            </PopoverPanel>
          </Popover>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {ordersQuery.isLoading ? <SellerSkeleton /> : null}
        {ordersQuery.error ? <SellerErrorPanel error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} /> : null}
        {!ordersQuery.isLoading && orders.length === 0 ? (
          <SellerEmptyState title="No orders found" message="Orders appear here after checkout includes this store's approved products." />
        ) : null}

        {orders.map((order) => {
          const sellerSplit = order.sellerSplits?.[0];
          const sellerSubtotal = sellerSplit?.sellerSubtotalPaise ?? 0;
          
          const firstItem = order.items[0];
          const primaryImageSrc = firstItem ? primarySellerImage(firstItem.product?.images) : null;
          const resolvedSrc = resolveImageSource(primaryImageSrc);

          const hasCodPayment = order.payments?.some(p => p.method === "COD");

          return (
            <div
              key={order.id}
              className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#ED3500] lg:grid-cols-[1fr_auto] lg:items-center"
            >
              <div className="flex items-start gap-4">
                {resolvedSrc ? (
                  <img src={resolvedSrc} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover ring-1 ring-black/5" />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                    <PackageCheck className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}
                <div className="flex flex-col justify-center h-full gap-1">
                  <p className="text-lg font-black text-[#1F2933]">{order.orderNumber}</p>
                  {firstItem && (
                    <p className="text-sm font-semibold text-[#1F2933]">
                      {firstItem.productNameSnapshot} <span className="text-[#667085]">x {firstItem.quantity}</span>
                      {order.items.length > 1 && <span className="text-[#667085] ml-1">and {order.items.length - 1} more item{order.items.length - 1 === 1 ? "" : "s"}</span>}
                    </p>
                  )}
                  <p className="text-[13px] font-semibold text-[#667085]">
                    {formatDateTime(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <StatusPair label="Order" status={order.orderStatus} />
                  <StatusPair label="Seller" status={sellerSplit?.sellerStatus} />
                  <StatusPair label="Delivery" status={order.deliveryStatus} />
                  {hasCodPayment ? (
                    <StatusPair label="Payment" status={order.paymentStatus} labelOverride="COD" />
                  ) : (
                    <StatusPair label="Payment" status={order.paymentStatus} />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <span className="font-black text-[#163B5C]">{formatMoney(sellerSubtotal || order.totalPaise, order.currency)}</span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/seller/orders/${order.orderNumber}`}>
                      Review / update
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SellerPanel>
  );
}

function StatusPair({ label, status, labelOverride }: { label: string; status?: string | null | undefined; labelOverride?: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-black tracking-wide text-[#667085] ring-1 ring-[#E5E7EB]">
      <span className="uppercase">{labelOverride || label}</span>
      <SellerStatusPill status={status} />
    </span>
  );
}
