import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { SearchQueryDto, SearchSuggestionsQueryDto } from "./dto/search-query.dto";
import { SearchService } from "./search.service";

@ApiTags("Search")
@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Search public products, stores, and categories with PostgreSQL ranking." })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Public()
  @Get("suggestions")
  @ApiOperation({ summary: "Return debounced search suggestions for products, stores, and categories." })
  suggestions(@Query() query: SearchSuggestionsQueryDto) {
    return this.searchService.suggestions(query);
  }
}
