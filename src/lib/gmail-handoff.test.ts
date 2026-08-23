import assert from 'node:assert/strict'
import test from 'node:test'

import { androidGmailAppIntent, gmailAppComposeUrl, gmailComposeUrl } from './compose'
import { clientPlatform, isEmbeddedBrowser, planGmailHandoff } from './gmail-handoff'

const params = {
  to: ['min.for@kerala.gov.in'],
  cc: ['prlsecy.forest@kerala.gov.in'],
  bcc: ['archive@example.test'],
  subject: 'ESA objection',
  body: 'Please record this objection.',
}

test('mail platforms', () => {
  assert.equal(clientPlatform('Mozilla/5.0 (Linux; Android 14) Chrome/120'), 'android')
  assert.equal(clientPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios')
  assert.equal(clientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 5), 'ios')
  assert.equal(clientPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'other')
})

test('embedded browsers include WhatsApp and Android WebView', () => {
  assert.equal(isEmbeddedBrowser('Mozilla/5.0 WhatsApp/2.24.0'), true)
  assert.equal(
    isEmbeddedBrowser('Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36'),
    true,
  )
  assert.equal(isEmbeddedBrowser('Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36'), false)
})

test('Android Chrome opens Gmail in-app via an https intent, not a browser tab', () => {
  const plan = planGmailHandoff(params, 'android', 'Mozilla/5.0 (Linux; Android 14) Chrome/120')
  const web = gmailComposeUrl(params)
  assert.equal(plan.native, true)
  assert.equal(plan.openInNewTab, false)
  assert.equal(plan.fallbackToWeb, true)
  assert.equal(plan.href, androidGmailAppIntent(web))
  assert.match(plan.href, /^intent:\/\/mail\.google\.com\/mail\//)
  assert.match(plan.href, /package=com\.google\.android\.gm/)
  assert.match(plan.href, /scheme=https/)
  assert.ok(plan.href.includes(encodeURIComponent(web)))
  assert.ok(plan.href.includes('to=min.for%40kerala.gov.in'))
})

test('WhatsApp in-app browser uses the Gmail app URL so it does not bounce to Chrome', () => {
  const plan = planGmailHandoff(params, 'android', 'Mozilla/5.0 WhatsApp/2.24.0')
  assert.equal(plan.native, true)
  assert.equal(plan.openInNewTab, false)
  assert.equal(plan.fallbackToWeb, true)
  assert.equal(plan.href, gmailAppComposeUrl(params))
  assert.match(plan.href, /^googlegmail:\/\/\/co\?/)
  assert.match(plan.href, /to=min\.for%40kerala\.gov\.in/)
  assert.match(plan.href, /subject=ESA%20objection/)
  assert.doesNotMatch(plan.href, /undefined/)
})

test('iPhone opens the Gmail app, with Gmail web as a same-window fallback', () => {
  const plan = planGmailHandoff(params, 'ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
  assert.equal(plan.native, true)
  assert.equal(plan.openInNewTab, false)
  assert.equal(plan.fallbackToWeb, true)
  assert.equal(plan.href, gmailAppComposeUrl(params))
  assert.equal(plan.webUrl, gmailComposeUrl(params))
})

test('desktop still uses Gmail in a new browser tab', () => {
  const plan = planGmailHandoff(params, 'other', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  assert.equal(plan.native, false)
  assert.equal(plan.openInNewTab, true)
  assert.equal(plan.href, gmailComposeUrl(params))
})
