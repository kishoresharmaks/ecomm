import { Module } from "@nestjs/common";
import { CourierAdapterRegistry } from "./courier-adapter.registry";

@Module({
  providers: [CourierAdapterRegistry],
  exports: [CourierAdapterRegistry],
})
export class CourierAdaptersModule {}
