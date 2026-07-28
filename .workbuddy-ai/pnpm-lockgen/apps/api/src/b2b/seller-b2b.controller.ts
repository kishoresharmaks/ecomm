import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { B2BService } from "./b2b.service";
import {
  B2BEnquiryDetailQueryDto,
  SendB2BMessageDto,
} from "./dto/b2b-message.dto";
import { B2BEnquiryQueryDto } from "./dto/b2b-query.dto";
import { CreateB2BResponseDto } from "./dto/b2b-response.dto";

@ApiTags("Seller B2B Enquiries")
@Roles(RoleCode.SELLER)
@Controller("seller/b2b-enquiries")
export class SellerB2BController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get()
  @ApiOperation({ summary: "List B2B enquiries assigned to the authenticated seller." })
  listEnquiries(@CurrentUser() actor: RequestUser, @Query() query: B2BEnquiryQueryDto) {
    return this.b2bService.listSellerEnquiries(actor, query);
  }

  @Get(":enquiryId")
  @ApiOperation({ summary: "Read seller-visible B2B enquiry detail." })
  getEnquiry(
    @CurrentUser() actor: RequestUser,
    @Param("enquiryId") enquiryId: string,
    @Query() query: B2BEnquiryDetailQueryDto,
  ) {
    return this.b2bService.getSellerEnquiryDetail(actor, enquiryId, query);
  }

  @Post(":enquiryId/responses")
  @ApiOperation({ summary: "Add a manual seller response to a B2B enquiry." })
  respond(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string, @Body() dto: CreateB2BResponseDto) {
    return this.b2bService.respondAsSeller(actor, enquiryId, dto);
  }

  @Post(":enquiryId/messages")
  @ApiOperation({ summary: "Send a seller message in an active B2B negotiation." })
  sendMessage(
    @CurrentUser() actor: RequestUser,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: SendB2BMessageDto,
  ) {
    return this.b2bService.sendMessageAsSeller(actor, enquiryId, dto);
  }
}
