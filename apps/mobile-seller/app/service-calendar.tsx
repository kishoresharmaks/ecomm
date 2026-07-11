import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMobileSellerAuth } from "../src/auth/mobile-seller-auth-context";
import { Button, Card, Field, Header, LoadingState, QueryErrorState, Screen, StatusChip, Toast } from "../src/components/screen";
import {
  getSellerServiceCalendar,
  updateSellerServiceCalendar,
  type SellerServiceAvailabilityRule,
  type SellerServiceBlockedWindow,
  type SellerServiceTechnician,
} from "../src/features/seller/seller-api";
import { colors, spacing } from "../src/theme";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SellerServiceCalendarScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const [technicianName, setTechnicianName] = useState("");
  const [technicianPhone, setTechnicianPhone] = useState("");
  const [skillText, setSkillText] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startMinute, setStartMinute] = useState("600");
  const [endMinute, setEndMinute] = useState("1080");
  const [capacity, setCapacity] = useState("2");
  const [blockStartsAt, setBlockStartsAt] = useState("");
  const [blockEndsAt, setBlockEndsAt] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [toast, setToast] = useState<ToastState>({ visible: false, message: "", type: "success" });
  const [technicians, setTechnicians] = useState<SellerServiceTechnician[]>([]);
  const [rules, setRules] = useState<SellerServiceAvailabilityRule[]>([]);
  const [blockedWindows, setBlockedWindows] = useState<SellerServiceBlockedWindow[]>([]);

  const calendarQuery = useQuery({
    queryKey: ["seller-service-calendar", auth.authKey],
    queryFn: () => getSellerServiceCalendar(auth.authHeaders),
    enabled: auth.enabled,
  });

  useEffect(() => {
    if (calendarQuery.data) {
      setTechnicians(calendarQuery.data.technicians ?? []);
      setRules(calendarQuery.data.availabilityRules ?? []);
      setBlockedWindows(calendarQuery.data.blockedWindows ?? []);
    }
  }, [calendarQuery.data]);

  const mutation = useMutation({
    mutationFn: () => updateSellerServiceCalendar(auth.authHeaders, { technicians, availabilityRules: rules, blockedWindows }),
    onSuccess: async () => {
      setToast({ visible: true, message: "Service calendar saved.", type: "success" });
      await queryClient.invalidateQueries({ queryKey: ["seller-service-calendar", auth.authKey] });
    },
    onError: (error) => setToast({ visible: true, message: error instanceof Error ? error.message : "Calendar save failed.", type: "error" }),
  });

  if (!auth.enabled || calendarQuery.isLoading) {
    return <LoadingState message="Loading service calendar..." />;
  }

  if (calendarQuery.isError) {
    return (
      <Screen>
        <Header title="Service calendar" subtitle="Manage technicians and service availability." />
        <QueryErrorState
          title="Calendar could not be loaded"
          message={calendarQuery.error instanceof Error ? calendarQuery.error.message : undefined}
          onRetry={() => void calendarQuery.refetch()}
          retrying={calendarQuery.isFetching}
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <Header title="Service calendar" subtitle="Control technician roster, working hours, and blocked time for service bookings." />

      <Card>
        <Text style={styles.sectionTitle}>Technicians</Text>
        {technicians.length ? (
          technicians.map((technician, index) => (
            <View key={technician.id ?? `${technician.name}-${index}`} style={styles.listRow}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{technician.name}</Text>
                <Text style={styles.muted}>{technician.phone ?? "No phone"} / {(technician.skills ?? []).join(", ") || "No skills"}</Text>
              </View>
              <StatusChip label={technician.isActive === false ? "INACTIVE" : "ACTIVE"} tone={technician.isActive === false ? "warning" : "success"} />
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No technicians added.</Text>
        )}
        <Field label="Technician name" value={technicianName} onChangeText={setTechnicianName} />
        <Field label="Phone" value={technicianPhone} onChangeText={setTechnicianPhone} keyboardType="phone-pad" />
        <Field label="Skills" value={skillText} onChangeText={setSkillText} placeholder="AC repair, installation" />
        <Button title="Add technician" tone="secondary" onPress={addTechnician} disabled={!technicianName.trim()} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Weekly availability</Text>
        {rules.length ? (
          rules.map((rule, index) => (
            <View key={rule.id ?? `${rule.dayOfWeek}-${index}`} style={styles.listRow}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{dayLabels[rule.dayOfWeek] ?? "Day"} / {minuteLabel(rule.startMinute)} - {minuteLabel(rule.endMinute)}</Text>
                <Text style={styles.muted}>Capacity {rule.capacity}</Text>
              </View>
              <StatusChip label={rule.isActive === false ? "INACTIVE" : "ACTIVE"} tone={rule.isActive === false ? "warning" : "success"} />
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No custom weekly rules.</Text>
        )}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Day 0-6" value={dayOfWeek} onChangeText={setDayOfWeek} keyboardType="number-pad" />
          </View>
          <View style={styles.column}>
            <Field label="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Field label="Start minute" value={startMinute} onChangeText={setStartMinute} keyboardType="number-pad" />
          </View>
          <View style={styles.column}>
            <Field label="End minute" value={endMinute} onChangeText={setEndMinute} keyboardType="number-pad" />
          </View>
        </View>
        <Button title="Add availability" tone="secondary" onPress={addAvailability} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Blocked time</Text>
        {blockedWindows.length ? (
          blockedWindows.map((window, index) => (
            <View key={window.id ?? `${window.startsAt}-${index}`} style={styles.listRow}>
              <View style={styles.rowText}>
                <Text style={styles.title}>{window.startsAt}</Text>
                <Text style={styles.muted}>{window.endsAt} / {window.reason ?? "No reason"}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No blocked time.</Text>
        )}
        <Field label="Starts at" value={blockStartsAt} onChangeText={setBlockStartsAt} placeholder="2026-07-12T00:00:00.000Z" />
        <Field label="Ends at" value={blockEndsAt} onChangeText={setBlockEndsAt} placeholder="2026-07-12T23:59:00.000Z" />
        <Field label="Reason" value={blockReason} onChangeText={setBlockReason} />
        <Button title="Add blocked time" tone="secondary" onPress={addBlockedWindow} disabled={!blockStartsAt.trim() || !blockEndsAt.trim()} />
      </Card>

      <Button title={mutation.isPending ? "Saving..." : "Save calendar"} loading={mutation.isPending} onPress={() => mutation.mutate()} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((current) => ({ ...current, visible: false }))} />
    </Screen>
  );

  function addTechnician() {
    setTechnicians((current) => [
      ...current,
      {
        name: technicianName.trim(),
        phone: technicianPhone.trim() || null,
        skills: skillText.split(",").map((skill) => skill.trim()).filter(Boolean),
        isActive: true,
      },
    ]);
    setTechnicianName("");
    setTechnicianPhone("");
    setSkillText("");
  }

  function addAvailability() {
    setRules((current) => [
      ...current,
      {
        dayOfWeek: clampNumber(dayOfWeek, 0, 6),
        startMinute: clampNumber(startMinute, 0, 1439),
        endMinute: clampNumber(endMinute, 1, 1440),
        capacity: clampNumber(capacity, 1, 50),
        isActive: true,
        note: null,
      },
    ]);
  }

  function addBlockedWindow() {
    setBlockedWindows((current) => [
      ...current,
      {
        startsAt: toIsoDateTime(blockStartsAt),
        endsAt: toIsoDateTime(blockEndsAt),
        reason: blockReason.trim() || null,
        isFullDay: false,
      },
    ]);
    setBlockStartsAt("");
    setBlockEndsAt("");
    setBlockReason("");
  }
}

function clampNumber(value: string, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function minuteLabel(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toIsoDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  if (trimmed.includes("T")) return new Date(trimmed).toISOString();
  return new Date(`${trimmed}T00:00:00.000+05:30`).toISOString();
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
  listRow: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 14,
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
});
