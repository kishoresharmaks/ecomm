import { BadRequestException } from "@nestjs/common";

type PaginationQuery = {
  page?: number | string;
  limit?: number | string;
  cursor?: string;
};

type PaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

type CreatedAtCursor = {
  createdAt: string;
  id: string;
};

type CursorRecord = {
  createdAt: Date;
  id: string;
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

export function cursorPaginationFromQuery(query: PaginationQuery, options: PaginationOptions = {}) {
  const maxLimit = options.maxLimit ?? 100;
  const take = positiveIntegerFromQuery(query.limit, "limit", options.defaultLimit ?? 20);

  if (take > maxLimit) {
    throw new BadRequestException(`limit must not be greater than ${maxLimit}.`);
  }

  return {
    take,
    cursor: decodeCreatedAtCursor(query.cursor)
  };
}

export function createdAtCursorWhere(cursor: CursorRecord | null) {
  return timestampCursorWhere("createdAt", cursor);
}

export function timestampCursorWhere(field: string, cursor: CursorRecord | null) {
  if (!cursor) {
    return undefined;
  }

  return {
    OR: [
      { [field]: { lt: cursor.createdAt } },
      {
        [field]: cursor.createdAt,
        id: { lt: cursor.id }
      }
    ]
  };
}

export function createdAtCursorOrderBy() {
  return timestampCursorOrderBy("createdAt");
}

export function timestampCursorOrderBy(field: string) {
  return [{ [field]: "desc" as const }, { id: "desc" as const }];
}

export function cursorPageFromItems<T extends CursorRecord>(items: T[], take: number) {
  return cursorPageFromTimestampItems(items, take, "createdAt");
}

export function cursorPageFromTimestampItems<T extends { id: string }, K extends keyof T & string>(
  items: T[],
  take: number,
  field: K
) {
  const pageItems = items.slice(0, take);
  const lastItem = pageItems[pageItems.length - 1] ?? null;
  const timestamp = lastItem?.[field];

  return {
    items: pageItems,
    pageInfo: {
      hasNextPage: items.length > take,
      nextCursor:
        items.length > take && lastItem && timestamp instanceof Date
          ? encodeCursorPayload({
              createdAt: timestamp.toISOString(),
              id: lastItem.id
            })
          : null
    }
  };
}

export function encodeCursorPayload(payload: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursorPayload<T extends Record<string, unknown>>(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("Cursor payload must be an object.");
    }
    return decoded;
  } catch {
    throw new BadRequestException("cursor is invalid.");
  }
}

function decodeCreatedAtCursor(cursor: string | undefined): CursorRecord | null {
  const payload = decodeCursorPayload<CreatedAtCursor>(cursor);
  if (!payload) {
    return null;
  }

  const createdAt = new Date(payload.createdAt);
  if (Number.isNaN(createdAt.getTime()) || typeof payload.id !== "string" || !payload.id) {
    throw new BadRequestException("cursor is invalid.");
  }

  return {
    createdAt,
    id: payload.id
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
