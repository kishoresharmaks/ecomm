import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { brandConfig } from "@indihub/config";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Check API liveness." })
  getHealth() {
    return {
      ok: true,
      service: "indihub-api",
      brand: brandConfig.name,
      timestamp: new Date().toISOString()
    };
  }
}
