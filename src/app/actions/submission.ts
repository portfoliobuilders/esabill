'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { composeEmail, liveMailTargets, resolveMailTargets } from '@/lib/compose'
import { identityRequired, parseFeatureSettings } from '@/lib/campaign-features'
import { getCampaignState, publicCampaign, readPreviewToken } from '@/lib/campaign'
import { withCampaignClauses } from '@/lib/campaigns'
import {
  campaignConcernConfig,
  flattenCustomConcerns,
  selectedClausesForLetter,
  validatePredefinedSelection,
} from '@/lib/concern-selection'
import { getClientIp, hashIp } from '@/lib/security'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeIndianPhone } from '@/lib/phone'
import type { Campaign, ObjectionClause, SendMethod } from '@/types/database'

import { CONSENT_VERSION } from '@/lib/consent'
import type { ActionResult } from '@/lib/submission-types'

const uuidSchema = z.uuid()
const langSchema = z.enum(['ml', 'en'])
const sendMethodSchema = z.enum(['gmail_web', 'mailto', 'copy', 'server', 'print'])
const letterModeSchema = z.enum(['selected', 'all'])
const optionalEmail = z.union([z.literal(''), z.email()])

const letterInputSchema = z.object({
  campaignSlug: z.string().min(1),
  fullName: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  panchayat: z.string().trim().optional().default(''),
  ward: z.string().trim().optional().default(''),
  village: z.string().trim().optional().default(''),
  district: z.string().trim().optional().default(''),
  pincode: z.string().trim().optional().default(''),
  language: langSchema,
  customText: z.string().max(1000).optional().default(''),
  extraConcerns: z.array(z.string().max(1000)).max(12).default([]),
  clauseCodes: z.array(z.string().min(1)).max(50).default([]),
  letterMode: letterModeSchema.optional().default('selected'),
  constituencyId: z.uuid().nullable().optional().default(null),
  ccRepIds: z.array(z.uuid()).optional().default([]),
  privacyMode: z.boolean().optional().default(false),
  postOffice: z.string().trim().max(80).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  postalRegion: z.string().trim().max(80).optional().default(''),
  taluk: z.string().trim().max(80).optional().default(''),
})

type LetterFields = z.infer<typeof letterInputSchema>

type CanonicalCompose = {
  campaign: Campaign
  persistSlug: string
  composed: { subject: string; body: string }
  clauseCodes: string[]
  isTest: boolean
}

async function composeCanonicalLetter(input: LetterFields): Promise<ActionResult<CanonicalCompose>> {
  const extraConcerns = flattenCustomConcerns(input.extraConcerns)
  if (input.clauseCodes.length < 1) {
    return { ok: false, error: 'invalid_clauses' }
  }

  const phone = input.phone.trim() ? normalizeIndianPhone(input.phone) || input.phone.trim() : ''

  const campaignState = await getCampaignState(input.campaignSlug, await readPreviewToken())
  if (campaignState.state === 'dormant') {
    return { ok: false, error: 'campaign_not_active' }
  }
  if (campaignState.state !== 'live' && campaignState.state !== 'preview') {
    return { ok: false, error: 'campaign_not_active' }
  }

  const campaign = publicCampaign(campaignState.campaign)
  const persistSlug = campaign.slug
  const isTest = campaignState.state === 'preview'

  let sourceClauses: ObjectionClause[] = []
  try {
    const supabase = createServiceClient()
    let query = supabase
      .from('objection_clauses')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('is_active', true)
    if (input.letterMode === 'selected') {
      query = query.in('code', input.clauseCodes)
    }
    const { data } = await query
    sourceClauses = withCampaignClauses(campaign, (data ?? []) as ObjectionClause[])
  } catch {
    sourceClauses = []
  }

  const selectedIds = sourceClauses
    .filter((clause) => input.clauseCodes.includes(clause.code))
    .map((clause) => clause.id)
  const config = campaignConcernConfig(campaign)
  if (
    validatePredefinedSelection({
      mode: config.mode,
      selectedIds,
      maxSelections: config.maxSelections,
    }) !== 'ok'
  ) {
    return { ok: false, error: 'invalid_clauses' }
  }
  if (config.mode === 'single' && selectedIds.length !== 1) {
    return { ok: false, error: 'invalid_clauses' }
  }
  const clauses = selectedClausesForLetter(sourceClauses, selectedIds)
  if (clauses.length === 0) {
    return { ok: false, error: 'invalid_clauses' }
  }

  const features = parseFeatureSettings(campaign.feature_settings)
  const privacyMode = Boolean(input.privacyMode && features.allow_privacy_mode)
  if (identityRequired(features, privacyMode) && !input.fullName.trim() && !privacyMode) {
    return { ok: false, error: 'invalid_input' }
  }

  const composed = composeEmail({
    campaign,
    clauses,
    details: {
      fullName: input.fullName,
      addressLine: input.address,
      panchayat: input.panchayat,
      ward: input.ward,
      village: input.village,
      district: input.district,
      pincode: input.pincode,
      phone: phone ?? '',
      email: input.email,
      customText: input.customText,
      extraConcerns: config.allowCustomConcern ? extraConcerns : [],
      postOffice: input.postOffice,
      state: input.state,
      postalRegion: input.postalRegion,
      taluk: input.taluk,
      privacyMode,
    },
    lang: input.language,
  })

  return {
    ok: true,
    data: {
      campaign,
      persistSlug,
      composed: { subject: composed.subject, body: composed.body },
      clauseCodes: clauses.map((clause) => clause.code),
      isTest,
    },
  }
}

async function storeCanonicalLetter(
  input: LetterFields,
  canonical: CanonicalCompose,
  ipHash: string,
  userAgent: string,
): Promise<string | null> {
  if (!canonical.persistSlug) return null
  const phone = input.phone.trim() ? normalizeIndianPhone(input.phone) : null

  try {
    const supabase = createServiceClient()
    const preferred = canonical.persistSlug
    const bySlug = await supabase.from('campaigns').select('slug').eq('slug', preferred).maybeSingle()
    const fallback = bySlug.data?.slug
      ? null
      : await supabase.from('campaigns').select('slug').order('created_at', { ascending: false }).limit(1).maybeSingle()
    const slug = (bySlug.data?.slug as string | undefined) ?? (fallback?.data?.slug as string | undefined)
    if (!slug) return null

    const targets = resolveMailTargets({
      campaign: canonical.campaign,
      mode: canonical.isTest ? 'preview' : 'live',
      testerEmail: input.email,
    })
    const generatedTo = [...targets.to]
    const generatedCc = [...targets.cc]
    const generatedBcc = [...targets.bcc]
    if (!canonical.isTest && generatedTo.length === 0) {
      const live = liveMailTargets(canonical.campaign)
      generatedTo.push(...live.to)
      generatedCc.push(...live.cc)
      generatedBcc.push(...live.bcc)
    }

    const rpcArgs = {
      p_campaign_slug: slug,
      p_full_name: input.fullName.trim() || 'Citizen',
      p_email: input.email.trim() || `none+${crypto.randomUUID()}@invalid.local`,
      p_phone: phone,
      p_address: input.address,
      p_panchayat: input.panchayat || null,
      p_district: input.district,
      p_pincode: input.pincode || null,
      p_language: input.language,
      p_custom_text: input.customText || null,
      p_clause_codes: canonical.clauseCodes,
      p_subject: canonical.composed.subject,
      p_body: canonical.composed.body,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
      p_consent_version: CONSENT_VERSION,
      p_constituency_id: input.constituencyId,
      p_cc_rep_ids: input.ccRepIds,
      p_is_test: canonical.isTest,
    }

    let { data: submissionId, error } = await supabase.rpc('create_submission', {
      ...rpcArgs,
      p_generated_to: generatedTo,
      p_generated_cc: generatedCc,
    })
    if (error) {
      const retry = await supabase.rpc('create_submission', rpcArgs)
      submissionId = retry.data
      error = retry.error
      if (!error && submissionId) {
        await supabase
          .from('submissions')
          .update({ generated_to: generatedTo, generated_cc: generatedCc })
          .eq('id', submissionId as string)
      }
    }
    if (error || !submissionId) return null
    await supabase
      .from('submissions')
      .update({
        village: input.village || null,
        ward: input.ward || null,
        generated_bcc: generatedBcc,
      })
      .eq('id', submissionId as string)
    return submissionId as string
  } catch {
    return null
  }
}

export async function prepareDemoLetter(
  input: z.input<typeof letterInputSchema>,
): Promise<ActionResult<{ id: string | null; subject: string; body: string }>> {
  const parsed = letterInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' }
  }

  const canonical = await composeCanonicalLetter(parsed.data)
  if (!canonical.ok) return canonical

  const headerStore = await headers()
  const ipHash = hashIp(getClientIp(headerStore))
  let submissionId: string | null = null
  try {
    const supabase = createServiceClient()
    const { data: allowed, error: rateError } = await supabase.rpc('bump_rate_limit', {
      p_bucket: 'draft',
      p_identifier: ipHash,
      p_limit: 3,
    })
    if (rateError || allowed !== false) {
      submissionId = await storeCanonicalLetter(
        parsed.data,
        canonical.data,
        ipHash,
        headerStore.get('user-agent') ?? '',
      )
    }
  } catch {
    // Letter still works if the database is unreachable.
  }

  return {
    ok: true,
    data: {
      id: submissionId,
      subject: canonical.data.composed.subject,
      body: canonical.data.composed.body,
    },
  }
}

export async function markHandoff(submissionId: string, method: SendMethod): Promise<ActionResult<{ ok: true }>> {
  const idParsed = uuidSchema.safeParse(submissionId)
  const methodParsed = sendMethodSchema.safeParse(method)
  if (!idParsed.success || !methodParsed.success) {
    return { ok: false, error: 'invalid_input' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status: 'handoff_opened',
      handoff_at: new Date().toISOString(),
      send_method: methodParsed.data,
    })
    .eq('id', submissionId)
    .in('status', ['draft', 'verified', 'handoff_opened'])
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: 'handoff_failed' }
  }

  return { ok: true, data: { ok: true } }
}

export async function confirmSent(submissionId: string): Promise<ActionResult<{ ok: true }>> {
  const idParsed = uuidSchema.safeParse(submissionId)
  if (!idParsed.success) {
    return { ok: false, error: 'invalid_input' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status: 'confirmed_sent',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .eq('status', 'handoff_opened')
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: 'confirm_failed' }
  }

  return { ok: true, data: { ok: true } }
}
