import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchEveryPage, POSTGREST_PAGE_SIZE } from './paginate'

test('fetchEveryPage keeps reading after the first 1000 rows', async () => {
  const total = POSTGREST_PAGE_SIZE + 250
  const rows = await fetchEveryPage(async (from, to) => {
    const page = []
    for (let i = from; i <= to && i < total; i += 1) page.push(i)
    return { data: page, error: null }
  })
  assert.equal(rows.length, total)
  assert.equal(rows[0], 0)
  assert.equal(rows[rows.length - 1], total - 1)
})

test('fetchEveryPage stops on a short page and surfaces errors', async () => {
  const rows = await fetchEveryPage(async () => ({ data: [1, 2], error: null }))
  assert.deepEqual(rows, [1, 2])
  await assert.rejects(
    () => fetchEveryPage(async () => ({ data: null, error: { message: 'db down' } })),
    /db down/,
  )
})
