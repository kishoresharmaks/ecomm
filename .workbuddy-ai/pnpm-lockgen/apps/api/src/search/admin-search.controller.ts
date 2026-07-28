import { Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { SearchQueryDto } from "./dto/search-query.dto";
import { SearchIndexService } from "./search-index.service";
import { SearchService } from "./search.service";

@ApiTags("Admin Search")
@Roles(RoleCode.ADMIN)
@Controller("admin/search")
export class AdminSearchController {
  constructor(
    @Inject(SearchIndexService) private readonly searchIndex: SearchIndexService,
    @Inject(SearchService) private readonly searchService: SearchService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Read search indexing job health and backlog counts." })
  overview() {
    return this.searchIndex.jobOverview();
  }

  @Post("reindex")
  @ApiOperation({ summary: "Queue a full PostgreSQL search reindex for products, stores, and categories." })
  reindex(@CurrentUser() actor: RequestUser) {
    return this.searchIndex.requestFullReindex(actor);
  }

  @Post("jobs/process")
  @ApiOperation({ summary: "Manually process pending DB-backed search index jobs." })
  processJobs() {
    return this.searchIndex.processPendingJobs(50);
  }

  @Get("explain")
  @ApiOperation({ summary: "Run EXPLAIN for a search query to verify index-backed plans." })
  explain(@Query() query: SearchQueryDto) {
    return this.searchService.explain(query);
  }
}
