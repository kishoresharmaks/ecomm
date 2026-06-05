import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ApprovalStatus, ProductStatus, SellerStatus, UserStatus } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { LocationsService } from "../locations/locations.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from "./dto/customer-address.dto";
import { UpdateCustomerProfileDto } from "./dto/customer-profile.dto";

@Injectable()
export class CustomersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LocationsService) private readonly locationsService: LocationsService
  ) {}

  async ensureCustomerForUser(actor: RequestUser) {
    return this.prisma.client.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { userId: actor.id },
        update: {},
        create: {
          userId: actor.id,
          displayName: actor.email,
          status: UserStatus.ACTIVE
        }
      });

      await tx.wishlist.upsert({
        where: { customerId: customer.id },
        update: {},
        create: { customerId: customer.id }
      });

      return customer;
    });
  }

  async getProfile(actor: RequestUser) {
    const customer = await this.ensureCustomerForUser(actor);

    return this.prisma.client.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: {
        user: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        },
        wishlist: {
          include: {
            items: true
          }
        },
        _count: {
          select: {
            orders: true
          }
        }
      }
    });
  }

  async updateProfile(actor: RequestUser, dto: UpdateCustomerProfileDto) {
    const customer = await this.ensureCustomerForUser(actor);

    const [user, updatedCustomer] = await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: actor.id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {})
        }
      });
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {})
        }
      });

      return [user, updatedCustomer] as const;
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "customer.profile.updated",
        entityType: "customer",
        entityId: customer.id,
        newValue: {
          fullName: user.fullName,
          phone: user.phone,
          displayName: updatedCustomer.displayName
        }
      }
    });

    return this.getProfile(actor);
  }

  async listAddresses(actor: RequestUser) {
    const customer = await this.ensureCustomerForUser(actor);

    return this.prisma.client.customerAddress.findMany({
      where: { customerId: customer.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });
  }

  async createAddress(actor: RequestUser, dto: CreateCustomerAddressDto) {
    const customer = await this.ensureCustomerForUser(actor);
    const location = await this.locationsService.resolveAddressLocation(dto);

    return this.prisma.client.$transaction(async (tx) => {
      const existingAddressCount = await tx.customerAddress.count({
        where: { customerId: customer.id }
      });
      const isDefault = dto.isDefault ?? existingAddressCount === 0;

      if (isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id },
          data: { isDefault: false }
        });
      }

      const address = await tx.customerAddress.create({
        data: {
          customerId: customer.id,
          label: dto.label ?? null,
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          area: location.area,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          country: location.country,
          countryCode: location.countryCode,
          stateCode: location.stateCode,
          cityCode: location.cityCode,
          localAreaCode: location.localAreaCode,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          locationSource: dto.locationSource ?? null,
          accuracyMeters: dto.accuracyMeters ?? null,
          locationConfidenceScore: dto.locationConfidenceScore ?? null,
          isDefault
        }
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "customer.address.created",
          entityType: "customer_address",
          entityId: address.id,
          newValue: address
        }
      });

      return address;
    });
  }

  async updateAddress(actor: RequestUser, addressId: string, dto: UpdateCustomerAddressDto) {
    const customer = await this.ensureCustomerForUser(actor);
    const existing = await this.getAddressForCustomerOrThrow(customer.id, addressId);
    const location =
      dto.countryCode !== undefined ||
      dto.stateCode !== undefined ||
      dto.cityCode !== undefined ||
      dto.localAreaCode !== undefined ||
      dto.country !== undefined ||
      dto.state !== undefined ||
      dto.city !== undefined ||
      dto.area !== undefined ||
      dto.pincode !== undefined
        ? await this.locationsService.resolveAddressLocation({
            countryCode: dto.countryCode ?? existing.countryCode,
            stateCode: dto.stateCode ?? existing.stateCode,
            cityCode: dto.cityCode ?? existing.cityCode,
            localAreaCode: dto.localAreaCode ?? existing.localAreaCode,
            country: dto.country ?? existing.country,
            state: dto.state ?? existing.state,
            city: dto.city ?? existing.city,
            area: dto.area ?? existing.area,
            pincode: dto.pincode ?? existing.pincode
          })
        : null;

    return this.prisma.client.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId: customer.id },
          data: { isDefault: false }
        });
      }

      const address = await tx.customerAddress.update({
        where: { id: addressId },
        data: {
          ...(dto.label !== undefined ? { label: dto.label ?? null } : {}),
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.line1 !== undefined ? { line1: dto.line1 } : {}),
          ...(dto.line2 !== undefined ? { line2: dto.line2 ?? null } : {}),
          ...(location
            ? {
                area: location.area,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                country: location.country,
                countryCode: location.countryCode,
                stateCode: location.stateCode,
                cityCode: location.cityCode,
                localAreaCode: location.localAreaCode
              }
            : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude ?? null } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude ?? null } : {}),
          ...(dto.locationSource !== undefined ? { locationSource: dto.locationSource ?? null } : {}),
          ...(dto.accuracyMeters !== undefined ? { accuracyMeters: dto.accuracyMeters ?? null } : {}),
          ...(dto.locationConfidenceScore !== undefined
            ? { locationConfidenceScore: dto.locationConfidenceScore ?? null }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {})
        }
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "customer.address.updated",
          entityType: "customer_address",
          entityId: address.id,
          oldValue: existing,
          newValue: address
        }
      });

      return address;
    });
  }

  async deleteAddress(actor: RequestUser, addressId: string) {
    const customer = await this.ensureCustomerForUser(actor);
    const existing = await this.getAddressForCustomerOrThrow(customer.id, addressId);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerAddress.delete({
        where: { id: addressId }
      });

      if (existing.isDefault) {
        const nextDefault = await tx.customerAddress.findFirst({
          where: { customerId: customer.id },
          orderBy: { createdAt: "desc" }
        });

        if (nextDefault) {
          await tx.customerAddress.update({
            where: { id: nextDefault.id },
            data: { isDefault: true }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "customer.address.deleted",
          entityType: "customer_address",
          entityId: addressId,
          oldValue: existing
        }
      });
    });

    return { deleted: true };
  }

  async getWishlist(actor: RequestUser) {
    const customer = await this.ensureCustomerForUser(actor);
    const wishlist = await this.ensureWishlist(customer.id);

    return this.prisma.client.wishlist.findUniqueOrThrow({
      where: { id: wishlist.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                seller: true,
                images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
                variants: { orderBy: { createdAt: "asc" } }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });
  }

  async addWishlistItem(actor: RequestUser, productId: string) {
    const customer = await this.ensureCustomerForUser(actor);
    const wishlist = await this.ensureWishlist(customer.id);
    const product = await this.prisma.client.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
        seller: {
          status: SellerStatus.APPROVED,
          approvalStatus: ApprovalStatus.APPROVED
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Active product not found.");
    }

    await this.prisma.client.wishlistItem.upsert({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId
        }
      },
      update: {},
      create: {
        wishlistId: wishlist.id,
        productId
      }
    });

    return this.getWishlist(actor);
  }

  async removeWishlistItem(actor: RequestUser, productId: string) {
    const customer = await this.ensureCustomerForUser(actor);
    const wishlist = await this.ensureWishlist(customer.id);

    await this.prisma.client.wishlistItem.deleteMany({
      where: {
        wishlistId: wishlist.id,
        productId
      }
    });

    return this.getWishlist(actor);
  }

  async getAddressForCustomerOrThrow(customerId: string, addressId: string) {
    const address = await this.prisma.client.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId
      }
    });

    if (!address) {
      throw new ForbiddenException("Address does not belong to this customer.");
    }

    return address;
  }

  private async ensureWishlist(customerId: string) {
    return this.prisma.client.wishlist.upsert({
      where: { customerId },
      update: {},
      create: { customerId }
    });
  }
}
