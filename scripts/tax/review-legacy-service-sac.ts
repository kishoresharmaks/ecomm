import "dotenv/config";
import {
  ApprovalStatus,
  ServiceListingStatus,
  prisma,
} from "../../packages/database/src/index";

const apply = process.argv.includes("--apply");

async function main() {
  const where = {
    deletedAt: null,
    status: ServiceListingStatus.ACTIVE,
    approvalStatus: ApprovalStatus.APPROVED,
    taxReviewRequired: false,
    sacCode: null,
  } as const;
  const candidates = await prisma.serviceListing.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      taxClassification: true,
      gstRatePercent: true,
      seller: { select: { storeName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `${apply ? "Legacy SAC review apply" : "Legacy SAC review dry run"} candidates=${candidates.length}`,
  );
  if (candidates.length) {
    console.table(
      candidates.slice(0, 100).map((listing) => ({
        id: listing.id,
        service: listing.title,
        seller: listing.seller.storeName,
        classification: listing.taxClassification,
        gstRate: Number(listing.gstRatePercent ?? 0),
        reason: "Active approved listing has no SAC snapshot source",
      })),
    );
  }

  if (!apply) {
    console.log(
      "No database changes were made. Review/export this list before running the apply command.",
    );
    return;
  }
  if (process.env.INDIHUB_ALLOW_SAC_LEGACY_REVIEW !== "true") {
    throw new Error(
      "Set INDIHUB_ALLOW_SAC_LEGACY_REVIEW=true for this approved legacy listing review operation.",
    );
  }
  if (!candidates.length) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceListing.updateMany({
      where: { id: { in: candidates.map((listing) => listing.id) }, ...where },
      data: {
        status: ServiceListingStatus.INACTIVE,
        approvalStatus: ApprovalStatus.PENDING_APPROVAL,
        taxReviewRequired: true,
        taxConfigurationVersion: { increment: 1 },
      },
    });
    await tx.auditLog.createMany({
      data: candidates.map((listing) => ({
        action: "service_listing.legacy_sac_review_required",
        entityType: "service_listing",
        entityId: listing.id,
        oldValue: {
          status: ServiceListingStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
          sacCode: null,
          taxClassification: listing.taxClassification,
          gstRatePercent: Number(listing.gstRatePercent ?? 0),
        },
        newValue: {
          status: ServiceListingStatus.INACTIVE,
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          taxReviewRequired: true,
          reason: "SAC classification requires seller correction and admin review.",
        },
      })),
    });
  });

  console.log(`${candidates.length} legacy service listings were returned for tax review.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Legacy SAC review failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
