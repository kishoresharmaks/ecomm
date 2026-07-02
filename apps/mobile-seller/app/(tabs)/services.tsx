import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useMobileSellerAuth } from "../../src/auth/mobile-seller-auth-context";
import { Button, Card, EmptyState, Header, LoadingState, QueryErrorState, Screen, StatusChip } from "../../src/components/screen";
import {
  listSellerServiceBookings,
  listSellerServiceReviews,
  replyToSellerServiceReview,
  updateSellerServiceFieldStatus,
  type SellerServiceBooking,
  type SellerServiceReview,
} from "../../src/features/seller/seller-api";
import { formatMoney } from "../../src/lib/money";

const statusTones: Record<string, "info" | "success" | "warning" | "danger"> = {
  REQUESTED: "warning",
  ACCEPTED: "info",
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  COMPLETION_DISPUTED: "danger",
  CANCELLED: "danger",
};

export default function SellerServicesScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"jobs" | "reviews">("jobs");
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});
  const jobsQuery = useQuery({
    queryKey: ["seller-service-bookings", auth.authKey],
    queryFn: () => listSellerServiceBookings(auth.authHeaders, { limit: 40 }),
    enabled: auth.enabled,
  });
  const reviewsQuery = useQuery({
    queryKey: ["seller-service-reviews", auth.authKey],
    queryFn: () => listSellerServiceReviews(auth.authHeaders, { limit: 20 }),
    enabled: auth.enabled,
  });
  const fieldMutation = useMutation({
    mutationFn: ({ booking, status }: { booking: SellerServiceBooking; status: "EN_ROUTE" | "ARRIVED" | "CHECKED_IN" | "CHECKED_OUT" }) => {
      const note = fieldNotes[booking.bookingNumber]?.trim();
      return updateSellerServiceFieldStatus(auth.authHeaders, booking.bookingNumber, note ? { status, note } : { status });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller-service-bookings"] }),
  });
  const replyMutation = useMutation({
    mutationFn: ({ review }: { review: SellerServiceReview }) =>
      replyToSellerServiceReview(auth.authHeaders, review.id, { body: "Thank you for your feedback. We will keep improving our service." }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["seller-service-reviews"] }),
  });

  if (!auth.enabled || jobsQuery.isLoading || reviewsQuery.isLoading) {
    return <LoadingState message="Loading services..." />;
  }

  const loadError = jobsQuery.error ?? reviewsQuery.error;

  if (jobsQuery.isError || reviewsQuery.isError) {
    return (
      <Screen scroll={false}>
        <Header title="Services" subtitle="Manage service jobs and customer feedback." />
        <QueryErrorState
          title="Services could not be loaded"
          message={loadError instanceof Error ? loadError.message : undefined}
          onRetry={() => {
            void jobsQuery.refetch();
            void reviewsQuery.refetch();
          }}
          retrying={jobsQuery.isFetching || reviewsQuery.isFetching}
        />
      </Screen>
    );
  }

  const jobs = jobsQuery.data?.items ?? [];
  const reviews = reviewsQuery.data?.items ?? [];

  return (
    <Screen>
      <Header title="Services" subtitle="Track jobs, technician progress, quotes, and service reviews." />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Jobs" tone={view === "jobs" ? "primary" : "secondary"} onPress={() => setView("jobs")} style={{ flex: 1 }} />
        <Button title="Reviews" tone={view === "reviews" ? "primary" : "secondary"} onPress={() => setView("reviews")} style={{ flex: 1 }} />
      </View>
      {view === "jobs" ? (
        jobs.length ? (
          jobs.map((booking) => (
            <Card key={booking.id}>
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "900" }}>{booking.bookingNumber}</Text>
              <Text style={{ color: "#374151", fontSize: 14, fontWeight: "800", marginTop: 4 }}>{booking.listing?.title ?? "Service job"}</Text>
              <StatusChip label={booking.status} tone={statusTones[booking.status] ?? "info"} />
              <Text style={{ color: "#6B7280", marginTop: 6 }}>{booking.customer?.displayName ?? booking.customer?.user?.fullName ?? "Customer"}</Text>
              <Text style={{ color: "#6B7280" }}>Due: {formatMoney(Math.max(0, booking.totalPayablePaise - booking.paidAmountPaise), booking.currency)}</Text>
              <Text style={{ color: "#6B7280" }}>Technician: {booking.assignedTechnician?.name ?? "Not assigned"}</Text>
              <Text style={{ color: "#6B7280" }}>Field proof: {booking.technicianFieldProofKeys?.length ?? 0} files</Text>
              <TextInput
                onChangeText={(value) => setFieldNotes((current) => ({ ...current, [booking.bookingNumber]: value }))}
                placeholder="Technician note"
                placeholderTextColor="#9CA3AF"
                style={{ borderColor: "#E5E7EB", borderRadius: 12, borderWidth: 1, color: "#111827", marginTop: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                value={fieldNotes[booking.bookingNumber] ?? ""}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <Button title="En route" tone="secondary" loading={fieldMutation.isPending} onPress={() => fieldMutation.mutate({ booking, status: "EN_ROUTE" })} />
                <Button title="Arrived" tone="secondary" loading={fieldMutation.isPending} onPress={() => fieldMutation.mutate({ booking, status: "ARRIVED" })} />
                <Button title="Check in" tone="secondary" loading={fieldMutation.isPending} onPress={() => fieldMutation.mutate({ booking, status: "CHECKED_IN" })} />
                <Button title="Check out" tone="secondary" loading={fieldMutation.isPending} onPress={() => fieldMutation.mutate({ booking, status: "CHECKED_OUT" })} />
              </View>
            </Card>
          ))
        ) : (
          <EmptyState title="No service jobs" message="Service bookings assigned to your seller account will appear here." />
        )
      ) : reviews.length ? (
        reviews.map((review) => (
          <Card key={review.id}>
            <Text style={{ color: "#ED3500", fontSize: 16, fontWeight: "900" }}>{review.rating}/5 rating</Text>
            <Text style={{ color: "#111827", fontSize: 15, fontWeight: "900", marginTop: 4 }}>{review.listing?.title ?? "Service"}</Text>
            <Text style={{ color: "#6B7280", marginTop: 6 }}>{review.body ?? "No written review."}</Text>
            <StatusChip label={review.isVisible === false ? "HIDDEN" : "VISIBLE"} tone={review.isVisible === false ? "warning" : "success"} />
            {review.reply ? (
              <Text style={{ color: "#374151", marginTop: 8 }}>Reply: {review.reply.body}</Text>
            ) : (
              <Button title="Quick reply" loading={replyMutation.isPending} onPress={() => replyMutation.mutate({ review })} />
            )}
          </Card>
        ))
      ) : (
        <EmptyState title="No service reviews" message="Customer reviews for completed service jobs will appear here." />
      )}
    </Screen>
  );
}
