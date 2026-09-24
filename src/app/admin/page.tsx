import { Suspense } from 'react'

import { DashboardClient } from '@/components/admin/DashboardClient'
import { EmptyState, ErrorState } from '@/components/admin/AdminPrimitives'
import { requireAdminCampaign } from '@/lib/admin/context'
import { parseTrendRange } from '@/lib/admin/filters'
import { fetchDashboardData } from '@/lib/admin/queries'
import { assertAdminEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function generateMetadata() {
  return { title: 'Admin — ജനശബ്ദം', robots: { index: false, follow: false } }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  assertAdminEnv()
  const { campaign } = await requireAdminCampaign()
  if (!campaign) {
    return <EmptyState title="No campaign selected." body="Create a campaign to see participation." />
  }

  const params = await searchParams
  const range = parseTrendRange(typeof params.range === 'string' ? params.range : undefined)
  const includeTests = params.tests === 'include'

  try {
    const data = await fetchDashboardData(campaign.id, includeTests, range)
    return (
      <Suspense fallback={<p className="text-sm text-stone-600">Loading dashboard…</p>}>
        <DashboardClient data={data} />
      </Suspense>
    )
  } catch {
    return <ErrorState title="Unable to load analytics." body="The dashboard could not read submission totals." />
  }
}
