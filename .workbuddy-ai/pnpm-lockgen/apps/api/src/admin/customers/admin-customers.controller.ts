import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import type { RequestUser } from "../../auth/types/indihub-request";
import { AdminCustomersService } from "./admin-customers.service";
import { AdminCustomerQueryDto, UpdateCustomerStatusDto } from "./dto/admin-customer.dto";

@ApiTags("Admin Customers")
@Roles(RoleCode.ADMIN)
@Controller("admin/customers")
export class AdminCustomersController {
  constructor(@Inject(AdminCustomersService) private readonly adminCustomersService: AdminCustomersService) {}

  @Get()
  @ApiOperation({ summary: "List customers for admin management." })
  listCustomers(@Query() query: AdminCustomerQueryDto) {
    return this.adminCustomersService.listCustomers(query);
  }

  @Get(":customerId")
  @ApiOperation({ summary: "Read one customer profile for admin management." })
  getCustomer(@Param("customerId") customerId: string) {
    return this.adminCustomersService.getCustomer(customerId);
  }

  @Patch(":customerId/status")
  @ApiOperation({ summary: "Update a customer status." })
  updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("customerId") customerId: string,
    @Body() dto: UpdateCustomerStatusDto
  ) {
    return this.adminCustomersService.updateCustomerStatus(actor, customerId, dto);
  }
}
