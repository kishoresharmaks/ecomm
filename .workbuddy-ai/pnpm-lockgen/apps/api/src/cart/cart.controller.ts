import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CartService } from "./cart.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-item.dto";
import { CheckoutSummaryQueryDto } from "./dto/checkout-summary-query.dto";

@ApiTags("Cart")
@Roles(RoleCode.CUSTOMER)
@Controller("cart")
export class CartController {
  constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Read the authenticated customer's active cart." })
  getCart(@CurrentUser() actor: RequestUser) {
    return this.cartService.getCart(actor);
  }

  @Get("checkout-summary")
  @ApiOperation({ summary: "Read server-priced checkout totals for the authenticated customer's active cart." })
  getCheckoutSummary(@CurrentUser() actor: RequestUser, @Query() query: CheckoutSummaryQueryDto) {
    return this.cartService.getCheckoutSummary(actor, query);
  }

  @Post("items")
  @ApiOperation({ summary: "Add a product variant to the cart." })
  addItem(@CurrentUser() actor: RequestUser, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(actor, dto);
  }

  @Patch("items/:cartItemId")
  @ApiOperation({ summary: "Update cart item quantity." })
  updateItem(
    @CurrentUser() actor: RequestUser,
    @Param("cartItemId") cartItemId: string,
    @Body() dto: UpdateCartItemDto
  ) {
    return this.cartService.updateItem(actor, cartItemId, dto);
  }

  @Delete("items/:cartItemId")
  @ApiOperation({ summary: "Remove an item from the cart." })
  removeItem(@CurrentUser() actor: RequestUser, @Param("cartItemId") cartItemId: string) {
    return this.cartService.removeItem(actor, cartItemId);
  }
}
