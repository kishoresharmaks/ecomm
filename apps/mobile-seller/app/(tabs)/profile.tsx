import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, CollapsibleSection, ConfirmDialog, Field, LoadingState, Screen, SelectField, StatusChip, Toast } from "../../src/components/screen";
import { launchSellerImageLibraryAsync } from "../../src/features/seller/image-picker";
import { uploadPublicSellerImage, uploadSellerPrivateDocument, type MobileUploadFile } from "../../src/features/seller/mobile-upload";
import {
  buildSellerProfilePatchPayload,
  emptySellerProfileFormFields,
  hasSellerProfileUnsavedChanges,
  sellerProfileToFormFields,
} from "../../src/features/seller/profile-save-payload";
import { validateSellerContactPhone } from "../../src/features/seller/profile-validation";
import {
  SELLER_TAX_REGISTRATION_OPTIONS,
  normalizeGstin,
  validateGstin,
} from "../../src/features/seller/seller-tax";
import {
  getSellerProfile,
  updateSellerProfile,
  type SellerDocumentType,
  type SellerVerificationDocumentPayload,
} from "../../src/features/seller/seller-api";
import { Image } from "expo-image";
import { resolvePublicImageUri } from "../../src/lib/api";
import { colors, spacing } from "../../src/theme";
type FieldErrors = {
  storeName?: string;
  contactEmail?: string;
  contactPhone?: string;
  gstNumber?: string;
};

type ToastState = { visible: boolean; message: string; type: "success" | "error" };

export default function SellerProfileScreen() {
  const auth = useMobileSellerAuth();
  const clerk = useAuth();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  const profileQuery = useQuery({
    queryKey: ["seller-profile", auth.authKey],
    queryFn: () => getSellerProfile(auth.authHeaders),
    enabled: auth.enabled,
  });

  const [fields, setFields] = useState(emptySellerProfileFormFields);

  const [documents, setDocuments] = useState<SellerVerificationDocumentPayload[]>([]);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showTaxChangeWarning, setShowTaxChangeWarning] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });

  const hasUnsavedChanges = useMemo(() => {
    return hasSellerProfileUnsavedChanges(profileQuery.data, fields, documents.length);
  }, [documents.length, fields, profileQuery.data]);

  const storeInitials = useMemo(() => initials(fields.storeName || profileQuery.data?.storeName || "Seller"), [fields.storeName, profileQuery.data?.storeName]);
  const payoutState = profileQuery.data?.payoutProfile?.isVerified
    ? "Verified"
    : profileQuery.data?.payoutProfile
      ? "Saved"
      : "Not added";
  const addressState = fields.city || fields.pincode ? "Added" : "Missing";
  const mediaState = fields.logoUrl && fields.bannerUrl ? "Complete" : fields.logoUrl || fields.bannerUrl ? "Partial" : "Missing";
  const taxIdentityChanged = useMemo(() => {
    if (!profileQuery.data) return false;
    const original = sellerProfileToFormFields(profileQuery.data);
    return (
      fields.taxRegistrationStatus !== original.taxRegistrationStatus ||
      normalizeGstin(fields.gstNumber) !== normalizeGstin(original.gstNumber) ||
      documents.some((document) => document.documentType === "GST_CERTIFICATE")
    );
  }, [documents, fields.gstNumber, fields.taxRegistrationStatus, profileQuery.data]);

  const dismissToast = useCallback(() => setToast((current) => ({ ...current, visible: false })), []);

  const validateForm = useCallback(() => {
    const newErrors: FieldErrors = {};

    if (!fields.storeName.trim()) {
      newErrors.storeName = "Store name is required";
    }

    if (fields.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contactEmail)) {
      newErrors.contactEmail = "Invalid email format";
    }

    const phoneError = validateSellerContactPhone(fields.contactPhone);
    if (phoneError) {
      newErrors.contactPhone = phoneError;
    }

    const gstError = validateGstin(fields.taxRegistrationStatus, fields.gstNumber);
    if (gstError) {
      newErrors.gstNumber = gstError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields]);

  useEffect(() => {
    if (profileQuery.data) {
      setFields(sellerProfileToFormFields(profileQuery.data));
    }
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!auth.enabled) {
        throw new Error("Authentication not ready. Please try again.");
      }
      if (!validateForm()) {
        throw new Error("Please fix validation errors before saving.");
      }
      const currentProfile = profileQuery.data;
      if (!currentProfile) {
        throw new Error("Profile is still loading. Please try again.");
      }
      return updateSellerProfile(
        auth.authHeaders,
        buildSellerProfilePatchPayload(currentProfile, fields, documents),
      );
    },
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ["seller-profile", auth.authKey] });
      });
      setDocuments([]);
      setToast({ visible: true, message: "Profile saved successfully.", type: "success" });
      setErrors({});
    },
    onError: (error: Error) => {
      setToast({ visible: true, message: error.message || "Failed to save profile.", type: "error" });
    },
  });

  const updateField = useCallback(<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }, [errors]);

  const uploadLogo = useCallback(async () => {
    setUploadingSection("logo");
    try {
      const result = await launchSellerImageLibraryAsync({ quality: 0.82, allowsEditing: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: MobileUploadFile = {
          uri: asset.uri,
          name: asset.fileName ?? `seller-logo-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
          sizeBytes: asset.fileSize,
        };
        const uploaded = await uploadPublicSellerImage(auth.authHeaders, file, "SELLER_LOGO");
        updateField("logoUrl", uploaded.assetKey);
        setToast({ visible: true, message: "Logo uploaded. Save profile to publish it.", type: "success" });
      }
    } catch (error) {
      setToast({ visible: true, message: uploadErrorMessage(error, "Failed to upload logo. Please try again."), type: "error" });
    } finally {
      setUploadingSection(null);
    }
  }, [auth.authHeaders, updateField]);

  const uploadBanner = useCallback(async () => {
    setUploadingSection("banner");
    try {
      const result = await launchSellerImageLibraryAsync({ quality: 0.82, allowsEditing: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: MobileUploadFile = {
          uri: asset.uri,
          name: asset.fileName ?? `seller-banner-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
          sizeBytes: asset.fileSize,
        };
        const uploaded = await uploadPublicSellerImage(auth.authHeaders, file, "SELLER_BANNER");
        updateField("bannerUrl", uploaded.assetKey);
        setToast({ visible: true, message: "Banner uploaded. Save profile to publish it.", type: "success" });
      }
    } catch (error) {
      setToast({ visible: true, message: uploadErrorMessage(error, "Failed to upload banner. Please try again."), type: "error" });
    } finally {
      setUploadingSection(null);
    }
  }, [auth.authHeaders, updateField]);

  const uploadDocument = useCallback(async (documentType: SellerDocumentType) => {
    setUploadingSection(documentType);
    try {
      const result = await pickDocument({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }
      const asset = result.assets[0];
      const file: MobileUploadFile = {
        uri: asset.uri,
        name: asset.name ?? `document-${Date.now()}`,
        mimeType: asset.mimeType ?? "application/pdf",
        sizeBytes: asset.size,
      };
      const uploaded = await uploadSellerPrivateDocument(auth.authHeaders, file, documentType);
      setDocuments((current) => [...current.filter((document) => document.documentType !== documentType), { documentType, fileUrl: uploaded.assetKey }]);
      setToast({ visible: true, message: `${documentLabel(documentType)} uploaded. Save profile to submit it.`, type: "success" });
    } catch (error) {
      setToast({ visible: true, message: uploadErrorMessage(error, "Failed to upload document. Please try again."), type: "error" });
    } finally {
      setUploadingSection(null);
    }
  }, [auth.authHeaders]);

  if (!auth.enabled || profileQuery.isLoading) {
    return <LoadingState message="Loading profile..." />;
  }

  return (
    <Screen scroll={false} contentContainerStyle={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.bannerPreview}>
            {fields.bannerUrl ? (
              <Image source={{ uri: resolvePublicImageUri(fields.bannerUrl) ?? "" }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Text style={styles.bannerText}>Store banner</Text>
            )}
          </View>
          <View style={styles.heroBody}>
            <View style={styles.logoMark}>
              {fields.logoUrl ? (
                <Image source={{ uri: resolvePublicImageUri(fields.logoUrl) ?? "" }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Text style={styles.logoText}>{storeInitials}</Text>
              )}
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Seller profile</Text>
              <Text numberOfLines={2} style={styles.heroTitle}>{fields.storeName || "Store profile"}</Text>
              <Text numberOfLines={2} style={styles.heroSubtitle}>
                {fields.description || "Keep store identity, verification, contact, and payout details production-ready."}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <StatusChip label={profileQuery.data?.status ?? "SELLER"} tone={profileQuery.data?.status === "APPROVED" ? "success" : "warning"} />
            {hasUnsavedChanges ? <Text style={styles.unsavedPill}>Unsaved changes</Text> : <Text style={styles.savedPill}>All changes saved</Text>}
          </View>
        </View>

        <View style={styles.insightGrid}>
          <ProfileInsight label="Media" value={mediaState} tone={mediaState === "Complete" ? "success" : "warning"} />
          <ProfileInsight label="Payout" value={payoutState} tone={payoutState === "Verified" ? "success" : payoutState === "Saved" ? "info" : "warning"} />
          <ProfileInsight label="Address" value={addressState} tone={addressState === "Added" ? "success" : "warning"} />
          <ProfileInsight label="Documents" value={documents.length ? `${documents.length} staged` : "Optional"} tone={documents.length ? "success" : "info"} />
        </View>

        <CollapsibleSection title="Account & Subscription" defaultOpen>
          <Text style={styles.helperText}>Manage your active seller plan.</Text>
          <Button
            tone="secondary"
            title="Manage Subscription"
            onPress={() => router.push("/subscription")}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Storefront identity" defaultOpen>
          <Field label="Store name *" value={fields.storeName} onChangeText={(value) => updateField("storeName", value)} error={errors.storeName} />
          <Field label="Description" value={fields.description} onChangeText={(value) => updateField("description", value)} multiline numberOfLines={4} />
          <View style={styles.uploadGrid}>
            <UploadTile
              title={fields.logoUrl ? "Replace logo" : "Upload logo"}
              subtitle={fields.logoUrl ? "Logo selected" : "Square store mark"}
              active={Boolean(fields.logoUrl)}
              loading={uploadingSection === "logo"}
              onPress={uploadLogo}
            />
            <UploadTile
              title={fields.bannerUrl ? "Replace banner" : "Upload banner"}
              subtitle={fields.bannerUrl ? "Banner selected" : "Wide storefront image"}
              active={Boolean(fields.bannerUrl)}
              loading={uploadingSection === "banner"}
              onPress={uploadBanner}
            />
          </View>
        </CollapsibleSection>

        <CollapsibleSection title="Contact information" defaultOpen>
          <Field label="Contact name" value={fields.contactName} onChangeText={(value) => updateField("contactName", value)} />
          <Field keyboardType="phone-pad" label="Contact phone" value={fields.contactPhone} onChangeText={(value) => updateField("contactPhone", value)} error={errors.contactPhone} />
          <Field keyboardType="email-address" label="Contact email" value={fields.contactEmail} onChangeText={(value) => updateField("contactEmail", value)} autoCapitalize="none" error={errors.contactEmail} />
        </CollapsibleSection>

        <CollapsibleSection title="Business details">
          <Field label="Business legal name" value={fields.businessLegalName} onChangeText={(value) => updateField("businessLegalName", value)} />
          <Field label="Business type" value={fields.businessType} onChangeText={(value) => updateField("businessType", value)} />
          <SelectField
            label="GST registration"
            options={SELLER_TAX_REGISTRATION_OPTIONS}
            selectedValue={fields.taxRegistrationStatus}
            onSelect={(value) => {
              updateField("taxRegistrationStatus", value as typeof fields.taxRegistrationStatus);
              if (value === "NOT_REGISTERED") updateField("gstNumber", "");
            }}
          />
          {fields.taxRegistrationStatus !== "NOT_REGISTERED" ? (
            <Field
              label="GSTIN"
              value={fields.gstNumber}
              onChangeText={(value) => updateField("gstNumber", value.toUpperCase())}
              autoCapitalize="characters"
              maxLength={15}
              error={errors.gstNumber}
            />
          ) : null}
          {profileQuery.data?.status === "APPROVED" ? (
            <Text style={styles.warningText}>
              Changes to GST registration, GSTIN, or the GST certificate may return your seller account and affected listings for verification.
            </Text>
          ) : null}
          <Field label="PAN number" value={fields.panNumber} onChangeText={(value) => updateField("panNumber", value)} autoCapitalize="characters" />
        </CollapsibleSection>

        <CollapsibleSection title="Business address">
          <Field label="Address line 1" value={fields.line1} onChangeText={(value) => updateField("line1", value)} />
          <Field label="Address line 2" value={fields.line2} onChangeText={(value) => updateField("line2", value)} />
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Field label="City" value={fields.city} onChangeText={(value) => updateField("city", value)} />
            </View>
            <View style={styles.column}>
              <Field label="State" value={fields.state} onChangeText={(value) => updateField("state", value)} />
            </View>
          </View>
          <Field keyboardType="number-pad" label="Pincode" value={fields.pincode} onChangeText={(value) => updateField("pincode", value)} />
        </CollapsibleSection>

        <CollapsibleSection title="Payout profile">
          <Text style={styles.helperText}>Banking details are used only for seller settlements. Saved account and UPI values stay masked.</Text>
          <Field
            label="Account holder name"
            value={fields.accountHolderName}
            onChangeText={(value) => updateField("accountHolderName", value)}
            placeholder={profileQuery.data?.payoutProfile?.accountHolderName ?? "Enter account holder name"}
          />
          <Field
            label="Bank name"
            value={fields.bankName}
            onChangeText={(value) => updateField("bankName", value)}
            placeholder={profileQuery.data?.payoutProfile?.bankName ?? "Enter bank name"}
          />
          <Field
            label="Account number"
            value={fields.accountNumber}
            onChangeText={(value) => updateField("accountNumber", value)}
            secureTextEntry
            placeholder={profileQuery.data?.payoutProfile?.maskedAccountNumber ? `Saved: ${profileQuery.data.payoutProfile.maskedAccountNumber}` : "Enter account number"}
          />
          <Field
            label="IFSC code"
            value={fields.ifscCode}
            onChangeText={(value) => updateField("ifscCode", value)}
            autoCapitalize="characters"
            placeholder={profileQuery.data?.payoutProfile?.ifscCode ?? "Enter IFSC code"}
          />
          <Field
            label="UPI ID"
            value={fields.upiId}
            onChangeText={(value) => updateField("upiId", value)}
            autoCapitalize="none"
            placeholder={profileQuery.data?.payoutProfile?.maskedUpiId ? `Saved: ${profileQuery.data.payoutProfile.maskedUpiId}` : "e.g., yourname@upi"}
          />
          {profileQuery.data?.payoutProfile?.isVerified ? <Text style={styles.successText}>Payout details verified</Text> : null}
        </CollapsibleSection>

        <CollapsibleSection title="Verification documents">
          <Text style={styles.helperText}>Upload current business documents for faster admin review.</Text>
          <DocumentUploadButton type="GST_CERTIFICATE" uploadingSection={uploadingSection} onPress={uploadDocument} />
          <DocumentUploadButton type="PAN_CARD" uploadingSection={uploadingSection} onPress={uploadDocument} />
          <DocumentUploadButton type="BUSINESS_REGISTRATION" uploadingSection={uploadingSection} onPress={uploadDocument} />
          {documents.map((document) => (
            <Text key={document.documentType} style={styles.successText}>
              {documentLabel(document.documentType)} staged for save
            </Text>
          ))}
        </CollapsibleSection>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          disabled={mutation.isPending || !fields.storeName.trim() || !auth.enabled || !hasUnsavedChanges}
          title={mutation.isPending ? "Saving..." : hasUnsavedChanges ? "Save profile" : "Saved"}
          onPress={() => {
            if (profileQuery.data?.status === "APPROVED" && taxIdentityChanged) {
              setShowTaxChangeWarning(true);
              return;
            }
            mutation.mutate();
          }}
          loading={mutation.isPending}
          style={styles.saveButton}
        />
        <Button
          tone="secondary"
          title="Sign out"
          onPress={() => {
            void clerk.signOut();
            router.replace("/auth/sign-in");
          }}
          style={styles.signOutButton}
        />
      </View>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={dismissToast} />
      <ConfirmDialog
        visible={showTaxChangeWarning}
        title="Submit GST changes for verification?"
        message="Your seller account and affected listings may require verification before they are active again."
        cancelLabel="Review changes"
        confirmLabel="Submit changes"
        onCancel={() => setShowTaxChangeWarning(false)}
        onConfirm={() => {
          setShowTaxChangeWarning(false);
          mutation.mutate();
        }}
      />
    </Screen>
  );
}

function ProfileInsight({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" }) {
  return (
    <View style={styles.insight}>
      <View style={[styles.insightDot, tone === "success" ? styles.dotSuccess : tone === "warning" ? styles.dotWarning : null]} />
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

function UploadTile({
  active,
  loading,
  onPress,
  subtitle,
  title,
}: {
  active: boolean;
  loading: boolean;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={loading} onPress={onPress} style={[styles.uploadTile, active ? styles.uploadTileActive : null, loading ? styles.disabledTile : null]}>
      <Text style={styles.uploadTitle}>{loading ? "Uploading..." : title}</Text>
      <Text style={styles.uploadSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function DocumentUploadButton({
  onPress,
  type,
  uploadingSection,
}: {
  onPress: (type: SellerDocumentType) => void;
  type: SellerDocumentType;
  uploadingSection: string | null;
}) {
  const loading = uploadingSection === type;
  return (
    <Button
      tone="secondary"
      title={loading ? "Uploading..." : `Upload ${documentLabel(type).toLowerCase()}`}
      onPress={() => onPress(type)}
      loading={loading}
    />
  );
}

function documentLabel(type: SellerDocumentType) {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "SL";
  const second = parts[1];
  const letters = second ? `${first.charAt(0)}${second.charAt(0)}` : first.slice(0, 2);
  return letters.toUpperCase();
}

function uploadErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (message.includes("ExpoDocumentPicker") || message.includes("native module")) {
    return "Document picker is not available in this app build. Rebuild the Expo dev app after installing expo-document-picker.";
  }
  return message || fallback;
}

async function pickDocument(options: Parameters<typeof import("expo-document-picker").getDocumentAsync>[0]) {
  const DocumentPicker = await import("expo-document-picker");
  return DocumentPicker.getDocumentAsync(options);
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    gap: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  content: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  bannerPreview: {
    minHeight: 120,
    justifyContent: "flex-end",
    padding: spacing.lg,
    backgroundColor: colors.ink,
  },
  bannerText: {
    alignSelf: "flex-start",
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroBody: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: 12,
    borderWidth: 4,
    height: 80,
    justifyContent: "center",
    marginTop: -52,
    width: 80,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  logoText: {
    color: colors.surface,
    fontSize: 24,
    fontWeight: "900",
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  statusRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.softSurface,
  },
  unsavedPill: {
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    color: "#92400E",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  savedPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  insight: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 96,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  dotSuccess: {
    backgroundColor: colors.success,
  },
  dotWarning: {
    backgroundColor: colors.warning,
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  insightValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  uploadGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  uploadTile: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    justifyContent: "center",
    padding: spacing.md,
  },
  uploadTileActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#86EFAC",
    borderStyle: "solid",
  },
  disabledTile: {
    opacity: 0.65,
  },
  uploadTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  uploadSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  twoColumn: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  column: {
    flex: 1,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  successText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
  },
  warningText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  bottomBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  saveButton: {
    flex: 1.3,
  },
  signOutButton: {
    flex: 1,
  },
});
