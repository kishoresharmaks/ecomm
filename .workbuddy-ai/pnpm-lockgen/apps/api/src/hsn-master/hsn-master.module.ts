import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { HsnMasterController } from "./hsn-master.controller";
import { HsnMasterService } from "./hsn-master.service";

@Module({
  imports: [PrismaModule],
  controllers: [HsnMasterController],
  providers: [HsnMasterService],
})
export class HsnMasterModule {}
