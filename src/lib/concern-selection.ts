import { concernBody, concernTitle } from '@/lib/compose-concerns'
import type { Lang } from '@/lib/i18n'
import type { Campaign, ConcernSelectionMode, ObjectionClause } from '@/types/database'

export type { ConcernSelectionMode }

export const MAX_CUSTOM_CONCERN_BOXES = 6

export const DEFAULT_CUSTOM_CONCERN_LABEL = {
  en: 'Add your own concern',
  ml: 'നിങ്ങളുടെ സ്വന്തം ആശങ്ക ചേർക്കുക',
} as const

export const DEFAULT_CUSTOM_CONCERN_PLACEHOLDER = {
  en: 'If you have an additional concern that is not covered above, you can write it here.',
  ml: 'മുകളിൽ ഉൾപ്പെടുത്തിയിട്ടില്ലാത്ത മറ്റൊരു ആശങ്ക നിങ്ങൾക്കുണ്ടെങ്കിൽ ഇവിടെ എഴുതാം.',
} as const

export type ConcernSelectionConfig = {
  mode: ConcernSelectionMode
  maxSelections: number | null
  allowCustomConcern: boolean
  customLabelEn: string
  customLabelMl: string
  customPlaceholderEn: string
  customPlaceholderMl: string
}

export function normalizeConcernSelectionMode(value: unknown): ConcernSelectionMode {
  return value === 'multiple' ? 'multiple' : 'single'
}

export function normalizeMaxConcernSelections(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

export function campaignConcernConfig(campaign: Pick<
  Campaign,
  | 'concern_selection_mode'
  | 'max_concern_selections'
  | 'allow_custom_concern'
  | 'custom_concern_label_en'
  | 'custom_concern_label_ml'
  | 'custom_concern_placeholder_en'
  | 'custom_concern_placeholder_ml'
>): ConcernSelectionConfig {
  return {
    mode: normalizeConcernSelectionMode(campaign.concern_selection_mode),
    maxSelections: normalizeMaxConcernSelections(campaign.max_concern_selections),
    allowCustomConcern: campaign.allow_custom_concern !== false,
    customLabelEn: campaign.custom_concern_label_en?.trim() || DEFAULT_CUSTOM_CONCERN_LABEL.en,
    customLabelMl: campaign.custom_concern_label_ml?.trim() || DEFAULT_CUSTOM_CONCERN_LABEL.ml,
    customPlaceholderEn: campaign.custom_concern_placeholder_en?.trim() || DEFAULT_CUSTOM_CONCERN_PLACEHOLDER.en,
    customPlaceholderMl: campaign.custom_concern_placeholder_ml?.trim() || DEFAULT_CUSTOM_CONCERN_PLACEHOLDER.ml,
  }
}

export function isMultiSelect(mode: ConcernSelectionMode): boolean {
  return mode === 'multiple'
}

export function flattenCustomConcerns(customConcerns: string[]): string[] {
  return customConcerns
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function customConcernCopy(
  config: ConcernSelectionConfig,
  lang: Lang,
): { label: string; placeholder: string } {
  if (lang === 'en') {
    return { label: config.customLabelEn, placeholder: config.customPlaceholderEn }
  }
  return { label: config.customLabelMl, placeholder: config.customPlaceholderMl }
}

export function applyPredefinedConcernClick(args: {
  mode: ConcernSelectionMode
  selectedIds: string[]
  id: string
  maxSelections: number | null
}): { selectedIds: string[]; limited: boolean } {
  const { mode, selectedIds, id, maxSelections } = args
  if (mode === 'single') {
    return { selectedIds: [id], limited: false }
  }
  if (selectedIds.includes(id)) {
    return { selectedIds: selectedIds.filter((existing) => existing !== id), limited: false }
  }
  if (maxSelections != null && selectedIds.length >= maxSelections) {
    return { selectedIds, limited: true }
  }
  return { selectedIds: [...selectedIds, id], limited: false }
}

export type PredefinedSelectionError = 'ok' | 'required' | 'too_many'

export function validatePredefinedSelection(args: {
  mode: ConcernSelectionMode
  selectedIds: string[]
  maxSelections: number | null
}): PredefinedSelectionError {
  if (args.selectedIds.length < 1) return 'required'
  if (args.mode === 'single' && args.selectedIds.length !== 1) return 'required'
  if (args.mode === 'multiple' && args.maxSelections != null && args.selectedIds.length > args.maxSelections) {
    return 'too_many'
  }
  return 'ok'
}

export function selectedClausesForLetter(
  clauses: ObjectionClause[],
  selectedIds: string[],
): ObjectionClause[] {
  const selected = new Set(selectedIds)
  return [...clauses]
    .filter((clause) => selected.has(clause.id))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function pickClauseText(clause: ObjectionClause, lang: Lang): { title: string; body: string } {
  return { title: concernTitle(clause, lang), body: concernBody(clause, lang) }
}

export function formatConcernsForEmail(args: {
  mode: ConcernSelectionMode
  clauses: ObjectionClause[]
  extraConcerns: string[]
  lang: Lang
}): string {
  const extras = flattenCustomConcerns(args.extraConcerns)
  const selected = [...args.clauses].sort((a, b) => a.sort_order - b.sort_order)
  const parts: string[] = []

  if (args.mode === 'single') {
    const clause = selected[0]
    if (clause) {
      const { title, body } = pickClauseText(clause, args.lang)
      parts.push(args.lang === 'en' ? 'Concern:' : 'വിഷയം:')
      parts.push('')
      parts.push(title)
      if (body.trim()) {
        parts.push('')
        parts.push(body.trim())
      }
    }
  } else if (selected.length > 0) {
    parts.push(args.lang === 'en' ? 'Concerns:' : 'വിഷയങ്ങൾ:')
    parts.push('')
    selected.forEach((clause, index) => {
      const { title, body } = pickClauseText(clause, args.lang)
      const heading = `${index + 1}. ${title}`
      parts.push(heading)
      if (body.trim()) parts.push(`   ${body.trim()}`)
      if (index < selected.length - 1) parts.push('')
    })
  }

  if (extras.length > 0) {
    if (parts.length > 0) parts.push('')
    parts.push(args.lang === 'en' ? 'Additional Concern:' : 'അധിക ആശങ്ക:')
    parts.push('')
    parts.push(extras.join('\n\n'))
  }

  return parts.join('\n').trim()
}
