import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyPredefinedConcernClick,
  campaignConcernConfig,
  formatConcernsForEmail,
  validatePredefinedSelection,
} from './concern-selection'
import { composeEmail } from './compose'
import { fixtureCampaign, fixtureClauses } from './campaign-fixtures'

const details = {
  fullName: 'Ravi Kumar',
  addressLine: 'House',
  panchayat: 'Panchayat',
  district: 'Idukki',
  pincode: '685533',
  phone: '9876543210',
  email: 'ravi@example.com',
}

test('single select replaces the previous predefined concern', () => {
  const first = applyPredefinedConcernClick({
    mode: 'single',
    selectedIds: [],
    id: 'c1',
    maxSelections: null,
  })
  assert.deepEqual(first.selectedIds, ['c1'])
  const second = applyPredefinedConcernClick({
    mode: 'single',
    selectedIds: first.selectedIds,
    id: 'c2',
    maxSelections: null,
  })
  assert.deepEqual(second.selectedIds, ['c2'])
  assert.equal(second.limited, false)
})

test('multiple select keeps several predefined concerns', () => {
  let selected: string[] = []
  for (const id of ['c1', 'c2', 'c4']) {
    const next = applyPredefinedConcernClick({
      mode: 'multiple',
      selectedIds: selected,
      id,
      maxSelections: null,
    })
    assert.equal(next.limited, false)
    selected = next.selectedIds
  }
  assert.deepEqual(selected, ['c1', 'c2', 'c4'])
})

test('maximum selection blocks a further predefined concern', () => {
  const atMax = applyPredefinedConcernClick({
    mode: 'multiple',
    selectedIds: ['c1', 'c2'],
    id: 'c3',
    maxSelections: 2,
  })
  assert.deepEqual(atMax.selectedIds, ['c1', 'c2'])
  assert.equal(atMax.limited, true)
  assert.equal(
    validatePredefinedSelection({ mode: 'multiple', selectedIds: ['c1', 'c2', 'c3'], maxSelections: 2 }),
    'too_many',
  )
})

test('single mode email includes only the selected concern plus custom text', () => {
  const result = composeEmail({
    campaign: { ...fixtureCampaign, concern_selection_mode: 'single' },
    clauses: [fixtureClauses[2]],
    details: {
      ...details,
      extraConcerns: ['My property has been excluded incorrectly...'],
    },
    lang: 'en',
  })
  assert.match(result.body, /Concern:/)
  assert.ok(result.body.includes(fixtureClauses[2].title_en))
  assert.ok(result.body.includes(fixtureClauses[2].email_en))
  assert.ok(!result.body.includes(fixtureClauses[0].title_en))
  assert.ok(!result.body.includes(fixtureClauses[1].title_en))
  assert.match(result.body, /Additional Concern:/)
  assert.match(result.body, /My property has been excluded incorrectly/)
})

test('multiple mode email includes every selected concern then the custom concern', () => {
  const selected = [fixtureClauses[0], fixtureClauses[1], fixtureClauses[3]]
  const result = composeEmail({
    campaign: { ...fixtureCampaign, concern_selection_mode: 'multiple' },
    clauses: selected,
    details: { ...details, extraConcerns: ['A farm-specific note'] },
    lang: 'en',
  })
  assert.match(result.body, /Concerns:/)
  assert.ok(result.body.includes(`1. ${selected[0].title_en}`))
  assert.ok(result.body.includes(`2. ${selected[1].title_en}`))
  assert.ok(result.body.includes(`3. ${selected[2].title_en}`))
  assert.ok(!result.body.includes(fixtureClauses[2].title_en))
  assert.match(result.body, /Additional Concern:/)
  assert.match(result.body, /A farm-specific note/)
})

test('custom concern formatting stays available in both selection modes', () => {
  const extra = ['Keep this extra note']
  const single = formatConcernsForEmail({
    mode: 'single',
    clauses: [fixtureClauses[0]],
    extraConcerns: extra,
    lang: 'en',
  })
  const multiple = formatConcernsForEmail({
    mode: 'multiple',
    clauses: [fixtureClauses[0], fixtureClauses[1]],
    extraConcerns: extra,
    lang: 'en',
  })
  assert.match(single, /Additional Concern:/)
  assert.match(multiple, /Additional Concern:/)
  assert.match(single, /Keep this extra note/)
  assert.match(multiple, /Keep this extra note/)
})

test('campaign config defaults to single selection with custom concern on', () => {
  const config = campaignConcernConfig({
    concern_selection_mode: 'single',
    max_concern_selections: null,
    allow_custom_concern: true,
    custom_concern_label_en: null,
    custom_concern_label_ml: null,
    custom_concern_placeholder_en: null,
    custom_concern_placeholder_ml: null,
  })
  assert.equal(config.mode, 'single')
  assert.equal(config.maxSelections, null)
  assert.equal(config.allowCustomConcern, true)
  assert.equal(validatePredefinedSelection({ mode: 'single', selectedIds: [], maxSelections: null }), 'required')
  assert.equal(validatePredefinedSelection({ mode: 'single', selectedIds: ['c1'], maxSelections: null }), 'ok')
})

test('unknown selection mode falls back to single', () => {
  const config = campaignConcernConfig({
    concern_selection_mode: 'nope' as 'single',
    max_concern_selections: 3,
    allow_custom_concern: false,
    custom_concern_label_en: null,
    custom_concern_label_ml: null,
    custom_concern_placeholder_en: null,
    custom_concern_placeholder_ml: null,
  })
  assert.equal(config.mode, 'single')
  assert.equal(config.allowCustomConcern, false)
})
