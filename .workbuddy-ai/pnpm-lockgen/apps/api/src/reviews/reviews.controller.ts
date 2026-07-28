import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { PublicProductReviewQueryDto } from "./dto/review-query.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("Product Reviews")
@Controller("reviews")
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get("products/:productId")
  @ApiOperation({ summary: "List approved public reviews for a product." })
  listProductReviews(@Param("productId") productId: string, @Query() query: PublicProductReviewQueryDto) {
    return this.reviewsService.listPublicProductReviews(productId, query);
  }

  @Public()
  @Get("products/:productId/summary")
  @ApiOperation({ summary: "Read approved public review summary for a product." })
  getProductReviewSummary(@Param("productId") productId: string) {
    return this.reviewsService.getPublicProductReviewSummary(productId);
  }
}
