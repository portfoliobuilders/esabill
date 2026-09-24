import Link from 'next/link'

import { AdminCard, AdminPageHeader, EmptyState, ErrorState } from '@/components/admin/AdminPrimitives'
import { TrendChart } from '@/components/admin/TrendChart'
import { requireAdminCampaign } from '@/lib/admin/context'
import { parseTrendRange } from '@/lib/admin/filters'
import { fetchAnalyticsData } from '@/lib/admin/queries'
import { assertAdminEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function generateMetadata() {
  return { title: 'Analytics — Admin', robots: { index: false, follow: false } }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  assertAdminEnv()
  const { campaign } = await requireAdminCampaign()
  if (!campaign) return <EmptyState title="No campaign selected." body="Create a campaign first." />
  const params = await searchParams
  const range = parseTrendRange(typeof params.range === 'string' ? params.range : '30d')
  const includeTests = params.tests === 'include'

  try {
    const data = await fetchAnalyticsData(campaign.id, includeTests, range)
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Analytics" description="Campaign-only totals. Test submissions are excluded unless included in the URL." />
        <AdminCard title="Funnel">
          <ul className="grid gap-3 sm:grid-cols-4 text-sm">
            <li>Started · {data.funnel.started.toLocaleString('en-IN')}</li>
            <li>Prepared · {data.funnel.prepared.toLocaleString('en-IN')}</li>
            <li>Email opened · {data.funnel.emailOpened.toLocaleString('en-IN')}</li>
            <li>Confirmed sent · {data.funnel.confirmedSent.toLocaleString('en-IN')}</li>
          </ul>
        </AdminCard>
        <AdminCard title="Participation trend">
          <TrendChart points={data.trend} />
        </AdminCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminCard title="Concerns">
            <CountList rows={data.concerns.map((c) => ({ name: c.title_en, cnt: c.cnt }))} />
          </AdminCard>
          <AdminCard title="Districts">
            <CountList rows={data.districts} />
          </AdminCard>
          <AdminCard title="Constituencies">
            {data.constituencies.length === 0 ? (
              <p className="text-sm text-stone-500">No constituency data yet.</p>
            ) : (
              <CountList rows={data.constituencies} />
            )}
          </AdminCard>
          <AdminCard title="Send methods">
            {data.sendMethods.length === 0 ? (
              <p className="text-sm text-stone-500">No send methods recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.sendMethods.map((row) => (
                  <li key={row.method} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="tabular-nums">
                      {row.cnt} · {row.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
          <AdminCard title="Language">
            <ul className="space-y-2 text-sm">
              {data.languages.map((row) => (
                <li key={row.language} className="flex justify-between gap-3">
                  <span>{row.language}</span>
                  <span className="tabular-nums">
                    {row.cnt} · {row.pct}%
                  </span>
                </li>
              ))}
            </ul>
          </AdminCard>
          <AdminCard title="Personal comments">
            <p className="text-3xl font-semibold tabular-nums">{data.personalCommentRate.pct}%</p>
            <p className="mt-1 text-sm text-stone-600">
              {data.personalCommentRate.withComment} of {data.personalCommentRate.total} participants added a comment.
            </p>
          </AdminCard>
        </div>
        <AdminCard title="Common concern combinations">
          {data.combinations.length === 0 ? (
            <p className="text-sm text-stone-500">Not enough multi-concern submissions yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.combinations.map((row) => (
                <li key={row.labels} className="flex justify-between gap-3">
                  <span>{row.labels}</span>
                  <span className="tabular-nums">{row.cnt}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <p className="text-xs text-stone-500">
          Range:{' '}
          <Link href="/admin/analytics?range=7d" className="underline">
            7 days
          </Link>{' '}
          ·{' '}
          <Link href="/admin/analytics?range=30d" className="underline">
            30 days
          </Link>{' '}
          ·{' '}
          <Link href="/admin/analytics?range=all" className="underline">
            All time
          </Link>
        </p>
      </div>
    )
  } catch {
    return <ErrorState title="Unable to load analytics." body="Totals could not be calculated for this campaign." />
  }
}

function CountList({ rows }: { rows: { name: string; cnt: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-stone-500">No data yet.</p>
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.name} className="flex justify-between gap-3">
          <span>{row.name}</span>
          <span className="tabular-nums">{row.cnt}</span>
        </li>
      ))}
    </ul>
  )
}
