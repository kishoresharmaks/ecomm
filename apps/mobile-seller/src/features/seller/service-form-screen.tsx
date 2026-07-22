import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../auth/mobile-seller-auth-context";
import { Button, Card, Field, Header, LoadingState, QueryErrorState, Screen, SelectField, Toast } from "../../components/screen";
import { colors, spacing } from "../../theme";
import { launchSellerImageLibraryAsync } from "./image-picker";
import { uploadPublicSellerImage } from "./mobile-upload";
import {
  createSellerService,
  getSellerProfile,
  getSellerService,
  listCategories,
  updateSellerService,
  type CategorySummary,
  type ServiceVisitMode,
} from "./seller-api";
import {
  buildServicePayload,
  createServiceForm,
  servicePaymentModeOptions,
  servicePricingModelOptions,
  serviceVisitModeOptions,
  type ServiceFormValues,
} from "./service-operations";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };

export function SellerServiceFormScreen({ serviceId }: { serviceId?: string }) {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ServiceFormValues>(() => createServiceForm());
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const editing = Boolean(serviceId);

  const profileQuery = useQuery({
    queryKey: ["seller-profile", auth.authKey, "service-form"],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
  });
  const categoriesQuery = useQuery({
    queryKey: ["seller-categories", "service-form"],
    queryFn: () => listCategories(auth.authHeaders),
    enabled: auth.enabled,
    staleTime: 5 * 60 * 1000,
  });
  const serviceQuery = useQuery({
    queryKey: ["seller-service", auth.authKey, serviceId],
    queryFn: () => getSellerService(auth.authHeaders, serviceId ?? ""),
    enabled: auth.enabled && Boolean(serviceId),
  });

  useEffect(() => {
    if (!editing && profileQuery.data) {
      const defaults = createServiceForm(null, profileQuery.data);
      setValues((current) => ({
        ...current,
        areaLabel: current.areaLabel || defaults.areaLabel,
        areaPincode: current.areaPincode || defaults.areaPincode,
        areaRadiusKm: current.areaRadiusKm || defaults.areaRadiusKm,
      }));
    }
  }, [editing, profileQuery.data]);

  useEffect(() => {
    if (serviceQuery.data) {
      setValues(createServiceForm(serviceQuery.data, profileQuery.data));
    }
  }, [profileQuery.data, serviceQuery.data]);

  const categories = useMemo(() => flattenCategories(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const categoryOptions = useMemo(
    () => [{ label: "Select category", value: "" }, ...categories.map((category) => ({ label: category.name, value: category.id }))],
    [categories],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = buildServicePayload(values);
      return serviceId ? updateSellerService(auth.authHeaders, serviceId, payload) : createSellerService(auth.authHeaders, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller-services", auth.authKey] }),
        queryClient.invalidateQueries({ queryKey: ["seller-service", auth.authKey, serviceId] }),
      ]);
      setToast({
        visible: true,
        message: editing ? "Service changes submitted for approval." : "Service submitted for approval.",
        type: "success",
      });
      router.replace("/(tabs)/services" as Href);
    },
    onError: (error) => {
      setToast({ visible: true, message: error instanceof Error ? error.message : "Service could not be saved.", type: "error" });
    },
  });

  if (!auth.enabled || categoriesQuery.isLoading || serviceQuery.isLoading) {
    return <LoadingState message="Preparing service form..." />;
  }

  if (categoriesQuery.isError || serviceQuery.isError) {
    const error = categoriesQuery.error ?? serviceQuery.error;
    return (
      <Screen>
        <Header title={editing ? "Edit service" : "Add service"} subtitle="Create approval-ready service details." />
        <QueryErrorState
          title="Service form could not be loaded"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => {
            void categoriesQuery.refetch();
            void serviceQuery.refetch();
          }}
          retrying={categoriesQuery.isFetching || serviceQuery.isFetching}
        />
      </Screen>
    );
  }

  const sellerTaxRegistrationStatus =
    profileQuery.data?.profile?.taxRegistrationStatus ??
    (profileQuery.data?.profile?.gstNumber ? "GST_REGISTERED" : "NOT_REGISTERED");
  const sacRequired =
    values.taxClassification === "TAXABLE" ||
    values.taxClassification === "NIL_RATED";
  const gstRate = Number(values.gstRatePercent);
  const canSubmit = Boolean(
    values.categoryId &&
      values.title.trim() &&
      values.description.trim().length >= 10 &&
      (!sacRequired || /^\d{6}$/.test(values.sacCode.trim())) &&
      (values.taxClassification !== "TAXABLE" ||
        sellerTaxRegistrationStatus !== "GST_REGISTERED" ||
        (Number.isFinite(gstRate) && gstRate > 0 && gstRate <= 100)),
  );

  return (
    <Screen contentContainerStyle={styles.content}>
      <Header
        title={editing ? "Edit service" : "Add service"}
        subtitle={editing ? "Update service details and send changes for marketplace review." : "Create a service listing with pricing, coverage, and customer-ready content."}
      />

      <Card>
        <SelectField
          label="Category"
          options={categoryOptions}
          selectedValue={values.categoryId}
          onSelect={(value) => {
            update("categoryId", value);
            const category = categories.find((item) => item.id === value);
            if (!values.sacCode && category?.defaultSacCode) {
              update("sacCode", category.defaultSacCode);
            }
          }}
        />
        <Field label="Service title" value={values.title} onChangeText={(value) => update("title", value)} placeholder="LED TV repair and installation" />
        <Field
          label="Description"
          value={values.description}
          onChangeText={(value) => update("description", value)}
          placeholder="Explain what is included, visit rules, parts, and customer requirements."
          multiline
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Service tax</Text>
        <SelectField
          label="Tax classification"
          options={[
            { label: "Taxable service", value: "TAXABLE" },
            { label: "Nil-rated service", value: "NIL_RATED" },
            { label: "Exempt service", value: "EXEMPT" },
            { label: "Non-GST service", value: "NON_GST" },
          ]}
          selectedValue={values.taxClassification}
          onSelect={(value) => {
            update("taxClassification", value as ServiceFormValues["taxClassification"]);
            if (value !== "TAXABLE") {
              update("gstRatePercent", "0");
            }
          }}
        />
        <Field
          label="SAC code"
          value={values.sacCode}
          onChangeText={(value) => update("sacCode", value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          placeholder="998719"
        />
        <Field
          label="GST rate (%)"
          value={values.gstRatePercent}
          onChangeText={(value) => update("gstRatePercent", value)}
          keyboardType="decimal-pad"
          editable={
            values.taxClassification === "TAXABLE" &&
            sellerTaxRegistrationStatus === "GST_REGISTERED"
          }
          placeholder={
            sellerTaxRegistrationStatus === "GST_REGISTERED"
              ? "18"
              : "GST cannot be collected for this seller registration"
          }
        />
        <Text style={styles.muted}>Displayed service prices are GST-inclusive.</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Pricing and terms</Text>
        <SelectField
          label="Pricing model"
          options={servicePricingModelOptions}
          selectedValue={values.pricingModel}
          onSelect={(value) => update("pricingModel", value as ServiceFormValues["pricingModel"])}
        />
        <SelectField
          label="Payment mode"
          options={servicePaymentModeOptions}
          selectedValue={values.paymentMode}
          onSelect={(value) => update("paymentMode", value as ServiceFormValues["paymentMode"])}
        />
        <SelectField
          label="Cancellation policy"
          options={[
            { label: "Flexible", value: "FLEXIBLE" },
            { label: "Moderate", value: "MODERATE" },
            { label: "Strict", value: "STRICT" },
          ]}
          selectedValue={values.cancellationPolicy}
          onSelect={(value) => update("cancellationPolicy", value as ServiceFormValues["cancellationPolicy"])}
        />
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Base price" value={values.basePrice} onChangeText={(value) => update("basePrice", value)} keyboardType="decimal-pad" placeholder="999" />
          </View>
          <View style={styles.column}>
            <Field label="Inspection fee" value={values.inspectionFee} onChangeText={(value) => update("inspectionFee", value)} keyboardType="decimal-pad" placeholder="299" />
          </View>
        </View>
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Advance amount" value={values.advanceAmount} onChangeText={(value) => update("advanceAmount", value)} keyboardType="decimal-pad" placeholder="500" />
          </View>
          <View style={styles.column}>
            <Field label="Duration minutes" value={values.serviceDurationMinutes} onChangeText={(value) => update("serviceDurationMinutes", value)} keyboardType="number-pad" />
          </View>
        </View>
        <Field label="Quote valid hours" value={values.quoteTtlHours} onChangeText={(value) => update("quoteTtlHours", value)} keyboardType="number-pad" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Visit modes</Text>
        <View style={styles.chipRow}>
          {serviceVisitModeOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => toggleVisitMode(option.value)}
              style={[styles.visitChip, values.allowedVisitModes.includes(option.value) ? styles.visitChipActive : null]}
            >
              <Text style={[styles.visitChipText, values.allowedVisitModes.includes(option.value) ? styles.visitChipTextActive : null]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Service image</Text>
        <Text style={styles.muted}>{values.imageUrl ? `Image key: ${values.imageUrl}` : "Upload a clear service cover image."}</Text>
        <Button title={uploading ? "Uploading..." : "Upload image"} tone="secondary" loading={uploading} onPress={() => void pickAndUploadImage()} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Package</Text>
        <Field label="Package name" value={values.packageName} onChangeText={(value) => update("packageName", value)} placeholder="Standard inspection" />
        <Field label="Package description" value={values.packageDescription} onChangeText={(value) => update("packageDescription", value)} multiline />
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Package price" value={values.packagePrice} onChangeText={(value) => update("packagePrice", value)} keyboardType="decimal-pad" />
          </View>
          <View style={styles.column}>
            <Field label="MRP" value={values.packageMrp} onChangeText={(value) => update("packageMrp", value)} keyboardType="decimal-pad" />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Coverage</Text>
        <Field label="Area label" value={values.areaLabel} onChangeText={(value) => update("areaLabel", value)} placeholder="Salem doorstep radius" />
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Pincode" value={values.areaPincode} onChangeText={(value) => update("areaPincode", value)} keyboardType="number-pad" />
          </View>
          <View style={styles.column}>
            <Field label="Radius km" value={values.areaRadiusKm} onChangeText={(value) => update("areaRadiusKm", value)} keyboardType="number-pad" />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Customer content</Text>
        <Field label="Highlights" value={values.highlights} onChangeText={(value) => update("highlights", value)} multiline placeholder={"Doorstep diagnosis\nSame-day visit when available"} />
        <Field label="Inclusions" value={values.inclusions} onChangeText={(value) => update("inclusions", value)} multiline placeholder={"Diagnosis\nRepair estimate"} />
        <Field label="Exclusions" value={values.exclusions} onChangeText={(value) => update("exclusions", value)} multiline placeholder={"Replacement parts billed separately"} />
        <Field label="Requirements" value={values.requirements} onChangeText={(value) => update("requirements", value)} multiline placeholder={"Customer must share product model"} />
      </Card>

      <Button
        title={mutation.isPending ? "Submitting..." : editing ? "Submit changes" : "Submit service"}
        disabled={!canSubmit || mutation.isPending}
        loading={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((current) => ({ ...current, visible: false }))} />
    </Screen>
  );

  function update<K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleVisitMode(mode: ServiceVisitMode) {
    setValues((current) => {
      const exists = current.allowedVisitModes.includes(mode);
      const next = exists ? current.allowedVisitModes.filter((item) => item !== mode) : [...current.allowedVisitModes, mode];
      return { ...current, allowedVisitModes: next.length ? next : ["CUSTOMER_LOCATION"] };
    });
  }

  async function pickAndUploadImage() {
    setUploading(true);
    try {
      const result = await launchSellerImageLibraryAsync({ quality: 0.82 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) {
        return;
      }
      const uploaded = await uploadPublicSellerImage(auth.authHeaders, {
        uri: asset.uri,
        name: asset.fileName ?? `service-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        sizeBytes: asset.fileSize,
      }, "SELLER_PRODUCT_IMAGE");
      update("imageUrl", uploaded.assetKey);
    } catch (error) {
      setToast({ visible: true, message: error instanceof Error ? error.message : "Image upload failed.", type: "error" });
    } finally {
      setUploading(false);
    }
  }
}

function flattenCategories(categories: CategorySummary[]): CategorySummary[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  twoColumn: {
    flexDirection: "row",
    gap: spacing.md,
  },
  column: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  visitChip: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  visitChipActive: {
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
  },
  visitChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  visitChipTextActive: {
    color: colors.primary,
  },
});
