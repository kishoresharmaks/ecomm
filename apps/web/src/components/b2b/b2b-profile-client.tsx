"use client";

import { FormEvent, useState } from "react";
import { Edit3, MapPin, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { IndihubApiError } from "@/lib/api";
import { LocationFields } from "@/components/locations/location-fields";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import {
  createBusinessBuyerAddress,
  deleteBusinessBuyerAddress,
  getBusinessBuyerProfile,
  listBusinessBuyerAddresses,
  updateBusinessBuyerAddress,
  upsertBusinessBuyerProfile,
  type BusinessBuyerAddress,
  type BusinessBuyerAddressPayload,
  type BusinessBuyerProfilePayload
} from "@/lib/business-buyer-api";
import { B2BAuthNotice, useB2BAuth } from "./b2b-auth";
import { B2BShell } from "./b2b-shell";
import {
  B2BEmptyState,
  B2BErrorPanel,
  B2BField,
  B2BPanel,
  B2BSkeleton,
  B2BStatusPill,
  formValue,
  optionalFormValue
} from "./b2b-ui";

export function B2BProfileClient({ onboarding = false }: { onboarding?: boolean }) {
  const auth = useB2BAuth();
  const queryClient = useQueryClient();
  const [editingAddress, setEditingAddress] = useState<BusinessBuyerAddress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const profileQuery = useQuery({
    queryKey: ["b2b-profile", auth.authKey],
    queryFn: () => getBusinessBuyerProfile(auth.authHeaders),
    enabled: auth.enabled,
    retry: false
  });
  const profileMissing = profileQuery.error instanceof IndihubApiError && profileQuery.error.status === 404;
  const addressesQuery = useQuery({
    queryKey: ["b2b-addresses", auth.authKey],
    queryFn: () => listBusinessBuyerAddresses(auth.authHeaders),
    enabled: auth.enabled && Boolean(profileQuery.data),
    retry: false
  });

  const profileMutation = useMutation({
    mutationFn: (payload: BusinessBuyerProfilePayload) => upsertBusinessBuyerProfile(auth.authHeaders, payload),
    onSuccess: () => {
      setNotice("Business profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-profile", auth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-addresses", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Business profile save failed.")
  });

  const addressMutation = useMutation({
    mutationFn: (payload: BusinessBuyerAddressPayload) => {
      if (editingAddress) {
        return updateBusinessBuyerAddress(auth.authHeaders, editingAddress.id, payload);
      }

      return createBusinessBuyerAddress(auth.authHeaders, payload);
    },
    onSuccess: () => {
      setNotice(editingAddress ? "Business address updated." : "Business address added.");
      setEditingAddress(null);
      void queryClient.invalidateQueries({ queryKey: ["b2b-addresses", auth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-profile", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Business address save failed.")
  });

  const deleteMutation = useMutation({
    mutationFn: (addressId: string) => deleteBusinessBuyerAddress(auth.authHeaders, addressId),
    onSuccess: () => {
      setNotice("Business address deleted.");
      void queryClient.invalidateQueries({ queryKey: ["b2b-addresses", auth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["b2b-profile", auth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Business address delete failed.")
  });

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const gstNumber = optionalFormValue(form, "gstNumber");
    const payload: BusinessBuyerProfilePayload = {
      companyName: formValue(form, "companyName"),
      ...(gstNumber ? { gstNumber: gstNumber.toUpperCase() } : {}),
      contactName: formValue(form, "contactName"),
      contactPhone: formValue(form, "contactPhone")
    };

    setNotice(null);
    profileMutation.mutate(payload);
  }

  function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const line2 = optionalFormValue(form, "line2");
    const area = optionalFormValue(form, "area");
    const country = optionalFormValue(form, "country");
    const stateCode = optionalFormValue(form, "stateCode");
    const cityCode = optionalFormValue(form, "cityCode");
    const localAreaCode = optionalFormValue(form, "localAreaCode");
    const payload: BusinessBuyerAddressPayload = {
      line1: formValue(form, "line1"),
      ...(line2 ? { line2 } : {}),
      ...(area ? { area } : {}),
      city: formValue(form, "city"),
      state: formValue(form, "state"),
      pincode: formValue(form, "pincode"),
      ...(country ? { country } : {}),
      countryCode: formValue(form, "countryCode"),
      ...(stateCode ? { stateCode } : {}),
      ...(cityCode ? { cityCode } : {}),
      ...(localAreaCode ? { localAreaCode } : {})
    };

    setNotice(null);
    addressMutation.mutate(payload);
  }

  const title = onboarding ? "Register business buyer account" : "Company profile";
  const description = onboarding
    ? "Create the company profile required for bulk product enquiries and quotation requests."
    : "Maintain company, GST, contact, and procurement address details for B2B enquiries.";

  return (
    <B2BShell title={title} description={description}>
      {confirmation.confirmationDialog}
      <B2BAuthNotice />
      {auth.enabled && profileQuery.isLoading ? <B2BSkeleton /> : null}
      {profileQuery.error && !profileMissing ? <B2BErrorPanel error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <B2BPanel>
          <SectionHeading
            title={profileMissing ? "Business registration" : "Business details"}
            description="Use the official company and contact details buyers and sellers can trust."
          />
          {profileQuery.data ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <B2BStatusPill status={profileQuery.data.status} />
              <span className="text-sm font-semibold text-[#667085]">{profileQuery.data.user?.email}</span>
            </div>
          ) : null}
          <form key={profileQuery.data?.updatedAt ?? profileQuery.data?.id ?? "new-profile"} onSubmit={submitProfile} className="mt-6 grid gap-4 md:grid-cols-2">
            <B2BField label="Company name" name="companyName" required defaultValue={profileQuery.data?.companyName ?? ""} />
            <B2BField
              label="GST number"
              name="gstNumber"
              pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]"
              defaultValue={profileQuery.data?.gstNumber ?? ""}
              placeholder="33ABCDE1234F1Z5"
            />
            <B2BField label="Contact name" name="contactName" required defaultValue={profileQuery.data?.contactName ?? ""} />
            <B2BField
              label="Contact phone"
              name="contactPhone"
              required
              pattern="[6-9][0-9]{9}"
              defaultValue={profileQuery.data?.contactPhone ?? ""}
            />
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={!auth.enabled || profileMutation.isPending}>
                {profileMutation.isPending ? "Saving..." : "Save business profile"}
              </Button>
              {notice ? (
                <StatusBadge tone={profileMutation.isError || addressMutation.isError || deleteMutation.isError ? "danger" : "success"}>
                  {notice}
                </StatusBadge>
              ) : null}
            </div>
          </form>
        </B2BPanel>

        <B2BPanel>
          <SectionHeading
            title={editingAddress ? "Edit procurement address" : "Add procurement address"}
            description="Use normalized locations so sellers can estimate fulfilment correctly."
          />
          {!profileQuery.data ? (
            <B2BEmptyState
              title="Profile required first"
              message="Save the business profile before adding procurement addresses."
            />
          ) : (
            <form key={editingAddress?.id ?? "new-address"} onSubmit={submitAddress} className="mt-5 grid gap-4">
              <B2BField label="Address line 1" name="line1" required defaultValue={editingAddress?.line1 ?? ""} />
              <B2BField label="Address line 2" name="line2" defaultValue={editingAddress?.line2 ?? ""} />
              <LocationFields
                defaultValue={{
                  countryCode: editingAddress?.countryCode ?? "IN",
                  stateCode: editingAddress?.stateCode ?? undefined,
                  cityCode: editingAddress?.cityCode ?? undefined,
                  localAreaCode: editingAddress?.localAreaCode ?? undefined,
                  country: editingAddress?.country ?? undefined,
                  state: editingAddress?.state ?? undefined,
                  city: editingAddress?.city ?? undefined,
                  area: editingAddress?.area ?? undefined,
                  pincode: editingAddress?.pincode ?? undefined
                }}
              />
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={addressMutation.isPending}>
                  {addressMutation.isPending ? "Saving..." : editingAddress ? "Update address" : "Add address"}
                </Button>
                {editingAddress ? (
                  <Button type="button" variant="outline" onClick={() => setEditingAddress(null)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </B2BPanel>
      </div>

      <B2BPanel className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading title="Procurement addresses" description="Saved business locations used for enquiries and fulfilment discussions." />
          <Button type="button" variant="outline" onClick={() => setEditingAddress(null)}>
            New address
          </Button>
        </div>
        <div className="mt-5 grid gap-3">
          {addressesQuery.isLoading ? <B2BSkeleton className="h-40" /> : null}
          {addressesQuery.error ? <B2BErrorPanel error={addressesQuery.error} onRetry={() => void addressesQuery.refetch()} /> : null}
          {!addressesQuery.isLoading && profileQuery.data && addressesQuery.data?.length === 0 ? (
            <B2BEmptyState title="No procurement addresses" message="Add at least one business location for quotation and delivery planning." />
          ) : null}
          {addressesQuery.data?.map((address) => (
            <article key={address.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-[#FFF0EA] text-[#ED3500]">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="text-sm font-semibold leading-6 text-[#667085]">
                    <p className="font-black text-[#1F2933]">{address.line1}</p>
                    {address.line2 ? <p>{address.line2}</p> : null}
                    {address.area ? <p>{address.area}</p> : null}
                    <p>
                      {address.city}, {address.state} {address.pincode}
                    </p>
                    <p>{address.country ?? address.countryCode ?? "India"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingAddress(address)}>
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={deleteMutation.isPending}
                    onClick={() =>
                      confirmation.requestConfirmation({
                        title: "Delete procurement address?",
                        description: `"${address.line1}" will be removed from this B2B profile. Existing enquiries keep their submitted snapshots.`,
                        confirmLabel: "Delete address",
                        onConfirm: () => deleteMutation.mutate(address.id)
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </B2BPanel>
    </B2BShell>
  );
}
