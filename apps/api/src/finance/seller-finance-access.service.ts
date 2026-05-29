import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RequestUser } from "../auth/types/indihub-request";

@Injectable()
export class SellerFinanceAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async sellerIdForActor(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      select: { id: true }
    });

    if (!seller) {
      throw new ForbiddenException("Seller profile is required.");
    }

    return seller.id;
  }
}

