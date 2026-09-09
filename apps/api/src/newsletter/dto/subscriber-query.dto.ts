import { IsOptional, IsString, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { paginationFromQuery, type PaginationQuery } from "../../common/pagination";

export class SubscriberQueryDto implements PaginationQuery {
  page?: number | string;

  limit?: number | string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;
}

export function newsletterPaginationFromQuery(query: SubscriberQueryDto) {
  return paginationFromQuery(query, { defaultLimit: 20, maxLimit: 100 });
}
