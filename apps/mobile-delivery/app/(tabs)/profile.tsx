import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Field, Header, Metric, QueryState, Screen, StatusChip, formatPaise } from "../../src/components/screen";
import { getDeliveryProfile, updateDeliveryProfile } from "../../src/features/delivery/delivery-api";
import { useMobileDeliveryAuth } from "../../src/auth/mobile-delivery-auth-context";

export default function DeliveryProfileScreen() {
  const auth = useMobileDeliveryAuth();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [baseLatitude, setBaseLatitude] = useState("");
  const [baseLongitude, setBaseLongitude] = useState("");
  const [serviceRadiusKm, setServiceRadiusKm] = useState("");
  const [notes, setNotes] = useState("");
  const profileQuery = useQuery({
    queryKey: ["delivery-profile", auth.authKey],
    queryFn: () => getDeliveryProfile(auth.authHeaders),
    enabled: auth.enabled,
  });
  const updateMutation = useMutation({
    mutationFn: () =>
      updateDeliveryProfile(auth.authHeaders, {
        phone,
        vehicleNumber,
        isAvailable,
        ...optionalNumberPayload("baseLatitude", baseLatitude),
        ...optionalNumberPayload("baseLongitude", baseLongitude),
        ...optionalPositiveIntegerPayload("serviceRadiusKm", serviceRadiusKm),
        notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
    },
  });

  useEffect(() => {
    const profile = profileQuery.data?.deliveryProfile;
    if (profile) {
      setPhone(profile.phone ?? profileQuery.data?.phone ?? "");
      setVehicleNumber(profile.vehicleNumber ?? "");
      setIsAvailable(profile.isAvailable ?? true);
      setBaseLatitude(profile.baseLatitude ?? "");
      setBaseLongitude(profile.baseLongitude ?? "");
      setServiceRadiusKm(profile.serviceRadiusKm ? String(profile.serviceRadiusKm) : "");
      setNotes(profile.notes ?? "");
    }
  }, [profileQuery.data]);

  const profile = profileQuery.data;

  return (
    <Screen>
      <Header title="Profile" subtitle="Contact, vehicle, availability, workload, and COD exposure." />
      <QueryState loading={profileQuery.isLoading} error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Metric label="Availability" value={isAvailable ? "Active" : "Inactive"} />
        <Metric label="Workload" value={profile?.activeWorkload ?? 0} />
        <Metric label="COD exposure" value={formatPaise(profile?.pendingCodCashPaise ?? 0)} note={`Limit ${formatPaise(profile?.deliveryProfile.effectiveCodCashLimitPaise ?? 0)}`} />
        <Metric label="Wallet" value={formatPaise(profile?.wallet?.availableBalancePaise ?? 0, profile?.wallet?.currency ?? "INR")} />
        <Metric label="Radius" value={serviceRadiusKm ? `${serviceRadiusKm} km` : "Not set"} />
      </View>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>{profile?.fullName || profile?.email || "Delivery partner"}</Text>
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Vehicle number" value={vehicleNumber} onChangeText={setVehicleNumber} />
        <Button title={isAvailable ? "Available for assignment" : "Unavailable"} tone={isAvailable ? "primary" : "secondary"} onPress={() => setIsAvailable((current) => !current)} />
        <Field label="Base latitude" value={baseLatitude} onChangeText={setBaseLatitude} keyboardType="decimal-pad" />
        <Field label="Base longitude" value={baseLongitude} onChangeText={setBaseLongitude} keyboardType="decimal-pad" />
        <Field label="Service radius km" value={serviceRadiusKm} onChangeText={setServiceRadiusKm} keyboardType="number-pad" />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
        {updateMutation.isSuccess ? <StatusChip label="Profile saved" tone="success" /> : null}
        {updateMutation.error ? <Text style={{ color: "#D64545", fontWeight: "800" }}>{updateMutation.error.message}</Text> : null}
        <Button title="Save profile" loading={updateMutation.isPending} onPress={() => updateMutation.mutate()} />
      </Card>
    </Screen>
  );
}

function optionalNumberPayload<Key extends "baseLatitude" | "baseLongitude">(
  key: Key,
  value: string,
): Partial<Record<Key, number>> {
  const normalized = value.trim();
  if (!normalized) {
    return {};
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? ({ [key]: parsed } as Partial<Record<Key, number>>) : {};
}

function optionalPositiveIntegerPayload<Key extends "serviceRadiusKm">(
  key: Key,
  value: string,
): Partial<Record<Key, number>> {
  const normalized = value.trim();
  if (!normalized) {
    return {};
  }
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0
    ? ({ [key]: parsed } as Partial<Record<Key, number>>)
    : {};
}
