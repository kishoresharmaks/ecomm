import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { sendB2BDocument, sendB2BPurchaseOrderDocument } from "./b2b-document-response";
import { B2BService } from "./b2b.service";
import {
  B2BAdminReasonDto,
  B2BOrderQueryDto,
  ExtendB2BPaymentDueDateDto,
  IssueB2BRefundDto,
  RecordB2BManualPaymentDto,
  UpdateB2BOrderStatusDto,
} from "./dto/b2b-order.dto";

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

  @Get(":orderNumber/proforma-invoice/document-access")
  @ApiOperation({ summary: "Read admin-authorized proforma invoice access metadata." })
  getProformaInvoiceDocumentAccess(@Param("orderNumber") orderNumber: string) {
    return this.b2bService.getAdminProformaInvoiceDocumentAccess(orderNumber);
  }

  @Get(":orderNumber/proforma-invoice")
  @ApiOperation({ summary: "Open or stream the current admin proforma invoice." })
  async openProformaInvoiceDocument(
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getAdminProformaInvoiceDocumentAccess(orderNumber);
    return sendB2BDocument(access, response, "proforma-invoice.pdf");
  }

  @Get(":orderNumber/tax-invoice/document-access")
  @ApiOperation({ summary: "Read admin-authorized final tax invoice access metadata." })
  getTaxInvoiceDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getAdminTaxInvoiceDocumentAccess(actor, orderNumber);
  }

  @Get(":orderNumber/tax-invoice")
  @ApiOperation({ summary: "Open or stream the current admin final tax invoice." })
  async openTaxInvoiceDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getAdminTaxInvoiceDocumentAccess(actor, orderNumber);
    return sendB2BDocument(access, response, "tax-invoice.pdf");
  }

  @Get(":orderNumber/proforma-revisions")
  @ApiOperation({ summary: "List archived proforma invoice revisions." })
  listProformaRevisions(@Param("orderNumber") orderNumber: string) {
    return this.b2bService.listAdminB2BProformaRevisions(orderNumber);
  }

  @Post(":orderNumber/regenerate-proforma")
  @ApiOperation({ summary: "Regenerate current proforma invoice with revision history and audit log." })
  regenerateProforma(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: B2BAdminReasonDto,
  ) {
    return this.b2bService.regenerateB2BProformaAsAdmin(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/extend-due-date")
  @ApiOperation({ summary: "Extend a B2B payment due date with an audit reason." })
  extendPaymentDueDate(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: ExtendB2BPaymentDueDateDto,
  ) {
    return this.b2bService.extendB2BPaymentDueDateAsAdmin(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/set-not-required")
  @ApiOperation({ summary: "Mark B2B payment as not required for credit terms or admin waiver." })
  setPaymentNotRequired(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: B2BAdminReasonDto,
  ) {
    return this.b2bService.setB2BPaymentNotRequiredAsAdmin(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/unlock-fulfilment")
  @ApiOperation({ summary: "Override fulfilment lock after PO acceptance with an audit reason." })
  unlockFulfilment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: B2BAdminReasonDto,
  ) {
    return this.b2bService.unlockB2BFulfilmentAsAdmin(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/manual-payment")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Record a finance-verified manual/offline B2B payment." })
  recordManualPayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: RecordB2BManualPaymentDto,
  ) {
    return this.b2bService.recordB2BManualPaymentAsAdmin(actor, orderNumber, dto);
  }

  @Patch(":orderNumber/cancel")
  @ApiOperation({ summary: "Cancel a B2B order with a mandatory audit reason." })
  cancelOrder(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: B2BAdminReasonDto,
  ) {
    return this.b2bService.cancelB2BOrderAsAdmin(actor, orderNumber, dto);
  }

  @Post(":orderNumber/refund")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Issue an audited manual B2B refund adjustment." })
  issueRefund(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: IssueB2BRefundDto,
  ) {
    return this.b2bService.issueB2BRefundAsAdmin(actor, orderNumber, dto);
  }
}
