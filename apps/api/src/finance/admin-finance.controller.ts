import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { CommissionRulesService } from "./commission-rules.service";
import {
  ActiveStatusDto,
  CommissionRuleQueryDto,
  FinanceOfflinePaymentVerificationDto,
  FinanceListQueryDto,
  FinancePaymentCollectionQueryDto,
  GenerateStatementDto,
  ManualLedgerAdjustmentDto,
  MarkPayoutPaidDto,
  PayoutActionDto,
  PayoutQueryDto,
  SellerPayoutProfileVerificationDto,
  SettlementDraftDto,
  SettlementQueryDto,
  UpsertCommissionRuleDto
} from "./dto/finance.dto";
import { FinancePaymentsService } from "./finance-payments.service";
import { SellerLedgerService } from "./seller-ledger.service";
import { SellerPayoutsService } from "./seller-payouts.service";
import { SellerSettlementsService } from "./seller-settlements.service";
import { SellerStatementsService } from "./seller-statements.service";

@ApiTags("admin finance")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/finance")
export class AdminFinanceController {
  constructor(
    @Inject(CommissionRulesService) private readonly commissionRules: CommissionRulesService,
    @Inject(FinancePaymentsService) private readonly financePayments: FinancePaymentsService,
    @Inject(SellerSettlementsService) private readonly settlements: SellerSettlementsService,
    @Inject(SellerPayoutsService) private readonly payouts: SellerPayoutsService,
    @Inject(SellerLedgerService) private readonly ledger: SellerLedgerService,
    @Inject(SellerStatementsService) private readonly statements: SellerStatementsService
  ) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Read finance workspace dashboard metrics." })
  @ApiOkResponse({ description: "Finance workspace dashboard metrics." })
  dashboard() {
    return this.financePayments.dashboard();
  }

  @Get("payment-collections")
  @ApiOperation({ summary: "List payment collections for finance review." })
  @ApiOkResponse({ description: "COD, bank transfer, manual, and online payment records for finance review." })
  listPaymentCollections(@Query() query: FinancePaymentCollectionQueryDto) {
    return this.financePayments.listPaymentCollections(query);
  }

  @Patch("payment-collections/:orderNumber/offline-verification")
  @ApiOperation({ summary: "Verify or reject an offline payment collection." })
  verifyOfflinePayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: FinanceOfflinePaymentVerificationDto
  ) {
    return this.financePayments.verifyOfflinePayment(actor, orderNumber, dto);
  }

  @Get("payment-reports")
  @ApiOperation({ summary: "Read finance payment, settlement, and payout report summaries." })
  @ApiOkResponse({ description: "Finance payment, settlement, and payout report summaries." })
  paymentReports(@Query() query: FinancePaymentCollectionQueryDto) {
    return this.financePayments.paymentReports(query);
  }

  @Get("commission-rules")
  @ApiOperation({ summary: "List commission and deduction rules." })
  @ApiOkResponse({ description: "Admin-managed commission and deduction rules." })
  listCommissionRules(@Query() query: CommissionRuleQueryDto) {
    return this.commissionRules.listRules(query);
  }

  @Post("commission-rules")
  @ApiOperation({ summary: "Create a commission or deduction rule." })
  createCommissionRule(@Body() dto: UpsertCommissionRuleDto, @CurrentUser() actor: RequestUser) {
    return this.commissionRules.createRule(dto, actor);
  }

  @Patch("commission-rules/:ruleId")
  @ApiOperation({ summary: "Update a commission or deduction rule." })
  updateCommissionRule(@Param("ruleId") ruleId: string, @Body() dto: UpsertCommissionRuleDto, @CurrentUser() actor: RequestUser) {
    return this.commissionRules.updateRule(ruleId, dto, actor);
  }

  @Patch("commission-rules/:ruleId/active")
  @ApiOperation({ summary: "Activate or deactivate a commission rule." })
  setCommissionRuleActive(@Param("ruleId") ruleId: string, @Body() dto: ActiveStatusDto, @CurrentUser() actor: RequestUser) {
    return this.commissionRules.setRuleActive(ruleId, dto.active, actor);
  }

  @Get("settlements")
  @ApiOperation({ summary: "List seller settlement runs." })
  listSettlements(@Query() query: SettlementQueryDto) {
    return this.settlements.listRuns(query);
  }

  @Post("settlements/draft")
  @ApiOperation({ summary: "Create a seller settlement draft." })
  createSettlementDraft(@Body() dto: SettlementDraftDto, @CurrentUser() actor: RequestUser) {
    return this.settlements.createDraft(dto, actor);
  }

  @Get("settlements/:runId")
  @ApiOperation({ summary: "Read seller settlement detail." })
  getSettlement(@Param("runId") runId: string) {
    return this.settlements.getRun(runId);
  }

  @Patch("settlements/:runId/submit")
  @ApiOperation({ summary: "Submit a seller settlement run for payout processing." })
  submitSettlement(@Param("runId") runId: string, @CurrentUser() actor: RequestUser) {
    return this.settlements.submitRun(runId, actor);
  }

  @Get("payouts")
  @ApiOperation({ summary: "List seller payout requests." })
  listPayouts(@Query() query: PayoutQueryDto) {
    return this.payouts.listPayouts(query);
  }

  @Get("payouts/:payoutId")
  @ApiOperation({ summary: "Read seller payout detail." })
  getPayout(@Param("payoutId") payoutId: string) {
    return this.payouts.getPayout(payoutId);
  }

  @Patch("payouts/:payoutId/approve")
  @ApiOperation({ summary: "Approve a seller payout request." })
  approvePayout(@Param("payoutId") payoutId: string, @Body() dto: PayoutActionDto, @CurrentUser() actor: RequestUser) {
    return this.payouts.approvePayout(payoutId, dto, actor);
  }

  @Patch("payouts/:payoutId/reject")
  @ApiOperation({ summary: "Reject a seller payout request." })
  rejectPayout(@Param("payoutId") payoutId: string, @Body() dto: PayoutActionDto, @CurrentUser() actor: RequestUser) {
    return this.payouts.rejectPayout(payoutId, dto, actor);
  }

  @Patch("payouts/:payoutId/mark-paid")
  @ApiOperation({ summary: "Mark an approved seller payout as paid." })
  markPayoutPaid(@Param("payoutId") payoutId: string, @Body() dto: MarkPayoutPaidDto, @CurrentUser() actor: RequestUser) {
    return this.payouts.markPaid(payoutId, dto, actor);
  }

  @Patch("sellers/:sellerId/payout-profile/verification")
  @ApiOperation({ summary: "Verify or unverify a seller payout profile." })
  updateSellerPayoutProfileVerification(
    @Param("sellerId") sellerId: string,
    @Body() dto: SellerPayoutProfileVerificationDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.payouts.updateSellerPayoutProfileVerification(sellerId, dto, actor);
  }

  @Get("ledger")
  @ApiOperation({ summary: "List seller ledger entries." })
  listLedger(@Query() query: PayoutQueryDto) {
    return this.ledger.listLedger(query);
  }

  @Post("ledger/adjustments")
  @ApiOperation({ summary: "Add a manual seller ledger adjustment." })
  addManualAdjustment(@Body() dto: ManualLedgerAdjustmentDto, @CurrentUser() actor: RequestUser) {
    return this.ledger.addManualAdjustment(dto, actor);
  }

  @Get("statements")
  @ApiOperation({ summary: "List generated seller statements." })
  listStatements(@Query() query: FinanceListQueryDto) {
    return this.statements.listStatements(query);
  }

  @Post("statements")
  @ApiOperation({ summary: "Generate a seller statement." })
  generateStatement(@Body() dto: GenerateStatementDto, @CurrentUser() actor: RequestUser) {
    return this.statements.generateStatement(dto, actor);
  }

  @Get("statements/:statementId/download/:format")
  @ApiOperation({ summary: "Download a seller statement export." })
  downloadStatement(@Param("statementId") statementId: string, @Param("format") format: "csv" | "pdf") {
    return this.statements.exportStatement(statementId, format);
  }
}
