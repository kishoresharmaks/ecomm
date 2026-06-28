import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { B2BService, type UploadedB2BPurchaseOrderFile } from "./b2b.service";
import { sendB2BDocument, sendB2BPurchaseOrderDocument } from "./b2b-document-response";
import { CreateB2BEnquiryDto } from "./dto/b2b-enquiry.dto";
import {
  B2BOrderQueryDto,
  CreateB2BPurchaseOrderUploadRequestDto,
  SubmitB2BPaymentProofDto,
  SubmitB2BPurchaseOrderDto,
} from "./dto/b2b-order.dto";
import {
  B2BEnquiryDetailQueryDto,
  SendB2BMessageDto,
} from "./dto/b2b-message.dto";
import { B2BEnquiryQueryDto } from "./dto/b2b-query.dto";
import {
  CreateBusinessBuyerAddressDto,
  UpdateBusinessBuyerAddressDto,
} from "./dto/business-buyer-address.dto";
import {
  UpdateBusinessBuyerProfileDto,
  UpsertBusinessBuyerProfileDto,
} from "./dto/business-buyer-profile.dto";

@ApiTags("B2B Buyer")
@Controller("b2b")
export class B2BBuyerController {
  constructor(@Inject(B2BService) private readonly b2bService: B2BService) {}

  @Get("profile")
  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read business buyer company profile." })
  getProfile(@CurrentUser() actor: RequestUser) {
    return this.b2bService.getProfile(actor);
  }

  @Put("profile")
  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Create or replace business buyer company profile." })
  upsertProfile(@CurrentUser() actor: RequestUser, @Body() dto: UpsertBusinessBuyerProfileDto) {
    return this.b2bService.upsertProfile(actor, dto);
  }

  @Patch("profile")
  @Roles(RoleCode.CUSTOMER, RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Update business buyer company profile." })
  updateProfile(@CurrentUser() actor: RequestUser, @Body() dto: UpdateBusinessBuyerProfileDto) {
    return this.b2bService.upsertProfile(actor, dto);
  }

  @Get("addresses")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "List business buyer addresses." })
  listAddresses(@CurrentUser() actor: RequestUser) {
    return this.b2bService.listAddresses(actor);
  }

  @Post("addresses")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Create business buyer address." })
  createAddress(@CurrentUser() actor: RequestUser, @Body() dto: CreateBusinessBuyerAddressDto) {
    return this.b2bService.createAddress(actor, dto);
  }

  @Patch("addresses/:addressId")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Update business buyer address." })
  updateAddress(
    @CurrentUser() actor: RequestUser,
    @Param("addressId") addressId: string,
    @Body() dto: UpdateBusinessBuyerAddressDto,
  ) {
    return this.b2bService.updateAddress(actor, addressId, dto);
  }

  @Delete("addresses/:addressId")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Delete business buyer address." })
  deleteAddress(@CurrentUser() actor: RequestUser, @Param("addressId") addressId: string) {
    return this.b2bService.deleteAddress(actor, addressId);
  }

  @Get("enquiries")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "List enquiries submitted by the authenticated business buyer." })
  listEnquiries(@CurrentUser() actor: RequestUser, @Query() query: B2BEnquiryQueryDto) {
    return this.b2bService.listMyEnquiries(actor, query);
  }

  @Post("enquiries")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Submit a B2B product or seller enquiry." })
  createEnquiry(@CurrentUser() actor: RequestUser, @Body() dto: CreateB2BEnquiryDto) {
    return this.b2bService.createEnquiry(actor, dto);
  }

  @Get("orders")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "List B2B proforma and purchase-order workflow records for the buyer." })
  listOrders(@CurrentUser() actor: RequestUser, @Query() query: B2BOrderQueryDto) {
    return this.b2bService.listMyB2BOrders(actor, query);
  }

  @Get("orders/:orderNumber")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read buyer-visible B2B order and proforma detail." })
  getOrder(@CurrentUser() actor: RequestUser, @Param("orderNumber") orderNumber: string) {
    return this.b2bService.getMyB2BOrder(actor, orderNumber);
  }

  @Get("orders/:orderNumber/proforma-invoice/document-access")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read buyer-authorized proforma invoice access metadata." })
  getProformaInvoiceDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getMyProformaInvoiceDocumentAccess(actor, orderNumber);
  }

  @Get("orders/:orderNumber/proforma-invoice")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Open or stream the current buyer proforma invoice." })
  async openProformaInvoiceDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getMyProformaInvoiceDocumentAccess(actor, orderNumber);
    return sendB2BDocument(access, response, "proforma-invoice.pdf");
  }

  @Get("orders/:orderNumber/tax-invoice/document-access")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read buyer-authorized final tax invoice access metadata." })
  getTaxInvoiceDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getMyTaxInvoiceDocumentAccess(actor, orderNumber);
  }

  @Get("orders/:orderNumber/tax-invoice")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Open or stream the buyer final tax invoice." })
  async openTaxInvoiceDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getMyTaxInvoiceDocumentAccess(actor, orderNumber);
    return sendB2BDocument(access, response, "tax-invoice.pdf");
  }

  @Post("orders/:orderNumber/purchase-order/upload-request")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Create a B2B purchase-order upload request for S3 or local fallback." })
  createPurchaseOrderUploadRequest(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateB2BPurchaseOrderUploadRequestDto,
  ) {
    return this.b2bService.createMyPurchaseOrderUploadRequest(actor, orderNumber, dto);
  }

  @Post("orders/:orderNumber/purchase-order/upload")
  @Roles(RoleCode.BUSINESS_BUYER)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description:
      "Multipart local-private-storage upload for a buyer purchase order. The file field must be named `file`. Server validation allows PDF, JPG, PNG, and WebP only, verifies file magic bytes, and rejects files larger than 10 MB. The returned assetKey must be submitted through the purchase-order details endpoint before the 24-hour orphan cleanup window.",
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description:
            "Binary purchase-order file. Allowed: application/pdf, image/jpeg, image/png, image/webp. Maximum size: 10 MB.",
        },
      },
    },
  })
  @ApiOperation({ summary: "Upload a B2B purchase-order file through local private storage." })
  uploadPurchaseOrderFile(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @UploadedFile() file: UploadedB2BPurchaseOrderFile | undefined,
  ) {
    return this.b2bService.uploadMyPurchaseOrderFile(actor, orderNumber, file);
  }

  @Get("orders/:orderNumber/purchase-order/document-access")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read buyer-authorized purchase-order document access metadata." })
  getPurchaseOrderDocumentAccess(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
  ) {
    return this.b2bService.getMyPurchaseOrderDocumentAccess(actor, orderNumber);
  }

  @Get("orders/:orderNumber/purchase-order/document")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Open or stream the buyer-authorized purchase-order document." })
  async openPurchaseOrderDocument(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Res({ passthrough: true })
    response: {
      redirect: (status: number, url: string) => unknown;
      set: (headers: Record<string, string>) => unknown;
    },
  ) {
    const access = await this.b2bService.getMyPurchaseOrderDocumentAccess(actor, orderNumber);
    return sendB2BPurchaseOrderDocument(access, response);
  }

  @Patch("orders/:orderNumber/purchase-order")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Submit or update purchase order details for a B2B proforma." })
  submitPurchaseOrder(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: SubmitB2BPurchaseOrderDto,
  ) {
    return this.b2bService.submitPurchaseOrder(actor, orderNumber, dto);
  }

  @Post("orders/:orderNumber/payment-proof/upload-request")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Create a B2B payment-proof upload request for S3 or local fallback." })
  createPaymentProofUploadRequest(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: CreateB2BPurchaseOrderUploadRequestDto,
  ) {
    return this.b2bService.createMyPaymentProofUploadRequest(actor, orderNumber, dto);
  }

  @Post("orders/:orderNumber/payment-proof/upload")
  @Roles(RoleCode.BUSINESS_BUYER)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    description:
      "Multipart local-private-storage upload for a buyer bank transfer receipt. The file field must be named `file`. Server validation allows PDF, JPG, PNG, and WebP only, verifies file magic bytes, and rejects files larger than 10 MB.",
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiOperation({ summary: "Upload a B2B payment-proof file through local private storage." })
  uploadPaymentProofFile(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @UploadedFile() file: UploadedB2BPurchaseOrderFile | undefined,
  ) {
    return this.b2bService.uploadMyPaymentProofFile(actor, orderNumber, file);
  }

  @Post("orders/:orderNumber/payment-proof")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Submit bank-transfer payment proof for a B2B order." })
  submitPaymentProof(
    @CurrentUser() actor: RequestUser,
    @Param("orderNumber") orderNumber: string,
    @Body() dto: SubmitB2BPaymentProofDto,
  ) {
    return this.b2bService.submitMyB2BPaymentProof(actor, orderNumber, dto);
  }

  @Get("enquiries/:enquiryId")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Read a submitted B2B enquiry." })
  getEnquiry(
    @CurrentUser() actor: RequestUser,
    @Param("enquiryId") enquiryId: string,
    @Query() query: B2BEnquiryDetailQueryDto,
  ) {
    return this.b2bService.getMyEnquiryDetail(actor, enquiryId, query);
  }

  @Post("enquiries/:enquiryId/messages")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Send a buyer message in an active B2B negotiation." })
  sendMessage(
    @CurrentUser() actor: RequestUser,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: SendB2BMessageDto,
  ) {
    return this.b2bService.sendMessageAsBuyer(actor, enquiryId, dto);
  }

  @Patch("enquiries/:enquiryId/cancel")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Cancel an open B2B enquiry." })
  cancelEnquiry(@CurrentUser() actor: RequestUser, @Param("enquiryId") enquiryId: string) {
    return this.b2bService.cancelMyEnquiry(actor, enquiryId);
  }

  @Patch("enquiries/:enquiryId/confirm")
  @Roles(RoleCode.BUSINESS_BUYER)
  @ApiOperation({ summary: "Confirm a responded B2B quotation for admin approval." })
  confirmEnquiry(
    @CurrentUser() actor: RequestUser,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: { responseId?: string } = {},
  ) {
    return this.b2bService.confirmMyEnquiry(actor, enquiryId, dto.responseId);
  }
}
