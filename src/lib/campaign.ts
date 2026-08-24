import 'server-only'

import { timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

import { statusFromLegacy } from '@/lib/campaign-status'
import { normalizeConcernSelectionMode } from '@/lib/concern-selection'
import { daysRemaining } from '@/lib/deadline'
import { defaultBodyTemplate } from '@/lib/email-template'
import { PREVIEW_COOKIE } from '@/lib/preview-cookie'
import { createAnonServerClient } from '@/lib/supabase/anon-server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Campaign, CampaignStatus, PublishStatus } from '@/types/database'

export type CampaignViewState = 'live' | 'preview' | 'inactive' | 'expired' | 'dormant'

export type CampaignState =
  | { state: 'live'; campaign: Campaign }
  | { state: 'preview'; campaign: Campaign }
  | { state: 'inactive'; campaign: Campaign }
  | { state: 'expired'; campaign: Campaign }
  | { state: 'dormant' }

type CampaignRow = Campaign & { preview_token: string | null }

function tokensMatch(stored: string | null | undefined, provided: string | null | undefined): boolean {
  if (!stored || !provided) return false
  const a = Buffer.from(stored)
  const b = Buffer.from(provided)
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

export function publicCampaign(row: Campaign & { preview_token?: string | null }): Campaign {
  const campaign = { ...row }
  delete (campaign as { preview_token?: string | null }).preview_token
  delete (campaign as { updated_by?: string | null }).updated_by
  if (!Array.isArray(campaign.recipient_emails) || campaign.recipient_emails.length === 0) {
    campaign.recipient_emails = campaign.recipient_email ? [campaign.recipient_email] : []
  }
  if (!Array.isArray(campaign.cc_emails)) campaign.cc_emails = []
  if (!Array.isArray(campaign.bcc_emails)) campaign.bcc_emails = []
  campaign.homepage_intro_ml = campaign.homepage_intro_ml || campaign.summary_ml
  campaign.homepage_intro_en = campaign.homepage_intro_en || campaign.summary_en
  campaign.body_template_ml = campaign.body_template_ml || defaultBodyTemplate('ml')
  campaign.body_template_en = campaign.body_template_en || defaultBodyTemplate('en')
  campaign.reference_url = campaign.reference_url ?? null
  campaign.reply_to_email = campaign.reply_to_email ?? null
  campaign.social_image_url = campaign.social_image_url ?? null
  campaign.explainer_ml = Array.isArray(campaign.explainer_ml) ? campaign.explainer_ml : []
  campaign.explainer_en = Array.isArray(campaign.explainer_en) ? campaign.explainer_en : []
  campaign.concern_selection_mode = normalizeConcernSelectionMode(
    campaign.concern_selection_mode ?? (campaign.allow_multiple_concerns ? 'multiple' : 'single'),
  )
  campaign.allow_multiple_concerns = campaign.concern_selection_mode === 'multiple'
  campaign.allow_custom_concern = campaign.allow_custom_concern !== false
  campaign.max_concern_selections = campaign.max_concern_selections ?? null
  campaign.custom_concern_label_en = campaign.custom_concern_label_en ?? null
  campaign.custom_concern_label_ml = campaign.custom_concern_label_ml ?? null
  campaign.custom_concern_placeholder_en = campaign.custom_concern_placeholder_en ?? null
  campaign.custom_concern_placeholder_ml = campaign.custom_concern_placeholder_ml ?? null
  campaign.og_title_en = campaign.og_title_en || campaign.title_en
  campaign.og_title_ml = campaign.og_title_ml || campaign.title_ml
  campaign.og_description_en = campaign.og_description_en || campaign.summary_en
  campaign.og_description_ml = campaign.og_description_ml || campaign.summary_ml
  campaign.status = statusFromLegacy(campaign)
  const status = campaign.publish_status as PublishStatus | undefined
  campaign.publish_status = status ?? (campaign.is_active ? 'live' : 'draft')
  campaign.deadline_at = campaign.deadline_at ?? null
  campaign.feature_settings =
    campaign.feature_settings && typeof campaign.feature_settings === 'object' ? campaign.feature_settings : {}
  return campaign
}

export function getDefaultCampaignSlug(): string {
  return process.env.CAMPAIGN_SLUG?.trim() || ''
}

export async function readPreviewToken(searchParam?: string | null): Promise<string | null> {
  const fromQuery = searchParam?.trim() || null
  if (fromQuery) return fromQuery
  const store = await cookies()
  return store.get(PREVIEW_COOKIE)?.value?.trim() || null
}

function viewFromRow(row: CampaignRow, previewToken: string | null | undefined, now = new Date()): CampaignState {
  const campaign = publicCampaign(row)
  if (tokensMatch(row.preview_token, previewToken) && campaign.status !== 'active') {
    return { state: 'preview', campaign }
  }
  if (campaign.status === 'active') {
    if (campaign.deadline_at && new Date(campaign.deadline_at).getTime() < now.getTime()) {
      return { state: 'expired', campaign }
    }
    if (campaign.opens_at && new Date(campaign.opens_at).getTime() > now.getTime()) {
      return { state: 'inactive', campaign }
    }
    return { state: 'live', campaign }
  }
  if (tokensMatch(row.preview_token, previewToken)) {
    return { state: 'preview', campaign }
  }
  if (campaign.status === 'expired') return { state: 'expired', campaign }
  if (campaign.status === 'inactive') return { state: 'inactive', campaign }
  return { state: 'dormant' }
}

async function findActiveCampaign(): Promise<CampaignRow | null> {
  const supabase = createServiceClient()
  const now = Date.now()

  const byStatus = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .order('opens_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(8)

  if (byStatus.error) {
    // Missing status column means the repair migration has not been applied.
    // Do not fall back to legacy is_active rows — those include the archived Forest Bill.
    return null
  }

  const rows = (byStatus.data ?? []) as CampaignRow[]
  const match = rows.find((row) => {
    const deadlineOk = !row.deadline_at || new Date(row.deadline_at).getTime() >= now
    const opensOk = !row.opens_at || new Date(row.opens_at).getTime() <= now
    return deadlineOk && opensOk
  })
  return match ?? rows[0] ?? null
}

async function getCampaignStateFromService(
  slug: string | null | undefined,
  previewToken: string | null | undefined,
): Promise<CampaignState> {
  const supabase = createServiceClient()
  let row: CampaignRow | null = null

  if (slug) {
    const bySlug = await supabase.from('campaigns').select('*').eq('slug', slug).maybeSingle()
    if (bySlug.error) throw bySlug.error
    row = (bySlug.data as CampaignRow | null) ?? null
  }

  if (!row) {
    row = await findActiveCampaign()
  }

  if (row) {
    const viewed = viewFromRow(row, previewToken)
    if (viewed.state !== 'dormant') return viewed
  }

  if (previewToken) {
    const { data: candidates, error } = await supabase.from('campaigns').select('*').not('preview_token', 'is', null)
    if (error) throw error
    for (const candidate of (candidates ?? []) as CampaignRow[]) {
      if (tokensMatch(candidate.preview_token, previewToken)) {
        return { state: 'preview', campaign: publicCampaign(candidate) }
      }
    }
  }

  return { state: 'dormant' }
}

function parseRpcState(data: unknown): CampaignState | null {
  if (!data || typeof data !== 'object') return null
  const row = data as { state?: unknown; campaign?: unknown }
  if (row.state === 'dormant') return { state: 'dormant' }
  const allowed: CampaignViewState[] = ['live', 'preview', 'inactive', 'expired']
  if (typeof row.state === 'string' && allowed.includes(row.state as CampaignViewState) && row.campaign && typeof row.campaign === 'object') {
    const campaign = publicCampaign(row.campaign as Campaign)
    if (!campaign.id || !campaign.slug) return null
    return { state: row.state as Exclude<CampaignViewState, 'dormant'>, campaign }
  }
  return null
}

async function getCampaignStateFromRpc(
  slug: string | null | undefined,
  previewToken: string | null | undefined,
): Promise<CampaignState> {
  const supabase = createAnonServerClient()
  if (!supabase) return { state: 'dormant' }
  const { data, error } = await supabase.rpc('campaign_public_state', {
    p_slug: slug ?? '',
    p_preview: previewToken ?? '',
  })
  if (error) return { state: 'dormant' }
  return parseRpcState(data) ?? { state: 'dormant' }
}

export async function getCampaignState(
  slug: string | null | undefined,
  previewToken: string | null | undefined,
): Promise<CampaignState> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const fromService = await getCampaignStateFromService(slug, previewToken)
      if (fromService.state !== 'dormant') return fromService
    } catch {
      // Fall through to the anon RPC so a missing/broken service query cannot hide a live campaign.
    }
  }
  return getCampaignStateFromRpc(slug, previewToken)
}

export async function resolveCampaignState(
  searchPreview?: string | null,
  slug?: string | null,
): Promise<CampaignState> {
  const token = await readPreviewToken(searchPreview)
  return getCampaignState(slug ?? null, token)
}

export async function resolvePublicCampaign(searchPreview?: string | null): Promise<CampaignState> {
  return resolveCampaignState(searchPreview, null)
}

export function campaignPath(campaign: Pick<Campaign, 'slug'>): string {
  return `/campaign/${campaign.slug}`
}

export function publicStatusOf(state: CampaignState): CampaignStatus | 'dormant' {
  if (state.state === 'dormant') return 'dormant'
  if (state.state === 'live') return 'active'
  if (state.state === 'preview') return 'draft'
  return state.state
}
