import { Module } from "@nestjs/common";
import {
  AdminDeliveryPartnerApplicationsController,
  DeliveryPartnerApplicationsController,
} from "./delivery-partner-applications.controller";
import { DeliveryPartnerApplicationsService } from "./delivery-partner-applications.service";

@Module({
  controllers: [DeliveryPartnerApplicationsController, AdminDeliveryPartnerApplicationsController],
  providers: [DeliveryPartnerApplicationsService],
})
export class DeliveryPartnerApplicationsModule {}
