import assert from 'node:assert/strict'
import test from 'node:test'

import { androidSendIntent, formatUnsentEml, gmailAppComposeUrl, gmailComposeUrl, mailtoUrl } from './compose'
import { clientMailPlatform, planMailLaunch } from './open-mail'

const longMalayalam = 'മലയാളം കത്ത് '.repeat(400)
const params = {
  to: ['min.for@kerala.gov.in'],
  cc: ['prlsecy.forest@kerala.gov.in'],
  bcc: ['archive@example.test'],
  subject: 'ESA objection',
  body: longMalayalam,
}

test('mail platforms', () => {
  assert.equal(clientMailPlatform('Mozilla/5.0 (Linux; Android 14) Chrome/120'), 'android')
  assert.equal(clientMailPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios')
  assert.equal(clientMailPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 5), 'ios')
  assert.equal(clientMailPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'other')
})

test('long letters still include the full body in mailto, Gmail, Android, and eml', () => {
  const mail = mailtoUrl(params)
  const gmail = gmailComposeUrl(params)
  const app = gmailAppComposeUrl(params)
  const eml = formatUnsentEml(params)
  const encodedBody = encodeURIComponent(params.body)
  assert.ok(mail.includes(encodedBody), 'mailto must keep the full body')
  assert.ok(gmail.includes(encodedBody), 'gmail compose must keep the full body')
  assert.ok(app.includes(encodedBody), 'gmail app compose must keep the full body')
  assert.ok(eml.includes(params.body), 'eml draft must keep the full body')
  assert.match(eml, /^X-Unsent: 1\r\n/)
})

test('send never falls back to a body-less compose URL', () => {
  const longAndroid = planMailLaunch(params, 'mail_app', 'android')
  assert.ok(longAndroid.kind === 'android_intent' || longAndroid.kind === 'eml')
  if (longAndroid.kind === 'android_intent') {
    assert.equal(longAndroid.gmailOnly, false)
  }

  const gmailPlan = planMailLaunch(params, 'gmail', 'other')
  assert.ok(gmailPlan.kind === 'mailto_url' || gmailPlan.kind === 'eml')

  const androidGmail = planMailLaunch(params, 'gmail', 'android')
  assert.equal(androidGmail.kind, 'gmail_native')

  const iosPlan = planMailLaunch(params, 'mail_app', 'ios')
  assert.ok(iosPlan.kind === 'mailto_url' || iosPlan.kind === 'eml')
  if (iosPlan.kind === 'mailto_url') {
    assert.ok(mailtoUrl(params).includes(encodeURIComponent(params.body)))
  }

  const desktopPlan = planMailLaunch(params, 'mail_app', 'other')
  assert.ok(desktopPlan.kind === 'mailto_url' || desktopPlan.kind === 'eml')
  if (desktopPlan.kind === 'mailto_url') {
    assert.ok(mailtoUrl(params).includes(encodeURIComponent(params.body)))
  }
})

test('Android intent opens a mail app, not the share/copy sheet', () => {
  const intent = androidSendIntent(params, { fallbackUrl: mailtoUrl(params) })
  assert.match(intent, /^intent:\/\//)
  assert.match(intent, /scheme=mailto/)
  assert.match(intent, /action=android\.intent\.action\.SENDTO/)
  assert.doesNotMatch(intent, /action=android\.intent\.action\.SEND;/)
  assert.doesNotMatch(intent, /android\.intent\.extra\.TEXT/)
  assert.ok(intent.includes(encodeURIComponent(params.body)))
})

test('short letters open Gmail and iOS mail with the body in the link', () => {
  const short = { ...params, body: 'Short letter body' }
  assert.equal(planMailLaunch(short, 'gmail', 'other').kind, 'gmail_url')
  assert.equal(planMailLaunch(short, 'mail_app', 'ios').kind, 'mailto_url')
  assert.equal(planMailLaunch(short, 'mail_app', 'android').kind, 'mailto_url')
  assert.equal(planMailLaunch(short, 'gmail', 'android').kind, 'gmail_native')
  assert.equal(planMailLaunch(short, 'gmail', 'ios').kind, 'gmail_native')
  assert.equal(planMailLaunch(short, 'mail_app', 'other').kind, 'mailto_url')
})
