import { Prisma } from "@indihub/database";

type ServiceAreaInput = {
  countryCode?: string | null;
  stateCode?: string | null;
  cityCode?: string | null;
  pincodes?: string[] | null;
  localAreaCodes?: string[] | null;
  priority?: number | null;
};

type ProfileServiceArea = {
  isActive?: boolean | null;
  pincode?: string | null;
  localAreaCode?: string | null;
};

type ProfileWithServiceAreas = {
  serviceAreas?: ProfileServiceArea[] | null;
} | null;

export function cleanDeliveryPartnerServiceCodes(values?: string[] | null) {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  );
}

export function deliveryPartnerPincodesFromServiceAreas(profile: ProfileWithServiceAreas) {
  return cleanDeliveryPartnerServiceCodes(
    (profile?.serviceAreas ?? [])
      .filter((area) => area.isActive !== false)
      .map((area) => area.pincode)
      .filter((value): value is string => Boolean(value)),
  );
}

export function deliveryPartnerLocalAreaCodesFromServiceAreas(
  profile: ProfileWithServiceAreas,
) {
  return cleanDeliveryPartnerServiceCodes(
    (profile?.serviceAreas ?? [])
      .filter((area) => area.isActive !== false)
      .map((area) => area.localAreaCode)
      .filter((value): value is string => Boolean(value)),
  );
}

export async function replaceDeliveryPartnerServiceAreas(
  tx: Prisma.TransactionClient,
  partnerProfileId: string,
  input: ServiceAreaInput,
) {
  const pincodes = cleanDeliveryPartnerServiceCodes(input.pincodes);
  const localAreaCodes = cleanDeliveryPartnerServiceCodes(input.localAreaCodes);
  const base = {
    partnerProfileId,
    countryCode: input.countryCode ?? null,
    stateCode: input.stateCode ?? null,
    cityCode: input.cityCode ?? null,
    priority: input.priority ?? 100,
    isActive: true,
  };
  const rows: Prisma.DeliveryPartnerServiceAreaCreateManyInput[] = [
    ...pincodes.map((pincode) => ({
      ...base,
      pincode,
      localAreaCode: null,
    })),
    ...localAreaCodes.map((localAreaCode) => ({
      ...base,
      pincode: null,
      localAreaCode,
    })),
  ];

  await tx.deliveryPartnerServiceArea.deleteMany({
    where: { partnerProfileId },
  });

  if (rows.length > 0) {
    await tx.deliveryPartnerServiceArea.createMany({ data: rows });
  }
}
