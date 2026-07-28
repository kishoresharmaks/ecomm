import {
  Add01Icon,
  Archive01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Edit02Icon,
  StarIcon,
  Suit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, type Href, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import {
  OperationsEmptyState,
  OperationsFilters,
  OperationsHeader,
  OperationsInlineError,
  OperationsSearch,
} from "../../src/components/operations-ui";
import {
  Button,
  ConfirmDialog,
  Field,
  QueryErrorState,
  Screen,
  StatusChip,
  Toast,
} from "../../src/components/screen";
import {
  SERVICE_LISTING_FILTERS,
  formatOperationDate,
  formatOperationDateTime,
  operationStatus,
  primaryServiceImage,
  serviceBookingTitle,
  serviceListingQuery,
  type ServiceListingViewFilter,
} from "../../src/features/seller/operations-presentation";
import {
  archiveSellerService,
  listSellerServiceBookings,
  listSellerServiceReviews,
  listSellerServices,
  replyToSellerServiceReview,
  type SellerServiceBooking,
  type SellerServiceListing,
  type SellerServiceReview,
  type ServiceBookingStatus,
} from "../../src/features/seller/seller-api";
import {
  dueServiceAmountPaise,
  servicePriceLabel,
} from "../../src/features/seller/service-operations";
import { resolvePublicImageUri } from "../../src/lib/api";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

type ViewMode = "listings" | "jobs" | "reviews";
type JobFilter = "ALL" | ServiceBookingStatus;
type ReviewFilter = "ALL" | "VISIBLE" | "HIDDEN" | "REPLIED" | "UNREPLIED";
type ToastState = { visible: boolean; message: string; type: "success" | "error" };

const PAGE_SIZE = 24;
const TABLET_BREAKPOINT = 700;
const VIEW_OPTIONS: ReadonlyArray<{ label: string; value: ViewMode }> = [
  { label: "Listings", value: "listings" },
  { label: "Jobs", value: "jobs" },
  { label: "Reviews", value: "reviews" },
];
const JOB_FILTERS: ReadonlyArray<{ label: string; value: JobFilter }> = [
  { label: "All", value: "ALL" },
  { label: "New requests", value: "REQUESTED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Quote sent", value: "QUOTE_SENT" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];
const REVIEW_FILTERS: ReadonlyArray<{ label: string; value: ReviewFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Needs reply", value: "UNREPLIED" },
  { label: "Replied", value: "REPLIED" },
  { label: "Visible", value: "VISIBLE" },
  { label: "Hidden", value: "HIDDEN" },
];

export default function SellerServicesScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ view?: string }>();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<ViewMode>(isViewMode(params.view) ? params.view : "listings");
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listingFilter, setListingFilter] = useState<ServiceListingViewFilter>("all");
  const [jobFilter, setJobFilter] = useState<JobFilter>("ALL");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("ALL");
  const [archiveTarget, setArchiveTarget] = useState<SellerServiceListing | null>(null);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const columns = width >= TABLET_BREAKPOINT ? 2 : 1;

  useEffect(() => {
    if (isViewMode(params.view)) {
      setView(params.view);
      setSearchValue("");
      setDebouncedSearch("");
      setReplyingReviewId(null);
      setReplyBody("");
    }
  }, [params.view]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const listingApiQuery = useMemo(
    () => serviceListingQuery(listingFilter, debouncedSearch),
    [debouncedSearch, listingFilter],
  );
  const servicesQuery = useInfiniteQuery({
    queryKey: ["seller-services", auth.authKey, listingFilter, debouncedSearch],
    queryFn: ({ pageParam }) =>
      listSellerServices(auth.authHeaders, {
        ...listingApiQuery,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    enabled: auth.enabled && view === "listings",
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: false,
  });
  const jobsQuery = useInfiniteQuery({
    queryKey: ["seller-service-bookings", auth.authKey, jobFilter],
    queryFn: ({ pageParam }) =>
      listSellerServiceBookings(auth.authHeaders, {
        page: pageParam,
        limit: PAGE_SIZE,
        ...(jobFilter !== "ALL" ? { status: jobFilter } : {}),
      }),
    enabled: auth.enabled && view === "jobs",
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: false,
  });
  const reviewsQuery = useInfiniteQuery({
    queryKey: ["seller-service-reviews", auth.authKey, reviewFilter, debouncedSearch],
    queryFn: ({ pageParam }) =>
      listSellerServiceReviews(auth.authHeaders, {
        page: pageParam,
        limit: PAGE_SIZE,
        ...(reviewFilter !== "ALL" ? { status: reviewFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: auth.enabled && view === "reviews",
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    placeholderData: (previous) => previous,
    retry: false,
  });

  const services = useMemo(
    () => servicesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [servicesQuery.data?.pages],
  );
  const jobs = useMemo(
    () => jobsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [jobsQuery.data?.pages],
  );
  const reviews = useMemo(
    () => reviewsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [reviewsQuery.data?.pages],
  );

  const archiveMutation = useMutation({
    mutationFn: (serviceId: string) => archiveSellerService(auth.authHeaders, serviceId),
    onSuccess: async () => {
      setToast({ visible: true, message: "Service archived.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-services", auth.authKey] });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Service could not be archived.",
        type: "error",
      });
    },
  });
  const replyMutation = useMutation({
    mutationFn: ({ body, reviewId }: { body: string; reviewId: string }) =>
      replyToSellerServiceReview(auth.authHeaders, reviewId, { body }),
    onSuccess: async () => {
      setReplyingReviewId(null);
      setReplyBody("");
      setToast({ visible: true, message: "Review reply posted.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-service-reviews", auth.authKey] });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Review reply could not be posted.",
        type: "error",
      });
    },
  });

  if (!auth.enabled) {
    return <ServiceLoadingPanel message="Preparing service workspace..." />;
  }

  const activeQuery =
    view === "listings"
      ? servicesQuery
      : view === "jobs"
        ? jobsQuery
        : reviewsQuery;
  const activeCount =
    view === "listings"
      ? servicesQuery.data?.pages[0]?.total ?? services.length
      : view === "jobs"
        ? jobsQuery.data?.pages[0]?.total ?? jobs.length
        : reviewsQuery.data?.pages[0]?.total ?? reviews.length;
  const updating =
    activeQuery.isFetching
    && !activeQuery.isFetchingNextPage
    && !refreshing
    && activeCount > 0;

  async function refreshActiveView() {
    setRefreshing(true);
    try {
      await activeQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const commonHeader = (
    <ServiceWorkspaceHeader
      countLabel={updating ? "Updating service workspace..." : countLabel(view, activeCount)}
      error={activeQuery.isError && activeQuery.data ? activeQuery.error : null}
      jobFilter={jobFilter}
      listingFilter={listingFilter}
      onJobFilterChange={setJobFilter}
      onListingFilterChange={setListingFilter}
      onRetry={() => {
        void activeQuery.refetch();
      }}
      onReviewFilterChange={setReviewFilter}
      onSearchChange={setSearchValue}
      onViewChange={changeView}
      reviewFilter={reviewFilter}
      searchValue={searchValue}
      view={view}
    />
  );

  return (
    <Screen scroll={false} contentContainerStyle={styles.screen}>
      {view === "listings" ? (
        <FlatList
          key={`service-listings-${columns}`}
          data={services}
          keyExtractor={(service) => service.id}
          numColumns={columns}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            services.length === 0 ? styles.emptyListContent : null,
          ]}
          {...(columns > 1 ? { columnWrapperStyle: styles.columnRow } : {})}
          refreshControl={refreshControl(refreshing, refreshActiveView)}
          ListHeaderComponent={commonHeader}
          ListEmptyComponent={
            <ServiceListState
              emptyAction={{
                label: listingFilter !== "all" || debouncedSearch ? "Clear filters" : "Add service",
                onPress:
                  listingFilter !== "all" || debouncedSearch
                    ? () => {
                        setListingFilter("all");
                        setSearchValue("");
                        setDebouncedSearch("");
                      }
                    : () => router.push("/services/new" as Href),
              }}
              emptyMessage={
                listingFilter !== "all" || debouncedSearch
                  ? "Try another service name or clear the selected listing filter."
                  : "Create a customer-ready service with pricing, tax, visit modes, coverage, and an image."
              }
              emptyTitle={listingFilter !== "all" || debouncedSearch ? "No matching services" : "Add your first service"}
              error={servicesQuery.error}
              loading={servicesQuery.isLoading}
              onRetry={() => {
                void servicesQuery.refetch();
              }}
            />
          }
          ListFooterComponent={
            <ServiceListFooter
              count={services.length}
              hasNextPage={Boolean(servicesQuery.hasNextPage)}
              isError={servicesQuery.isFetchNextPageError}
              label="services"
              loading={servicesQuery.isFetchingNextPage}
              onLoadMore={() => {
                void servicesQuery.fetchNextPage();
              }}
            />
          }
          ItemSeparatorComponent={ListSeparator}
          renderItem={({ item }) => (
            <View style={[styles.itemCell, columns > 1 ? styles.tabletCell : null]}>
              <ServiceListingCard
                archiving={archiveMutation.isPending && archiveMutation.variables === item.id}
                onArchive={() => setArchiveTarget(item)}
                onEdit={() => router.push(`/services/${encodeURIComponent(item.id)}` as Href)}
                service={item}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : view === "jobs" ? (
        <FlatList
          key={`service-jobs-${columns}`}
          data={jobs}
          keyExtractor={(job) => job.id}
          numColumns={columns}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            jobs.length === 0 ? styles.emptyListContent : null,
          ]}
          {...(columns > 1 ? { columnWrapperStyle: styles.columnRow } : {})}
          refreshControl={refreshControl(refreshing, refreshActiveView)}
          ListHeaderComponent={commonHeader}
          ListEmptyComponent={
            <ServiceListState
              emptyAction={
                jobFilter !== "ALL"
                  ? { label: "Show all jobs", onPress: () => setJobFilter("ALL") }
                  : undefined
              }
              emptyMessage={
                jobFilter !== "ALL"
                  ? "There are no service jobs in the selected lifecycle stage."
                  : "Customer bookings assigned to your seller account will appear here."
              }
              emptyTitle={jobFilter !== "ALL" ? "No matching jobs" : "No service jobs"}
              error={jobsQuery.error}
              loading={jobsQuery.isLoading}
              onRetry={() => {
                void jobsQuery.refetch();
              }}
            />
          }
          ListFooterComponent={
            <ServiceListFooter
              count={jobs.length}
              hasNextPage={Boolean(jobsQuery.hasNextPage)}
              isError={jobsQuery.isFetchNextPageError}
              label="jobs"
              loading={jobsQuery.isFetchingNextPage}
              onLoadMore={() => {
                void jobsQuery.fetchNextPage();
              }}
            />
          }
          ItemSeparatorComponent={ListSeparator}
          renderItem={({ item }) => (
            <View style={[styles.itemCell, columns > 1 ? styles.tabletCell : null]}>
              <ServiceJobCard
                booking={item}
                onPress={() =>
                  router.push(`/service-bookings/${encodeURIComponent(item.bookingNumber)}` as Href)
                }
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key={`service-reviews-${columns}`}
          data={reviews}
          keyExtractor={(review) => review.id}
          numColumns={columns}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            reviews.length === 0 ? styles.emptyListContent : null,
          ]}
          {...(columns > 1 ? { columnWrapperStyle: styles.columnRow } : {})}
          refreshControl={refreshControl(refreshing, refreshActiveView)}
          ListHeaderComponent={commonHeader}
          ListEmptyComponent={
            <ServiceListState
              emptyAction={
                reviewFilter !== "ALL" || debouncedSearch
                  ? {
                      label: "Clear filters",
                      onPress: () => {
                        setReviewFilter("ALL");
                        setSearchValue("");
                        setDebouncedSearch("");
                      },
                    }
                  : undefined
              }
              emptyMessage={
                reviewFilter !== "ALL" || debouncedSearch
                  ? "Try another customer comment or clear the selected review filter."
                  : "Customer feedback from completed service jobs will appear here."
              }
              emptyTitle={reviewFilter !== "ALL" || debouncedSearch ? "No matching reviews" : "No service reviews"}
              error={reviewsQuery.error}
              loading={reviewsQuery.isLoading}
              onRetry={() => {
                void reviewsQuery.refetch();
              }}
            />
          }
          ListFooterComponent={
            <ServiceListFooter
              count={reviews.length}
              hasNextPage={Boolean(reviewsQuery.hasNextPage)}
              isError={reviewsQuery.isFetchNextPageError}
              label="reviews"
              loading={reviewsQuery.isFetchingNextPage}
              onLoadMore={() => {
                void reviewsQuery.fetchNextPage();
              }}
            />
          }
          ItemSeparatorComponent={ListSeparator}
          renderItem={({ item }) => (
            <View style={[styles.itemCell, columns > 1 ? styles.tabletCell : null]}>
              <ServiceReviewCard
                active={replyingReviewId === item.id}
                body={replyingReviewId === item.id ? replyBody : ""}
                onBodyChange={setReplyBody}
                onCancel={() => {
                  setReplyingReviewId(null);
                  setReplyBody("");
                }}
                onEditReply={() => {
                  setReplyingReviewId(item.id);
                  setReplyBody(item.reply?.body ?? "");
                }}
                onSubmit={() => {
                  const body = replyBody.trim();
                  if (body) {
                    replyMutation.mutate({ reviewId: item.id, body });
                  }
                }}
                review={item}
                submitting={replyMutation.isPending && replyMutation.variables?.reviewId === item.id}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ConfirmDialog
        visible={Boolean(archiveTarget)}
        title="Archive service"
        message={
          archiveTarget
            ? `Archive "${archiveTarget.title}"? Customers will no longer see it as an active service.`
            : ""
        }
        confirmLabel="Archive"
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget || archiveMutation.isPending) return;
          const serviceId = archiveTarget.id;
          setArchiveTarget(null);
          archiveMutation.mutate(serviceId);
        }}
      />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );

  function changeView(nextView: ViewMode) {
    setView(nextView);
    setSearchValue("");
    setDebouncedSearch("");
    setReplyingReviewId(null);
    setReplyBody("");
  }
}

function ServiceWorkspaceHeader({
  countLabel: currentCountLabel,
  error,
  jobFilter,
  listingFilter,
  onJobFilterChange,
  onListingFilterChange,
  onRetry,
  onReviewFilterChange,
  onSearchChange,
  onViewChange,
  reviewFilter,
  searchValue,
  view,
}: {
  countLabel: string;
  error: unknown;
  jobFilter: JobFilter;
  listingFilter: ServiceListingViewFilter;
  onJobFilterChange: (filter: JobFilter) => void;
  onListingFilterChange: (filter: ServiceListingViewFilter) => void;
  onRetry: () => void;
  onReviewFilterChange: (filter: ReviewFilter) => void;
  onSearchChange: (value: string) => void;
  onViewChange: (view: ViewMode) => void;
  reviewFilter: ReviewFilter;
  searchValue: string;
  view: ViewMode;
}) {
  return (
    <View style={styles.header}>
      <OperationsHeader
        action={{
          icon: Add01Icon,
          label: "Add service",
          onPress: () => router.push("/services/new" as Href),
        }}
        countLabel={currentCountLabel}
        title="Services"
        subtitle="Manage listings, customer jobs, technicians, payments, and service reviews."
      />
      <Pressable
        accessibilityLabel="Open technician and availability calendar"
        accessibilityRole="button"
        onPress={() => router.push("/service-calendar" as Href)}
        style={({ pressed }) => [styles.calendarAction, pressed ? styles.pressed : null]}
      >
        <HugeiconsIcon icon={Calendar03Icon} color={colors.primary} size={21} strokeWidth={2.1} />
        <View style={styles.calendarCopy}>
          <Text style={styles.calendarTitle}>Technicians and availability</Text>
          <Text style={styles.calendarText}>Manage weekly hours, blocked time, and upcoming visits.</Text>
        </View>
        <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={18} strokeWidth={2} />
      </Pressable>
      <OperationsFilters onChange={onViewChange} options={VIEW_OPTIONS} value={view} />
      {view === "listings" ? (
        <>
          <OperationsSearch
            onChangeText={onSearchChange}
            placeholder="Search service listings"
            value={searchValue}
          />
          <OperationsFilters
            onChange={onListingFilterChange}
            options={SERVICE_LISTING_FILTERS}
            value={listingFilter}
          />
        </>
      ) : view === "jobs" ? (
        <OperationsFilters onChange={onJobFilterChange} options={JOB_FILTERS} value={jobFilter} />
      ) : (
        <>
          <OperationsSearch
            onChangeText={onSearchChange}
            placeholder="Search customer review text"
            value={searchValue}
          />
          <OperationsFilters
            onChange={onReviewFilterChange}
            options={REVIEW_FILTERS}
            value={reviewFilter}
          />
        </>
      )}
      {error ? (
        <OperationsInlineError
          message={error instanceof Error ? error.message : "Check your connection and try again."}
          onRetry={onRetry}
        />
      ) : null}
    </View>
  );
}

function ServiceListingCard({
  archiving,
  onArchive,
  onEdit,
  service,
}: {
  archiving: boolean;
  onArchive: () => void;
  onEdit: () => void;
  service: SellerServiceListing;
}) {
  const imageUri = resolvePublicImageUri(primaryServiceImage(service));
  const lifecycle = operationStatus(service.status);
  const approval = operationStatus(service.approvalStatus);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`Edit service ${service.title}`}
        accessibilityRole="button"
        onPress={onEdit}
        style={({ pressed }) => [styles.cardContent, pressed ? styles.pressedSurface : null]}
      >
        <View style={styles.serviceMain}>
          {imageUri ? (
            <Image
              accessibilityLabel={service.title}
              contentFit="cover"
              source={{ uri: imageUri }}
              style={styles.serviceImage}
              transition={120}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <HugeiconsIcon icon={Suit02Icon} color={colors.primary} size={29} strokeWidth={1.9} />
            </View>
          )}
          <View style={styles.serviceCopy}>
            <View style={styles.cardTitleRow}>
              <Text numberOfLines={2} style={styles.cardTitle}>{service.title}</Text>
              <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={18} strokeWidth={2} />
            </View>
            <Text numberOfLines={1} style={styles.category}>
              {service.category?.name ?? "Service listing"}
            </Text>
            <View style={styles.statusRow}>
              <StatusChip label={lifecycle.label} tone={lifecycle.tone} />
              <StatusChip label={approval.label} tone={approval.tone} />
            </View>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.description}>{service.description}</Text>
        <View style={styles.commercialRow}>
          <Text numberOfLines={1} style={styles.price}>{servicePriceLabel(service)}</Text>
          <Text style={styles.rating}>
            {Number(service.serviceRating ?? 0).toFixed(1)} / 5 ({service.serviceReviewCount ?? 0})
          </Text>
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <Pressable
          accessibilityLabel={`Edit ${service.title}`}
          accessibilityRole="button"
          onPress={onEdit}
          style={({ pressed }) => [styles.cardAction, pressed ? styles.pressedSurface : null]}
        >
          <HugeiconsIcon icon={Edit02Icon} color={colors.primary} size={19} strokeWidth={2.1} />
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
        <View style={styles.actionDivider} />
        <Pressable
          accessibilityLabel={`Archive ${service.title}`}
          accessibilityRole="button"
          disabled={archiving}
          onPress={onArchive}
          style={({ pressed }) => [
            styles.cardAction,
            archiving ? styles.disabled : null,
            pressed ? styles.pressedSurface : null,
          ]}
        >
          {archiving ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <HugeiconsIcon icon={Archive01Icon} color={colors.danger} size={19} strokeWidth={2.1} />
          )}
          <Text style={styles.archiveText}>{archiving ? "Archiving" : "Archive"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ServiceJobCard({
  booking,
  onPress,
}: {
  booking: SellerServiceBooking;
  onPress: () => void;
}) {
  const status = operationStatus(booking.status);
  const customer =
    booking.customer?.displayName
    ?? booking.customer?.user?.fullName
    ?? "Customer";
  const due = dueServiceAmountPaise(booking);

  return (
    <Pressable
      accessibilityLabel={`Open service job ${booking.bookingNumber}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.jobCard, pressed ? styles.pressedSurface : null]}
    >
      <View style={styles.cardTitleRow}>
        <View style={styles.serviceCopy}>
          <Text numberOfLines={1} style={styles.bookingNumber}>{booking.bookingNumber}</Text>
          <Text numberOfLines={2} style={styles.cardTitle}>{serviceBookingTitle(booking)}</Text>
        </View>
        <HugeiconsIcon icon={ArrowRight01Icon} color={colors.muted} size={18} strokeWidth={2} />
      </View>
      <StatusChip label={status.label} tone={status.tone} />
      <Text numberOfLines={2} style={styles.description}>{booking.customerIssue}</Text>
      <View style={styles.jobMeta}>
        <Text numberOfLines={1} style={styles.meta}>Customer: {customer}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          Visit: {formatOperationDateTime(booking.scheduledStartAt)}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          Technician: {booking.assignedTechnician?.name ?? "Not assigned"}
        </Text>
      </View>
      <View style={styles.commercialRow}>
        <Text style={styles.price}>Due {formatMoney(due, booking.currency)}</Text>
        <Text style={styles.total}>Total {formatMoney(booking.totalPayablePaise, booking.currency)}</Text>
      </View>
    </Pressable>
  );
}

function ServiceReviewCard({
  active,
  body,
  onBodyChange,
  onCancel,
  onEditReply,
  onSubmit,
  review,
  submitting,
}: {
  active: boolean;
  body: string;
  onBodyChange: (value: string) => void;
  onCancel: () => void;
  onEditReply: () => void;
  onSubmit: () => void;
  review: SellerServiceReview;
  submitting: boolean;
}) {
  const visibility = operationStatus(review.isVisible === false ? "HIDDEN" : "VISIBLE");
  const customer =
    review.customer?.displayName
    ?? review.customer?.user?.fullName
    ?? "Customer";

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.ratingRow}>
          <HugeiconsIcon icon={StarIcon} color={colors.warning} size={20} strokeWidth={2} />
          <Text style={styles.reviewRating}>{review.rating}/5</Text>
        </View>
        <StatusChip label={visibility.label} tone={visibility.tone} />
      </View>
      <Text numberOfLines={2} style={styles.cardTitle}>{review.listing?.title ?? "Service"}</Text>
      <Text style={styles.reviewBody}>{review.body ?? "No written review."}</Text>
      <Text style={styles.meta}>
        {customer} | {formatOperationDate(review.createdAt)}
      </Text>
      {active ? (
        <View style={styles.replyForm}>
          <Field
            label={review.reply ? "Edit reply" : "Reply"}
            value={body}
            onChangeText={onBodyChange}
            multiline
            maxLength={1200}
            placeholder="Write a helpful, specific response to the customer"
          />
          <View style={styles.replyActions}>
            <Button title="Cancel" tone="secondary" onPress={onCancel} style={styles.replyButton} />
            <Button
              title="Post reply"
              loading={submitting}
              disabled={submitting || body.trim().length < 2}
              onPress={onSubmit}
              style={styles.replyButton}
            />
          </View>
        </View>
      ) : review.reply ? (
        <View style={styles.replySurface}>
          <Text style={styles.replyLabel}>Your reply</Text>
          <Text style={styles.replyText}>{review.reply.body}</Text>
          <Button title="Edit reply" tone="secondary" onPress={onEditReply} />
        </View>
      ) : (
        <Button title="Reply to customer" tone="secondary" onPress={onEditReply} />
      )}
    </View>
  );
}

function ServiceListState({
  emptyAction,
  emptyMessage,
  emptyTitle,
  error,
  loading,
  onRetry,
}: {
  emptyAction?: { label: string; onPress: () => void } | undefined;
  emptyMessage: string;
  emptyTitle: string;
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return <ServiceLoadingPanel message="Loading this service view..." />;
  }
  if (error) {
    return (
      <QueryErrorState
        title="This service view could not be loaded"
        message={error instanceof Error ? error.message : undefined}
        onRetry={onRetry}
      />
    );
  }
  return (
    <OperationsEmptyState
      action={emptyAction}
      icon={Suit02Icon}
      message={emptyMessage}
      title={emptyTitle}
    />
  );
}

function ServiceListFooter({
  count,
  hasNextPage,
  isError,
  label,
  loading,
  onLoadMore,
}: {
  count: number;
  hasNextPage: boolean;
  isError: boolean;
  label: string;
  loading: boolean;
  onLoadMore: () => void;
}) {
  if (!count) return null;
  if (isError) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerError}>More {label} could not be loaded.</Text>
        <Button title="Retry" tone="secondary" onPress={onLoadMore} style={styles.footerButton} />
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.footerText}>Loading more {label}...</Text>
      </View>
    );
  }
  if (hasNextPage) {
    return (
      <Button title={`Load more ${label}`} tone="secondary" onPress={onLoadMore} style={styles.loadMore} />
    );
  }
  return <Text style={styles.endText}>All {label} in this view are shown.</Text>;
}

function ServiceLoadingPanel({ message }: { message: string }) {
  return (
    <View style={styles.loadingPanel}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.footerText}>{message}</Text>
    </View>
  );
}

function refreshControl(refreshing: boolean, onRefresh: () => Promise<void>) {
  return (
    <RefreshControl
      colors={[colors.primary]}
      onRefresh={() => {
        void onRefresh();
      }}
      refreshing={refreshing}
      tintColor={colors.primary}
    />
  );
}

function countLabel(view: ViewMode, count: number) {
  if (view === "listings") return `${count} ${count === 1 ? "service listing" : "service listings"}`;
  if (view === "jobs") return `${count} ${count === 1 ? "service job" : "service jobs"}`;
  return `${count} ${count === 1 ? "customer review" : "customer reviews"}`;
}

function isViewMode(value: string | undefined): value is ViewMode {
  return value === "listings" || value === "jobs" || value === "reviews";
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: {
    gap: 0,
    padding: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  header: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  calendarAction: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  calendarCopy: {
    flex: 1,
    gap: 2,
  },
  calendarTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  calendarText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  columnRow: {
    gap: spacing.sm,
  },
  itemCell: {
    flex: 1,
  },
  tabletCell: {
    flexBasis: "48%",
    maxWidth: "49.4%",
  },
  separator: {
    height: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 260,
    overflow: "hidden",
  },
  cardContent: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  serviceMain: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
  },
  serviceImage: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 88,
    width: 88,
  },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  serviceCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  cardTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 21,
  },
  category: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  description: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  commercialRow: {
    alignItems: "flex-end",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: spacing.sm,
  },
  price: {
    color: colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  rating: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
  },
  cardActions: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 48,
  },
  cardAction: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
  },
  actionDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  editText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  archiveText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  jobCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minHeight: 250,
    padding: spacing.md,
  },
  bookingNumber: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  jobMeta: {
    gap: 3,
  },
  meta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  total: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    minHeight: 250,
    padding: spacing.md,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  reviewRating: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  reviewBody: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  replySurface: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    gap: spacing.sm,
    marginTop: "auto",
    padding: spacing.md,
  },
  replyLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  replyText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  replyForm: {
    gap: spacing.md,
    marginTop: "auto",
  },
  replyActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  replyButton: {
    flex: 1,
  },
  footer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  footerError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
  },
  footerButton: {
    minWidth: 120,
  },
  loadingMore: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 56,
    paddingTop: spacing.sm,
  },
  footerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  loadMore: {
    alignSelf: "center",
    marginTop: spacing.lg,
    minWidth: 180,
  },
  endText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    paddingTop: spacing.lg,
    textAlign: "center",
  },
  loadingPanel: {
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 220,
    padding: spacing.xl,
  },
  pressed: {
    opacity: 0.72,
  },
  pressedSurface: {
    backgroundColor: colors.softSurface,
    opacity: 0.78,
  },
});
