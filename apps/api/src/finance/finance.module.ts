import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { CommissionRulesService } from "./commission-rules.service";
import { AdminFinanceController } from "./admin-finance.controller";
import { FinanceCalculatorService } from "./finance-calculator.service";
import { FinancePaymentsService } from "./finance-payments.service";
import { SellerFinanceAccessService } from "./seller-finance-access.service";
import { SellerCashReceivablesService } from "./seller-cash-receivables.service";
import { SellerFinanceController } from "./seller-finance.controller";
import { SellerLedgerService } from "./seller-ledger.service";
import { SellerPayoutsService } from "./seller-payouts.service";
import { SellerSettlementsService } from "./seller-settlements.service";
import { SellerStatementsService } from "./seller-statements.service";

@Module({
  imports: [NotificationsModule],
  controllers: [AdminFinanceController, SellerFinanceController],
  providers: [
    CommissionRulesService,
    FinanceCalculatorService,
    FinancePaymentsService,
    SellerFinanceAccessService,
    SellerCashReceivablesService,
    SellerLedgerService,
    SellerPayoutsService,
    SellerSettlementsService,
    SellerStatementsService
  ],
  exports: [FinanceCalculatorService, SellerCashReceivablesService, SellerLedgerService]
})
export class FinanceModule {}
