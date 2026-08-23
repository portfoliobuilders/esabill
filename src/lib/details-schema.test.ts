import assert from 'node:assert/strict'
import test from 'node:test'

import { createDetailsSchema } from './details-schema'

test('details schema keeps post office, state, region, and taluk from PIN lookup', () => {
  const parsed = createDetailsSchema('en', ['Idukki'], []).safeParse({
    fullName: 'Joseph Mathew',
    email: '',
    phone: '',
    addressLine: '',
    panchayat: '',
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
