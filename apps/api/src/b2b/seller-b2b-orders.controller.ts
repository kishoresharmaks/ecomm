import { Body, Controller, Get, Inject, Param, Patch, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { sendB2BDocument, sendB2BPurchaseOrderDocument } from "./b2b-document-response";
import { B2BService } from "./b2b.service";
import { B2BOrderQueryDto, UpdateB2BTransportDto } from "./dto/b2b-order.dto";

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

  @Patch(":orderNumber/transport")
  @ApiOperation({ summary: "Update seller-arranged B2B pickup, courier, transport charge, and tracking details." })
  updateTransport(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: UpdateB2BTransportDto,
  ) {
    return this.b2bService.updateSellerB2BTransport(actor, orderNumber, dto);
  }

  @Get(":orderNumber/proforma-invoice/document-access")
  @ApiOperation({ summary: "Read seller-authorized proforma invoice access metadata." })
  getProformaInvoiceDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getSellerProformaInvoiceDocumentAccess(actor, orderNumber);
  }

  @Get(":orderNumber/proforma-invoice")
  @ApiOperation({ summary: "Open or stream the seller-authorized proforma invoice." })
  async openProformaInvoiceDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getSellerProformaInvoiceDocumentAccess(actor, orderNumber);
    return sendB2BDocument(access, response, "proforma-invoice.pdf");
  }

  @Get(":orderNumber/tax-invoice/document-access")
  @ApiOperation({ summary: "Read seller-authorized final tax invoice access metadata." })
  getTaxInvoiceDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getSellerTaxInvoiceDocumentAccess(actor, orderNumber);
  }

  @Get(":orderNumber/tax-invoice")
  @ApiOperation({ summary: "Open or stream the seller-authorized final tax invoice." })
  async openTaxInvoiceDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getSellerTaxInvoiceDocumentAccess(actor, orderNumber);
    return sendB2BDocument(access, response, "tax-invoice.pdf");
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
