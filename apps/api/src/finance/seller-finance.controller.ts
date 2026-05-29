import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { FinanceListQueryDto, PayoutQueryDto, SellerPayoutRequestDto } from "./dto/finance.dto";
import { SellerFinanceAccessService } from "./seller-finance-access.service";
import { SellerLedgerService } from "./seller-ledger.service";
import { SellerPayoutsService } from "./seller-payouts.service";
import { SellerStatementsService } from "./seller-statements.service";

@ApiTags("seller finance")
@Roles(RoleCode.SELLER)
@Controller("seller/finance")
export class SellerFinanceController {
  constructor(
    @Inject(SellerFinanceAccessService) private readonly access: SellerFinanceAccessService,
    @Inject(SellerLedgerService) private readonly ledger: SellerLedgerService,
    @Inject(SellerPayoutsService) private readonly payouts: SellerPayoutsService,
    @Inject(SellerStatementsService) private readonly statements: SellerStatementsService
  ) {}

  @Get("ledger")
  @ApiOkResponse({ description: "Authenticated seller ledger entries." })
  async listLedger(@CurrentUser() actor: RequestUser, @Query() query: PayoutQueryDto) {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.ledger.listLedger(query, sellerId);
  }

  @Get("payouts")
  async listPayouts(@CurrentUser() actor: RequestUser, @Query() query: PayoutQueryDto) {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.payouts.listPayouts(query, sellerId);
  }

  @Get("payouts/availability")
  async payoutAvailability(@CurrentUser() actor: RequestUser) {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.payouts.sellerPayoutAvailability(sellerId);
  }

  @Post("payout-requests")
  async requestPayout(@CurrentUser() actor: RequestUser, @Body() dto: SellerPayoutRequestDto) {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.payouts.requestSellerPayout(sellerId, dto, actor);
  }

  @Get("payouts/:payoutId")
  async getPayout(@CurrentUser() actor: RequestUser, @Param("payoutId") payoutId: string) {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.payouts.getPayout(payoutId, sellerId);
  }

  @Get("statements")
  async listStatements(@CurrentUser() actor: RequestUser, @Query() query: FinanceListQueryDto) {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.statements.listStatements(query, sellerId);
  }

  @Get("statements/:statementId/download/:format")
  async downloadStatement(@CurrentUser() actor: RequestUser, @Param("statementId") statementId: string, @Param("format") format: "csv" | "pdf") {
    const sellerId = await this.access.sellerIdForActor(actor);
    return this.statements.exportStatement(statementId, format, sellerId);
  }
}
