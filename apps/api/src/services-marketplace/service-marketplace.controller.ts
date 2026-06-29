import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  AdminServiceApprovalDto,
  CancelServiceBookingDto,
  CompletionSubmitDto,
  CreateServiceBookingDto,
  CreateServiceListingDto,
  CreateServiceReviewDto,
  RaiseServiceDisputeDto,
  RecordServicePaymentDto,
  ResolveServiceDisputeDto,
  SellerServiceBookingActionDto,
  SendServiceQuoteDto,
  ServiceListingQueryDto,
  ServiceReviewReplyDto,
  UpdateSellerCapabilitiesDto,
  UpdateServiceListingDto,
} from "./dto/service-marketplace.dto";
import { ServiceMarketplaceService } from "./service-marketplace.service";

@ApiTags("Services")
@Controller()
export class ServiceMarketplaceController {
  constructor(@Inject(ServiceMarketplaceService) private readonly serviceMarketplace: ServiceMarketplaceService) {}

  @Public()
  @Get("services")
  @ApiOperation({ summary: "List approved active service listings for storefront browsing." })
  listPublicServices(@Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.listPublicServices(query);
  }

  @Public()
  @Get("services/:slug")
  @ApiOperation({ summary: "Read approved active service listing detail." })
  getPublicService(@Param("slug") slug: string, @Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.getPublicService(slug, query);
  }

  @Roles(RoleCode.SELLER)
  @Get("seller/services")
  @ApiOperation({ summary: "List service listings owned by the authenticated service provider." })
  listSellerServices(@CurrentUser() actor: RequestUser, @Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.listSellerServices(actor, query);
  }

  @Roles(RoleCode.SELLER)
  @Get("seller/services/:serviceId")
  @ApiOperation({ summary: "Read one seller-owned service listing." })
  getSellerService(@CurrentUser() actor: RequestUser, @Param("serviceId") serviceId: string) {
    return this.serviceMarketplace.getSellerService(actor, serviceId);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/services")
  @ApiOperation({ summary: "Create a service listing for admin approval." })
  createSellerService(@CurrentUser() actor: RequestUser, @Body() dto: CreateServiceListingDto) {
    return this.serviceMarketplace.createSellerService(actor, dto);
  }

  @Roles(RoleCode.SELLER)
  @Patch("seller/services/:serviceId")
  @ApiOperation({ summary: "Update a seller-owned service listing and send it for approval." })
  updateSellerService(
    @CurrentUser() actor: RequestUser,
    @Param("serviceId") serviceId: string,
    @Body() dto: UpdateServiceListingDto,
  ) {
    return this.serviceMarketplace.updateSellerService(actor, serviceId, dto);
  }

  @Roles(RoleCode.SELLER)
  @Delete("seller/services/:serviceId")
  @ApiOperation({ summary: "Archive a seller-owned service listing." })
  archiveSellerService(@CurrentUser() actor: RequestUser, @Param("serviceId") serviceId: string) {
    return this.serviceMarketplace.archiveSellerService(actor, serviceId);
  }

  @Roles(RoleCode.CUSTOMER)
  @Post("account/service-bookings")
  @ApiOperation({ summary: "Create a service booking from a storefront service listing." })
  createCustomerBooking(@CurrentUser() actor: RequestUser, @Body() dto: CreateServiceBookingDto) {
    return this.serviceMarketplace.createCustomerBooking(actor, dto);
  }

  @Roles(RoleCode.CUSTOMER)
  @Get("account/service-bookings")
  @ApiOperation({ summary: "List customer service bookings." })
  listCustomerBookings(@CurrentUser() actor: RequestUser, @Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.listCustomerBookings(actor, query);
  }

  @Roles(RoleCode.CUSTOMER)
  @Get("account/service-bookings/:bookingNumber")
  @ApiOperation({ summary: "Read customer service booking detail." })
  getCustomerBooking(@CurrentUser() actor: RequestUser, @Param("bookingNumber") bookingNumber: string) {
    return this.serviceMarketplace.getCustomerBooking(actor, bookingNumber);
  }

  @Roles(RoleCode.CUSTOMER)
  @Patch("account/service-bookings/:bookingNumber/cancel")
  @ApiOperation({ summary: "Cancel a customer service booking." })
  cancelCustomerBooking(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: CancelServiceBookingDto,
  ) {
    return this.serviceMarketplace.cancelCustomerBooking(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.CUSTOMER)
  @Patch("account/service-bookings/:bookingNumber/quotes/accept")
  @ApiOperation({ summary: "Accept the active quote for a service booking." })
  acceptQuote(@CurrentUser() actor: RequestUser, @Param("bookingNumber") bookingNumber: string) {
    return this.serviceMarketplace.customerAcceptQuote(actor, bookingNumber);
  }

  @Roles(RoleCode.CUSTOMER)
  @Patch("account/service-bookings/:bookingNumber/quotes/reject")
  @ApiOperation({ summary: "Reject the active quote for a service booking." })
  rejectQuote(@CurrentUser() actor: RequestUser, @Param("bookingNumber") bookingNumber: string) {
    return this.serviceMarketplace.customerRejectQuote(actor, bookingNumber);
  }

  @Roles(RoleCode.CUSTOMER)
  @Patch("account/service-bookings/:bookingNumber/confirm-completion")
  @ApiOperation({ summary: "Confirm service completion and release settlement eligibility." })
  confirmCompletion(@CurrentUser() actor: RequestUser, @Param("bookingNumber") bookingNumber: string) {
    return this.serviceMarketplace.customerConfirmCompletion(actor, bookingNumber);
  }

  @Roles(RoleCode.CUSTOMER)
  @Post("account/service-bookings/:bookingNumber/disputes")
  @ApiOperation({ summary: "Raise a completion dispute for a service booking." })
  raiseDispute(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: RaiseServiceDisputeDto,
  ) {
    return this.serviceMarketplace.customerRaiseDispute(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.CUSTOMER)
  @Post("account/service-bookings/:bookingNumber/reviews")
  @ApiOperation({ summary: "Review a completed service booking." })
  createReview(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: CreateServiceReviewDto,
  ) {
    return this.serviceMarketplace.createReview(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Get("seller/service-bookings")
  @ApiOperation({ summary: "List service bookings for the authenticated service provider." })
  listSellerBookings(@CurrentUser() actor: RequestUser, @Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.listSellerBookings(actor, query);
  }

  @Roles(RoleCode.SELLER)
  @Get("seller/service-bookings/:bookingNumber")
  @ApiOperation({ summary: "Read seller service booking detail." })
  getSellerBooking(@CurrentUser() actor: RequestUser, @Param("bookingNumber") bookingNumber: string) {
    return this.serviceMarketplace.getSellerBooking(actor, bookingNumber);
  }

  @Roles(RoleCode.SELLER)
  @Patch("seller/service-bookings/:bookingNumber/accept")
  @ApiOperation({ summary: "Accept a requested service booking and optionally schedule it." })
  acceptBooking(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: SellerServiceBookingActionDto,
  ) {
    return this.serviceMarketplace.sellerAcceptBooking(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Patch("seller/service-bookings/:bookingNumber/reject")
  @ApiOperation({ summary: "Reject a requested service booking with a provider reason." })
  rejectBooking(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: CancelServiceBookingDto,
  ) {
    return this.serviceMarketplace.sellerRejectBooking(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/service-bookings/:bookingNumber/quotes")
  @ApiOperation({ summary: "Send a quote for an accepted or inspected service booking." })
  sendQuote(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: SendServiceQuoteDto,
  ) {
    return this.serviceMarketplace.sellerSendQuote(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Patch("seller/service-bookings/:bookingNumber/in-progress")
  @ApiOperation({ summary: "Mark an accepted service booking as in progress." })
  markInProgress(@CurrentUser() actor: RequestUser, @Param("bookingNumber") bookingNumber: string) {
    return this.serviceMarketplace.sellerMarkInProgress(actor, bookingNumber);
  }

  @Roles(RoleCode.SELLER)
  @Patch("seller/service-bookings/:bookingNumber/submit-completion")
  @ApiOperation({ summary: "Submit service completion proof for customer or admin confirmation." })
  submitCompletion(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: CompletionSubmitDto,
  ) {
    return this.serviceMarketplace.sellerSubmitCompletion(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Patch("seller/service-bookings/:bookingNumber/cancel")
  @ApiOperation({ summary: "Cancel a service booking as the provider." })
  cancelSellerBooking(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: CancelServiceBookingDto,
  ) {
    return this.serviceMarketplace.cancelSellerBooking(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/service-bookings/:bookingNumber/payments")
  @ApiOperation({ summary: "Record a provider-side service payment, including pay-at-visit collections." })
  recordSellerPayment(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: RecordServicePaymentDto,
  ) {
    return this.serviceMarketplace.recordServicePayment(actor, bookingNumber, dto);
  }

  @Roles(RoleCode.SELLER)
  @Post("seller/service-reviews/:reviewId/reply")
  @ApiOperation({ summary: "Reply once to a customer service review." })
  replyToReview(
    @CurrentUser() actor: RequestUser,
    @Param("reviewId") reviewId: string,
    @Body() dto: ServiceReviewReplyDto,
  ) {
    return this.serviceMarketplace.replyToReview(actor, reviewId, dto);
  }

  @Roles(RoleCode.ADMIN)
  @Get("admin/services")
  @ApiOperation({ summary: "List service listings for admin review and operations." })
  adminListServices(@Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.adminListServices(query);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/services/:serviceId/approval")
  @ApiOperation({ summary: "Approve, reject, activate, or deactivate a service listing." })
  adminUpdateServiceApproval(
    @CurrentUser() actor: RequestUser,
    @Param("serviceId") serviceId: string,
    @Body() dto: AdminServiceApprovalDto,
  ) {
    return this.serviceMarketplace.adminUpdateServiceApproval(serviceId, dto, actor);
  }

  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @Get("admin/service-bookings")
  @ApiOperation({ summary: "List service bookings for admin and finance operations." })
  adminListBookings(@Query() query: ServiceListingQueryDto) {
    return this.serviceMarketplace.adminListBookings(query);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/service-bookings/:bookingNumber/cancel")
  @ApiOperation({ summary: "Cancel a service booking from the admin panel with audit history." })
  adminCancelBooking(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: CancelServiceBookingDto,
  ) {
    return this.serviceMarketplace.adminCancelBooking(bookingNumber, dto, actor);
  }

  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @Post("admin/service-bookings/:bookingNumber/payments")
  @ApiOperation({ summary: "Record or verify a service booking payment from admin or finance." })
  adminRecordPayment(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Body() dto: RecordServicePaymentDto,
  ) {
    return this.serviceMarketplace.recordServicePayment(actor, bookingNumber, dto, true);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/service-bookings/:bookingNumber/disputes/:disputeId/resolve")
  @ApiOperation({ summary: "Resolve a service booking dispute and release or hold settlement." })
  adminResolveDispute(
    @CurrentUser() actor: RequestUser,
    @Param("bookingNumber") bookingNumber: string,
    @Param("disputeId") disputeId: string,
    @Body() dto: ResolveServiceDisputeDto,
  ) {
    return this.serviceMarketplace.adminResolveDispute(bookingNumber, disputeId, dto, actor);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/service-reviews/:reviewId/hide")
  @ApiOperation({ summary: "Hide a service review that violates marketplace policy." })
  adminHideReview(@CurrentUser() actor: RequestUser, @Param("reviewId") reviewId: string) {
    return this.serviceMarketplace.adminHideReview(reviewId, actor);
  }

  @Roles(RoleCode.ADMIN)
  @Patch("admin/sellers/:sellerId/capabilities")
  @ApiOperation({ summary: "Update seller retail and service capabilities with audit history." })
  updateSellerCapabilities(
    @CurrentUser() actor: RequestUser,
    @Param("sellerId") sellerId: string,
    @Body() dto: UpdateSellerCapabilitiesDto,
  ) {
    return this.serviceMarketplace.updateSellerCapabilities(sellerId, dto, actor);
  }
}
