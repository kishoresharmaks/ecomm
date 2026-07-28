import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [LocationsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService]
})
export class CustomersModule {}
