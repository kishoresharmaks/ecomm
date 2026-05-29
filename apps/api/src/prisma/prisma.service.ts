import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { prisma } from "@indihub/database";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client = prisma;

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
