import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  CreateCancellationDto,
  CreateReturnRequestDto,
  ReturnListQueryDto,
} from "./dto/returns.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("Customer Returns")
@Roles(RoleCode.CUSTOMER)
@Controller("account/orders")
export class CustomerOrderReturnsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Post(":orderNumber/cancellations")
  @ApiOperation({ summary: "Cancel selected item quantities before dispatch." })
  createCancellation(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateCancellationDto,
  ) {
    return this.returnsService.createCancellation(actor, orderNumber, dto);
  }

  @Post(":orderNumber/returns")
  @ApiOperation({ summary: "Create a return, refund, or replacement request after delivery." })
  createReturn(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateReturnRequestDto,
  ) {
    return this.returnsService.createReturn(actor, orderNumber, dto);
  }
}

@ApiTags("Customer Returns")
@Roles(RoleCode.CUSTOMER)
@Controller("account/returns")
export class CustomerReturnsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated customer's return requests." })
  listReturns(@CurrentUser() actor: RequestUser, @Query() query: ReturnListQueryDto) {
    return this.returnsService.listCustomerReturns(actor, query);
  }

  @Get(":requestNumber")
  @ApiOperation({ summary: "Read one customer return request." })
  getReturn(@CurrentUser() actor: RequestUser, @Param("requestNumber") requestNumber: string) {
    return this.returnsService.getCustomerReturn(actor, requestNumber);
  }
}
