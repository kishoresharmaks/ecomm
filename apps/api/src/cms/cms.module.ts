import { Module } from "@nestjs/common";
import { AdminCmsController } from "./admin-cms.controller";
import { CmsService } from "./cms.service";
import { PublicCmsController } from "./public-cms.controller";

@Module({
  controllers: [PublicCmsController, AdminCmsController],
  providers: [CmsService],
  exports: [CmsService]
})
export class CmsModule {}

