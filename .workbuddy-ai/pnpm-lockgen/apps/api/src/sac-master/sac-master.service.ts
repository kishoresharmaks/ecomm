import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { SacMasterQueryDto } from "./dto/sac-master-query.dto";

@Injectable()
export class SacMasterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listSuggestions(query: SacMasterQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SacMasterWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { sacCode: { contains: search } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.client.sacMaster.findMany({
      where,
      select: {
        id: true,
        sacCode: true,
        description: true,
        sourceReference: true,
        effectiveDate: true,
      },
      orderBy: { sacCode: "asc" },
      take: Math.min(query.limit ?? 10, 25),
    });
  }
}
