import { Body, Controller, Get, Inject, Param, Patch, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { sendB2BPurchaseOrderDocument } from "./b2b-document-response";
import { B2BService } from "./b2b.service";
import { B2BOrderQueryDto, UpdateB2BOrderStatusDto } from "./dto/b2b-order.dto";

@ApiTags("Admin B2B Orders")
@Roles(RoleCode.ADMIN)
@Controller("admin/b2b-orders")
export class AdminB2BOrdersController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get()
  @ApiOperation({ summary: "List B2B proforma invoices, purchase orders, and fulfilment state." })
  listOrders(@Query() query: B2BOrderQueryDto) {
    return this.b2bService.listAdminB2BOrders(query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read B2B order, proforma, purchase order, and timeline detail." })
  getOrder(@Param("orderNumber") orderNumber: string) {
    return this.b2bService.getAdminB2BOrder(orderNumber);
  }

  @Get(":orderNumber/purchase-order/document-access")
  @ApiOperation({ summary: "Read admin-authorized purchase-order document access metadata." })
  getPurchaseOrderDocumentAccess(@Param("orderNumber") orderNumber: string) {
    return this.b2bService.getAdminPurchaseOrderDocumentAccess(orderNumber);
  }

  @Get(":orderNumber/purchase-order/document")
  @ApiOperation({ summary: "Open or stream the admin-authorized purchase-order document." })
  async openPurchaseOrderDocument(
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getAdminPurchaseOrderDocumentAccess(orderNumber);
    return sendB2BPurchaseOrderDocument(access, response);
  }

  @Patch(":orderNumber/status")
  @ApiOperation({ summary: "Update B2B order PO acceptance and fulfilment status." })
  updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateB2BOrderStatusDto,
  ) {
    return this.b2bService.updateB2BOrderStatusAsAdmin(actor, orderNumber, dto);
  }
}
