import {
  androidSendIntent,
  formatUnsentEml,
  gmailUrlTooLong,
  INTENT_URL_WARN,
  mailtoUrl,
  mailtoUrlTooLongFor,
  type MailComposeParams,
  type MailUrlPlatform,
} from '@/lib/compose'
import { applyGmailHandoff, planGmailHandoff } from '@/lib/gmail-handoff'

export type MailClient = 'gmail' | 'mail_app'
export type MailPlatform = MailUrlPlatform
export type MailLaunchResult = 'gmail_tab' | 'navigated' | 'eml'

export type MailLaunchPlan =
  | { kind: 'android_intent'; gmailOnly: boolean }
  | { kind: 'gmail_url' }
  | { kind: 'gmail_native' }
  | { kind: 'mailto_url' }
  | { kind: 'eml' }

const EML_FILENAME = 'janashabdam-letter.eml'

export function clientMailPlatform(userAgent: string, maxTouchPoints = 0): MailPlatform {
  if (/Android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) {
    return 'ios'
  }
  return 'other'
}

/**
 * Choose how to hand the full letter to a mail client.
 * The body is never dropped from native / mailto / eml transports.
 * Gmail web (8 KB) is only used when the encoded letter actually fits.
 */
export function planMailLaunch(
  params: MailComposeParams,
  client: MailClient,
  platform: MailPlatform,
): MailLaunchPlan {
  if (client === 'gmail') {
    if (platform === 'android' || platform === 'ios') return { kind: 'gmail_native' }
    if (!gmailUrlTooLong(params)) return { kind: 'gmail_url' }
    if (!mailtoUrlTooLongFor(params, platform)) return { kind: 'mailto_url' }
    return { kind: 'eml' }
  }

  if (platform === 'android') {
    if (!mailtoUrlTooLongFor(params, 'android')) return { kind: 'mailto_url' }
    const intent = androidSendIntent(params)
    if (intent.length <= INTENT_URL_WARN) return { kind: 'android_intent', gmailOnly: false }
    return { kind: 'eml' }
  }

  if (!mailtoUrlTooLongFor(params, platform)) return { kind: 'mailto_url' }
  return { kind: 'eml' }
}

/** User-gesture navigation that Android Chrome / WhatsApp WebView will hand to a mail app. */
function navigateToComposeUrl(url: string): void {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function openUnsentEml(params: MailComposeParams, filename = EML_FILENAME): void {
  const blob = new Blob([formatUnsentEml(params)], { type: 'message/rfc822' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function launchMailCompose(params: MailComposeParams, client: MailClient): MailLaunchResult {
  const platform = clientMailPlatform(navigator.userAgent, navigator.maxTouchPoints)

  if (client === 'gmail') {
    const gmailPlan = planGmailHandoff(params, platform, navigator.userAgent)
    if (!gmailPlan.includeBody) {
      openUnsentEml(params)
      return 'eml'
    }
    applyGmailHandoff(gmailPlan)
    return gmailPlan.openInNewTab ? 'gmail_tab' : 'navigated'
  }

  const plan = planMailLaunch(params, client, platform)

  switch (plan.kind) {
    case 'gmail_native':
    case 'gmail_url':
      applyGmailHandoff(planGmailHandoff(params, platform, navigator.userAgent))
      return plan.kind === 'gmail_url' ? 'gmail_tab' : 'navigated'
    case 'android_intent': {
      navigateToComposeUrl(
        androidSendIntent(params, {
          gmailOnly: plan.gmailOnly,
          fallbackUrl: mailtoUrlTooLongFor(params, 'android') ? undefined : mailtoUrl(params),
        }),
      )
      return 'navigated'
    }
    case 'mailto_url': {
      const href = mailtoUrl(params)
      if (platform === 'other') window.location.href = href
      else navigateToComposeUrl(href)
      return 'navigated'
    }
    case 'eml':
      openUnsentEml(params)
      return 'eml'
  }
}
