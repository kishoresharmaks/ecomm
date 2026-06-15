import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ReviewListQueryDto } from "./dto/review-query.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("Seller Reviews")
@Roles(RoleCode.SELLER)
@Controller("seller/reviews")
export class SellerReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Read the authenticated seller's approved review summary." })
  getSummary(@CurrentUser() actor: RequestUser) {
    return this.reviewsService.getSellerReviewSummary(actor);
  }

  @Get()
  @ApiOperation({ summary: "List product reviews for the authenticated seller's products." })
  listReviews(@CurrentUser() actor: RequestUser, @Query() query: ReviewListQueryDto) {
    return this.reviewsService.listSellerReviews(actor, query);
  }
}
