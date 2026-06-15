import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  ReturnListQueryDto,
  ReversePickupDecision,
  ReversePickupDecisionDto,
  ReversePickupDecisionNoteDto,
  ReversePickupUpdateDto,
} from "./dto/returns.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("Delivery Partner Returns")
@Roles(RoleCode.DELIVERY_PARTNER)
@Controller("delivery/returns")
export class DeliveryReturnsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: "List return pickups assigned to the delivery partner." })
  listReturns(@CurrentUser() actor: RequestUser, @Query() query: ReturnListQueryDto) {
    return this.returnsService.listDeliveryReturns(actor, query);
  }

  @Get(":requestNumber")
  @ApiOperation({ summary: "Read assigned return pickup detail." })
  getReturn(@CurrentUser() actor: RequestUser, @Param("requestNumber") requestNumber: string) {
    return this.returnsService.getDeliveryReturn(actor, requestNumber);
  }

  @Post(":requestNumber/accept")
  @ApiOperation({ summary: "Accept an assigned return pickup." })
  acceptPickup(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReversePickupDecisionNoteDto,
  ) {
    return this.returnsService.respondReversePickupAssignment(actor, requestNumber, {
      decision: ReversePickupDecision.ACCEPT,
      ...(dto.note ? { note: dto.note } : {}),
    });
  }

  @Post(":requestNumber/reject")
  @ApiOperation({ summary: "Reject an assigned return pickup and release it for reassignment." })
  rejectPickup(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReversePickupDecisionNoteDto,
  ) {
    return this.returnsService.respondReversePickupAssignment(actor, requestNumber, {
      decision: ReversePickupDecision.REJECT,
      ...(dto.note ? { note: dto.note } : {}),
    });
  }

  @Patch(":requestNumber/assignment")
  @ApiOperation({ summary: "Accept or reject an assigned return pickup." })
  respondPickup(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReversePickupDecisionDto,
  ) {
    return this.returnsService.respondReversePickupAssignment(actor, requestNumber, dto);
  }

  @Patch(":requestNumber/pickup")
  @ApiOperation({ summary: "Update pickup and reverse shipment state for an assigned return." })
  updatePickup(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: ReversePickupUpdateDto,
  ) {
    return this.returnsService.updateReversePickup(actor, requestNumber, dto);
  }

  @Patch(":requestNumber/shipments/:shipmentId/receipt")
  @ApiOperation({ summary: "Record seller-store receipt for one reverse shipment package." })
  recordShipmentReceipt(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Body() dto: ReversePickupUpdateDto,
  ) {
    return this.returnsService.updateReverseShipmentReceipt(actor, requestNumber, shipmentId, dto);
  }
}
