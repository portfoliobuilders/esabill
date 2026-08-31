import {
  androidGmailAppComposeIntent,
  gmailAppComposeUrl,
  gmailAppUrlTooLong,
  gmailComposeUrl,
  gmailUrlTooLong,
  mailtoUrl,
  mailtoUrlTooLongFor,
  type MailComposeParams,
  type MailUrlPlatform,
} from '@/lib/compose'

export type ClientPlatform = MailUrlPlatform

export type GmailHandoffPlan = {
  href: string
  webUrl: string
  fallbackHref?: string
  /** True when the primary href carries the full letter body. */
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

function webComposeUrl(params: MailComposeParams): { url: string; includeBody: boolean } {
  const includeBody = !gmailUrlTooLong(params)
  return { url: gmailComposeUrl(params, { includeBody }), includeBody }
}

/** Fallback that still carries the full letter when Gmail web cannot. */
export function gmailFallbackHref(params: MailComposeParams, platform: ClientPlatform): string | undefined {
  if (!gmailUrlTooLong(params)) return gmailComposeUrl(params)
  if (!mailtoUrlTooLongFor(params, platform)) return mailtoUrl(params)
  return undefined
}

function nativeAppHref(params: MailComposeParams): string {
  return gmailAppComposeUrl(params)
}

export function planGmailHandoff(
  params: MailComposeParams,
  platform: ClientPlatform,
  userAgent: string,
): GmailHandoffPlan {
  const web = webComposeUrl(params)
  const fallbackHref = gmailFallbackHref(params, platform)
  const appOk = !gmailAppUrlTooLong(params)

  if (platform === 'android') {
    if (isEmbeddedBrowser(userAgent)) {
      return {
        href: nativeAppHref(params),
        webUrl: web.url,
        includeBody: appOk,
        native: true,
        fallbackToWeb: false,
        openInNewTab: false,
      }
    }
    return {
      href: androidGmailAppComposeIntent(params, fallbackHref),
      webUrl: web.url,
      fallbackHref,
      includeBody: appOk,
      native: true,
      fallbackToWeb: Boolean(fallbackHref),
      openInNewTab: false,
    }
  }

  if (platform === 'ios') {
    return {
      href: nativeAppHref(params),
      webUrl: web.url,
      fallbackHref,
      includeBody: appOk,
      native: true,
      fallbackToWeb: Boolean(fallbackHref),
      openInNewTab: false,
    }
  }

  if (web.includeBody) {
    return {
      href: web.url,
      webUrl: web.url,
      includeBody: true,
      native: false,
      fallbackToWeb: false,
      openInNewTab: true,
    }
  }

  const mail = mailtoUrl(params)
  if (!mailtoUrlTooLongFor(params, 'other')) {
    return {
      href: mail,
      webUrl: web.url,
      includeBody: true,
      native: false,
      fallbackToWeb: false,
      openInNewTab: false,
    }
  }

  return {
    href: web.url,
    webUrl: web.url,
    includeBody: false,
    native: false,
    fallbackToWeb: false,
    openInNewTab: true,
  }
}

function navigateToComposeUrl(url: string): void {
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function openNativeWithFallback(appUrl: string, fallbackUrl: string | undefined) {
  if (!fallbackUrl) {
    navigateToComposeUrl(appUrl)
    return
  }
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
    if (missedApp) window.location.href = fallbackUrl
  }, 1600)
  window.location.href = appUrl
}

export function applyGmailHandoff(plan: GmailHandoffPlan): void {
  if (plan.openInNewTab) {
    const opened = window.open(plan.href, '_blank', 'noopener,noreferrer')
    if (!opened) navigateToComposeUrl(plan.href)
    return
  }
  if (plan.native && plan.fallbackToWeb) {
    openNativeWithFallback(plan.href, plan.fallbackHref)
    return
  }
  navigateToComposeUrl(plan.href)
}
