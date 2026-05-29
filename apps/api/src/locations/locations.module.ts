import { Module } from "@nestjs/common";
import { LocationsController, AdminLocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";

@Module({
  controllers: [LocationsController, AdminLocationsController],
  providers: [LocationsService],
  exports: [LocationsService]
})
export class LocationsModule {}
