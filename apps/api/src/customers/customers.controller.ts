import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CustomersService } from "./customers.service";
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from "./dto/customer-address.dto";
import { UpdateCustomerBrowsingLocationDto } from "./dto/customer-browsing-location.dto";
import { CustomerNotificationQueryDto } from "./dto/customer-notification-query.dto";
import { UpdateCustomerNotificationPreferencesDto } from "./dto/customer-notification-preferences.dto";
import { UpdateCustomerProfileDto } from "./dto/customer-profile.dto";
import { RegisterCustomerPushTokenDto, RevokeCustomerPushTokenDto } from "./dto/customer-push-token.dto";
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

  @Get("browsing-location")
  @ApiOperation({ summary: "Read the customer saved browsing location." })
  getBrowsingLocation(@CurrentUser() actor: RequestUser) {
    return this.customersService.getBrowsingLocation(actor);
  }

  @Patch("browsing-location")
  @ApiOperation({ summary: "Update the customer saved browsing location." })
  updateBrowsingLocation(@CurrentUser() actor: RequestUser, @Body() dto: UpdateCustomerBrowsingLocationDto) {
    return this.customersService.updateBrowsingLocation(actor, dto);
  }

  @Delete("browsing-location")
  @ApiOperation({ summary: "Clear the customer saved browsing location." })
  clearBrowsingLocation(@CurrentUser() actor: RequestUser) {
    return this.customersService.clearBrowsingLocation(actor);
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

  @Post("push-tokens")
  @ApiOperation({ summary: "Register this device for customer mobile push notifications." })
  registerPushToken(@CurrentUser() actor: RequestUser, @Body() dto: RegisterCustomerPushTokenDto) {
    return this.customersService.registerPushToken(actor, dto);
  }

  @Post("push-tokens/revoke")
  @ApiOperation({ summary: "Revoke this device's customer mobile push token." })
  revokePushToken(@CurrentUser() actor: RequestUser, @Body() dto: RevokeCustomerPushTokenDto) {
    return this.customersService.revokePushToken(actor, dto);
  }

  @Get("notification-preferences")
  @ApiOperation({ summary: "Read customer mobile notification preferences." })
  getNotificationPreferences(@CurrentUser() actor: RequestUser) {
    return this.customersService.getNotificationPreferences(actor);
  }

  @Patch("notification-preferences")
  @ApiOperation({ summary: "Update customer promotional notification preferences." })
  updateNotificationPreferences(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdateCustomerNotificationPreferencesDto
  ) {
    return this.customersService.updateNotificationPreferences(actor, dto);
  }

  @Get("notifications")
  @ApiOperation({ summary: "List customer mobile notifications." })
  listNotifications(@CurrentUser() actor: RequestUser, @Query() query: CustomerNotificationQueryDto) {
    return this.customersService.listNotifications(actor, query);
  }

  @Get("notifications/unread-count")
  @ApiOperation({ summary: "Read customer unread notification count." })
  unreadNotificationCount(@CurrentUser() actor: RequestUser) {
    return this.customersService.unreadNotificationCount(actor);
  }

  @Patch("notifications/:notificationId/read")
  @ApiOperation({ summary: "Mark a customer notification as read." })
  markNotificationRead(@CurrentUser() actor: RequestUser, @Param("notificationId") notificationId: string) {
    return this.customersService.markNotificationRead(actor, notificationId);
  }

  @Post("notifications/read-all")
  @ApiOperation({ summary: "Mark all customer notifications as read." })
  markAllNotificationsRead(@CurrentUser() actor: RequestUser) {
    return this.customersService.markAllNotificationsRead(actor);
  }
}
