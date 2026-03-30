export interface PaginationInput {
  limit?: number;
  cursor?: string;
}

export function normalizeLimit(limit?: number, fallback = 50, max = 100): number {
  if (!limit || Number.isNaN(limit)) return fallback;
  return Math.max(1, Math.min(limit, max));
}

export function cursorMeta<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    meta: {
      limit,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    },
  };
}
