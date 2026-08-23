import {
  androidGmailAppIntent,
  gmailAppComposeUrl,
  gmailComposeUrl,
  gmailUrlTooLong,
  type MailComposeParams,
} from '@/lib/compose'

export type ClientPlatform = 'android' | 'ios' | 'other'

export type GmailHandoffPlan = {
  href: string
  webUrl: string
  includeBody: boolean
  native: boolean
  fallbackToWeb: boolean
  openInNewTab: boolean
}

export function clientPlatform(userAgent: string, maxTouchPoints = 0): ClientPlatform {
  if (/Android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) {
    return 'ios'
  }
  return 'other'
}

/** WhatsApp / Instagram / Facebook in-app browsers, plus Android WebView. */
export function isEmbeddedBrowser(userAgent: string): boolean {
  return /WhatsApp|FBAN|FBAV|Instagram|Line\/|Twitter|KAKAOTALK|Snapchat|; wv\)|WebView/i.test(userAgent)
}

export function planGmailHandoff(
  params: MailComposeParams,
  platform: ClientPlatform,
  userAgent: string,
): GmailHandoffPlan {
  const includeBody = !gmailUrlTooLong(params)
  const webUrl = gmailComposeUrl(params, { includeBody })

  if (platform === 'android') {
    if (isEmbeddedBrowser(userAgent)) {
      return {
        href: gmailAppComposeUrl(params, { includeBody }),
        webUrl,
        includeBody,
        native: true,
        fallbackToWeb: true,
        openInNewTab: false,
      }
    }
    return {
      href: androidGmailAppIntent(webUrl),
      webUrl,
      includeBody,
      native: true,
      fallbackToWeb: true,
      openInNewTab: false,
    }
  }

  if (platform === 'ios') {
    return {
      href: gmailAppComposeUrl(params, { includeBody }),
      webUrl,
      includeBody,
      native: true,
      fallbackToWeb: true,
      openInNewTab: false,
    }
  }

  return {
    href: webUrl,
    webUrl,
    includeBody,
    native: false,
    fallbackToWeb: false,
    openInNewTab: true,
  }
}

function openNativeWithWebFallback(appUrl: string, webUrl: string) {
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    window.removeEventListener('pagehide', finish)
    window.removeEventListener('blur', finish)
    document.removeEventListener('visibilitychange', onVisibility)
    window.clearTimeout(timer)
  }
  const onVisibility = () => {
    if (document.hidden) finish()
  }
  window.addEventListener('pagehide', finish)
  window.addEventListener('blur', finish)
  document.addEventListener('visibilitychange', onVisibility)
  const timer = window.setTimeout(() => {
    const missedApp = !settled && !document.hidden
    finish()
    if (missedApp) window.location.href = webUrl
  }, 1200)
  window.location.href = appUrl
}

export function applyGmailHandoff(plan: GmailHandoffPlan): void {
  if (plan.openInNewTab) {
    window.open(plan.href, '_blank', 'noopener,noreferrer')
    return
  }
  if (plan.fallbackToWeb) {
    openNativeWithWebFallback(plan.href, plan.webUrl)
    return
  }
  window.location.href = plan.href
}
