import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { TrackOrderDto } from "./dto/track-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("Public Orders")
@Controller("orders")
export class PublicOrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Public()
  @Post("track")
  @HttpCode(200)
  @ApiOperation({ summary: "Track an order with order number and customer contact." })
  trackOrder(@Body() dto: TrackOrderDto) {
    return this.ordersService.trackPublicOrder(dto);
  }
}
