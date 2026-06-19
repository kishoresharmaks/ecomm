import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { sendB2BPurchaseOrderDocument } from "./b2b-document-response";
import { B2BService } from "./b2b.service";
import { B2BOrderQueryDto } from "./dto/b2b-order.dto";

@ApiTags("Seller B2B Orders")
@Roles(RoleCode.SELLER)
@Controller("seller/b2b-orders")
export class SellerB2BOrdersController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get()
  @ApiOperation({ summary: "List B2B proforma and PO orders assigned to the authenticated seller." })
  listOrders(@CurrentUser() actor: RequestUser, @Query() query: B2BOrderQueryDto) {
    return this.b2bService.listSellerB2BOrders(actor, query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read seller-visible B2B proforma and PO order detail." })
  getOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.b2bService.getSellerB2BOrder(actor, orderNumber);
  }

  @Get(":orderNumber/purchase-order/document-access")
  @ApiOperation({ summary: "Read seller-authorized purchase-order document access metadata." })
  getPurchaseOrderDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getSellerPurchaseOrderDocumentAccess(actor, orderNumber);
  }

  @Get(":orderNumber/purchase-order/document")
  @ApiOperation({ summary: "Open or stream the seller-authorized purchase-order document." })
  async openPurchaseOrderDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getSellerPurchaseOrderDocumentAccess(actor, orderNumber);
    return sendB2BPurchaseOrderDocument(access, response);
  }
}
