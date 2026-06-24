import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createReadStream } from "node:fs";
import { FileInterceptor } from "@nestjs/platform-express";
import { RoleCode } from "@indihub/database";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import {
  PrivateDocumentUploadRequestDto,
  PublicImageUploadRequestDto,
  UpsertStorageConfigurationDto,
} from "./dto/storage-config.dto";
import { StorageService } from "./storage.service";

type UploadedPrivateDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type PrivateDocumentResponse = {
  redirect: (status: number, url: string) => unknown;
  set: (headers: Record<string, string>) => unknown;
};

@ApiTags("Storage")
@Controller("storage")
export class StorageController {
  constructor(@Inject(StorageService) private readonly storageService: StorageService) {}

  @Get("readiness")
  @Roles(RoleCode.ADMIN)
  @ApiOperation({ summary: "Read storage provider readiness." })
  readiness() {
    return this.storageService.getReadiness();
  }

  @Get("public-image")
  @Public()
  @ApiOperation({
    summary: "Redirect a portable image storage key to the configured public image base URL.",
  })
  async publicImage(
    @Query("key") key: string | undefined,
    @Res() response: { redirect: (status: number, url: string) => unknown },
  ) {
    const url = await this.storageService.publicImageUrl(key);
    return response.redirect(302, url);
  }

  @Get("configuration")
  @Roles(RoleCode.ADMIN)
  @ApiOperation({ summary: "Read admin storage configuration without exposing secrets." })
  configuration() {
    return this.storageService.adminStorageConfiguration();
  }

  @Patch("configuration")
  @Roles(RoleCode.ADMIN)
  @ApiOperation({ summary: "Update public image and private storage configuration." })
  updateConfiguration(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpsertStorageConfigurationDto,
  ) {
    return this.storageService.updateStorageConfiguration(actor, dto);
  }

  @Post("public-image/upload-request")
  @Roles(RoleCode.ADMIN, RoleCode.SELLER)
  @ApiOperation({ summary: "Create a provider-specific public image upload request." })
  createPublicImageUploadRequest(
    @CurrentUser() actor: RequestUser,
    @Body() dto: PublicImageUploadRequestDto,
  ) {
    return this.storageService.createPublicImageUploadRequest(actor, dto);
  }

  @Post("private-document/upload-request")
  @Roles(RoleCode.ADMIN, RoleCode.SELLER, RoleCode.CUSTOMER)
  @ApiOperation({
    summary: "Create an S3 signed PUT or local multipart private document upload request.",
  })
  createPrivateDocumentUploadRequest(
    @CurrentUser() actor: RequestUser,
    @Body() dto: PrivateDocumentUploadRequestDto,
  ) {
    return this.storageService.createPrivateDocumentUploadRequest(actor, dto);
  }

  @Post("private-document/upload")
  @Roles(RoleCode.ADMIN, RoleCode.SELLER, RoleCode.CUSTOMER)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description:
      "Multipart local-private-storage upload. The file field must be named `file`. Server validation allows PDF, JPG, PNG, and WebP only, verifies file magic bytes, and rejects files larger than 10 MB. Unlinked uploads are eligible for orphan cleanup after 24 hours.",
    schema: {
      type: "object",
      required: ["documentType", "file"],
      properties: {
        documentType: {
          type: "string",
          enum: [
            "ID_PROOF",
            "SIGNATURE_PROOF",
            "GST_CERTIFICATE",
            "PAN_CARD",
            "ADDRESS_PROOF",
            "BANK_PROOF",
            "BUSINESS_REGISTRATION",
            "OTHER",
          ],
        },
        file: {
          type: "string",
          format: "binary",
          description:
            "Binary document file. Allowed: application/pdf, image/jpeg, image/png, image/webp. Maximum size: 10 MB.",
        },
      },
    },
  })
  @ApiOperation({ summary: "Upload a private seller document through local multipart storage." })
  uploadPrivateDocument(
    @CurrentUser() actor: RequestUser,
    @Body("documentType") documentType: string | undefined,
    @UploadedFile() file: UploadedPrivateDocumentFile | undefined,
  ) {
    return this.storageService.saveLocalPrivateDocument(actor, documentType, file);
  }

  @Get("private-document")
  @Roles(RoleCode.ADMIN, RoleCode.SELLER)
  @ApiOperation({ summary: "Open a private document through signed URL or authenticated stream." })
  async privateDocument(
    @CurrentUser() actor: RequestUser,
    @Query("key") key: string | undefined,
    @Res({ passthrough: true }) response: PrivateDocumentResponse,
  ) {
    const access = await this.storageService.privateDocumentAccess(actor, key);
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

  @Get("private-document/access")
  @Roles(RoleCode.ADMIN, RoleCode.SELLER)
  @ApiOperation({ summary: "Read private document access metadata for authenticated viewing." })
  async privateDocumentAccess(@CurrentUser() actor: RequestUser, @Query("key") key: string | undefined) {
    const access = await this.storageService.privateDocumentAccess(actor, key);

    if (access.provider === "s3") {
      return access;
    }

    return {
      provider: "local" as const,
      fileName: access.fileName,
      contentType: access.contentType,
    };
  }
}

function safeDownloadFileName(fileName: string) {
  return fileName.replace(/["\\]/g, "").slice(0, 120) || "private-document";
}
