import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../../../../src/components/screen";
import { useMobileCustomerAuth } from "../../../../src/auth/mobile-auth-context";
import { B2BAuthGate } from "../../../../src/features/b2b/b2b-auth-gate";
import { MobileApiError } from "../../../../src/lib/api";
import {
  createB2BEnquiry,
  getB2BProfile,
  searchB2BProducts,
  searchB2BStores,
} from "../../../../src/lib/mobile-b2b-api";
import type { ProductSummary } from "../../../../src/types/storefront";
import type { MobileStore } from "../../../../src/types/mobile-home";
import { colors, spacing } from "../../../../src/theme";

function B2BNewEnquiryContent() {
  const customerAuth = useMobileCustomerAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // URL params pre-populate selections (deep-link from product/store screen).
  // Read at the top because initial useState values reference them.
  const params = useLocalSearchParams<{
    productId?: string;
    sellerId?: string;
    productName?: string;
    sellerName?: string;
  }>();

  // ─── Initial values computed from URL params ───────────────────────────────
  // Computed synchronously before useState so they can be used as initial values.
  // params is stable on the first render with Expo Router.
  const _initialProduct: ProductSummary | null =
    params.productId && params.productName
      ? {
          id: params.productId,
          name: params.productName,
          sellerId: params.sellerId ?? "",
          ...(params.sellerName ? { seller: { storeName: params.sellerName } } : {}),
          slug: "",
          description: "",
          status: "",
          approvalStatus: "",
          categoryId: "",
          images: [],
          variants: [],
        }
      : null;

  const _initialSeller: MobileStore | null =
    !params.productId && params.sellerId && params.sellerName
      ? { id: params.sellerId, storeName: params.sellerName, slug: "" }
      : null;

  // ─── Product picker state ─────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(_initialProduct);
  const [productSearchActive, setProductSearchActive] = useState(false);
  const productDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");

  // ─── Seller picker state (only shown when no product selected) ────────────
  const [sellerSearch, setSellerSearch] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<MobileStore | null>(_initialSeller);
  const [sellerSearchActive, setSellerSearchActive] = useState(false);
  const sellerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSellerSearch, setDebouncedSellerSearch] = useState("");

  // ─── Form state ───────────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);

  // ─── Product debounce ─────────────────────────────────────────────────────
  const handleProductSearchChange = useCallback((text: string) => {
    setProductSearch(text);
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    productDebounceRef.current = setTimeout(() => {
      setDebouncedProductSearch(text.trim());
    }, 300);
  }, []);

  // ─── Seller debounce ──────────────────────────────────────────────────────
  const handleSellerSearchChange = useCallback((text: string) => {
    setSellerSearch(text);
    if (sellerDebounceRef.current) clearTimeout(sellerDebounceRef.current);
    sellerDebounceRef.current = setTimeout(() => {
      setDebouncedSellerSearch(text.trim());
    }, 300);
  }, []);

  // ─── Product search query ─────────────────────────────────────────────────
  const productQuery = useQuery({
    queryKey: ["b2b-product-search", debouncedProductSearch],
    queryFn: () => searchB2BProducts(debouncedProductSearch, 20),
    enabled: productSearchActive && debouncedProductSearch.length >= 1,
    staleTime: 15_000,
  });

  // ─── Seller search query ──────────────────────────────────────────────────
  const sellerQuery = useQuery({
    queryKey: ["b2b-seller-search", debouncedSellerSearch],
    queryFn: () => searchB2BStores(debouncedSellerSearch, 20),
    enabled: sellerSearchActive && !selectedProduct && debouncedSellerSearch.length >= 1,
    staleTime: 15_000,
  });

  // ─── Profile gate ─────────────────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ["b2b-profile", customerAuth.authKey],
    queryFn: () => getB2BProfile(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: (failureCount, error) =>
      !(error instanceof MobileApiError && [401, 403, 404].includes(error.status)) &&
      failureCount < 1,
  });

  const isPendingReview =
    profileQuery.data &&
    (profileQuery.data.status === "PENDING" || profileQuery.data.status === "UNDER_REVIEW");

  // ─── Submit mutation ──────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => {
      // Product takes precedence; sellerId is dropped when productId is set.
      const productId = selectedProduct?.id;
      const sellerId = productId ? undefined : selectedSeller?.id;
      return createB2BEnquiry(customerAuth.authHeaders, {
        ...(productId ? { productId } : {}),
        ...(sellerId ? { sellerId } : {}),
        quantity: parseInt(quantity, 10) || 1,
        message: message.trim(),
      });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["b2b-enquiries", customerAuth.authKey] });
      router.replace(`/account/b2b/enquiries/${data.id}` as never);
    },
    onError: (error) => {
      if (error instanceof MobileApiError && error.status === 429) {
        setRateLimited(true);
        setSubmitError("Too many requests. Please wait a moment and try again.");
      } else {
        setSubmitError(error instanceof Error ? error.message : "Could not create enquiry.");
      }
    },
  });

  function validate() {
    const errors: Record<string, string> = {};
    const qty = parseInt(quantity, 10);
    if (!quantity || isNaN(qty) || qty < 1) errors.quantity = "Quantity must be at least 1.";
    if (!message.trim()) errors.message = "Message is required.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    setSubmitError("");
    setRateLimited(false);
    if (!validate()) return;
    createMutation.mutate();
  }

  // ─── Profile missing (404) ────────────────────────────────────────────────
  if (
    profileQuery.isError &&
    profileQuery.error instanceof MobileApiError &&
    profileQuery.error.status === 404
  ) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: "New Enquiry" }} />
        <View style={styles.gateWrap}>
          <Text style={styles.gateHeading}>Business profile required</Text>
          <Text style={styles.gateBody}>
            Complete your business profile to send B2B enquiries.
          </Text>
          <Pressable
            style={styles.gateBtn}
            onPress={() => router.replace("/account/b2b/profile" as never)}
          >
            <Text style={styles.gateBtnText}>Set up profile</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ─── Derived display values ───────────────────────────────────────────────
  const productChipLabel = selectedProduct
    ? selectedProduct.seller?.storeName
      ? `${selectedProduct.name} — ${selectedProduct.seller.storeName}`
      : selectedProduct.name
    : null;

  const sellerChipLabel = selectedSeller ? selectedSeller.storeName : null;
  const productResults = productQuery.data?.items ?? [];
  const sellerResults = sellerQuery.data ?? [];
  const isFormDisabled = createMutation.isPending || Boolean(isPendingReview) || rateLimited;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: true, title: "New B2B Enquiry" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Pending-review banner ── */}
          {isPendingReview ? (
            <View style={styles.pendingBanner}>
              <Text style={styles.pendingTitle}>Profile under review</Text>
              <Text style={styles.pendingBody}>
                Your business profile is under review. Enquiries will be enabled once approved.
              </Text>
            </View>
          ) : null}

          {/* ── Product picker ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Product</Text>
            <Text style={styles.fieldHint}>
              Select a product for a product-specific enquiry, or leave empty for a general seller
              enquiry.
            </Text>

            {productChipLabel ? (
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {productChipLabel}
                  </Text>
                </View>
                <Pressable
                  style={styles.chipClear}
                  onPress={() => {
                    setSelectedProduct(null);
                    setProductSearch("");
                    setDebouncedProductSearch("");
                  }}
                  accessibilityLabel="Clear product selection"
                >
                  <Text style={styles.chipClearText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <TextInput
                editable={!isFormDisabled}
                onChangeText={handleProductSearchChange}
                onFocus={() => setProductSearchActive(true)}
                placeholder="Search products by name…"
                placeholderTextColor={colors.muted}
                style={styles.fieldInput}
                value={productSearch}
                returnKeyType="search"
              />
            )}

            {productSearchActive && !selectedProduct && debouncedProductSearch.length >= 1 ? (
              <View style={styles.dropdown}>
                {productQuery.isLoading ? (
                  <View style={styles.dropdownLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : productResults.length === 0 ? (
                  <View style={styles.dropdownEmpty}>
                    <Text style={styles.dropdownEmptyText}>No products found.</Text>
                  </View>
                ) : (
                  productResults.map((product) => (
                    <Pressable
                      key={product.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setSelectedProduct(product);
                        setProductSearch("");
                        setDebouncedProductSearch("");
                        setProductSearchActive(false);
                        // Clear seller when product is chosen
                        setSelectedSeller(null);
                        setSellerSearch("");
                        setDebouncedSellerSearch("");
                      }}
                    >
                      <Text style={styles.dropdownItemName} numberOfLines={1}>
                        {product.name}
                      </Text>
                      {product.seller?.storeName ? (
                        <Text style={styles.dropdownItemSub} numberOfLines={1}>
                          {product.seller.storeName}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </View>

          {/* ── Seller picker (only when no product selected) ── */}
          {!selectedProduct ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Seller / Store</Text>
              <Text style={styles.fieldHint}>
                For a general procurement enquiry with a specific seller.
              </Text>

              {sellerChipLabel ? (
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {sellerChipLabel}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.chipClear}
                    onPress={() => {
                      setSelectedSeller(null);
                      setSellerSearch("");
                      setDebouncedSellerSearch("");
                    }}
                    accessibilityLabel="Clear seller selection"
                  >
                    <Text style={styles.chipClearText}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <TextInput
                  editable={!isFormDisabled}
                  onChangeText={handleSellerSearchChange}
                  onFocus={() => setSellerSearchActive(true)}
                  placeholder="Search stores by name…"
                  placeholderTextColor={colors.muted}
                  style={styles.fieldInput}
                  value={sellerSearch}
                  returnKeyType="search"
                />
              )}

              {sellerSearchActive && !selectedSeller && debouncedSellerSearch.length >= 1 ? (
                <View style={styles.dropdown}>
                  {sellerQuery.isLoading ? (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : sellerResults.length === 0 ? (
                    <View style={styles.dropdownEmpty}>
                      <Text style={styles.dropdownEmptyText}>No sellers found.</Text>
                    </View>
                  ) : (
                    sellerResults.map((store) => (
                      <Pressable
                        key={store.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedSeller(store);
                          setSellerSearch("");
                          setDebouncedSellerSearch("");
                          setSellerSearchActive(false);
                        }}
                      >
                        <Text style={styles.dropdownItemName} numberOfLines={1}>
                          {store.storeName}
                        </Text>
                        {store.addresses?.[0]?.city ? (
                          <Text style={styles.dropdownItemSub} numberOfLines={1}>
                            {store.addresses[0].city}
                            {store.addresses[0].state ? `, ${store.addresses[0].state}` : ""}
                          </Text>
                        ) : null}
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Context summary ── */}
          <View style={styles.contextBanner}>
            <Text style={styles.contextLabel}>Enquiry for</Text>
            <Text style={styles.contextName} numberOfLines={2}>
              {productChipLabel ?? sellerChipLabel ?? "General enquiry (no product or seller)"}
            </Text>
          </View>

          {/* ── Quantity ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Quantity *</Text>
            <TextInput
              editable={!isFormDisabled}
              keyboardType="number-pad"
              onChangeText={setQuantity}
              placeholder="1"
              placeholderTextColor={colors.muted}
              style={[styles.fieldInput, fieldErrors.quantity ? styles.fieldInputError : null]}
              value={quantity}
            />
            {fieldErrors.quantity ? (
              <Text style={styles.fieldError}>{fieldErrors.quantity}</Text>
            ) : null}
          </View>

          {/* ── Message ── */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Message *</Text>
            <TextInput
              editable={!isFormDisabled}
              multiline
              numberOfLines={5}
              onChangeText={setMessage}
              placeholder="Describe your procurement requirement, specifications, delivery timeline, etc."
              placeholderTextColor={colors.muted}
              style={[
                styles.fieldInput,
                styles.messageInput,
                fieldErrors.message ? styles.fieldInputError : null,
              ]}
              textAlignVertical="top"
              value={message}
            />
            {fieldErrors.message ? (
              <Text style={styles.fieldError}>{fieldErrors.message}</Text>
            ) : null}
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <Pressable
            disabled={isFormDisabled}
            style={[styles.submitBtn, isFormDisabled && styles.submitBtnDisabled]}
            onPress={handleSubmit}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isPendingReview ? "Awaiting profile approval" : "Send enquiry"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function B2BNewEnquiryScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "New B2B Enquiry" }} />
      <B2BAuthGate>
        <B2BNewEnquiryContent />
      </B2BAuthGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Gate
  gateWrap: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  gateHeading: { color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "center" },
  gateBody: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  gateBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  gateBtnText: { color: "#fff", fontWeight: "700" },

  // Pending banner
  pendingBanner: {
    backgroundColor: "#FFF9E6",
    borderColor: colors.warning + "66",
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
  },
  pendingTitle: { color: colors.warning, fontSize: 14, fontWeight: "700" },
  pendingBody: { color: "#7A5C00", fontSize: 13, lineHeight: 18, marginTop: 4 },

  // Field
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  fieldHint: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  fieldInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    padding: spacing.md,
  },
  messageInput: { height: 120 },
  fieldInputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12 },

  // Chip
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.primary + "15",
    borderColor: colors.primary + "55",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  chipText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  chipClear: {
    alignItems: "center",
    backgroundColor: colors.border,
    borderRadius: 20,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  chipClearText: { color: colors.ink, fontSize: 14, fontWeight: "700" },

  // Dropdown
  dropdown: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 240,
    overflow: "hidden",
  },
  dropdownLoading: { alignItems: "center", padding: spacing.md },
  dropdownEmpty: { alignItems: "center", padding: spacing.md },
  dropdownEmptyText: { color: colors.muted, fontSize: 13 },
  dropdownItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dropdownItemName: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  dropdownItemSub: { color: colors.muted, fontSize: 12, marginTop: 2 },

  // Context summary
  contextBanner: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
  },
  contextLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  contextName: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 4 },

  // Submit
  submitError: { color: colors.danger, fontSize: 14, textAlign: "center" },
  submitBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
