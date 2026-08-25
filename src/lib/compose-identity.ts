import type { Lang } from '@/lib/i18n'
import type { LocationForMail } from '@/lib/postal'
import type { Campaign, ObjectionClause } from '@/types/database'
import { concernBody, concernTitle } from '@/lib/compose-concerns'

export type IdentityDetails = {
  fullName: string
  pincode: string
  phone: string
  addressLine: string
  postOffice?: string
  district?: string
  state?: string
  postalRegion?: string
  taluk?: string
}

function line(label: string, value: string | undefined | null): string | null {
  const text = (value ?? '').trim()
  if (!text) return null
  return `${label}: ${text}`
}

function identityLabels(lang: Lang) {
  return lang === 'en'
    ? {
        name: 'Name',
        pincode: 'PIN Code',
        postOffice: 'Post Office',
        district: 'District',
        state: 'State',
        region: 'Postal Region',
        taluk: 'Taluk',
        phone: 'Phone Number',
        address: 'Address',
      }
    : {
        name: 'പേര്',
        pincode: 'പിൻ കോഡ്',
        postOffice: 'പോസ്റ്റ് ഓഫീസ്',
        district: 'ജില്ല',
        state: 'സംസ്ഥാനം',
        region: 'തപാൽ മേഖല',
        taluk: 'താലൂക്ക്',
        phone: 'ഫോൺ നമ്പർ',
        address: 'വിലാസം',
      }
}

/** PIN and the office/district/state/region/taluk returned by live lookup. */
export function locationBlock(details: IdentityDetails, lang: Lang): string {
  const labels = identityLabels(lang)
  return [
    line(labels.pincode, details.pincode),
    line(labels.postOffice, details.postOffice),
    line(labels.district, details.district),
    line(labels.state, details.state),
    line(labels.region, details.postalRegion),
    line(labels.taluk, details.taluk),
  ]
    .filter(Boolean)
    .join('\n')
}

export function identityBlock(details: IdentityDetails, lang: Lang): string {
  const labels = identityLabels(lang)
  return [
    line(labels.name, details.fullName),
    locationBlock(details, lang),
    line(labels.phone, details.phone),
    line(labels.address, details.addressLine),
  ]
    .filter(Boolean)
    .join('\n')
}

export function locationFromDetails(details: IdentityDetails): LocationForMail {
  return {
    postOffice: details.postOffice,
    district: details.district,
    state: details.state,
    postalRegion: details.postalRegion,
    taluk: details.taluk,
  }
}

export function privacyLetter(args: {
  campaign: Campaign
  clauses: ObjectionClause[]
  extraConcerns: string[]
  lang: Lang
}): string {
  const { campaign, clauses, extraConcerns, lang } = args
  const title = lang === 'en' ? campaign.title_en : campaign.title_ml
  const concernParts = clauses.map((clause) => {
    const heading = concernTitle(clause, lang)
    const body = concernBody(clause, lang)
    if (body && heading && !body.startsWith(heading)) return `${heading}\n\n${body}`
    return body || heading
  })
  const extras = extraConcerns.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const body = [...concernParts, ...extras].filter(Boolean).join('\n\n')
  const closing = lang === 'en' ? campaign.closing_en : campaign.closing_ml

  if (lang === 'en') {
    return [
      'Dear Sir/Madam,',
      '',
      `I wish to submit the following concern regarding ${title}.`,
      '',
      body,
      '',
      closing || 'I request that the matter be examined and appropriate action be taken.',
      '',
      'Regards,',
      'A concerned citizen',
    ].join('\n')
  }

  return [
    'ആദരണീയരായ സാർ / മാഡം,',
    '',
    `${title}യുമായി ബന്ധപ്പെട്ട് താഴെപ്പറയുന്ന ആശങ്ക അറിയിക്കുന്നു.`,
    '',
    body,
    '',
    closing || 'വിഷയം പരിശോധിച്ച് ആവശ്യമായ നടപടി സ്വീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.',
    '',
    'ആദരപൂർവ്വം,',
    'ഒരു പൗരൻ',
  ].join('\n')
}
