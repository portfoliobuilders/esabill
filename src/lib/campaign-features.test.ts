import assert from 'node:assert/strict'
import test from 'node:test'

import {
  identityRequired,
  parseFeatureSettings,
  publicAiAvailable,
  DEFAULT_FEATURE_SETTINGS,
} from './campaign-features'
import { applyFieldMode, fieldMode, isFieldEnabled, isFieldRequired, normalizeFormFields } from './form-fields'

test('feature settings default ESA-safe: AI off, privacy off, PIN/voice/read-aloud on', () => {
  const parsed = parseFeatureSettings(undefined)
  assert.equal(parsed.enable_ai_mail, false)
  assert.equal(parsed.allow_privacy_mode, false)
  assert.equal(parsed.enable_pin_lookup, true)
  assert.equal(parsed.enable_voice_input, true)
  assert.equal(parsed.enable_mail_read_aloud, true)
  assert.equal(parsed.ai_provider, 'disabled')
  assert.equal(parsed.identity_mode, 'required')
})

test('unknown provider falls back to disabled', () => {
  const parsed = parseFeatureSettings({ ai_provider: 'openai', enable_ai_mail: true })
  assert.equal(parsed.ai_provider, 'disabled')
  assert.equal(publicAiAvailable(parsed, true), false)
})

test('privacy mode turns off identity requirement', () => {
  const settings = parseFeatureSettings({ ...DEFAULT_FEATURE_SETTINGS, allow_privacy_mode: true })
  assert.equal(identityRequired(settings, false), true)
  assert.equal(identityRequired(settings, true), false)
})

test('phone and address stay disabled unless admin enables them', () => {
  const fields = normalizeFormFields(null)
  assert.equal(fieldMode(fields, 'phone'), 'disabled')
  assert.equal(fieldMode(fields, 'address'), 'disabled')
  assert.equal(isFieldEnabled(fields, 'name'), true)
  assert.equal(isFieldRequired(fields, 'name'), true)
  assert.equal(isFieldEnabled(fields, 'pincode'), true)
  assert.equal(isFieldRequired(fields, 'pincode'), false)
  const phone = applyFieldMode(fields.find((field) => field.field_key === 'phone')!, 'optional')
  assert.equal(phone.is_enabled, true)
  assert.equal(phone.is_required, false)
})
