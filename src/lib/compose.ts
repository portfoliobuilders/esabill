import { concernTitle } from '@/lib/compose-concerns'
import { uniqueEmails } from '@/lib/compose-emails'
import { identityBlock, locationBlock, privacyLetter } from '@/lib/compose-identity'
import { campaignConcernConfig, formatConcernsForEmail, selectedClausesForLetter } from '@/lib/concern-selection'
import { collapseBlankLines, defaultBodyTemplate, renderSafeTemplate, type EmailTemplateValues } from '@/lib/email-template'
import type { Lang } from '@/lib/i18n'
import type { WizardMode } from '@/lib/wizard-mode'
import type { Campaign, ObjectionClause } from '@/types/database'

export { uniqueEmails } from '@/lib/compose-emails'
export { concernBody, concernShort, concernTitle } from '@/lib/compose-concerns'

export const MAX_BODY_CHARS = 1500
export const URL_LENGTH_WARN = 1900
export const GMAIL_URL_WARN = 8192
/** Windows ShellExecute / mailto practical cap. Unicode letters percent-encode to ~9x. */
export const MAILTO_URL_WARN = 30_000

const GMAIL_ANDROID_PACKAGE = 'com.google.android.gm'

export type ComposeDetails = {
  fullName: string
  addressLine: string
  panchayat: string
  village?: string
  district: string
  pincode: string
  phone: string
  email: string
  customText?: string
  extraConcerns?: string[]
  postOffice?: string
  state?: string
  postalRegion?: string
  taluk?: string
  privacyMode?: boolean
}

export type ComposeEmailInput = {
  campaign: Campaign
  clauses: ObjectionClause[]
  details: ComposeDetails
  lang: Lang
}

export type ComposeEmailResult = {
  subject: string
  body: string
  charCount: number
  error: 'too_long' | null
}

export type MailComposeParams = {
  to: string[]
  cc: string[]
  bcc?: string[]
  subject: string
  body: string
}

export type ResolvedMailTargets = {
  to: string[]
  cc: string[]
  bcc: string[]
  dryRun: boolean
  liveTo: string[]
  liveCc: string[]
  liveBcc: string[]
}

export function charCount(text: string): number {
  return [...text].length
}

function pick(lang: Lang, ml: string, en: string): string {
  return lang === 'en' ? en : ml
}

export function campaignRecipientEmails(campaign: Campaign): string[] {
  const fromArray = Array.isArray(campaign.recipient_emails) ? campaign.recipient_emails : []
  if (fromArray.length > 0) return uniqueEmails(fromArray)
  return uniqueEmails([campaign.recipient_email])
}

export function campaignCcEmails(campaign: Campaign): string[] {
  return uniqueEmails(campaign.cc_emails ?? [])
}

export function campaignBccEmails(campaign: Campaign): string[] {
  return uniqueEmails(campaign.bcc_emails ?? [])
}

export function liveMailTargets(campaign: Campaign): { to: string[]; cc: string[]; bcc: string[] } {
  let to = campaignRecipientEmails(campaign)
  const bcc = campaignBccEmails(campaign)
  const toKeys = new Set(to.map((email) => email.toLowerCase()))
  let cc = campaignCcEmails(campaign).filter((email) => !toKeys.has(email.toLowerCase()))
  if (to.length === 0 && cc.length > 0) {
    to = cc
    cc = []
  }
  const seen = new Set([...to, ...cc].map((email) => email.toLowerCase()))
  return {
    to,
    cc,
    bcc: bcc.filter((email) => !seen.has(email.toLowerCase())),
  }
}

export function resolveMailTargets({
  campaign,
  mode,
  testerEmail,
}: {
  campaign: Campaign
  mode: WizardMode
  testerEmail: string
}): ResolvedMailTargets {
  const live = liveMailTargets(campaign)
  if (mode === 'live') {
    return {
      to: live.to,
      cc: live.cc,
      bcc: live.bcc,
      dryRun: false,
      liveTo: live.to,
      liveCc: live.cc,
      liveBcc: live.bcc,
    }
  }
  const tester = uniqueEmails([testerEmail])
  return {
    to: tester.length > 0 ? tester : live.to,
    cc: tester.length > 0 ? [] : live.cc,
    bcc: [],
    dryRun: true,
    liveTo: live.to,
    liveCc: live.cc,
    liveBcc: live.bcc,
  }
}

export function clausesForLetter(clauses: ObjectionClause[], selectedIds: string[]): ObjectionClause[] {
  return selectedClausesForLetter(clauses, selectedIds)
}

function identityFromDetails(details: ComposeDetails) {
  return {
    fullName: details.fullName,
    pincode: details.pincode,
    phone: details.phone,
    addressLine: details.addressLine,
    postOffice: details.postOffice,
    district: details.district,
    state: details.state,
    postalRegion: details.postalRegion,
    taluk: details.taluk,
  }
}

function senderValues(
  details: ComposeDetails,
  lang: Lang,
): Pick<
  EmailTemplateValues,
  | 'full_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'panchayat'
  | 'village'
  | 'district'
  | 'pincode'
  | 'constituency'
  | 'custom_text'
  | 'post_office'
  | 'state'
  | 'postal_region'
  | 'identity_block'
  | 'location_block'
> {
  return {
    full_name: details.fullName,
    email: details.email,
    phone: details.phone,
    address: details.addressLine,
    panchayat: details.panchayat,
    village: details.village ?? '',
    district: details.district,
    pincode: details.pincode,
    constituency: '',
    custom_text: (details.customText ?? '').trim(),
    post_office: details.postOffice ?? '',
    state: details.state ?? '',
    postal_region: details.postalRegion ?? '',
    identity_block: identityBlock(identityFromDetails(details), lang),
    location_block: locationBlock(identityFromDetails(details), lang),
  }
}

function withEnteredPinLocation(body: string, details: ComposeDetails, lang: Lang): string {
  const pin = details.pincode.trim()
  if (!pin || details.privacyMode) return body
  if (body.includes(pin)) return body
  const block = locationBlock(identityFromDetails({ ...details, pincode: pin }), lang)
  if (!block) return body
  return collapseBlankLines(`${body}\n\n${block}`)
}

export function composeSubject(campaign: Campaign, clauses: ObjectionClause[], lang: Lang): string {
  if (clauses.length === 1) {
    const custom = pick(lang, clauses[0].email_subject_ml ?? '', clauses[0].email_subject_en ?? '').trim()
    if (custom) return custom
    const title = concernTitle(clauses[0], lang)
    if (title) return title
  }
  return pick(lang, campaign.subject_ml, campaign.subject_en)
}

function assembleBody(
  campaign: Campaign,
  clauses: ObjectionClause[],
  details: ComposeDetails,
  lang: Lang,
): string {
  if (details.privacyMode) {
    return privacyLetter({
      campaign,
      clauses,
      extraConcerns: details.extraConcerns ?? [],
      lang,
    })
  }

  const intro = pick(lang, campaign.intro_ml, campaign.intro_en)
  const closing = pick(lang, campaign.closing_ml, campaign.closing_en)
  const extras = details.extraConcerns ?? []
  const stored = pick(lang, campaign.body_template_ml ?? '', campaign.body_template_en ?? '').trim()
  const template = stored || defaultBodyTemplate(lang)
  const config = campaignConcernConfig(campaign)
  const values: EmailTemplateValues = {
    intro,
    closing,
    concerns: formatConcernsForEmail({
      mode: config.mode,
      clauses,
      extraConcerns: extras,
      lang,
    }),
    ...senderValues(details, lang),
  }
  return withEnteredPinLocation(renderSafeTemplate(template, values), details, lang)
}

export function composeEmail({ campaign, clauses, details, lang }: ComposeEmailInput): ComposeEmailResult {
  const subject = composeSubject(campaign, clauses, lang)
  const body = assembleBody(campaign, clauses, details, lang)
  return { subject, body, charCount: charCount(body), error: null }
}

function encodePairs(pairs: Array<[string, string]>): string {
  return pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
}

function toHeader(to: string[]): string {
  return uniqueEmails(to).join(',')
}

function ccHeader(cc: string[]): string {
  return uniqueEmails(cc).join(',')
}

function bccHeader(bcc: string[] | undefined): string {
  return uniqueEmails(bcc ?? []).join(',')
}

export function gmailComposeUrl(params: MailComposeParams, options?: { includeBody?: boolean }): string {
  const to = toHeader(params.to)
  const cc = ccHeader(params.cc)
  const bcc = bccHeader(params.bcc)
  const pairs: Array<[string, string]> = [
    ['view', 'cm'],
    ['fs', '1'],
    ['to', to],
  ]
  if (cc) pairs.push(['cc', cc])
  if (bcc) pairs.push(['bcc', bcc])
  pairs.push(['su', params.subject])
  if (options?.includeBody !== false) pairs.push(['body', params.body])
  return `https://mail.google.com/mail/?${encodePairs(pairs)}`
}

/** Gmail app compose URL (iOS and Android). Same to/cc/subject/body as the web compose screen. */
export function gmailAppComposeUrl(params: MailComposeParams, options?: { includeBody?: boolean }): string {
  const to = toHeader(params.to)
  const cc = ccHeader(params.cc)
  const bcc = bccHeader(params.bcc)
  const pairs: Array<[string, string]> = [['to', to]]
  if (cc) pairs.push(['cc', cc])
  if (bcc) pairs.push(['bcc', bcc])
  pairs.push(['subject', params.subject])
  if (options?.includeBody !== false) pairs.push(['body', params.body])
  return `googlegmail:///co?${encodePairs(pairs)}`
}

/**
 * Chrome/Android intent that opens the Gmail app (not Chrome) with the web compose URL.
 * If Gmail is missing, Chrome uses browser_fallback_url.
 */
export function androidGmailAppIntent(webComposeUrl: string): string {
  const rest = webComposeUrl.replace(/^https:\/\//, '')
  return `intent://${rest}#Intent;scheme=https;package=${GMAIL_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(webComposeUrl)};end`
}

export function mailtoUrl(params: MailComposeParams, options?: { includeBody?: boolean }): string {
  const to = toHeader(params.to)
  const cc = ccHeader(params.cc)
  const bcc = bccHeader(params.bcc)
  const pairs: Array<[string, string]> = []
  if (cc) pairs.push(['cc', cc])
  if (bcc) pairs.push(['bcc', bcc])
  pairs.push(['subject', params.subject])
  if (options?.includeBody !== false) pairs.push(['body', params.body])
  return `mailto:${encodeURIComponent(to)}?${encodePairs(pairs)}`
}

export function estimateUrlLength(params: MailComposeParams): number {
  return Math.max(gmailComposeUrl(params).length, mailtoUrl(params).length)
}

export function gmailUrlTooLong(params: MailComposeParams): boolean {
  return gmailComposeUrl(params).length > GMAIL_URL_WARN
}

export function mailtoUrlTooLong(params: MailComposeParams): boolean {
  return mailtoUrl(params).length > MAILTO_URL_WARN
}

function utf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function encodeRfc2047(text: string): string {
  if (/^[\x20-\x7E]*$/.test(text)) return text
  return `=?UTF-8?B?${utf8Base64(text)}?=`
}

function crlf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
}

/** Unsent RFC 822 draft. Opens in Outlook/Apple Mail/Thunderbird with the full body — no URL length cap. */
export function formatUnsentEml(params: MailComposeParams): string {
  const headers = ['X-Unsent: 1', `To: ${uniqueEmails(params.to).join(', ')}`]
  const cc = uniqueEmails(params.cc)
  if (cc.length > 0) headers.push(`Cc: ${cc.join(', ')}`)
  const bcc = uniqueEmails(params.bcc ?? [])
  if (bcc.length > 0) headers.push(`Bcc: ${bcc.join(', ')}`)
  headers.push(
    `Subject: ${encodeRfc2047(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
  )
  return crlf(`${headers.join('\n')}\n${params.body}\n`)
}

/** Chrome Android intent that puts the full Unicode body in EXTRA_TEXT instead of a mailto URL. */
export function androidSendIntent(
  params: MailComposeParams,
  options?: { gmailOnly?: boolean; fallbackUrl?: string },
): string {
  const extras = ['action=android.intent.action.SEND', 'type=message/rfc822']
  if (options?.gmailOnly) extras.push(`package=${GMAIL_ANDROID_PACKAGE}`)
  extras.push(`S.android.intent.extra.EMAIL=${encodeURIComponent(toHeader(params.to))}`)
  const cc = ccHeader(params.cc)
  if (cc) extras.push(`S.android.intent.extra.CC=${encodeURIComponent(cc)}`)
  const bcc = bccHeader(params.bcc)
  if (bcc) extras.push(`S.android.intent.extra.BCC=${encodeURIComponent(bcc)}`)
  extras.push(`S.android.intent.extra.SUBJECT=${encodeURIComponent(params.subject)}`)
  extras.push(`S.android.intent.extra.TEXT=${encodeURIComponent(params.body)}`)
  if (options?.fallbackUrl) extras.push(`S.browser_fallback_url=${encodeURIComponent(options.fallbackUrl)}`)
  extras.push('end')
  return `intent://send/#Intent;${extras.join(';')}`
}

export function formatCompleteEmailCopy(params: MailComposeParams): string {
  const to = uniqueEmails(params.to)
  const cc = uniqueEmails(params.cc)
  const bcc = uniqueEmails(params.bcc ?? [])
  const lines = ['To:', ...to, '']
  if (cc.length > 0) lines.push('CC:', ...cc, '')
  if (bcc.length > 0) lines.push('BCC:', ...bcc, '')
  lines.push(`Subject: ${params.subject}`, '', params.body)
  return lines.join('\n')
}

export function withRepresentativeCc(
  params: MailComposeParams,
  officialEmail: string | null | undefined,
  optedIn: boolean,
): MailComposeParams {
  const email = officialEmail?.trim()
  if (!optedIn || !email) return params
  if (params.cc.some((existing) => existing.toLowerCase() === email.toLowerCase())) return params
  if (params.to.some((existing) => existing.toLowerCase() === email.toLowerCase())) return params
  return { ...params, cc: [...params.cc, email] }
}
