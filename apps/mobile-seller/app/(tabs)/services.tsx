import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, ConfirmDialog, EmptyState, Field, Header, LoadingState, QueryErrorState, Screen, StatusChip, Toast } from "../../src/components/screen";
import {
  archiveSellerService,
  listSellerServiceBookings,
  listSellerServiceReviews,
  listSellerServices,
  replyToSellerServiceReview,
  type SellerServiceBooking,
  type SellerServiceListing,
  type SellerServiceReview,
} from "../../src/features/seller/seller-api";
import { dueServiceAmountPaise, servicePriceLabel } from "../../src/features/seller/service-operations";
import { formatMoney } from "../../src/lib/money";
import { colors, spacing } from "../../src/theme";

type ViewMode = "listings" | "jobs" | "reviews";
type ToastState = { visible: boolean; message: string; type: "success" | "error" };

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  APPROVED: "success",
  REQUESTED: "warning",
  ACCEPTED: "info",
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETION_SUBMITTED: "warning",
  COMPLETED: "success",
  COMPLETION_DISPUTED: "danger",
  CANCELLED: "danger",
  REJECTED: "danger",
};

export default function SellerServicesScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("listings");
  const [searchQuery, setSearchQuery] = useState("");
  const [archiveServiceId, setArchiveServiceId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });

  const servicesQuery = useQuery({
    queryKey: ["seller-services", auth.authKey, searchQuery],
    queryFn: () => listSellerServices(auth.authHeaders, { limit: 30, ...(searchQuery ? { search: searchQuery } : {}) }),
    enabled: auth.enabled,
  });
  const jobsQuery = useQuery({
    queryKey: ["seller-service-bookings", auth.authKey, "summary"],
    queryFn: () => listSellerServiceBookings(auth.authHeaders, { limit: 40 }),
    enabled: auth.enabled,
  });
  const reviewsQuery = useQuery({
    queryKey: ["seller-service-reviews", auth.authKey, "summary"],
    queryFn: () => listSellerServiceReviews(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled,
  });

  const archiveMutation = useMutation({
    mutationFn: (serviceId: string) => archiveSellerService(auth.authHeaders, serviceId),
    onSuccess: async () => {
      setArchiveServiceId(null);
      setToast({ visible: true, message: "Service archived.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-services", auth.authKey] });
    },
    onError: (error) => setToast({ visible: true, message: error instanceof Error ? error.message : "Service archive failed.", type: "error" }),
  });
  const replyMutation = useMutation({
    mutationFn: (reviewId: string) =>
      replyToSellerServiceReview(auth.authHeaders, reviewId, {
        body: "Thank you for your feedback. We will keep improving our service.",
      }),
    onSuccess: async () => {
      setToast({ visible: true, message: "Review reply posted.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-service-reviews", auth.authKey] });
    },
    onError: (error) => setToast({ visible: true, message: error instanceof Error ? error.message : "Reply failed.", type: "error" }),
  });

  if (!auth.enabled || servicesQuery.isLoading || jobsQuery.isLoading || reviewsQuery.isLoading) {
    return <LoadingState message="Loading service workspace..." />;
  }

  const loadError = servicesQuery.error ?? jobsQuery.error ?? reviewsQuery.error;
  if (servicesQuery.isError || jobsQuery.isError || reviewsQuery.isError) {
    return (
      <Screen>
        <Header title="Services" subtitle="Manage service listings, bookings, and customer feedback." />
        <QueryErrorState
          title="Services could not be loaded"
          message={loadError instanceof Error ? loadError.message : undefined}
          onRetry={() => {
            void servicesQuery.refetch();
            void jobsQuery.refetch();
            void reviewsQuery.refetch();
          }}
          retrying={servicesQuery.isFetching || jobsQuery.isFetching || reviewsQuery.isFetching}
        />
      </Screen>
    );
  }

  const services = servicesQuery.data?.items ?? [];
  const jobs = jobsQuery.data?.items ?? [];
  const reviews = reviewsQuery.data?.items ?? [];

  return (
    <Screen contentContainerStyle={styles.content}>
      <Header title="Services" subtitle="Add services, accept bookings, update field work, and handle service reviews." />
      <View style={styles.quickActions}>
        <Button title="Add service" onPress={() => router.push("/services/new" as Href)} style={styles.quickButton} />
        <Button title="Calendar" tone="secondary" onPress={() => router.push("/service-calendar" as Href)} style={styles.quickButton} />
      </View>
      <View style={styles.segment}>
        <Button title="Listings" tone={view === "listings" ? "primary" : "secondary"} onPress={() => setView("listings")} style={styles.segmentButton} />
        <Button title="Jobs" tone={view === "jobs" ? "primary" : "secondary"} onPress={() => setView("jobs")} style={styles.segmentButton} />
        <Button title="Reviews" tone={view === "reviews" ? "primary" : "secondary"} onPress={() => setView("reviews")} style={styles.segmentButton} />
      </View>

      {view === "listings" ? (
        <ServiceListings
          services={services}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onArchive={setArchiveServiceId}
        />
      ) : view === "jobs" ? (
        <ServiceJobs jobs={jobs} />
      ) : (
        <ServiceReviews reviews={reviews} replying={replyMutation.isPending} onReply={(reviewId) => replyMutation.mutate(reviewId)} />
      )}

      <ConfirmDialog
        visible={Boolean(archiveServiceId)}
        title="Archive service"
        message="Archive this service listing? Customers will no longer see it as active."
        onCancel={() => setArchiveServiceId(null)}
        onConfirm={() => {
          if (archiveServiceId) {
            archiveMutation.mutate(archiveServiceId);
          }
        }}
      />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((current) => ({ ...current, visible: false }))} />
    </Screen>
  );
}

function ServiceListings({
  services,
  searchQuery,
  setSearchQuery,
  onArchive,
}: {
  services: SellerServiceListing[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onArchive: (serviceId: string) => void;
}) {
  return (
    <>
      <Card>
        <Field placeholder="Search services..." value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
      </Card>
      {services.length ? (
        services.map((service) => (
          <Card key={service.id}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{service.title}</Text>
              <StatusChip label={service.status} tone={statusTones[service.status] ?? "info"} />
            </View>
            <StatusChip label={service.approvalStatus} tone={statusTones[service.approvalStatus] ?? "warning"} />
            <Text style={styles.muted}>{service.description}</Text>
            <Text style={styles.money}>{servicePriceLabel(service)}</Text>
            <View style={styles.buttonRow}>
              <Button title="Edit" onPress={() => router.push(`/services/${encodeURIComponent(service.id)}` as Href)} style={styles.rowButton} />
              <Button title="Archive" tone="danger" onPress={() => onArchive(service.id)} style={styles.rowButton} />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title="No services found" message="Create your first service with pricing, visit modes, image, package, and coverage." />
      )}
    </>
  );
}

function ServiceJobs({ jobs }: { jobs: SellerServiceBooking[] }) {
  return jobs.length ? (
    <>
      {jobs.map((booking) => (
        <Card key={booking.id}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{booking.bookingNumber}</Text>
            <StatusChip label={booking.status} tone={statusTones[booking.status] ?? "info"} />
          </View>
          <Text style={styles.money}>{titleForBooking(booking)}</Text>
          <Text style={styles.muted}>{booking.customerIssue}</Text>
          <Text style={styles.muted}>Customer: {booking.customer?.displayName ?? booking.customer?.user?.fullName ?? "Customer"}</Text>
          <Text style={styles.muted}>Due: {formatMoney(dueServiceAmountPaise(booking), booking.currency)}</Text>
          <Text style={styles.muted}>Technician: {booking.assignedTechnician?.name ?? "Not assigned"}</Text>
          <Button title="Open job" onPress={() => router.push(`/service-bookings/${encodeURIComponent(booking.bookingNumber)}` as Href)} />
        </Card>
      ))}
    </>
  ) : (
    <EmptyState title="No service jobs" message="Customer service bookings assigned to your seller account will appear here." />
  );
}

function ServiceReviews({
  reviews,
  replying,
  onReply,
}: {
  reviews: SellerServiceReview[];
  replying: boolean;
  onReply: (reviewId: string) => void;
}) {
  return reviews.length ? (
    <>
      {reviews.map((review) => (
        <Card key={review.id}>
          <Text style={styles.money}>{review.rating}/5 rating</Text>
          <Text style={styles.cardTitle}>{review.listing?.title ?? "Service"}</Text>
          <Text style={styles.muted}>{review.body ?? "No written review."}</Text>
          <StatusChip label={review.isVisible === false ? "HIDDEN" : "VISIBLE"} tone={review.isVisible === false ? "warning" : "success"} />
          {review.reply ? (
            <Text style={styles.muted}>Reply: {review.reply.body}</Text>
          ) : (
            <Button title="Quick reply" loading={replying} onPress={() => onReply(review.id)} />
          )}
        </Card>
      ))}
    </>
  ) : (
    <EmptyState title="No service reviews" message="Customer reviews for completed service jobs will appear here." />
  );
}

function titleForBooking(booking: SellerServiceBooking) {
  return booking.listing && "title" in booking.listing ? booking.listing.title ?? "Service job" : "Service job";
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickButton: {
    flex: 1,
  },
  segment: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  money: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowButton: {
    flex: 1,
  },
});
