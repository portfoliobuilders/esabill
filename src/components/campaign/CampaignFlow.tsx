'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'

import { prepareDemoLetter, markHandoff } from '@/app/actions/submission'
import { CampaignProgress } from '@/components/campaign/CampaignProgress'
import { CampaignSources } from '@/components/campaign/CampaignSources'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useLang } from '@/components/LanguageProvider'
import { IconChevronRight, IconCopy, IconEnvelope, IconGmail } from '@/components/ui/icons'
import { PageContainer } from '@/components/ui/PageContainer'
import { ConcernSelector } from '@/components/wizard/ConcernSelector'
import { composeEmail, concernTitle, formatCompleteEmailCopy, resolveMailTargets, type MailComposeParams } from '@/lib/compose'
import { applyGmailHandoff, clientPlatform, planGmailHandoff } from '@/lib/gmail-handoff'
import { launchMailCompose } from '@/lib/open-mail'
import {
  applyPredefinedConcernClick,
  campaignConcernConfig,
  flattenCustomConcerns,
  selectedClausesForLetter,
  validatePredefinedSelection,
} from '@/lib/concern-selection'
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
import { fieldByKey, isFieldEnabled, isFieldRequired } from '@/lib/form-fields'
import { formatCampaignDate } from '@/lib/format-date'
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

function statusLabel(lang: Lang, mode: WizardMode | 'inactive' | 'expired') {
  if (mode === 'live') return t(lang, 'statusActive')
  if (mode === 'expired' || mode === 'demo') return t(lang, 'statusExpired')
  if (mode === 'inactive') return t(lang, 'statusInactive')
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
}: {
  campaign: Campaign
  clauses: ObjectionClause[]
  formFields: CampaignFormField[]
  districts: DistrictOption[]
  mode: WizardMode
  view: 'live' | 'preview' | 'inactive' | 'expired'
  sources?: CampaignSource[]
  aiConfigured?: boolean
}) {
  const { lang } = useLang()
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

  useEffect(() => {
    const pin = state.details.pincode.trim()
    if (!/^[1-9][0-9]{5}$/.test(pin)) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pincode: pin })
      if (state.details.district.trim()) params.set('district', state.details.district.trim())
      void fetch(`/api/constituency?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return
          const body = (await response.json()) as { candidates?: Array<{ constituency?: { district?: string } }> }
          const district = body.candidates?.[0]?.constituency?.district
          if (district && !state.details.district.trim()) {
            dispatch({ type: 'set_details', details: { district } })
          }
        })
        .catch(() => undefined)
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [state.details.pincode, state.details.district])

  function goConcern() {
    if (!actionable) return
    dispatch({ type: 'goto', step: 2 })
  }

  function goDetails() {
    const check = validatePredefinedSelection({
      mode: config.mode,
      selectedIds: state.selectedIds,
      maxSelections: config.maxSelections,
    })
    if (check === 'required') {
      dispatch({ type: 'concern_error' })
      return
    }
    if (check === 'too_many') {
      dispatch({ type: 'max_error' })
      return
    }
    dispatch({ type: 'goto', step: 3 })
  }

  async function goReview() {
    const parsed = createDetailsSchema(
      lang,
      districts.map((d) => d.value),
      formFields,
    ).safeParse(state.details)
    if (!parsed.success) {
      dispatch({ type: 'details_invalid', errors: fieldErrorsFromZod(parsed.error) })
      return
    }
    const phone = parsed.data.phone.trim() ? (normalizeIndianPhone(parsed.data.phone) ?? parsed.data.phone) : ''
    const details = { ...parsed.data, phone }
    let letter = composeEmail({
      campaign,
      clauses: selected,
      details: {
        fullName: details.fullName,
        addressLine: details.addressLine,
        panchayat: details.panchayat,
        village: details.village,
        district: details.district,
        pincode: details.pincode,
        phone,
        email: details.email,
        customText: details.customText,
        extraConcerns,
      },
      lang,
    })
    let submissionId: string | null = null
    try {
      const prepared = await prepareDemoLetter({
        campaignSlug: campaign.slug,
        fullName: details.fullName,
        email: details.email,
        phone,
        address: details.addressLine,
        panchayat: details.panchayat,
        village: details.village,
        district: details.district,
        pincode: details.pincode,
        language: lang,
        customText: details.customText,
        extraConcerns,
        clauseCodes: selected.map((clause) => clause.code),
        constituencyId: null,
        ccRepIds: [],
      })
      if (prepared.ok) {
        letter = { subject: prepared.data.subject, body: prepared.data.body, charCount: letter.charCount, error: null }
        submissionId = prepared.data.id
      }
    } catch {
      // Letter still works offline.
    }
    dispatch({
      type: 'ready_review',
      details,
      letter: { subject: letter.subject, body: letter.body },
      submissionId,
    })
  }

  return (
    <PageContainer>
      {state.step > 1 && actionable ? <CampaignProgress step={state.step} /> : null}

      {state.step === 1 ? (
        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {t(lang, 'campaignStatus')}: {statusLabel(lang, view === 'live' ? 'live' : view === 'preview' ? 'preview' : view)}
            </p>
            <LanguageToggle />
          </div>
          <h1 className="font-display mt-4 text-[1.85rem] text-ink sm:text-4xl">{title}</h1>
          <div className="mt-5 max-w-3xl space-y-4 text-base leading-relaxed text-body sm:text-lg">
            {description.split(/\n{2,}/).map((para) => (
              <p key={para.slice(0, 48)}>{para}</p>
            ))}
          </div>
          {deadline ? (
            <p className="mt-6 font-mono text-sm text-muted">
              {view === 'expired' ? t(lang, 'publicCommentsClosedOn') : t(lang, 'publicCommentsCloseOn')}{' '}
              <span className="text-ink">{deadline}</span>
              {view === 'live' && daysLeft !== null ? (
                <span className="ml-2 font-semibold text-accent">
                  {tReplace(lang, 'daysRemaining', { n: String(daysLeft) })}
                </span>
              ) : null}
            </p>
          ) : null}

          {view === 'inactive' ? (
            <p className="mt-8 rounded-[8px] border border-rule bg-raised px-4 py-4 text-base text-ink">
              {t(lang, 'campaignInactivePublic')}
            </p>
          ) : null}
          {view === 'expired' ? (
            <p className="mt-8 rounded-[8px] border border-rule bg-raised px-4 py-4 text-base text-ink">
              {t(lang, 'campaignExpiredThanks')}
            </p>
          ) : null}

          {actionable ? (
            <button type="button" className={cx(btnPrimary, 'mt-8 w-full sm:w-auto')} onClick={goConcern}>
              {t(lang, 'selectYourConcern')}
              <IconChevronRight className="size-4 shrink-0" />
            </button>
          ) : null}
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{t(lang, 'trustLine')}</p>
          <CampaignSources sources={sources} />
        </section>
      ) : null}

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
              lang={lang}
              fields={formFields}
              fieldKey="name"
              value={state.details.fullName}
              error={state.detailsErrors.fullName}
              onChange={(value) => dispatch({ type: 'set_details', details: { fullName: value } })}
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
              lang={lang}
              fields={formFields}
              fieldKey="phone"
              type="tel"
              value={state.details.phone}
              error={state.detailsErrors.phone}
              onChange={(value) => dispatch({ type: 'set_details', details: { phone: value } })}
              hint={t(lang, 'phoneHint')}
            />
            {isFieldEnabled(formFields, 'district') ? (
              <label className={labelClass}>
                {fieldByKey(formFields, 'district')?.[lang === 'en' ? 'label_en' : 'label_ml'] || t(lang, 'district')}
                {!isFieldRequired(formFields, 'district') ? <span className="font-normal text-muted"> ({t(lang, 'optional')})</span> : null}
                <select
                  className={inputClass}
                  value={state.details.district}
                  onChange={(event) => dispatch({ type: 'set_details', details: { district: event.target.value } })}
                >
                  <option value="">{t(lang, 'selectDistrict')}</option>
                  {districts.map((district) => (
                    <option key={district.value} value={district.value}>
                      {lang === 'en' ? district.labelEn : district.labelMl}
                    </option>
                  ))}
                </select>
                {state.detailsErrors.district ? <p className="mt-1 text-sm font-normal text-red-800">{state.detailsErrors.district}</p> : null}
              </label>
            ) : null}
            <Field
              lang={lang}
              fields={formFields}
              fieldKey="local_body"
              value={state.details.panchayat}
              error={state.detailsErrors.panchayat}
              onChange={(value) => dispatch({ type: 'set_details', details: { panchayat: value } })}
            />
            <Field
              lang={lang}
              fields={formFields}
              fieldKey="village"
              value={state.details.village}
              error={state.detailsErrors.village}
              onChange={(value) => dispatch({ type: 'set_details', details: { village: value } })}
            />
            <Field
              lang={lang}
              fields={formFields}
              fieldKey="address"
              value={state.details.addressLine}
              error={state.detailsErrors.addressLine}
              onChange={(value) => dispatch({ type: 'set_details', details: { addressLine: value } })}
              multiline
            />
            {isFieldEnabled(formFields, 'custom_message') ? (
              <label className={labelClass}>
                {fieldByKey(formFields, 'custom_message')?.[lang === 'en' ? 'label_en' : 'label_ml'] || t(lang, 'customText')}
                <span className="font-normal text-muted"> ({t(lang, 'optional')})</span>
                <textarea
                  className={`${inputClass} min-h-28 py-2`}
                  maxLength={MAX_CUSTOM_CHARS}
                  value={state.details.customText}
                  onChange={(event) => dispatch({ type: 'set_details', details: { customText: event.target.value } })}
                />
                {state.detailsErrors.customText ? (
                  <p className="mt-1 text-sm font-normal text-red-800">{state.detailsErrors.customText}</p>
                ) : null}
              </label>
            ) : null}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">{t(lang, 'consentNotice')}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" className={cx(btnGhost, 'w-full sm:w-auto')} onClick={() => dispatch({ type: 'goto', step: 2 })}>
              {t(lang, 'back')}
            </button>
            <button type="button" className={cx(btnPrimary, 'w-full sm:flex-1')} onClick={() => void goReview()}>
              {t(lang, 'continue')}
              <IconChevronRight className="size-4 shrink-0" />
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
  campaign: Campaign
  selected: ObjectionClause[]
  details: DetailsFields
  letter: CanonicalLetter
  mode: WizardMode
  onBack: () => void
  onContinue: () => void
}) {
  const { lang } = useLang()
  const targets = resolveMailTargets({ campaign, mode, testerEmail: details.email })
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
      {emlHint ? <p className="mt-3 text-sm text-ink">{t(lang, 'emlHint')}</p> : null}
      {copyState === 'failed' ? <p className="mt-2 text-sm text-red-800">{t(lang, 'copyFailed')}</p> : null}
      <button type="button" className={cx(btnGhost, 'mt-6')} onClick={onBack}>
        {t(lang, 'backAndEdit')}
      </button>
    </section>
  )
}

export function NoActiveCampaign() {
  const { lang } = useLang()
  return (
    <PageContainer>
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <h1 className="font-display mt-6 text-2xl text-ink sm:text-3xl">{t(lang, 'noActiveCampaignTitle')}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-body sm:text-lg">{t(lang, 'noActiveCampaign')}</p>
    </PageContainer>
  )
}
