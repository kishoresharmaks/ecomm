import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { MobileHomeQueryDto } from "./dto/mobile-home-query.dto";
import { MobileStorefrontService } from "./mobile-storefront.service";

@ApiTags("Mobile Storefront")
@Public()
@Controller("mobile/storefront")
export class MobileStorefrontController {
  constructor(
    @Inject(MobileStorefrontService)
    private readonly mobileStorefrontService: MobileStorefrontService,
  ) {}

  @Get("home")
  @ApiOperation({ summary: "Read compact customer mobile homepage payload." })
  getHome(@Query() query: MobileHomeQueryDto) {
    return this.mobileStorefrontService.getMobileHome(query);
  }
}
