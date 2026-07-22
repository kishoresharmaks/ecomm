import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SacMasterController } from "./sac-master.controller";
import { SacMasterService } from "./sac-master.service";

@Module({
  imports: [PrismaModule],
  controllers: [SacMasterController],
  providers: [SacMasterService],
})
export class SacMasterModule {}
