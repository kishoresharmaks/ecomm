export type PackageDraft = {
  weightGrams: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
};

type PackageDimensions = {
  id: string;
  weightGrams?: number | null;
  lengthCm?: number | null;
  breadthCm?: number | null;
  heightCm?: number | null;
};

export function mergePackageDrafts(
  current: Record<string, PackageDraft>,
  packages: PackageDimensions[],
  dirtyPackageIds: ReadonlySet<string>,
) {
  const next: Record<string, PackageDraft> = {};

  for (const shipmentPackage of packages) {
    const currentDraft = current[shipmentPackage.id];
    next[shipmentPackage.id] = dirtyPackageIds.has(shipmentPackage.id) && currentDraft
      ? currentDraft
      : {
          weightGrams: shipmentPackage.weightGrams ? String(shipmentPackage.weightGrams) : "",
          lengthCm: shipmentPackage.lengthCm ? String(shipmentPackage.lengthCm) : "",
          breadthCm: shipmentPackage.breadthCm ? String(shipmentPackage.breadthCm) : "",
          heightCm: shipmentPackage.heightCm ? String(shipmentPackage.heightCm) : "",
        };
  }

  return next;
}
