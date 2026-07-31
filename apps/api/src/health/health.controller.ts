import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { brandConfig } from "@indihub/config";
import { Public } from "../auth/decorators/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Check API liveness using the legacy compatibility endpoint." })
  getHealth() {
    return { ...this.health.liveness(), brand: brandConfig.name };
  }

  @Get("live")
  @ApiOperation({ summary: "Check whether the API process is alive." })
  getLiveness() {
    return this.health.liveness();
  }

  @Get("ready")
  @ApiOperation({ summary: "Check required dependency readiness and optional degradation." })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.health.readiness();
    if (!readiness.ok) response.status(503);
    return readiness;
  }
}
