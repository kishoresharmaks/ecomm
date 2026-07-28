"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, PackageSearch } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { IndihubApiError } from "@/lib/api";
import { createBusinessBuyerEnquiry, getBusinessBuyerProfile } from "@/lib/business-buyer-api";
import { listProducts, listStores } from "@/lib/storefront-api";
import { B2BAuthNotice, useB2BAuth } from "./b2b-auth";
import { B2BShell } from "./b2b-shell";
import {
  B2BEmptyState,
  B2BErrorPanel,
  B2BField,
  B2BPanel,
  B2BSkeleton,
  B2BTextArea,
  formValue,
  formatMoney,
  optionalFormValue
} from "./b2b-ui";

export function B2BEnquiryFormClient() {
  const auth = useB2BAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productFromUrl = searchParams.get("productId") ?? "";
  const sellerFromUrl = searchParams.get("sellerId") ?? "";
  const [notice, setNotice] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false
  });
  const profileMissing = profileQuery.error instanceof IndihubApiError && profileQuery.error.status === 404;
  const productsQuery = useQuery({
    queryKey: ["b2b-products"],
    queryFn: () => listProducts({ limit: 100 })
  });
  const storesQuery = useQuery({
    queryKey: ["b2b-stores"],
    queryFn: () => listStores()
  });

  const products = productsQuery.data?.items ?? [];
  const stores = storesQuery.data ?? [];
  const selectedProduct = useMemo(() => products.find((product) => product.id === productFromUrl), [productFromUrl, products]);

  const createMutation = useMutation({
    mutationFn: (payload: { productId?: string; sellerId?: string; quantity: number; message: string; transportMode?: "STORE_PICKUP" | "SELLER_ARRANGED_TRANSPORT"; transportNote?: string }) =>
      createBusinessBuyerEnquiry(auth.authHeaders, payload),
    onSuccess: (enquiry) => {
      setNotice("Enquiry submitted.");
      router.push(`/b2b/enquiries/${enquiry.id}`);
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Enquiry submission failed.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = optionalFormValue(form, "productId");
    const sellerId = productId ? undefined : optionalFormValue(form, "sellerId");
    const transportNote = optionalFormValue(form, "transportNote");
    const payload = {
      ...(productId ? { productId } : {}),
      ...(sellerId ? { sellerId } : {}),
      quantity: Number(formValue(form, "quantity")),
      message: formValue(form, "message"),
      transportMode: formValue(form, "transportMode") as "STORE_PICKUP" | "SELLER_ARRANGED_TRANSPORT",
      ...(transportNote ? { transportNote } : {})
    };

    setNotice(null);
    createMutation.mutate(payload);
  }

  return (
    <B2BShell title="Submit product enquiry" description="Request a bulk quotation from an approved product or seller.">
      <B2BAuthNotice />

      {profileQuery.isLoading ? <B2BSkeleton /> : null}
      {profileMissing ? (
        <B2BEmptyState
          title="Business profile required"
          message="Register company details before submitting a bulk enquiry."
          action={
            <Button asChild>
              <Link href="/b2b/register">
                Register business <ArrowRight size={16} />
              </Link>
            </Button>
          }
        />
      ) : null}
      {profileQuery.error && !profileMissing ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}

      {profileQuery.data ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <B2BPanel>
            <SectionHeading
              title="Bulk request details"
              description="Select a product when the request is product-specific. Use seller-only only for general procurement discussions."
            />
            <form onSubmit={submit} className="mt-6 grid gap-4">
              <label className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Product</span>
                <select
                  name="productId"
                  defaultValue={productFromUrl}
                  className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                >
                  <option value="">General enquiry, no product selected</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} / {product.seller.storeName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wide text-[#667085]">Seller for general enquiry</span>
                <select
                  name="sellerId"
                  defaultValue={sellerFromUrl}
                  className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#1F2933] outline-none transition focus:border-[#ED3500] focus:bg-white"
                >
                  <option value="">No seller selected</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.storeName}
                    </option>
                  ))}
                </select>
              </label>

              <B2BField label="Required quantity" name="quantity" type="number" min={1} required defaultValue={50} />
              <B2BTextArea
                label="Requirement message"
                name="message"
                required
                minLength={10}
                placeholder="Mention product requirements, delivery location, timeline, recurring purchase needs, and quotation expectations."
              />

              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <SectionHeading
                  title="B2B transport preference"
                  description="Choose pickup if your company will collect from seller. Choose seller-arranged transport when courier or goods transport charge should be added to the quotation."
                />
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="rounded-md border border-[#D8E2EA] bg-white p-4">
                    <input
                      type="radio"
                      name="transportMode"
                      value="SELLER_ARRANGED_TRANSPORT"
                      defaultChecked
                      className="mr-2 accent-[#ED3500]"
                    />
                    <span className="text-sm font-black text-[#1F2933]">Seller-arranged transport</span>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#667085]">
                      Seller shares courier/transport charge in quotation and later updates tracking manually.
                    </p>
                  </label>
                  <label className="rounded-md border border-[#D8E2EA] bg-white p-4">
                    <input type="radio" name="transportMode" value="STORE_PICKUP" className="mr-2 accent-[#ED3500]" />
                    <span className="text-sm font-black text-[#1F2933]">Store pickup</span>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#667085]">
                      Buyer arranges pickup. No B2B transport charge is added by seller.
                    </p>
                  </label>
                </div>
                <div className="mt-4">
                  <B2BTextArea
                    label="Transport note"
                    name="transportNote"
                    rows={3}
                    placeholder="Delivery city, warehouse timing, preferred courier, pickup contact, or unloading instructions."
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Submitting..." : "Submit enquiry"}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/b2b/enquiries">View enquiries</Link>
                </Button>
                {notice ? <StatusBadge tone={createMutation.isError ? "danger" : "success"}>{notice}</StatusBadge> : null}
              </div>
            </form>
          </B2BPanel>

          <aside className="grid h-fit gap-4">
            <B2BPanel>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#1F2933]">{profileQuery.data.companyName}</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#667085]">
                    {profileQuery.data.contactName} / {profileQuery.data.contactPhone}
                  </p>
                </div>
              </div>
            </B2BPanel>

            <B2BPanel>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                  <PackageSearch className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#1F2933]">Selected product</h2>
                  {selectedProduct ? (
                    <div className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                      <p className="font-black text-[#1F2933]">{selectedProduct.name}</p>
                      <p>{selectedProduct.seller.storeName}</p>
                      <p>{formatMoney(selectedProduct.variants[0]?.pricePaise ?? null)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                      Product selection is optional for general seller procurement enquiries.
                    </p>
                  )}
                </div>
              </div>
            </B2BPanel>
          </aside>
        </div>
      ) : null}
    </B2BShell>
  );
}
