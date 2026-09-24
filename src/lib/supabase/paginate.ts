/** PostgREST stops a single response at this many rows unless the caller pages. */
export const POSTGREST_PAGE_SIZE = 1000

type PageResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Read every matching row. Each request stays within the API page cap, and the
 * loop continues until a short page, so totals are not stuck at 1,000.
 */
export async function fetchEveryPage<T>(
  load: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += POSTGREST_PAGE_SIZE) {
    const { data, error } = await load(from, from + POSTGREST_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < POSTGREST_PAGE_SIZE) return rows
  }
}
