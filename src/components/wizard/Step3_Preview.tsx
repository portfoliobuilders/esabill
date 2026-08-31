'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { markHandoff } from '@/app/actions/submission'
import { IconCopy, IconEnvelope, IconGmail } from '@/components/ui/icons'
import { useLang } from '@/components/LanguageProvider'
import {
  composeEmail,
  formatCompleteEmailCopy,
  resolveMailTargets,
  withRepresentativeCc,
  type MailComposeParams,
} from '@/lib/compose'
import { cx } from '@/lib/cx'
import type { DetailsFields } from '@/lib/details-schema'
import { t } from '@/lib/i18n'
import { launchMailCompose } from '@/lib/open-mail'
import { PDF_LETTER_AVAILABLE } from '@/lib/pdf-available'
import { normalizeIndianPhone } from '@/lib/phone'
import { btnGhost, btnPrimary, btnSecondary } from '@/lib/ui'
import { isDryRun, type WizardMode } from '@/lib/wizard-mode'
import type { Campaign, ObjectionClause, WizardRouting } from '@/types/database'

export type CanonicalLetter = {
  subject: string
  body: string
}

const mailBtn = 'min-h-12 w-full'

async function copyPlainText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.left = '0'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.focus()
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    if (!ok) throw new Error('copy failed')
  }
}

function hasIdentity(details: DetailsFields): boolean {
  return Boolean(
    details.fullName.trim() &&
      details.email.trim() &&
      details.phone.trim() &&
      details.addressLine.trim() &&
      details.district.trim(),
  )
}

export function Step3_Preview({
  campaign,
  clauses,
  details,
  routing,
  submissionId,
  mode,
  testerEmail,
  canonicalLetter,
  extraConcerns,
  onEditDetails,
  onEditObjections,
}: {
  campaign: Campaign
  clauses: ObjectionClause[]
  details: DetailsFields
  routing: WizardRouting
  submissionId: string | null
  mode: WizardMode
  testerEmail: string | null
  canonicalLetter: CanonicalLetter | null
  extraConcerns: string[]
  onEditDetails: () => void
  onEditObjections: () => void
}) {
  const { lang } = useLang()
  const router = useRouter()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [emlHint, setEmlHint] = useState(false)

  const local = useMemo(() => {
    return composeEmail({
      campaign,
      clauses,
      details: {
        fullName: details.fullName,
        addressLine: details.addressLine,
        panchayat: details.panchayat,
        village: details.village,
        district: details.district,
        pincode: details.pincode,
        phone: normalizeIndianPhone(details.phone) ?? details.phone,
        email: details.email,
        customText: details.customText,
        extraConcerns,
        postOffice: details.postOffice,
        state: details.state,
        postalRegion: details.postalRegion,
        taluk: details.taluk,
      },
      lang,
    })
  }, [campaign, clauses, details, extraConcerns, lang])

  const subject = canonicalLetter?.subject ?? local.subject
  const body = canonicalLetter?.body ?? local.body
  const dryRun = isDryRun(mode)
  const testerTo = (testerEmail ?? details.email).trim()

  const optedIn =
    !dryRun &&
    routing.ccMla &&
    routing.constituencyId !== null &&
    Boolean(routing.representative?.official_email?.trim()) &&
    routing.representative !== null &&
    routing.ccRepresentativeIds.includes(routing.representative.id)

  const targets = resolveMailTargets({
    campaign,
    mode,
    testerEmail: testerTo,
  })

  const mailParams: MailComposeParams = withRepresentativeCc(
    {
      to: targets.to,
      cc: targets.cc,
      bcc: targets.bcc,
      subject,
      body,
    },
    routing.representative?.official_email,
    optedIn,
  )

  const identityReady = hasIdentity(details)
  const sendDisabled = !identityReady || mailParams.to.length === 0
  const completeCopy = formatCompleteEmailCopy(mailParams)

  async function recordHandoff(method: 'gmail_web' | 'mailto' | 'copy', goSent: boolean) {
    if (!submissionId) return
    await markHandoff(submissionId, method)
    if (goSent) router.push(`/sent?id=${submissionId}`)
  }

  async function copyComplete() {
    try {
      await copyPlainText(completeCopy)
      setCopyState('copied')
      await recordHandoff('copy', true)
    } catch {
      setCopyState('failed')
    }
  }

  function openGmail() {
    setEmlHint(false)
    const result = launchMailCompose(mailParams, 'gmail')
    setEmlHint(result === 'eml')
    void recordHandoff('gmail_web', result === 'gmail_tab')
  }

  function openMailApp() {
    setEmlHint(false)
    const result = launchMailCompose(mailParams, 'mail_app')
    setEmlHint(result === 'eml')
    void recordHandoff('mailto', false)
  }

  return (
    <div className="overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">{t(lang, 'letterTitle')}</h1>
          <p className="mt-2 text-base leading-relaxed text-body">{t(lang, 'letterSupport')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button type="button" onClick={onEditDetails} className={cx(btnGhost, 'shrink-0 self-start sm:self-end')}>
            {t(lang, 'editDetails')}
          </button>
          <button type="button" onClick={onEditObjections} className={cx(btnGhost, 'shrink-0 self-start sm:self-end')}>
            {t(lang, 'editObjections')}
          </button>
        </div>
      </div>
      {dryRun ? <p className="mt-3 text-base leading-relaxed text-amber-900">{t(lang, 'demoLetterHint')}</p> : null}

      <section className="mt-5 space-y-4 rounded-[8px] border border-rule bg-raised p-4">
        <div>
          <h2 className="text-base font-semibold text-ink">
            {campaign.concern_selection_mode === 'multiple'
              ? t(lang, 'selectedConcernsHeading')
              : t(lang, 'selectedConcernHeading')}
          </h2>
          {clauses.length === 0 ? (
            <p className="mt-2 text-sm text-muted">—</p>
          ) : campaign.concern_selection_mode === 'multiple' ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-body sm:text-base">
              {clauses.map((clause) => (
                <li key={clause.id} className="break-words">
                  {lang === 'en' ? clause.title_en : clause.title_ml}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 break-words text-sm leading-relaxed text-body sm:text-base">
              {lang === 'en' ? clauses[0].title_en : clauses[0].title_ml}
            </p>
          )}
        </div>
        {extraConcerns.length > 0 ? (
          <div>
            <h2 className="text-base font-semibold text-ink">{t(lang, 'yourAdditionalConcern')}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-body sm:text-base">
              {extraConcerns.map((text, index) => (
                <p key={`extra-${index}`} className="break-words whitespace-pre-wrap">
                  {text}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <dl className="mt-5 space-y-3 text-sm sm:text-base">
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'toLabel')}</dt>
          <dd className="mt-1 select-all break-all text-body">
            {mailParams.to.map((email) => (
              <div key={email}>{email}</div>
            ))}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'ccLabel')}</dt>
          <dd className="mt-1 select-all break-all text-body">
            {mailParams.cc.length > 0 ? mailParams.cc.map((email) => <div key={email}>{email}</div>) : '—'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t(lang, 'subjectLabel')}</dt>
          <dd className="mt-1 break-words text-body">{mailParams.subject}</dd>
        </div>
      </dl>

      {dryRun && (targets.liveTo.length > 0 || targets.liveCc.length > 0) ? (
        <div className="mt-4 rounded-[8px] border border-rule bg-raised p-3 text-sm leading-relaxed text-body">
          <p className="font-medium text-ink">{t(lang, 'liveRecipientsNote')}</p>
          <p className="mt-2 break-all">
            {t(lang, 'toLabel')}: {targets.liveTo.join(', ')}
          </p>
          {targets.liveCc.length > 0 ? (
            <p className="break-all">
              {t(lang, 'ccLabel')}: {targets.liveCc.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <pre
        className={cx(
          'mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-rule bg-raised p-4 text-sm leading-relaxed text-ink sm:text-base',
          lang === 'en' && 'font-serif',
        )}
      >
        {body}
      </pre>

      <p className="mt-5 text-sm leading-relaxed text-muted">{t(lang, 'trustLine')}</p>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          disabled={sendDisabled}
          onClick={() => void openGmail()}
          className={cx(btnPrimary, mailBtn)}
        >
          <IconGmail className="size-5 shrink-0" />
          {dryRun ? t(lang, 'dryRunGmail') : t(lang, 'sendGmail')}
        </button>

        <button
          type="button"
          disabled={sendDisabled}
          onClick={() => void openMailApp()}
          className={cx(btnSecondary, mailBtn)}
        >
          <IconEnvelope className="size-4 shrink-0" />
          {dryRun ? t(lang, 'dryRunMailto') : t(lang, 'sendMailto')}
        </button>

        <button type="button" disabled={sendDisabled} onClick={() => void copyComplete()} className={cx(btnGhost, mailBtn)}>
          <IconCopy className="size-4 shrink-0" />
          {copyState === 'copied' ? t(lang, 'copied') : t(lang, 'copyCompleteEmail')}
        </button>
      </div>

      {emlHint ? (
        <p className="mt-3 text-sm leading-relaxed text-ink" role="status">
          {t(lang, 'emlHint')}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {copyState === 'copied' ? t(lang, 'copied') : copyState === 'failed' ? t(lang, 'copyFailed') : ''}
      </p>
      {copyState === 'failed' ? <p className="mt-2 text-sm text-red-800">{t(lang, 'copyFailed')}</p> : null}

      <button
        type="button"
        disabled={!PDF_LETTER_AVAILABLE || sendDisabled}
        title={t(lang, 'pdfUnavailable')}
        className={cx(btnGhost, 'mt-3 w-full sm:w-auto', (!PDF_LETTER_AVAILABLE || sendDisabled) && 'opacity-50')}
      >
        {t(lang, 'downloadPdf')}
      </button>
    </div>
  )
}
