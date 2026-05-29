import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { brandConfig, phaseOneScope } from "@indihub/config";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "indihub-api",
      brand: brandConfig.name,
      phase: "phase-1",
      budgetInr: phaseOneScope.budgetInr,
      timestamp: new Date().toISOString()
    };
  }
}
