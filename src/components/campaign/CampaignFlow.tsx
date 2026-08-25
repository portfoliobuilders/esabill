'use client'

import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react'
import { useRouter } from 'next/navigation'

import { markHandoff, prepareDemoLetter } from '@/app/actions/submission'
import { CampaignSources } from '@/components/campaign/CampaignSources'
import { ReadAloudControls } from '@/components/campaign/ReadAloudControls'
import { StatusRegion } from '@/components/campaign/StatusRegion'
import { VoiceInputButton } from '@/components/campaign/VoiceInputButton'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useLang } from '@/components/LanguageProvider'
import { IconCheck, IconCopy, IconEnvelope, IconGmail, IconSparkle } from '@/components/ui/icons'
import { PageContainer } from '@/components/ui/PageContainer'
import { ConcernSelector } from '@/components/wizard/ConcernSelector'
import { composeEmail, concernTitle, formatCompleteEmailCopy, resolveMailTargets, type MailComposeParams } from '@/lib/compose'
import { applyGmailHandoff, clientPlatform, planGmailHandoff } from '@/lib/gmail-handoff'
import { launchMailCompose } from '@/lib/open-mail'
import {
  applyPredefinedConcernClick,
  campaignConcernConfig,
  customConcernCopy,
  flattenCustomConcerns,
  isMultiSelect,
  selectedClausesForLetter,
  validatePredefinedSelection,
} from '@/lib/concern-selection'
import { parseFeatureSettings } from '@/lib/campaign-features'
import { cx } from '@/lib/cx'
import { daysRemaining } from '@/lib/deadline'
import {
  createDetailsSchema,
  emptyDetails,
  fieldErrorsFromZod,
  MAX_CUSTOM_CHARS,
  type DetailsFields,
  type FieldErrors,
} from '@/lib/details-schema'
import { formatCampaignDate } from '@/lib/format-date'
import { isFieldEnabled, isFieldRequired, labelForField } from '@/lib/form-fields'
import { applyGmailHandoff, clientPlatform, planGmailHandoff } from '@/lib/gmail-handoff'
import { t, tReplace, type Lang } from '@/lib/i18n'
import type { DistrictOption } from '@/lib/kerala-districts'
import { normalizeIndianPhone } from '@/lib/phone'
import { btnGhost, btnPrimary, btnSecondary, inputClass, labelClass } from '@/lib/ui'
import type { WizardMode } from '@/lib/wizard-mode'
import { isDryRun } from '@/lib/wizard-mode'
import type { Campaign, CampaignFormField, CampaignSource, ObjectionClause } from '@/types/database'

type Step = 1 | 2 | 3 | 4 | 5
type CanonicalLetter = { subject: string; body: string }

type FlowState = {
  step: Step
  selectedIds: string[]
  customConcerns: string[]
  details: DetailsFields
  detailsErrors: FieldErrors
  concernError: boolean
  maxError: boolean
  letter: CanonicalLetter | null
  submissionId: string | null
}

type Action =
  | { type: 'select'; id: string; multiple: boolean; maxSelections: number | null }
  | { type: 'set_custom'; index: number; text: string }
  | { type: 'add_custom' }
  | { type: 'remove_custom'; index: number }
  | { type: 'set_details'; details: Partial<DetailsFields> }
  | { type: 'details_invalid'; errors: FieldErrors }
  | { type: 'goto'; step: Step }
  | { type: 'concern_error' }
  | { type: 'max_error' }
  | {
      type: 'ready_review'
      details: DetailsFields
      letter: CanonicalLetter
      submissionId: string | null
    }

function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case 'select': {
      const next = applyPredefinedConcernClick({
        mode: action.multiple ? 'multiple' : 'single',
        selectedIds: state.selectedIds,
        id: action.id,
        maxSelections: action.maxSelections,
      })
      return { ...state, concernError: false, maxError: next.limited, selectedIds: next.selectedIds }
    }
    case 'set_custom': {
      const customConcerns = [...state.customConcerns]
      customConcerns[action.index] = action.text
      const detailsErrors = { ...state.detailsErrors }
      delete detailsErrors.customText
      return { ...state, customConcerns, detailsErrors }
    }
    case 'add_custom':
      return { ...state, customConcerns: [...state.customConcerns, ''] }
    case 'remove_custom':
      return {
        ...state,
        customConcerns: state.customConcerns.filter((_, index) => index !== action.index),
      }
    case 'set_details': {
      const detailsErrors = { ...state.detailsErrors }
      for (const key of Object.keys(action.details) as Array<keyof DetailsFields>) delete detailsErrors[key]
      return { ...state, details: { ...state.details, ...action.details }, detailsErrors }
    }
    case 'details_invalid':
      return { ...state, detailsErrors: action.errors }
    case 'goto':
      return { ...state, step: action.step }
    case 'concern_error':
      return { ...state, concernError: true }
    case 'max_error':
      return { ...state, maxError: true }
    case 'ready_review':
      return {
        ...state,
        details: action.details,
        detailsErrors: {},
        letter: action.letter,
        submissionId: action.submissionId,
        step: 4,
      }
    default:
      return state
  }
}

function pick(lang: Lang, ml: string, en: string) {
  return lang === 'en' ? en : ml
}

function statusLabel(lang: Lang, view: 'live' | 'preview' | 'inactive' | 'expired') {
  if (view === 'live') return t(lang, 'statusActive')
  if (view === 'expired') return t(lang, 'statusExpired')
  if (view === 'inactive') return t(lang, 'statusInactive')
  return t(lang, 'statusDraft')
}

export function CampaignFlow({
  campaign,
  clauses,
  formFields,
  districts,
  mode,
  view,
  sources = [],
  aiConfigured = false,
}: {
  campaign: Campaign
  clauses: ObjectionClause[]
  formFields: CampaignFormField[]
  districts: { value: string; labelEn: string; labelMl: string }[]
  mode: WizardMode
  view: 'live' | 'preview' | 'inactive' | 'expired'
  sources?: CampaignSource[]
  aiConfigured?: boolean
}) {
  const { lang } = useLang()
  const router = useRouter()
  const actionable = view === 'live' || view === 'preview'
  const config = campaignConcernConfig(campaign)
  const [state, dispatch] = useReducer(reducer, {
    step: 1 as Step,
    selectedIds: [],
    customConcerns: config.allowCustomConcern ? [''] : [],
    details: emptyDetails(),
    detailsErrors: {},
    concernError: false,
    maxError: false,
    letter: null,
    submissionId: null,
  })

  const selected = selectedClausesForLetter(clauses, state.selectedIds)
  const extraConcerns = config.allowCustomConcern ? flattenCustomConcerns(state.customConcerns) : []
  const title = pick(lang, campaign.title_ml, campaign.title_en)
  const description = pick(lang, campaign.homepage_intro_ml || campaign.summary_ml, campaign.homepage_intro_en || campaign.summary_en)
  const deadline = formatCampaignDate(campaign.deadline_at, lang)
  const [daysLeft, setDaysLeft] = useState(() => daysRemaining(campaign.deadline_at))

  useEffect(() => {
    setDaysLeft(daysRemaining(campaign.deadline_at))
    if (!campaign.deadline_at) return

    const timer = window.setInterval(() => {
      setDaysLeft(daysRemaining(campaign.deadline_at))
    }, 60_000)

    return () => window.clearInterval(timer)
  }, [campaign.deadline_at])

  const showAi =
    features.enable_ai_mail &&
    selected.length === 1 &&
    (aiConfigured || Boolean(selected[0] && approvedAiBody(selected[0], lang)))
  const showVoice = features.enable_voice_input
  const showRead = features.enable_mail_read_aloud && Boolean(letter?.body)

  function patchDetails(next: Partial<DetailsFields>) {
    setDetails((prev) => ({ ...prev, ...next }))
    const nextErrors = { ...errors }
    for (const key of Object.keys(next) as Array<keyof DetailsFields>) delete nextErrors[key]
    setErrors(nextErrors)
  }

  async function goReview() {
    const parsed = createDetailsSchema(
      lang,
      districts.map((item) => item.value),
      formFields,
      { privacyMode: privacyOn, campaign },
    ).safeParse(details)
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error))
      return false
    }
    setErrors({})
    return true
  }

  async function copyPlainText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const field = document.createElement('textarea')
      field.value = text
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(field)
      if (!ok) throw new Error('copy failed')
    }
  }

  async function persistAndHandoff(method: 'gmail_web' | 'mailto' | 'copy', goSent: boolean) {
    if (!letter || selected.length === 0) return
    let id = submissionId
    try {
      const prepared = await prepareDemoLetter({
        campaignSlug: campaign.slug,
        fullName: details.fullName || (privacyOn ? 'Citizen' : ''),
        email: details.email,
        phone: details.phone,
        address: details.addressLine,
        panchayat: details.panchayat,
        village: details.village,
        district: details.district,
        pincode: details.pincode,
        language: lang,
        customText: '',
        extraConcerns: extras,
        clauseCodes: selected.map((clause) => clause.code),
        letterMode: 'selected',
        constituencyId: null,
        ccRepIds: [],
      })
      if (prepared.ok) id = prepared.data.id
      setSubmissionId(id)
    } catch {
      // Sending still works offline.
    }
    if (id) await markHandoff(id, method)
    if (goSent && id) router.push(`/sent?id=${id}`)
  }

  function mailParams(): MailComposeParams | null {
    if (!letter) return null
    const targets = resolveMailTargets({ campaign, mode, testerEmail: details.email })
    return { to: targets.to, cc: targets.cc, bcc: targets.bcc, subject: letter.subject, body: letter.body }
  }

  return (
    <PageContainer>
      {state.step > 1 && actionable ? <CampaignProgress step={state.step} /> : null}

  async function improveEmail() {
    const concern = selected[0]
    if (!concern || !showAi) return
    aiAbort.current?.abort()
    const controller = new AbortController()
    aiAbort.current = controller
    setImproving(true)
    setAiError('')
    setStatus(t(lang, 'improvingEmail'))
    try {
      const response = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          campaign_id: campaign.id,
          concern_id: concern.id,
          language: lang,
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; body?: string }
      if (!payload.ok || !payload.body) {
        setAiError(t(lang, 'aiUnavailable'))
        setImproved(null)
        setStatus(t(lang, 'aiUnavailable'))
        return
      }
      setImproved({ concernId: concern.id, body: payload.body })
      setStatus(t(lang, 'aiGenerated'))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setAiError(t(lang, 'aiUnavailable'))
      setImproved(null)
      setStatus(t(lang, 'aiUnavailable'))
    } finally {
      setImproving(false)
    }
  }

  const locationLine = lookup?.found ? compactLocationLine(lookup.common) : ''

      {state.step === 2 ? (
        <section>
          <ConcernSelector
            campaign={campaign}
            clauses={clauses}
            selectedIds={state.selectedIds}
            customConcerns={state.customConcerns}
            customError={state.detailsErrors.customText}
            maxError={state.maxError}
            onSelect={(id) =>
              dispatch({
                type: 'select',
                id,
                multiple: config.mode === 'multiple',
                maxSelections: config.maxSelections,
              })
            }
            onCustomChange={(index, text) => dispatch({ type: 'set_custom', index, text })}
            onAddCustom={() => dispatch({ type: 'add_custom' })}
            onRemoveCustom={(index) => dispatch({ type: 'remove_custom', index })}
          />
          {state.concernError ? (
            <p className="mt-3 text-sm text-red-800" role="alert">
              {config.mode === 'single' ? t(lang, 'minClausesHint') : t(lang, 'minClausesHintMultiple')}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" className={cx(btnGhost, 'w-full sm:w-auto')} onClick={() => dispatch({ type: 'goto', step: 1 })}>
              {t(lang, 'back')}
            </button>
            <button type="button" className={cx(btnPrimary, 'w-full sm:flex-1')} onClick={goDetails}>
              {t(lang, 'continue')}
              <IconChevronRight className="size-4 shrink-0" />
            </button>
          </div>
        </section>
      ) : null}

      {state.step === 3 ? (
        <section>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">{t(lang, 'yourDetails')}</h1>
          <p className="mt-2 text-base leading-relaxed text-body">{t(lang, 'privacyDetails')}</p>
          <div className="mt-6 grid gap-4">
            <Field
              id="full-name"
              label={labelForField(formFields, 'name', lang, t(lang, 'fullName'))}
              required={isFieldRequired(formFields, 'name')}
              value={details.fullName}
              error={errors.fullName}
              autoComplete="name"
              onChange={(value) => patchDetails({ fullName: value })}
              voice={showVoice ? { lang, onStatus: setStatus } : null}
            />
            <Field
              lang={lang}
              fields={formFields}
              fieldKey="pincode"
              inputMode="numeric"
              value={state.details.pincode}
              error={state.detailsErrors.pincode}
              onChange={(value) => dispatch({ type: 'set_details', details: { pincode: value } })}
              autoComplete="postal-code"
            />
            <Field
              lang={lang}
              fields={formFields}
              fieldKey="email"
              type="email"
              value={state.details.email}
              error={state.detailsErrors.email}
              onChange={(value) => dispatch({ type: 'set_details', details: { email: value } })}
              autoComplete="email"
            />
            <Field
              id="phone"
              label={labelForField(formFields, 'phone', lang, t(lang, 'phone'))}
              required={isFieldRequired(formFields, 'phone')}
              value={details.phone}
              error={errors.phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              onChange={(value) => patchDetails({ phone: value })}
            />
          ) : null}

          {isFieldEnabled(formFields, 'address') && !privacyOn ? (
            <Field
              id="address"
              label={labelForField(formFields, 'address', lang, t(lang, 'address'))}
              required={isFieldRequired(formFields, 'address')}
              value={details.addressLine}
              error={errors.addressLine}
              multiline
              onChange={(value) => patchDetails({ addressLine: value })}
              voice={showVoice ? { lang, onStatus: setStatus } : null}
            />
          ) : null}

          {isFieldEnabled(formFields, 'local_body') && !privacyOn ? (
            <Field
              id="panchayat"
              label={labelForField(formFields, 'local_body', lang, t(lang, 'panchayat'))}
              required={isFieldRequired(formFields, 'local_body')}
              value={details.panchayat}
              error={errors.panchayat}
              onChange={(value) => patchDetails({ panchayat: value })}
            />
          ) : null}

          {isFieldEnabled(formFields, 'village') && !privacyOn ? (
            <Field
              id="village"
              label={labelForField(formFields, 'village', lang, t(lang, 'village'))}
              required={isFieldRequired(formFields, 'village')}
              value={details.village}
              error={errors.village}
              onChange={(value) => patchDetails({ village: value })}
            />
          ) : null}

          {isFieldEnabled(formFields, 'email') && !privacyOn ? (
            <Field
              id="email"
              label={labelForField(formFields, 'email', lang, t(lang, 'email'))}
              required={isFieldRequired(formFields, 'email')}
              value={details.email}
              error={errors.email}
              type="email"
              autoComplete="email"
              onChange={(value) => patchDetails({ email: value })}
            />
            {isFieldEnabled(formFields, 'custom_message') ? (
              <label className={labelClass}>
                {fieldByKey(formFields, 'custom_message')?.[lang === 'en' ? 'label_en' : 'label_ml'] || t(lang, 'customText')}
                <span className="font-normal text-muted"> ({t(lang, 'optional')})</span>
              ) : (
                <span className="text-accent"> *</span>
              )}
              <select
                id="district"
                className={inputClass}
                value={details.district}
                onChange={(event) => patchDetails({ district: event.target.value })}
              >
                <option value="">{t(lang, 'selectDistrict')}</option>
                {districts.map((district) => (
                  <option key={district.value} value={district.value}>
                    {lang === 'en' ? district.labelEn : district.labelMl}
                  </option>
                ))}
              </select>
              {errors.district ? <p className="mt-1 text-sm font-normal text-red-800">{errors.district}</p> : null}
            </label>
          ) : null}

          {features.allow_privacy_mode ? (
            <div className="rounded-[8px] border border-rule bg-raised p-4">
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-6 accent-[var(--color-accent)]"
                  checked={privacyOn}
                  onChange={(event) => {
                    setPrivacyMode(event.target.checked)
                    setImproved(null)
                  }}
                />
                <span>
                  <span className="block font-semibold text-ink">{t(lang, 'privacyMode')}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-body">{t(lang, 'privacyModeHelp')}</span>
                </span>
              </label>
            </div>
          ) : null}

          {letter ? (
            <section aria-label={t(lang, 'previewEmail')}>
              <h2 className="font-display text-xl text-ink">{t(lang, 'previewEmail')}</h2>
              <p className="mt-2 text-sm font-semibold text-ink">{letter.subject}</p>
              <pre className="mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-rule bg-raised p-4 text-sm leading-relaxed text-ink sm:text-base">
                {letter.body}
              </pre>
            </section>
          ) : null}

          {showAi ? (
            <div>
              <button
                type="button"
                className={cx(btnGhost, 'w-full sm:w-auto')}
                onClick={() => void improveEmail()}
                disabled={improving}
                aria-busy={improving}
              >
                <IconSparkle className="size-5" />
                {improving ? t(lang, 'improvingEmail') : t(lang, 'improveEmail')}
              </button>
              <p className="mt-1 text-sm text-muted">{t(lang, 'improveEmailHint')}</p>
              {improving ? (
                <button type="button" className={cx(btnGhost, 'mt-2')} onClick={() => aiAbort.current?.abort()}>
                  {t(lang, 'cancelImprove')}
                </button>
              ) : null}
              {aiError ? <p className="mt-2 text-sm text-ink">{aiError}</p> : null}
            </div>
          ) : null}

          {isDryRun(mode) ? <p className="text-base text-amber-900">{t(lang, 'demoLetterHint')}</p> : null}

          <div className="flex flex-col gap-3">
            {showRead && letter ? (
              <ReadAloudControls lang={lang} text={`${letter.subject}\n\n${letter.body}`} onStatus={setStatus} />
            ) : null}
            <button type="submit" className={cx(btnPrimary, 'min-h-14 w-full')}>
              <IconEnvelope className="size-5 shrink-0" />
              {t(lang, 'sendEmail')}
            </button>
            <button type="button" className={cx(btnSecondary, 'min-h-12 w-full')} onClick={() => void sendGmail()}>
              <IconGmail className="size-5 shrink-0" />
              {t(lang, 'sendGmail')}
            </button>
            <button
              type="button"
              className={cx(btnGhost, 'min-h-12 w-full')}
              onClick={() => {
                if (!validate()) return
                const params = mailParams()
                if (!params) return
                void copyPlainText(formatCompleteEmailCopy(params))
                  .then(() => {
                    setCopyState('copied')
                    setStatus(t(lang, 'mailCopied'))
                    return persistAndHandoff('copy', true)
                  })
                  .catch(() => setCopyState('failed'))
              }}
            >
              <IconCopy className="size-4" />
              {copyState === 'copied' ? t(lang, 'copied') : t(lang, 'copyEmail')}
            </button>
          </div>
        </section>
      ) : null}

      {state.step === 4 && state.letter ? (
        <ReviewStep
          campaign={campaign}
          selected={selected}
          details={state.details}
          letter={state.letter}
          mode={mode}
          onBack={() => dispatch({ type: 'goto', step: 3 })}
          onContinue={() => dispatch({ type: 'goto', step: 5 })}
        />
      ) : null}

      {state.step === 5 && state.letter ? (
        <EmailStep
          campaign={campaign}
          details={state.details}
          letter={state.letter}
          mode={mode}
          submissionId={state.submissionId}
          onBack={() => dispatch({ type: 'goto', step: 4 })}
        />
      ) : null}
    </PageContainer>
  )
}

function Field({
  lang,
  fields,
  fieldKey,
  value,
  error,
  onChange,
  type = 'text',
  multiline,
  hint,
  autoComplete,
  inputMode,
}: {
  lang: Lang
  fields: CampaignFormField[]
  fieldKey: Parameters<typeof isFieldEnabled>[1]
  value: string
  error?: string
  onChange: (value: string) => void
  type?: string
  multiline?: boolean
  hint?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  if (!isFieldEnabled(fields, fieldKey)) return null
  const field = fieldByKey(fields, fieldKey)
  const label = (lang === 'en' ? field?.label_en : field?.label_ml) || fieldKey
  const required = isFieldRequired(fields, fieldKey)
  return (
    <label className={labelClass}>
      {label}
      {!required ? <span className="font-normal text-muted"> ({t(lang, 'optional')})</span> : null}
      {multiline ? (
        <textarea className={`${inputClass} min-h-24 py-2`} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          className={inputClass}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? <span className="mt-1 block text-sm font-normal text-muted">{hint}</span> : null}
      {error ? <p className="mt-1 text-sm font-normal text-red-800">{error}</p> : null}
    </label>
  )
}

function ReviewStep({
  campaign,
  selected,
  details,
  letter,
  mode,
  onBack,
  onContinue,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  required?: boolean
  type?: string
  multiline?: boolean
  autoComplete?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  voice?: { lang: Lang; onStatus: (message: string) => void } | null
}) {
  const { lang } = useLang()
  return (
    <section>
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{t(lang, 'reviewTitle')}</h1>
      <p className="mt-2 text-base text-body">{t(lang, 'reviewLead')}</p>
      <dl className="mt-6 space-y-4 text-base">
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'selectedConcern')}</dt>
          <dd className="mt-1 text-body">{selected.map((clause) => concernTitle(clause, lang)).join(', ')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'yourName')}</dt>
          <dd className="mt-1 text-body">{details.fullName}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'subjectLabel')}</dt>
          <dd className="mt-1 break-words text-body">{letter.subject}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'toLabel')}</dt>
          <dd className="mt-1 break-all text-body">{targets.to.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'ccLabel')}</dt>
          <dd className="mt-1 break-all text-body">{targets.cc.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'bccLabel')}</dt>
          <dd className="mt-1 text-body">{targets.bcc.length > 0 ? t(lang, 'bccPrivateNote') : '—'}</dd>
        </div>
      </dl>
      <pre className="mt-5 max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-rule bg-raised p-4 text-sm leading-relaxed text-ink sm:text-base">
        {letter.body}
      </pre>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" className={cx(btnGhost, 'w-full sm:w-auto')} onClick={onBack}>
          {t(lang, 'backAndEdit')}
        </button>
        <button type="button" className={cx(btnPrimary, 'w-full sm:flex-1')} onClick={onContinue}>
          {t(lang, 'continueToEmail')}
          <IconChevronRight className="size-4 shrink-0" />
        </button>
      </div>
    </section>
  )
}

function EmailStep({
  campaign,
  details,
  letter,
  mode,
  submissionId,
  onBack,
}: {
  campaign: Campaign
  details: DetailsFields
  letter: CanonicalLetter
  mode: WizardMode
  submissionId: string | null
  onBack: () => void
}) {
  const { lang } = useLang()
  const router = useRouter()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [emlHint, setEmlHint] = useState(false)
  const dryRun = isDryRun(mode)
  const targets = useMemo(
    () => resolveMailTargets({ campaign, mode, testerEmail: details.email }),
    [campaign, mode, details.email],
  )
  const mailParams: MailComposeParams = {
    to: targets.to,
    cc: targets.cc,
    bcc: targets.bcc,
    subject: letter.subject,
    body: letter.body,
  }
  const sendDisabled = !details.fullName.trim() || mailParams.to.length === 0

  async function recordHandoff(method: 'gmail_web' | 'mailto' | 'copy', goSent: boolean) {
    if (!submissionId) return
    await markHandoff(submissionId, method)
    if (goSent) router.push(`/sent?id=${submissionId}`)
  }

  async function copyPlainText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const field = document.createElement('textarea')
      field.value = text
      field.setAttribute('readonly', '')
      field.style.position = 'fixed'
      field.style.opacity = '0'
      document.body.appendChild(field)
      field.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(field)
      if (!ok) throw new Error('copy failed')
    }
  }

  function openGmail() {
    setEmlHint(false)
    const plan = planGmailHandoff(
      mailParams,
      clientPlatform(navigator.userAgent, navigator.maxTouchPoints),
      navigator.userAgent,
    )
    applyGmailHandoff(plan)
    void recordHandoff('gmail_web', plan.openInNewTab && plan.includeBody)
  }

  function openMailApp() {
    setEmlHint(false)
    const result = launchMailCompose(mailParams, 'mail_app')
    setEmlHint(result === 'eml')
    void recordHandoff('mailto', false)
  }

  return (
    <section>
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{t(lang, 'sendEmail')}</h1>
      <p className="mt-2 text-base text-body">{t(lang, 'letterSupport')}</p>
      {dryRun ? <p className="mt-3 text-base text-amber-900">{t(lang, 'demoLetterHint')}</p> : null}
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" disabled={sendDisabled} onClick={() => void openGmail()} className={cx(btnPrimary, 'min-h-12 w-full')}>
          <IconGmail className="size-5 shrink-0" />
          {t(lang, 'sendEmail')}
        </button>
        <button type="button" disabled={sendDisabled} onClick={() => void openMailApp()} className={cx(btnSecondary, 'min-h-12 w-full')}>
          <IconEnvelope className="size-4 shrink-0" />
          {t(lang, 'sendMailto')}
        </button>
        <button
          type="button"
          disabled={sendDisabled}
          onClick={() => {
            void copyPlainText(formatCompleteEmailCopy(mailParams))
              .then(() => {
                setCopyState('copied')
                return recordHandoff('copy', true)
              })
              .catch(() => setCopyState('failed'))
          }}
          className={cx(btnGhost, 'min-h-12 w-full')}
        >
          <IconCopy className="size-4 shrink-0" />
          {copyState === 'copied' ? t(lang, 'copied') : t(lang, 'copyCompleteEmail')}
        </button>
      </div>
      {multiline ? (
        <textarea
          id={id}
          className={`${inputClass} min-h-24 resize-y py-2`}
          value={value}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className={inputClass}
          value={value}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-normal text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function NoActiveCampaign() {
  const { lang } = useLang()
  return (
    <PageContainer>
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <h1 className="font-display mt-6 text-2xl text-ink sm:text-3xl">{t(lang, 'noLiveTitle')}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-body sm:text-lg">{t(lang, 'noActiveCampaign')}</p>
    </PageContainer>
  )
}
