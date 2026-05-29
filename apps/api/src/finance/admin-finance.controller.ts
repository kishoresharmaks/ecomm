import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
  @ApiOkResponse({ description: "Finance workspace dashboard metrics." })
  dashboard() {
    return this.financePayments.dashboard();
  }

  @Get("payment-collections")
  @ApiOkResponse({ description: "COD, bank transfer, manual, and online payment records for finance review." })
  listPaymentCollections(@Query() query: FinancePaymentCollectionQueryDto) {
    return this.financePayments.listPaymentCollections(query);
  }

  @Patch("payment-collections/:orderNumber/offline-verification")
  verifyOfflinePayment(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: FinanceOfflinePaymentVerificationDto
  ) {
    return this.financePayments.verifyOfflinePayment(actor, orderNumber, dto);
  }

  @Get("payment-reports")
  @ApiOkResponse({ description: "Finance payment, settlement, and payout report summaries." })
  paymentReports(@Query() query: FinancePaymentCollectionQueryDto) {
    return this.financePayments.paymentReports(query);
  }

  @Get("commission-rules")
  @ApiOkResponse({ description: "Admin-managed commission and deduction rules." })
  listCommissionRules(@Query() query: CommissionRuleQueryDto) {
    return this.commissionRules.listRules(query);
  }

  @Post("commission-rules")
  createCommissionRule(@Body() dto: UpsertCommissionRuleDto, @CurrentUser() actor: RequestUser) {
    return this.commissionRules.createRule(dto, actor);
  }

  @Patch("commission-rules/:ruleId")
  updateCommissionRule(@Param("ruleId") ruleId: string, @Body() dto: UpsertCommissionRuleDto, @CurrentUser() actor: RequestUser) {
    return this.commissionRules.updateRule(ruleId, dto, actor);
  }

  @Patch("commission-rules/:ruleId/active")
  setCommissionRuleActive(@Param("ruleId") ruleId: string, @Body() dto: ActiveStatusDto, @CurrentUser() actor: RequestUser) {
    return this.commissionRules.setRuleActive(ruleId, dto.active, actor);
  }

  @Get("settlements")
  listSettlements(@Query() query: SettlementQueryDto) {
    return this.settlements.listRuns(query);
  }

  @Post("settlements/draft")
  createSettlementDraft(@Body() dto: SettlementDraftDto, @CurrentUser() actor: RequestUser) {
    return this.settlements.createDraft(dto, actor);
  }

  @Get("settlements/:runId")
  getSettlement(@Param("runId") runId: string) {
    return this.settlements.getRun(runId);
  }

  @Patch("settlements/:runId/submit")
  submitSettlement(@Param("runId") runId: string, @CurrentUser() actor: RequestUser) {
    return this.settlements.submitRun(runId, actor);
  }

  @Get("payouts")
  listPayouts(@Query() query: PayoutQueryDto) {
    return this.payouts.listPayouts(query);
  }

  @Get("payouts/:payoutId")
  getPayout(@Param("payoutId") payoutId: string) {
    return this.payouts.getPayout(payoutId);
  }

  @Patch("payouts/:payoutId/approve")
  approvePayout(@Param("payoutId") payoutId: string, @Body() dto: PayoutActionDto, @CurrentUser() actor: RequestUser) {
    return this.payouts.approvePayout(payoutId, dto, actor);
  }

  @Patch("payouts/:payoutId/reject")
  rejectPayout(@Param("payoutId") payoutId: string, @Body() dto: PayoutActionDto, @CurrentUser() actor: RequestUser) {
    return this.payouts.rejectPayout(payoutId, dto, actor);
  }

  @Patch("payouts/:payoutId/mark-paid")
  markPayoutPaid(@Param("payoutId") payoutId: string, @Body() dto: MarkPayoutPaidDto, @CurrentUser() actor: RequestUser) {
    return this.payouts.markPaid(payoutId, dto, actor);
  }

  @Get("ledger")
  listLedger(@Query() query: PayoutQueryDto) {
    return this.ledger.listLedger(query);
  }

  @Post("ledger/adjustments")
  addManualAdjustment(@Body() dto: ManualLedgerAdjustmentDto, @CurrentUser() actor: RequestUser) {
    return this.ledger.addManualAdjustment(dto, actor);
  }

  @Get("statements")
  listStatements(@Query() query: FinanceListQueryDto) {
    return this.statements.listStatements(query);
  }

  @Post("statements")
  generateStatement(@Body() dto: GenerateStatementDto, @CurrentUser() actor: RequestUser) {
    return this.statements.generateStatement(dto, actor);
  }

  @Get("statements/:statementId/download/:format")
  downloadStatement(@Param("statementId") statementId: string, @Param("format") format: "csv" | "pdf") {
    return this.statements.exportStatement(statementId, format);
  }
}
