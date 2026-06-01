"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Edit3, ImagePlus, PackagePlus, Plus, Search, Star, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge, cn } from "@indihub/ui";
import {
  marketplaceProductAdminSummaryFields,
  marketplaceProductEssentialFields,
  type MarketplaceProductEssentialField,
} from "@indihub/shared-types";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { StorefrontImage } from "@/components/storefront/storefront-image";
import { listCategories, searchHsnMaster } from "@/lib/storefront-api";
import { formatMoney } from "@/lib/storefront-api";
import {
  archiveSellerProduct,
  createSellerProduct,
  flattenCategories,
  getSellerProduct,
  getSellerProfile,
  listSellerProducts,
  primarySellerImage,
  updateSellerProduct,
  type SellerProductPayload
} from "@/lib/seller-api";
import type { IndihubAuthHeaders } from "@/lib/api";
import { uploadPublicImage } from "@/lib/public-image-upload";
import type { CategorySummary, HsnMasterEntry, ProductImage, ProductSummary, ProductTemplateField, ProductTemplateSummary, ProductVariant } from "@/lib/storefront-api";
import {
  SellerAuthNotice,
  SellerEmptyState,
  SellerErrorPanel,
  SellerField,
  SellerOnboardingRequired,
  SellerPanel,
  SellerSelect,
  SellerSkeleton,
  SellerStatusPill,
  SellerTextArea,
  formValue,
  isSellerOnboardingRequiredError,
  optionalFormValue,
  paiseToRupees,
  rupeesToPaise,
  useSellerAuth
} from "./seller-ui";

const productStatusOptions = ["", "DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"];
const approvalStatusOptions = ["", "PENDING_APPROVAL", "APPROVED", "REJECTED"];
const maxProductImages = 10;
const marketplaceEssentialFieldKeys = new Set<string>(marketplaceProductEssentialFields.map((field) => field.key));

type DraftProductImage = {
  id: string;
  url: string;
  altText?: string;
  isPrimary?: boolean;
};

type DraftVariantRow = {
  rowId: string;
  variant?: ProductVariant;
};

type TaxDraft = {
  hsnCode: string;
  gstRatePercent: string;
};

let draftVariantSequence = 0;

export function SellerProductsClient({
  mode = "list",
  productId,
}: {
  mode?: "list" | "form";
  productId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const isFormMode = mode === "form";
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [draftImages, setDraftImages] = useState<DraftProductImage[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [draftVariants, setDraftVariants] = useState<DraftVariantRow[]>([emptyDraftVariant()]);
  const [taxDraft, setTaxDraft] = useState<TaxDraft>({ hsnCode: "", gstRatePercent: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const categoriesQuery = useQuery({
    queryKey: ["seller-categories"],
    queryFn: listCategories,
    enabled: sellerAuth.enabled && isFormMode,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000
  });
  const categories = useMemo(() => flattenCategories(categoriesQuery.data ?? []), [categoriesQuery.data]);

  const productsQuery = useQuery({
    queryKey: ["seller-products", sellerAuth.authKey, submittedSearch, status, approvalStatus],
    queryFn: () =>
      listSellerProducts(sellerAuth.authHeaders, {
        search: submittedSearch,
        status,
        approvalStatus,
        limit: 30
      }),
    enabled: sellerAuth.enabled && !isFormMode,
    retry: false
  });

  const productQuery = useQuery({
    queryKey: ["seller-product", sellerAuth.authKey, productId],
    queryFn: () => getSellerProduct(sellerAuth.authHeaders, productId ?? ""),
    enabled: sellerAuth.enabled && isFormMode && Boolean(productId),
    retry: false,
  });

  const profileQuery = useQuery({
    queryKey: ["seller-profile", sellerAuth.authKey],
    queryFn: () => getSellerProfile(sellerAuth.authHeaders),
    enabled: sellerAuth.enabled,
    retry: false
  });

  const saveMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId?: string | undefined; payload: SellerProductPayload }) =>
      productId ? updateSellerProduct(sellerAuth.authHeaders, productId, payload) : createSellerProduct(sellerAuth.authHeaders, payload),
    onSuccess: (_, variables) => {
      setNotice(variables.productId ? "Product updated and sent for approval." : "Product submitted for admin approval.");
      setDraftImages([]);
      setDraftVariants([emptyDraftVariant()]);
      setSelectedCategoryId(categories[0]?.id ?? "");
      void queryClient.invalidateQueries({ queryKey: ["seller-products", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-sales-report", sellerAuth.authKey] });
      if (isFormMode) {
        router.push("/seller/products");
      }
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Product save failed.")
  });

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => archiveSellerProduct(sellerAuth.authHeaders, productId),
    onSuccess: () => {
      setNotice("Product archived.");
      void queryClient.invalidateQueries({ queryKey: ["seller-products", sellerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["seller-sales-report", sellerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Product archive failed.")
  });

  useEffect(() => {
    const editingProduct = productQuery.data ?? null;
    setDraftImages(imagesToDraft(editingProduct?.images ?? []));
    setSelectedCategoryId(editingProduct?.categoryId ?? "");
    setDraftVariants(variantsToDraft(editingProduct?.variants ?? []));
  }, [productQuery.data]);

  useEffect(() => {
    if (!selectedCategoryId && categories[0]?.id) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    const category = categories.find((item) => item.id === selectedCategoryId) ?? null;
    const editingProduct = productQuery.data ?? null;
    const attributes = editingProduct?.attributes ?? {};
    setTaxDraft({
      hsnCode: attributeValueToInput(attributes.hsnCode ?? editingProduct?.hsnCode ?? category?.defaultHsnCode),
      gstRatePercent: attributeValueToInput(
        attributes.gstRatePercent ?? editingProduct?.gstRatePercent ?? category?.defaultGstRatePercent,
      ),
    });
  }, [categories, productQuery.data, selectedCategoryId]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(search.trim());
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const categoryId = formValue(form, "categoryId");
    const category = categories.find((item) => item.id === categoryId);
    const template = category?.productTemplate ?? null;
    const productName = formValue(form, "name");
    const images = draftImages.map((image, index) => ({
      url: image.url,
      altText: image.altText || productName,
      sortOrder: index,
      isPrimary: image.isPrimary || (!draftImages.some((item) => item.isPrimary) && index === 0)
    }));
    const variantFields = templateFields(template, "VARIANT");
    const variants = draftVariants.map((row) => {
      const prefix = variantFieldPrefix(row.rowId);
      const sku = optionalFormValue(form, `${prefix}:sku`);
      const variantAttributes = dynamicAttributesFromForm(form, variantFields, `${prefix}:attribute`);
      const variantName =
        optionalFormValue(form, `${prefix}:variantName`) ??
        variantNameFromAttributes(variantAttributes) ??
        sku;
      const mrpPaise = rupeesToPaise(formValue(form, `${prefix}:mrp`));
      const packageWeightGrams = positiveIntegerFormValue(form, `${prefix}:packageWeightGrams`);
      const packageLengthCm = positiveIntegerFormValue(form, `${prefix}:packageLengthCm`);
      const packageBreadthCm = positiveIntegerFormValue(form, `${prefix}:packageBreadthCm`);
      const packageHeightCm = positiveIntegerFormValue(form, `${prefix}:packageHeightCm`);
      return {
        ...(row.variant?.id ? { id: row.variant.id } : {}),
        ...(sku && sku !== row.variant?.sku ? { sku } : {}),
        ...(variantName ? { variantName } : {}),
        pricePaise: rupeesToPaise(formValue(form, `${prefix}:price`)),
        ...(mrpPaise > 0 ? { mrpPaise } : {}),
        stockQuantity: Number(formValue(form, `${prefix}:stock`) || 0),
        ...(packageWeightGrams ? { packageWeightGrams } : {}),
        ...(packageLengthCm ? { packageLengthCm } : {}),
        ...(packageBreadthCm ? { packageBreadthCm } : {}),
        ...(packageHeightCm ? { packageHeightCm } : {}),
        status: formValue(form, `${prefix}:status`) === "INACTIVE" ? "INACTIVE" as const : "ACTIVE" as const,
        attributes: variantAttributes
      };
    });
    const payload: SellerProductPayload = {
      categoryId,
      name: productName,
      description: formValue(form, "description"),
      attributes: {
        ...marketplaceEssentialsFromForm(form),
        ...dynamicAttributesFromForm(form, templateFields(template, "PRODUCT"), "productAttribute"),
      },
      images,
      variants
    };

    setNotice(null);
    saveMutation.mutate({ productId: productQuery.data?.id, payload });
  }

  if (!sellerAuth.enabled) {
    return <SellerAuthNotice />;
  }

  if (profileQuery.error && isSellerOnboardingRequiredError(profileQuery.error)) {
    return <SellerOnboardingRequired message="Complete seller onboarding before creating or managing catalogue items." />;
  }

  const products = productsQuery.data?.items ?? [];
  const sellerReady = profileQuery.data?.status === "APPROVED" && profileQuery.data?.approvalStatus === "APPROVED";
  const editingProduct = productQuery.data ?? null;
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0] ?? null;
  const selectedTemplate = selectedCategory?.productTemplate ?? null;
  const productFields = templateFields(selectedTemplate, "PRODUCT").filter((field) => !marketplaceEssentialFieldKeys.has(field.fieldKey));
  const variantFields = templateFields(selectedTemplate, "VARIANT");
  const selectedListingMode = selectedTemplate?.listingMode ?? "CART";

  if (isFormMode) {
    return (
      <div className="grid gap-5">
        {confirmation.confirmationDialog}
        {productId && productQuery.isLoading ? <SellerSkeleton className="h-96" /> : null}
        {productQuery.error ? <SellerErrorPanel error={productQuery.error} onRetry={() => void productQuery.refetch()} /> : null}
        {!productId || editingProduct || !productQuery.isLoading ? (
          <SellerPanel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0EC] text-[#ED3500]">
                  <PackagePlus className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading
                  title={editingProduct ? "Edit product" : "Add product"}
                  description={editingProduct ? "Update the product and send it back for admin approval." : "Fill the required catalogue, tax, image, price, and stock details."}
                />
              </div>
              <Button asChild variant="outline">
                <Link href="/seller/products">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Products
                </Link>
              </Button>
            </div>

            {notice ? (
              <div className="mt-4">
                <StatusBadge tone={saveMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
              </div>
            ) : null}
            {!profileQuery.isLoading && !sellerReady ? (
              <div className="mt-4 rounded-lg border border-[#FFC7B8] bg-[#FFF0EC] p-4 text-sm font-semibold text-[#9F2600]">
                Product submission unlocks after seller approval. You can prepare profile details now and return here after admin approval.
              </div>
            ) : null}

            <form key={editingProduct?.id ?? "new"} onSubmit={submitProduct} onKeyDown={preventAccidentalProductSubmit} className="mt-5 grid gap-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
                <div className="grid gap-4">
                  <div className="grid gap-4 rounded-lg border border-[#D9E2EA] bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <SellerSelect label="Category" name="categoryId" required value={selectedCategoryId} onChange={setSelectedCategoryId}>
                        <option value="">Select category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.parentId ? " - " : ""}
                            {category.name}
                          </option>
                        ))}
                      </SellerSelect>
                      <SellerField label="Product name" name="name" required defaultValue={editingProduct?.name} placeholder="Premium Ponni Rice" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={selectedListingMode === "ENQUIRY_ONLY" ? "warning" : selectedListingMode === "CART_AND_ENQUIRY" ? "info" : "success"}>
                        {humanizeAttributeLabel(selectedListingMode)}
                      </StatusBadge>
                      <span className="text-xs font-bold text-[#667085]">{selectedTemplate?.name ?? "Standard"} template</span>
                    </div>
                    <SellerTextArea label="Description" name="description" required defaultValue={editingProduct?.description} rows={4} placeholder="Product details, packaging, usage, and included items." />
                  </div>

                  <ProductGalleryUploader authHeaders={sellerAuth.authHeaders} images={draftImages} onChange={setDraftImages} disabled={saveMutation.isPending || !sellerReady} />
                </div>

                <div className="grid content-start gap-4 rounded-lg border border-[#D9E2EA] bg-[#F8FAFC] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#1F2933]">Price, stock, variant</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">Use one row for a simple product. Add more only for size, color, pack, or model changes.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDraftVariants((current) => [...current, emptyDraftVariant()])}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add
                    </Button>
                  </div>
                  {draftVariants.map((row, index) => (
                    <VariantEditor
                      key={row.rowId}
                      row={row}
                      index={index}
                      fields={variantFields}
                      canRemove={draftVariants.length > 1}
                      onRemove={() => setDraftVariants((current) => current.filter((item) => item.rowId !== row.rowId))}
                    />
                  ))}
                  <Button type="submit" disabled={saveMutation.isPending || categories.length === 0 || !sellerReady}>
                    {saveMutation.isPending ? "Saving..." : editingProduct ? "Update product" : "Submit product"}
                  </Button>
                </div>
              </div>

              <MarketplaceProductEssentialsFields
                values={editingProduct?.attributes ?? null}
                category={selectedCategory}
                taxDraft={taxDraft}
                onTaxDraftChange={setTaxDraft}
              />
              <DynamicAttributeFields
                key={`product-${editingProduct?.id ?? "new"}-${selectedTemplate?.id ?? "standard"}`}
                fields={productFields}
                values={editingProduct?.attributes ?? null}
                namePrefix="productAttribute"
                title="Category details"
              />
            </form>
          </SellerPanel>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {confirmation.confirmationDialog}
      <SellerPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading title="Catalogue" description="Search products, inspect approval state, update stock, or archive items no longer sold." />
          <Button asChild>
            <Link href="/seller/products/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add product
            </Link>
          </Button>
        </div>

        {notice ? (
          <div className="mt-4">
            <StatusBadge tone={archiveMutation.isError ? "danger" : "success"}>{notice}</StatusBadge>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr_minmax(260px,420px)] xl:items-end">
          <SellerSelect label="Product status" name="statusFilter" value={status} onChange={setStatus}>
            {productStatusOptions.map((option) => (
              <option key={option || "all"} value={option}>
                {option ? option.replace(/_/g, " ") : "All product statuses"}
              </option>
            ))}
          </SellerSelect>
          <SellerSelect label="Approval status" name="approvalFilter" value={approvalStatus} onChange={setApprovalStatus}>
            {approvalStatusOptions.map((option) => (
              <option key={option || "all"} value={option}>
                {option ? option.replace(/_/g, " ") : "All approval statuses"}
              </option>
            ))}
          </SellerSelect>
          <form onSubmit={submitSearch} className="flex w-full gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
                className="h-11 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] pl-10 pr-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500] focus:bg-white"
              />
            </label>
            <Button type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </Button>
          </form>
        </div>

        <div className="mt-5 grid gap-3">
          {productsQuery.isLoading ? <SellerSkeleton /> : null}
          {productsQuery.error ? <SellerErrorPanel error={productsQuery.error} onRetry={() => void productsQuery.refetch()} /> : null}
          {!productsQuery.isLoading && products.length === 0 ? (
            <SellerEmptyState title="No products found" message="Use Add product to create a catalogue item. New and edited products are reviewed before storefront publishing." />
          ) : null}

          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              editHref={`/seller/products/${product.id}/edit` as Route}
              onArchive={() =>
                confirmation.requestConfirmation({
                  title: "Archive this product?",
                  description: `"${product.name}" will be removed from active seller catalogue views while preserving approval and audit history.`,
                  confirmLabel: "Archive product",
                  onConfirm: () => archiveMutation.mutate(product.id)
                })
              }
              archivePending={archiveMutation.isPending}
            />
          ))}
        </div>
      </SellerPanel>
    </div>
  );
}

function ProductRow({
  product,
  editHref,
  onArchive,
  archivePending
}: {
  product: ProductSummary;
  editHref: Route;
  onArchive: () => void;
  archivePending: boolean;
}) {
  const variant = product.variants[0];
  const chips = attributeChips(product.attributes, product.category.productTemplate?.fields ?? []);

  return (
    <div className="grid gap-4 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 lg:grid-cols-[80px_1fr_auto] lg:items-center">
      <div className="relative h-20 w-20 overflow-hidden rounded-md bg-[#EAF1F7]">
        <StorefrontImage src={primarySellerImage(product.images) || null} alt={product.name} sizes="80px" fallbackLabel="1HI" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-[#1F2933]">{product.name}</p>
        <p className="mt-1 text-sm font-semibold text-[#667085]">{product.category?.name ?? "No category"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <SellerStatusPill status={product.status} />
          <SellerStatusPill status={product.approvalStatus} />
          <StatusBadge tone={product.listingMode === "ENQUIRY_ONLY" ? "warning" : product.listingMode === "CART_AND_ENQUIRY" ? "info" : "success"}>
            {humanizeAttributeLabel(product.listingMode ?? "CART")}
          </StatusBadge>
          {variant ? <StatusBadge tone={variant.stockQuantity <= 5 ? "warning" : "info"}>{variant.stockQuantity} in stock</StatusBadge> : null}
          {variant ? <StatusBadge tone="neutral">{formatMoney(variant.pricePaise, variant.currency)}</StatusBadge> : null}
        </div>
        {chips.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {chips.slice(0, 4).map((chip) => (
              <span key={chip} className="rounded-full border border-[#D8E2EA] bg-white px-2.5 py-1 text-xs font-bold text-[#667085]">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={editHref}>
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onArchive} disabled={archivePending}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Archive
        </Button>
      </div>
    </div>
  );
}

function preventAccidentalProductSubmit(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") {
    return;
  }

  const target = event.target;

  if (target instanceof HTMLTextAreaElement) {
    return;
  }

  if (target instanceof HTMLButtonElement) {
    return;
  }

  if (target instanceof HTMLInputElement) {
    const submitFriendlyTypes = new Set(["button", "checkbox", "file", "radio", "submit"]);
    if (!submitFriendlyTypes.has(target.type)) {
      event.preventDefault();
    }
  }
}

function VariantEditor({
  row,
  index,
  fields,
  canRemove,
  onRemove
}: {
  row: DraftVariantRow;
  index: number;
  fields: ProductTemplateField[];
  canRemove: boolean;
  onRemove: () => void;
}) {
  const prefix = variantFieldPrefix(row.rowId);

  return (
    <div className="grid gap-4 rounded-lg border border-[#D9E2EA] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[#1F2933]">Variant {index + 1}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </Button>
      </div>
      <SellerField label="SKU" name={`${prefix}:sku`} defaultValue={row.variant?.sku} placeholder="1HI-RICE-5KG" />
      <SellerField label="Variant name" name={`${prefix}:variantName`} defaultValue={row.variant?.variantName} placeholder="5 KG Pack" />
      <SellerField label="Price" name={`${prefix}:price`} type="number" required min={0} step="0.01" defaultValue={paiseToRupees(row.variant?.pricePaise)} />
      <SellerField label="MRP" name={`${prefix}:mrp`} type="number" min={0} step="0.01" defaultValue={paiseToRupees(row.variant?.mrpPaise)} />
      <SellerField label="Stock" name={`${prefix}:stock`} type="number" min={0} defaultValue={row.variant?.stockQuantity ?? 0} />
      <div className="grid gap-3 sm:grid-cols-4">
        <SellerField
          label="Weight g"
          name={`${prefix}:packageWeightGrams`}
          type="number"
          min={1}
          defaultValue={row.variant?.packageWeightGrams ?? ""}
        />
        <SellerField
          label="Length cm"
          name={`${prefix}:packageLengthCm`}
          type="number"
          min={1}
          defaultValue={row.variant?.packageLengthCm ?? ""}
        />
        <SellerField
          label="Breadth cm"
          name={`${prefix}:packageBreadthCm`}
          type="number"
          min={1}
          defaultValue={row.variant?.packageBreadthCm ?? ""}
        />
        <SellerField
          label="Height cm"
          name={`${prefix}:packageHeightCm`}
          type="number"
          min={1}
          defaultValue={row.variant?.packageHeightCm ?? ""}
        />
      </div>
      <SellerSelect label="Variant status" name={`${prefix}:status`} defaultValue={row.variant?.status ?? "ACTIVE"}>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </SellerSelect>
      <DynamicAttributeFields
        fields={fields}
        values={row.variant?.attributes ?? null}
        namePrefix={`${prefix}:attribute`}
        title="Variant details"
      />
    </div>
  );
}

function MarketplaceProductEssentialsFields({
  values,
  category,
  taxDraft,
  onTaxDraftChange,
}: {
  values?: Record<string, unknown> | null;
  category?: CategorySummary | null;
  taxDraft: TaxDraft;
  onTaxDraftChange: (value: TaxDraft) => void;
}) {
  const groups: Array<{
    group: MarketplaceProductEssentialField["group"];
    title: string;
    description: string;
  }> = [
    {
      group: "ESSENTIALS",
      title: "Marketplace essentials",
      description: "Standard buyer-facing fields used across storefront cards, product approval, and search.",
    },
    {
      group: "COMPLIANCE",
      title: "Tax and compliance",
      description: "GST, HSN, origin, and manufacturer details for review and invoice readiness.",
    },
    {
      group: "FULFILMENT",
      title: "Delivery and after-sales",
      description: "Return, warranty, and package data needed for fulfilment decisions.",
    },
    {
      group: "DISCOVERY",
      title: "Discovery and SEO",
      description: "Optional highlights and search metadata that help customers understand the item faster.",
    },
  ];

  return (
    <div className="grid gap-4 rounded-lg border border-[#D9E2EA] bg-white p-4">
      {groups.map((group) => {
        const fields = marketplaceProductEssentialFields.filter((field) => field.group === group.group);
        const requiredFields = fields.filter((field) => field.required);
        const optionalFields = fields.filter((field) => !field.required);
        const visibleFields = requiredFields.length ? requiredFields : optionalFields.slice(0, 1);
        const collapsedFields = requiredFields.length ? optionalFields : optionalFields.slice(1);

        return (
          <div key={group.group} className="grid gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#1F2933]">{group.title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#667085]">{group.description}</p>
              </div>
              {requiredFields.length ? (
                <StatusBadge tone="info">{requiredFields.length} required</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Optional</StatusBadge>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleFields.map((field) => (
                <MarketplaceProductEssentialInput
                  key={field.key}
                  field={field}
                  defaultValue={marketplaceEssentialValueToInput(values?.[field.key])}
                  {...(field.key === "hsnCode"
                    ? {
                        value: taxDraft.hsnCode,
                        onValueChange: (hsnCode: string) => onTaxDraftChange({ ...taxDraft, hsnCode }),
                        category: category ?? null,
                        onHsnSuggestionSelect: (entry: HsnMasterEntry) =>
                          onTaxDraftChange({
                            hsnCode: entry.hsnCode,
                            gstRatePercent: String(entry.gstRatePercent),
                          }),
                      }
                    : {})}
                  {...(field.key === "gstRatePercent"
                    ? {
                        value: taxDraft.gstRatePercent,
                        onValueChange: (gstRatePercent: string) => onTaxDraftChange({ ...taxDraft, gstRatePercent }),
                      }
                    : {})}
                />
              ))}
            </div>
            {collapsedFields.length ? (
              <details className="rounded-md border border-[#E5E7EB] bg-[#F8FAFC]">
                <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-wide text-[#667085]">
                  Optional {group.title.toLowerCase()}
                </summary>
                <div className="grid gap-4 border-t border-[#E5E7EB] p-3 md:grid-cols-2">
                  {collapsedFields.map((field) => (
                    <MarketplaceProductEssentialInput
                      key={field.key}
                      field={field}
                      defaultValue={marketplaceEssentialValueToInput(values?.[field.key])}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function MarketplaceProductEssentialInput({
  field,
  defaultValue,
  value,
  onValueChange,
  category,
  onHsnSuggestionSelect,
}: {
  field: MarketplaceProductEssentialField;
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  category?: CategorySummary | null;
  onHsnSuggestionSelect?: (entry: HsnMasterEntry) => void;
}) {
  const name = marketplaceEssentialInputName(field.key);
  const help = field.helpText || field.placeholder;
  const inputValueProps =
    value === undefined
      ? { defaultValue }
      : onValueChange
        ? {
            value,
            onChange: onValueChange,
          }
        : {
            value,
          };

  if (field.inputType === "SELECT") {
    return (
      <div className="space-y-1">
        <SellerSelect label={field.label} name={name} required={field.required} {...inputValueProps}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SellerSelect>
        {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
      </div>
    );
  }

  if (field.inputType === "TEXTAREA" || field.inputType === "MULTI_TEXT") {
    return (
      <div className="space-y-1 md:col-span-2">
        <SellerTextArea
          label={field.label}
          name={name}
          required={field.required}
          rows={field.inputType === "MULTI_TEXT" ? 3 : 4}
          {...inputValueProps}
          {...(field.placeholder ? { placeholder: field.placeholder } : {})}
        />
        {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <SellerField
        label={field.label}
        name={name}
        type={field.inputType === "NUMBER" ? "number" : "text"}
        required={field.required}
        {...inputValueProps}
        {...(field.placeholder ? { placeholder: field.placeholder } : {})}
        {...(field.inputType === "NUMBER"
          ? { min: 0, step: field.key === "gstRatePercent" ? "0.01" : "1" }
          : {})}
      />
      {field.key === "hsnCode" && onHsnSuggestionSelect ? (
        <HsnSuggestions
          search={value ?? defaultValue}
          category={category ?? null}
          onSelect={onHsnSuggestionSelect}
        />
      ) : null}
      {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
    </div>
  );
}

function HsnSuggestions({
  search,
  category,
  onSelect,
}: {
  search: string;
  category?: CategorySummary | null;
  onSelect: (entry: HsnMasterEntry) => void;
}) {
  const trimmedSearch = search.trim();
  const query = useQuery({
    queryKey: ["hsn-master", category?.id ?? "", trimmedSearch],
    queryFn: () => searchHsnMaster({ search: trimmedSearch, ...(category?.id ? { categoryId: category.id } : {}), limit: 6 }),
    enabled: trimmedSearch.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
  const suggestions = query.data ?? [];

  if (!suggestions.length) {
    return category?.defaultHsnCode && category.defaultGstRatePercent !== null && category.defaultGstRatePercent !== undefined ? (
      <button
        type="button"
        onClick={() =>
          onSelect({
            id: `category-${category.id}`,
            hsnCode: category.defaultHsnCode ?? "",
            description: category.defaultTaxDescription || `${category.name} default HSN`,
            gstRatePercent: category.defaultGstRatePercent ?? "",
            categoryId: category.id,
            category: { id: category.id, name: category.name, slug: category.slug },
          })
        }
        className="mt-2 w-full rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-bold text-[#163B5C] transition hover:border-[#ED3500] hover:bg-[#FFF0EC]"
      >
        Use category default: {category.defaultHsnCode} - GST {category.defaultGstRatePercent}%
      </button>
    ) : null;
  }

  return (
    <div className="mt-2 grid gap-2">
      {suggestions.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelect(entry)}
          className="rounded-md border border-[#D8E2EA] bg-[#F8FAFC] px-3 py-2 text-left text-xs font-bold text-[#163B5C] transition hover:border-[#ED3500] hover:bg-[#FFF0EC]"
        >
          <span className="block">
            {entry.hsnCode} - {entry.description}
          </span>
          <span className="mt-0.5 block text-[#667085]">
            GST {entry.gstRatePercent}%{entry.category?.name ? ` - ${entry.category.name}` : ""}
          </span>
        </button>
      ))}
    </div>
  );
}

function DynamicAttributeFields({
  fields,
  values,
  namePrefix,
  title
}: {
  fields: ProductTemplateField[];
  values?: Record<string, unknown> | null;
  namePrefix: string;
  title: string;
}) {
  if (!fields.length) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-lg border border-[#D9E2EA] bg-white p-4">
      <p className="text-sm font-black text-[#1F2933]">{title}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <DynamicAttributeInput
            key={`${field.scope}-${field.fieldKey}`}
            field={field}
            name={attributeInputName(namePrefix, field.fieldKey)}
            defaultValue={attributeValueToInput(values?.[field.fieldKey])}
          />
        ))}
      </div>
    </div>
  );
}

function DynamicAttributeInput({
  field,
  name,
  defaultValue
}: {
  field: ProductTemplateField;
  name: string;
  defaultValue: string;
}) {
  const help = field.helpText || field.placeholder;

  if (field.fieldType === "TEXTAREA") {
    const placeholderProps = field.placeholder ? { placeholder: field.placeholder } : {};
    return (
      <div className="space-y-1 md:col-span-2">
        <SellerTextArea label={field.label} name={name} defaultValue={defaultValue} required={field.isRequired} rows={3} {...placeholderProps} />
        {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
      </div>
    );
  }

  if (field.fieldType === "SELECT") {
    return (
      <div className="space-y-1">
        <SellerSelect label={field.label} name={name} defaultValue={defaultValue} required={field.isRequired}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SellerSelect>
        {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
      </div>
    );
  }

  if (field.fieldType === "BOOLEAN") {
    return (
      <div className="space-y-1">
        <SellerSelect label={field.label} name={name} defaultValue={defaultValue} required={field.isRequired}>
          <option value="">Choose</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </SellerSelect>
        {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <SellerField
        label={field.label}
        name={name}
        type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
        defaultValue={defaultValue}
        required={field.isRequired}
        {...(field.fieldType === "MULTI_SELECT"
          ? { placeholder: "Separate values with commas" }
          : field.placeholder
            ? { placeholder: field.placeholder }
            : {})}
        {...(field.fieldType === "NUMBER" ? { min: 0, step: "0.01" } : {})}
      />
      {help ? <p className="text-xs font-semibold text-[#667085]">{help}</p> : null}
    </div>
  );
}

function ProductGalleryUploader({
  authHeaders,
  images,
  onChange,
  disabled
}: {
  authHeaders: IndihubAuthHeaders;
  images: DraftProductImage[];
  onChange: (images: DraftProductImage[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const remaining = maxProductImages - images.length;

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || remaining <= 0) {
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);

    try {
      const uploadedImages: DraftProductImage[] = [];
      for (const [index, file] of selected.entries()) {
        const uploaded = await uploadPublicImage(authHeaders, file, "SELLER_PRODUCT_IMAGE", {
          onProgress: (nextProgress) => setProgress(Math.round((index / selected.length) * 100 + nextProgress / selected.length))
        });
        uploadedImages.push({
          id: uploaded.publicId,
          url: uploaded.assetKey,
          altText: "",
          isPrimary: images.length === 0 && index === 0
        });
      }
      onChange(normalizePrimary([...images, ...uploadedImages]));
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Product image upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function updateImage(id: string, patch: Partial<DraftProductImage>) {
    onChange(normalizePrimary(images.map((image) => (image.id === id ? { ...image, ...patch } : image))));
  }

  function removeImage(id: string) {
    onChange(normalizePrimary(images.filter((image) => image.id !== id)));
  }

  function moveImage(id: string, direction: -1 | 1) {
    const index = images.findIndex((image) => image.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= images.length) {
      return;
    }
    const next = [...images];
    const [current] = next.splice(index, 1);
    if (current) {
      next.splice(nextIndex, 0, current);
      onChange(normalizePrimary(next));
    }
  }

  return (
    <div className="rounded-lg border border-[#D9E2EA] bg-white p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black text-[#1F2933]">Product images</p>
          <p className="mt-1 text-sm leading-6 text-[#667085]">Upload up to 10 images. Select one primary image for catalogue cards.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading || remaining <= 0}>
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Upload images
        </Button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(event) => void uploadFiles(event.currentTarget.files)} />
      </div>

      {uploading ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[#EAF1F7]">
            <div className="h-full rounded-full bg-[#ED3500] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-[#667085]">Uploading {progress}%</p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm font-bold text-[#D64545]">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {images.map((image, index) => (
          <div key={image.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#EAF1F7]">
              <StorefrontImage src={image.url} alt={image.altText || "Product image"} sizes="240px" fallbackLabel="1HI" />
            </div>
            <input
              value={image.altText ?? ""}
              onChange={(event) => updateImage(image.id, { altText: event.target.value })}
              placeholder="Image alt text"
              className="mt-3 h-10 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none focus:border-[#ED3500]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={image.isPrimary ? "primary" : "outline"}
                size="sm"
                onClick={() => onChange(images.map((item) => ({ ...item, isPrimary: item.id === image.id })))}
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                Primary
              </Button>
              <IconAction label="Move up" disabled={index === 0} onClick={() => moveImage(image.id, -1)}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </IconAction>
              <IconAction label="Move down" disabled={index === images.length - 1} onClick={() => moveImage(image.id, 1)}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </IconAction>
              <IconAction label="Remove" onClick={() => removeImage(image.id)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </IconAction>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[#D8E2EA] bg-[#F8FAFC] p-6 text-center">
          <p className="text-sm font-black text-[#1F2933]">No product images uploaded</p>
          <p className="mt-1 text-sm text-[#667085]">Uploaded images will appear on catalogue cards and product pages.</p>
        </div>
      ) : null}
      <p className={cn("mt-3 text-xs font-bold", remaining <= 0 ? "text-[#D64545]" : "text-[#667085]")}>{remaining} image slots remaining.</p>
    </div>
  );
}

function IconAction({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-grid h-9 w-9 place-items-center rounded-md border border-[#D8E2EA] bg-white text-[#1F2933] transition hover:border-[#ED3500] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function imagesToDraft(images: ProductImage[]): DraftProductImage[] {
  return normalizePrimary(
    images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText ?? "",
      isPrimary: Boolean(image.isPrimary)
    }))
  );
}

function normalizePrimary(images: DraftProductImage[]) {
  if (!images.length) {
    return images;
  }

  const primaryIndex = images.findIndex((image) => image.isPrimary);
  const normalizedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

  return images.map((image, index) => ({ ...image, isPrimary: index === normalizedPrimaryIndex }));
}

function emptyDraftVariant(variant?: ProductVariant): DraftVariantRow {
  draftVariantSequence += 1;
  return {
    rowId: variant?.id ?? `new-${Date.now()}-${draftVariantSequence}`,
    ...(variant ? { variant } : {})
  };
}

function variantsToDraft(variants: ProductVariant[]) {
  return variants.length ? variants.map((variant) => emptyDraftVariant(variant)) : [emptyDraftVariant()];
}

function variantFieldPrefix(rowId: string) {
  return `variant:${rowId}`;
}

function attributeInputName(prefix: string, fieldKey: string) {
  return `${prefix}:${fieldKey}`;
}

function marketplaceEssentialInputName(fieldKey: string) {
  return `marketplaceEssential:${fieldKey}`;
}

function templateFields(template: ProductTemplateSummary | null | undefined, scope: ProductTemplateField["scope"]) {
  return [...(template?.fields ?? [])]
    .filter((field) => field.scope === scope)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label));
}

function dynamicAttributesFromForm(form: FormData, fields: ProductTemplateField[], prefix: string): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const field of fields) {
    const rawValue = optionalFormValue(form, attributeInputName(prefix, field.fieldKey));
    const value = coerceDynamicAttributeValue(field, rawValue);
    if (value !== undefined) {
      attributes[field.fieldKey] = value;
    }
  }

  return attributes;
}

function marketplaceEssentialsFromForm(form: FormData): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const field of marketplaceProductEssentialFields) {
    const rawValue = optionalFormValue(form, marketplaceEssentialInputName(field.key));
    const value = coerceMarketplaceEssentialValue(field, rawValue);
    if (value !== undefined) {
      attributes[field.key] = value;
    }
  }

  return attributes;
}

function positiveIntegerFormValue(form: FormData, name: string) {
  const rawValue = optionalFormValue(form, name);
  if (!rawValue) {
    return undefined;
  }
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function coerceMarketplaceEssentialValue(field: MarketplaceProductEssentialField, rawValue: string | undefined): unknown {
  if (rawValue === undefined) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return undefined;
  }

  if (field.inputType === "NUMBER") {
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : trimmed;
  }

  if (field.inputType === "MULTI_TEXT") {
    const values = trimmed
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length ? values : undefined;
  }

  return trimmed;
}

function coerceDynamicAttributeValue(field: ProductTemplateField, rawValue: string | undefined): unknown {
  if (rawValue === undefined) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return undefined;
  }

  if (field.fieldType === "NUMBER") {
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : trimmed;
  }

  if (field.fieldType === "BOOLEAN") {
    return trimmed === "true";
  }

  if (field.fieldType === "MULTI_SELECT") {
    const values = trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length ? values : undefined;
  }

  return trimmed;
}

function attributeValueToInput(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return "";
}

function marketplaceEssentialValueToInput(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join("\n");
  }

  return attributeValueToInput(value);
}

function variantNameFromAttributes(attributes: Record<string, unknown>) {
  const values = Object.values(attributes)
    .map((value) => displayAttributeValue(value))
    .filter(Boolean)
    .slice(0, 3);

  return values.length ? values.join(" / ") : undefined;
}

function attributeChips(attributes: Record<string, unknown> | null | undefined, fields: ProductTemplateField[]) {
  if (!attributes) {
    return [];
  }

  const marketplaceChips = marketplaceProductAdminSummaryFields
    .map((field) => {
      const value = displayAttributeValue(attributes[field.key]);
      return value ? `${field.label}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value));

  const templateChips = templateFields({ id: "", name: "", code: "", status: "ACTIVE", listingMode: "CART", sortOrder: 0, fields }, "PRODUCT")
    .filter((field) => !marketplaceEssentialFieldKeys.has(field.fieldKey))
    .map((field) => {
      const value = displayAttributeValue(attributes[field.fieldKey]);
      return value ? `${field.label}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return [...marketplaceChips, ...templateChips];
}

function displayAttributeValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return "";
}

function humanizeAttributeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
