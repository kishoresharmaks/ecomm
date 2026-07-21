import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { sendB2BDocument } from "./b2b-document-response";
import { B2BOperationsService } from "./b2b-operations.service";
import {
  AssignB2BShipmentDto,
  B2BControlActionDto,
  B2BOperationsQueryDto,
  B2BReceivableQueryDto,
  CompleteB2BWarehouseTaskDto,
  CreateB2BOrderAmendmentDto,
  CreateB2BCollectionTaskDto,
  CreateB2BErpConnectionDto,
  CreateB2BOnlinePaymentDto,
  CreateB2BPackageDto,
  CreateB2BPaymentRecordDto,
  CreateB2BProcurementDto,
  CreateB2BProductionDto,
  CreateB2BShipmentDto,
  CreateB2BSupportCaseDto,
  CreateB2BWarehouseTaskDto,
  DecideB2BCreditDto,
  DecideB2BOrderAmendmentDto,
  DecideB2BDeliveryDto,
  DispatchB2BShipmentDto,
  RecordB2BPodDto,
  RecordB2BQcDto,
  ReconcileB2BFinanceDto,
  ResolveB2BDisputeDto,
  ReviewB2BPoDto,
  UpdateB2BCollectionTaskDto,
  UpdateB2BErpConnectionDto,
  UpdateB2BProcurementDto,
  UpdateB2BProductionDto,
  UpdateB2BShipmentEventDto,
  UpdateB2BSupportCaseDto,
  UpsertB2BCreditProfileDto,
  UpsertB2BFulfilmentPlansDto,
  VerifyB2BPaymentRecordDto,
  VerifyB2BOnlinePaymentDto,
  VersionedB2BActionDto,
} from "./dto/b2b-operations.dto";

@ApiTags("B2B Order-to-Cash Buyer")
@Roles(RoleCode.BUSINESS_BUYER)
@Controller("b2b/v2/orders")
export class B2BBuyerOperationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List B2B V2 orders for the authenticated business buyer." })
  list(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
  ) {
    return this.operations.listOrders(actor, "BUYER", query);
  }

  @Get(":orderNumber")
  @ApiOperation({ summary: "Read one buyer-owned B2B V2 order." })
  get(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.operations.getOrder(actor, "BUYER", orderNumber);
  }

  @Post(":orderNumber/payments")
  @ApiOperation({ summary: "Submit a B2B bank, Razorpay, UPI, cheque, or manual payment record." })
  createPayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateB2BPaymentRecordDto,
  ) {
    return this.operations.createPayment(actor, orderNumber, idempotencyKey, dto, "BUYER");
  }

  @Post(":orderNumber/payments/online/order")
  @ApiOperation({ summary: "Create or reuse a Razorpay order for a B2B Razorpay or UPI payment." })
  createOnlinePayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CreateB2BOnlinePaymentDto,
  ) {
    return this.operations.createOnlinePayment(
      actor,
      orderNumber,
      idempotencyKey,
      dto,
    );
  }

  @Post(":orderNumber/payments/online/verify")
  @ApiOperation({ summary: "Verify a captured B2B Razorpay or UPI checkout payment." })
  verifyOnlinePayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: VerifyB2BOnlinePaymentDto,
  ) {
    return this.operations.verifyOnlinePayment(
      actor,
      orderNumber,
      idempotencyKey,
      dto,
    );
  }

  @Post(":orderNumber/shipments/:shipmentId/accept")
  @ApiOperation({ summary: "Accept proof-backed delivery for a B2B shipment." })
  acceptDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: DecideB2BDeliveryDto,
  ) {
    return this.operations.acceptDelivery(
      actor,
      orderNumber,
      shipmentId,
      idempotencyKey,
      dto,
      false,
    );
  }

  @Post(":orderNumber/shipments/:shipmentId/dispute")
  @ApiOperation({ summary: "Dispute proof-backed delivery for a B2B shipment." })
  disputeDelivery(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: DecideB2BDeliveryDto,
  ) {
    return this.operations.acceptDelivery(
      actor,
      orderNumber,
      shipmentId,
      idempotencyKey,
      dto,
      true,
    );
  }

  @Post(":orderNumber/cases")
  @ApiOperation({ summary: "Create an order-linked B2B buyer support case." })
  createCase(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateB2BSupportCaseDto,
  ) {
    return this.operations.createSupportCase(actor, orderNumber, "BUYER", dto);
  }

  @Post(":orderNumber/amendments")
  @ApiOperation({ summary: "Request an immutable change to a B2B order." })
  requestAmendment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BOrderAmendmentDto,
  ) {
    return this.operations.requestOrderAmendment(
      actor,
      orderNumber,
      "BUYER",
      key,
      dto,
    );
  }

  @Post(":orderNumber/reorder")
  @ApiOperation({ summary: "Create a revalidated draft enquiry from a completed B2B order." })
  reorder(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ) {
    return this.operations.createReorder(actor, orderNumber, idempotencyKey);
  }

  @Get(":orderNumber/payments/:paymentId/receipt")
  @ApiOperation({ summary: "Download an authenticated B2B buyer receipt voucher." })
  async receipt(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("paymentId") paymentId: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.receiptVoucherDocumentAccess(
      actor,
      "BUYER",
      orderNumber,
      paymentId,
    );
    return sendB2BDocument(access, response, "b2b-receipt-voucher.pdf");
  }

  @Get(":orderNumber/shipments/:shipmentId/pod/:fileReference")
  @ApiOperation({ summary: "Download buyer-authorized B2B proof-of-delivery evidence." })
  async pod(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Param("fileReference") fileReference: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.podDocumentAccess(
      actor,
      "BUYER",
      orderNumber,
      shipmentId,
      fileReference,
    );
    return sendB2BDocument(access, response, "proof-of-delivery");
  }
}

@ApiTags("B2B Order-to-Cash Seller")
@Roles(RoleCode.SELLER)
@Controller("seller/b2b-operations")
export class SellerB2BOperationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get("orders")
  @ApiOperation({ summary: "List seller-owned B2B V2 orders." })
  list(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
  ) {
    return this.operations.listOrders(actor, "SELLER", query);
  }

  @Get("orders/:orderNumber")
  @ApiOperation({ summary: "Read one seller-owned B2B V2 order." })
  get(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.operations.getOrder(actor, "SELLER", orderNumber);
  }

  @Post("orders/:orderNumber/fulfilment-plans")
  @ApiOperation({ summary: "Save line-level stock, procurement, or production plans." })
  fulfilmentPlans(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: UpsertB2BFulfilmentPlansDto,
  ) {
    return this.operations.upsertFulfilmentPlans(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/procurement-orders")
  @ApiOperation({ summary: "Create a seller procurement order for a B2B fulfilment plan." })
  createProcurement(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BProcurementDto,
  ) {
    return this.operations.createProcurement(actor, orderNumber, key, dto);
  }

  @Patch("orders/:orderNumber/procurement-orders/:procurementId")
  @ApiOperation({ summary: "Record partial or complete B2B procurement receipts." })
  updateProcurement(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("procurementId") procurementId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: UpdateB2BProcurementDto,
  ) {
    return this.operations.updateProcurement(
      actor,
      orderNumber,
      procurementId,
      key,
      dto,
    );
  }

  @Post("orders/:orderNumber/production-jobs")
  @ApiOperation({ summary: "Create a seller production job for a B2B fulfilment plan." })
  createProduction(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BProductionDto,
  ) {
    return this.operations.createProduction(actor, orderNumber, key, dto);
  }

  @Patch("orders/:orderNumber/production-jobs/:productionId")
  @ApiOperation({ summary: "Record B2B production progress, completion, and rejection." })
  updateProduction(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("productionId") productionId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: UpdateB2BProductionDto,
  ) {
    return this.operations.updateProduction(
      actor,
      orderNumber,
      productionId,
      key,
      dto,
    );
  }

  @Post("orders/:orderNumber/warehouse-tasks")
  @ApiOperation({ summary: "Create a seller B2B pick or pack task." })
  createWarehouseTask(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BWarehouseTaskDto,
  ) {
    return this.operations.createWarehouseTask(actor, orderNumber, key, dto);
  }

  @Patch("orders/:orderNumber/warehouse-tasks/:taskId")
  @ApiOperation({ summary: "Complete or hold a seller B2B warehouse task." })
  completeWarehouseTask(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("taskId") taskId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CompleteB2BWarehouseTaskDto,
  ) {
    return this.operations.completeWarehouseTask(actor, orderNumber, taskId, key, dto);
  }

  @Post("orders/:orderNumber/packages")
  @ApiOperation({ summary: "Create a sealed package for a B2B order." })
  createPackage(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BPackageDto,
  ) {
    return this.operations.createPackage(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/qc-inspections")
  @ApiOperation({ summary: "Record an immutable B2B package quality inspection." })
  recordQc(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: RecordB2BQcDto,
  ) {
    return this.operations.recordQc(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/final-invoice")
  @ApiOperation({ summary: "Issue the final GST or commercial document before dispatch." })
  issueInvoice(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: VersionedB2BActionDto,
  ) {
    return this.operations.issueFinalInvoice(actor, orderNumber, key, dto.version);
  }

  @Post("orders/:orderNumber/shipments")
  @ApiOperation({ summary: "Prepare a package-backed B2B shipment." })
  createShipment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BShipmentDto,
  ) {
    return this.operations.createShipment(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/shipments/:shipmentId/dispatch")
  @ApiOperation({ summary: "Dispatch a B2B shipment after payment and compliance gates." })
  dispatch(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: DispatchB2BShipmentDto,
  ) {
    return this.operations.dispatchShipment(actor, orderNumber, shipmentId, key, dto);
  }

  @Post("orders/:orderNumber/cases")
  @ApiOperation({ summary: "Create an order-linked B2B seller support case." })
  createCase(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateB2BSupportCaseDto,
  ) {
    return this.operations.createSupportCase(actor, orderNumber, "SELLER", dto);
  }

  @Post("orders/:orderNumber/amendments")
  @ApiOperation({ summary: "Request an immutable seller-side B2B order change." })
  requestAmendment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BOrderAmendmentDto,
  ) {
    return this.operations.requestOrderAmendment(
      actor,
      orderNumber,
      "SELLER",
      key,
      dto,
    );
  }

  @Get("orders/:orderNumber/shipments/:shipmentId/pod/:fileReference")
  @ApiOperation({ summary: "Download seller-authorized B2B proof-of-delivery evidence." })
  async pod(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Param("fileReference") fileReference: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.podDocumentAccess(
      actor,
      "SELLER",
      orderNumber,
      shipmentId,
      fileReference,
    );
    return sendB2BDocument(access, response, "proof-of-delivery");
  }

  @Get("delivery-partners")
  @ApiOperation({ summary: "List available delivery partners for B2B assignment." })
  deliveryPartners(@Query() query: B2BOperationsQueryDto) {
    return this.operations.listDeliveryPartners(query);
  }

  @Post("orders/:orderNumber/shipments/:shipmentId/assign")
  @ApiOperation({ summary: "Assign an available delivery partner to a B2B shipment." })
  assignShipment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: AssignB2BShipmentDto,
  ) {
    return this.operations.assignShipment(actor, orderNumber, shipmentId, key, dto);
  }

}

@ApiTags("B2B Order-to-Cash Admin")
@Roles(RoleCode.ADMIN)
@Controller("admin/b2b-operations")
export class AdminB2BOperationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get("orders")
  @ApiOperation({ summary: "List all B2B V2 orders for administration." })
  list(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
  ) {
    return this.operations.listOrders(actor, "ADMIN", query);
  }

  @Get("orders/:orderNumber")
  @ApiOperation({ summary: "Read one B2B V2 order for administration." })
  get(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.operations.getOrder(actor, "ADMIN", orderNumber);
  }

  @Get("exceptions")
  @ApiOperation({ summary: "List B2B operational, migration, delivery, payment, and GST exceptions." })
  exceptions(@Query() query: B2BOperationsQueryDto) {
    return this.operations.listExceptions(query);
  }

  @Post("orders/:orderNumber/po-review")
  @ApiOperation({ summary: "Record structured B2B purchase-order verification." })
  reviewPo(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: ReviewB2BPoDto,
  ) {
    return this.operations.reviewPurchaseOrder(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/final-invoice")
  @ApiOperation({ summary: "Issue a B2B final invoice as an administrator." })
  issueInvoice(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: VersionedB2BActionDto,
  ) {
    return this.operations.issueFinalInvoice(actor, orderNumber, key, dto.version);
  }

  @Post("orders/:orderNumber/hold")
  @ApiOperation({ summary: "Place a B2B order on an audited operational hold." })
  hold(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: B2BControlActionDto,
  ) {
    return this.operations.holdOrder(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/resume")
  @ApiOperation({ summary: "Resume a B2B order from its saved pre-hold state." })
  resume(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: B2BControlActionDto,
  ) {
    return this.operations.resumeOrder(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/cancel")
  @ApiOperation({ summary: "Cancel a pre-dispatch B2B order and release reservations." })
  cancel(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: B2BControlActionDto,
  ) {
    return this.operations.cancelOrder(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/amendments/:amendmentId/decision")
  @ApiOperation({ summary: "Approve and apply, or reject, a B2B order amendment." })
  decideAmendment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("amendmentId") amendmentId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: DecideB2BOrderAmendmentDto,
  ) {
    return this.operations.decideOrderAmendment(
      actor,
      orderNumber,
      amendmentId,
      key,
      dto,
    );
  }

  @Post("orders/:orderNumber/cases/:caseId/resolve")
  @ApiOperation({ summary: "Resolve a B2B dispute with audited quantity and financial outcomes." })
  resolveDispute(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("caseId") caseId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: ResolveB2BDisputeDto,
  ) {
    return this.operations.resolveDispute(
      actor,
      orderNumber,
      caseId,
      key,
      dto,
    );
  }

  @Get("orders/:orderNumber/shipments/:shipmentId/pod/:fileReference")
  @ApiOperation({ summary: "Download administrator-authorized B2B POD evidence." })
  async pod(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Param("fileReference") fileReference: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.podDocumentAccess(
      actor,
      "ADMIN",
      orderNumber,
      shipmentId,
      fileReference,
    );
    return sendB2BDocument(access, response, "proof-of-delivery");
  }
}

@ApiTags("B2B Order-to-Cash Finance")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("finance/b2b")
export class FinanceB2BOperationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get("orders")
  @ApiOperation({ summary: "List B2B orders for finance operations." })
  listOrders(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
  ) {
    return this.operations.listOrders(actor, "FINANCE", query);
  }

  @Get("orders/:orderNumber")
  @ApiOperation({ summary: "Read one B2B order for finance operations." })
  getOrder(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.operations.getOrder(actor, "FINANCE", orderNumber);
  }

  @Get("receivables")
  @ApiOperation({ summary: "List paginated B2B receivables and ageing." })
  listReceivables(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BReceivableQueryDto,
  ) {
    return this.operations.listReceivables(actor, query);
  }

  @Put("buyers/:businessBuyerId/credit-profile")
  @ApiOperation({ summary: "Create or update a business buyer credit profile." })
  creditProfile(
    @CurrentUser() actor: RequestUser,
    @Param("businessBuyerId") businessBuyerId: string,
    @Body() dto: UpsertB2BCreditProfileDto,
  ) {
    return this.operations.upsertCreditProfile(actor, businessBuyerId, dto);
  }

  @Post("orders/:orderNumber/credit-decision")
  @ApiOperation({ summary: "Record an audited B2B order credit decision." })
  decideCredit(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: DecideB2BCreditDto,
  ) {
    return this.operations.decideCredit(actor, orderNumber, key, dto);
  }

  @Post("orders/:orderNumber/payments")
  @ApiOperation({ summary: "Record a finance-entered B2B payment." })
  recordPayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: CreateB2BPaymentRecordDto,
  ) {
    return this.operations.createPayment(actor, orderNumber, key, dto, "FINANCE");
  }

  @Post("orders/:orderNumber/reconcile")
  @ApiOperation({ summary: "Reconcile cached B2B balances from immutable payment and ledger records." })
  reconcile(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: ReconcileB2BFinanceDto,
  ) {
    return this.operations.reconcileFinances(actor, orderNumber, key, dto);
  }

  @Post("payments/:paymentId/verify")
  @ApiOperation({ summary: "Verify, clear, reject, or bounce a B2B payment." })
  verifyPayment(
    @CurrentUser() actor: RequestUser,
    @Param("paymentId") paymentId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() dto: VerifyB2BPaymentRecordDto,
  ) {
    return this.operations.verifyPayment(actor, paymentId, key, dto);
  }

  @Post("collection-tasks")
  @ApiOperation({ summary: "Create a B2B receivable collection task." })
  createCollectionTask(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateB2BCollectionTaskDto,
  ) {
    return this.operations.createCollectionTask(actor, dto);
  }

  @Patch("collection-tasks/:taskId")
  @ApiOperation({ summary: "Update B2B collection status and promise-to-pay details." })
  updateCollectionTask(
    @CurrentUser() actor: RequestUser,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateB2BCollectionTaskDto,
  ) {
    return this.operations.updateCollectionTask(actor, taskId, dto);
  }

  @Get("orders/:orderNumber/payments/:paymentId/receipt")
  @ApiOperation({ summary: "Download a finance-authorized B2B receipt voucher." })
  async receipt(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("paymentId") paymentId: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.receiptVoucherDocumentAccess(
      actor,
      "FINANCE",
      orderNumber,
      paymentId,
    );
    return sendB2BDocument(access, response, "b2b-receipt-voucher.pdf");
  }

  @Get("orders/:orderNumber/shipments/:shipmentId/pod/:fileReference")
  @ApiOperation({ summary: "Download finance-authorized B2B POD evidence." })
  async pod(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Param("shipmentId") shipmentId: string,
    @Param("fileReference") fileReference: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.podDocumentAccess(
      actor,
      "FINANCE",
      orderNumber,
      shipmentId,
      fileReference,
    );
    return sendB2BDocument(access, response, "proof-of-delivery");
  }
}

@ApiTags("B2B Delivery")
@Roles(RoleCode.DELIVERY_PARTNER, RoleCode.COURIER_MANAGER)
@Controller("delivery/b2b-shipments")
export class DeliveryB2BOperationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List B2B shipments assigned to the delivery user." })
  list(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
  ) {
    return this.operations.assignedShipments(actor, query);
  }

  @Get(":shipmentId")
  @ApiOperation({ summary: "Read one assigned B2B shipment." })
  get(@CurrentUser() actor: RequestUser, @Param("shipmentId") shipmentId: string) {
    return this.operations.assignedShipment(actor, shipmentId);
  }

  @Post(":shipmentId/events")
  @ApiOperation({ summary: "Record an in-transit B2B shipment event." })
  event(
    @CurrentUser() actor: RequestUser,
    @Param("shipmentId") shipmentId: string,
    @Body() dto: UpdateB2BShipmentEventDto,
  ) {
    return this.operations.recordShipmentEvent(actor, shipmentId, dto);
  }

  @Post(":shipmentId/pod")
  @ApiOperation({ summary: "Record immutable B2B proof of delivery." })
  pod(
    @CurrentUser() actor: RequestUser,
    @Param("shipmentId") shipmentId: string,
    @Body() dto: RecordB2BPodDto,
  ) {
    return this.operations.recordPod(actor, shipmentId, dto);
  }

  @Get(":shipmentId/pod/:fileReference")
  @ApiOperation({ summary: "Download POD evidence for an assigned B2B shipment." })
  async podDocument(
    @CurrentUser() actor: RequestUser,
    @Param("shipmentId") shipmentId: string,
    @Param("fileReference") fileReference: string,
    @Res({ passthrough: true }) response: DocumentResponse,
  ) {
    const access = await this.operations.assignedPodDocumentAccess(
      actor,
      shipmentId,
      fileReference,
    );
    return sendB2BDocument(access, response, "proof-of-delivery");
  }
}

@ApiTags("B2B Support")
@Roles(RoleCode.ADMIN, RoleCode.SUPPORT_STAFF, RoleCode.CHAT_SUPPORT)
@Controller("support/b2b-cases")
export class SupportB2BOperationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List paginated order-linked B2B support cases." })
  list(@Query() query: B2BOperationsQueryDto) {
    return this.operations.listSupportCases(query);
  }

  @Patch(":caseId")
  @ApiOperation({ summary: "Assign, progress, resolve, or close a B2B support case." })
  update(
    @CurrentUser() actor: RequestUser,
    @Param("caseId") caseId: string,
    @Body() dto: UpdateB2BSupportCaseDto,
  ) {
    return this.operations.updateSupportCase(actor, caseId, dto);
  }
}

@ApiTags("B2B ERP Integrations")
@Roles(RoleCode.ADMIN)
@Controller("admin/b2b-integrations")
export class AdminB2BIntegrationsController {
  constructor(
    @Inject(B2BOperationsService)
    private readonly operations: B2BOperationsService,
  ) {}

  @Get("connections")
  @ApiOperation({ summary: "List configured B2B ERP connections without credentials." })
  connections() {
    return this.operations.listErpConnections();
  }

  @Post("connections")
  @ApiOperation({ summary: "Create an encrypted signed B2B ERP connection." })
  createConnection(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateB2BErpConnectionDto,
  ) {
    return this.operations.createErpConnection(actor, dto);
  }

  @Patch("connections/:connectionId")
  @ApiOperation({ summary: "Update B2B ERP connection status or encrypted settings." })
  updateConnection(
    @Param("connectionId") connectionId: string,
    @Body() dto: UpdateB2BErpConnectionDto,
  ) {
    return this.operations.updateErpConnection(connectionId, dto);
  }

  @Get("outbox")
  @ApiOperation({ summary: "List B2B ERP webhook delivery history." })
  outbox(@Query() query: B2BOperationsQueryDto) {
    return this.operations.listOutbox(query);
  }

  @Get("exports")
  @ApiOperation({ summary: "List paginated persisted B2B ERP export jobs." })
  exports(@Query() query: B2BOperationsQueryDto) {
    return this.operations.listErpExportJobs(query);
  }

  @Post("exports/orders")
  @ApiOperation({ summary: "Generate and persist a B2B order export job." })
  createOrderExport(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
    @Query("format") format: string | undefined,
  ) {
    return this.operations.createErpOrderExportJob(actor, query, format);
  }

  @Get("exports/:jobId/download")
  @ApiOperation({ summary: "Download a completed persisted B2B ERP export." })
  async downloadExport(
    @Param("jobId") jobId: string,
    @Res({ passthrough: true }) response: ExportResponse,
  ) {
    const exportFile = await this.operations.erpExportJobContent(jobId);
    if ("access" in exportFile) {
      return sendB2BDocument(exportFile.access, response, exportFile.fileName, "attachment");
    }
    response.setHeader("Content-Type", exportFile.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportFile.fileName}"`,
    );
    return exportFile.content;
  }

  @Get("exports/orders")
  @ApiOperation({ summary: "Generate, persist, and download a multi-line B2B order export." })
  async exportOrders(
    @CurrentUser() actor: RequestUser,
    @Query() query: B2BOperationsQueryDto,
    @Query("format") format: string | undefined,
    @Res({ passthrough: true }) response: ExportResponse,
  ) {
    const job = await this.operations.createErpOrderExportJob(actor, query, format);
    const exportFile = await this.operations.erpExportJobContent(job.id);
    if ("access" in exportFile) {
      return sendB2BDocument(exportFile.access, response, exportFile.fileName, "attachment");
    }
    response.setHeader("Content-Type", exportFile.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportFile.fileName}"`,
    );
    return exportFile.content;
  }

  @Post("outbox/:eventId/replay")
  @ApiOperation({ summary: "Replay a failed or dead-letter B2B ERP event." })
  replay(@Param("eventId") eventId: string) {
    return this.operations.replayOutbox(eventId);
  }
}

type DocumentResponse = {
  redirect: (status: number, url: string) => unknown;
  set: (headers: Record<string, string>) => unknown;
};

type ExportResponse = {
  redirect: (status: number, url: string) => unknown;
  set: (headers: Record<string, string>) => unknown;
  setHeader: (name: string, value: string) => unknown;
};
