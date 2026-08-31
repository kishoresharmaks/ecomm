import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createReadStream } from "node:fs";
import { RoleCode } from "@indihub/database";
import type { Response } from "express";
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

type ImpersonateBodyDto = {
  reason?: string;
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
  getPendingSellers(): Promise<unknown> {
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

  @Post(":sellerId/impersonate")
  @ApiOperation({ summary: "Create an admin impersonation session to log into the seller account." })
  @ApiOkResponse({ description: "Impersonation session token and redirect payload." })
  async impersonateSeller(
    @Param("sellerId") sellerId: string,
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: ImpersonateBodyDto,
    @Req() request: { ip?: string; headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.adminSellersService.impersonateSeller(sellerId, currentUser, {
      reason: dto?.reason,
      ipAddress: request.ip ?? readHeader(request.headers, "x-forwarded-for"),
    });

    response.cookie("indihub_seller_impersonation", session.token, {
      ...sellerImpersonationCookieOptions(),
      expires: new Date(session.expiresAt),
    });

    return session;
  }

  @Post("exit-impersonation")
  @ApiOperation({ summary: "End the active seller impersonation session." })
  @ApiOkResponse({ description: "Impersonation session ended." })
  async exitImpersonation(
    @CurrentUser() currentUser: RequestUser,
    @Req() request: { ip?: string; headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.adminSellersService.exitImpersonation(currentUser, {
      ipAddress: request.ip ?? readHeader(request.headers, "x-forwarded-for"),
    });

    response.clearCookie("indihub_seller_impersonation", sellerImpersonationCookieOptions());
    return result;
  }
}

function safeDownloadFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "").slice(0, 120) || "private-document";
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sellerImpersonationCookieOptions() {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.INDIHUB_PRODUCTION === "true" ||
    process.env.INDIHUB_ENV === "production";
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
}
