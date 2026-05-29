import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { HsnMasterQueryDto } from "./dto/hsn-master-query.dto";

@Injectable()
export class HsnMasterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listSuggestions(query: HsnMasterQueryDto) {
    const search = query.search?.trim();
    const limit = query.limit ?? 10;
    const filters: Prisma.HsnMasterWhereInput[] = [{ isActive: true }];

    if (query.categoryId) {
      filters.push({
        OR: [{ categoryId: query.categoryId }, { categoryId: null }],
      });
    }

    if (search) {
      filters.push({
        OR: [
          { hsnCode: { contains: search } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    return this.prisma.client.hsnMaster.findMany({
      where: { AND: filters },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ categoryId: "desc" }, { hsnCode: "asc" }],
      take: limit,
    });
  }
}
