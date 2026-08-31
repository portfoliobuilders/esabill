'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useLang } from '@/components/LanguageProvider'
import { t } from '@/lib/i18n'
import { focusRing } from '@/lib/ui'

const primaryLinks = [
  { href: '/about', key: 'footerAbout' as const },
  { href: '/faq', key: 'footerFaq' as const },
  { href: '/privacy', key: 'footerPrivacy' as const },
  { href: '/contact', key: 'footerContact' as const },
]

const secondaryLinks = [
  { href: '/data', key: 'footerData' as const },
  { href: '/delete', key: 'footerDelete' as const },
]

export function SiteFooter({
  disclaimerMl,
  disclaimerEn,
  footerMl,
  footerEn,
}: {
  disclaimerMl?: string
  disclaimerEn?: string
  footerMl?: string
  footerEn?: string
}) {
  const { lang } = useLang()
  const disclaimer = (lang === 'en' ? disclaimerEn : disclaimerMl)?.trim() || t(lang, 'notOfficial')
  const footerNote = (lang === 'en' ? footerEn : footerMl)?.trim() || ''

  return (
    <footer className="mt-auto bg-ink text-stone-300">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <nav aria-label={t(lang, 'footerAbout')} className="flex flex-col gap-x-8 gap-y-3 sm:flex-row sm:flex-wrap">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex min-h-11 items-center text-sm font-medium text-stone-200 hover:text-white ${focusRing}`}
            >
              {t(lang, link.key)}
            </Link>
          ))}
        </nav>
        <nav className="mt-4 flex flex-col gap-x-8 gap-y-2 sm:flex-row sm:flex-wrap" aria-label={t(lang, 'footerData')}>
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex min-h-11 items-center text-sm text-stone-400 hover:text-stone-200 ${focusRing}`}
            >
              {t(lang, link.key)}
            </Link>
          ))}
        </nav>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-stone-400">{disclaimer}</p>
        {footerNote ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400">{footerNote}</p> : null}
      </div>
    </footer>
  )
}

export function SiteFooterGate(props: {
  disclaimerMl?: string
  disclaimerEn?: string
  footerMl?: string
  footerEn?: string
}) {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null
  return <SiteFooter {...props} />
}
