import { z } from 'zod'

import { identityRequired, parseFeatureSettings } from '@/lib/campaign-features'
import { isFieldEnabled, isFieldRequired } from '@/lib/form-fields'
import { t, type Lang } from '@/lib/i18n'
import { PINCODE_RE } from '@/lib/postal'
import type { Campaign, CampaignFormField } from '@/types/database'

export const MAX_CUSTOM_CHARS = 1000

export type DetailsFields = {
  fullName: string
  addressLine: string
  panchayat: string
  village: string
  district: string
  pincode: string
  phone: string
  email: string
  customText: string
  postOffice: string
  state: string
  postalRegion: string
  taluk: string
}

export const emptyDetails = (): DetailsFields => ({
  fullName: '',
  addressLine: '',
  panchayat: '',
  village: '',
  district: '',
  pincode: '',
  phone: '',
  email: '',
  customText: '',
  postOffice: '',
  state: '',
  postalRegion: '',
  taluk: '',
})

function optionalText() {
  return z.string().trim()
}

function requiredText(message: string) {
  return z.string().trim().min(1, message)
}

export function createDetailsSchema(
  lang: Lang,
  districts: string[],
  fields: CampaignFormField[],
  options?: { privacyMode?: boolean; campaign?: Pick<Campaign, 'feature_settings'> },
) {
  const features = parseFeatureSettings(options?.campaign?.feature_settings)
  const privacy = Boolean(options?.privacyMode && features.allow_privacy_mode)
  const needIdentity = identityRequired(features, privacy)

  const nameEnabled = isFieldEnabled(fields, 'name')
  const nameRequired = nameEnabled && (needIdentity || isFieldRequired(fields, 'name')) && !privacy
  const name = nameRequired ? requiredText(t(lang, 'errorFullName')) : optionalText()

  const emailEnabled = isFieldEnabled(fields, 'email')
  const emailRequired = emailEnabled && isFieldRequired(fields, 'email') && !privacy
  const email = emailEnabled
    ? emailRequired
      ? z.email(t(lang, 'errorEmail'))
      : z
          .string()
          .trim()
          .refine((value) => !value || z.email().safeParse(value).success, t(lang, 'errorEmail'))
    : optionalText()

  const phoneEnabled = isFieldEnabled(fields, 'phone')
  const phoneRequired = phoneEnabled && isFieldRequired(fields, 'phone') && !privacy
  const phone = phoneEnabled
    ? phoneRequired
      ? z.string().trim().min(8, t(lang, 'errorPhone'))
      : optionalText()
    : optionalText()

  const pinEnabled = isFieldEnabled(fields, 'pincode')
  const pinRequired = pinEnabled && (needIdentity || isFieldRequired(fields, 'pincode')) && !privacy
  const pincode = pinEnabled
    ? pinRequired
      ? z.string().trim().regex(PINCODE_RE, t(lang, 'errorPincode'))
      : z
          .string()
          .trim()
          .refine((value) => !value || PINCODE_RE.test(value), t(lang, 'errorPincode'))
    : optionalText()

  const districtEnabled = isFieldEnabled(fields, 'district')
  const districtRequired = districtEnabled && isFieldRequired(fields, 'district') && !privacy
  const district = districtEnabled
    ? districtRequired
      ? z
          .string()
          .trim()
          .min(1, t(lang, 'errorDistrict'))
          .refine((value) => districts.length === 0 || districts.includes(value), t(lang, 'errorDistrict'))
      : z
          .string()
          .trim()
          .refine((value) => !value || districts.length === 0 || districts.includes(value), t(lang, 'errorDistrict'))
    : optionalText

  const address = isFieldRequired(fields, 'address') && !privacy ? requiredText(t(lang, 'errorAddress')) : optionalText()
  const panchayat = isFieldRequired(fields, 'local_body') && !privacy ? requiredText(t(lang, 'panchayat')) : optionalText()
  const village = isFieldRequired(fields, 'village') && !privacy ? requiredText(t(lang, 'village')) : optionalText()
  const customText = z.string().max(MAX_CUSTOM_CHARS, t(lang, 'errorCustomText'))

  return z.object({
    fullName: name,
    email,
    phone,
    addressLine: address,
    panchayat,
    village,
    district,
    pincode,
    customText,
    postOffice: optionalText(),
    state: optionalText(),
    postalRegion: optionalText(),
    taluk: optionalText(),
  })
}

export type FieldErrors = Partial<Record<keyof DetailsFields, string>>

export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) {
      out[key as keyof DetailsFields] = issue.message
    }
  }
  return out
}
