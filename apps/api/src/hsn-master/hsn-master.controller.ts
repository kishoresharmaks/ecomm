import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { HsnMasterQueryDto } from "./dto/hsn-master-query.dto";
import { HsnMasterService } from "./hsn-master.service";

@ApiTags("HSN Master")
@Controller("hsn-master")
export class HsnMasterController {
  constructor(@Inject(HsnMasterService) private readonly hsnMasterService: HsnMasterService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Search active HSN/GST suggestions for category defaults and seller product forms." })
  listSuggestions(@Query() query: HsnMasterQueryDto): Promise<unknown> {
    return this.hsnMasterService.listSuggestions(query);
  }
}
