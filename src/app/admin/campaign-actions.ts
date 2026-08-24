'use server'

import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { writeAdminAudit } from '@/lib/admin/audit'
import { requireAdminSession } from '@/lib/admin/auth'
import { ADMIN_CAMPAIGN_COOKIE } from '@/lib/admin/context'
import { flagsForCampaignStatus, isCampaignStatus, requiresPublishConfirmation, slugFromTitle, type CampaignStatus } from '@/lib/campaign-status'
import { revalidateAfterCmsSave, revalidateAdmin } from '@/lib/admin/revalidate'
import {
  ALLOWED_SOURCE_MIME,
  CAMPAIGN_SOURCES_BUCKET,
  MAX_SOURCE_FILE_BYTES,
  isAllowedSourceMime,
  mimeFromFileName,
  parseOptionalHttpUrl,
  parsePublicationDate,
  sanitizeSourceFileName,
} from '@/lib/campaign-sources'
import { DEFAULT_BODY_TEMPLATE_EN, DEFAULT_BODY_TEMPLATE_ML } from '@/lib/email-template'
import { DEFAULT_FEATURE_SETTINGS, parseFeatureSettings } from '@/lib/campaign-features'
import { improveCampaignConcern } from '@/lib/ai/improve'
import { DEFAULT_FORM_FIELDS } from '@/lib/form-fields'
import { invalidEmails, parseEmailList, rowsFromLists } from '@/lib/recipients'
import { createServiceClient } from '@/lib/supabase/server'

export type ActionOk = { ok: true; id?: string }
export type ActionErr = { ok: false; error: string }
export type ActionResult = ActionOk | ActionErr

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function selectAdminCampaign(campaignId: string, nextPath = '/admin'): Promise<void> {
  await requireAdminSession()
  const store = await cookies()
  store.set(ADMIN_CAMPAIGN_COOKIE, campaignId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidateAdmin()
  redirect(nextPath)
}

export type CampaignBoardRow = {
  id: string
  slug: string
  title_en: string
  title_ml: string
  status: CampaignStatus
  opens_at: string
  deadline_at: string | null
  concern_count: number
  submission_count: number
  created_at: string
  updated_at: string | null
}

export async function fetchCampaignBoard(): Promise<CampaignBoardRow[]> {
  await requireAdminSession()
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, slug, title_en, title_ml, status, is_active, publish_status, opens_at, deadline_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  const ids = rows.map((row) => row.id as string)
  const counts = new Map<string, { concerns: number; submissions: number }>()
  for (const id of ids) counts.set(id, { concerns: 0, submissions: 0 })

  if (ids.length > 0) {
    const [{ data: concerns }, { data: submissions }] = await Promise.all([
      supabase.from('objection_clauses').select('campaign_id').in('campaign_id', ids),
      supabase.from('submissions').select('campaign_id').in('campaign_id', ids).eq('is_test', false),
    ])
    for (const row of concerns ?? []) {
      const entry = counts.get(row.campaign_id as string)
      if (entry) entry.concerns += 1
    }
    for (const row of submissions ?? []) {
      const entry = counts.get(row.campaign_id as string)
      if (entry) entry.submissions += 1
    }
  }

  return rows.map((row) => {
    const status = (row.status as CampaignStatus | null) ?? (row.is_active ? 'active' : 'draft')
    const tally = counts.get(row.id as string) ?? { concerns: 0, submissions: 0 }
    return {
      id: row.id as string,
      slug: row.slug as string,
      title_en: row.title_en as string,
      title_ml: row.title_ml as string,
      status,
      opens_at: row.opens_at as string,
      deadline_at: (row.deadline_at as string | null) ?? null,
      concern_count: tally.concerns,
      submission_count: tally.submissions,
      created_at: row.created_at as string,
      updated_at: (row.updated_at as string | null) ?? null,
    }
  })
}

export async function setCampaignStatus(
  campaignId: string,
  nextStatus: string,
  confirmed = false,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  if (!isCampaignStatus(nextStatus)) return { ok: false, error: 'Unknown status.' }

  const supabase = createServiceClient()
  const { data: before } = await supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle()
  if (!before) return { ok: false, error: 'Campaign not found.' }

  const current = (before.status as CampaignStatus | undefined) ?? (before.is_active ? 'active' : 'draft')
  if (nextStatus === 'active') {
    const { count } = await supabase
      .from('objection_clauses')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
    if ((count ?? 0) < 1) return { ok: false, error: 'Add at least one active concern before publishing.' }

    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('email')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
    const fallbackTo = Array.isArray(before.recipient_emails) ? (before.recipient_emails as string[]) : []
    const fallbackCc = Array.isArray(before.cc_emails) ? (before.cc_emails as string[]) : []
    if ((recipients?.length ?? 0) < 1 && fallbackTo.length + fallbackCc.length < 1) {
      return { ok: false, error: 'Add at least one email recipient before publishing.' }
    }
    if (requiresPublishConfirmation(current, nextStatus) && !confirmed) {
      return { ok: false, error: 'publish_confirmation_required' }
    }
    const inactive = flagsForCampaignStatus('inactive')
    await supabase
      .from('campaigns')
      .update({
        ...inactive,
        updated_by: session.email,
      })
      .eq('status', 'active')
      .neq('id', campaignId)
  }

  const flags = flagsForCampaignStatus(nextStatus)
  let previewToken = (before.preview_token as string | null) ?? null
  if ((nextStatus === 'draft' || nextStatus === 'inactive') && !previewToken) {
    previewToken = randomBytes(24).toString('hex')
  }

  const { error } = await supabase
    .from('campaigns')
    .update({
      ...flags,
      preview_token: previewToken,
      updated_by: session.email,
    })
    .eq('id', campaignId)
  if (error) return { ok: false, error: 'Could not change status.' }

  await writeAdminAudit({
    adminEmail: session.email,
    action: 'campaign_status_changed',
    entityType: 'campaign',
    entityId: campaignId,
    before: { status: current },
    after: flags,
  })
  revalidateAfterCmsSave()
  return { ok: true, id: campaignId }
}

export async function archiveCampaign(campaignId: string): Promise<ActionResult> {
  return setCampaignStatus(campaignId, 'archived', true)
}

export async function deleteCampaign(campaignId: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
  if ((count ?? 0) > 0) {
    return archiveCampaign(campaignId)
  }
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId)
  if (error) return { ok: false, error: 'Could not delete campaign.' }
  await writeAdminAudit({
    adminEmail: session.email,
    action: 'campaign_deleted',
    entityType: 'campaign',
    entityId: campaignId,
  })
  revalidateAfterCmsSave()
  return { ok: true }
}

export type StudioSaveInput = {
  id: string
  slug: string
  title_en: string
  title_ml: string
  summary_en: string
  summary_ml: string
  homepage_intro_en: string
  homepage_intro_ml: string
  source_url: string
  reference_url: string
  opens_at: string
  deadline_at: string
  allow_multiple_concerns: boolean
  concern_selection_mode?: 'single' | 'multiple'
  max_concern_selections?: number | null
  allow_custom_concern?: boolean
  custom_concern_label_en?: string
  custom_concern_label_ml?: string
  custom_concern_placeholder_en?: string
  custom_concern_placeholder_ml?: string
  feature_settings?: Record<string, unknown>
  subject_en: string
  subject_ml: string
  intro_en: string
  intro_ml: string
  closing_en: string
  closing_ml: string
  body_template_en: string
  body_template_ml: string
  reply_to_email: string
  og_title_en: string
  og_title_ml: string
  og_description_en: string
  og_description_ml: string
  to_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  form_fields: Array<{
    field_key: string
    label_en: string
    label_ml: string
    is_enabled: boolean
    is_required: boolean
    display_order: number
  }>
}

export async function saveCampaignStudio(input: StudioSaveInput): Promise<ActionResult> {
  const session = await requireAdminSession()
  if (!input.title_en.trim() || !input.title_ml.trim()) return { ok: false, error: 'English and Malayalam titles are required.' }
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!slug) return { ok: false, error: 'A URL slug is required.' }

  const to = parseEmailList(input.to_emails)
  const cc = parseEmailList(input.cc_emails)
  const bcc = parseEmailList(input.bcc_emails)
  const bad = invalidEmails([...to, ...cc, ...bcc])
  if (bad.length > 0) return { ok: false, error: `Invalid email: ${bad[0]}` }
  if (input.reply_to_email.trim() && !EMAIL_RE.test(input.reply_to_email.trim())) {
    return { ok: false, error: 'Reply-to email is invalid.' }
  }

  const opens = new Date(input.opens_at)
  const deadline = input.deadline_at ? new Date(input.deadline_at) : null
  if (Number.isNaN(opens.getTime())) return { ok: false, error: 'Start date is invalid.' }
  if (deadline && Number.isNaN(deadline.getTime())) return { ok: false, error: 'End date is invalid.' }
  if (deadline && deadline.getTime() < opens.getTime()) return { ok: false, error: 'End date must be later than the start date.' }

  const supabase = createServiceClient()
  const { data: clash } = await supabase.from('campaigns').select('id').eq('slug', slug).neq('id', input.id).maybeSingle()
  if (clash) return { ok: false, error: 'That slug is already used by another campaign.' }

  const { data: before } = await supabase.from('campaigns').select('*').eq('id', input.id).maybeSingle()
  if (!before) return { ok: false, error: 'Campaign not found.' }

  const patch = {
    slug,
    title_en: input.title_en.trim(),
    title_ml: input.title_ml.trim(),
    summary_en: input.summary_en.trim() || input.title_en.trim(),
    summary_ml: input.summary_ml.trim() || input.title_ml.trim(),
    homepage_intro_en: input.homepage_intro_en.trim(),
    homepage_intro_ml: input.homepage_intro_ml.trim(),
    source_url: input.source_url.trim() || 'https://example.invalid',
    reference_url: input.reference_url.trim() || null,
    opens_at: opens.toISOString(),
    deadline_at: deadline ? deadline.toISOString() : null,
    allow_multiple_concerns: input.concern_selection_mode
      ? input.concern_selection_mode === 'multiple'
      : Boolean(input.allow_multiple_concerns),
    concern_selection_mode: input.concern_selection_mode === 'multiple' ? 'multiple' : 'single',
    max_concern_selections:
      input.concern_selection_mode === 'multiple' && typeof input.max_concern_selections === 'number'
        ? input.max_concern_selections
        : null,
    allow_custom_concern: input.allow_custom_concern !== false,
    custom_concern_label_en: input.custom_concern_label_en?.trim() || null,
    custom_concern_label_ml: input.custom_concern_label_ml?.trim() || null,
    custom_concern_placeholder_en: input.custom_concern_placeholder_en?.trim() || null,
    custom_concern_placeholder_ml: input.custom_concern_placeholder_ml?.trim() || null,
    feature_settings: parseFeatureSettings(input.feature_settings),
    subject_en: input.subject_en.trim() || input.title_en.trim(),
    subject_ml: input.subject_ml.trim() || input.title_ml.trim(),
    intro_en: input.intro_en.trim(),
    intro_ml: input.intro_ml.trim(),
    closing_en: input.closing_en.trim(),
    closing_ml: input.closing_ml.trim(),
    body_template_en: input.body_template_en.trim() || DEFAULT_BODY_TEMPLATE_EN,
    body_template_ml: input.body_template_ml.trim() || DEFAULT_BODY_TEMPLATE_ML,
    reply_to_email: input.reply_to_email.trim() || null,
    og_title_en: input.og_title_en.trim(),
    og_title_ml: input.og_title_ml.trim(),
    og_description_en: input.og_description_en.trim(),
    og_description_ml: input.og_description_ml.trim(),
    recipient_emails: to,
    recipient_email: to[0] ?? (before.recipient_email as string),
    cc_emails: cc,
    bcc_emails: bcc,
    updated_by: session.email,
  }

  const { error } = await supabase.from('campaigns').update(patch).eq('id', input.id)
  if (error) return { ok: false, error: 'Could not save campaign.' }

  await supabase.from('campaign_recipients').delete().eq('campaign_id', input.id)
  const recipientRows = rowsFromLists(input.id, to, cc, bcc)
  if (recipientRows.length > 0) {
    const { error: recError } = await supabase.from('campaign_recipients').insert(recipientRows)
    if (recError) return { ok: false, error: 'Campaign saved, but recipients could not be updated.' }
  }

  await supabase.from('campaign_form_fields').delete().eq('campaign_id', input.id)
  const fieldRows = input.form_fields.map((field, index) => ({
    campaign_id: input.id,
    field_key: field.field_key,
    label_en: field.label_en.trim() || field.field_key,
    label_ml: field.label_ml.trim() || field.field_key,
    is_enabled: field.is_enabled,
    is_required: field.field_key === 'name' ? true : Boolean(field.is_enabled && field.is_required),
    display_order: field.display_order || index + 1,
  }))
  if (fieldRows.length > 0) {
    const { error: fieldError } = await supabase.from('campaign_form_fields').insert(fieldRows)
    if (fieldError) return { ok: false, error: 'Campaign saved, but form fields could not be updated.' }
  }

  await writeAdminAudit({
    adminEmail: session.email,
    action: 'campaign_updated',
    entityType: 'campaign',
    entityId: input.id,
    after: { slug, title_en: patch.title_en },
  })
  revalidateAfterCmsSave()
  return { ok: true, id: input.id }
}

export async function createEmptyCampaign(): Promise<ActionResult> {
  const session = await requireAdminSession()
  const supabase = createServiceClient()
  let slug = `campaign-${Date.now().toString(36)}`
  const { data: clash } = await supabase.from('campaigns').select('id').eq('slug', slug).maybeSingle()
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      slug,
      title_en: 'Untitled campaign',
      title_ml: 'പേരിടാത്ത ക്യാമ്പെയ്ൻ',
      summary_en: '',
      summary_ml: '',
      homepage_intro_en: '',
      homepage_intro_ml: '',
      source_url: 'https://example.invalid',
      opens_at: new Date().toISOString(),
      deadline_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
      recipient_email: 'unset@example.invalid',
      recipient_emails: [],
      cc_emails: [],
      bcc_emails: [],
      subject_en: '',
      subject_ml: '',
      intro_en: '',
      intro_ml: '',
      closing_en: 'Necessary steps are requested to be taken in this regard.',
      closing_ml: 'ഇതിനാവശ്യമായ നടപടികൾ സ്വീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.',
      body_template_en: DEFAULT_BODY_TEMPLATE_EN,
      body_template_ml: DEFAULT_BODY_TEMPLATE_ML,
      status: 'draft',
      is_active: false,
      publish_status: 'draft',
      allow_multiple_concerns: false,
      concern_selection_mode: 'single',
      allow_custom_concern: true,
      feature_settings: DEFAULT_FEATURE_SETTINGS,
      preview_token: randomBytes(24).toString('hex'),
      created_by: session.email,
      updated_by: session.email,
    })
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false, error: 'Could not create campaign.' }

  await supabase.from('campaign_form_fields').insert(
    DEFAULT_FORM_FIELDS.map((field) => ({
      campaign_id: data.id,
      ...field,
    })),
  )

  await writeAdminAudit({
    adminEmail: session.email,
    action: 'campaign_created',
    entityType: 'campaign',
    entityId: data.id as string,
  })
  const store = await cookies()
  store.set(ADMIN_CAMPAIGN_COOKIE, data.id as string, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  revalidateAfterCmsSave()
  return { ok: true, id: data.id as string }
}

export async function duplicateCampaignFull(campaignId: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const supabase = createServiceClient()
  const { data: source } = await supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle()
  if (!source) return { ok: false, error: 'Campaign not found.' }

  let slug = `${source.slug as string}-copy`
  const { data: clash } = await supabase.from('campaigns').select('id').eq('slug', slug).maybeSingle()
  if (clash) slug = `${slug}-${Date.now().toString(36)}`

  const { data: created, error } = await supabase
    .from('campaigns')
    .insert({
      slug,
      title_ml: `${source.title_ml as string} (copy)`,
      title_en: `${source.title_en as string} (copy)`,
      summary_ml: source.summary_ml,
      summary_en: source.summary_en,
      homepage_intro_ml: source.homepage_intro_ml ?? source.summary_ml,
      homepage_intro_en: source.homepage_intro_en ?? source.summary_en,
      source_url: source.source_url,
      reference_url: source.reference_url ?? null,
      opens_at: new Date().toISOString(),
      deadline_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      recipient_email: source.recipient_email,
      recipient_emails: source.recipient_emails ?? [],
      cc_emails: source.cc_emails ?? [],
      bcc_emails: source.bcc_emails ?? [],
      subject_ml: source.subject_ml,
      subject_en: source.subject_en,
      intro_ml: source.intro_ml,
      intro_en: source.intro_en,
      closing_ml: source.closing_ml,
      closing_en: source.closing_en,
      body_template_ml: source.body_template_ml ?? DEFAULT_BODY_TEMPLATE_ML,
      body_template_en: source.body_template_en ?? DEFAULT_BODY_TEMPLATE_EN,
      explainer_ml: source.explainer_ml ?? [],
      explainer_en: source.explainer_en ?? [],
      allow_multiple_concerns: source.allow_multiple_concerns ?? false,
      concern_selection_mode: source.concern_selection_mode === 'multiple' ? 'multiple' : 'single',
      max_concern_selections: source.max_concern_selections ?? null,
      allow_custom_concern: source.allow_custom_concern !== false,
      custom_concern_label_en: source.custom_concern_label_en ?? null,
      custom_concern_label_ml: source.custom_concern_label_ml ?? null,
      custom_concern_placeholder_en: source.custom_concern_placeholder_en ?? null,
      custom_concern_placeholder_ml: source.custom_concern_placeholder_ml ?? null,
      reply_to_email: source.reply_to_email ?? null,
      og_title_en: source.og_title_en ?? '',
      og_title_ml: source.og_title_ml ?? '',
      og_description_en: source.og_description_en ?? '',
      og_description_ml: source.og_description_ml ?? '',
      feature_settings: parseFeatureSettings(source.feature_settings),
      status: 'draft',
      is_active: false,
      publish_status: 'draft',
      preview_token: randomBytes(24).toString('hex'),
      created_by: session.email,
      updated_by: session.email,
    })
    .select('id')
    .maybeSingle()
  if (error || !created) return { ok: false, error: 'Could not duplicate campaign.' }

  const [{ data: clauses }, { data: recipients }, { data: fields }, { data: sources }] = await Promise.all([
    supabase.from('objection_clauses').select('*').eq('campaign_id', campaignId),
    supabase.from('campaign_recipients').select('*').eq('campaign_id', campaignId),
    supabase.from('campaign_form_fields').select('*').eq('campaign_id', campaignId),
    supabase.from('campaign_sources').select('*').eq('campaign_id', campaignId),
  ])

  if (clauses && clauses.length > 0) {
    await supabase.from('objection_clauses').insert(
      clauses.map((clause) => ({
        campaign_id: created.id,
        code: clause.code,
        section_ref: clause.section_ref,
        title_ml: clause.title_ml,
        title_en: clause.title_en,
        explain_ml: clause.explain_ml,
        explain_en: clause.explain_en,
        email_ml: clause.email_ml,
        email_en: clause.email_en,
        full_text_ml: clause.full_text_ml ?? '',
        full_text_en: clause.full_text_en ?? '',
        email_subject_ml: clause.email_subject_ml ?? '',
        email_subject_en: clause.email_subject_en ?? '',
        email_body_ml: clause.email_body_ml ?? '',
        email_body_en: clause.email_body_en ?? '',
        ai_body_en: clause.ai_body_en ?? '',
        ai_body_ml: clause.ai_body_ml ?? '',
        ai_body_en_status: clause.ai_body_en_status ?? 'none',
        ai_body_ml_status: clause.ai_body_ml_status ?? 'none',
        full_url: clause.full_url,
        sort_order: clause.sort_order,
        is_active: clause.is_active,
      })),
    )
  }
  if (recipients && recipients.length > 0) {
    await supabase.from('campaign_recipients').insert(
      recipients.map((row) => ({
        campaign_id: created.id,
        recipient_type: row.recipient_type,
        email: row.email,
        display_order: row.display_order,
        is_active: row.is_active,
      })),
    )
  }
  if (fields && fields.length > 0) {
    await supabase.from('campaign_form_fields').insert(
      fields.map((row) => ({
        campaign_id: created.id,
        field_key: row.field_key,
        label_en: row.label_en,
        label_ml: row.label_ml,
        is_enabled: row.is_enabled,
        is_required: row.is_required,
        display_order: row.display_order,
      })),
    )
  } else {
    await supabase.from('campaign_form_fields').insert(DEFAULT_FORM_FIELDS.map((field) => ({ campaign_id: created.id, ...field })))
  }
  if (sources && sources.length > 0) {
    await supabase.from('campaign_sources').insert(
      sources.map((row) => ({
        campaign_id: created.id,
        publication_name: row.publication_name,
        publication_date: row.publication_date,
        title_ml: row.title_ml,
        title_en: row.title_en,
        description_ml: row.description_ml,
        description_en: row.description_en,
        source_url: row.source_url,
        file_url: row.file_url,
        file_path: row.file_path,
        file_mime: row.file_mime,
        file_name: row.file_name,
        is_public: row.is_public,
        sort_order: row.sort_order,
        created_by: session.email,
      })),
    )
  }

  await writeAdminAudit({
    adminEmail: session.email,
    action: 'campaign_duplicated',
    entityType: 'campaign',
    entityId: created.id as string,
    before: { source_id: campaignId },
  })
  revalidateAfterCmsSave()
  return { ok: true, id: created.id as string }
}

export async function saveConcernStudio(input: {
  id?: string
  campaign_id: string
  title_en: string
  title_ml: string
  content_en: string
  content_ml: string
  email_subject_en: string
  email_subject_ml: string
  email_body_en: string
  email_body_ml: string
  ai_body_en?: string
  ai_body_ml?: string
  ai_body_en_status?: 'none' | 'draft' | 'approved'
  ai_body_ml_status?: 'none' | 'draft' | 'approved'
  is_active: boolean
  display_order: number
}): Promise<ActionResult> {
  const session = await requireAdminSession()
  if (!input.title_en.trim() || !input.title_ml.trim()) return { ok: false, error: 'Concern titles are required in both languages.' }
  const supabase = createServiceClient()
  const code = slugFromTitle(input.title_en).replace(/-/g, '_').slice(0, 40).toUpperCase() || `C${Date.now().toString(36).toUpperCase()}`
  const row = {
    campaign_id: input.campaign_id,
    title_en: input.title_en.trim(),
    title_ml: input.title_ml.trim(),
    explain_en: input.content_en.trim().slice(0, 280),
    explain_ml: input.content_ml.trim().slice(0, 280),
    full_text_en: input.content_en.trim(),
    full_text_ml: input.content_ml.trim(),
    email_en: input.email_body_en.trim() || input.content_en.trim(),
    email_ml: input.email_body_ml.trim() || input.content_ml.trim(),
    email_subject_en: input.email_subject_en.trim(),
    email_subject_ml: input.email_subject_ml.trim(),
    email_body_en: input.email_body_en.trim() || input.content_en.trim(),
    email_body_ml: input.email_body_ml.trim() || input.content_ml.trim(),
    ai_body_en: input.ai_body_en?.trim() || '',
    ai_body_ml: input.ai_body_ml?.trim() || '',
    ai_body_en_status: input.ai_body_en_status || 'none',
    ai_body_ml_status: input.ai_body_ml_status || 'none',
    sort_order: input.display_order,
    is_active: input.is_active,
  }

  if (input.id) {
    const { error } = await supabase.from('objection_clauses').update(row).eq('id', input.id)
    if (error) return { ok: false, error: 'Could not save concern.' }
    await writeAdminAudit({
      adminEmail: session.email,
      action: 'concern_edited',
      entityType: 'concern',
      entityId: input.id,
    })
    revalidateAfterCmsSave()
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('objection_clauses')
    .insert({ ...row, code })
    .select('id')
    .maybeSingle()
  if (error || !data) {
    const retry = await supabase
      .from('objection_clauses')
      .insert({ ...row, code: `${code}_${Date.now().toString(36).toUpperCase()}` })
      .select('id')
      .maybeSingle()
    if (retry.error || !retry.data) return { ok: false, error: 'Could not create concern.' }
    revalidateAfterCmsSave()
    return { ok: true, id: retry.data.id as string }
  }
  await writeAdminAudit({
    adminEmail: session.email,
    action: 'concern_created',
    entityType: 'concern',
    entityId: data.id as string,
  })
  revalidateAfterCmsSave()
  return { ok: true, id: data.id as string }
}

export async function deleteConcernStudio(
  id: string,
): Promise<ActionResult & { deactivated?: boolean }> {
  try {
    const session = await requireAdminSession()
    const supabase = createServiceClient()
    const usage = await supabase
      .from('submission_clauses')
      .select('submission_id', { count: 'exact', head: true })
      .eq('clause_id', id)
    if (usage.error) return { ok: false, error: 'Could not check whether this concern is already in use.' }
    if ((usage.count ?? 0) > 0) {
      const { error } = await supabase.from('objection_clauses').update({ is_active: false }).eq('id', id)
      if (error) return { ok: false, error: 'Could not turn this concern off.' }
      await writeAdminAudit({
        adminEmail: session.email,
        action: 'concern_disabled',
        entityType: 'concern',
        entityId: id,
      })
      revalidateAfterCmsSave()
      return { ok: true, id, deactivated: true }
    }
    const { error, count } = await supabase.from('objection_clauses').delete({ count: 'exact' }).eq('id', id)
    if (error) {
      const inUse = error.code === '23503' || /foreign key|violates/i.test(error.message)
      return {
        ok: false,
        error: inUse
          ? 'This concern is used in submitted letters, so it cannot be permanently deleted. Turn it off instead.'
          : 'Could not delete concern.',
      }
    }
    if ((count ?? 0) === 0) return { ok: false, error: 'Concern was not found. Reload and try again.' }
    await writeAdminAudit({
      adminEmail: session.email,
      action: 'concern_deleted',
      entityType: 'concern',
      entityId: id,
    })
    revalidateAfterCmsSave()
    return { ok: true, id }
  } catch {
    return { ok: false, error: 'Could not delete concern. Sign in again, then retry.' }
  }
}

export async function generateAiConcernDraft(
  campaignId: string,
  concernId: string,
  language: 'ml' | 'en',
): Promise<ActionResult & { body?: string }> {
  await requireAdminSession()
  const result = await improveCampaignConcern({
    campaignId,
    concernId,
    language,
    forceLive: true,
  })
  if (!result.ok) return { ok: false, error: 'AI draft is unavailable. The original concern is unchanged.' }
  const supabase = createServiceClient()
  const patch =
    language === 'en'
      ? { ai_body_en: result.body, ai_body_en_status: 'draft' }
      : { ai_body_ml: result.body, ai_body_ml_status: 'draft' }
  await supabase.from('objection_clauses').update(patch).eq('id', concernId)
  revalidateAfterCmsSave()
  return { ok: true, id: concernId, body: result.body }
}

export async function previewPathFor(campaignId: string): Promise<ActionResult & { url?: string }> {
  await requireAdminSession()
  const supabase = createServiceClient()
  const { data } = await supabase.from('campaigns').select('slug, preview_token').eq('id', campaignId).maybeSingle()
  if (!data) return { ok: false, error: 'Campaign not found.' }
  let token = (data.preview_token as string | null) ?? ''
  if (!token) {
    token = randomBytes(24).toString('hex')
    await supabase.from('campaigns').update({ preview_token: token }).eq('id', campaignId)
  }
  return { ok: true, id: campaignId, url: `/campaign/${data.slug as string}?preview=${token}` }
}

export async function saveBranding(input: {
  site_title_en: string
  site_title_ml: string
  tagline_en: string
  tagline_ml: string
  logo_url: string
  favicon_url: string
}): Promise<ActionResult> {
  const session = await requireAdminSession()
  const supabase = createServiceClient()
  const { error } = await supabase.from('site_settings').upsert({
    id: 1,
    site_title_en: input.site_title_en.trim() || 'Janashabdam',
    site_title_ml: input.site_title_ml.trim() || 'ജനശബ്ദം',
    tagline_en: input.tagline_en,
    tagline_ml: input.tagline_ml,
    logo_url: input.logo_url.trim() || null,
    favicon_url: input.favicon_url.trim() || null,
    updated_by: session.email,
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: 'Could not save branding.' }
  await writeAdminAudit({
    adminEmail: session.email,
    action: 'branding_updated',
    entityType: 'site_settings',
    entityId: '1',
  })
  revalidateAfterCmsSave()
  return { ok: true }
}

export async function uploadBrandingFile(formData: FormData): Promise<ActionResult & { url?: string }> {
  await requireAdminSession()
  const file = formData.get('file')
  const kind = String(formData.get('kind') || 'logo')
  if (!(file instanceof File)) return { ok: false, error: 'Choose an image file.' }
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Image must be 2 MB or smaller.' }
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
  if (!allowed.includes(file.type)) return { ok: false, error: 'Use PNG, JPG, WebP, SVG, or ICO.' }
  if (file.type === 'image/svg+xml') {
    const text = await file.text()
    if (/<script|javascript:|on\w+=/i.test(text)) return { ok: false, error: 'That SVG is not allowed.' }
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${kind}-${Date.now()}.${ext}`
  const supabase = createServiceClient()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error } = await supabase.storage.from('branding').upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  })
  if (error) return { ok: false, error: 'Could not upload the image. Check that the branding storage bucket exists.' }
  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

async function removeSourceFile(
  supabase: ReturnType<typeof createServiceClient>,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return
  await supabase.storage.from(CAMPAIGN_SOURCES_BUCKET).remove([path])
}

async function storeSourceFile(
  supabase: ReturnType<typeof createServiceClient>,
  campaignId: string,
  sourceId: string,
  file: File,
): Promise<{ ok: true; path: string; url: string; mime: string; name: string } | ActionErr> {
  if (file.size > MAX_SOURCE_FILE_BYTES) return { ok: false, error: 'File must be 10 MB or smaller.' }
  const fromName = mimeFromFileName(file.name)
  const mime = isAllowedSourceMime(file.type) ? file.type : fromName
  if (!mime || !ALLOWED_SOURCE_MIME.includes(mime)) {
    return { ok: false, error: 'Use a PNG, JPG, WebP, or PDF clipping.' }
  }
  const safeName = sanitizeSourceFileName(file.name)
  const path = `${campaignId}/${sourceId}/${Date.now()}-${safeName}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error } = await supabase.storage.from(CAMPAIGN_SOURCES_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  })
  if (error) {
    return { ok: false, error: 'Could not upload the file. Check that the campaign-sources storage bucket exists.' }
  }
  const { data } = supabase.storage.from(CAMPAIGN_SOURCES_BUCKET).getPublicUrl(path)
  return { ok: true, path, url: data.publicUrl, mime, name: safeName }
}

export async function saveCampaignSource(formData: FormData): Promise<ActionResult> {
  const session = await requireAdminSession()
  const campaignId = String(formData.get('campaign_id') || '').trim()
  const id = String(formData.get('id') || '').trim()
  if (!campaignId) return { ok: false, error: 'Campaign is required.' }

  const publicationName = String(formData.get('publication_name') || '').trim()
  if (!publicationName) return { ok: false, error: 'Publication name is required.' }

  const titleEn = String(formData.get('title_en') || '').trim()
  const titleMl = String(formData.get('title_ml') || '').trim()
  if (!titleEn && !titleMl) return { ok: false, error: 'Add a title in English or Malayalam.' }

  const parsedDate = parsePublicationDate(String(formData.get('publication_date') || ''))
  if (!parsedDate.ok) return parsedDate
  const parsedUrl = parseOptionalHttpUrl(String(formData.get('source_url') || ''))
  if (!parsedUrl.ok) return parsedUrl

  const isPublic = String(formData.get('is_public') || '') !== 'false'
  const removeFile = String(formData.get('remove_file') || '') === 'true'
  const sortOrderRaw = Number(formData.get('sort_order') || '0')
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0
  const file = formData.get('file')
  const upload = file instanceof File && file.size > 0 ? file : null

  const row = {
    campaign_id: campaignId,
    publication_name: publicationName,
    publication_date: parsedDate.date,
    title_en: titleEn,
    title_ml: titleMl,
    description_en: String(formData.get('description_en') || '').trim(),
    description_ml: String(formData.get('description_ml') || '').trim(),
    source_url: parsedUrl.url,
    is_public: isPublic,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
    created_by: session.email,
  }

  const supabase = createServiceClient()
  let sourceId = id
  let previousPath: string | null = null

  if (sourceId) {
    const { data: existing } = await supabase
      .from('campaign_sources')
      .select('id, file_path')
      .eq('id', sourceId)
      .eq('campaign_id', campaignId)
      .maybeSingle()
    if (!existing) return { ok: false, error: 'Source not found.' }
    previousPath = (existing.file_path as string | null) ?? null
    const { error } = await supabase.from('campaign_sources').update(row).eq('id', sourceId)
    if (error) return { ok: false, error: 'Could not save this source. Apply the campaign_sources migration if the table is missing.' }
  } else {
    const { data, error } = await supabase.from('campaign_sources').insert(row).select('id').maybeSingle()
    if (error || !data) {
      return { ok: false, error: 'Could not save this source. Apply the campaign_sources migration if the table is missing.' }
    }
    sourceId = data.id as string
  }

  if (upload) {
    const stored = await storeSourceFile(supabase, campaignId, sourceId, upload)
    if (!stored.ok) return stored
    const { error } = await supabase
      .from('campaign_sources')
      .update({
        file_url: stored.url,
        file_path: stored.path,
        file_mime: stored.mime,
        file_name: stored.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
    if (error) return { ok: false, error: 'Saved the details but could not record the uploaded file.' }
    if (previousPath && previousPath !== stored.path) await removeSourceFile(supabase, previousPath)
  } else if (removeFile && previousPath) {
    await removeSourceFile(supabase, previousPath)
    const { error } = await supabase
      .from('campaign_sources')
      .update({
        file_url: null,
        file_path: null,
        file_mime: null,
        file_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
    if (error) return { ok: false, error: 'Could not remove the stored clipping.' }
  }

  await writeAdminAudit({
    adminEmail: session.email,
    action: id ? 'campaign_source_updated' : 'campaign_source_created',
    entityType: 'campaign_source',
    entityId: sourceId,
    after: { campaign_id: campaignId, publication_name: publicationName, is_public: isPublic },
  })
  revalidateAfterCmsSave()
  return { ok: true, id: sourceId }
}

export async function deleteCampaignSource(id: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  if (!id.trim()) return { ok: false, error: 'Source is required.' }
  const supabase = createServiceClient()
  const { data: existing } = await supabase.from('campaign_sources').select('id, file_path, campaign_id').eq('id', id).maybeSingle()
  if (!existing) return { ok: false, error: 'Source not found.' }
  const { error } = await supabase.from('campaign_sources').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete this source.' }
  await removeSourceFile(supabase, existing.file_path as string | null)
  await writeAdminAudit({
    adminEmail: session.email,
    action: 'campaign_source_deleted',
    entityType: 'campaign_source',
    entityId: id,
    before: { campaign_id: existing.campaign_id },
  })
  revalidateAfterCmsSave()
  return { ok: true, id }
}

export async function reorderCampaignSources(campaignId: string, ids: string[]): Promise<ActionResult> {
  await requireAdminSession()
  if (!campaignId || ids.length === 0) return { ok: false, error: 'Nothing to reorder.' }
  const supabase = createServiceClient()
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await supabase
      .from('campaign_sources')
      .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
      .eq('id', ids[index])
      .eq('campaign_id', campaignId)
    if (error) return { ok: false, error: 'Could not reorder sources.' }
  }
  revalidateAfterCmsSave()
  return { ok: true }
}

