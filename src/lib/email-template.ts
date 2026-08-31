export const EMAIL_PLACEHOLDERS = [
  'intro',
  'concerns',
  'custom_text',
  'closing',
  'full_name',
  'email',
  'phone',
  'address',
  'panchayat',
  'ward',
  'village',
  'taluk',
  'district',
  'pincode',
  'constituency',
  'post_office',
  'state',
  'postal_region',
  'identity_block',
  'location_block',
] as const

export type EmailPlaceholder = (typeof EMAIL_PLACEHOLDERS)[number]

export type EmailTemplateValues = Record<EmailPlaceholder, string>

export const DEFAULT_BODY_TEMPLATE_ML = `{{intro}}

{{concerns}}

{{custom_text}}

{{closing}}

പേര്: {{full_name}}
പിൻകോഡ്: {{pincode}}
ജില്ല: {{district}}

ആദരപൂർവ്വം,
{{identity_block}}`

export const DEFAULT_BODY_TEMPLATE_EN = `{{intro}}

{{concerns}}

{{custom_text}}

{{closing}}

Name: {{full_name}}
PIN: {{pincode}}
District: {{district}}

Regards,
{{identity_block}}`

const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi
const ALLOWED = new Set<string>(EMAIL_PLACEHOLDERS)

export function defaultBodyTemplate(lang: 'ml' | 'en'): string {
  return lang === 'en' ? DEFAULT_BODY_TEMPLATE_EN : DEFAULT_BODY_TEMPLATE_ML
}

export function emptyTemplateValues(): EmailTemplateValues {
  return {
    intro: '',
    concerns: '',
    custom_text: '',
    closing: '',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    panchayat: '',
    ward: '',
    village: '',
    taluk: '',
    district: '',
    pincode: '',
    constituency: '',
    post_office: '',
    state: '',
    postal_region: '',
    identity_block: '',
    location_block: '',
  }
}

/** Replace only known {{placeholders}}. Unknown tokens become empty. Never evaluates code. */
export function renderSafeTemplate(template: string, values: Partial<EmailTemplateValues>): string {
  const merged: EmailTemplateValues = { ...emptyTemplateValues(), ...values }
  const rendered = template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const normalized = key.toLowerCase()
    if (!ALLOWED.has(normalized)) return ''
    return merged[normalized as EmailPlaceholder] ?? ''
  })
  return collapseBlankLines(rendered)
}

export function collapseBlankLines(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
}

export function listUnknownPlaceholders(template: string): string[] {
  const unknown = new Set<string>()
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const key = match[1]?.toLowerCase() ?? ''
    if (key && !ALLOWED.has(key)) unknown.add(key)
  }
  return [...unknown]
}
