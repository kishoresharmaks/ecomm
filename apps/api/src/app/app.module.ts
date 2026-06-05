import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminBootstrapModule } from "../admin/bootstrap/admin-bootstrap.module";
import { AdminCustomersModule } from "../admin/customers/admin-customers.module";
import { AdminDashboardModule } from "../admin/dashboard/admin-dashboard.module";
import { AdminSellersModule } from "../admin/sellers/admin-sellers.module";
import { AdminUsersModule } from "../admin/users/admin-users.module";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { B2BModule } from "../b2b/b2b.module";
import { CartModule } from "../cart/cart.module";
import { CategoriesModule } from "../categories/categories.module";
import { CmsModule } from "../cms/cms.module";
import { CustomersModule } from "../customers/customers.module";
import { FinanceModule } from "../finance/finance.module";
import { HealthController } from "../health/health.controller";
import { HsnMasterModule } from "../hsn-master/hsn-master.module";
import { LocationsModule } from "../locations/locations.module";
import { MapsModule } from "../maps/maps.module";
import { MarketModule } from "../market/market.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProductTemplatesModule } from "../product-templates/product-templates.module";
import { ProductsModule } from "../products/products.module";
import { ReportsModule } from "../reports/reports.module";
import { SellersModule } from "../sellers/sellers.module";
import { SettingsModule } from "../settings/settings.module";
import { StorageModule } from "../storage/storage.module";
import { StorefrontModule } from "../storefront/storefront.module";
import { SupportModule } from "../support/support.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: [".env", "../../.env"]
    }),
    PrismaModule,
    AuthModule,
    AuditModule,
    AdminBootstrapModule,
    AdminCustomersModule,
    CustomersModule,
    CartModule,
    B2BModule,
    CategoriesModule,
    CmsModule,
    FinanceModule,
    HsnMasterModule,
    LocationsModule,
    MapsModule,
    MarketModule,
    NotificationsModule,
    ProductTemplatesModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    SellersModule,
    SupportModule,
    SettingsModule,
    StorageModule,
    StorefrontModule,
    ReportsModule,
    AdminDashboardModule,
    AdminSellersModule,
    AdminUsersModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
