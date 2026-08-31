import assert from 'node:assert/strict'
import test from 'node:test'

import { createDetailsSchema } from './details-schema'
import { normalizeFormFields } from './form-fields'

test('details schema keeps post office, state, region, and taluk from PIN lookup', () => {
  const parsed = createDetailsSchema('en', ['Idukki'], []).safeParse({
    fullName: 'Joseph Mathew',
    email: '',
    phone: '',
    addressLine: '',
    panchayat: '',
    ward: '',
    village: '',
    district: 'Idukki',
    pincode: '685561',
    customText: '',
    postOffice: 'Adimali',
    state: 'Kerala',
    postalRegion: 'Kochi',
    taluk: 'Devikulam',
  })
  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.equal(parsed.data.postOffice, 'Adimali')
  assert.equal(parsed.data.state, 'Kerala')
  assert.equal(parsed.data.postalRegion, 'Kochi')
  assert.equal(parsed.data.taluk, 'Devikulam')
  assert.equal(parsed.data.district, 'Idukki')
})

const optionalPinInput = {
  fullName: 'Athul Anil',
  email: '',
  phone: '',
  addressLine: '',
  panchayat: '',
  ward: '',
  village: '',
  district: '',
  pincode: '',
  customText: '',
  postOffice: '',
  state: '',
  postalRegion: '',
  taluk: '',
}

test('empty PIN is allowed even when identity mode and saved fields mark it required', () => {
  const fields = normalizeFormFields(null).map((field) =>
    field.field_key === 'pincode' ? { ...field, is_required: true } : field,
  )
  const parsed = createDetailsSchema('en', ['Idukki'], fields, {
    campaign: { feature_settings: { identity_mode: 'required' } },
  }).safeParse(optionalPinInput)
  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.equal(parsed.data.pincode, '')
  assert.equal(parsed.data.fullName, 'Athul Anil')
})

test('a filled PIN must still be a valid 6-digit code', () => {
  const parsed = createDetailsSchema('en', ['Idukki'], normalizeFormFields(null), {
    campaign: { feature_settings: { identity_mode: 'required' } },
  }).safeParse({ ...optionalPinInput, pincode: '68553' })
  assert.equal(parsed.success, false)
})
