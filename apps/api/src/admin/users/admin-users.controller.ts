import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import type { RequestUser } from "../../auth/types/indihub-request";
import { AdminUsersService } from "./admin-users.service";
import {
  AdminUserQueryDto,
  SetBackOfficePasswordDto,
  UpdateDeliveryPartnerProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from "./dto/admin-user.dto";

@ApiTags("Admin Users")
@Roles(RoleCode.ADMIN)
@Controller("admin/users")
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: "List platform users and role mappings." })
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(":userId")
  @ApiOperation({ summary: "Read one platform user." })
  getUser(@Param("userId") userId: string) {
    return this.adminUsersService.getUser(userId);
  }

  @Patch(":userId/status")
  @ApiOperation({ summary: "Update a user account status." })
  updateStatus(@CurrentUser() actor: RequestUser, @Param("userId") userId: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminUsersService.updateStatus(actor, userId, dto);
  }

  @Post(":userId/roles")
  @ApiOperation({ summary: "Add a role to a platform user." })
  addRole(@CurrentUser() actor: RequestUser, @Param("userId") userId: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminUsersService.addRole(actor, userId, dto);
  }

  @Patch(":userId/roles/remove")
  @ApiOperation({ summary: "Remove a role from a platform user." })
  removeRole(@CurrentUser() actor: RequestUser, @Param("userId") userId: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminUsersService.removeRole(actor, userId, dto);
  }

  @Put(":userId/backoffice-password")
  @ApiOperation({ summary: "Set a standalone back-office password for admin or finance users." })
  setBackOfficePassword(
    @CurrentUser() actor: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: SetBackOfficePasswordDto
  ) {
    return this.adminUsersService.setBackOfficePassword(actor, userId, dto);
  }

  @Put(":userId/delivery-profile")
  @ApiOperation({ summary: "Create or update delivery partner operational profile." })
  updateDeliveryProfile(
    @CurrentUser() actor: RequestUser,
    @Param("userId") userId: string,
    @Body() dto: UpdateDeliveryPartnerProfileDto
  ) {
    return this.adminUsersService.updateDeliveryPartnerProfile(actor, userId, dto);
  }
}
