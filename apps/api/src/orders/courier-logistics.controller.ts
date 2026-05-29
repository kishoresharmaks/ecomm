import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, RawBody } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CourierLogisticsService } from "./courier-logistics.service";
import {
  BookCourierShipmentDto,
  CourierCodRemittanceQueryDto,
  CourierShipmentQueryDto,
  UpdateCourierTrackingDto,
  UpsertCourierCodRemittanceDto,
  VerifyCourierCodRemittanceDto,
} from "./dto/courier-logistics.dto";

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
