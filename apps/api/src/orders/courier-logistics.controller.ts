import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Query, RawBody, Res, StreamableFile } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CourierLogisticsService } from "./courier-logistics.service";
import {
  CourierDeliveryPartnerAvailabilityDto,
  DeliveryPartnerQueryDto,
  UpdateDeliveryPartnerProfileDto,
} from "./dto/delivery-operations.dto";
import {
  BookCourierShipmentDto,
  CourierCodRemittanceQueryDto,
  CourierLocalDeliveryAssignmentDto,
  CourierLocalDeliveryQueryDto,
  CourierPackageQueryDto,
  CourierRoutingFailureQueryDto,
  CourierRoutingOverrideDto,
  CourierShipmentQueryDto,
  ImportCourierCodRemittanceReportDto,
  UpdateSellerShipmentPackageDto,
  UpdateCourierTrackingDto,
  UpsertCourierCodRemittanceDto,
  VerifyCourierCodRemittanceDto,
} from "./dto/courier-logistics.dto";
import { OrdersService } from "./orders.service";

type HeaderResponse = {
  set(headers: Record<string, string>): void;
};

@ApiTags("Admin Courier Shipments")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/courier-shipments")
export class AdminCourierShipmentsController {
  constructor(@Inject(CourierLogisticsService) private readonly courierLogistics: CourierLogisticsService) {}

  @Get()
  @ApiOperation({ summary: "List package-level third-party courier shipments." })
  listShipments(@Query() query: CourierShipmentQueryDto) {
    return this.courierLogistics.listCourierShipments(query);
  }

  @Post(":shipmentNumber/book")
  @ApiOperation({ summary: "Book or record a courier AWB for a seller package." })
  bookShipment(
    @CurrentUser() actor: RequestUser,
    @Param("shipmentNumber") shipmentNumber: string,
    @Body() dto: BookCourierShipmentDto,
  ) {
    return this.courierLogistics.bookShipment(actor, shipmentNumber, dto);
  }

  @Patch(":courierShipmentId/tracking")
  @ApiOperation({ summary: "Manually update package-level courier tracking state." })
  updateTracking(
    @CurrentUser() actor: RequestUser,
    @Param("courierShipmentId") courierShipmentId: string,
    @Body() dto: UpdateCourierTrackingDto,
  ) {
    return this.courierLogistics.updateTracking(actor, courierShipmentId, dto);
  }
}

@ApiTags("Seller Courier Packages")
@Roles(RoleCode.SELLER)
@Controller("seller/packages")
export class SellerCourierPackagesController {
  constructor(@Inject(CourierLogisticsService) private readonly courierLogistics: CourierLogisticsService) {}

  @Patch(":packageId")
  @ApiOperation({ summary: "Update the authenticated seller's package dimensions or ready state." })
  updatePackage(
    @CurrentUser() actor: RequestUser,
    @Param("packageId") packageId: string,
    @Body() dto: UpdateSellerShipmentPackageDto,
  ) {
    return this.courierLogistics.updateSellerPackage(actor, packageId, dto);
  }

  @Get(":packageId/label")
  @ApiOperation({ summary: "Download the authenticated seller's courier package label." })
  async downloadLabel(
    @CurrentUser() actor: RequestUser,
    @Param("packageId") packageId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const label = await this.courierLogistics.getSellerPackageLabel(actor, packageId);
    response.set({
      "Content-Type": label.contentType,
      "Content-Disposition": `inline; filename="${label.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    });
    return new StreamableFile(label.buffer);
  }
}

@ApiTags("Finance Courier COD Remittances")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/finance/courier-cod-remittances")
export class FinanceCourierCodRemittancesController {
  constructor(@Inject(CourierLogisticsService) private readonly courierLogistics: CourierLogisticsService) {}

  @Get()
  @ApiOperation({ summary: "List courier COD remittance records by package/provider." })
  listRemittances(@Query() query: CourierCodRemittanceQueryDto) {
    return this.courierLogistics.listCourierCodRemittances(query);
  }

  @Post()
  @ApiOperation({ summary: "Import or update a courier COD remittance report row." })
  upsertRemittance(@CurrentUser() actor: RequestUser, @Body() dto: UpsertCourierCodRemittanceDto) {
    return this.courierLogistics.upsertCourierCodRemittance(actor, dto);
  }

  @Post("report")
  @ApiOperation({ summary: "Import a courier COD remittance report with multiple package rows." })
  importRemittanceReport(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ImportCourierCodRemittanceReportDto,
  ) {
    return this.courierLogistics.importCourierCodRemittanceReport(actor, dto);
  }

  @Patch(":remittanceId/verify")
  @ApiOperation({ summary: "Verify, dispute, or reject a courier COD remittance." })
  verifyRemittance(
    @CurrentUser() actor: RequestUser,
    @Param("remittanceId") remittanceId: string,
    @Body() dto: VerifyCourierCodRemittanceDto,
  ) {
    return this.courierLogistics.verifyCourierCodRemittance(actor, remittanceId, dto);
  }
}

@ApiTags("Courier Workspace")
@Roles(RoleCode.ADMIN, RoleCode.COURIER_MANAGER)
@Controller("courier")
export class CourierWorkspaceController {
  constructor(
    @Inject(CourierLogisticsService) private readonly courierLogistics: CourierLogisticsService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
  ) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Read courier and delivery operations dashboard metrics." })
  dashboard() {
    return this.courierLogistics.getCourierDashboard();
  }

  @Get("packages")
  @ApiOperation({ summary: "List package-level courier and delivery work." })
  listPackages(@Query() query: CourierPackageQueryDto) {
    return this.courierLogistics.listCourierPackages(query);
  }

  @Get("packages/:packageId")
  @ApiOperation({ summary: "Read one package-level courier record." })
  getPackage(@Param("packageId") packageId: string) {
    return this.courierLogistics.getCourierPackage(packageId);
  }

  @Get("packages/:packageId/label")
  @ApiOperation({ summary: "Download a package courier label through the backend proxy." })
  async downloadPackageLabel(
    @Param("packageId") packageId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const label = await this.courierLogistics.getCourierPackageLabel(packageId);
    response.set({
      "Content-Type": label.contentType,
      "Content-Disposition": `inline; filename="${label.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    });
    return new StreamableFile(label.buffer);
  }

  @Post("packages/:packageId/book")
  @ApiOperation({ summary: "Book or record courier details for one package." })
  bookPackage(
    @CurrentUser() actor: RequestUser,
    @Param("packageId") packageId: string,
    @Body() dto: BookCourierShipmentDto,
  ) {
    return this.courierLogistics.bookPackage(actor, packageId, dto);
  }

  @Patch("packages/:packageId/tracking")
  @ApiOperation({ summary: "Manually update package courier tracking state." })
  updatePackageTracking(
    @CurrentUser() actor: RequestUser,
    @Param("packageId") packageId: string,
    @Body() dto: UpdateCourierTrackingDto,
  ) {
    return this.courierLogistics.updatePackageTracking(actor, packageId, dto);
  }

  @Get("routing-failures")
  @ApiOperation({ summary: "List shipment routing failures for courier operations." })
  listRoutingFailures(@Query() query: CourierRoutingFailureQueryDto) {
    return this.courierLogistics.listRoutingFailures(query);
  }

  @Patch("routing-failures/:shipmentId/override")
  @ApiOperation({ summary: "Override a failed delivery route for one seller shipment." })
  overrideRoutingFailure(
    @CurrentUser() actor: RequestUser,
    @Param("shipmentId") shipmentId: string,
    @Body() dto: CourierRoutingOverrideDto,
  ) {
    return this.courierLogistics.overrideRoutingFailure(actor, shipmentId, dto);
  }

  @Get("local-delivery")
  @ApiOperation({ summary: "List local-delivery shipment assignments and delivery partners." })
  listLocalDelivery(@Query() query: CourierLocalDeliveryQueryDto) {
    return this.courierLogistics.listLocalDeliveryQueue(query);
  }

  @Patch("local-delivery/:shipmentId/assign")
  @ApiOperation({ summary: "Assign or unassign a local delivery partner for one shipment." })
  assignLocalDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("shipmentId") shipmentId: string,
    @Body() dto: CourierLocalDeliveryAssignmentDto,
  ) {
    return this.courierLogistics.assignLocalDeliveryShipment(actor, shipmentId, dto);
  }

  @Get("delivery-partners")
  @ApiOperation({ summary: "List delivery partner operational profiles for courier management." })
  listDeliveryPartners(@Query() query: DeliveryPartnerQueryDto) {
    return this.ordersService.listCourierDeliveryPartners(query);
  }

  @Get("delivery-partners/:userId")
  @ApiOperation({ summary: "Read one delivery partner operational profile for courier management." })
  getDeliveryPartner(@Param("userId") userId: string) {
    return this.ordersService.getCourierDeliveryPartner(userId);
  }

  @Put("delivery-partners/:userId/profile")
  @ApiOperation({ summary: "Update delivery partner profile and service coverage from courier management." })
  updateDeliveryPartnerProfile(
    @CurrentUser() actor: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: UpdateDeliveryPartnerProfileDto,
  ) {
    return this.ordersService.updateCourierDeliveryPartnerProfile(actor, userId, dto);
  }

  @Patch("delivery-partners/:userId/availability")
  @ApiOperation({ summary: "Pause or resume a delivery partner from courier management." })
  updateDeliveryPartnerAvailability(
    @CurrentUser() actor: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: CourierDeliveryPartnerAvailabilityDto,
  ) {
    return this.ordersService.updateCourierDeliveryPartnerAvailability(actor, userId, dto);
  }

  @Get("cod-remittances")
  @ApiOperation({ summary: "List courier COD remittance records for logistics handoff." })
  listCodRemittances(@Query() query: CourierCodRemittanceQueryDto) {
    return this.courierLogistics.listCourierCodRemittances(query);
  }

  @Post("cod-remittances")
  @ApiOperation({ summary: "Record or import a courier COD remittance row without finance verification." })
  upsertCodRemittance(@CurrentUser() actor: RequestUser, @Body() dto: UpsertCourierCodRemittanceDto) {
    return this.courierLogistics.upsertCourierCodRemittance(actor, dto);
  }
}

@ApiTags("Courier Webhooks")
@Controller("webhooks/couriers")
export class CourierWebhooksController {
  constructor(@Inject(CourierLogisticsService) private readonly courierLogistics: CourierLogisticsService) {}

  @Public()
  @Post(":providerCode/tracking")
  @ApiOperation({ summary: "Receive idempotent courier tracking webhook events." })
  handleTrackingWebhook(
    @Param("providerCode") providerCode: string,
    @Headers("x-courier-signature") courierSignature: string | undefined,
    @Headers("x-xpressbees-signature") xpressBeesSignature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.courierLogistics.handleTrackingWebhook(
      providerCode,
      payload,
      courierSignature ?? xpressBeesSignature,
      rawBody,
    );
  }
}
