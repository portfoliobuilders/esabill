import 'server-only'

import { createServiceClientOrNull } from '@/lib/supabase/server'
import { fetchEveryPage } from '@/lib/supabase/paginate'

const COUNTABLE_STATUSES = ['draft', 'verified', 'handoff_opened', 'confirmed_sent', 'server_sent'] as const

function distinctPrepared(rows: Array<{ email_normalized?: string | null }> | null): number {
  return new Set(
    (rows ?? [])
      .map((row) => String(row.email_normalized ?? '').trim().toLowerCase())
      .filter(Boolean),
  ).size
}

async function preparedCountFromService(slug: string): Promise<number | null> {
  const supabase = createServiceClientOrNull()
  if (!supabase) return null
  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (campaignError || !campaign?.id) return 0
    const rows = await fetchEveryPage((from, to) =>
      supabase
        .from('submissions')
        .select('id, email_normalized')
        .eq('campaign_id', campaign.id)
        .eq('is_test', false)
        .in('status', [...COUNTABLE_STATUSES])
        .order('id', { ascending: true })
        .range(from, to),
    )
    return distinctPrepared(rows)
  } catch {
    return 0
  }
}

export async function publicPreparedCount(slug: string): Promise<number> {
  const fromService = await preparedCountFromService(slug)
  if (fromService !== null) return fromService
  return 0
}
