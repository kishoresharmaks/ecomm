import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  Button,
  CollapsibleSection,
  Field,
  Header,
  LoadingState,
  QueryErrorState,
  Screen,
  SelectField,
  Toast,
} from "../../src/components/screen";
import {
  getSellerProduct,
  listCategories,
  searchHsnMaster,
  updateSellerProduct,
} from "../../src/features/seller/seller-api";
import { uploadPublicSellerImage, type MobileUploadFile } from "../../src/features/seller/mobile-upload";
import { launchSellerImageLibraryAsync } from "../../src/features/seller/image-picker";
import {
  CONDITION_OPTIONS,
  GST_OPTIONS,
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_VARIANTS,
  RETURN_OPTIONS,
  UNIT_OPTIONS,
  createBlankProductEditForm,
  createBlankVariant,
  productToEditForm,
  resolveProductImageUri,
  validateProductEditForm,
  type ProductEditFormValues,
  type ProductImageFormValue,
  type ProductVariantFormValue,
} from "../../src/features/seller/product-edit";
import { buildUpdateProductPayload, productEditFormToProductFormState } from "../../src/features/seller/product-form";
import { colors, spacing } from "../../src/theme";

export default function EditSellerProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const decodedId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductEditFormValues>(() => createBlankProductEditForm());
  const [loadedProductId, setLoadedProductId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({
    visible: false,
    message: "",
    type: "success",
  });

  const productQuery = useQuery({
    queryKey: ["seller-product", auth.authKey, decodedId],
    queryFn: () => getSellerProduct(auth.authHeaders, decodedId),
    enabled: auth.enabled && Boolean(decodedId),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", auth.authKey],
    queryFn: () => listCategories(auth.authHeaders),
    enabled: auth.enabled,
  });

  const hsnQuery = useQuery({
    queryKey: ["hsn-search", auth.authKey, form.hsnCode],
    queryFn: () => searchHsnMaster(auth.authHeaders, { search: form.hsnCode, limit: 10 }),
    enabled: auth.enabled && form.hsnCode.trim().length >= 2,
  });

  useEffect(() => {
    if (productQuery.data && productQuery.data.id !== loadedProductId) {
      setForm(productToEditForm(productQuery.data));
      setLoadedProductId(productQuery.data.id);
      setError(null);
    }
  }, [loadedProductId, productQuery.data]);

  useEffect(() => {
    const selectedCategory = categoriesQuery.data?.find((category) => category.id === form.categoryId);
    if (!selectedCategory) {
      return;
    }
    setForm((current) => ({
      ...current,
      hsnCode: current.hsnCode || selectedCategory.defaultHsnCode || "",
      gstRatePercent:
        current.gstRatePercent || selectedCategory.defaultGstRatePercent === undefined || selectedCategory.defaultGstRatePercent === null
          ? current.gstRatePercent
          : String(selectedCategory.defaultGstRatePercent),
    }));
  }, [categoriesQuery.data, form.categoryId]);

  const categoryOptions = useMemo(
    () => (categoriesQuery.data ?? []).map((category) => ({ label: category.name, value: category.id })),
    [categoriesQuery.data],
  );

  const validation = validateProductEditForm(form);
  const activeVariantCount = form.variants.filter((variant) => variant.status !== "INACTIVE").length;

  const mutation = useMutation({
    mutationFn: () => {
      const nextValidation = validateProductEditForm(form);
      if (!nextValidation.valid) {
        throw new Error(nextValidation.errors[0] ?? "Please complete the required product details.");
      }
      const payload = buildUpdateProductPayload(productEditFormToProductFormState(form), [], [], productQuery.data);
      return updateSellerProduct(auth.authHeaders, decodedId, payload);
    },
    onSuccess: async () => {
      setToast({ visible: true, message: "Product updated successfully.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-products", auth.authKey] });
      await queryClient.invalidateQueries({ queryKey: ["seller-product", auth.authKey, decodedId] });
      router.back();
    },
    onError: (saveError: Error) => {
      setToast({ visible: true, message: saveError.message || "Product save failed.", type: "error" });
    },
  });

  function updateField<K extends keyof ProductEditFormValues>(key: K, value: ProductEditFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateVariant(clientId: string, patch: Partial<ProductVariantFormValue>) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) =>
        variant.clientId === clientId ? { ...variant, ...patch } : variant,
      ),
    }));
  }

  function addVariant() {
    if (activeVariantCount >= MAX_PRODUCT_VARIANTS) {
      setError(`Add up to ${MAX_PRODUCT_VARIANTS} active variants.`);
      return;
    }
    setError(null);
    setForm((current) => ({ ...current, variants: [...current.variants, createBlankVariant()] }));
  }

  function removeVariant(variant: ProductVariantFormValue) {
    const activeVariants = form.variants.filter((item) => item.status !== "INACTIVE");
    if (activeVariants.length <= 1 && variant.status !== "INACTIVE") {
      setError("At least one active variant is required.");
      return;
    }
    setError(null);
    setForm((current) => {
      if (!variant.id) {
        return { ...current, variants: current.variants.filter((item) => item.clientId !== variant.clientId) };
      }
      return {
        ...current,
        variants: current.variants.filter((item) => item.clientId !== variant.clientId),
        removedVariantIds: current.removedVariantIds.includes(variant.id)
          ? current.removedVariantIds
          : [...current.removedVariantIds, variant.id],
      };
    });
  }

  async function pickAndUploadImage() {
    if (form.images.length >= MAX_PRODUCT_IMAGES) {
      setError(`Add up to ${MAX_PRODUCT_IMAGES} product images.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await launchSellerImageLibraryAsync({
        quality: 0.82,
        allowsEditing: true,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }
      const asset = result.assets[0];
      const file: MobileUploadFile = {
        uri: asset.uri,
        name: asset.fileName ?? `seller-product-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        sizeBytes: asset.fileSize,
      };
      const uploaded = await uploadPublicSellerImage(auth.authHeaders, file, "SELLER_PRODUCT_IMAGE");
      const nextImage: ProductImageFormValue = {
        id: `image_${Date.now()}`,
        url: uploaded.assetKey,
        altText: form.name || "Product image",
        isPrimary: form.images.length === 0,
        sortOrder: form.images.length,
        localUri: asset.uri,
      };
      setForm((current) => ({ ...current, images: [...current.images, nextImage] }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function updateImage(id: string, patch: Partial<ProductImageFormValue>) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) => (image.id === id ? { ...image, ...patch } : image)),
    }));
  }

  function removeImage(id: string) {
    setForm((current) => {
      let nextImages = current.images.filter((image) => image.id !== id);
      if (nextImages.length && !nextImages.some((image) => image.isPrimary)) {
        nextImages = nextImages.map((image, index) => ({ ...image, isPrimary: index === 0 }));
      }
      return { ...current, images: nextImages.map((image, index) => ({ ...image, sortOrder: index })) };
    });
  }

  function moveImage(id: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.images.findIndex((image) => image.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.images.length) {
        return current;
      }
      const nextImages = [...current.images];
      const [image] = nextImages.splice(index, 1);
      if (!image) {
        return current;
      }
      nextImages.splice(targetIndex, 0, image);
      return { ...current, images: nextImages.map((item, nextIndex) => ({ ...item, sortOrder: nextIndex })) };
    });
  }

  function makePrimaryImage(id: string) {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) => ({ ...image, isPrimary: image.id === id })),
    }));
  }

  if (!auth.enabled || productQuery.isLoading) {
    return <LoadingState message="Loading product..." />;
  }

  if (productQuery.isError) {
    return (
      <Screen>
        <QueryErrorState
          title="Could not load product"
          message={productQuery.error instanceof Error ? productQuery.error.message : undefined}
          onRetry={() => productQuery.refetch()}
          retrying={productQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Edit product" subtitle="Update listing details, compliance, images, variants, price, and stock." />

        <CollapsibleSection title="Basic Information" defaultOpen>
          <SelectField
            label="Category *"
            options={categoryOptions}
            selectedValue={form.categoryId}
            onSelect={(value) => updateField("categoryId", value)}
            placeholder={categoriesQuery.isLoading ? "Loading categories..." : "Select category"}
          />
          {categoriesQuery.isError ? (
            <Text style={styles.helperError}>Categories could not load. You can retry by reopening this screen.</Text>
          ) : null}
          <Field label="Product name *" value={form.name} onChangeText={(value) => updateField("name", value)} />
          <Field
            label="Description *"
            value={form.description}
            onChangeText={(value) => updateField("description", value)}
            multiline
            numberOfLines={4}
          />
        </CollapsibleSection>

        <CollapsibleSection title={`Images (${form.images.length}/${MAX_PRODUCT_IMAGES})`}>
          <Button
            disabled={uploading || form.images.length >= MAX_PRODUCT_IMAGES}
            title={uploading ? "Uploading..." : "Add image"}
            onPress={pickAndUploadImage}
            loading={uploading}
          />
          {form.images.map((image, index) => (
            <View key={image.id} style={styles.imageRow}>
              {resolveProductImageUri(image) ? (
                <Image source={{ uri: resolveProductImageUri(image) ?? "" }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewFallback}>
                  <Text style={styles.previewFallbackText}>No image</Text>
                </View>
              )}
              <View style={styles.imageMeta}>
                <Text style={styles.itemTitle}>Image {index + 1}</Text>
                <Field
                  label="Alt text"
                  value={image.altText}
                  onChangeText={(value) => updateImage(image.id, { altText: value })}
                />
                <View style={styles.actionRow}>
                  <Button
                    title={image.isPrimary ? "Primary" : "Set primary"}
                    tone="secondary"
                    disabled={image.isPrimary}
                    onPress={() => makePrimaryImage(image.id)}
                    style={styles.compactButton}
                  />
                  <Button
                    title="Up"
                    tone="secondary"
                    disabled={index === 0}
                    onPress={() => moveImage(image.id, -1)}
                    style={styles.compactButton}
                  />
                  <Button
                    title="Down"
                    tone="secondary"
                    disabled={index === form.images.length - 1}
                    onPress={() => moveImage(image.id, 1)}
                    style={styles.compactButton}
                  />
                  <Button title="Remove" tone="danger" onPress={() => removeImage(image.id)} style={styles.compactButton} />
                </View>
              </View>
            </View>
          ))}
          {form.images.length === 0 ? <Text style={styles.helperText}>No image uploaded yet.</Text> : null}
        </CollapsibleSection>

        <CollapsibleSection title="Marketplace Essentials">
          <Field
            label="Brand / local label *"
            value={form.brand}
            onChangeText={(value) => updateField("brand", value)}
            placeholder="e.g., 1HandIndia, Unbranded local"
          />
          <SelectField
            label="Condition *"
            options={CONDITION_OPTIONS}
            selectedValue={form.condition}
            onSelect={(value) => updateField("condition", value)}
            placeholder="Select condition"
          />
          <SelectField
            label="Unit of sale *"
            options={UNIT_OPTIONS}
            selectedValue={form.unitOfMeasure}
            onSelect={(value) => updateField("unitOfMeasure", value)}
            placeholder="Select unit"
          />
        </CollapsibleSection>

        <CollapsibleSection title="Tax & Compliance">
          <Field
            label="HSN code *"
            value={form.hsnCode}
            onChangeText={(value) => updateField("hsnCode", value)}
            placeholder="4-8 digit HSN code"
            autoCapitalize="characters"
          />
          {hsnQuery.isFetching ? <Text style={styles.helperText}>Searching HSN suggestions...</Text> : null}
          {hsnQuery.isError ? (
            <Text style={styles.helperError}>HSN suggestions are unavailable. Manual HSN and GST values can still be saved.</Text>
          ) : null}
          {(hsnQuery.data ?? []).slice(0, 3).map((hsn) => (
            <Pressable
              key={hsn.id}
              accessibilityRole="button"
              onPress={() => {
                updateField("hsnCode", hsn.hsnCode);
                updateField("gstRatePercent", String(hsn.gstRatePercent));
              }}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>
                {hsn.hsnCode} - {hsn.gstRatePercent}% - {hsn.description}
              </Text>
            </Pressable>
          ))}
          <SelectField
            label="GST rate % *"
            options={GST_OPTIONS}
            selectedValue={form.gstRatePercent}
            onSelect={(value) => updateField("gstRatePercent", value)}
            placeholder="Select GST rate"
          />
          <Field label="Country of origin" value={form.countryOfOrigin} onChangeText={(value) => updateField("countryOfOrigin", value)} />
          <Field label="Manufacturer name" value={form.manufacturerName} onChangeText={(value) => updateField("manufacturerName", value)} />
          <Field
            label="Manufacturer address"
            value={form.manufacturerAddress}
            onChangeText={(value) => updateField("manufacturerAddress", value)}
            multiline
          />
          <Field label="Packer name" value={form.packerName} onChangeText={(value) => updateField("packerName", value)} />
          <Field label="Importer name" value={form.importerName} onChangeText={(value) => updateField("importerName", value)} />
        </CollapsibleSection>

        <CollapsibleSection title="Delivery & After-Sales">
          <SelectField
            label="Return policy *"
            options={RETURN_OPTIONS}
            selectedValue={form.returnEligibility}
            onSelect={(value) => updateField("returnEligibility", value)}
            placeholder="Select return policy"
          />
          <Field
            keyboardType="number-pad"
            label="Package weight (grams) *"
            value={form.packageWeightGrams}
            onChangeText={(value) => updateField("packageWeightGrams", value)}
          />
          <Field
            keyboardType="number-pad"
            label="Package length (cm)"
            value={form.packageLengthCm}
            onChangeText={(value) => updateField("packageLengthCm", value)}
          />
          <Field
            keyboardType="number-pad"
            label="Package breadth (cm)"
            value={form.packageBreadthCm}
            onChangeText={(value) => updateField("packageBreadthCm", value)}
          />
          <Field
            keyboardType="number-pad"
            label="Package height (cm)"
            value={form.packageHeightCm}
            onChangeText={(value) => updateField("packageHeightCm", value)}
          />
          <Field label="Warranty" value={form.warranty} onChangeText={(value) => updateField("warranty", value)} />
        </CollapsibleSection>

        <CollapsibleSection title="Discovery & SEO">
          <Field
            label="Key highlights"
            value={form.highlights}
            onChangeText={(value) => updateField("highlights", value)}
            multiline
            numberOfLines={3}
            placeholder="One highlight per line"
          />
          <Field
            label="Search tags"
            value={form.searchTags}
            onChangeText={(value) => updateField("searchTags", value)}
            placeholder="Comma-separated tags"
          />
          <Field label="Manufacturer GTIN/barcode" value={form.gtin} onChangeText={(value) => updateField("gtin", value)} />
          <Field label="SEO title" value={form.seoTitle} onChangeText={(value) => updateField("seoTitle", value)} />
          <Field
            label="SEO description"
            value={form.seoDescription}
            onChangeText={(value) => updateField("seoDescription", value)}
            multiline
          />
        </CollapsibleSection>

        <CollapsibleSection title={`Variants (${activeVariantCount}/${MAX_PRODUCT_VARIANTS})`} defaultOpen>
          {form.variants.map((variant, index) => (
            <View key={variant.clientId} style={styles.variantPanel}>
              <View style={styles.variantHeader}>
                <Text style={styles.itemTitle}>{variant.variantName || `Variant ${index + 1}`}</Text>
                <Button title="Remove" tone="danger" onPress={() => removeVariant(variant)} style={styles.compactButton} />
              </View>
              <Field
                keyboardType="decimal-pad"
                label="Selling price (INR) *"
                value={variant.price}
                onChangeText={(value) => updateVariant(variant.clientId, { price: value })}
              />
              <Field
                keyboardType="decimal-pad"
                label="MRP (INR)"
                value={variant.mrp}
                onChangeText={(value) => updateVariant(variant.clientId, { mrp: value })}
              />
              <Field
                keyboardType="number-pad"
                label="Stock quantity"
                value={variant.stock}
                onChangeText={(value) => updateVariant(variant.clientId, { stock: value })}
              />
              <Field label="SKU" value={variant.sku} onChangeText={(value) => updateVariant(variant.clientId, { sku: value })} />
              <Field
                label="Variant name"
                value={variant.variantName}
                onChangeText={(value) => updateVariant(variant.clientId, { variantName: value })}
                placeholder="e.g., 5 KG Pack, Size M"
              />
              <Field
                keyboardType="number-pad"
                label="Variant package weight (grams)"
                value={variant.packageWeightGrams}
                onChangeText={(value) => updateVariant(variant.clientId, { packageWeightGrams: value })}
              />
              <Field
                keyboardType="number-pad"
                label="Variant length (cm)"
                value={variant.packageLengthCm}
                onChangeText={(value) => updateVariant(variant.clientId, { packageLengthCm: value })}
              />
              <Field
                keyboardType="number-pad"
                label="Variant breadth (cm)"
                value={variant.packageBreadthCm}
                onChangeText={(value) => updateVariant(variant.clientId, { packageBreadthCm: value })}
              />
              <Field
                keyboardType="number-pad"
                label="Variant height (cm)"
                value={variant.packageHeightCm}
                onChangeText={(value) => updateVariant(variant.clientId, { packageHeightCm: value })}
              />
            </View>
          ))}
          <Button
            title="Add variant"
            tone="secondary"
            disabled={activeVariantCount >= MAX_PRODUCT_VARIANTS}
            onPress={addVariant}
          />
        </CollapsibleSection>

        {error ? <Text style={styles.saveError}>{error}</Text> : null}
        {!validation.valid ? <Text style={styles.saveError}>{validation.errors[0]}</Text> : null}
        <Button
          disabled={mutation.isPending || uploading || !validation.valid}
          title={mutation.isPending ? "Saving..." : "Update product"}
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
        />

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = {
  helperText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  helperError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800" as const,
    lineHeight: 18,
  },
  suggestion: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
  },
  suggestionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700" as const,
    lineHeight: 18,
  },
  imageRow: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  previewImage: {
    width: "100%" as const,
    height: 180,
    borderRadius: 8,
    backgroundColor: colors.softSurface,
  },
  previewFallback: {
    alignItems: "center" as const,
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 140,
    justifyContent: "center" as const,
  },
  previewFallbackText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800" as const,
  },
  imageMeta: {
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.sm,
  },
  compactButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900" as const,
  },
  variantPanel: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  variantHeader: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    gap: spacing.md,
  },
  saveError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800" as const,
    lineHeight: 20,
  },
};
