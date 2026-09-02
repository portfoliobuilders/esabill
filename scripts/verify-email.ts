import assert from 'node:assert/strict'

import { fixtureCampaign, fixtureClauses } from '../src/lib/campaign-fixtures'
import {
  composeEmail,
  formatCompleteEmailCopy,
  androidSendIntent,
  formatUnsentEml,
  gmailAppComposeUrl,
  androidGmailAppIntent,
  gmailComposeUrl,
  liveMailTargets,
  mailtoUrl,
  mailtoUrlTooLong,
  resolveMailTargets,
  uniqueEmails,
} from '../src/lib/compose'
import { normalizeIndianPhone } from '../src/lib/phone'

const details = {
  fullName: 'Test Citizen',
  phone: normalizeIndianPhone('+919876543210') ?? '+919876543210',
  addressLine: 'Test House, Test Road',
  panchayat: 'Test Panchayat',
  district: 'Idukki',
  pincode: '685531',
  email: 'test@example.com',
}

const full = composeEmail({
  campaign: { ...fixtureCampaign, concern_selection_mode: 'multiple' },
  clauses: fixtureClauses,
  details,
  lang: 'ml',
})

assert.equal(full.subject, fixtureCampaign.subject_ml)
assert.match(full.body, /വിഷയങ്ങൾ:/)
for (let i = 1; i <= 4; i += 1) {
  assert.match(full.body, new RegExp(`^${i}\\. `, 'm'))
}
assert.match(full.body, /പേര്: Test Citizen/)
assert.match(full.body, /പിൻകോഡ്: 685531/)
assert.match(full.body, /ജില്ല: Idukki/)
assert.doesNotMatch(full.body, /5\. /)
assert.doesNotMatch(full.body, /Forest Officer/)
assert.doesNotMatch(full.body, /Bill 228/)

const selected = composeEmail({
  campaign: { ...fixtureCampaign, concern_selection_mode: 'multiple' },
  clauses: fixtureClauses.filter((clause) => clause.sort_order <= 2),
  details: { ...details, customText: 'എന്റെ സ്വന്തം അനുഭവം', extraConcerns: ['എന്റെ സ്വന്തം അനുഭവം'] },
  lang: 'ml',
})
assert.match(selected.body, /^1\. /m)
assert.match(selected.body, /^2\. /m)
assert.doesNotMatch(selected.body, /^3\. /m)
assert.match(selected.body, /എന്റെ സ്വന്തം അനുഭവം/)

const single = composeEmail({
  campaign: { ...fixtureCampaign, concern_selection_mode: 'single' },
  clauses: [fixtureClauses[2]],
  details: {
    ...details,
    extraConcerns: ['My property has been excluded incorrectly...'],
  },
  lang: 'en',
})
assert.equal(single.subject, fixtureClauses[2].title_en)
assert.match(single.body, /Selected Concern:/)
assert.match(single.body, /Additional Concern:/)
assert.match(single.body, /My property has been excluded incorrectly/)
assert.ok(single.body.includes(fixtureClauses[2].title_en))
assert.ok(!single.body.includes(fixtureClauses[0].title_en))
assert.doesNotMatch(single.body, /^2\. /m)

const targets = liveMailTargets(fixtureCampaign)
assert.deepEqual(targets.to, ['esz-mef@nic.in'])
assert.deepEqual(targets.cc, [
  'min.for@kerala.gov.in',
  'prlsecy.forest@kerala.gov.in',
  'pccf.for@kerala.gov.in',
  'cww.for@kerala.gov.in',
  'pccf-d.for@kerala.gov.in',
  'pccf-flr.for@kerala.gov.in',
  'environmentdirectorate@gmail.com',
  'envt.dir@kerala.gov.in',
])
assert.deepEqual(targets.bcc, ['esacomplaints2026@gmail.com'])
assert.deepEqual(uniqueEmails([...targets.to, ...targets.cc, ...targets.bcc]), [
  'esz-mef@nic.in',
  'min.for@kerala.gov.in',
  'prlsecy.forest@kerala.gov.in',
  'pccf.for@kerala.gov.in',
  'cww.for@kerala.gov.in',
  'pccf-d.for@kerala.gov.in',
  'pccf-flr.for@kerala.gov.in',
  'environmentdirectorate@gmail.com',
  'envt.dir@kerala.gov.in',
  'esacomplaints2026@gmail.com',
])

const dry = resolveMailTargets({
  campaign: fixtureCampaign,
  mode: 'demo',
  testerEmail: details.email,
})
assert.deepEqual(dry.to, ['test@example.com'])
assert.deepEqual(dry.cc, [])
assert.deepEqual(dry.bcc, [])
assert.equal(dry.dryRun, true)
assert.deepEqual(dry.liveTo, targets.to)
assert.deepEqual(dry.liveCc, targets.cc)
assert.deepEqual(dry.liveBcc, targets.bcc)

const live = resolveMailTargets({
  campaign: fixtureCampaign,
  mode: 'live',
  testerEmail: details.email,
})
assert.deepEqual(live.to, targets.to)
assert.deepEqual(live.cc, targets.cc)
assert.deepEqual(live.bcc, fixtureCampaign.bcc_emails)
assert.equal(live.dryRun, false)
assert.doesNotMatch(live.to.join(','), /test@example\.com/)

const gmail = gmailComposeUrl({
  to: targets.to,
  cc: targets.cc,
  subject: full.subject,
  body: selected.body,
})
const mail = mailtoUrl({
  to: targets.to,
  cc: targets.cc,
  subject: full.subject,
  body: selected.body,
})

assert.match(gmail, /to=esz-mef%40nic\.in/)
assert.match(gmail, /cc=min\.for%40kerala\.gov\.in/)
assert.match(gmail, /su=/)
assert.doesNotMatch(gmail, /Forest/)
assert.doesNotMatch(gmail, /undefined/)
assert.match(mail, /mailto:esz-mef%40nic\.in/)
assert.match(mail, /min\.for%40kerala\.gov\.in/)
assert.equal(
  mailtoUrlTooLong({ to: targets.to, cc: targets.cc, subject: full.subject, body: full.body }),
  false,
)

const copied = formatCompleteEmailCopy({
  to: targets.to,
  cc: targets.cc,
  subject: full.subject,
  body: full.body,
})
assert.match(copied, /To:\nesz-mef@nic\.in/)
assert.match(copied, /CC:\nmin\.for@kerala\.gov\.in/)
assert.ok(copied.includes(`Subject: ${full.subject}`))

const eml = formatUnsentEml({
  to: targets.to,
  cc: targets.cc,
  subject: full.subject,
  body: full.body,
})
assert.match(eml, /^X-Unsent: 1\r\n/)
assert.match(eml, /To: esz-mef@nic\.in/)
assert.match(eml, /Cc: min\.for@kerala\.gov\.in/)
assert.ok(eml.includes(full.body.replace(/\n/g, '\r\n')))

const intent = androidSendIntent(
  { to: targets.to, cc: targets.cc, subject: full.subject, body: full.body },
  { gmailOnly: true, fallbackUrl: 'https://mail.google.com/mail/?view=cm&fs=1' },
)
assert.match(intent, /^intent:\/\/send\/#Intent;/)
assert.match(intent, /package=com\.google\.android\.gm/)
assert.ok(intent.includes(encodeURIComponent(full.body)))
assert.ok(intent.includes(encodeURIComponent(full.subject)))
assert.doesNotMatch(intent, /undefined/)

const headersOnly = gmailComposeUrl(
  { to: targets.to, cc: targets.cc, subject: full.subject, body: full.body },
  { includeBody: false },
)
assert.doesNotMatch(headersOnly, /[?&]body=/)

const appUrl = gmailAppComposeUrl({
  to: targets.to,
  cc: targets.cc,
  subject: full.subject,
  body: selected.body,
})
assert.match(appUrl, /^googlegmail:\/\/\/co\?/)
assert.match(appUrl, /to=esz-mef%40nic\.in/)
assert.match(appUrl, /cc=min\.for%40kerala\.gov\.in/)
assert.match(appUrl, /subject=/)
assert.doesNotMatch(appUrl, /undefined/)
assert.ok(appUrl.includes(encodeURIComponent(selected.body)))

const appIntent = androidGmailAppIntent(gmail)
assert.match(appIntent, /^intent:\/\/mail\.google\.com\/mail\//)
assert.match(appIntent, /package=com\.google\.android\.gm/)
assert.match(appIntent, /scheme=https/)
assert.ok(appIntent.includes(encodeURIComponent(gmail)))
assert.ok(appIntent.endsWith(';end'))

const withBcc = {
  ...fixtureCampaign,
  bcc_emails: ['archive@example.test'],
}
const bccTargets = liveMailTargets(withBcc)
assert.deepEqual(bccTargets.bcc, ['archive@example.test'])
const gmailBcc = gmailComposeUrl({
  to: bccTargets.to,
  cc: bccTargets.cc,
  bcc: bccTargets.bcc,
  subject: full.subject,
  body: selected.body,
})
assert.match(gmailBcc, /bcc=archive%40example\.test/)
const copiedBcc = formatCompleteEmailCopy({
  to: bccTargets.to,
  cc: bccTargets.cc,
  bcc: bccTargets.bcc,
  subject: full.subject,
  body: full.body,
})
assert.match(copiedBcc, /BCC:\narchive@example\.test/)

console.log('compose checks passed')
console.log(`full body chars: ${full.charCount}`)
console.log(`gmail selected url length: ${gmail.length}`)
console.log(`mailto selected url length: ${mail.length}`)
console.log(`unsent eml chars: ${eml.length}`)
console.log(`android intent chars: ${intent.length}`)
