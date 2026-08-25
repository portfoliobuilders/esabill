import {
  androidSendIntent,
  formatUnsentEml,
  gmailComposeUrl,
  gmailUrlTooLong,
  mailtoUrl,
  mailtoUrlTooLong,
  type MailComposeParams,
} from '@/lib/compose'

export type MailClient = 'gmail' | 'mail_app'
export type MailPlatform = 'android' | 'ios' | 'other'
export type MailLaunchResult = 'gmail_tab' | 'navigated' | 'eml'

export type MailLaunchPlan =
  | { kind: 'android_intent'; gmailOnly: boolean }
  | { kind: 'gmail_url' }
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
 * The body is never dropped. If a compose URL cannot carry it, an unsent .eml draft is used.
 *
 * Android must use mailto (same as iPhone), not ACTION_SEND. Chrome treats ACTION_SEND
 * with EXTRA_TEXT as a share/copy, which is why Send Email showed the clipboard overlay.
 */
export function planMailLaunch(
  params: MailComposeParams,
  client: MailClient,
  platform: MailPlatform,
): MailLaunchPlan {
  if (platform === 'android') {
    if (!mailtoUrlTooLong(params)) return { kind: 'mailto_url' }
    return { kind: 'android_intent', gmailOnly: client === 'gmail' }
  }

  if (client === 'gmail') {
    if (!gmailUrlTooLong(params)) return { kind: 'gmail_url' }
    // Gmail's web URL cannot carry this letter. Keep the full body via mailto or an .eml draft.
    if (platform === 'ios' && !mailtoUrlTooLong(params)) return { kind: 'mailto_url' }
    return { kind: 'eml' }
  }

  if (platform === 'ios' && !mailtoUrlTooLong(params)) {
    return { kind: 'mailto_url' }
  }

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

function fallbackComposeUrl(params: MailComposeParams, client: MailClient): string | undefined {
  if (client === 'gmail') {
    return gmailUrlTooLong(params) ? undefined : gmailComposeUrl(params)
  }
  return mailtoUrlTooLong(params) ? undefined : mailtoUrl(params)
}

export function launchMailCompose(params: MailComposeParams, client: MailClient): MailLaunchResult {
  const platform = clientMailPlatform(navigator.userAgent, navigator.maxTouchPoints)
  const plan = planMailLaunch(params, client, platform)

  switch (plan.kind) {
    case 'android_intent': {
      navigateToComposeUrl(
        androidSendIntent(params, {
          gmailOnly: plan.gmailOnly,
          fallbackUrl: fallbackComposeUrl(params, client),
        }),
      )
      return 'navigated'
    }
    case 'gmail_url':
      window.open(gmailComposeUrl(params), '_blank', 'noopener,noreferrer')
      return 'gmail_tab'
    case 'mailto_url':
      navigateToComposeUrl(mailtoUrl(params))
      return 'navigated'
    case 'eml':
      openUnsentEml(params)
      return 'eml'
  }
}
