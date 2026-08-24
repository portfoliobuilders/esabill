import assert from 'node:assert/strict'
import test from 'node:test'

import { composeEmail } from './compose'
import { identityBlock, privacyLetter } from './compose-identity'
import { fixtureCampaign, fixtureClauses } from './campaign-fixtures'

const identityDetails = {
  fullName: 'Joseph Mathew',
  pincode: '685531',
  phone: '',
  addressLine: '',
  postOffice: 'Adimali',
  district: 'Idukki',
  state: 'Kerala',
  postalRegion: 'Kochi',
  taluk: 'Devikulam',
}

test('identity block omits empty lines', () => {
  const block = identityBlock(identityDetails, 'en')
  assert.equal(
    block,
    [
      'Name: Joseph Mathew',
      'PIN Code: 685531',
      'Post Office: Adimali',
      'District: Idukki',
      'State: Kerala',
      'Postal Region: Kochi',
      'Taluk: Devikulam',
    ].join('\n'),
  )
  assert.doesNotMatch(block, /Phone/)
  assert.doesNotMatch(block, /Address/)
})

test('privacy letter contains campaign and concern, not personal location', () => {
  const body = privacyLetter({
    campaign: fixtureCampaign,
    clauses: [fixtureClauses[0]],
    extraConcerns: ['Keep the river accessible'],
    lang: 'en',
  })
  assert.match(body, /Dear Sir\/Madam/)
  assert.match(body, /A concerned citizen/)
  assert.match(body, /Keep the river accessible/)
  assert.match(body, new RegExp(fixtureClauses[0].title_en))
  assert.doesNotMatch(body, /Joseph/)
  assert.doesNotMatch(body, /685531/)
  assert.doesNotMatch(body, /Adimali/)
  assert.doesNotMatch(body, /Idukki/)
})

test('compose with privacyMode drops name, PIN, and office from the email', () => {
  const result = composeEmail({
    campaign: {
      ...fixtureCampaign,
      body_template_en: '{{intro}}\n\n{{concerns}}\n\n{{identity_block}}',
    },
    clauses: [fixtureClauses[0]],
    details: {
      fullName: 'Joseph Mathew',
      addressLine: 'Hill Road',
      panchayat: 'Adimali',
      district: 'Idukki',
      pincode: '685561',
      phone: '9876543210',
      email: 'joseph@example.com',
      extraConcerns: ['Custom note with a PIN 685561 inside'],
      postOffice: 'Adimali',
      state: 'Kerala',
      postalRegion: 'Kochi',
      privacyMode: true,
    },
    lang: 'en',
  })
  assert.match(result.body, /Dear Sir\/Madam/)
  assert.match(result.body, /A concerned citizen/)
  assert.doesNotMatch(result.body, /Name: Joseph Mathew/)
  assert.doesNotMatch(result.body, /PIN Code: 685561/)
  assert.doesNotMatch(result.body, /Post Office: Adimali/)
  assert.doesNotMatch(result.body, /Hill Road/)
  assert.doesNotMatch(result.body, /9876543210/)
})

test('identified compose includes resolved location via identity_block', () => {
  const result = composeEmail({
    campaign: {
      ...fixtureCampaign,
      body_template_en: '{{concerns}}\n\n{{identity_block}}',
    },
    clauses: [fixtureClauses[0]],
    details: {
      fullName: 'Joseph Mathew',
      addressLine: '',
      panchayat: '',
      district: 'Idukki',
      pincode: '685561',
      phone: '',
      email: '',
      postOffice: 'Adimali',
      state: 'Kerala',
      postalRegion: 'Kochi',
      taluk: 'Devikulam',
    },
    lang: 'en',
  })
  assert.match(result.body, /Name: Joseph Mathew/)
  assert.match(result.body, /PIN Code: 685561/)
  assert.match(result.body, /Post Office: Adimali/)
  assert.match(result.body, /District: Idukki/)
  assert.match(result.body, /State: Kerala/)
  assert.match(result.body, /Postal Region: Kochi/)
  assert.match(result.body, /Taluk: Devikulam/)
  assert.doesNotMatch(result.body, /Phone Number:/)
})
