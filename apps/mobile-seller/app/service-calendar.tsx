import {
  Add01Icon,
  Calendar03Icon,
  Clock01Icon,
  Delete02Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useMobileSellerAuth } from "../src/auth/mobile-seller-auth-context";
import {
  OperationsEmptyState,
  OperationsHeader,
  OperationsSection,
} from "../src/components/operations-ui";
import {
  Button,
  Field,
  LoadingState,
  QueryErrorState,
  Screen,
  SelectField,
  StatusChip,
  Toast,
} from "../src/components/screen";
import {
  addDaysToDateInput,
  dateInputFromIso,
  formatServiceCalendarDateTime,
  localDateTimeToIso,
  minuteLabel,
  operationStatus,
  serviceBookingTitle,
  timeValueToMinute,
} from "../src/features/seller/operations-presentation";
import {
  getSellerServiceCalendar,
  updateSellerServiceCalendar,
  type SellerServiceAvailabilityRule,
  type SellerServiceBlockedWindow,
  type SellerServiceTechnician,
} from "../src/features/seller/seller-api";
import { colors, spacing } from "../src/theme";

type ToastState = { visible: boolean; message: string; type: "success" | "error" };

const DAY_OPTIONS = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];
const DAY_LABELS = DAY_OPTIONS.map((option) => option.label);
const START_TIME_OPTIONS = timeOptions(false);
const END_TIME_OPTIONS = timeOptions(true);

export default function SellerServiceCalendarScreen() {
  const auth = useMobileSellerAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const isTablet = width >= 700;
  const [technicianName, setTechnicianName] = useState("");
  const [technicianPhone, setTechnicianPhone] = useState("");
  const [technicianEmail, setTechnicianEmail] = useState("");
  const [skillText, setSkillText] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [capacity, setCapacity] = useState("1");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [blockDate, setBlockDate] = useState(() => dateInputFromIso(new Date().toISOString()));
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndDate, setBlockEndDate] = useState(() => dateInputFromIso(new Date().toISOString()));
  const [blockEndTime, setBlockEndTime] = useState("18:00");
  const [blockReason, setBlockReason] = useState("");
  const [blockFullDay, setBlockFullDay] = useState(true);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });
  const [technicians, setTechnicians] = useState<SellerServiceTechnician[]>([]);
  const [rules, setRules] = useState<SellerServiceAvailabilityRule[]>([]);
  const [blockedWindows, setBlockedWindows] = useState<SellerServiceBlockedWindow[]>([]);
  const [dirty, setDirty] = useState(false);

  const calendarQuery = useQuery({
    queryKey: ["seller-service-calendar", auth.authKey],
    queryFn: () => getSellerServiceCalendar(auth.authHeaders),
    enabled: auth.enabled,
    retry: false,
  });

  useEffect(() => {
    if (!calendarQuery.data || dirty) return;
    setTechnicians(calendarQuery.data.technicians ?? []);
    setRules(calendarQuery.data.availabilityRules ?? []);
    setBlockedWindows(calendarQuery.data.blockedWindows ?? []);
  }, [calendarQuery.data, dirty]);

  const activeTechnicians = useMemo(
    () => technicians.filter((technician) => technician.isActive !== false).length,
    [technicians],
  );
  const upcomingBookings = calendarQuery.data?.bookings ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      updateSellerServiceCalendar(auth.authHeaders, {
        technicians,
        availabilityRules: rules,
        blockedWindows,
      }),
    onSuccess: async (calendar) => {
      setTechnicians(calendar.technicians ?? []);
      setRules(calendar.availabilityRules ?? []);
      setBlockedWindows(calendar.blockedWindows ?? []);
      setDirty(false);
      queryClient.setQueryData(["seller-service-calendar", auth.authKey], calendar);
      setToast({ visible: true, message: "Service calendar saved.", type: "success" });
      await queryClient.invalidateQueries({
        queryKey: ["seller-service-calendar", auth.authKey],
      });
    },
    onError: (error) =>
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Calendar save failed.",
        type: "error",
      }),
  });

  if (!auth.enabled || calendarQuery.isLoading) {
    return <LoadingState message="Loading service calendar..." />;
  }

  if (calendarQuery.isError) {
    return (
      <Screen>
        <OperationsHeader
          onBack={() => router.back()}
          title="Service calendar"
          subtitle="Manage technicians and service availability."
        />
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
    <Screen
      contentContainerStyle={styles.content}
      refreshing={calendarQuery.isFetching}
      onRefresh={() => {
        void calendarQuery.refetch();
      }}
    >
      <OperationsHeader
        onBack={() => router.back()}
        countLabel={`${upcomingBookings.length} upcoming ${upcomingBookings.length === 1 ? "job" : "jobs"}`}
        title="Service calendar"
        subtitle="Set the active roster, weekly capacity, unavailable time, and upcoming customer visits."
      />

      <View style={styles.summaryBand}>
        <CalendarMetric label="Active technicians" value={String(activeTechnicians)} />
        <CalendarMetric label="Working-hour rules" value={String(rules.length)} />
        <CalendarMetric
          label="Unscheduled jobs"
          value={String(calendarQuery.data?.diagnostics?.unscheduledBookingCount ?? 0)}
        />
      </View>

      <OperationsSection
        title="Upcoming service jobs"
        subtitle="Scheduled and unscheduled work from the next 45 days."
      >
        {upcomingBookings.length ? (
          <View style={[styles.jobGrid, isTablet ? styles.jobGridTablet : null]}>
            {upcomingBookings.slice(0, 8).map((booking) => {
              const status = operationStatus(booking.status);
              return (
                <Pressable
                  key={booking.id}
                  accessibilityLabel={`Open service job ${booking.bookingNumber}`}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      `/service-bookings/${encodeURIComponent(booking.bookingNumber)}` as Href,
                    )
                  }
                  style={({ pressed }) => [
                    styles.jobRow,
                    isTablet ? styles.jobRowTablet : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.jobCopy}>
                    <Text numberOfLines={1} style={styles.bookingNumber}>
                      {booking.bookingNumber}
                    </Text>
                    <Text numberOfLines={2} style={styles.jobTitle}>
                      {serviceBookingTitle(booking)}
                    </Text>
                    <Text numberOfLines={1} style={styles.meta}>
                      {formatServiceCalendarDateTime(booking.scheduledStartAt)}
                    </Text>
                    <Text numberOfLines={1} style={styles.meta}>
                      {booking.assignedTechnician?.name ?? "Technician not assigned"}
                    </Text>
                  </View>
                  <StatusChip label={status.label} tone={status.tone} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <OperationsEmptyState
            icon={Calendar03Icon}
            title="No upcoming jobs"
            message="Accepted and scheduled customer service jobs will appear here."
          />
        )}
      </OperationsSection>

      <OperationsSection
        title="Technician roster"
        subtitle="Only active technicians can be assigned to new or rescheduled visits."
      >
        {technicians.length ? (
          <View style={styles.listSurface}>
            {technicians.map((technician, index) => {
              const active = technician.isActive !== false;
              return (
                <View
                  key={technician.id ?? `${technician.name}-${index}`}
                  style={[styles.listRow, index > 0 ? styles.divider : null]}
                >
                  <View style={styles.rowCopy}>
                    <View style={styles.rowTitleLine}>
                      <Text numberOfLines={2} style={styles.rowTitle}>
                        {technician.name}
                      </Text>
                      <StatusChip
                        label={active ? "Active" : "Inactive"}
                        tone={active ? "success" : "warning"}
                      />
                    </View>
                    <Text style={styles.meta}>
                      {technician.phone || technician.email || "No contact details"}
                    </Text>
                    <Text numberOfLines={2} style={styles.meta}>
                      {(technician.skills ?? []).join(", ") || "No skills listed"}
                    </Text>
                  </View>
                  {technician.id ? (
                    <Switch
                      accessibilityLabel={`${active ? "Deactivate" : "Activate"} ${technician.name}`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: active }}
                      onValueChange={(value) => {
                        setTechnicians((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, isActive: value } : item,
                          ),
                        );
                        setDirty(true);
                      }}
                      thumbColor={colors.surface}
                      trackColor={{ false: "#D1D5DB", true: colors.primary }}
                      value={active}
                    />
                  ) : (
                    <RemoveButton
                      label={`Remove ${technician.name}`}
                      onPress={() => {
                        setTechnicians((current) =>
                          current.filter((_item, itemIndex) => itemIndex !== index),
                        );
                        setDirty(true);
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.meta}>No technicians have been added.</Text>
        )}

        <View style={styles.formSurface}>
          <View style={styles.formHeading}>
            <HugeiconsIcon icon={UserAdd01Icon} color={colors.primary} size={21} strokeWidth={2.1} />
            <Text style={styles.formTitle}>Add technician</Text>
          </View>
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field
                label="Name"
                value={technicianName}
                onChangeText={setTechnicianName}
                placeholder="Technician name"
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Phone"
                value={technicianPhone}
                onChangeText={setTechnicianPhone}
                keyboardType="phone-pad"
                placeholder="+91 98765 43210"
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Email"
                value={technicianEmail}
                onChangeText={setTechnicianEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="name@example.com"
              />
            </View>
          </View>
          <Field
            label="Skills"
            value={skillText}
            onChangeText={setSkillText}
            placeholder="AC repair, installation"
          />
          <Button
            title="Add technician"
            tone="secondary"
            onPress={addTechnician}
            disabled={technicianName.trim().length < 2}
          />
        </View>
      </OperationsSection>

      <OperationsSection
        title="Weekly working hours"
        subtitle="Capacity is the number of overlapping jobs the seller can handle in this time window."
      >
        <View style={styles.listSurface}>
          {rules.map((rule, index) => (
            <View
              key={rule.id ?? `${rule.dayOfWeek}-${rule.startMinute}-${index}`}
              style={[styles.listRow, index > 0 ? styles.divider : null]}
            >
              <View style={styles.rowIcon}>
                <HugeiconsIcon icon={Clock01Icon} color={colors.primary} size={20} strokeWidth={2} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {DAY_LABELS[rule.dayOfWeek] ?? "Working day"} | {minuteLabel(rule.startMinute)} -{" "}
                  {minuteLabel(rule.endMinute)}
                </Text>
                <Text style={styles.meta}>
                  Capacity {rule.capacity}
                  {rule.note ? ` | ${rule.note}` : ""}
                </Text>
              </View>
              <RemoveButton
                label={`Remove ${DAY_LABELS[rule.dayOfWeek] ?? "working-hours"} rule`}
                onPress={() => {
                  if (rules.length === 1) {
                    setToast({
                      visible: true,
                      message: "Keep at least one working-hours rule.",
                      type: "error",
                    });
                    return;
                  }
                  setRules((current) =>
                    current.filter((_item, itemIndex) => itemIndex !== index),
                  );
                  setDirty(true);
                }}
              />
            </View>
          ))}
        </View>

        <View style={styles.formSurface}>
          <View style={styles.formHeading}>
            <HugeiconsIcon icon={Add01Icon} color={colors.primary} size={21} strokeWidth={2.1} />
            <Text style={styles.formTitle}>Add working hours</Text>
          </View>
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <SelectField
                label="Day"
                options={DAY_OPTIONS}
                selectedValue={dayOfWeek}
                onSelect={setDayOfWeek}
              />
            </View>
            <View style={styles.column}>
              <SelectField
                label="Starts"
                options={START_TIME_OPTIONS}
                selectedValue={startTime}
                onSelect={setStartTime}
              />
            </View>
            <View style={styles.column}>
              <SelectField
                label="Ends"
                options={END_TIME_OPTIONS}
                selectedValue={endTime}
                onSelect={setEndTime}
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Capacity"
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Field
            label="Note"
            value={availabilityNote}
            onChangeText={setAvailabilityNote}
            placeholder="Morning visits, workshop hours, or another useful label"
          />
          <Button title="Add working hours" tone="secondary" onPress={addAvailability} />
        </View>
      </OperationsSection>

      <OperationsSection
        title="Blocked time"
        subtitle="Use blocked time for holidays, leave, stock work, or any period when visits must not be scheduled."
      >
        {blockedWindows.length ? (
          <View style={styles.listSurface}>
            {blockedWindows.map((window, index) => (
              <View
                key={window.id ?? `${window.startsAt}-${index}`}
                style={[styles.listRow, index > 0 ? styles.divider : null]}
              >
                <View style={styles.rowCopy}>
                  <View style={styles.rowTitleLine}>
                    <Text numberOfLines={2} style={styles.rowTitle}>
                      {formatServiceCalendarDateTime(window.startsAt)}
                    </Text>
                    {window.isFullDay ? <StatusChip label="Full day" tone="warning" /> : null}
                  </View>
                  <Text style={styles.meta}>
                    Until {formatServiceCalendarDateTime(window.endsAt)}
                  </Text>
                  <Text numberOfLines={2} style={styles.meta}>
                    {window.reason || "No reason added"}
                  </Text>
                </View>
                <RemoveButton
                  label="Remove blocked time"
                  onPress={() => {
                    setBlockedWindows((current) =>
                      current.filter((_item, itemIndex) => itemIndex !== index),
                    );
                    setDirty(true);
                  }}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>No future blocked time has been added.</Text>
        )}

        <View style={styles.formSurface}>
          <View style={styles.formHeading}>
            <HugeiconsIcon icon={Calendar03Icon} color={colors.primary} size={21} strokeWidth={2.1} />
            <Text style={styles.formTitle}>Add blocked time</Text>
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Block the full day</Text>
              <Text style={styles.meta}>Turn off to choose exact start and end times.</Text>
            </View>
            <Switch
              accessibilityLabel="Block the full day"
              accessibilityRole="switch"
              accessibilityState={{ checked: blockFullDay }}
              onValueChange={setBlockFullDay}
              thumbColor={colors.surface}
              trackColor={{ false: "#D1D5DB", true: colors.primary }}
              value={blockFullDay}
            />
          </View>
          <View style={[styles.responsiveFields, isTablet ? styles.responsiveFieldsTablet : null]}>
            <View style={styles.column}>
              <Field
                label={blockFullDay ? "Blocked date" : "Starts on"}
                value={blockDate}
                onChangeText={setBlockDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            {!blockFullDay ? (
              <>
                <View style={styles.column}>
                  <SelectField
                    label="Starts at"
                    options={START_TIME_OPTIONS}
                    selectedValue={blockStartTime}
                    onSelect={setBlockStartTime}
                  />
                </View>
                <View style={styles.column}>
                  <Field
                    label="Ends on"
                    value={blockEndDate}
                    onChangeText={setBlockEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={styles.column}>
                  <SelectField
                    label="Ends at"
                    options={END_TIME_OPTIONS}
                    selectedValue={blockEndTime}
                    onSelect={setBlockEndTime}
                  />
                </View>
              </>
            ) : null}
          </View>
          <Field
            label="Reason"
            value={blockReason}
            onChangeText={setBlockReason}
            placeholder="Public holiday, technician leave, or workshop closed"
          />
          <Button title="Add blocked time" tone="secondary" onPress={addBlockedWindow} />
        </View>
      </OperationsSection>

      <View style={styles.saveSurface}>
        <View style={styles.saveCopy}>
          <Text style={styles.saveTitle}>
            {dirty ? "Calendar changes are not saved" : "Calendar is up to date"}
          </Text>
          <Text style={styles.meta}>
            Saving rechecks existing visits against working hours, blocked time, capacity, and technician activity.
          </Text>
        </View>
        <Button
          title={mutation.isPending ? "Saving calendar..." : "Save calendar"}
          loading={mutation.isPending}
          disabled={!dirty || mutation.isPending}
          onPress={() => mutation.mutate()}
          style={styles.saveButton}
        />
      </View>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );

  function addTechnician() {
    const name = technicianName.trim();
    if (name.length < 2) {
      setToast({
        visible: true,
        message: "Enter a technician name with at least two characters.",
        type: "error",
      });
      return;
    }
    setTechnicians((current) => [
      ...current,
      {
        name,
        phone: technicianPhone.trim() || null,
        email: technicianEmail.trim() || null,
        skills: skillText
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        isActive: true,
      },
    ]);
    setTechnicianName("");
    setTechnicianPhone("");
    setTechnicianEmail("");
    setSkillText("");
    setDirty(true);
  }

  function addAvailability() {
    const startMinute = timeValueToMinute(startTime);
    const endMinute = timeValueToMinute(endTime);
    const parsedCapacity = Number(capacity);
    if (
      startMinute === null
      || endMinute === null
      || startMinute >= endMinute
      || !Number.isInteger(parsedCapacity)
      || parsedCapacity < 1
      || parsedCapacity > 50
    ) {
      setToast({
        visible: true,
        message: "Choose an end time after the start time and a capacity from 1 to 50.",
        type: "error",
      });
      return;
    }
    setRules((current) => [
      ...current,
      {
        dayOfWeek: Number(dayOfWeek),
        startMinute,
        endMinute,
        capacity: parsedCapacity,
        note: availabilityNote.trim() || null,
        isActive: true,
      },
    ]);
    setAvailabilityNote("");
    setDirty(true);
  }

  function addBlockedWindow() {
    try {
      const startsAt = localDateTimeToIso(
        blockDate,
        blockFullDay ? "00:00" : blockStartTime,
      );
      const endsAt = blockFullDay
        ? localDateTimeToIso(addDaysToDateInput(blockDate, 1), "00:00")
        : blockEndTime === "24:00"
          ? localDateTimeToIso(addDaysToDateInput(blockEndDate, 1), "00:00")
          : localDateTimeToIso(blockEndDate, blockEndTime);
      if (new Date(startsAt) >= new Date(endsAt)) {
        throw new Error("Blocked time must end after it starts.");
      }
      setBlockedWindows((current) => [
        ...current,
        {
          startsAt,
          endsAt,
          reason: blockReason.trim() || null,
          isFullDay: blockFullDay,
        },
      ]);
      setBlockReason("");
      setDirty(true);
    } catch (error) {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : "Enter valid blocked dates and times.",
        type: "error",
      });
    }
  }
}

function CalendarMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.removeButton, pressed ? styles.pressed : null]}
    >
      <HugeiconsIcon icon={Delete02Icon} color={colors.danger} size={19} strokeWidth={2.1} />
    </Pressable>
  );
}

function timeOptions(includeEndOfDay: boolean) {
  const values = Array.from({ length: 48 }, (_unused, index) => index * 30);
  if (includeEndOfDay) values.push(24 * 60);
  return values.map((minute) => ({
    label: timeOptionLabel(minute),
    value: minuteLabel(minute),
  }));
}

function timeOptionLabel(minute: number) {
  if (minute === 24 * 60) return "12:00 AM (next day)";
  const hour = Math.floor(minute / 60);
  const minutePart = minute % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minutePart).padStart(2, "0")} ${period}`;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  summaryBand: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.md,
  },
  metric: {
    flexBasis: "29%",
    flexGrow: 1,
    gap: 2,
    minWidth: 100,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 15,
    textTransform: "uppercase",
  },
  jobGrid: {
    gap: spacing.sm,
  },
  jobGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  jobRow: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 128,
    padding: spacing.md,
  },
  jobRowTablet: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  jobCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  bookingNumber: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  jobTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  listSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  divider: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowTitleLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  rowTitle: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  formSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  formHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  formTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900",
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
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 52,
  },
  switchCopy: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  removeButton: {
    alignItems: "center",
    borderColor: "#F4C2C2",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  saveSurface: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  saveCopy: {
    flex: 1,
    gap: 2,
    minWidth: 220,
  },
  saveTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  saveButton: {
    minWidth: 156,
  },
  pressed: {
    opacity: 0.72,
  },
});
