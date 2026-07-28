import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";

type InternalBatchAssignDto = {
  orderIds?: string[];
  shipmentIds?: string[];
};

@ApiTags("Internal Operations")
@Controller("internal/delivery")
export class InternalOrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: "Batch assign delivery partners to grouped orders" })
  @Post("batch-assign")
  async batchAssign(
    @Headers("x-internal-secret") secret: string,
    @Body() dto: InternalBatchAssignDto
  ) {
    if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
      throw new UnauthorizedException("Invalid internal secret");
    }

    const orderIds = Array.from(new Set(dto.orderIds ?? []));
    const shipmentIds = Array.from(new Set(dto.shipmentIds ?? []));

    if (orderIds.length === 0 && shipmentIds.length === 0) {
      return { success: true, count: 0 };
    }

    // Fetch the full order payloads
    const orders = [];
    for (const id of orderIds) {
        const order = await this.ordersService.getOrderByIdOrThrow(id);
        orders.push(order);
    }

    await this.ordersService.autoAssignDeliveryBatch(
      orders,
      null,
      "Auto assigned by background batching engine.",
      { shipmentIds },
    );
    
    return { success: true, count: shipmentIds.length || orders.length };
  }
}
