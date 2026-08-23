import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defaultPostOffice,
  isValidPincode,
  locationFromLookup,
  mapDirectoryRow,
  postalIdentityFromLookup,
  summarizePostalOffices,
  withPostalIdentity,
  type PostalOffice,
} from './postal'

function office(partial: Partial<PostalOffice> & Pick<PostalOffice, 'pincode' | 'officeName'>): PostalOffice {
  return {
    officeType: null,
    deliveryStatus: null,
    circleName: null,
    regionName: null,
    divisionName: null,
    districtName: null,
    stateName: null,
    talukName: null,
    ...partial,
  }
}

test('invalid PIN is rejected (scenario D)', () => {
  assert.equal(isValidPincode('68553'), false)
  assert.equal(isValidPincode('085531'), false)
  assert.equal(isValidPincode('abc123'), false)
  assert.equal(isValidPincode('685531'), true)
})

test('single office fills state, district, post office and region (scenario A)', () => {
  const lookup = summarizePostalOffices(
    '695001',
    [
      office({
        pincode: '695001',
        officeName: 'Thiruvananthapuram GPO',
        officeType: 'HO',
        districtName: 'Thiruvananthapuram',
        stateName: 'Kerala',
        regionName: 'Thiruvananthapuram',
      }),
    ],
    'local',
  )
  assert.equal(lookup.found, true)
  assert.equal(lookup.askPostOffice, false)
  assert.equal(lookup.common.postOffice, 'Thiruvananthapuram GPO')
  assert.equal(lookup.common.district, 'Thiruvananthapuram')
  assert.equal(lookup.common.state, 'Kerala')
  assert.equal(lookup.common.region, 'Thiruvananthapuram')
  const location = locationFromLookup(lookup)
  assert.equal(location.postOffice, 'Thiruvananthapuram GPO')
  assert.equal(location.taluk, undefined)
})

test('multiple offices share district/state and default to the single SO (scenario B)', () => {
  const offices = [
    office({ pincode: '685561', officeName: 'Anaviratty', officeType: 'BO', districtName: 'Idukki', stateName: 'Kerala', regionName: 'Kochi' }),
    office({ pincode: '685561', officeName: 'Adimali', officeType: 'SO', districtName: 'Idukki', stateName: 'Kerala', regionName: 'Kochi' }),
    office({ pincode: '685561', officeName: 'Valara', officeType: 'BO', districtName: 'Idukki', stateName: 'Kerala', regionName: 'Kochi' }),
  ]
  const lookup = summarizePostalOffices('685561', offices, 'local')
  assert.equal(lookup.found, true)
  assert.equal(lookup.askPostOffice, true)
  assert.equal(defaultPostOffice(offices), 'Adimali')
  assert.equal(lookup.common.district, 'Idukki')
  assert.equal(lookup.common.state, 'Kerala')
  assert.equal(lookup.common.region, 'Kochi')
  assert.equal(lookup.common.postOffice, 'Adimali')
  const selected = locationFromLookup(lookup, 'Valara')
  assert.equal(selected.postOffice, 'Valara')
  assert.equal(selected.district, 'Idukki')
  assert.equal(selected.taluk, undefined)
})

test('valid PIN with no offices still lets the user continue (scenario C)', () => {
  const lookup = summarizePostalOffices('111111', [], 'none')
  assert.equal(lookup.found, false)
  assert.equal(lookup.askPostOffice, false)
  assert.deepEqual(locationFromLookup(lookup), {})
})

test('does not invent taluk when the source omitted it', () => {
  const row = mapDirectoryRow({
    pincode: '685531',
    office_name: 'Peermade',
    office_type: 'SO',
    district_name: 'Idukki',
    state_name: 'Kerala',
    region_name: 'Kochi',
    taluk_name: null,
  })
  assert.equal(row.talukName, null)
  const lookup = summarizePostalOffices('685531', [row], 'local')
  assert.equal(lookup.common.taluk, null)
  assert.equal(locationFromLookup(lookup).taluk, undefined)
})

test('selected office supplies its own taluk when offices disagree', () => {
  const offices = [
    office({
      pincode: '685561',
      officeName: 'Adimali',
      officeType: 'SO',
      districtName: 'Idukki',
      stateName: 'Kerala',
      regionName: 'Kochi',
      talukName: 'Devikulam',
    }),
    office({
      pincode: '685561',
      officeName: 'Valara',
      officeType: 'BO',
      districtName: 'Idukki',
      stateName: 'Kerala',
      regionName: 'Kochi',
      talukName: 'Idukki',
    }),
  ]
  const lookup = summarizePostalOffices('685561', offices, 'local')
  assert.equal(lookup.common.taluk, null)
  const selected = locationFromLookup(lookup, 'Valara')
  assert.equal(selected.postOffice, 'Valara')
  assert.equal(selected.state, 'Kerala')
  assert.equal(selected.postalRegion, 'Kochi')
  assert.equal(selected.taluk, 'Idukki')
  const identity = postalIdentityFromLookup(lookup, 'Valara')
  assert.equal(identity.postOffice, 'Valara')
  assert.equal(identity.state, 'Kerala')
  assert.equal(identity.postalRegion, 'Kochi')
  assert.equal(identity.taluk, 'Idukki')
})

test('PIN lookup identity fills post office, state, region, and taluk — not only district', () => {
  const lookup = summarizePostalOffices(
    '695001',
    [
      office({
        pincode: '695001',
        officeName: 'Thiruvananthapuram GPO',
        officeType: 'HO',
        districtName: 'Thiruvananthapuram',
        stateName: 'Kerala',
        regionName: 'Thiruvananthapuram',
        talukName: 'Thiruvananthapuram',
      }),
    ],
    'local',
  )
  const prev = {
    fullName: 'Joseph',
    district: '',
    postOffice: '',
    state: '',
    postalRegion: '',
    taluk: '',
  }
  const next = withPostalIdentity(prev, postalIdentityFromLookup(lookup))
  assert.equal(next.district, 'Thiruvananthapuram')
  assert.equal(next.postOffice, 'Thiruvananthapuram GPO')
  assert.equal(next.state, 'Kerala')
  assert.equal(next.postalRegion, 'Thiruvananthapuram')
  assert.equal(next.taluk, 'Thiruvananthapuram')
})
