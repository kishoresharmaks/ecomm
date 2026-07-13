import { useEffect, useState } from "react";
import { Linking, Text, View } from "react-native";
import * as Location from "expo-location";
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
  const [locationState, setLocationState] = useState<{
    loading: boolean;
    tone: "info" | "success" | "danger";
    message: string;
  }>({
    loading: false,
    tone: "info",
    message: "Use GPS to set your delivery base location. This helps operations assign nearby orders accurately.",
  });
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
  const hasBaseLocation = Boolean(baseLatitude && baseLongitude);
  const locationStatusStyle =
    locationState.tone === "success"
      ? { backgroundColor: "#E9F7F1", borderColor: "#B7E4CF", color: "#0F5132" }
      : locationState.tone === "danger"
        ? { backgroundColor: "#FDECEC", borderColor: "#F5B5B5", color: "#9F2600" }
        : { backgroundColor: "#EEF6FF", borderColor: "#BFDBFE", color: "#123A5A" };

  const useCurrentLocation = async () => {
    setLocationState({
      loading: true,
      tone: "info",
      message: "Checking location permission...",
    });

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationState({
          loading: false,
          tone: "danger",
          message: "Turn on device location services, then try again.",
        });
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationState({
          loading: false,
          tone: "danger",
          message: "Location permission is needed to save your delivery base. Allow location access in Android settings and try again.",
        });
        return;
      }

      let position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!position.coords.latitude || !position.coords.longitude) {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          position = lastKnown;
        }
      }

      const latitude = position.coords.latitude.toFixed(6);
      const longitude = position.coords.longitude.toFixed(6);
      setBaseLatitude(latitude);
      setBaseLongitude(longitude);
      setLocationState({
        loading: false,
        tone: "success",
        message: `GPS location captured with about ${Math.round(position.coords.accuracy ?? 0)}m accuracy. Save profile to apply it.`,
      });
    } catch (error) {
      setLocationState({
        loading: false,
        tone: "danger",
        message: error instanceof Error ? error.message : "Could not read GPS location. Please try again outdoors or near a window.",
      });
    }
  };

  return (
    <Screen>
      <Header title="Profile" subtitle="Contact, vehicle, GPS base location, workload, and COD exposure." />
      <QueryState loading={profileQuery.isLoading} error={profileQuery.error} onRetry={() => void profileQuery.refetch()} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Metric label="Availability" value={isAvailable ? "Active" : "Inactive"} />
        <Metric label="Workload" value={profile?.activeWorkload ?? 0} />
        <Metric label="COD exposure" value={formatPaise(profile?.pendingCodCashPaise ?? 0)} note={`Limit ${formatPaise(profile?.deliveryProfile.effectiveCodCashLimitPaise ?? 0)}`} />
        <Metric label="Wallet" value={formatPaise(profile?.wallet?.availableBalancePaise ?? 0, profile?.wallet?.currency ?? "INR")} />
        <Metric label="Base location" value={hasBaseLocation ? "Set" : "Not set"} note={hasBaseLocation ? `${baseLatitude}, ${baseLongitude}` : "Use GPS"} />
        <Metric label="Radius" value={serviceRadiusKm ? `${serviceRadiusKm} km` : "Not set"} />
      </View>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>COD handover UPI</Text>
        {profile?.deliveryProfile.razorpayVirtualUpiId ? (
          <>
            <Text selectable style={{ color: "#ED3500", fontSize: 18, fontWeight: "900", marginTop: 8 }}>
              {profile.deliveryProfile.razorpayVirtualUpiId}
            </Text>
            <Text style={{ color: "#6B7280", marginTop: 8 }}>
              Deposit collected COD cash to this UPI ID. Razorpay Smart Collect will automatically clear verified COD exposure after the payment webhook is received.
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: "#9F2600", fontSize: 14, fontWeight: "900", marginTop: 8 }}>
              COD handover setup is in progress.
            </Text>
            <Text style={{ color: "#6B7280", marginTop: 8 }}>
              Your COD deposit QR is being prepared. You can continue deliveries and record COD collections while operations completes the setup.
            </Text>
            <Text style={{ color: "#8A4B1F", fontSize: 12, fontWeight: "800", marginTop: 8 }}>
              Until the QR appears, COD collections stay available for admin or finance verification.
            </Text>
          </>
        )}
      </Card>
      <Card>
        <Text style={{ color: "#123A5A", fontSize: 18, fontWeight: "900" }}>{profile?.fullName || profile?.email || "Delivery partner"}</Text>
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label="Vehicle number" value={vehicleNumber} onChangeText={setVehicleNumber} />
        <Button title={isAvailable ? "Available for assignment" : "Unavailable"} tone={isAvailable ? "primary" : "secondary"} onPress={() => setIsAvailable((current) => !current)} />
        <View style={{ borderColor: "#F3E7E2", borderRadius: 16, borderWidth: 1, gap: 10, padding: 14 }}>
          <Text style={{ color: "#123A5A", fontSize: 16, fontWeight: "900" }}>Delivery base GPS location</Text>
          <Text style={{ color: "#6B7280", fontWeight: "700", lineHeight: 20 }}>
            Stand at your normal pickup or service starting point, then capture the location. Manual coordinate entry is not needed.
          </Text>
          {hasBaseLocation ? (
            <Text selectable style={{ color: "#123A5A", fontWeight: "900" }}>
              {baseLatitude}, {baseLongitude}
            </Text>
          ) : null}
          <View
            style={{
              backgroundColor: locationStatusStyle.backgroundColor,
              borderColor: locationStatusStyle.borderColor,
              borderRadius: 12,
              borderWidth: 1,
              padding: 10,
            }}
          >
            <Text style={{ color: locationStatusStyle.color, fontSize: 13, fontWeight: "800", lineHeight: 19 }}>
              {locationState.message}
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <Button title={hasBaseLocation ? "Update GPS location" : "Use current GPS location"} loading={locationState.loading} onPress={useCurrentLocation} />
            {locationState.tone === "danger" ? (
              <Button title="Open Android settings" tone="secondary" onPress={() => void Linking.openSettings()} />
            ) : null}
          </View>
        </View>
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
