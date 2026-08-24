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
import {
  androidSendIntent,
  composeEmail,
  formatCompleteEmailCopy,
  gmailComposeUrl,
  gmailUrlTooLong,
  mailtoUrl,
  mailtoUrlTooLong,
  resolveMailTargets,
  type MailComposeParams,
} from '@/lib/compose'
import { approvedAiBody, concernBody, concernShort, concernTitle } from '@/lib/compose-concerns'
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
import {
  compactLocationLine,
  isValidPincode,
  withPostalIdentity,
  postalIdentityFromLookup,
  type PostalLookup,
} from '@/lib/postal'
import { btnGhost, btnPrimary, btnSecondary, focusRing, inputClass, labelClass } from '@/lib/ui'
import type { WizardMode } from '@/lib/wizard-mode'
import { isDryRun } from '@/lib/wizard-mode'
import type { Campaign, CampaignFormField, CampaignSource, ObjectionClause } from '@/types/database'

function pick(lang: Lang, ml: string, en: string) {
  return lang === 'en' ? en : ml
}

function statusLabel(lang: Lang, mode: WizardMode | 'inactive' | 'expired') {
  if (mode === 'live') return t(lang, 'statusActive')
  if (mode === 'expired' || mode === 'demo') return t(lang, 'statusExpired')
  if (mode === 'inactive') return t(lang, 'statusInactive')
  return t(lang, 'statusDraft')
}

const pinCache = new Map<string, PostalLookup>()

function detailsFromLookup(prev: DetailsFields, lookup: PostalLookup | null, office: string): DetailsFields {
  const next = withPostalIdentity(prev, postalIdentityFromLookup(lookup, office))
  if (
    next.district === prev.district &&
    next.postOffice === prev.postOffice &&
    next.state === prev.state &&
    next.postalRegion === prev.postalRegion &&
    next.taluk === prev.taluk
  ) {
    return prev
  }
  return next
}

export function CampaignFlow({
  campaign,
  clauses,
  formFields,
  districts,
  mode,
  view,
  aiConfigured = false,
  sources = [],
}: {
  campaign: Campaign
  clauses: ObjectionClause[]
  formFields: CampaignFormField[]
  districts: DistrictOption[]
  mode: WizardMode
  view: 'live' | 'preview' | 'inactive' | 'expired'
  aiConfigured?: boolean
  sources?: CampaignSource[]
  aiConfigured?: boolean
}) {
  const { lang } = useLang()
  const actionable = view === 'live' || view === 'preview'
  const config = campaignConcernConfig(campaign)
  const features = parseFeatureSettings(campaign.feature_settings)
  const multi = isMultiSelect(config.mode)
  const customCopy = customConcernCopy(config, lang)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customConcern, setCustomConcern] = useState('')
  const [details, setDetails] = useState<DetailsFields>(emptyDetails)
  const [privacyMode, setPrivacyMode] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [concernError, setConcernError] = useState(false)
  const [lookup, setLookup] = useState<PostalLookup | null>(null)
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [officeName, setOfficeName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [improved, setImproved] = useState<{ concernId: string; body: string } | null>(null)
  const [improving, setImproving] = useState(false)
  const [aiError, setAiError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [pasteHint, setPasteHint] = useState(false)
  const [status, setStatus] = useState('')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const aiAbort = useRef<AbortController | null>(null)

  const privacyOn = privacyMode && features.allow_privacy_mode
  const selected = selectedClausesForLetter(clauses, selectedIds)
  const extras = useMemo(
    () => (config.allowCustomConcern ? flattenCustomConcerns([customConcern]) : []),
    [config.allowCustomConcern, customConcern],
  )
  const postalIdentity = useMemo(
    () => (privacyOn ? postalIdentityFromLookup(null) : postalIdentityFromLookup(lookup, officeName)),
    [privacyOn, lookup, officeName],
  )

  const clausesForMail = useMemo(() => {
    if (!improved) return selected
    return selected.map((clause) =>
      clause.id === improved.concernId
        ? {
            ...clause,
            email_body_en: improved.body,
            email_body_ml: improved.body,
            email_en: improved.body,
            email_ml: improved.body,
            full_text_en: improved.body,
            full_text_ml: improved.body,
          }
        : clause,
    )
  }, [selected, improved])

  const letter = useMemo(() => {
    if (selected.length === 0) return null
    return composeEmail({
      campaign,
      clauses: clausesForMail,
      details: {
        ...withPostalIdentity(details, postalIdentity),
        extraConcerns: extras,
        customText: '',
        privacyMode: privacyOn,
      },
      lang,
    })
  }, [campaign, clausesForMail, details, extras, lang, postalIdentity, privacyOn, selected.length])

  useEffect(() => {
    if (!features.enable_pin_lookup || privacyOn) return
    const pin = details.pincode.trim()
    if (!isValidPincode(pin)) {
      setLookup(null)
      setLookupState('idle')
      setOfficeName('')
      setDetails((prev) => detailsFromLookup(prev, null, ''))
      return
    }
    const cached = pinCache.get(pin)
    if (cached) {
      const office = cached.common.postOffice || ''
      setLookup(cached)
      setLookupState('done')
      setOfficeName(office)
      setDetails((prev) => detailsFromLookup(prev, cached, office))
      setStatus(compactLocationLine(cached.common) || t(lang, 'locationStatus'))
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLookupState('loading')
    setStatus(t(lang, 'findingLocation'))
    fetch(`/api/pincode/${pin}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: PostalLookup) => {
        pinCache.set(pin, data)
        const office = data.common.postOffice || ''
        setLookup(data)
        setLookupState('done')
        setOfficeName(office)
        setDetails((prev) => detailsFromLookup(prev, data, office))
        if (data.found) setStatus(compactLocationLine(data.common) || t(lang, 'locationStatus'))
        else setStatus(t(lang, 'pinNotFound'))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLookupState('done')
        setLookup(null)
        setStatus(t(lang, 'pinNotFound'))
      })
    return () => controller.abort()
  }, [details.pincode, features.enable_pin_lookup, lang, privacyOn])

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

  function selectConcern(id: string) {
    const next = applyPredefinedConcernClick({
      mode: config.mode,
      selectedIds,
      id,
      maxSelections: config.maxSelections,
    })
    setSelectedIds(next.selectedIds)
    setConcernError(false)
    setImproved(null)
    setAiError('')
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
        district: postalIdentity.district || details.district,
        pincode: details.pincode,
        language: lang,
        customText: details.customText,
        extraConcerns,
        clauseCodes: selected.map((clause) => clause.code),
        constituencyId: null,
        ccRepIds: [],
        privacyMode: privacyOn,
        postOffice: postalIdentity.postOffice,
        state: postalIdentity.state,
        postalRegion: postalIdentity.postalRegion,
        taluk: postalIdentity.taluk,
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

  async function sendMailto() {
    if (!validate()) return
    const params = mailParams()
    if (!params || params.to.length === 0) return
    setPasteHint(false)
    const ua = navigator.userAgent
    if (/Android/i.test(ua)) {
      await copyPlainText(params.body).catch(() => undefined)
      window.location.href = androidSendIntent(params, { fallbackUrl: mailtoUrl(params, { includeBody: false }) })
      await persistAndHandoff('mailto', false)
      return
    }
    if (mailtoUrlTooLong(params)) {
      await copyPlainText(params.body).catch(() => undefined)
      window.location.href = mailtoUrl(params, { includeBody: false })
      setPasteHint(true)
      await persistAndHandoff('mailto', false)
      return
    }
    window.location.href = mailtoUrl(params)
    await persistAndHandoff('mailto', false)
  }

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

      {actionable ? (
        <form
          className="mt-10 min-w-0 space-y-8"
          lang={lang}
          onSubmit={(event) => {
            event.preventDefault()
            void sendMailto()
          }}
        >
          <fieldset>
            <legend className="font-display text-2xl text-ink">{t(lang, 'chooseYourConcern')}</legend>
            <p className="mt-2 text-base text-body">{multi ? t(lang, 'concernsLeadMultiple') : t(lang, 'concernsLead')}</p>
            <ul className="mt-5 space-y-3">
              {clauses.map((clause, index) => {
                const on = selectedIds.includes(clause.id)
                const expanded = expandedId === clause.id
                const short = concernShort(clause, lang)
                const full = concernBody(clause, lang)
                const needsMore = full.length > short.length + 8
                return (
                  <li key={clause.id}>
                    <label
                      className={cx(
                        'flex min-h-11 cursor-pointer gap-3 rounded-[10px] border p-4',
                        on ? 'border-accent bg-accent-tint' : 'border-rule bg-raised',
                      )}
                    >
                      <input
                        type={multi ? 'checkbox' : 'radio'}
                        name="campaign-concern"
                        className="mt-1 size-6 shrink-0 accent-[var(--color-accent)]"
                        checked={on}
                        onChange={() => selectConcern(clause.id)}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-accent">{String(index + 1).padStart(2, '0')}</span>
                          {on ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
                              <IconCheck className="size-4" />
                              {t(lang, 'selectedVisible')}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-base font-semibold leading-snug text-ink sm:text-lg">
                          {concernTitle(clause, lang)}
                        </span>
                        <span className="mt-2 block text-sm leading-relaxed text-body sm:text-base">{expanded ? full : short}</span>
                        {needsMore ? (
                          <button
                            type="button"
                            className={cx('mt-2 min-h-11 text-sm font-semibold text-accent', focusRing)}
                            onClick={(event) => {
                              event.preventDefault()
                              setExpandedId(expanded ? null : clause.id)
                            }}
                          >
                            {expanded ? t(lang, 'readLess') : t(lang, 'readMore')}
                          </button>
                        ) : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {concernError ? (
              <p className="mt-3 text-sm text-red-800" role="alert">
                {multi ? t(lang, 'minClausesHintMultiple') : t(lang, 'minClausesHint')}
              </p>
            ) : null}
          </p>
        ) : null}
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{t(lang, 'trustLine')}</p>
        <CampaignSources sources={sources} />
      </section>

      {view === 'inactive' ? (
        <p className="mt-8 rounded-[8px] border border-rule bg-raised px-4 py-4 text-base text-ink">{t(lang, 'campaignInactivePublic')}</p>
      ) : null}
      {view === 'expired' ? (
        <p className="mt-8 rounded-[8px] border border-rule bg-raised px-4 py-4 text-base text-ink">{t(lang, 'campaignExpiredThanks')}</p>
      ) : null}

      {actionable ? (
        <form
          className="mt-10 min-w-0 space-y-8"
          lang={lang}
          onSubmit={(event) => {
            event.preventDefault()
            void sendMailto()
          }}
        >
          <fieldset>
            <legend className="font-display text-2xl text-ink">{t(lang, 'chooseYourConcern')}</legend>
            <p className="mt-2 text-base text-body">{multi ? t(lang, 'concernsLeadMultiple') : t(lang, 'concernsLead')}</p>
            <ul className="mt-5 space-y-3">
              {clauses.map((clause, index) => {
                const on = selectedIds.includes(clause.id)
                const expanded = expandedId === clause.id
                const short = concernShort(clause, lang)
                const full = concernBody(clause, lang)
                const needsMore = full.length > short.length + 8
                return (
                  <li key={clause.id}>
                    <label
                      className={cx(
                        'flex min-h-11 cursor-pointer gap-3 rounded-[10px] border p-4',
                        on ? 'border-accent bg-accent-tint' : 'border-rule bg-raised',
                      )}
                    >
                      <input
                        type={multi ? 'checkbox' : 'radio'}
                        name="campaign-concern"
                        className="mt-1 size-6 shrink-0 accent-[var(--color-accent)]"
                        checked={on}
                        onChange={() => selectConcern(clause.id)}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-accent">{String(index + 1).padStart(2, '0')}</span>
                          {on ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
                              <IconCheck className="size-4" />
                              {t(lang, 'selectedVisible')}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-base font-semibold leading-snug text-ink sm:text-lg">
                          {concernTitle(clause, lang)}
                        </span>
                        <span className="mt-2 block text-sm leading-relaxed text-body sm:text-base">{expanded ? full : short}</span>
                        {needsMore ? (
                          <button
                            type="button"
                            className={cx('mt-2 min-h-11 text-sm font-semibold text-accent', focusRing)}
                            onClick={(event) => {
                              event.preventDefault()
                              setExpandedId(expanded ? null : clause.id)
                            }}
                          >
                            {expanded ? t(lang, 'readLess') : t(lang, 'readMore')}
                          </button>
                        ) : null}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {concernError ? (
              <p className="mt-3 text-sm text-red-800" role="alert">
                {multi ? t(lang, 'minClausesHintMultiple') : t(lang, 'minClausesHint')}
              </p>
            ) : null}
          </fieldset>

          {config.allowCustomConcern ? (
            <div>
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="custom-concern" className={labelClass}>
                  {customCopy.label || t(lang, 'moreToSay')}
                  <span className="font-normal text-muted"> ({t(lang, 'optional')})</span>
                </label>
                {showVoice ? (
                  <VoiceInputButton
                    lang={lang}
                    fieldId="custom-concern"
                    value={customConcern}
                    onChange={setCustomConcern}
                    onStatus={setStatus}
                  />
                ) : null}
              </div>
              <textarea
                id="custom-concern"
                className={`${inputClass} min-h-28 resize-y py-2`}
                maxLength={MAX_CUSTOM_CHARS}
                value={customConcern}
                placeholder={customCopy.placeholder}
                onChange={(event) => setCustomConcern(event.target.value)}
              />
            </div>
          ) : null}

          {isFieldEnabled(formFields, 'name') && !privacyOn ? (
            <Field
              lang={lang}
              fields={formFields}
              fieldKey="name"
              value={state.details.fullName}
              error={state.detailsErrors.fullName}
              onChange={(value) => dispatch({ type: 'set_details', details: { fullName: value } })}
            />
          ) : null}

          {isFieldEnabled(formFields, 'pincode') && !privacyOn ? (
            <div>
              <label htmlFor="pincode" className={labelClass}>
                {labelForField(formFields, 'pincode', lang, t(lang, 'pincode'))}
                {isFieldRequired(formFields, 'pincode') ? (
                  <span className="text-accent"> *</span>
                ) : (
                  <span className="font-normal text-muted"> ({t(lang, 'optional')})</span>
                )}
              </label>
              <input
                id="pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                pattern="[1-9][0-9]{5}"
                maxLength={6}
                className={inputClass}
                value={details.pincode}
                aria-required={isFieldRequired(formFields, 'pincode')}
                aria-invalid={Boolean(errors.pincode)}
                aria-describedby={errors.pincode ? 'pincode-error' : lookupState !== 'idle' ? 'pincode-status' : undefined}
                onChange={(event) => patchDetails({ pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
              {lookupState === 'loading' ? (
                <p id="pincode-status" className="mt-2 text-sm text-muted">
                  {t(lang, 'findingLocation')}
                </p>
              ) : lookup?.found ? (
                <div id="pincode-status" className="mt-2 text-sm text-ink">
                  <p className="font-semibold text-accent">
                    ✓ {locationLine}
                  </p>
                  {lookup.common.postOffice || lookup.common.region ? (
                    <p className="mt-1 text-body">
                      {lookup.common.postOffice ? `${lookup.common.postOffice}` : ''}
                      {lookup.common.postOffice && lookup.common.region ? ' · ' : ''}
                      {lookup.common.region ? `${t(lang, 'postalRegion')}: ${lookup.common.region}` : ''}
                    </p>
                  ) : null}
                  {lookup.askPostOffice ? (
                    <div className="mt-3">
                      <p className="text-body">{t(lang, 'multiplePostOffices')}</p>
                      <label htmlFor="post-office" className={`${labelClass} mt-2`}>
                        {t(lang, 'postOffice')}
                        <select
                          id="post-office"
                          className={inputClass}
                          value={officeName}
                          onChange={(event) => setOfficeName(event.target.value)}
                        >
                          <option value="">{t(lang, 'selectPostOffice')}</option>
                          {lookup.offices.map((office) => (
                            <option key={office.officeName} value={office.officeName}>
                              {office.officeName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : lookupState === 'done' && isValidPincode(details.pincode) ? (
                <p id="pincode-status" className="mt-2 text-sm text-muted">
                  {t(lang, 'pinNotFound')}
                </p>
              ) : null}
              {errors.pincode ? (
                <p id="pincode-error" className="mt-1 text-sm text-red-800" role="alert">
                  {errors.pincode}
                </p>
              ) : null}
            </div>
          ) : null}

          {isFieldEnabled(formFields, 'phone') && !privacyOn ? (
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
          ) : null}

          {isFieldEnabled(formFields, 'district') && !privacyOn ? (
            <label htmlFor="district" className={labelClass}>
              {labelForField(formFields, 'district', lang, t(lang, 'district'))}
              {!isFieldRequired(formFields, 'district') ? (
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
          {pasteHint ? <p className="text-sm text-ink">{t(lang, 'pasteHint')}</p> : null}
          {copyState === 'failed' ? <p className="text-sm text-red-800">{t(lang, 'copyFailed')}</p> : null}
        </form>
      ) : null}
    </PageContainer>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = 'text',
  multiline,
  autoComplete,
  inputMode,
  voice,
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
