import "dotenv/config";
import { prisma } from "../../packages/database/src/index";
import {
  encryptSellerPayoutValue,
  sellerPayoutLast4,
  sellerPayoutUpiHint,
} from "../../apps/api/src/common/seller-payout-secret";

const apply = process.argv.includes("--apply");

async function main() {
  const rows = await prisma.sellerPayoutProfile.findMany({
    where: {
      OR: [
        { legacyAccountNumber: { not: null } },
        { legacyIfscCode: { not: null } },
        { legacyUpiId: { not: null } },
      ],
    },
    select: {
      id: true,
      legacyAccountNumber: true,
      legacyIfscCode: true,
      legacyUpiId: true,
    },
  });

  console.log(`Seller payout profiles awaiting encryption: ${rows.length}`);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply after reviewing the migration and backup.");
    return;
  }
  if (process.env.INDIHUB_ALLOW_SELLER_PAYOUT_BACKFILL !== "true") {
    throw new Error(
      "Set INDIHUB_ALLOW_SELLER_PAYOUT_BACKFILL=true for this approved one-time backfill.",
    );
  }

  for (const row of rows) {
    const accountNumber = row.legacyAccountNumber?.trim() || null;
    const ifscCode = row.legacyIfscCode?.trim() || null;
    const upiId = row.legacyUpiId?.trim() || null;
    await prisma.sellerPayoutProfile.update({
      where: { id: row.id },
      data: {
        accountNumberEncrypted: accountNumber
          ? encryptSellerPayoutValue(accountNumber)
          : null,
        accountNumberLast4: sellerPayoutLast4(accountNumber),
        ifscCodeEncrypted: ifscCode ? encryptSellerPayoutValue(ifscCode) : null,
        upiIdEncrypted: upiId ? encryptSellerPayoutValue(upiId) : null,
        upiIdHint: sellerPayoutUpiHint(upiId),
        legacyAccountNumber: null,
        legacyIfscCode: null,
        legacyUpiId: null,
        isVerified: false,
      },
    });
  }

  console.log(`Encrypted ${rows.length} seller payout profiles. Verification was reset.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seller payout backfill failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
