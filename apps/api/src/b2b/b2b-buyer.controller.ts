import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { B2BService } from "./b2b.service";
import { CreateB2BEnquiryDto } from "./dto/b2b-enquiry.dto";
import { B2BEnquiryQueryDto } from "./dto/b2b-query.dto";
import { CreateBusinessBuyerAddressDto, UpdateBusinessBuyerAddressDto } from "./dto/business-buyer-address.dto";
import { UpdateBusinessBuyerProfileDto, UpsertBusinessBuyerProfileDto } from "./dto/business-buyer-profile.dto";

@ApiTags("B2B Buyer")
@Controller("b2b")
export class B2BBuyerController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get("profile")
  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read business buyer company profile." })
  getProfile(@CurrentUser() actor: RequestUser) {
    return this.b2bService.getProfile(actor);
  }

  @Put("profile")
  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Create or replace business buyer company profile." })
  upsertProfile(@CurrentUser() actor: RequestUser, @Body() dto: UpsertBusinessBuyerProfileDto) {
    return this.b2bService.upsertProfile(actor, dto);
  }

  @Patch("profile")
  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Update business buyer company profile." })
  updateProfile(@CurrentUser() actor: RequestUser, @Body() dto: UpdateBusinessBuyerProfileDto) {
    return this.b2bService.upsertProfile(actor, dto);
  }

  @Get("addresses")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "List business buyer addresses." })
  listAddresses(@CurrentUser() actor: RequestUser) {
    return this.b2bService.listAddresses(actor);
  }

  @Post("addresses")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Create business buyer address." })
  createAddress(@CurrentUser() actor: RequestUser, @Body() dto: CreateBusinessBuyerAddressDto) {
    return this.b2bService.createAddress(actor, dto);
  }

  @Patch("addresses/:addressId")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Update business buyer address." })
  updateAddress(
    @CurrentUser() actor: RequestUser,
    @Param("addressId") addressId: string,
    @Body() dto: UpdateBusinessBuyerAddressDto
  ) {
    return this.b2bService.updateAddress(actor, addressId, dto);
  }

  @Delete("addresses/:addressId")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Delete business buyer address." })
  deleteAddress(@CurrentUser() actor: RequestUser, @Param("addressId") addressId: string) {
    return this.b2bService.deleteAddress(actor, addressId);
  }

  @Get("enquiries")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "List enquiries submitted by the authenticated business buyer." })
  listEnquiries(@CurrentUser() actor: RequestUser, @Query() query: B2BEnquiryQueryDto) {
    return this.b2bService.listMyEnquiries(actor, query);
  }

  @Post("enquiries")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Submit a B2B product or seller enquiry." })
  createEnquiry(@CurrentUser() actor: RequestUser, @Body() dto: CreateB2BEnquiryDto) {
    return this.b2bService.createEnquiry(actor, dto);
  }

  @Get("enquiries/:enquiryId")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read a submitted B2B enquiry." })
  getEnquiry(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string) {
    return this.b2bService.getMyEnquiry(actor, enquiryId);
  }

  @Patch("enquiries/:enquiryId/cancel")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Cancel an open B2B enquiry." })
  cancelEnquiry(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string) {
    return this.b2bService.cancelMyEnquiry(actor, enquiryId);
  }

  @Patch("enquiries/:enquiryId/confirm")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Confirm a responded B2B quotation for admin approval." })
  confirmEnquiry(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string) {
    return this.b2bService.confirmMyEnquiry(actor, enquiryId);
  }
}
