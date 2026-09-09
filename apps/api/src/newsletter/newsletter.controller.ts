import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RoleCode } from "@indihub/database";
import { NewsletterService } from "./newsletter.service";
import { SubscribeDto } from "./dto/subscribe.dto";
import { SubscriberQueryDto, newsletterPaginationFromQuery } from "./dto/subscriber-query.dto";

const ADMINS_ONLY = { requiresLogin: true } as const;

@ApiTags("Newsletter")
@Controller("newsletter")
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post("subscribe")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Subscribe an email to the newsletter." })
  @ApiResponse({ status: 200, description: "Subscribed successfully." })
  @ApiResponse({ status: 400, description: "Invalid email." })
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe({
      email: dto.email,
      name: dto.name,
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
      search: query.search,
      status: query.status,
      source: query.source,
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
