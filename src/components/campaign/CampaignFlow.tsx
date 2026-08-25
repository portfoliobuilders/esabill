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
import {
  composeEmail,
  formatCompleteEmailCopy,
  resolveMailTargets,
  type MailComposeParams,
} from '@/lib/compose'
import { approvedAiBody, concernBody, concernShort, concernTitle } from '@/lib/compose-concerns'
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
import { launchMailCompose } from '@/lib/open-mail'
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

function statusLabel(lang: Lang, view: 'live' | 'preview' | 'inactive' | 'expired') {
  if (view === 'live') return t(lang, 'statusActive')
  if (view === 'expired') return t(lang, 'statusExpired')
  if (view === 'inactive') return t(lang, 'statusInactive')
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
  sources = [],
  aiConfigured = false,
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
  const router = useRouter()
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
  const [emlHint, setEmlHint] = useState(false)
  const [status, setStatus] = useState('')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [daysLeft, setDaysLeft] = useState(() => daysRemaining(campaign.deadline_at))
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

  useEffect(() => {
    setDaysLeft(daysRemaining(campaign.deadline_at))
    if (!campaign.deadline_at) return
    const timer = window.setInterval(() => {
      setDaysLeft(daysRemaining(campaign.deadline_at))
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [campaign.deadline_at])

  const title = pick(lang, campaign.title_ml, campaign.title_en)
  const description = pick(lang, campaign.homepage_intro_ml || campaign.summary_ml, campaign.homepage_intro_en || campaign.summary_en)
  const deadline = formatCampaignDate(campaign.deadline_at, lang)

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

  function validate(): boolean {
    const validity = validatePredefinedSelection({
      mode: config.mode,
      selectedIds,
      maxSelections: config.maxSelections,
    })
    if (validity !== 'ok') {
      setConcernError(true)
      return false
    }
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
        district: postalIdentity.district || details.district,
        pincode: details.pincode,
        language: lang,
        customText: '',
        extraConcerns: extras,
        clauseCodes: selected.map((clause) => clause.code),
        letterMode: 'selected',
        constituencyId: null,
        ccRepIds: [],
        privacyMode: privacyOn,
        postOffice: postalIdentity.postOffice,
        state: postalIdentity.state,
        postalRegion: postalIdentity.postalRegion,
        taluk: postalIdentity.taluk,
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

  async function sendMailto() {
    if (!validate()) return
    const params = mailParams()
    if (!params || params.to.length === 0) return
    setPasteHint(false)
    setEmlHint(false)
    const result = launchMailCompose(params, 'mail_app')
    setEmlHint(result === 'eml')
    await persistAndHandoff('mailto', false)
  }

  async function sendGmail() {
    if (!validate()) return
    const params = mailParams()
    if (!params || params.to.length === 0) return
    setPasteHint(false)
    setEmlHint(false)
    const plan = planGmailHandoff(
      params,
      clientPlatform(navigator.userAgent, navigator.maxTouchPoints),
      navigator.userAgent,
    )
    if (!plan.includeBody) {
      await copyPlainText(params.body).catch(() => undefined)
      setPasteHint(true)
    }
    applyGmailHandoff(plan)
    await persistAndHandoff('gmail_web', plan.openInNewTab && plan.includeBody)
  }

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

  return (
    <PageContainer>
      <StatusRegion message={status} />

      <section>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {t(lang, 'campaignStatus')}: {statusLabel(lang, view)}
        </p>
        <h1 lang={lang} className="font-display mt-4 text-[1.85rem] text-ink sm:text-4xl">
          {title}
        </h1>
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
              <span className="ml-2 font-semibold text-accent">{tReplace(lang, 'daysRemaining', { n: String(daysLeft) })}</span>
            ) : null}
          </p>
        ) : null}
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{t(lang, 'trustLine')}</p>
      </section>
      <CampaignSources sources={sources} />

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
                          <span className="font-mono text-xs font-semibold text-accent">
                            {String(index + 1).padStart(2, '0')}
                          </span>
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
                        <span className="mt-2 block text-sm leading-relaxed text-body sm:text-base">
                          {expanded ? full : short}
                        </span>
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
              id="full-name"
              label={labelForField(formFields, 'name', lang, t(lang, 'fullName'))}
              required={isFieldRequired(formFields, 'name')}
              value={details.fullName}
              error={errors.fullName}
              autoComplete="name"
              onChange={(value) => patchDetails({ fullName: value })}
              voice={showVoice ? { lang, onStatus: setStatus } : null}
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
                  <p className="font-semibold text-accent">✓ {locationLine}</p>
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
                          onChange={(event) => {
                            const name = event.target.value
                            setOfficeName(name)
                            setDetails((prev) => detailsFromLookup(prev, lookup, name))
                          }}
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
          ) : null}

          {isFieldEnabled(formFields, 'district') && !privacyOn ? (
            <label htmlFor="district" className={labelClass}>
              {labelForField(formFields, 'district', lang, t(lang, 'district'))}
              {!isFieldRequired(formFields, 'district') ? (
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
          {pasteHint ? <p className="text-sm text-ink">{t(lang, 'mailtoTooLong')}</p> : null}
          {emlHint ? <p className="text-sm text-ink">{t(lang, 'emlHint')}</p> : null}
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
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
          {required ? <span className="text-accent"> *</span> : <span className="font-normal text-muted"> ({t(lang, 'optional')})</span>}
        </label>
        {voice ? (
          <VoiceInputButton lang={voice.lang} fieldId={id} value={value} onChange={onChange} onStatus={voice.onStatus} />
        ) : null}
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
      <h1 className="font-display mt-6 text-2xl text-ink sm:text-3xl">{t(lang, 'noActiveCampaignTitle')}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-body sm:text-lg">{t(lang, 'noActiveCampaign')}</p>
    </PageContainer>
  )
}
