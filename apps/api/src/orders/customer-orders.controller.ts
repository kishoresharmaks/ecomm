import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { TaxDocumentsService } from "../tax/tax-documents.service";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { PlaceOrderDto } from "./dto/checkout.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { OrdersService } from "./orders.service";

type HeaderResponse = {
  set(headers: Record<string, string>): void;
};

@ApiTags("Customer Orders")
@Roles(RoleCode.CUSTOMER)
@Controller("account/orders")
export class CustomerOrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(TaxDocumentsService) private readonly taxDocuments: TaxDocumentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Place an order from the active customer cart." })
  placeOrder(@CurrentUser() actor: RequestUser, @Body() dto: PlaceOrderDto) {
    return this.ordersService.placeOrder(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: "List customer order history." })
  listOrders(@CurrentUser() actor: RequestUser, @Query() query: OrderQueryDto) {
    return this.ordersService.listCustomerOrders(actor, query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read customer order detail." })
  getOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.ordersService.getCustomerOrder(actor, orderNumber);
  }

  @Get(":orderNumber/tax-documents")
  @ApiOperation({ summary: "List issued purchase documents for a customer order." })
  listTaxDocuments(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.taxDocuments.listCustomerOrderDocuments(actor.id, orderNumber);
  }

  @Get(":orderNumber/tax-documents/:documentId/download")
  @ApiOperation({ summary: "Download an issued customer purchase document as a PDF." })
  async downloadTaxDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("documentId") documentId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const document = await this.taxDocuments.customerOrderDocumentPdf(
      actor.id,
      orderNumber,
      documentId,
    );
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0, no-store",
    });
    return new StreamableFile(document.buffer);
  }

  @Patch(":orderNumber/cancel")
  @ApiOperation({ summary: "Cancel a customer order before delivery completion." })
  cancelOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancelCustomerOrder(actor, orderNumber, dto);
  }
}
