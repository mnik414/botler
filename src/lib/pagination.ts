// Bounded offset pagination for list endpoints. Callers that don't pass
// limit/offset keep the previous fixed caps; passing values can never exceed
// the per-endpoint maximum.
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { limit: number; max: number }
): { limit: number; offset: number } {
  const rawLimit = Number(searchParams.get("limit"));
  const rawOffset = Number(searchParams.get("offset"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), defaults.max) : defaults.limit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}
