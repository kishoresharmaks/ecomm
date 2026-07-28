import { Body, Controller, Get, Inject, Param, Patch, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { sendB2BDocument } from "./b2b-document-response";
import { B2BService } from "./b2b.service";
import {
  B2BPaymentProofQueryDto,
  RejectB2BPaymentProofDto,
  VerifyB2BPaymentProofDto,
} from "./dto/b2b-order.dto";

@ApiTags("Admin B2B Payments")
@Roles(RoleCode.ADMIN, RoleCode.FINANCE)
@Controller("admin/b2b-payments")
export class AdminB2BPaymentsController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get()
  @ApiOperation({ summary: "List B2B payment proofs waiting for finance review." })
  listPaymentProofs(@Query() query: B2BPaymentProofQueryDto) {
    return this.b2bService.listAdminB2BPaymentProofs(query);
  }

  @Get(":proofId/document-access")
  @ApiOperation({ summary: "Read finance-authorized payment proof document access metadata." })
  getPaymentProofDocumentAccess(@Param("proofId") proofId: string) {
    return this.b2bService.getAdminPaymentProofDocumentAccess(proofId);
  }

  @Get(":proofId/document")
  @ApiOperation({ summary: "Open or stream a finance-authorized payment proof document." })
  async openPaymentProofDocument(
    @Param("proofId") proofId: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getAdminPaymentProofDocumentAccess(proofId);
    return sendB2BDocument(access, response, "payment-proof");
  }

  @Patch(":proofId/verify")
  @ApiOperation({ summary: "Verify a submitted B2B payment proof." })
  verifyProof(
    @CurrentUser() actor: RequestUser,
    @Param("proofId") proofId: string,
    @Body() dto: VerifyB2BPaymentProofDto,
  ) {
    return this.b2bService.verifyB2BPaymentProofAsAdmin(actor, proofId, dto);
  }

  @Patch(":proofId/reject")
  @ApiOperation({ summary: "Reject a B2B payment proof with a mandatory reason." })
  rejectProof(
    @CurrentUser() actor: RequestUser,
    @Param("proofId") proofId: string,
    @Body() dto: RejectB2BPaymentProofDto,
  ) {
    return this.b2bService.rejectB2BPaymentProofAsAdmin(actor, proofId, dto);
  }
}
