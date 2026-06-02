import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { DeliveryRoutingService } from "./delivery-routing.service";
import {
  LocationServiceabilityQueryDto,
  ResolveCheckoutDeliveryDto,
  RoutingSimulatorDto,
  UpdateCourierProviderActiveDto,
  UpdateRateCardActiveDto,
  UpsertCourierProviderSettingDto,
  UpsertShippingRateCardDto,
} from "./dto/delivery-routing.dto";

@ApiTags("Checkout Delivery Routing")
@Roles(RoleCode.CUSTOMER)
@Controller("checkout")
export class CheckoutDeliveryController {
  constructor(
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
  ) {}

  @Post("resolve-delivery")
  @ApiOperation({
    summary: "Resolve checkout delivery mode, partner/courier route, and shipping charges.",
  })
  resolveDelivery(@CurrentUser() actor: RequestUser, @Body() dto: ResolveCheckoutDeliveryDto) {
    return this.deliveryRouting.resolveCustomerCheckoutDelivery(actor, dto);
  }
}

@ApiTags("Admin Shipping Rate Cards")
@Roles(RoleCode.ADMIN)
@Controller("admin/rate-cards")
export class AdminShippingRateCardsController {
  constructor(
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List admin-managed delivery shipping rate cards." })
  listRateCards() {
    return this.deliveryRouting.listRateCards();
  }

  @Post()
  @ApiOperation({ summary: "Create a delivery shipping rate card." })
  createRateCard(@CurrentUser() actor: RequestUser, @Body() dto: UpsertShippingRateCardDto) {
    return this.deliveryRouting.createRateCard(actor, dto);
  }

  @Patch(":rateCardId")
  @ApiOperation({ summary: "Update a delivery shipping rate card." })
  updateRateCard(
    @CurrentUser() actor: RequestUser,
    @Param("rateCardId") rateCardId: string,
    @Body() dto: UpsertShippingRateCardDto,
  ) {
    return this.deliveryRouting.updateRateCard(actor, rateCardId, dto);
  }

  @Patch(":rateCardId/active")
  @ApiOperation({ summary: "Activate or deactivate a delivery shipping rate card." })
  updateRateCardActive(
    @CurrentUser() actor: RequestUser,
    @Param("rateCardId") rateCardId: string,
    @Body() dto: UpdateRateCardActiveDto,
  ) {
    return this.deliveryRouting.updateRateCardActive(actor, rateCardId, dto);
  }

  @Delete(":rateCardId")
  @ApiOperation({ summary: "Remove a delivery shipping rate card." })
  deleteRateCard(@CurrentUser() actor: RequestUser, @Param("rateCardId") rateCardId: string) {
    return this.deliveryRouting.deleteRateCard(actor, rateCardId);
  }
}

@ApiTags("Admin Courier Providers")
@Roles(RoleCode.ADMIN)
@Controller("admin/courier-providers")
export class AdminCourierProvidersController {
  constructor(
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List courier provider routing settings." })
  listProviders() {
    return this.deliveryRouting.listCourierProviders();
  }

  @Post()
  @ApiOperation({ summary: "Create or update a courier provider routing setting." })
  upsertProvider(@CurrentUser() actor: RequestUser, @Body() dto: UpsertCourierProviderSettingDto) {
    return this.deliveryRouting.upsertCourierProvider(actor, dto);
  }

  @Patch(":providerCode/active")
  @ApiOperation({ summary: "Activate or deactivate a courier provider." })
  updateProviderActive(
    @CurrentUser() actor: RequestUser,
    @Param("providerCode") providerCode: string,
    @Body() dto: UpdateCourierProviderActiveDto,
  ) {
    return this.deliveryRouting.updateCourierProviderActive(actor, providerCode, dto);
  }
}

@ApiTags("Admin Routing Simulator")
@Roles(RoleCode.ADMIN)
@Controller("admin/routing-simulator")
export class AdminRoutingSimulatorController {
  constructor(
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Simulate delivery routing using the same engine as checkout." })
  simulate(@Body() dto: RoutingSimulatorDto) {
    return this.deliveryRouting.simulateRouting(dto);
  }
}

@ApiTags("Admin Location Serviceability")
@Roles(RoleCode.ADMIN)
@Controller("admin/locations/serviceability")
export class AdminLocationServiceabilityController {
  constructor(
    @Inject(DeliveryRoutingService) private readonly deliveryRouting: DeliveryRoutingService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Summarise delivery, payment, seller, and rate-card readiness for a location." })
  summary(@Query() query: LocationServiceabilityQueryDto) {
    return this.deliveryRouting.locationServiceabilitySummary(query);
  }
}
