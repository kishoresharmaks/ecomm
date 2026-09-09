import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RoleCode } from "@indihub/database";
import { NewsletterService } from "./newsletter.service";
import { SubscribeDto } from "./dto/subscribe.dto";
import { SubscriberQueryDto, newsletterPaginationFromQuery } from "./dto/subscriber-query.dto";

@ApiTags("Newsletter")
@Controller(["newsletter", "admin/newsletter"])
export class NewsletterController {
  constructor(@Inject(NewsletterService) private readonly newsletterService: NewsletterService) {}

  @Post("subscribe")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Subscribe an email to the newsletter." })
  @ApiResponse({ status: 200, description: "Subscribed successfully." })
  @ApiResponse({ status: 400, description: "Invalid email." })
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe({
      email: dto.email,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
    });
  }

  @Get("subscribers")
  @Roles(RoleCode.ADMIN)
  @ApiOperation({ summary: "List newsletter subscribers (admin)." })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "source", required: false, type: String })
  listSubscribers(@Query() query: SubscriberQueryDto) {
    const { page, limit } = newsletterPaginationFromQuery(query);
    return this.newsletterService.listSubscribers({
      page,
      limit,
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.source !== undefined ? { source: query.source } : {}),
    });
  }

  @Delete("subscribers/:email")
  @Roles(RoleCode.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unsubscribe an email (admin)." })
  @ApiParam({ name: "email", description: "Subscriber email address" })
  unsubscribe(@Param("email") email: string) {
    return this.newsletterService.unsubscribe(email);
  }

  @Post("subscribers/:email/resend-welcome")
  @Roles(RoleCode.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend welcome email to a subscriber (admin)." })
  @ApiParam({ name: "email", description: "Subscriber email address" })
  resendWelcome(@Param("email") email: string) {
    return this.newsletterService.resendWelcome(email);
  }
}
