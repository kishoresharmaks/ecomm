import { router, type Href } from "expo-router";
import { useEffect, useMemo, useReducer, useState, type Dispatch } from "react";
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
import { createSellerProduct, listCategories, searchHsnMaster } from "../../src/features/seller/seller-api";
import { uploadPublicSellerImage, type MobileUploadFile } from "../../src/features/seller/mobile-upload";
import { launchSellerImageLibraryAsync } from "../../src/features/seller/image-picker";
import {
  CONDITION_OPTIONS,
  GST_OPTIONS,
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_VARIANTS,
  RETURN_OPTIONS,
  UNIT_OPTIONS,
  resolveProductImageUri,
  type ProductImageFormValue,
} from "../../src/features/seller/product-edit";
import {
  buildCreateProductPayload,
  createBlankProductFormState,
  flattenCategories,
  productFormReducer,
  templateFields,
  validateProductForm,
  type ProductFormAction,
  type ProductFormVariant,
} from "../../src/features/seller/product-form";
import type { ProductTemplateField } from "../../src/features/seller/seller-api";
import { colors, spacing } from "../../src/theme";

export default function NewSellerProductScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(productFormReducer, undefined, createBlankProductFormState);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({
    visible: false,
    message: "",
    type: "success",
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", auth.authKey],
    queryFn: () => listCategories(auth.authHeaders),
    enabled: auth.enabled,
  });

  const categories = useMemo(() => flattenCategories(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === state.base.categoryId) ?? categories[0] ?? null,
    [categories, state.base.categoryId],
  );
  const productFields = useMemo(() => templateFields(selectedCategory, "PRODUCT"), [selectedCategory]);
  const variantFields = useMemo(() => templateFields(selectedCategory, "VARIANT"), [selectedCategory]);
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ label: category.name, value: category.id })),
    [categories],
  );

  const hsnQuery = useQuery({
    queryKey: ["hsn-search", auth.authKey, state.base.categoryId, state.base.hsnCode],
    queryFn: () =>
      searchHsnMaster(auth.authHeaders, {
        search: state.base.hsnCode,
        categoryId: state.base.categoryId,
        limit: 10,
      }),
    enabled: auth.enabled && state.base.hsnCode.trim().length >= 2,
  });

  useEffect(() => {
    if (!state.base.categoryId && categories[0]?.id) {
      dispatch({ type: "setBase", key: "categoryId", value: categories[0].id });
    }
  }, [categories, state.base.categoryId]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }
    if (selectedCategory.defaultHsnCode && !state.base.hsnCode) {
      dispatch({ type: "setBase", key: "hsnCode", value: selectedCategory.defaultHsnCode });
    }
    if (selectedCategory.defaultGstRatePercent !== null && selectedCategory.defaultGstRatePercent !== undefined && !state.base.gstRatePercent) {
      dispatch({ type: "setBase", key: "gstRatePercent", value: String(selectedCategory.defaultGstRatePercent) });
    }
  }, [selectedCategory, state.base.gstRatePercent, state.base.hsnCode]);

  const validation = validateProductForm(state, productFields, variantFields);
  const activeVariantCount = state.variants.filter((variant) => variant.status !== "INACTIVE").length;

  useEffect(() => {
    if (state.submitted) {
      dispatch({ type: "setErrors", errors: validation.errors });
    }
  }, [state.submitted, validation.errors]);

  const mutation = useMutation({
    mutationFn: () => {
      const nextValidation = validateProductForm(state, productFields, variantFields);
      dispatch({ type: "markSubmitted" });
      dispatch({ type: "setErrors", errors: nextValidation.errors });
      if (!nextValidation.valid) {
        throw new Error(nextValidation.messages[0] ?? "Please complete the required product details.");
      }
      return createSellerProduct(auth.authHeaders, buildCreateProductPayload(state, productFields, variantFields));
    },
    onSuccess: async () => {
      setToast({ visible: true, message: "Product submitted for approval.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-products", auth.authKey] });
      setTimeout(() => router.replace("/(tabs)/products" as Href), 900);
    },
    onError: (saveError: Error) => {
      setToast({ visible: true, message: saveError.message || "Failed to create product.", type: "error" });
    },
  });

  async function pickAndUploadImage() {
    if (state.images.length >= MAX_PRODUCT_IMAGES) {
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
      dispatch({
        type: "addImage",
        image: {
          id: `image_${Date.now()}`,
          url: uploaded.assetKey,
          altText: state.base.name || "Product image",
          isPrimary: state.images.length === 0,
          sortOrder: state.images.length,
          localUri: asset.uri,
        },
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (!auth.enabled || categoriesQuery.isLoading) {
    return <LoadingState message="Loading product form..." />;
  }

  if (categoriesQuery.isError) {
    return (
      <Screen>
        <QueryErrorState
          title="Could not load categories"
          message={categoriesQuery.error instanceof Error ? categoriesQuery.error.message : undefined}
          onRetry={() => categoriesQuery.refetch()}
          retrying={categoriesQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <Header title="Add product" subtitle="Create a marketplace-ready listing with category fields, images, and variants." />

        <CollapsibleSection title="Basic Information" defaultOpen>
          <SelectField
            label="Category *"
            options={categoryOptions}
            selectedValue={state.base.categoryId}
            onSelect={(value) => dispatch({ type: "setBase", key: "categoryId", value })}
            placeholder="Select category"
            error={fieldError(state, "base.categoryId")}
          />
          {selectedCategory?.productTemplate ? (
            <Text style={styles.helperText}>
              Template: {selectedCategory.productTemplate.name} · {selectedCategory.productTemplate.listingMode ?? "CART"}
            </Text>
          ) : null}
          <Field
            label="Product name *"
            value={state.base.name}
            onChangeText={(value) => dispatch({ type: "setBase", key: "name", value })}
            placeholder="Product name"
            error={fieldError(state, "base.name")}
          />
          <Field
            label="Description *"
            value={state.base.description}
            onChangeText={(value) => dispatch({ type: "setBase", key: "description", value })}
            multiline
            numberOfLines={4}
            placeholder="Product details, packaging, usage, and included items."
            error={fieldError(state, "base.description")}
          />
        </CollapsibleSection>

        <CollapsibleSection title={`Images (${state.images.length}/${MAX_PRODUCT_IMAGES})`} defaultOpen>
          <Button
            disabled={uploading || state.images.length >= MAX_PRODUCT_IMAGES}
            title={uploading ? "Uploading..." : "Add image"}
            onPress={pickAndUploadImage}
            loading={uploading}
          />
          {state.images.map((image, index) => (
            <ImageRow key={image.id} image={image} index={index} total={state.images.length} dispatch={dispatch} />
          ))}
          {state.images.length === 0 ? <Text style={styles.helperText}>Upload up to 10 clear product images.</Text> : null}
        </CollapsibleSection>

        <CollapsibleSection title="Marketplace Essentials" defaultOpen>
          <Field
            label="Brand / local label *"
            value={state.base.brand}
            onChangeText={(value) => dispatch({ type: "setBase", key: "brand", value })}
            placeholder="e.g., 1HandIndia, Unbranded local"
            error={fieldError(state, "base.brand")}
          />
          <SelectField
            label="Condition *"
            options={CONDITION_OPTIONS}
            selectedValue={state.base.condition}
            onSelect={(value) => dispatch({ type: "setBase", key: "condition", value })}
            placeholder="Select condition"
            error={fieldError(state, "base.condition")}
          />
          <SelectField
            label="Unit of sale *"
            options={UNIT_OPTIONS}
            selectedValue={state.base.unitOfMeasure}
            onSelect={(value) => dispatch({ type: "setBase", key: "unitOfMeasure", value })}
            placeholder="Select unit"
            error={fieldError(state, "base.unitOfMeasure")}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Tax & Compliance">
          <Field
            label="HSN code *"
            value={state.base.hsnCode}
            onChangeText={(value) => dispatch({ type: "setBase", key: "hsnCode", value })}
            placeholder="4-8 digit HSN code"
            autoCapitalize="characters"
            error={fieldError(state, "base.hsnCode")}
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
                dispatch({ type: "setBase", key: "hsnCode", value: hsn.hsnCode });
                dispatch({ type: "setBase", key: "gstRatePercent", value: String(hsn.gstRatePercent) });
              }}
              style={styles.suggestion}
            >
              <Text style={styles.suggestionText}>{hsn.hsnCode} - {hsn.gstRatePercent}% - {hsn.description}</Text>
            </Pressable>
          ))}
          <SelectField
            label="GST rate % *"
            options={GST_OPTIONS}
            selectedValue={state.base.gstRatePercent}
            onSelect={(value) => dispatch({ type: "setBase", key: "gstRatePercent", value })}
            placeholder="Select GST rate"
            error={fieldError(state, "base.gstRatePercent")}
          />
          <Field label="Country of origin" value={state.base.countryOfOrigin} onChangeText={(value) => dispatch({ type: "setBase", key: "countryOfOrigin", value })} />
          <Field label="Manufacturer name" value={state.base.manufacturerName} onChangeText={(value) => dispatch({ type: "setBase", key: "manufacturerName", value })} />
          <Field label="Manufacturer address" value={state.base.manufacturerAddress} onChangeText={(value) => dispatch({ type: "setBase", key: "manufacturerAddress", value })} multiline />
          <Field label="Packer name" value={state.base.packerName} onChangeText={(value) => dispatch({ type: "setBase", key: "packerName", value })} />
          <Field label="Importer name" value={state.base.importerName} onChangeText={(value) => dispatch({ type: "setBase", key: "importerName", value })} />
        </CollapsibleSection>

        <CollapsibleSection title="Delivery & After-Sales">
          <SelectField
            label="Return policy *"
            options={RETURN_OPTIONS}
            selectedValue={state.base.returnEligibility}
            onSelect={(value) => dispatch({ type: "setBase", key: "returnEligibility", value })}
            placeholder="Select return policy"
            error={fieldError(state, "base.returnEligibility")}
          />
          <Field keyboardType="number-pad" label="Package weight (grams) *" value={state.base.packageWeightGrams} onChangeText={(value) => dispatch({ type: "setBase", key: "packageWeightGrams", value })} error={fieldError(state, "base.packageWeightGrams")} />
          <Field keyboardType="number-pad" label="Package length (cm)" value={state.base.packageLengthCm} onChangeText={(value) => dispatch({ type: "setBase", key: "packageLengthCm", value })} />
          <Field keyboardType="number-pad" label="Package breadth (cm)" value={state.base.packageBreadthCm} onChangeText={(value) => dispatch({ type: "setBase", key: "packageBreadthCm", value })} />
          <Field keyboardType="number-pad" label="Package height (cm)" value={state.base.packageHeightCm} onChangeText={(value) => dispatch({ type: "setBase", key: "packageHeightCm", value })} />
          <Field label="Warranty" value={state.base.warranty} onChangeText={(value) => dispatch({ type: "setBase", key: "warranty", value })} />
        </CollapsibleSection>

        <CollapsibleSection title="Discovery & SEO">
          <Field label="Key highlights" value={state.base.highlights} onChangeText={(value) => dispatch({ type: "setBase", key: "highlights", value })} multiline numberOfLines={3} placeholder="One highlight per line" />
          <Field label="Search tags" value={state.base.searchTags} onChangeText={(value) => dispatch({ type: "setBase", key: "searchTags", value })} placeholder="Comma-separated tags" />
          <Field label="Manufacturer GTIN/barcode" value={state.base.gtin} onChangeText={(value) => dispatch({ type: "setBase", key: "gtin", value })} />
          <Field label="SEO title" value={state.base.seoTitle} onChangeText={(value) => dispatch({ type: "setBase", key: "seoTitle", value })} />
          <Field label="SEO description" value={state.base.seoDescription} onChangeText={(value) => dispatch({ type: "setBase", key: "seoDescription", value })} multiline />
        </CollapsibleSection>

        {productFields.length ? (
          <CollapsibleSection title="Category-Specific Fields" defaultOpen>
            {productFields.map((field) => (
              <DynamicField
                key={field.fieldKey}
                field={field}
                value={state.attributes[field.fieldKey] ?? ""}
                error={fieldError(state, `attribute.${field.fieldKey}`)}
                onChange={(value) => dispatch({ type: "setProductAttribute", key: field.fieldKey, value })}
              />
            ))}
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title={`Variants (${activeVariantCount}/${MAX_PRODUCT_VARIANTS})`} defaultOpen>
          {state.variants.map((variant, index) => (
            <VariantPanel
              key={variant.clientId}
              variant={variant}
              index={index}
              fields={variantFields}
              canRemove={state.variants.length > 1}
              errors={state.errors}
              dispatch={dispatch}
            />
          ))}
          <Button
            title="Add variant"
            tone="secondary"
            disabled={activeVariantCount >= MAX_PRODUCT_VARIANTS}
            onPress={() => dispatch({ type: "addVariant" })}
          />
        </CollapsibleSection>

        {error ? <Text style={styles.saveError}>{error}</Text> : null}
        {state.submitted && !validation.valid ? <Text style={styles.saveError}>{validation.messages[0]}</Text> : null}
        <Button
          disabled={mutation.isPending || uploading}
          title={mutation.isPending ? "Creating..." : "Submit for approval"}
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

function DynamicField({
  field,
  value,
  error,
  onChange,
}: {
  field: ProductTemplateField;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  const label = `${field.label}${field.isRequired ? " *" : ""}`;
  const help = field.helpText || field.placeholder;

  if (field.fieldType === "SELECT") {
    return (
      <View style={styles.fieldBlock}>
        <SelectField
          label={label}
          options={(field.options ?? []).map((option) => ({ label: option, value: option }))}
          selectedValue={value}
          onSelect={onChange}
          placeholder={`Select ${field.label.toLowerCase()}`}
          error={error}
        />
        {help ? <Text style={styles.helperText}>{help}</Text> : null}
      </View>
    );
  }

  if (field.fieldType === "BOOLEAN") {
    return (
      <View style={styles.fieldBlock}>
        <SelectField
          label={label}
          options={[{ label: "Yes", value: "true" }, { label: "No", value: "false" }]}
          selectedValue={value}
          onSelect={onChange}
          placeholder="Choose"
          error={error}
        />
        {help ? <Text style={styles.helperText}>{help}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.fieldBlock}>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        multiline={field.fieldType === "TEXTAREA"}
        numberOfLines={field.fieldType === "TEXTAREA" ? 3 : undefined}
        keyboardType={field.fieldType === "NUMBER" ? "decimal-pad" : "default"}
        placeholder={field.fieldType === "MULTI_SELECT" ? "Comma-separated values" : field.placeholder ?? undefined}
        error={error}
      />
      {help ? <Text style={styles.helperText}>{help}</Text> : null}
    </View>
  );
}

function VariantPanel({
  variant,
  index,
  fields,
  canRemove,
  errors,
  dispatch,
}: {
  variant: ProductFormVariant;
  index: number;
  fields: ProductTemplateField[];
  canRemove: boolean;
  errors: Record<string, string>;
  dispatch: Dispatch<ProductFormAction>;
}) {
  const update = (key: keyof ProductFormVariant, value: string) =>
    dispatch({ type: "setVariant", clientId: variant.clientId, key, value });

  return (
    <View style={styles.variantPanel}>
      <View style={styles.variantHeader}>
        <Text style={styles.itemTitle}>{variant.variantName || `Variant ${index + 1}`}</Text>
        <Button title="Remove" tone="danger" disabled={!canRemove} onPress={() => dispatch({ type: "removeVariant", clientId: variant.clientId })} style={styles.compactButton} />
      </View>
      <Field keyboardType="decimal-pad" label="Selling price (INR) *" value={variant.price} onChangeText={(value) => update("price", value)} error={errors[`variant.${variant.clientId}.price`]} />
      <Field keyboardType="decimal-pad" label="MRP (INR)" value={variant.mrp} onChangeText={(value) => update("mrp", value)} error={errors[`variant.${variant.clientId}.mrp`]} />
      <Field keyboardType="number-pad" label="Stock quantity" value={variant.stock} onChangeText={(value) => update("stock", value)} error={errors[`variant.${variant.clientId}.stock`]} />
      <Field label="SKU" value={variant.sku} onChangeText={(value) => update("sku", value)} />
      <Field label="Variant name" value={variant.variantName} onChangeText={(value) => update("variantName", value)} placeholder="Auto uses size/color if blank" />
      <SelectField
        label="Variant status"
        options={[{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }]}
        selectedValue={variant.status}
        onSelect={(value) => update("status", value)}
      />
      {fields.map((field) => (
        <DynamicField
          key={`${variant.clientId}-${field.fieldKey}`}
          field={field}
          value={variant.attributes[field.fieldKey] ?? ""}
          error={errors[`variant.${variant.clientId}.attribute.${field.fieldKey}`]}
          onChange={(value) =>
            dispatch({ type: "setVariantAttribute", clientId: variant.clientId, key: field.fieldKey, value })
          }
        />
      ))}
      <Field keyboardType="number-pad" label="Weight g" value={variant.packageWeightGrams} onChangeText={(value) => update("packageWeightGrams", value)} />
      <Field keyboardType="number-pad" label="Length cm" value={variant.packageLengthCm} onChangeText={(value) => update("packageLengthCm", value)} />
      <Field keyboardType="number-pad" label="Breadth cm" value={variant.packageBreadthCm} onChangeText={(value) => update("packageBreadthCm", value)} />
      <Field keyboardType="number-pad" label="Height cm" value={variant.packageHeightCm} onChangeText={(value) => update("packageHeightCm", value)} />
    </View>
  );
}

function ImageRow({
  image,
  index,
  total,
  dispatch,
}: {
  image: ProductImageFormValue;
  index: number;
  total: number;
  dispatch: Dispatch<ProductFormAction>;
}) {
  const uri = resolveProductImageUri(image);
  return (
    <View style={styles.imageRow}>
      {uri ? (
        <Image source={{ uri }} style={styles.previewImage} />
      ) : (
        <View style={styles.previewFallback}>
          <Text style={styles.helperText}>No preview</Text>
        </View>
      )}
      <Field
        label={`Alt text ${index + 1}`}
        value={image.altText}
        onChangeText={(value) => dispatch({ type: "updateImage", id: image.id, patch: { altText: value } })}
      />
      <View style={styles.actionRow}>
        <Button title={image.isPrimary ? "Primary" : "Set primary"} tone="secondary" disabled={image.isPrimary} onPress={() => dispatch({ type: "setPrimaryImage", id: image.id })} style={styles.compactButton} />
        <Button title="Up" tone="secondary" disabled={index === 0} onPress={() => dispatch({ type: "moveImage", id: image.id, direction: -1 })} style={styles.compactButton} />
        <Button title="Down" tone="secondary" disabled={index === total - 1} onPress={() => dispatch({ type: "moveImage", id: image.id, direction: 1 })} style={styles.compactButton} />
        <Button title="Remove" tone="danger" onPress={() => dispatch({ type: "removeImage", id: image.id })} style={styles.compactButton} />
      </View>
    </View>
  );
}

function fieldError(state: { submitted: boolean; errors: Record<string, string> }, key: string) {
  return state.submitted ? state.errors[key] : undefined;
}

const styles = {
  fieldBlock: {
    gap: spacing.xs,
  },
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
    height: 120,
    justifyContent: "center" as const,
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
