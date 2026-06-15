import { Module } from "@nestjs/common";
import { AdminReviewsController } from "./admin-reviews.controller";
import { CustomerReviewsController } from "./customer-reviews.controller";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { SellerReviewsController } from "./seller-reviews.controller";

@Module({
  controllers: [ReviewsController, CustomerReviewsController, AdminReviewsController, SellerReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
