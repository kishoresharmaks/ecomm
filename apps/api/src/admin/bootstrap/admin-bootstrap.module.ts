import { Module } from "@nestjs/common";
import { AdminBootstrapController } from "./admin-bootstrap.controller";
import { AdminBootstrapService } from "./admin-bootstrap.service";

@Module({
  controllers: [AdminBootstrapController],
  providers: [AdminBootstrapService]
})
export class AdminBootstrapModule {}

