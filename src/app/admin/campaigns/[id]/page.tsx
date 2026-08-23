import { notFound } from 'next/navigation'

import { CampaignStudio } from '@/components/admin/CampaignStudio'
import { requireAdminSession } from '@/lib/admin/auth'
import { aiServerConfigured } from '@/lib/ai/provider'
import { normalizeFormFields } from '@/lib/form-fields'
import { publicCampaign } from '@/lib/campaign'
import { postalDirectoryCount } from '@/lib/pin-lookup'
import { createServiceClient } from '@/lib/supabase/server'
import { assertAdminEnv } from '@/lib/env'
import type { Campaign, CampaignFormField, CampaignRecipient, CampaignSource, ObjectionClause } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: 'Edit campaign — Admin', robots: { index: false, follow: false } }
}

const TAB_KEYS = ['basic', 'english', 'malayalam', 'concerns', 'recipients', 'fields', 'features', 'schedule', 'sources', 'preview'] as const

function tabIndexFromQuery(value: string | undefined): number {
  if (!value) return 0
  const index = TAB_KEYS.indexOf(value as (typeof TAB_KEYS)[number])
  return index >= 0 ? index : 0
}

export default async function EditCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  assertAdminEnv()
  await requireAdminSession()
  const { id } = await params
  const query = await searchParams
  const supabase = createServiceClient()
  const [{ data: campaign }, { data: concerns }, { data: recipients }, { data: fields }, sourcesResult] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', id).maybeSingle(),
    supabase.from('objection_clauses').select('*').eq('campaign_id', id).order('sort_order', { ascending: true }),
    supabase.from('campaign_recipients').select('*').eq('campaign_id', id).order('display_order', { ascending: true }),
    supabase.from('campaign_form_fields').select('*').eq('campaign_id', id).order('display_order', { ascending: true }),
    supabase.from('campaign_sources').select('*').eq('campaign_id', id).order('sort_order', { ascending: true }),
  ])
  if (!campaign) notFound()
  const sourcesLoadError = sourcesResult.error
    ? 'Could not load sources. Apply the campaign_sources database migration, then reload.'
    : null
  const [postalCount, aiConfigured] = await Promise.all([postalDirectoryCount(), Promise.resolve(aiServerConfigured())])
  return (
    <CampaignStudio
      campaign={publicCampaign(campaign as Campaign)}
      concerns={(concerns ?? []) as ObjectionClause[]}
      recipients={(recipients ?? []) as CampaignRecipient[]}
      formFields={normalizeFormFields((fields ?? []) as CampaignFormField[])}
      sources={(sourcesResult.data ?? []) as CampaignSource[]}
      sourcesLoadError={sourcesLoadError}
      initialTab={tabIndexFromQuery(query.tab)}
      postalCount={postalCount}
      aiConfigured={aiConfigured}
    />
  )
}
