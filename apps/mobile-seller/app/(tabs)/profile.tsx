import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, CollapsibleSection, Field, LoadingState, Screen, StatusChip, Toast } from "../../src/components/screen";
import { launchSellerImageLibraryAsync } from "../../src/features/seller/image-picker";
import { uploadPublicSellerImage, uploadSellerPrivateDocument, type MobileUploadFile } from "../../src/features/seller/mobile-upload";
import { buildSellerPayoutProfilePayload } from "../../src/features/seller/profile-payout";
import { validateSellerContactPhone } from "../../src/features/seller/profile-validation";
import {
  getSellerProfile,
  updateSellerProfile,
  type SellerDocumentType,
  type SellerVerificationDocumentPayload,
} from "../../src/features/seller/seller-api";
import { colors, spacing } from "../../src/theme";

type FieldErrors = {
  storeName?: string;
  contactEmail?: string;
  contactPhone?: string;
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

  const [fields, setFields] = useState({
    storeName: "",
    description: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    businessLegalName: "",
    businessType: "",
    gstNumber: "",
    panNumber: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    logoUrl: null as string | null,
    bannerUrl: null as string | null,
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
  });

  const [documents, setDocuments] = useState<SellerVerificationDocumentPayload[]>([]);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });

  const hasUnsavedChanges = useMemo(() => {
    if (!profileQuery.data) return false;
    const current = fields;
    const original = profileQuery.data;

    return (
      current.storeName !== (original.storeName ?? "") ||
      current.description !== (original.description ?? "") ||
      current.contactName !== (original.profile?.contactName ?? "") ||
      current.contactPhone !== (original.profile?.contactPhone ?? "") ||
      current.contactEmail !== (original.profile?.contactEmail ?? "") ||
      current.businessLegalName !== (original.profile?.businessLegalName ?? "") ||
      current.businessType !== (original.profile?.businessType ?? "") ||
      current.gstNumber !== (original.profile?.gstNumber ?? "") ||
      current.panNumber !== (original.profile?.panNumber ?? "") ||
      current.line1 !== (original.addresses?.[0]?.line1 ?? "") ||
      current.line2 !== (original.addresses?.[0]?.line2 ?? "") ||
      current.city !== (original.addresses?.[0]?.city ?? "") ||
      current.state !== (original.addresses?.[0]?.state ?? "") ||
      current.pincode !== (original.addresses?.[0]?.pincode ?? "") ||
      current.logoUrl !== (original.logoUrl ?? null) ||
      current.bannerUrl !== (original.bannerUrl ?? null) ||
      current.accountHolderName !== (original.payoutProfile?.accountHolderName ?? "") ||
      current.bankName !== (original.payoutProfile?.bankName ?? "") ||
      current.ifscCode !== (original.payoutProfile?.ifscCode ?? "") ||
      current.accountNumber.trim() !== "" ||
      current.upiId !== "" ||
      documents.length > 0
    );
  }, [documents.length, fields, profileQuery.data]);

  const storeInitials = useMemo(() => initials(fields.storeName || profileQuery.data?.storeName || "Seller"), [fields.storeName, profileQuery.data?.storeName]);
  const payoutState = profileQuery.data?.payoutProfile?.isVerified
    ? "Verified"
    : profileQuery.data?.payoutProfile
      ? "Saved"
      : "Not added";
  const addressState = fields.city || fields.pincode ? "Added" : "Missing";
  const mediaState = fields.logoUrl && fields.bannerUrl ? "Complete" : fields.logoUrl || fields.bannerUrl ? "Partial" : "Missing";

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields]);

  useEffect(() => {
    if (profileQuery.data) {
      const payout = profileQuery.data.payoutProfile;
      setFields({
        storeName: profileQuery.data.storeName ?? "",
        description: profileQuery.data.description ?? "",
        contactName: profileQuery.data.profile?.contactName ?? "",
        contactPhone: profileQuery.data.profile?.contactPhone ?? "",
        contactEmail: profileQuery.data.profile?.contactEmail ?? "",
        businessLegalName: profileQuery.data.profile?.businessLegalName ?? "",
        businessType: profileQuery.data.profile?.businessType ?? "",
        gstNumber: profileQuery.data.profile?.gstNumber ?? "",
        panNumber: profileQuery.data.profile?.panNumber ?? "",
        line1: profileQuery.data.addresses?.[0]?.line1 ?? "",
        line2: profileQuery.data.addresses?.[0]?.line2 ?? "",
        city: profileQuery.data.addresses?.[0]?.city ?? "",
        state: profileQuery.data.addresses?.[0]?.state ?? "",
        pincode: profileQuery.data.addresses?.[0]?.pincode ?? "",
        logoUrl: profileQuery.data.logoUrl ?? null,
        bannerUrl: profileQuery.data.bannerUrl ?? null,
        accountHolderName: payout?.accountHolderName ?? "",
        bankName: payout?.bankName ?? "",
        accountNumber: "",
        ifscCode: payout?.ifscCode ?? "",
        upiId: "",
      });
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
      const payoutProfile = buildSellerPayoutProfilePayload(fields);
      return updateSellerProfile(auth.authHeaders, {
        storeName: fields.storeName,
        description: fields.description,
        contactName: fields.contactName,
        contactPhone: fields.contactPhone,
        contactEmail: fields.contactEmail,
        businessLegalName: fields.businessLegalName,
        businessType: fields.businessType,
        gstNumber: fields.gstNumber,
        panNumber: fields.panNumber,
        address: {
          line1: fields.line1,
          line2: fields.line2,
          city: fields.city,
          state: fields.state,
          pincode: fields.pincode,
          country: "India",
          countryCode: "IN",
        },
        logoUrl: fields.logoUrl,
        bannerUrl: fields.bannerUrl,
        ...(payoutProfile ? { payoutProfile } : {}),
        documents,
      });
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
            <Text style={styles.bannerText}>{fields.bannerUrl ? "Banner ready" : "Store banner"}</Text>
          </View>
          <View style={styles.heroBody}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>{storeInitials}</Text>
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
          <Field label="GST number" value={fields.gstNumber} onChangeText={(value) => updateField("gstNumber", value)} autoCapitalize="characters" />
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
          disabled={mutation.isPending || !fields.storeName.trim() || !auth.enabled}
          title={mutation.isPending ? "Saving..." : hasUnsavedChanges ? "Save profile" : "Saved"}
          onPress={() => mutation.mutate()}
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
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  bannerPreview: {
    minHeight: 96,
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
    borderRadius: 8,
    borderWidth: 3,
    height: 64,
    justifyContent: "center",
    marginTop: -40,
    width: 64,
  },
  logoText: {
    color: colors.surface,
    fontSize: 20,
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
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
  },
  heroSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  statusRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
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
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 88,
    padding: spacing.md,
  },
  insightDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    width: 8,
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
