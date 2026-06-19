import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, CollapsibleSection, Field, Header, LoadingState, Screen, StatusChip, Toast } from "../../src/components/screen";
import { getSellerProfile, updateSellerProfile, type SellerVerificationDocumentPayload, type SellerDocumentType } from "../../src/features/seller/seller-api";
import { uploadPublicSellerImage, uploadSellerPrivateDocument, type MobileUploadFile } from "../../src/features/seller/mobile-upload";
import { launchSellerImageLibraryAsync } from "../../src/features/seller/image-picker";
import { buildSellerPayoutProfilePayload } from "../../src/features/seller/profile-payout";
import { validateSellerContactPhone } from "../../src/features/seller/profile-validation";

type FieldErrors = {
  storeName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

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
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({ visible: false, message: "", type: "success" });

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
      current.upiId !== ""
    );
  }, [fields, profileQuery.data]);

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
        accountNumber: "", // Never pre-fill actual account number for security
        ifscCode: payout?.ifscCode ?? "",
        upiId: "", // Never pre-fill actual UPI ID for security
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
        address: { line1: fields.line1, line2: fields.line2, city: fields.city, state: fields.state, pincode: fields.pincode, country: "India", countryCode: "IN" },
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
      setToast({ visible: true, message: "Profile saved successfully!", type: "success" });
      setErrors({});
    },
    onError: (error: Error) => {
      setToast({ visible: true, message: error.message || "Failed to save profile", type: "error" });
    },
  });

  const updateField = useCallback(<K extends keyof typeof fields>(key: K, value: typeof fields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }, [errors]);

  const uploadLogo = useCallback(async () => {
    setUploadingSection("logo");
    try {
      const result = await launchSellerImageLibraryAsync({
        quality: 0.82,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: MobileUploadFile = {
          uri: asset.uri,
          name: asset.fileName ?? `seller-logo-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
        };
        const uploaded = await uploadPublicSellerImage(auth.authHeaders, file, "SELLER_LOGO");
        updateField("logoUrl", uploaded.assetKey);
        setToast({ visible: true, message: "Logo uploaded successfully!", type: "success" });
      }
    } catch {
      setToast({ visible: true, message: "Failed to upload logo. Please try again.", type: "error" });
    } finally {
      setUploadingSection(null);
    }
  }, [auth.authHeaders, updateField]);

  const uploadBanner = useCallback(async () => {
    setUploadingSection("banner");
    try {
      const result = await launchSellerImageLibraryAsync({
        quality: 0.82,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: MobileUploadFile = {
          uri: asset.uri,
          name: asset.fileName ?? `seller-banner-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
        };
        const uploaded = await uploadPublicSellerImage(auth.authHeaders, file, "SELLER_BANNER");
        updateField("bannerUrl", uploaded.assetKey);
        setToast({ visible: true, message: "Banner uploaded successfully!", type: "success" });
      }
    } catch {
      setToast({ visible: true, message: "Failed to upload banner. Please try again.", type: "error" });
    } finally {
      setUploadingSection(null);
    }
  }, [auth.authHeaders, updateField]);

  const uploadDocument = useCallback(async (documentType: SellerDocumentType) => {
    setUploadingSection(documentType);
    try {
      const result = await DocumentPicker.getDocumentAsync({
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
      };
      const uploaded = await uploadSellerPrivateDocument(auth.authHeaders, file, documentType);
      setDocuments((current) => [...current.filter((d) => d.documentType !== documentType), { documentType, fileUrl: uploaded.assetKey }]);
      setToast({ visible: true, message: "Document uploaded successfully!", type: "success" });
    } catch {
      setToast({ visible: true, message: "Failed to upload document. Please try again.", type: "error" });
    } finally {
      setUploadingSection(null);
    }
  }, [auth.authHeaders]);

  if (!auth.enabled || profileQuery.isLoading) {
    return <LoadingState message="Loading profile..." />;
  }

  return (
    <Screen contentContainerStyle={{ gap: 16 }}>
      <Header title="Store profile" subtitle="Update seller-facing store details, contact, logo, and payout profile data." />
        
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <StatusChip label={profileQuery.data?.status ?? "SELLER"} tone={profileQuery.data?.status === "APPROVED" ? "success" : "warning"} />
            {hasUnsavedChanges && <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "800" }}>Unsaved changes</Text>}
          </View>
          
          <CollapsibleSection title="Store Details" defaultOpen>
            <Field label="Store name *" value={fields.storeName} onChangeText={(v) => updateField("storeName", v)} {...(errors.storeName ? { error: errors.storeName } : {})} />
            <Field label="Description" value={fields.description} onChangeText={(v) => updateField("description", v)} multiline numberOfLines={4} />
            
            <View style={{ gap: 8, marginTop: 8 }}>
              <Button title={uploadingSection === "logo" ? "Uploading..." : fields.logoUrl ? "Replace logo" : "Upload logo"} onPress={uploadLogo} loading={uploadingSection === "logo"} />
              <Button tone="secondary" title={uploadingSection === "banner" ? "Uploading..." : fields.bannerUrl ? "Replace banner" : "Upload banner"} onPress={uploadBanner} loading={uploadingSection === "banner"} />
              {fields.logoUrl && <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "800" }}>✓ Logo uploaded</Text>}
              {fields.bannerUrl && <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "800" }}>✓ Banner uploaded</Text>}
            </View>
          </CollapsibleSection>
        </Card>

        <CollapsibleSection title="Contact Information">
          <Field label="Contact name" value={fields.contactName} onChangeText={(v) => updateField("contactName", v)} />
          <Field keyboardType="phone-pad" label="Contact phone" value={fields.contactPhone} onChangeText={(v) => updateField("contactPhone", v)} {...(errors.contactPhone ? { error: errors.contactPhone } : {})} />
          <Field keyboardType="email-address" label="Contact email" value={fields.contactEmail} onChangeText={(v) => updateField("contactEmail", v)} autoCapitalize="none" {...(errors.contactEmail ? { error: errors.contactEmail } : {})} />
        </CollapsibleSection>

        <CollapsibleSection title="Business Details">
          <Field label="Business legal name" value={fields.businessLegalName} onChangeText={(v) => updateField("businessLegalName", v)} />
          <Field label="Business type" value={fields.businessType} onChangeText={(v) => updateField("businessType", v)} />
          <Field label="GST number" value={fields.gstNumber} onChangeText={(v) => updateField("gstNumber", v)} autoCapitalize="characters" />
          <Field label="PAN number" value={fields.panNumber} onChangeText={(v) => updateField("panNumber", v)} autoCapitalize="characters" />
        </CollapsibleSection>

        <CollapsibleSection title="Business Address">
          <Field label="Address line 1" value={fields.line1} onChangeText={(v) => updateField("line1", v)} />
          <Field label="Address line 2" value={fields.line2} onChangeText={(v) => updateField("line2", v)} />
          <Field label="City" value={fields.city} onChangeText={(v) => updateField("city", v)} />
          <Field label="State" value={fields.state} onChangeText={(v) => updateField("state", v)} />
          <Field keyboardType="number-pad" label="Pincode" value={fields.pincode} onChangeText={(v) => updateField("pincode", v)} />
        </CollapsibleSection>

        <CollapsibleSection title="Payout Profile">
          <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 12 }}>Secure banking details for seller settlements</Text>
          <Field 
            label="Account holder name" 
            value={fields.accountHolderName} 
            onChangeText={(v) => updateField("accountHolderName", v)} 
            placeholder={profileQuery.data?.payoutProfile?.accountHolderName ?? "Enter account holder name"} 
          />
          <Field 
            label="Bank name" 
            value={fields.bankName} 
            onChangeText={(v) => updateField("bankName", v)} 
            placeholder={profileQuery.data?.payoutProfile?.bankName ?? "Enter bank name"} 
          />
          <Field 
            label="Account number" 
            value={fields.accountNumber} 
            onChangeText={(v) => updateField("accountNumber", v)} 
            secureTextEntry 
            placeholder={profileQuery.data?.payoutProfile?.maskedAccountNumber ? `Saved: ${profileQuery.data.payoutProfile.maskedAccountNumber}` : "Enter account number"} 
          />
          <Field 
            label="IFSC code" 
            value={fields.ifscCode} 
            onChangeText={(v) => updateField("ifscCode", v)} 
            autoCapitalize="characters" 
            placeholder={profileQuery.data?.payoutProfile?.ifscCode ?? "Enter IFSC code"} 
          />
          <Field 
            label="UPI ID" 
            placeholder={profileQuery.data?.payoutProfile?.maskedUpiId ? `Saved: ${profileQuery.data.payoutProfile.maskedUpiId}` : "e.g., yourname@upi"} 
            value={fields.upiId} 
            onChangeText={(v) => updateField("upiId", v)} 
            autoCapitalize="none" 
          />
          {profileQuery.data?.payoutProfile?.isVerified && (
            <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "800" }}>✓ Payout details verified</Text>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Documents">
          <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 12 }}>Upload verification documents for faster approval</Text>
          <Button tone="secondary" title={uploadingSection === "GST_CERTIFICATE" ? "Uploading..." : "Upload GST certificate"} onPress={() => uploadDocument("GST_CERTIFICATE")} loading={uploadingSection === "GST_CERTIFICATE"} />
          <Button tone="secondary" title={uploadingSection === "PAN_CARD" ? "Uploading..." : "Upload PAN card"} onPress={() => uploadDocument("PAN_CARD")} loading={uploadingSection === "PAN_CARD"} />
          <Button tone="secondary" title={uploadingSection === "BUSINESS_REGISTRATION" ? "Uploading..." : "Upload business registration"} onPress={() => uploadDocument("BUSINESS_REGISTRATION")} loading={uploadingSection === "BUSINESS_REGISTRATION"} />
          {documents.map((doc) => (
            <Text key={doc.documentType} style={{ color: "#22C55E", fontSize: 12, fontWeight: "800" }}>
              ✓ {doc.documentType}: {doc.fileUrl.slice(0, 30)}...
            </Text>
          ))}
        </CollapsibleSection>

        <View style={{ gap: 12 }}>
          <Button disabled={mutation.isPending || !fields.storeName || !auth.enabled} title={mutation.isPending ? "Saving..." : "Save profile"} onPress={() => mutation.mutate()} loading={mutation.isPending} />
          
          <Button
            tone="secondary"
            title="Sign out"
            onPress={() => {
              void clerk.signOut();
              router.replace("/auth/sign-in");
            }}
          />
        </View>

        <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))} />
    </Screen>
  );
}
