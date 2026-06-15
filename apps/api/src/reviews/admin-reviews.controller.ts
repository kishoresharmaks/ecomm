import { Body, Controller, Get, Inject, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ModerateProductReviewDto } from "./dto/moderate-product-review.dto";
import { ReviewListQueryDto } from "./dto/review-query.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("Admin Reviews")
@Roles(RoleCode.ADMIN)
@Controller("admin/reviews")
export class AdminReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: "List product reviews for admin moderation." })
  listReviews(@Query() query: ReviewListQueryDto) {
    return this.reviewsService.listAdminReviews(query);
  }

  @Patch(":reviewId/moderation")
  @ApiOperation({ summary: "Approve, reject, or hide a product review." })
  moderateReview(
    @CurrentUser() actor: RequestUser,
    @Param("reviewId") reviewId: string,
    @Body() dto: ModerateProductReviewDto,
  ) {
    return this.reviewsService.moderateReview(actor, reviewId, dto);
  }
}
