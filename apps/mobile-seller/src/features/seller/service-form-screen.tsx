import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMobileSellerAuth } from "../../auth/mobile-seller-auth-context";
import { OperationsHeader } from "../../components/operations-ui";
import { Button, Field, Header, LoadingState, QueryErrorState, Screen, SelectField, Toast } from "../../components/screen";
import { resolvePublicImageUri } from "../../lib/api";
import { colors, spacing } from "../../theme";
import { launchSellerImageLibraryAsync } from "./image-picker";
import { uploadPublicSellerImage } from "./mobile-upload";
import {
  createSellerService,
  getSellerProfile,
  getSellerService,
  listCategories,
  searchSacMaster,
  updateSellerService,
  type CategorySummary,
  type ServiceVisitMode,
} from "./seller-api";
import {
  buildServicePayload,
  createServiceForm,
  manualSacCode,
  sacCodeFromMaster,
  servicePaymentModeOptions,
  servicePricingModelOptions,
  serviceVisitModeOptions,
  type ServiceFormValues,
} from "./service-operations";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };
const SERVICE_FORM_STEPS = ["Basics", "Pricing and tax", "Availability", "Customer details"] as const;

export function SellerServiceFormScreen({ serviceId }: { serviceId?: string }) {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [values, setValues] = useState<ServiceFormValues>(() => createServiceForm());
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sacSearch, setSacSearch] = useState("");
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const editing = Boolean(serviceId);
  const isTablet = width >= 700;

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
      const next = createServiceForm(serviceQuery.data, profileQuery.data);
      setValues(next);
      setSacSearch(next.sacCode);
    }
  }, [profileQuery.data, serviceQuery.data]);

  const deferredSacSearch = useDeferredValue(sacSearch.trim());
  const sacQuery = useQuery({
    queryKey: ["sac-master", auth.authKey, deferredSacSearch],
    queryFn: () => searchSacMaster(auth.authHeaders, { search: deferredSacSearch, limit: 8 }),
    enabled: auth.enabled && deferredSacSearch.length >= 2,
  });

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
        <Header title={editing ? "Edit service" : "Add service"} subtitle="Create a clear customer-facing service listing." />
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

  const basicsComplete = Boolean(
    values.categoryId
    && values.title.trim()
    && values.description.trim().length >= 10,
  );
  const taxAndPriceComplete = Boolean(
    (!sacRequired || /^\d{6}$/.test(values.sacCode.trim()))
    && (
      values.taxClassification !== "TAXABLE"
      || sellerTaxRegistrationStatus !== "GST_REGISTERED"
      || (Number.isFinite(gstRate) && gstRate > 0 && gstRate <= 100)
    ),
  );
  const imageUri = resolvePublicImageUri(values.imageUrl);
  const canContinue =
    step === 0
      ? basicsComplete
      : step === 1
        ? taxAndPriceComplete
        : true;

  return (
    <Screen contentContainerStyle={styles.content}>
      <OperationsHeader
        onBack={() => router.back()}
        title={editing ? "Edit service" : "Add service"}
        subtitle={
          editing
            ? "Update the listing and submit the changes for marketplace review."
            : "Create a customer-ready service in four focused steps."
        }
      />
      <View style={styles.stepBar}>
        {SERVICE_FORM_STEPS.map((label, index) => {
          const selected = index === step;
          const complete = index < step;
          return (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (index <= step || canContinue) setStep(index);
              }}
              style={[styles.step, selected ? styles.stepSelected : null]}
            >
              <View style={[styles.stepNumber, selected || complete ? styles.stepNumberActive : null]}>
                <Text style={[styles.stepNumberText, selected || complete ? styles.stepNumberTextActive : null]}>
                  {index + 1}
                </Text>
              </View>
              <Text numberOfLines={2} style={[styles.stepLabel, selected ? styles.stepLabelSelected : null]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {step === 0 ? (
        <View style={styles.formSurface}>
          <FormSectionHeading
            title="Service basics"
            subtitle="Choose the category and write the customer-facing listing."
          />
          <SelectField
            label="Category"
            options={categoryOptions}
            selectedValue={values.categoryId}
            onSelect={(value) => {
              update("categoryId", value);
              const category = categories.find((item) => item.id === value);
              if (!values.sacCode && category?.defaultSacCode) {
                update("sacCode", category.defaultSacCode);
                setSacSearch(category.defaultSacCode);
              }
            }}
          />
          <Field
            label="Service title"
            value={values.title}
            onChangeText={(value) => update("title", value)}
            placeholder="LED TV repair and installation"
          />
          <Field
            label="Description"
            value={values.description}
            onChangeText={(value) => update("description", value)}
            placeholder="Explain what is included, visit rules, parts, and customer requirements."
            multiline
          />
          <View style={styles.imageArea}>
            {imageUri ? (
              <Image
                accessibilityLabel="Service cover image"
                contentFit="cover"
                source={{ uri: imageUri }}
                style={styles.imagePreview}
                transition={120}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderTitle}>Service cover image</Text>
                <Text style={styles.muted}>Use a clear photo that represents the work customers will book.</Text>
              </View>
            )}
            <Button
              title={imageUri ? "Replace image" : "Upload image"}
              tone="secondary"
              loading={uploading}
              onPress={() => void pickAndUploadImage()}
            />
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.formSurface}>
          <FormSectionHeading
            title="Pricing and tax"
            subtitle="Set GST-inclusive pricing, payment terms, SAC, and cancellation rules."
          />
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <SelectField
                label="Pricing model"
                options={servicePricingModelOptions}
                selectedValue={values.pricingModel}
                onSelect={(value) => update("pricingModel", value as ServiceFormValues["pricingModel"])}
              />
            </View>
            <View style={styles.column}>
              <SelectField
                label="Payment mode"
                options={servicePaymentModeOptions}
                selectedValue={values.paymentMode}
                onSelect={(value) => update("paymentMode", value as ServiceFormValues["paymentMode"])}
              />
            </View>
          </View>
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
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field label="Base price" value={values.basePrice} onChangeText={(value) => update("basePrice", value)} keyboardType="decimal-pad" placeholder="999" />
            </View>
            <View style={styles.column}>
              <Field label="Inspection fee" value={values.inspectionFee} onChangeText={(value) => update("inspectionFee", value)} keyboardType="decimal-pad" placeholder="299" />
            </View>
            <View style={styles.column}>
              <Field label="Advance amount" value={values.advanceAmount} onChangeText={(value) => update("advanceAmount", value)} keyboardType="decimal-pad" placeholder="500" />
            </View>
          </View>
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field label="Duration minutes" value={values.serviceDurationMinutes} onChangeText={(value) => update("serviceDurationMinutes", value)} keyboardType="number-pad" />
            </View>
            <View style={styles.column}>
              <Field label="Quote valid hours" value={values.quoteTtlHours} onChangeText={(value) => update("quoteTtlHours", value)} keyboardType="number-pad" />
            </View>
          </View>
          <View style={styles.divider} />
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
              if (value !== "TAXABLE") update("gstRatePercent", "0");
            }}
          />
          <Field
            label="Search SAC catalogue"
            value={sacSearch}
            onChangeText={setSacSearch}
            placeholder="Search by SAC code or service description"
          />
          {sacQuery.isFetching ? <Text style={styles.muted}>Searching SAC catalogue...</Text> : null}
          {sacQuery.isError ? (
            <Text style={styles.warning}>SAC suggestions are unavailable. Enter the six-digit code manually.</Text>
          ) : null}
          {(sacQuery.data ?? []).slice(0, 5).map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              style={styles.suggestion}
              onPress={() => {
                const sacCode = sacCodeFromMaster(entry);
                update("sacCode", sacCode);
                setSacSearch(`${sacCode} - ${entry.description}`);
              }}
            >
              <Text style={styles.suggestionCode}>{entry.sacCode}</Text>
              <Text style={styles.suggestionDescription}>{entry.description}</Text>
            </Pressable>
          ))}
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field
                label="Selected SAC code"
                value={values.sacCode}
                onChangeText={(value) => {
                  const sacCode = manualSacCode(value);
                  update("sacCode", sacCode);
                  setSacSearch(sacCode);
                }}
                keyboardType="number-pad"
                placeholder="998719"
                maxLength={6}
              />
            </View>
            <View style={styles.column}>
              <Field
                label="GST rate (%)"
                value={values.gstRatePercent}
                onChangeText={(value) => update("gstRatePercent", value)}
                keyboardType="decimal-pad"
                editable={values.taxClassification === "TAXABLE" && sellerTaxRegistrationStatus === "GST_REGISTERED"}
                placeholder={sellerTaxRegistrationStatus === "GST_REGISTERED" ? "18" : "GST cannot be collected"}
              />
            </View>
          </View>
          <Text style={styles.muted}>Displayed service prices are GST-inclusive.</Text>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.formSurface}>
          <FormSectionHeading
            title="Availability and coverage"
            subtitle="Choose where the service is delivered and the primary service area."
          />
          <Text style={styles.fieldTitle}>Visit modes</Text>
          <View style={styles.chipRow}>
            {serviceVisitModeOptions.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: values.allowedVisitModes.includes(option.value) }}
                onPress={() => toggleVisitMode(option.value)}
                style={[styles.visitChip, values.allowedVisitModes.includes(option.value) ? styles.visitChipActive : null]}
              >
                <Text style={[styles.visitChipText, values.allowedVisitModes.includes(option.value) ? styles.visitChipTextActive : null]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Area label"
            value={values.areaLabel}
            onChangeText={(value) => update("areaLabel", value)}
            placeholder="Salem doorstep radius"
          />
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field label="Pincode" value={values.areaPincode} onChangeText={(value) => update("areaPincode", value)} keyboardType="number-pad" />
            </View>
            <View style={styles.column}>
              <Field label="Radius km" value={values.areaRadiusKm} onChangeText={(value) => update("areaRadiusKm", value)} keyboardType="number-pad" />
            </View>
          </View>
          <Text style={styles.muted}>Technicians and weekly availability are managed from the service calendar after saving.</Text>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.formSurface}>
          <FormSectionHeading
            title="Package and customer details"
            subtitle="Add an optional package and clear expectations for the customer."
          />
          <Field label="Package name" value={values.packageName} onChangeText={(value) => update("packageName", value)} placeholder="Standard inspection" />
          <Field label="Package description" value={values.packageDescription} onChangeText={(value) => update("packageDescription", value)} multiline />
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field label="Package price" value={values.packagePrice} onChangeText={(value) => update("packagePrice", value)} keyboardType="decimal-pad" />
            </View>
            <View style={styles.column}>
              <Field label="MRP" value={values.packageMrp} onChangeText={(value) => update("packageMrp", value)} keyboardType="decimal-pad" />
            </View>
          </View>
          <View style={styles.divider} />
          <Field label="Highlights" value={values.highlights} onChangeText={(value) => update("highlights", value)} multiline placeholder={"Doorstep diagnosis\nSame-day visit when available"} />
          <Field label="Inclusions" value={values.inclusions} onChangeText={(value) => update("inclusions", value)} multiline placeholder={"Diagnosis\nRepair estimate"} />
          <Field label="Exclusions" value={values.exclusions} onChangeText={(value) => update("exclusions", value)} multiline placeholder={"Replacement parts billed separately"} />
          <Field label="Requirements" value={values.requirements} onChangeText={(value) => update("requirements", value)} multiline placeholder={"Customer must share product model"} />
        </View>
      ) : null}

      <View style={styles.navigation}>
        {step > 0 ? (
          <Button title="Back" tone="secondary" onPress={() => setStep((current) => current - 1)} style={styles.navigationButton} />
        ) : null}
        {step < SERVICE_FORM_STEPS.length - 1 ? (
          <Button
            title="Continue"
            disabled={!canContinue}
            onPress={() => setStep((current) => current + 1)}
            style={styles.navigationButton}
          />
        ) : (
          <Button
            title={editing ? "Submit changes" : "Submit service"}
            disabled={!canSubmit || mutation.isPending}
            loading={mutation.isPending}
            onPress={() => mutation.mutate()}
            style={styles.navigationButton}
          />
        )}
      </View>
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

function FormSectionHeading({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={styles.formHeading}>
      <Text style={styles.formTitle}>{title}</Text>
      <Text style={styles.muted}>{subtitle}</Text>
    </View>
  );
}

function flattenCategories(categories: CategorySummary[]): CategorySummary[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  stepBar: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  step: {
    alignItems: "center",
    borderRightColor: colors.border,
    borderRightWidth: 1,
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 76,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  stepSelected: {
    backgroundColor: colors.softSurface,
  },
  stepNumber: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  stepNumberActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNumberText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  stepNumberTextActive: {
    color: colors.surface,
  },
  stepLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textAlign: "center",
  },
  stepLabelSelected: {
    color: colors.primary,
  },
  formSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  formHeading: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  formTitle: {
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
  warning: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  suggestion: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  suggestionCode: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  suggestionDescription: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  responsiveFields: {
    gap: spacing.md,
  },
  responsiveFieldsTablet: {
    flexDirection: "row",
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  fieldTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
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
  imageArea: {
    gap: spacing.md,
  },
  imagePreview: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    width: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    aspectRatio: 16 / 9,
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: "center",
    padding: spacing.xl,
    width: "100%",
  },
  imagePlaceholderTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  navigation: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  navigationButton: {
    flex: 1,
    maxWidth: 280,
  },
});
