import type { CampaignFormField, FormFieldKey } from '@/types/database'

export type FieldMode = 'disabled' | 'optional' | 'required'

export const FORM_FIELD_KEYS: FormFieldKey[] = [
  'name',
  'pincode',
  'phone',
  'address',
  'email',
  'district',
  'local_body',
  'village',
  'custom_message',
]

export type FieldMode = 'disabled' | 'optional' | 'required'

export const DEFAULT_FORM_FIELDS: Array<Omit<CampaignFormField, 'id' | 'campaign_id'>> = [
  { field_key: 'name', label_en: 'Name', label_ml: 'പേര്', is_enabled: true, is_required: true, display_order: 1 },
  { field_key: 'pincode', label_en: 'PIN Code', label_ml: 'പിൻ കോഡ്', is_enabled: true, is_required: true, display_order: 2 },
  { field_key: 'phone', label_en: 'Phone Number', label_ml: 'ഫോൺ നമ്പർ', is_enabled: false, is_required: false, display_order: 3 },
  { field_key: 'address', label_en: 'Address', label_ml: 'വിലാസം', is_enabled: false, is_required: false, display_order: 4 },
  { field_key: 'email', label_en: 'Email', label_ml: 'ഇമെയിൽ', is_enabled: false, is_required: false, display_order: 5 },
  { field_key: 'district', label_en: 'District', label_ml: 'ജില്ല', is_enabled: false, is_required: false, display_order: 6 },
  { field_key: 'local_body', label_en: 'Panchayat / Municipality', label_ml: 'പഞ്ചായത്ത് / മുനിസിപ്പാലിറ്റി', is_enabled: false, is_required: false, display_order: 7 },
  { field_key: 'village', label_en: 'Village', label_ml: 'വില്ലേജ്', is_enabled: false, is_required: false, display_order: 8 },
  { field_key: 'custom_message', label_en: 'Additional concern', label_ml: 'അധിക ആശങ്ക', is_enabled: false, is_required: false, display_order: 9 },
]

export function normalizeFormFields(rows: CampaignFormField[] | null | undefined): CampaignFormField[] {
  if (rows && rows.length > 0) {
    const known = new Set(rows.map((row) => row.field_key))
    const extras = DEFAULT_FORM_FIELDS.filter((field) => !known.has(field.field_key)).map((field, index) => ({
      id: `default-${field.field_key}`,
      campaign_id: rows[0]?.campaign_id ?? '',
      ...field,
      display_order: 100 + index,
    }))
    return [...rows, ...extras].sort((a, b) => a.display_order - b.display_order)
  }
  return DEFAULT_FORM_FIELDS.map((field, index) => ({
    id: `default-${field.field_key}`,
    campaign_id: '',
    ...field,
    display_order: index + 1,
  }))
}

export function fieldByKey(fields: CampaignFormField[], key: FormFieldKey): CampaignFormField | undefined {
  return fields.find((field) => field.field_key === key)
}

export function isFieldEnabled(fields: CampaignFormField[], key: FormFieldKey): boolean {
  const field = fieldByKey(fields, key)
  if (!field) return key === 'name' || key === 'pincode'
  return field.is_enabled
}

export function isFieldRequired(fields: CampaignFormField[], key: FormFieldKey): boolean {
  const field = fieldByKey(fields, key)
  if (!field) return key === 'name' || key === 'pincode'
  if (!field.is_enabled) return false
  return field.is_required
}

export function fieldMode(fields: CampaignFormField[], key: FormFieldKey): FieldMode {
  if (!isFieldEnabled(fields, key)) return 'disabled'
  return isFieldRequired(fields, key) ? 'required' : 'optional'
}

export function applyFieldMode(
  field: Omit<CampaignFormField, 'id' | 'campaign_id'> | CampaignFormField,
  mode: FieldMode,
) {
  return {
    ...field,
    is_enabled: mode !== 'disabled',
    is_required: mode === 'required',
  }
}

export function labelForField(fields: CampaignFormField[], key: FormFieldKey, lang: 'ml' | 'en', fallback: string): string {
  const field = fieldByKey(fields, key)
  if (!field) return fallback
  return (lang === 'en' ? field.label_en : field.label_ml) || fallback
}
