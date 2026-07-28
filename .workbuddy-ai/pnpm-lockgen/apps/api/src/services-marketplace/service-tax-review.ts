import {
  ApprovalStatus,
  Prisma,
  ServiceListingStatus,
} from "@indihub/database";

export function invalidateSellerServiceTaxReview(
  tx: Prisma.TransactionClient,
  sellerId: string,
) {
  return tx.serviceListing.updateMany({
    where: {
      sellerId,
      deletedAt: null,
      status: { not: ServiceListingStatus.ARCHIVED },
    },
    data: {
      status: ServiceListingStatus.INACTIVE,
      approvalStatus: ApprovalStatus.PENDING_APPROVAL,
      taxReviewRequired: true,
      taxConfigurationVersion: { increment: 1 },
    },
  });
}
