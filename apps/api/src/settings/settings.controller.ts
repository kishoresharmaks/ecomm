import { Body, Controller, Get, Inject, Param, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  SettingsQueryDto,
  UpsertCheckoutPlatformFeeDto,
  UpsertDeliveryPartnerPayoutSettingsDto,
  UpsertEmailSettingDto,
  UpsertMapRoutingSettingsDto,
  UpsertSettingDto,
} from "./dto/settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("Admin Settings")
@Roles(RoleCode.ADMIN)
@Controller("admin/settings")
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: "List platform settings." })
  listSettings(@Query() query: SettingsQueryDto) {
    return this.settingsService.listSettings(query);
  }

  @Get("email/current")
  @ApiOperation({ summary: "Read email provider setting." })
  getEmailSetting() {
    return this.settingsService.getEmailSetting();
  }

  @Put("email/current")
  @ApiOperation({ summary: "Update email provider setting." })
  upsertEmailSetting(@CurrentUser() actor: RequestUser, @Body() dto: UpsertEmailSettingDto) {
    return this.settingsService.upsertEmailSetting(actor, dto);
  }

  @Get("checkout/platform-fee")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Read checkout buyer platform fee settings." })
  getCheckoutPlatformFee() {
    return this.settingsService.getCheckoutPlatformFee();
  }

  @Put("checkout/platform-fee")
  @Roles(RoleCode.ADMIN, RoleCode.FINANCE)
  @ApiOperation({ summary: "Atomically update checkout buyer platform fee settings." })
  upsertCheckoutPlatformFee(@CurrentUser() actor: RequestUser, @Body() dto: UpsertCheckoutPlatformFeeDto) {
    return this.settingsService.upsertCheckoutPlatformFee(actor, dto);
  }

  @Get("delivery-partner-payouts")
  @ApiOperation({ summary: "Read delivery partner payout and earning settings." })
  getDeliveryPartnerPayoutSettings() {
    return this.settingsService.getDeliveryPartnerPayoutSettings();
  }

  @Put("delivery-partner-payouts")
  @ApiOperation({ summary: "Update delivery partner payout and earning settings." })
  upsertDeliveryPartnerPayoutSettings(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpsertDeliveryPartnerPayoutSettingsDto,
  ) {
    return this.settingsService.upsertDeliveryPartnerPayoutSettings(actor, dto);
  }

  @Get("maps/routing")
  @ApiOperation({ summary: "Read map routing provider settings." })
  getMapRoutingSettings() {
    return this.settingsService.getMapRoutingSettings();
  }

  @Put("maps/routing")
  @ApiOperation({ summary: "Update map routing provider settings." })
  upsertMapRoutingSettings(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpsertMapRoutingSettingsDto,
  ) {
    return this.settingsService.upsertMapRoutingSettings(actor, dto);
  }

  @Put(":key")
  @ApiOperation({ summary: "Create or update one platform setting." })
  upsertSetting(@CurrentUser() actor: RequestUser, @Param("key") key: string, @Body() dto: UpsertSettingDto) {
    return this.settingsService.upsertSetting(actor, key, dto);
  }
}
