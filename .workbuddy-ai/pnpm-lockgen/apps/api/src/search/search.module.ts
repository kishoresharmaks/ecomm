import { Module } from "@nestjs/common";
import { DealsModule } from "../deals/deals.module";
import { AdminSearchController } from "./admin-search.controller";
import { SearchController } from "./search.controller";
import { SearchIndexService } from "./search-index.service";
import { SearchService } from "./search.service";

@Module({
  imports: [DealsModule],
  controllers: [SearchController, AdminSearchController],
  providers: [SearchService, SearchIndexService],
  exports: [SearchIndexService],
})
export class SearchModule {}
