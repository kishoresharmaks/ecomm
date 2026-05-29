import { Body, Controller, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { FirstAdminDto } from "./dto/first-admin.dto";
import { AdminBootstrapService } from "./admin-bootstrap.service";

@ApiTags("Admin Bootstrap")
@Controller("admin/bootstrap")
export class AdminBootstrapController {
  constructor(@Inject(AdminBootstrapService) private readonly adminBootstrapService: AdminBootstrapService) {}

  @Public()
  @Post("first-admin")
  @ApiOperation({ summary: "Create the first standalone 1HandIndia admin login." })
  @ApiHeader({ name: "x-indihub-bootstrap-secret", required: true })
  createFirstAdmin(
    @Headers("x-indihub-bootstrap-secret") bootstrapSecret: string | undefined,
    @Body() dto: FirstAdminDto
  ) {
    const expectedSecret = process.env.INDIHUB_BOOTSTRAP_SECRET;

    if (!expectedSecret || bootstrapSecret !== expectedSecret) {
      throw new UnauthorizedException("Valid 1HandIndia bootstrap secret is required.");
    }

    return this.adminBootstrapService.createFirstAdmin(dto);
  }
}
