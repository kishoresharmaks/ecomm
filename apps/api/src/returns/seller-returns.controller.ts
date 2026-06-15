import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ReturnListQueryDto, SellerReturnNoteDto } from "./dto/returns.dto";
import { ReturnsService } from "./returns.service";

@ApiTags("Seller Returns")
@Roles(RoleCode.SELLER)
@Controller("seller/returns")
export class SellerReturnsController {
  constructor(@Inject(ReturnsService) private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: "List return requests involving the authenticated seller." })
  listReturns(@CurrentUser() actor: RequestUser, @Query() query: ReturnListQueryDto) {
    return this.returnsService.listSellerReturns(actor, query);
  }

  @Get(":requestNumber")
  @ApiOperation({ summary: "Read one seller return request." })
  getReturn(@CurrentUser() actor: RequestUser, @Param("requestNumber") requestNumber: string) {
    return this.returnsService.getSellerReturn(actor, requestNumber);
  }

  @Post(":requestNumber/notes")
  @ApiOperation({ summary: "Add a seller note to a return request." })
  addNote(
    @CurrentUser() actor: RequestUser,
    @Param("requestNumber") requestNumber: string,
    @Body() dto: SellerReturnNoteDto,
  ) {
    return this.returnsService.addSellerNote(actor, requestNumber, dto);
  }
}
