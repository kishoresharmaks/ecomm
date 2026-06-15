import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { SubmitProductReviewDto } from "./dto/submit-product-review.dto";
import { ReviewsService } from "./reviews.service";

@ApiTags("Customer Reviews")
@Roles(RoleCode.CUSTOMER)
@Controller("account/reviews")
export class CustomerReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Get("orders/:orderNumber")
  @ApiOperation({ summary: "Read review eligibility for the products in a customer order." })
  getOrderReviewOptions(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.reviewsService.getCustomerOrderReviewOptions(actor, orderNumber);
  }

  @Post()
  @ApiOperation({ summary: "Submit or edit a verified-purchase product review." })
  submitReview(@CurrentUser() actor: RequestUser, @Body() dto: SubmitProductReviewDto) {
    return this.reviewsService.submitCustomerReview(actor, dto);
  }
}
