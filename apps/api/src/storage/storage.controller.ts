import { Body, Controller, Get, Inject, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
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
  @ApiOperation({ summary: "Create a signed private document upload request." })
  createPrivateDocumentUploadRequest(
    @CurrentUser() actor: RequestUser,
    @Body() dto: PrivateDocumentUploadRequestDto,
  ) {
    return this.storageService.createPrivateDocumentUploadRequest(actor, dto);
  }

  @Get("private-document")
  @Roles(RoleCode.ADMIN, RoleCode.SELLER)
  @ApiOperation({ summary: "Redirect to a short-lived private document URL." })
  async privateDocument(
    @CurrentUser() actor: RequestUser,
    @Query("key") key: string | undefined,
    @Res() response: { redirect: (status: number, url: string) => unknown },
  ) {
    const url = await this.storageService.privateDocumentUrl(actor, key);
    return response.redirect(302, url);
  }
}
