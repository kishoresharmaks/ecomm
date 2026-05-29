import { BadRequestException } from "@nestjs/common";

type PaginationQuery = {
  page?: number | string;
  limit?: number | string;
};

type PaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

export function paginationFromQuery(query: PaginationQuery, options: PaginationOptions = {}) {
  const maxLimit = options.maxLimit ?? 100;
  const page = positiveIntegerFromQuery(query.page, "page", 1);
  const take = positiveIntegerFromQuery(query.limit, "limit", options.defaultLimit ?? 20);

  if (take > maxLimit) {
    throw new BadRequestException(`limit must not be greater than ${maxLimit}.`);
  }

  return {
    page,
    take,
    skip: (page - 1) * take
  };
}

function positiveIntegerFromQuery(value: number | string | undefined, field: string, fallback: number) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return parsed;
}
