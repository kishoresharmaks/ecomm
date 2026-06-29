import {
  CheckmarkCircle02Icon,
  Home01Icon,
  InformationCircleIcon,
  Location01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { RemoteImage } from "../../src/components/remote-image";
import { Screen } from "../../src/components/screen";
import { MobileAddressForm, emptyMobileAddressForm } from "../../src/components/mobile-address-form";
import { useMobileCustomerAuth } from "../../src/auth/mobile-auth-context";
import { accountErrorMessage, RetryState } from "../../src/features/account/account-ui";
import { listCustomerAddresses, type MobileCustomerAddress } from "../../src/features/storefront/storefront-api";
import {
  clearServiceBookingDraft,
  readServiceBookingDraft,
  saveServiceBookingDraft,
} from "../../src/features/services/service-booking-draft-store";
import { serviceKeys } from "../../src/features/services/service-query-keys";
import { formatPaiseLocal, InfoLine } from "../../src/features/services/service-ui";
import { createCustomerServiceBooking, getPublicService } from "../../src/features/services/services-api";
import type {
  MobileServiceAddressSnapshot,
  MobileServiceBookingFormValues,
  MobileServiceDetail,
  MobileVisitMode,
} from "../../src/features/services/types";
import { getPricingLabel } from "../../src/features/services/utils/pricingLabel";
import { cleanBookingPayload } from "../../src/features/services/utils/payloadCleaners";
import { useLocationStore } from "../../src/state/location-store";
import { colors } from "../../src/theme";

const timeSlots = ["09:00-11:00", "11:00-13:00", "14:00-16:00", "16:00-18:00"];

export default function ServiceDetailScreen() {
  const params = useLocalSearchParams<{ restoreBookingForm?: string; slug?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const restoreBookingForm = Array.isArray(params.restoreBookingForm) ? params.restoreBookingForm[0] : params.restoreBookingForm;
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const customerAuth = useMobileCustomerAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const locationKey = locationKeyFor(selectedLocation);
  const [formError, setFormError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [form, setForm] = useState<MobileServiceBookingFormValues | null>(null);
  const [manualAddressOpen, setManualAddressOpen] = useState(false);

  const serviceQuery = useQuery({
    queryKey: serviceKeys.detail(slug ?? "", locationKey),
    queryFn: () => getPublicService(slug ?? "", selectedLocation),
    enabled: Boolean(slug),
  });
  const addressesQuery = useQuery({
    queryKey: ["mobile-account-addresses", customerAuth.authKey],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
  });

  useEffect(() => {
    if (!slug || !serviceQuery.data || form) {
      return;
    }
    const draft = readServiceBookingDraft(slug);
    setForm(draft ?? defaultForm(serviceQuery.data));
    if (draft && restoreBookingForm === "true") {
      setSuccessNotice("You're signed in. Review your details and confirm booking.");
    }
  }, [form, restoreBookingForm, serviceQuery.data, slug]);

  const service = serviceQuery.data;
  const selectedPackage = useMemo(() => {
    if (!service || !form?.selectedPackageId) {
      return null;
    }
    return service.packages.find((item) => item.id === form.selectedPackageId) ?? null;
  }, [form?.selectedPackageId, service]);

  const bookingMutation = useMutation({
    mutationFn: (values: MobileServiceBookingFormValues) => createCustomerServiceBooking(customerAuth.authHeaders, cleanBookingPayload(values)),
    onSuccess: async (booking) => {
      if (slug) {
        clearServiceBookingDraft(slug);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-service-bookings", customerAuth.authKey] }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.detail(booking.serviceSlug, locationKey) }),
      ]);
      router.replace(`/account/service-bookings/${booking.bookingNumber}` as never);
    },
    onError: (error) => setFormError(accountErrorMessage(error, "Service booking could not be created.")),
  });

  if (!slug) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Service" }} />
        <Text style={styles.stateText}>Service not found.</Text>
      </Screen>
    );
  }

  if (serviceQuery.isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: "Service" }} />
        <RetryState
          title="Service could not load"
          message={accountErrorMessage(serviceQuery.error, "Check your connection and refresh service detail.")}
          onRetry={() => void serviceQuery.refetch()}
        />
      </>
    );
  }

  if (serviceQuery.isLoading || !service || !form) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "Service" }} />
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading service...</Text>
        </View>
      </Screen>
    );
  }

  function updateForm(patch: Partial<MobileServiceBookingFormValues>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setFormError("");
  }

  function submitBooking() {
    if (!form || !service) {
      return;
    }
    if (!customerAuth.enabled) {
      saveServiceBookingDraft(service.slug, form);
      router.push(`/auth/sign-in?returnTo=/services/${service.slug}&restoreBookingForm=true` as never);
      return;
    }
    setFormError("");
    bookingMutation.mutate(form);
  }

  const addresses = addressesQuery.data ?? [];
  const cta = service.pricingModel === "quote_first" ? "Request Quote" : "Book Now";

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: service.name }} />
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <RemoteImage fallbackLabel={service.name} uri={service.coverImageUrl} style={styles.heroImage} />
            <View style={styles.heroBody}>
              <Text style={styles.kicker}>{service.categoryName ?? "Service"}</Text>
              <Text style={styles.title}>{service.name}</Text>
              <Text style={styles.subtitle}>{service.sellerName ?? "Verified provider"}</Text>
              <Text style={styles.priceText}>{getPricingLabel(service, selectedPackage)}</Text>
              {service.serviceRating ? (
                <InfoLine icon={StarIcon} text={`${service.serviceRating.toFixed(1)} rating · ${service.serviceReviewCount} reviews`} />
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About this service</Text>
            <Text style={styles.bodyText}>{service.description}</Text>
            {service.pricingModel === "quote_first" ? (
              <Notice text="A provider will send you a quote after reviewing your request." />
            ) : null}
            {service.pricingModel === "inspection_fee" ? (
              <Notice text="Final price depends on inspection outcome." />
            ) : null}
          </View>

          {service.packages.length ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Packages</Text>
              {service.packages.map((pkg) => (
                <SelectableRow
                  key={pkg.id}
                  active={form.selectedPackageId === pkg.id}
                  title={pkg.name}
                  subtitle={pkg.description ?? "Service package"}
                  trailing={pkg.pricePaise !== null ? formatPaiseLocal(pkg.pricePaise, pkg.currency) : "Quoted"}
                  onPress={() => updateForm({ selectedPackageId: pkg.id })}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Book service</Text>
            {successNotice ? <Text style={styles.successNotice}>{successNotice}</Text> : null}

            {service.visitModes.length > 1 ? (
              <View style={styles.segmentWrap}>
                {service.visitModes.map((mode) => (
                  <Pressable
                    key={mode}
                    style={[styles.segment, form.visitMode === mode ? styles.segmentActive : null]}
                    onPress={() => updateForm({ visitMode: mode, savedAddressId: null, addressSnapshot: null })}
                  >
                    <Text style={[styles.segmentText, form.visitMode === mode ? styles.segmentTextActive : null]}>{visitModeLabel(mode)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {form.visitMode === "provider_location" ? (
              <Notice text="You'll need to visit the provider's location. Address will be shared after booking is confirmed." />
            ) : null}
            {form.visitMode === "remote" ? <Notice text="This service can be handled remotely. No address is required." /> : null}

            {form.visitMode === "customer_location" ? (
              <View>
                <Text style={styles.fieldLabel}>Service location</Text>
                {customerAuth.enabled && addresses.length ? (
                  <View style={styles.addressList}>
                    {addresses.map((address) => (
                      <AddressOption
                        key={address.id}
                        active={form.savedAddressId === address.id}
                        address={address}
                        onPress={() => updateForm({ savedAddressId: address.id, addressSnapshot: null })}
                      />
                    ))}
                  </View>
                ) : customerAuth.enabled ? (
                  <Notice text="No saved address found. Enter a one-time service address below." />
                ) : (
                  <Notice text="Sign in to use saved addresses, or enter a one-time address now." />
                )}
                <Pressable style={styles.secondaryButton} onPress={() => {
                  setManualAddressOpen((open) => !open);
                  updateForm({ savedAddressId: null, addressSnapshot: form.addressSnapshot ?? addressFormToSnapshot(emptyMobileAddressForm()) });
                }}>
                  <Text style={styles.secondaryButtonText}>{manualAddressOpen ? "Hide manual address" : "Enter manual address"}</Text>
                </Pressable>
                {manualAddressOpen && form.addressSnapshot ? (
                  <MobileAddressForm
                    showDefaultToggle={false}
                    value={snapshotToAddressForm(form.addressSnapshot)}
                    onChange={(value) => updateForm({ savedAddressId: null, addressSnapshot: addressFormToSnapshot(value) })}
                  />
                ) : null}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Preferred date</Text>
            <TextInput placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={form.preferredDate ?? ""} onChangeText={(value) => updateForm({ preferredDate: value || null })} />

            <Text style={styles.fieldLabel}>Preferred time</Text>
            <View style={styles.segmentWrap}>
              {timeSlots.map((slot) => (
                <Pressable key={slot} style={[styles.segment, form.preferredTimeSlot === slot ? styles.segmentActive : null]} onPress={() => updateForm({ preferredTimeSlot: slot })}>
                  <Text style={[styles.segmentText, form.preferredTimeSlot === slot ? styles.segmentTextActive : null]}>{slot}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Describe the issue</Text>
            <TextInput
              multiline
              placeholder="Tell the provider what you need help with"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textArea]}
              value={form.customerIssue}
              onChangeText={(value) => updateForm({ customerIssue: value })}
            />

            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              multiline
              placeholder="Optional note"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.noteArea]}
              value={form.customerNote ?? ""}
              onChangeText={(value) => updateForm({ customerNote: value || null })}
            />

            {service.serviceability && !service.serviceability.serviceable ? (
              <View style={styles.warningBanner}>
                <HugeiconsIcon color={colors.warning} icon={InformationCircleIcon} size={20} strokeWidth={2.1} />
                <Text style={styles.warningText}>This service may not be available at the selected location. You can still submit - a provider will confirm availability.</Text>
              </View>
            ) : null}

            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            <Pressable disabled={bookingMutation.isPending} style={[styles.primaryButton, bookingMutation.isPending ? styles.buttonDisabled : null]} onPress={submitBooking}>
              {bookingMutation.isPending ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{cta}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </Screen>
    </>
  );
}

function defaultForm(service: MobileServiceDetail): MobileServiceBookingFormValues {
  return {
    idempotencyKey: createMobileServiceBookingIdempotencyKey(service.slug),
    serviceSlug: service.slug,
    selectedPackageId: service.packages[0]?.id ?? null,
    visitMode: service.visitModes[0] ?? "customer_location",
    savedAddressId: null,
    addressSnapshot: null,
    preferredDate: null,
    preferredTimeSlot: null,
    customerIssue: "",
    customerNote: null,
  };
}

function createMobileServiceBookingIdempotencyKey(serviceSlug: string) {
  const safeSlug = serviceSlug.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 36) || "service";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `mobile_service_${safeSlug}_${timestamp}_${random}`;
}

function SelectableRow({ active, onPress, subtitle, title, trailing }: { active: boolean; onPress: () => void; subtitle: string; title: string; trailing: string }) {
  return (
    <Pressable style={[styles.selectableRow, active ? styles.selectableRowActive : null]} onPress={onPress}>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.rowTrailing}>{trailing}</Text>
      {active ? <HugeiconsIcon color={colors.primary} icon={CheckmarkCircle02Icon} size={20} strokeWidth={2.2} /> : null}
    </Pressable>
  );
}

function AddressOption({ active, address, onPress }: { active: boolean; address: MobileCustomerAddress; onPress: () => void }) {
  return (
    <Pressable style={[styles.addressOption, active ? styles.selectableRowActive : null]} onPress={onPress}>
      <HugeiconsIcon color={colors.primary} icon={Home01Icon} size={21} strokeWidth={2.1} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{address.label || address.fullName}</Text>
        <Text style={styles.rowSubtitle}>{[address.line1, address.area, address.city, address.pincode].filter(Boolean).join(", ")}</Text>
      </View>
    </Pressable>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View style={styles.notice}>
      <HugeiconsIcon color={colors.primary} icon={Location01Icon} size={18} strokeWidth={2} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function visitModeLabel(mode: MobileVisitMode) {
  if (mode === "customer_location") return "At your location";
  if (mode === "provider_location") return "Provider location";
  return "Remote";
}

function addressFormToSnapshot(value: ReturnType<typeof emptyMobileAddressForm>): MobileServiceAddressSnapshot {
  return {
    label: value.label ?? null,
    fullName: value.fullName,
    phone: value.phone,
    line1: value.line1,
    line2: value.line2 ?? null,
    area: value.area ?? null,
    city: value.city,
    state: value.state,
    pincode: value.pincode,
    country: value.country ?? "India",
    countryCode: value.countryCode ?? "IN",
    stateCode: value.stateCode ?? null,
    cityCode: value.cityCode ?? null,
    localAreaCode: value.localAreaCode ?? null,
    latitude: value.latitude ?? null,
    longitude: value.longitude ?? null,
  };
}

function snapshotToAddressForm(snapshot: MobileServiceAddressSnapshot) {
  return emptyMobileAddressForm({
    label: snapshot.label ?? "Home",
    fullName: snapshot.fullName,
    phone: snapshot.phone,
    line1: snapshot.line1,
    line2: snapshot.line2 ?? "",
    area: snapshot.area ?? "",
    city: snapshot.city,
    state: snapshot.state,
    pincode: snapshot.pincode,
    country: snapshot.country,
    countryCode: snapshot.countryCode,
    stateCode: snapshot.stateCode ?? null,
    cityCode: snapshot.cityCode ?? null,
    localAreaCode: snapshot.localAreaCode ?? null,
    latitude: snapshot.latitude ?? null,
    longitude: snapshot.longitude ?? null,
    isDefault: false,
  });
}

function locationKeyFor(location: { countryCode?: string; stateCode?: string; cityCode?: string; localAreaCode?: string; pincode?: string }) {
  return [location.countryCode, location.stateCode, location.cityCode, location.localAreaCode, location.pincode].filter(Boolean).join(":") || null;
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 120,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  stateText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
    textAlign: "center",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroImage: {
    height: 190,
    width: "100%",
  },
  heroBody: {
    padding: 16,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },
  priceText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 15,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  bodyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  notice: {
    alignItems: "flex-start",
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 11,
  },
  noticeText: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  selectableRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 12,
  },
  selectableRowActive: {
    backgroundColor: "#FFF2EE",
    borderColor: colors.primary,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  rowTrailing: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  segment: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  segmentActive: {
    backgroundColor: "#FFF2EE",
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  segmentTextActive: {
    color: colors.primary,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFCFB",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  noteArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  addressList: {
    gap: 8,
  },
  addressOption: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  warningBanner: {
    alignItems: "flex-start",
    backgroundColor: "#FFF7D6",
    borderRadius: 8,
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    padding: 12,
  },
  warningText: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },
  successNotice: {
    backgroundColor: "#ECFDF3",
    borderRadius: 8,
    color: "#047857",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 12,
    padding: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    marginTop: 14,
    minHeight: 50,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
});
