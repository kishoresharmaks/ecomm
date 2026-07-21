import { Module } from "@nestjs/common";
import { TaxDocumentsService } from "./tax-documents.service";

@Module({
  providers: [TaxDocumentsService],
  exports: [TaxDocumentsService],
})
export class TaxModule {}
