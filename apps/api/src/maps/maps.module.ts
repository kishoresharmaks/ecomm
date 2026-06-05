import { Module } from "@nestjs/common";
import { MapsController } from "./maps.controller";
import { MapsService } from "./maps.service";
import { RouteDistanceService } from "./route-distance.service";

@Module({
  controllers: [MapsController],
  providers: [MapsService, RouteDistanceService],
  exports: [MapsService, RouteDistanceService],
})
export class MapsModule {}
