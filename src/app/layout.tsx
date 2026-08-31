import type { Metadata } from 'next'
import { Gayathri, IBM_Plex_Mono, Instrument_Serif, Inter, Manjari } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import { Analytics } from '@vercel/analytics/next'

import { AuthErrorCatcher } from '@/components/AuthErrorCatcher'
import { Header } from '@/components/Header'
import { LanguageProvider } from '@/components/LanguageProvider'
import { SiteFooterGate } from '@/components/SiteFooter'
import { isAdminPath } from '@/lib/admin/paths'
import { fetchSiteSettings } from '@/lib/admin/queries'
import { resolveCampaignState } from '@/lib/campaign'
import { parseLang } from '@/lib/lang'

import './globals.css'

export const dynamic = 'force-dynamic'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-instrument',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-ibm',
})

const gayathri = Gayathri({
  subsets: ['malayalam'],
  weight: '700',
  display: 'swap',
  variable: '--font-gayathri',
})

const manjari = Manjari({
  subsets: ['malayalam', 'latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-manjari',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://janashabdam.in'

async function loadPublicSiteSettings() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return null
  }
  try {
    return await fetchSiteSettings()
  } catch {
    return null
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadPublicSiteSettings()
  const cookieStore = await cookies()
  const lang = parseLang(cookieStore.get('lang')?.value)
  let campaignTitle = lang === 'en' ? settings?.site_title_en || 'Janashabdam' : settings?.site_title_ml || 'ജനശബ്ദം'
  let campaignDescription =
    lang === 'en'
      ? 'Send a personal representation from your own email address.'
      : 'നിങ്ങളുടെ സ്വന്തം ഇമെയിൽ വിലാസത്തിൽ നിന്ന് കൂടിയാലോചനയോടുള്ള വ്യക്തിഗത എതിർപ്പ് അയയ്ക്കുക.'
  let ogImage = settings?.og_image_url || `${siteUrl}/og-image.svg`
  try {
    const state = await resolveCampaignState()
    if (state.state !== 'dormant') {
      campaignTitle =
        lang === 'en'
          ? state.campaign.og_title_en || state.campaign.title_en
          : state.campaign.og_title_ml || state.campaign.title_ml
      campaignDescription =
        lang === 'en'
          ? state.campaign.og_description_en || state.campaign.summary_en
          : state.campaign.og_description_ml || state.campaign.summary_ml
      ogImage = state.campaign.social_image_url || ogImage
    }
  } catch {
    // Branding-only metadata is enough if the campaign query fails.
  }
  const brand = lang === 'en' ? settings?.site_title_en || 'Janashabdam' : settings?.site_title_ml || 'ജനശബ്ദം'
  return {
    title: campaignTitle,
    description: campaignDescription,
    icons: settings?.favicon_url ? [{ url: settings.favicon_url }] : undefined,
    openGraph: {
      title: campaignTitle,
      description: campaignDescription,
      url: siteUrl,
      siteName: brand,
      locale: 'ml_IN',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: campaignTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: campaignTitle,
      description: campaignDescription,
      images: [ogImage],
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const lang = parseLang(cookieStore.get('lang')?.value)
  const pathname = (await headers()).get('x-pathname') ?? ''
  const admin = isAdminPath(pathname)
  const settings = admin ? null : await loadPublicSiteSettings()

  return (
    <html
      lang={lang}
      className={`${inter.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable} ${gayathri.variable} ${manjari.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-surface text-base text-ink antialiased">
        <LanguageProvider initialLang={lang}>
          <AuthErrorCatcher />
          {admin ? null : (
            <Header
              titleMl={settings?.site_title_ml}
              titleEn={settings?.site_title_en}
              taglineMl={settings?.tagline_ml}
              taglineEn={settings?.tagline_en}
              logoUrl={settings?.logo_url}
            />
          )}
          <div className="flex-1">{children}</div>
          {admin ? null : (
            <SiteFooterGate
              disclaimerMl={settings?.public_disclaimer_ml}
              disclaimerEn={settings?.public_disclaimer_en}
              footerMl={settings?.public_footer_ml}
              footerEn={settings?.public_footer_en}
            />
          )}
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
