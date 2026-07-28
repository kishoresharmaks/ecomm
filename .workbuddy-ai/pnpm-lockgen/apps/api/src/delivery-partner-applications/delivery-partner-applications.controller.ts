import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { DeliveryPartnerApplicationsService } from "./delivery-partner-applications.service";
import {
  DeliveryPartnerApplicationDecisionDto,
  DeliveryPartnerApplicationDto,
  DeliveryPartnerApplicationQueryDto,
} from "./dto/delivery-partner-application.dto";

@ApiTags("Delivery Partner Applications")
@Roles(RoleCode.CUSTOMER, RoleCode.SELLER, RoleCode.BUSINESS_BUYER, RoleCode.DELIVERY_PARTNER)
@Controller("delivery-partner-applications")
export class DeliveryPartnerApplicationsController {
  constructor(
    @Inject(DeliveryPartnerApplicationsService)
    private readonly applications: DeliveryPartnerApplicationsService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Read the authenticated user's delivery partner application." })
  getOwnApplication(@CurrentUser() actor: RequestUser) {
    return this.applications.getOwnApplication(actor);
  }

  @Post()
  @ApiOperation({ summary: "Submit or resubmit a delivery partner application for admin review." })
  submitApplication(@CurrentUser() actor: RequestUser, @Body() dto: DeliveryPartnerApplicationDto) {
    return this.applications.submitApplication(actor, dto);
  }
}

@ApiTags("Admin Delivery Partner Applications")
@Roles(RoleCode.ADMIN)
@Controller("admin/delivery-partner-applications")
export class AdminDeliveryPartnerApplicationsController {
  constructor(
    @Inject(DeliveryPartnerApplicationsService)
    private readonly applications: DeliveryPartnerApplicationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List delivery partner applications for review." })
  listApplications(@Query() query: DeliveryPartnerApplicationQueryDto) {
    return this.applications.listApplications(query);
  }

  @Get(":applicationId")
  @ApiOperation({ summary: "Read one delivery partner application." })
  getApplication(@Param("applicationId") applicationId: string) {
    return this.applications.getApplication(applicationId);
  }

  @Patch(":applicationId/decision")
  @ApiOperation({ summary: "Approve or reject a delivery partner application." })
  decideApplication(
    @CurrentUser() actor: RequestUser,
    @Param("applicationId") applicationId: string,
    @Body() dto: DeliveryPartnerApplicationDecisionDto,
  ) {
    return this.applications.decideApplication(actor, applicationId, dto);
  }
}
