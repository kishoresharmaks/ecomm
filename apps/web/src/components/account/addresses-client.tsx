"use client";

import { FormEvent, useState } from "react";
import { Edit3, MapPin, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, SectionHeading, StatusBadge } from "@indihub/ui";
import { CustomerAuthNotice } from "@/components/auth/customer-auth-notice";
import { useCustomerAuth } from "@/components/auth/indihub-auth-context";
import { LocationFields } from "@/components/locations/location-fields";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { AccountShell } from "./account-shell";
import {
  EmptyState,
  ErrorPanel,
  Field,
  PagePanel,
  SkeletonBlock,
  formValue,
  optionalFormValue
} from "./account-ui";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  updateCustomerAddress,
  type CustomerAddress,
  type CustomerAddressPayload
} from "@/lib/account-api";

export function AddressesClient() {
  const queryClient = useQueryClient();
  const customerAuth = useCustomerAuth();
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useConfirmationDialog();

  const addressesQuery = useQuery({
    queryKey: ["account-addresses", customerAuth.authKey],
    queryFn: () => listCustomerAddresses(customerAuth.authHeaders),
    enabled: customerAuth.enabled,
    retry: false
  });

  const saveMutation = useMutation({
    mutationFn: (payload: CustomerAddressPayload) => {
      if (!customerAuth.enabled) {
        throw new Error("Sign in before managing addresses.");
      }

      return editing
        ? updateCustomerAddress(customerAuth.authHeaders, editing.id, payload)
        : createCustomerAddress(customerAuth.authHeaders, payload);
    },
    onSuccess: () => {
      setNotice(editing ? "Address updated." : "Address added.");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["account-addresses", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Address save failed.")
  });

  const deleteMutation = useMutation({
    mutationFn: (addressId: string) => {
      if (!customerAuth.enabled) {
        throw new Error("Sign in before managing addresses.");
      }

      return deleteCustomerAddress(customerAuth.authHeaders, addressId);
    },
    onSuccess: () => {
      setNotice("Address deleted.");
      void queryClient.invalidateQueries({ queryKey: ["account-addresses", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Address delete failed.")
  });

  const defaultMutation = useMutation({
    mutationFn: (addressId: string) => {
      if (!customerAuth.enabled) {
        throw new Error("Sign in before managing addresses.");
      }

      return updateCustomerAddress(customerAuth.authHeaders, addressId, { isDefault: true });
    },
    onSuccess: () => {
      setNotice("Default address updated.");
      void queryClient.invalidateQueries({ queryKey: ["account-addresses", customerAuth.authKey] });
      void queryClient.invalidateQueries({ queryKey: ["account-profile", customerAuth.authKey] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Default address update failed.")
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const line2 = optionalFormValue(form, "line2");
    const label = optionalFormValue(form, "label");
    const area = optionalFormValue(form, "area");
    const country = optionalFormValue(form, "country");
    const stateCode = optionalFormValue(form, "stateCode");
    const cityCode = optionalFormValue(form, "cityCode");
    const localAreaCode = optionalFormValue(form, "localAreaCode");
    const payload: CustomerAddressPayload = {
      ...(label ? { label } : {}),
      fullName: formValue(form, "fullName"),
      phone: formValue(form, "phone"),
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
      ...(localAreaCode ? { localAreaCode } : {}),
      isDefault: form.get("isDefault") === "on"
    };

    setNotice(null);
    saveMutation.mutate(payload);
  }

  return (
    <AccountShell title="Address book" description="Save delivery addresses for checkout and order support.">
      {confirmation.confirmationDialog}
      {!customerAuth.enabled ? <CustomerAuthNotice /> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <PagePanel>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <SectionHeading title="Saved addresses" description="Default address is shown first and can be changed any time." />
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              New address
            </Button>
          </div>

          <div className="mt-5 grid gap-3">
            {addressesQuery.isLoading ? <SkeletonBlock className="h-48" /> : null}
            {addressesQuery.error ? <ErrorPanel error={addressesQuery.error} onRetry={() => void addressesQuery.refetch()} /> : null}
            {!addressesQuery.isLoading && addressesQuery.data?.length === 0 ? (
              <EmptyState title="No addresses saved" message="Add a delivery address so checkout and support teams can use accurate contact details." />
            ) : null}
            {addressesQuery.data?.map((address) => (
              <article key={address.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-[#EAF1F7] text-[#163B5C]">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="text-base font-black text-[#1F2933]">{address.label ?? "Delivery address"}</p>
                      {address.isDefault ? <StatusBadge tone="success">Default</StatusBadge> : null}
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-6 text-[#667085]">
                      <p className="font-black text-[#1F2933]">{address.fullName}</p>
                      <p>{address.phone}</p>
                      <p>{address.line1}</p>
                      {address.line2 ? <p>{address.line2}</p> : null}
                      {address.area ? <p>{address.area}</p> : null}
                      <p>
                        {address.city}, {address.state} {address.pincode}
                      </p>
                      <p>{address.country ?? address.countryCode ?? "India"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {!address.isDefault ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={defaultMutation.isPending}
                        onClick={() => defaultMutation.mutate(address.id)}
                      >
                        Make default
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(address)}>
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
                          title: "Delete saved address?",
                          description: `"${address.label ?? address.line1}" will be removed from the customer address book. Existing orders keep their saved checkout snapshot.`,
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
        </PagePanel>

        <PagePanel>
          <SectionHeading
            title={editing ? "Edit address" : "Add address"}
            description={editing ? "Update this saved delivery location." : "Create a new address for checkout."}
          />
          <form key={editing?.id ?? "new-address"} onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="Label" name="label" defaultValue={editing?.label ?? ""} placeholder="Home, Office, Shop" />
            <Field label="Full name" name="fullName" required defaultValue={editing?.fullName ?? ""} />
            <Field label="Phone" name="phone" required pattern="[+]?[0-9][0-9 ()-]{6,24}" defaultValue={editing?.phone ?? ""} />
            <Field label="Address line 1" name="line1" required defaultValue={editing?.line1 ?? ""} />
            <Field label="Address line 2" name="line2" defaultValue={editing?.line2 ?? ""} />
            <LocationFields
              defaultValue={{
                countryCode: editing?.countryCode ?? "IN",
                stateCode: editing?.stateCode ?? undefined,
                cityCode: editing?.cityCode ?? undefined,
                localAreaCode: editing?.localAreaCode ?? undefined,
                country: editing?.country ?? undefined,
                state: editing?.state ?? undefined,
                city: editing?.city ?? undefined,
                area: editing?.area ?? undefined,
                pincode: editing?.pincode ?? undefined
              }}
            />
            <label className="flex items-center gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm font-bold text-[#1F2933]">
              <input name="isDefault" type="checkbox" defaultChecked={editing?.isDefault ?? false} />
              Set as default delivery address
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!customerAuth.enabled || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editing ? "Update address" : "Add address"}
              </Button>
              {editing ? (
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              ) : null}
              {notice ? <StatusBadge tone={saveMutation.isError || deleteMutation.isError || defaultMutation.isError ? "danger" : "success"}>{notice}</StatusBadge> : null}
            </div>
          </form>
        </PagePanel>
      </div>
    </AccountShell>
  );
}
