import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { SacMasterQueryDto } from "./dto/sac-master-query.dto";
import { SacMasterService } from "./sac-master.service";

@ApiTags("SAC Master")
@Controller("sac-master")
export class SacMasterController {
  constructor(@Inject(SacMasterService) private readonly sacMasterService: SacMasterService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Search active official SAC classifications for service listing forms." })
  listSuggestions(@Query() query: SacMasterQueryDto): Promise<unknown> {
    return this.sacMasterService.listSuggestions(query);
  }
}
