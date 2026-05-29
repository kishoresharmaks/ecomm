import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CustomersService } from "./customers.service";
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from "./dto/customer-address.dto";
import { UpdateCustomerProfileDto } from "./dto/customer-profile.dto";
import { WishlistItemDto } from "./dto/wishlist.dto";

@ApiTags("Customer Account")
@Roles(RoleCode.CUSTOMER)
@Controller("account")
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customersService: CustomersService) {}

  @Get("profile")
  @ApiOperation({ summary: "Read the authenticated customer profile." })
  getProfile(@CurrentUser() actor: RequestUser) {
    return this.customersService.getProfile(actor);
  }

  @Patch("profile")
  @ApiOperation({ summary: "Update customer profile basics." })
  updateProfile(@CurrentUser() actor: RequestUser, @Body() dto: UpdateCustomerProfileDto) {
    return this.customersService.updateProfile(actor, dto);
  }

  @Get("addresses")
  @ApiOperation({ summary: "List customer delivery addresses." })
  listAddresses(@CurrentUser() actor: RequestUser) {
    return this.customersService.listAddresses(actor);
  }

  @Post("addresses")
  @ApiOperation({ summary: "Create a customer delivery address." })
  createAddress(@CurrentUser() actor: RequestUser, @Body() dto: CreateCustomerAddressDto) {
    return this.customersService.createAddress(actor, dto);
  }

  @Patch("addresses/:addressId")
  @ApiOperation({ summary: "Update a customer delivery address." })
  updateAddress(
    @CurrentUser() actor: RequestUser,
    @Param("addressId") addressId: string,
    @Body() dto: UpdateCustomerAddressDto
  ) {
    return this.customersService.updateAddress(actor, addressId, dto);
  }

  @Delete("addresses/:addressId")
  @ApiOperation({ summary: "Delete a customer delivery address." })
  deleteAddress(@CurrentUser() actor: RequestUser, @Param("addressId") addressId: string) {
    return this.customersService.deleteAddress(actor, addressId);
  }

  @Get("wishlist")
  @ApiOperation({ summary: "Read customer wishlist." })
  getWishlist(@CurrentUser() actor: RequestUser) {
    return this.customersService.getWishlist(actor);
  }

  @Post("wishlist/items")
  @ApiOperation({ summary: "Add a product to customer wishlist." })
  addWishlistItem(@CurrentUser() actor: RequestUser, @Body() dto: WishlistItemDto) {
    return this.customersService.addWishlistItem(actor, dto.productId);
  }

  @Delete("wishlist/items/:productId")
  @ApiOperation({ summary: "Remove a product from customer wishlist." })
  removeWishlistItem(@CurrentUser() actor: RequestUser, @Param("productId") productId: string) {
    return this.customersService.removeWishlistItem(actor, productId);
  }
}

