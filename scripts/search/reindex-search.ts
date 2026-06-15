import {
  Prisma,
  SearchDocumentEntityType,
  SearchIndexJobStatus,
  prisma,
} from "@indihub/database";
import { processSearchIndexJobs } from "../../apps/worker/src/search-index-worker";

const batchSize = positiveInteger(process.env.SEARCH_INDEX_BATCH_SIZE, 50);

async function main() {
  const [products, sellers, categories] = await Promise.all([
    prisma.product.findMany({ select: { id: true } }),
    prisma.seller.findMany({ select: { id: true } }),
    prisma.category.findMany({ select: { id: true } }),
  ]);

  for (const product of products) {
    await enqueue(SearchDocumentEntityType.PRODUCT, product.id);
  }
  for (const seller of sellers) {
    await enqueue(SearchDocumentEntityType.STORE, seller.id);
  }
  for (const category of categories) {
    await enqueue(SearchDocumentEntityType.CATEGORY, category.id);
  }

  const queued = products.length + sellers.length + categories.length;
  let claimed = 0;
  let completed = 0;
  let failed = 0;

  while (true) {
    const result = await processSearchIndexJobs(batchSize);
    if (result.claimed === 0) {
      break;
    }

    claimed += result.claimed;
    completed += result.completed;
    failed += result.failed;
  }

  const [documentCount, remainingJobs, nilkamalDocuments] = await Promise.all([
    prisma.searchDocument.count(),
    prisma.searchIndexJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.searchDocument.findMany({
      where: {
        title: {
          contains: "Nilkamal",
          mode: "insensitive",
        },
      },
      select: {
        entityType: true,
        title: true,
        visibilityStatus: true,
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        queued,
        claimed,
        completed,
        failed,
        documentCount,
        remainingJobs: remainingJobs.map((job) => ({
          status: job.status,
          count: job._count._all,
        })),
        nilkamalDocuments,
      },
      null,
      2,
    ),
  );
}

async function enqueue(entityType: SearchDocumentEntityType, entityId: string) {
  const dedupeKey = `${entityType}:${entityId}`;

  await prisma.searchIndexJob.upsert({
    where: { dedupeKey },
    update: {
      status: SearchIndexJobStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      lockedAt: null,
      completedAt: null,
      lastError: null,
      payload: { reason: "cli-full-reindex" },
    },
    create: {
      entityType,
      entityId,
      dedupeKey,
      payload: { reason: "cli-full-reindex" },
    },
  });
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
