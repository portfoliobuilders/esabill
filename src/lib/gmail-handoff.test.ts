import assert from 'node:assert/strict'
import test from 'node:test'

import { androidGmailAppComposeIntent, gmailAppComposeUrl, gmailComposeUrl, gmailUrlTooLong } from './compose'
import { clientPlatform, gmailFallbackHref, isEmbeddedBrowser, planGmailHandoff } from './gmail-handoff'

const params = {
  to: ['min.for@kerala.gov.in'],
  cc: ['prlsecy.forest@kerala.gov.in'],
  bcc: ['archive@example.test'],
  subject: 'ESA objection',
  body: 'Please record this objection.',
}

const longMalayalam = {
  ...params,
  subject: 'Western Ghats ESA കരട് വിജ്ഞാപനം — പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി',
  body: 'മലയാളം കത്ത് '.repeat(80),
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

test('Android Chrome opens Gmail in-app via googlegmail intent, with the full body', () => {
  const plan = planGmailHandoff(params, 'android', 'Mozilla/5.0 (Linux; Android 14) Chrome/120')
  assert.equal(plan.native, true)
  assert.equal(plan.openInNewTab, false)
  assert.equal(plan.includeBody, true)
  assert.equal(plan.href, androidGmailAppComposeIntent(params, plan.fallbackHref))
  assert.match(plan.href, /^intent:\/\//)
  assert.match(plan.href, /scheme=googlegmail/)
  assert.match(plan.href, /package=com\.google\.android\.gm/)
  assert.ok(plan.href.includes(encodeURIComponent(params.body)))
  assert.ok(plan.href.includes('to=min.for%40kerala.gov.in'))
})

test('WhatsApp in-app browser uses the Gmail app URL so it does not bounce to Chrome', () => {
  const plan = planGmailHandoff(params, 'android', 'Mozilla/5.0 WhatsApp/2.24.0')
  assert.equal(plan.native, true)
  assert.equal(plan.openInNewTab, false)
  assert.equal(plan.fallbackToWeb, false)
  assert.equal(plan.includeBody, true)
  assert.equal(plan.href, gmailAppComposeUrl(params))
  assert.match(plan.href, /^googlegmail:\/\/\/co\?/)
  assert.match(plan.href, /to=min\.for%40kerala\.gov\.in/)
  assert.match(plan.href, /subject=ESA%20objection/)
  assert.ok(plan.href.includes(encodeURIComponent(params.body)))
})

test('iPhone opens the Gmail app, with a same-window fallback that still has the letter', () => {
  const plan = planGmailHandoff(params, 'ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
  assert.equal(plan.native, true)
  assert.equal(plan.openInNewTab, false)
  assert.equal(plan.fallbackToWeb, true)
  assert.equal(plan.includeBody, true)
  assert.equal(plan.href, gmailAppComposeUrl(params))
  assert.equal(plan.fallbackHref, gmailFallbackHref(params, 'ios'))
  assert.ok(plan.href.includes(encodeURIComponent(params.body)))
})

test('desktop still uses Gmail in a new browser tab when the web URL fits', () => {
  const plan = planGmailHandoff(params, 'other', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  assert.equal(plan.native, false)
  assert.equal(plan.openInNewTab, true)
  assert.equal(plan.includeBody, true)
  assert.equal(plan.href, gmailComposeUrl(params))
})

test('long Malayalam letters stay in the Gmail app URL, not the 8KB web compose URL', () => {
  assert.equal(gmailUrlTooLong(longMalayalam), true)
  const encoded = encodeURIComponent(longMalayalam.body)

  const android = planGmailHandoff(longMalayalam, 'android', 'Mozilla/5.0 (Linux; Android 14) Chrome/120')
  assert.equal(android.includeBody, true)
  assert.match(android.href, /scheme=googlegmail/)
  assert.ok(android.href.includes(encoded))
  assert.doesNotMatch(android.href, /mail\.google\.com/)

  const whatsapp = planGmailHandoff(longMalayalam, 'android', 'Mozilla/5.0 WhatsApp/2.24.0')
  assert.equal(whatsapp.includeBody, true)
  assert.ok(whatsapp.href.startsWith('googlegmail:///co?'))
  assert.ok(whatsapp.href.includes(encoded))

  const ios = planGmailHandoff(longMalayalam, 'ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
  assert.equal(ios.includeBody, true)
  assert.ok(ios.href.includes(encoded))

  const desktop = planGmailHandoff(longMalayalam, 'other', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  assert.equal(desktop.includeBody, true)
  assert.match(desktop.href, /^mailto:/)
  assert.ok(desktop.href.includes(encoded))
})
