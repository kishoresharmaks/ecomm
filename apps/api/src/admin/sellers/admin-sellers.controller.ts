import { Body, Controller, Get, Inject, Param, Patch, Query, Res, StreamableFile } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createReadStream } from "node:fs";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import type { RequestUser } from "../../auth/types/indihub-request";
import { AdminSellersService } from "./admin-sellers.service";
import {
  SellerApprovalDto,
  SellerDocumentStatusDto,
  SellerQueryDto,
  SellerSuspensionDto,
} from "./dto/seller-approval.dto";

type PrivateDocumentResponse = {
  redirect: (statusCode: number, url: string) => void;
  set: (headers: Record<string, string>) => void;
};

@ApiTags("admin sellers")
@Roles(RoleCode.ADMIN)
@Controller("admin/sellers")
export class AdminSellersController {
  constructor(@Inject(AdminSellersService) private readonly adminSellersService: AdminSellersService) {}

  @Get()
  @ApiOperation({ summary: "List sellers for admin management." })
  @ApiOkResponse({ description: "Seller list for admin management." })
  listSellers(@Query() query: SellerQueryDto) {
    return this.adminSellersService.listSellers(query);
  }

  @Get("pending")
  @ApiOperation({ summary: "List pending seller registrations." })
  @ApiOkResponse({ description: "Pending seller registrations." })
  getPendingSellers() {
    return this.adminSellersService.getPendingSellers();
  }

  @Get(":sellerId/export")
  @ApiOperation({ summary: "Read complete seller detail for admin audit export." })
  @ApiOkResponse({ description: "Complete seller detail for admin audit export." })
  getSellerExport(@Param("sellerId") sellerId: string) {
    return this.adminSellersService.getSellerExport(sellerId);
  }

  @Get(":sellerId")
  @ApiOperation({ summary: "Read seller detail for admin management." })
  @ApiOkResponse({ description: "Seller detail for admin management." })
  getSeller(@Param("sellerId") sellerId: string) {
    return this.adminSellersService.getSeller(sellerId);
  }

  @Get(":sellerId/documents/:documentId/access")
  @ApiOperation({ summary: "Read authenticated seller document access metadata for admin viewing." })
  @ApiOkResponse({ description: "Secure seller document access metadata." })
  getSellerDocumentAccess(
    @Param("sellerId") sellerId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.adminSellersService.getSellerDocumentAccess(sellerId, documentId, currentUser);
  }

  @Get(":sellerId/documents/:documentId/file")
  @ApiOperation({ summary: "Open a seller document through admin-authenticated streaming." })
  @ApiOkResponse({ description: "Seller document stream or signed provider redirect." })
  async getSellerDocumentFile(
    @Param("sellerId") sellerId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() currentUser: RequestUser,
    @Res({ passthrough: true }) response: PrivateDocumentResponse,
  ) {
    const access = await this.adminSellersService.getSellerDocumentAccess(
      sellerId,
      documentId,
      currentUser,
    );

    if (access.provider === "s3") {
      response.redirect(302, access.url);
      return undefined;
    }

    response.set({
      "Content-Type": access.contentType,
      "Content-Disposition": `inline; filename="${safeDownloadFileName(access.fileName)}"`,
      "Cache-Control": "private, max-age=0, no-store",
    });

    return new StreamableFile(createReadStream(access.filePath));
  }

  @Patch(":sellerId/approval")
  @ApiOperation({ summary: "Approve or reject a seller registration." })
  @ApiOkResponse({ description: "Seller approval status updated." })
  updateSellerApproval(
    @Param("sellerId") sellerId: string,
    @Body() dto: SellerApprovalDto,
    @CurrentUser() currentUser?: RequestUser
  ) {
    return this.adminSellersService.updateSellerApproval(sellerId, dto, currentUser);
  }

  @Patch(":sellerId/suspension")
  @ApiOperation({ summary: "Suspend or restore seller access." })
  @ApiOkResponse({ description: "Seller suspension status updated." })
  updateSellerSuspension(
    @Param("sellerId") sellerId: string,
    @Body() dto: SellerSuspensionDto,
    @CurrentUser() currentUser: RequestUser
  ) {
    return this.adminSellersService.updateSellerSuspension(sellerId, dto, currentUser);
  }

  @Patch(":sellerId/documents/:documentId/status")
  @ApiOperation({ summary: "Update seller verification document status." })
  @ApiOkResponse({ description: "Seller document status updated." })
  updateSellerDocumentStatus(
    @Param("sellerId") sellerId: string,
    @Param("documentId") documentId: string,
    @Body() dto: SellerDocumentStatusDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.adminSellersService.updateSellerDocumentStatus(
      sellerId,
      documentId,
      dto,
      currentUser,
    );
  }
}

function safeDownloadFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "").slice(0, 120) || "private-document";
}
