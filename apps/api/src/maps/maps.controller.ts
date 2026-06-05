import { Body, Controller, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ReverseGeocodeDto } from "./dto/reverse-geocode.dto";
import { MapsService } from "./maps.service";

@ApiTags("Maps")
@ApiBearerAuth()
@Controller("maps")
export class MapsController {
  constructor(@Inject(MapsService) private readonly mapsService: MapsService) {}

  @Post("reverse-geocode")
  @ApiOperation({ summary: "Reverse geocode a coordinate when an optional map provider token exists." })
  reverseGeocode(@Body() dto: ReverseGeocodeDto) {
    return this.mapsService.reverseGeocode(dto);
  }
}
