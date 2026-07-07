import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const profiles = await prisma.sellerPayoutProfile.findMany();
  console.log(JSON.stringify(profiles, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
