'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  deleteConcernStudio,
  generateAiConcernDraft,
  previewPathFor,
  saveCampaignStudio,
  saveConcernStudio,
  setCampaignStatus,
} from '@/app/admin/campaign-actions'
import { reorderConcerns, setConcernActive } from '@/app/admin/cms-actions'
import { AdminPageHeader, ConfirmDialog, ErrorState, SaveStatus, SuccessBanner } from '@/components/admin/AdminPrimitives'
import { CampaignFeaturesPanel } from '@/components/admin/CampaignFeaturesPanel'
import { CampaignSourcesEditor } from '@/components/admin/CampaignSourcesEditor'
import { adminBtnDanger, adminBtnPrimary, adminBtnSecondary, adminInput, adminLabel } from '@/components/admin/admin-ui'
import { CampaignFeaturesPanel } from '@/components/admin/CampaignFeaturesPanel'
import { ConcernSelectionSettings, draftFromCampaign, type ConcernSelectionDraft } from '@/components/admin/ConcernSelectionSettings'
import { formatDatetimeLocal } from '@/lib/admin/format'
import { CAMPAIGN_STATUS_LABEL, type CampaignStatus } from '@/lib/campaign-status'
import { parseFeatureSettings, type CampaignFeatureSettings } from '@/lib/campaign-features'
import { applyFieldMode, DEFAULT_FORM_FIELDS, type FieldMode } from '@/lib/form-fields'
import { recipientsOfType } from '@/lib/recipients'
import type { Campaign, CampaignFormField, CampaignRecipient, CampaignSource, ConcernSelectionMode, ObjectionClause } from '@/types/database'

const TABS = [
  'Basic Details',
  'English Content',
  'Malayalam Content',
  'Concerns',
  'Email Recipients',
  'Form Settings',
  'Campaign Features',
  'Schedule & Status',
  'Sources / References',
  'Preview',
] as const

type ConcernDraft = {
  id?: string
  code?: string
  title_en: string
  title_ml: string
  content_en: string
  content_ml: string
  email_subject_en: string
  email_subject_ml: string
  email_body_en: string
  email_body_ml: string
  ai_body_en: string
  ai_body_ml: string
  ai_body_en_status: 'none' | 'draft' | 'approved'
  ai_body_ml_status: 'none' | 'draft' | 'approved'
  is_active: boolean
  display_order: number
}

function emptyConcern(order: number): ConcernDraft {
  return {
    title_en: '',
    title_ml: '',
    content_en: '',
    content_ml: '',
    email_subject_en: '',
    email_subject_ml: '',
    email_body_en: '',
    email_body_ml: '',
    ai_body_en: '',
    ai_body_ml: '',
    ai_body_en_status: 'none',
    ai_body_ml_status: 'none',
    is_active: true,
    display_order: order,
  }
}

function fromClause(clause: ObjectionClause): ConcernDraft {
  return {
    id: clause.id,
    code: clause.code,
    title_en: clause.title_en,
    title_ml: clause.title_ml,
    content_en: clause.full_text_en || clause.explain_en,
    content_ml: clause.full_text_ml || clause.explain_ml,
    email_subject_en: clause.email_subject_en || '',
    email_subject_ml: clause.email_subject_ml || '',
    email_body_en: clause.email_body_en || clause.email_en,
    email_body_ml: clause.email_body_ml || clause.email_ml,
    ai_body_en: clause.ai_body_en || '',
    ai_body_ml: clause.ai_body_ml || '',
    ai_body_en_status: clause.ai_body_en_status || 'none',
    ai_body_ml_status: clause.ai_body_ml_status || 'none',
    is_active: clause.is_active,
    display_order: clause.sort_order,
  }
}

export function CampaignStudio({
  campaign,
  concerns,
  recipients,
  formFields,
  sources,
  sourcesLoadError,
  initialTab = 0,
  postalCount = null,
  aiConfigured = false,
}: {
  campaign: Campaign
  concerns: ObjectionClause[]
  recipients: CampaignRecipient[]
  formFields: CampaignFormField[]
  sources: CampaignSource[]
  sourcesLoadError?: string | null
  initialTab?: number
  postalCount?: number | null
  aiConfigured?: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState(initialTab)
  const [status, setStatus] = useState<CampaignStatus>(campaign.status)
  const [saveState, setSaveState] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [form, setForm] = useState({
    slug: campaign.slug,
    title_en: campaign.title_en,
    title_ml: campaign.title_ml,
    summary_en: campaign.summary_en,
    summary_ml: campaign.summary_ml,
    homepage_intro_en: campaign.homepage_intro_en,
    homepage_intro_ml: campaign.homepage_intro_ml,
    source_url: campaign.source_url,
    reference_url: campaign.reference_url ?? '',
    opens_at: formatDatetimeLocal(campaign.opens_at),
    deadline_at: formatDatetimeLocal(campaign.deadline_at),
    allow_multiple_concerns: campaign.allow_multiple_concerns,
    concern_selection_mode: (campaign.concern_selection_mode === 'multiple' ? 'multiple' : 'single') as ConcernSelectionMode,
    max_concern_selections: campaign.max_concern_selections,
    allow_custom_concern: campaign.allow_custom_concern !== false,
    custom_concern_label_en: campaign.custom_concern_label_en ?? '',
    custom_concern_label_ml: campaign.custom_concern_label_ml ?? '',
    custom_concern_placeholder_en: campaign.custom_concern_placeholder_en ?? '',
    custom_concern_placeholder_ml: campaign.custom_concern_placeholder_ml ?? '',
    subject_en: campaign.subject_en,
    subject_ml: campaign.subject_ml,
    intro_en: campaign.intro_en,
    intro_ml: campaign.intro_ml,
    closing_en: campaign.closing_en,
    closing_ml: campaign.closing_ml,
    body_template_en: campaign.body_template_en,
    body_template_ml: campaign.body_template_ml,
    reply_to_email: campaign.reply_to_email ?? '',
    og_title_en: campaign.og_title_en,
    og_title_ml: campaign.og_title_ml,
    og_description_en: campaign.og_description_en,
    og_description_ml: campaign.og_description_ml,
    to_emails: recipientsOfType(recipients, 'to').join('\n') || campaign.recipient_emails.join('\n'),
    cc_emails: recipientsOfType(recipients, 'cc').join('\n') || campaign.cc_emails.join('\n'),
    bcc_emails: recipientsOfType(recipients, 'bcc').join('\n') || (campaign.bcc_emails ?? []).join('\n'),
  })
  const [fields, setFields] = useState(
    (formFields.length > 0 ? formFields : DEFAULT_FORM_FIELDS).map((field, index) => ({
      field_key: field.field_key,
      label_en: field.label_en,
      label_ml: field.label_ml,
      is_enabled: field.is_enabled,
      is_required: field.is_required,
      display_order: field.display_order || index + 1,
    })),
  )
  const [clauseDrafts, setClauseDrafts] = useState<ConcernDraft[]>(concerns.map(fromClause))
  const [editing, setEditing] = useState<ConcernDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConcernDraft | null>(null)
  const [busyConcern, setBusyConcern] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<'en' | 'ml' | null>(null)
  const [features, setFeatures] = useState<CampaignFeatureSettings>(() => parseFeatureSettings(campaign.feature_settings))
  const [selection, setSelection] = useState<ConcernSelectionDraft>(() => draftFromCampaign(campaign))
  const editorRef = useRef<HTMLDivElement>(null)
  const concernSyncKey = concerns.map((clause) => `${clause.id}:${clause.is_active}:${clause.sort_order}:${clause.title_en}`).join('|')
  const editingKey = editing ? (editing.id ?? 'new') : null

  useEffect(() => {
    setClauseDrafts(concerns.map(fromClause))
  }, [concernSyncKey, concerns])

  useEffect(() => {
    if (editingKey) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [editingKey])

  function patch(next: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...next }))
    setSaveState('unsaved')
  }

  async function save() {
    setSaveState('saving')
    const result = await saveCampaignStudio({
      id: campaign.id,
      ...form,
      allow_multiple_concerns: selection.concern_selection_mode === 'multiple',
      concern_selection_mode: selection.concern_selection_mode,
      max_concern_selections: selection.max_concern_selections,
      allow_custom_concern: selection.allow_custom_concern,
      custom_concern_label_en: selection.custom_concern_label_en,
      custom_concern_label_ml: selection.custom_concern_label_ml,
      custom_concern_placeholder_en: selection.custom_concern_placeholder_en,
      custom_concern_placeholder_ml: selection.custom_concern_placeholder_ml,
      feature_settings: features,
      to_emails: form.to_emails.split(/[\n,;]+/),
      cc_emails: form.cc_emails.split(/[\n,;]+/),
      bcc_emails: form.bcc_emails.split(/[\n,;]+/),
      form_fields: fields,
    })
    if (!result.ok) {
      setSaveState('error')
      setMessage(result.error)
      return false
    }
    setSaveState('saved')
    setMessage('Campaign saved.')
    router.refresh()
    return true
  }

  async function publish() {
    const saved = await save()
    if (!saved) return
    const result = await setCampaignStatus(campaign.id, 'active', true)
    if (!result.ok) {
      setSaveState('error')
      setMessage(result.error)
      return
    }
    setStatus('active')
    setPublishOpen(false)
    setMessage('Campaign published.')
    router.refresh()
  }

  async function saveConcern() {
    if (!editing) return
    try {
      const result = await saveConcernStudio({
        ...editing,
        campaign_id: campaign.id,
      })
      if (!result.ok) {
        setSaveState('error')
        setMessage(result.error)
        return
      }
      setEditing(null)
      setSaveState('saved')
      setMessage('Concern saved.')
      router.refresh()
    } catch {
      setSaveState('error')
      setMessage('Could not save concern. Sign in again, then retry.')
    }
  }

  async function moveConcern(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= clauseDrafts.length) return
    const previous = clauseDrafts
    const next = [...clauseDrafts]
    const current = next[index]
    next[index] = next[target]
    next[target] = current
    setClauseDrafts(next)
    const ids = next.map((item) => item.id).filter(Boolean) as string[]
    try {
      const result = await reorderConcerns(campaign.id, ids)
      if (!result.ok) {
        setClauseDrafts(previous)
        setSaveState('error')
        setMessage(result.error)
        return
      }
      setSaveState('saved')
      setMessage('Concern order saved.')
      router.refresh()
    } catch {
      setClauseDrafts(previous)
      setSaveState('error')
      setMessage('Could not reorder concerns. Sign in again, then retry.')
    }
  }

  async function toggleConcernActive(clause: ConcernDraft) {
    if (!clause.id) return
    const nextActive = !clause.is_active
    setBusyConcern(clause.id)
    setClauseDrafts((rows) => rows.map((row) => (row.id === clause.id ? { ...row, is_active: nextActive } : row)))
    try {
      const result = await setConcernActive(clause.id, nextActive)
      if (!result.ok) {
        setClauseDrafts((rows) => rows.map((row) => (row.id === clause.id ? { ...row, is_active: clause.is_active } : row)))
        setSaveState('error')
        setMessage(result.error)
        return
      }
      setSaveState('saved')
      setMessage(nextActive ? 'Concern is now active.' : 'Concern turned off. It will not appear on the public form.')
      router.refresh()
    } catch {
      setClauseDrafts((rows) => rows.map((row) => (row.id === clause.id ? { ...row, is_active: clause.is_active } : row)))
      setSaveState('error')
      setMessage('Could not update this concern. Sign in again, then retry.')
    } finally {
      setBusyConcern(null)
    }
  }

  async function confirmDeleteConcern() {
    if (!deleteTarget?.id) return
    const id = deleteTarget.id
    setBusyConcern(id)
    try {
      const result = await deleteConcernStudio(id)
      if (!result.ok) {
        setSaveState('error')
        setMessage(result.error)
        return
      }
      if (result.deactivated) {
        setClauseDrafts((rows) => rows.map((row) => (row.id === id ? { ...row, is_active: false } : row)))
        setMessage('This concern is already in submitted letters, so it was turned off instead of deleted.')
      } else {
        setClauseDrafts((rows) => rows.filter((row) => row.id !== id))
        if (editing?.id === id) setEditing(null)
        setMessage('Concern deleted.')
      }
      setSaveState('saved')
      setDeleteTarget(null)
      router.refresh()
    } catch {
      setSaveState('error')
      setMessage('Could not delete concern. Sign in again, then retry.')
    } finally {
      setBusyConcern(null)
    }
  }

  async function generateAi(language: 'ml' | 'en') {
    if (!editing?.id) {
      setMessage('Save the concern first, then generate an AI draft.')
      return
    }
    setAiBusy(language)
    const result = await generateAiConcernDraft(campaign.id, editing.id, language)
    setAiBusy(null)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    if (language === 'en') {
      setEditing((prev) => (prev ? { ...prev, ai_body_en: result.body ?? '', ai_body_en_status: 'draft' } : prev))
    } else {
      setEditing((prev) => (prev ? { ...prev, ai_body_ml: result.body ?? '', ai_body_ml_status: 'draft' } : prev))
    }
    setMessage('AI draft generated. Review, edit, then set status to Approved.')
  }

  const preview = useMemo(
    () => ({
      title: form.title_en,
      titleMl: form.title_ml,
      body: form.homepage_intro_en,
      bodyMl: form.homepage_intro_ml,
      to: form.to_emails,
      cc: form.cc_emails,
    }),
    [form],
  )

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={form.title_en || 'Campaign editor'}
        description={`Status: ${CAMPAIGN_STATUS_LABEL[status]} · /campaign/${form.slug}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={adminBtnSecondary} onClick={() => void save()}>
              Save Draft
            </button>
            <button
              type="button"
              className={adminBtnSecondary}
              onClick={() =>
                void previewPathFor(campaign.id).then((result) => {
                  if (result.ok && result.url) window.open(result.url, '_blank', 'noopener,noreferrer')
                  else if (!result.ok) setMessage(result.error)
                })
              }
            >
              Preview
            </button>
            <button type="button" className={adminBtnPrimary} onClick={() => setPublishOpen(true)}>
              Publish Campaign
            </button>
          </div>
        }
      />
      <SaveStatus state={saveState} />
      {message ? (
        saveState === 'error' ? (
          <ErrorState title="Could not save that change" body={message} />
        ) : (
          <SuccessBanner>{message}</SuccessBanner>
        )
      ) : null}

      <div className="flex flex-wrap gap-1">
        {TABS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`rounded-md px-3 py-2 text-sm ${tab === index ? 'bg-emerald-800 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200'}`}
            onClick={() => setTab(index)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {tab === 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Campaign name — English" value={form.title_en} onChange={(v) => patch({ title_en: v })} />
          <Field label="Campaign name — Malayalam" value={form.title_ml} onChange={(v) => patch({ title_ml: v })} />
          <Field label="Slug" value={form.slug} onChange={(v) => patch({ slug: v })} />
          <div className="lg:col-span-2">
            <ConcernSelectionSettings
              value={{
                concern_selection_mode: form.concern_selection_mode,
                max_concern_selections: form.max_concern_selections,
                allow_custom_concern: form.allow_custom_concern,
                custom_concern_label_en: form.custom_concern_label_en,
                custom_concern_label_ml: form.custom_concern_label_ml,
                custom_concern_placeholder_en: form.custom_concern_placeholder_en,
                custom_concern_placeholder_ml: form.custom_concern_placeholder_ml,
              }}
              onChange={(next) =>
                patch({
                  ...next,
                  allow_multiple_concerns:
                    (next.concern_selection_mode ?? form.concern_selection_mode) === 'multiple',
                })
              }
            />
          </div>
          <Area label="Short description — English" value={form.summary_en} onChange={(v) => patch({ summary_en: v })} />
          <Area label="Short description — Malayalam" value={form.summary_ml} onChange={(v) => patch({ summary_ml: v })} />
        </div>
      ) : null}

      {tab === 1 ? (
        <div className="grid gap-3">
          <Area label="Detailed content — English" value={form.homepage_intro_en} onChange={(v) => patch({ homepage_intro_en: v })} tall />
          <Field label="Default subject — English" value={form.subject_en} onChange={(v) => patch({ subject_en: v })} />
          <Area label="Email introduction — English" value={form.intro_en} onChange={(v) => patch({ intro_en: v })} />
          <Area label="Email closing — English" value={form.closing_en} onChange={(v) => patch({ closing_en: v })} />
          <Area label="Email body template — English" value={form.body_template_en} onChange={(v) => patch({ body_template_en: v })} tall />
          <Field label="Open Graph title — English" value={form.og_title_en} onChange={(v) => patch({ og_title_en: v })} />
          <Area label="Open Graph description — English" value={form.og_description_en} onChange={(v) => patch({ og_description_en: v })} />
        </div>
      ) : null}

      {tab === 2 ? (
        <div className="grid gap-3">
          <Area label="Detailed content — Malayalam" value={form.homepage_intro_ml} onChange={(v) => patch({ homepage_intro_ml: v })} tall />
          <Field label="Default subject — Malayalam" value={form.subject_ml} onChange={(v) => patch({ subject_ml: v })} />
          <Area label="Email introduction — Malayalam" value={form.intro_ml} onChange={(v) => patch({ intro_ml: v })} />
          <Area label="Email closing — Malayalam" value={form.closing_ml} onChange={(v) => patch({ closing_ml: v })} />
          <Area label="Email body template — Malayalam" value={form.body_template_ml} onChange={(v) => patch({ body_template_ml: v })} tall />
          <Field label="Open Graph title — Malayalam" value={form.og_title_ml} onChange={(v) => patch({ og_title_ml: v })} />
          <Area label="Open Graph description — Malayalam" value={form.og_description_ml} onChange={(v) => patch({ og_description_ml: v })} />
        </div>
      ) : null}

      {tab === 3 ? (
        <div className="space-y-4">
          <ConcernSelectionSettings
            value={selection}
            onChange={(patch) => {
              setSelection((prev) => ({ ...prev, ...patch }))
              setSaveState('unsaved')
            }}
          />
          <button
            type="button"
            className={adminBtnPrimary}
            onClick={() => setEditing(emptyConcern(clauseDrafts.length + 1))}
          >
            Add concern
          </button>
          {editing ? (
            <div ref={editorRef} className="rounded-md border border-stone-300 bg-stone-50 p-4">
              <h2 className="font-semibold text-stone-900">{editing.id ? 'Edit concern' : 'New concern'}</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Field label="Title — English" value={editing.title_en} onChange={(v) => setEditing({ ...editing, title_en: v })} />
                <Field label="Title — Malayalam" value={editing.title_ml} onChange={(v) => setEditing({ ...editing, title_ml: v })} />
                <Area label="English content" value={editing.content_en} onChange={(v) => setEditing({ ...editing, content_en: v })} tall />
                <Area label="Malayalam content" value={editing.content_ml} onChange={(v) => setEditing({ ...editing, content_ml: v })} tall />
                <Field label="Optional subject — English" value={editing.email_subject_en} onChange={(v) => setEditing({ ...editing, email_subject_en: v })} />
                <Field label="Optional subject — Malayalam" value={editing.email_subject_ml} onChange={(v) => setEditing({ ...editing, email_subject_ml: v })} />
                <Area label="Optional email body — English" value={editing.email_body_en} onChange={(v) => setEditing({ ...editing, email_body_en: v })} />
                <Area label="Optional email body — Malayalam" value={editing.email_body_ml} onChange={(v) => setEditing({ ...editing, email_body_ml: v })} />
                <div className="space-y-2">
                  <Area label="AI email version — English" value={editing.ai_body_en} onChange={(v) => setEditing({ ...editing, ai_body_en: v })} />
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={aiBusy !== null}
                    onClick={() => void generateAi('en')}
                  >
                    {aiBusy === 'en' ? 'Generating…' : 'Generate English AI draft'}
                  </button>
                </div>
                <div className="space-y-2">
                  <Area label="AI email version — Malayalam" value={editing.ai_body_ml} onChange={(v) => setEditing({ ...editing, ai_body_ml: v })} />
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={aiBusy !== null}
                    onClick={() => void generateAi('ml')}
                  >
                    {aiBusy === 'ml' ? 'Generating…' : 'Generate Malayalam AI draft'}
                  </button>
                </div>
                <label className={adminLabel}>
                  English AI status
                  <select
                    className={adminInput}
                    value={editing.ai_body_en_status}
                    onChange={(e) => setEditing({ ...editing, ai_body_en_status: e.target.value as ConcernDraft['ai_body_en_status'] })}
                  >
                    <option value="none">None</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
                <label className={adminLabel}>
                  Malayalam AI status
                  <select
                    className={adminInput}
                    value={editing.ai_body_ml_status}
                    onChange={(e) => setEditing({ ...editing, ai_body_ml_status: e.target.value as ConcernDraft['ai_body_ml_status'] })}
                  >
                    <option value="none">None</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
                <label className={adminLabel}>
                  Active
                  <input
                    type="checkbox"
                    className="ml-2"
                    checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className={adminBtnPrimary} onClick={() => void saveConcern()}>
                  Save concern
                </button>
                <button type="button" className={adminBtnSecondary} onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <ul className="space-y-2">
            {clauseDrafts.map((clause, index) => (
              <li key={clause.id ?? `new-${index}`} className="rounded-md border border-stone-200 bg-white p-3">
                <p className="font-medium text-stone-900">
                  {String(index + 1).padStart(2, '0')} {clause.code ? `${clause.code} · ` : ''}
                  {clause.title_en}
                </p>
                <p className="text-sm text-stone-600">{clause.title_ml}</p>
                <p className="mt-1 text-xs text-stone-500">{clause.is_active ? 'Active' : 'Inactive'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={adminBtnSecondary} onClick={() => setEditing(clause)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={index === 0 || busyConcern !== null}
                    onClick={() => void moveConcern(index, -1)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={index === clauseDrafts.length - 1 || busyConcern !== null}
                    onClick={() => void moveConcern(index, 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className={adminBtnSecondary}
                    disabled={!clause.id || busyConcern === clause.id}
                    onClick={() => void toggleConcernActive(clause)}
                  >
                    {busyConcern === clause.id ? 'Saving…' : clause.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {clause.id ? (
                    <button
                      type="button"
                      className={adminBtnDanger}
                      disabled={busyConcern === clause.id}
                      onClick={() => setDeleteTarget(clause)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 4 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Area label="TO recipients (one per line)" value={form.to_emails} onChange={(v) => patch({ to_emails: v })} tall />
          <Area label="CC recipients (one per line)" value={form.cc_emails} onChange={(v) => patch({ cc_emails: v })} tall />
          <Area label="BCC recipients (one per line)" value={form.bcc_emails} onChange={(v) => patch({ bcc_emails: v })} tall />
          <Field label="Reply-to" value={form.reply_to_email} onChange={(v) => patch({ reply_to_email: v })} />
        </div>
      ) : null}

      {tab === 5 ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            Phone and Address can be disabled, optional, or required per campaign. Email and extra location fields stay hidden unless you enable them.
          </p>
          {fields.map((field, index) => {
            const mode: FieldMode = !field.is_enabled ? 'disabled' : field.is_required ? 'required' : 'optional'
            return (
              <div key={field.field_key} className="grid gap-2 rounded-md border border-stone-200 bg-white p-3 lg:grid-cols-4">
                <p className="font-medium text-stone-800">{field.field_key}</p>
                <Field label="Label EN" value={field.label_en} onChange={(v) => setFields(fields.map((item, i) => (i === index ? { ...item, label_en: v } : item)))} />
                <Field label="Label ML" value={field.label_ml} onChange={(v) => setFields(fields.map((item, i) => (i === index ? { ...item, label_ml: v } : item)))} />
                <label className={adminLabel}>
                  Availability
                  <select
                    className={adminInput}
                    value={mode}
                    onChange={(event) => {
                      const next = applyFieldMode(field, event.target.value as FieldMode)
                      setFields(fields.map((item, i) => (i === index ? { ...item, is_enabled: next.is_enabled, is_required: next.is_required } : item)))
                      setSaveState('unsaved')
                    }}
                  >
                    <option value="disabled">Disabled</option>
                    <option value="optional">Enabled — Optional</option>
                    <option value="required">Enabled — Required</option>
                  </select>
                </label>
              </div>
            )
          })}
        </div>
      ) : null}

      {tab === 6 ? (
        <CampaignFeaturesPanel
          value={features}
          onChange={(patch) => {
            setFeatures((prev) => ({ ...prev, ...patch }))
            setSaveState('unsaved')
          }}
          health={{ postalCount, aiConfigured }}
        />
      ) : null}

      {tab === 7 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Start date" type="datetime-local" value={form.opens_at} onChange={(v) => patch({ opens_at: v })} />
          <Field label="End date" type="datetime-local" value={form.deadline_at} onChange={(v) => patch({ deadline_at: v })} />
          <Field label="Official source URL" value={form.source_url} onChange={(v) => patch({ source_url: v })} />
          <Field label="Reference URL" value={form.reference_url} onChange={(v) => patch({ reference_url: v })} />
          <label className={adminLabel}>
            Status
            <select
              className={adminInput}
              value={status}
              onChange={(e) => {
                const next = e.target.value as CampaignStatus
                void setCampaignStatus(campaign.id, next, true).then((result) => {
                  if (!result.ok) setMessage(result.error)
                  else {
                    setStatus(next)
                    setMessage(`Campaign is now ${CAMPAIGN_STATUS_LABEL[next]}.`)
                    router.refresh()
                  }
                })
              }}
            >
              {Object.entries(CAMPAIGN_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {tab === 8 ? (
        <CampaignSourcesEditor campaignId={campaign.id} sources={sources} loadError={sourcesLoadError} />
      ) : null}

      {tab === 9 ? (
        <div className="space-y-4 rounded-md border border-stone-200 bg-white p-4">
          <p className="font-mono text-xs text-stone-500">{status.toUpperCase()}</p>
          <h2 className="text-2xl font-semibold text-stone-900">{preview.title}</h2>
          <p className="text-lg text-stone-800">{preview.titleMl}</p>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{preview.body}</pre>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{preview.bodyMl}</pre>
          <p className="text-sm text-stone-600">TO: {preview.to || '—'}</p>
          <p className="text-sm text-stone-600">CC: {preview.cc || '—'}</p>
          <p className="text-sm text-stone-600">BCC: {form.bcc_emails || '—'}</p>
          <p className="text-sm text-stone-600">Concerns: {clauseDrafts.filter((c) => c.is_active).length} active</p>
          <p className="text-sm text-stone-600">
            Sources / references: {sources.filter((source) => source.is_public).length} public, {sources.length} total
            (supporting material only — not copied into emails)
          </p>
        </div>
      ) : null}

      {publishOpen ? (
        <ConfirmDialog
          title="Publish this campaign?"
          confirmLabel="Publish"
          onCancel={() => setPublishOpen(false)}
          onConfirm={() => void publish()}
        >
          Publishing makes this campaign publicly actionable. Confirm that the copy, concerns, dates, and recipients are correct.
        </ConfirmDialog>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete this concern?"
          confirmLabel="Delete"
          busy={busyConcern === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDeleteConcern()}
        >
          {deleteTarget.title_en || 'This concern'} will be removed from the campaign. If people have already used it in a submitted letter, it will be turned off instead of permanently deleted.
        </ConfirmDialog>
      ) : null}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className={adminLabel}>
      {label}
      <input type={type} className={adminInput} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Area({
  label,
  value,
  onChange,
  tall,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  tall?: boolean
}) {
  return (
    <label className={adminLabel}>
      {label}
      <textarea className={`${adminInput} ${tall ? 'min-h-40' : 'min-h-24'} py-2`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
