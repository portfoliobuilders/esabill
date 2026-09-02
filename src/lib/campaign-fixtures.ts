import type { Campaign, ObjectionClause } from '@/types/database'

/** Test-only campaign. Not imported by public or admin runtime pages. */
const FIXTURE_CAMPAIGN_ID = '00000000-0000-4000-8000-0000000000ea'

export const fixtureCampaign: Campaign = {
  id: FIXTURE_CAMPAIGN_ID,
  slug: 'esa-draft-notification',
  title_ml: 'പരിസ്ഥിതിലോല പ്രദേശം (ESA) — കരട് വിജ്ഞാപനം',
  title_en: 'Ecologically Sensitive Area (ESA) — Draft Notification',
  summary_ml: 'കരട് ഇ.എസ്.എ. വിജ്ഞാപനത്തിലെ അതിർത്തിനിർണയത്തിൽ അപാകതകളുണ്ടെന്ന ആശങ്ക.',
  summary_en: 'Concerns about boundary demarcation in the ESA draft notification.',
  recipient_email: 'esz-mef@nic.in',
  recipient_emails: ['esz-mef@nic.in'],
  cc_emails: [
    'min.for@kerala.gov.in',
    'prlsecy.forest@kerala.gov.in',
    'pccf.for@kerala.gov.in',
    'cww.for@kerala.gov.in',
    'pccf-d.for@kerala.gov.in',
    'pccf-flr.for@kerala.gov.in',
    'environmentdirectorate@gmail.com',
    'envt.dir@kerala.gov.in',
  ],
  bcc_emails: ['esacomplaints2026@gmail.com'],
  reply_to_email: null,
  subject_ml: 'പരിസ്ഥിതിലോല പ്രദേശം (ESA) കരട് വിജ്ഞാപനവുമായി ബന്ധപ്പെട്ട നിവേദനം',
  subject_en: 'Representation regarding Ecologically Sensitive Area (ESA) Draft Notification',
  intro_ml: 'കരട് ഇ.എസ്.എ. വിജ്ഞാപനത്തിലെ അതിർത്തിനിർണയത്തെയും ഭൂപടങ്ങളെയും കുറിച്ച് ഞാൻ താഴെപ്പറയുന്ന ആശങ്ക രേഖപ്പെടുത്തുന്നു.',
  intro_en: 'I submit the following representation regarding the draft Ecologically Sensitive Area (ESA) notification.',
  homepage_intro_ml: 'കരട് ഇ.എസ്.എ. വിജ്ഞാപനത്തിലെ അതിർത്തിനിർണയത്തിൽ അപാകതകളുണ്ടെന്ന ആശങ്ക.',
  homepage_intro_en: 'Concerns about boundary demarcation in the ESA draft notification.',
  source_url: 'https://moef.gov.in/',
  reference_url: null,
  closing_ml: 'ഇതിനാവശ്യമായ നടപടികൾ സ്വീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.',
  closing_en: 'Necessary steps are requested to be taken in this regard.',
  body_template_ml: `{{intro}}

{{concerns}}

{{closing}}

പേര്: {{full_name}}
പിൻകോഡ്: {{pincode}}
ജില്ല: {{district}}

ആദരപൂർവ്വം,
{{full_name}}`,
  body_template_en: `{{intro}}

{{concerns}}

{{closing}}

Name: {{full_name}}
PIN: {{pincode}}
District: {{district}}

Regards,
{{full_name}}`,
  opens_at: '2026-07-27T00:00:00+05:30',
  deadline_at: '2026-09-25T18:29:59+05:30',
  is_active: true,
  status: 'active',
  publish_status: 'live',
  allow_multiple_concerns: false,
  og_title_en: 'Ecologically Sensitive Area (ESA) — Draft Notification',
  og_title_ml: 'പരിസ്ഥിതിലോല പ്രദേശം (ESA) — കരട് വിജ്ഞാപനം',
  og_description_en: 'Concerns about boundary demarcation and maps in the ESA draft notification.',
  og_description_ml: 'കരട് ഇ.എസ്.എ. വിജ്ഞാപനത്തിലെ അതിർത്തിനിർണയത്തിൽ അപാകതകളുണ്ടെന്ന ആശങ്ക.',
  social_image_url: null,
  explainer_ml: [],
  explainer_en: [],
  concern_selection_mode: 'single',
  max_concern_selections: null,
  allow_custom_concern: true,
  custom_concern_label_en: null,
  custom_concern_label_ml: null,
  custom_concern_placeholder_en: null,
  custom_concern_placeholder_ml: null,
  created_at: '2026-07-27T00:00:00+05:30',
}

function clause(
  index: number,
  code: string,
  titleEn: string,
  titleMl: string,
  emailEn: string,
  emailMl: string,
): ObjectionClause {
  return {
    id: `00000000-0000-4000-8000-0000000000e${index}`,
    campaign_id: FIXTURE_CAMPAIGN_ID,
    code,
    section_ref: null,
    title_ml: titleMl,
    title_en: titleEn,
    explain_ml: emailMl.slice(0, 180),
    explain_en: emailEn.slice(0, 180),
    email_ml: emailMl,
    email_en: emailEn,
    full_text_ml: emailMl,
    full_text_en: emailEn,
    full_url: null,
    sort_order: index,
    is_active: true,
  }
}

export const fixtureClauses: ObjectionClause[] = [
  clause(
    1,
    'ESA1',
    'Do not designate ESA areas solely on the basis of revenue-village boundaries.',
    'റവന്യൂ വില്ലേജിന്റെ അതിർത്തി മാത്രം അടിസ്ഥാനമാക്കി ഒരു പ്രദേശത്തെ മുഴുവനായും ഇ.എസ്.എ. ആയി പ്രഖ്യാപിക്കരുത്.',
    'I request that Ecologically Sensitive Areas be identified based on accurate geographical, environmental, and ground-level assessment rather than automatically including an entire revenue village within the ESA boundary.\n\nNecessary steps are requested to be taken in this regard.',
    'യഥാർത്ഥ ഭൂമിശാസ്ത്ര, പരിസ്ഥിതി, സ്ഥലപരിശോധന വിവരങ്ങളുടെ അടിസ്ഥാനത്തിൽ പരിസ്ഥിതിലോല പ്രദേശങ്ങൾ കൃത്യമായി നിർണയിക്കണമെന്നും ഒരു റവന്യൂ വില്ലേജിനെ മുഴുവനായും സ്വമേധയാ ഇ.എസ്.എ. പരിധിയിൽ ഉൾപ്പെടുത്തരുതെന്നും അഭ്യർത്ഥിക്കുന്നു.\n\nഇതിനാവശ്യമായ നടപടികൾ സ്വീകരിക്കണം.',
  ),
  clause(
    2,
    'ESA2',
    'Protect legally occupied homes, agricultural land, and livelihoods.',
    'നിയമാനുസൃതമായി കൈവശമുള്ള വീടുകൾ, കൃഷിയിടങ്ങൾ, ഉപജീവന മാർഗങ്ങൾ എന്നിവ സംരക്ഷിക്കുക.',
    'I have been residing on my property for years with the relevant legal documents and have been regularly paying land tax.\n\nI request that no administrative action connected with the ESA notification should unnecessarily result in the loss of legally occupied homes, agricultural land, farming activities, or legitimate sources of livelihood.\n\nNecessary steps are requested to be taken in this regard.',
    'മതിയായ നിയമാനുസൃത രേഖകളോടെ ഞാൻ വർഷങ്ങളായി ഭൂനികുതി അടച്ച് സ്ഥിരമായി താമസിക്കുകയും കൃഷി നടത്തുകയും ചെയ്യുന്ന വീടും ഭൂമിയും കൃഷിയിടങ്ങളും നിയമാനുസൃതമായ ഉപജീവന മാർഗങ്ങളും അനാവശ്യമായി നഷ്ടപ്പെടുന്ന സാഹചര്യം ഉണ്ടാകാതിരിക്കാനുള്ള നടപടികൾ സ്വീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.',
  ),
  clause(
    3,
    'ESA3',
    'Exclude residential and inhabited areas from the ESA boundary.',
    'ജനവാസ കേന്ദ്രങ്ങളെ ഇ.എസ്.എ. പരിധിയിൽ നിന്ന് ഒഴിവാക്കുക.',
    'I request that residential and inhabited areas be excluded from the ESA boundary and that the final notification be issued only after accurately identifying the areas that genuinely require ecological protection.\n\nNecessary steps are requested to be taken in this regard.',
    'ജനവാസ കേന്ദ്രങ്ങളെ പൂർണ്ണമായും ഇ.എസ്.എ. പരിധിയിൽ നിന്ന് ഒഴിവാക്കി, യഥാർത്ഥ പരിസ്ഥിതിലോല പ്രദേശങ്ങളെ കൃത്യമായി നിർണയിച്ച ശേഷം അന്തിമ വിജ്ഞാപനം പ്രസിദ്ധീകരിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.\n\nഇതിനാവശ്യമായ നടപടികൾ സ്വീകരിക്കണം.',
  ),
  clause(
    4,
    'ESA4',
    'Prevent actions that could unnecessarily affect legally held homes, farms, and livelihoods.',
    'വീടുകളും കൃഷിയിടങ്ങളും വരുമാന മാർഗങ്ങളും നഷ്ടപ്പെടുന്ന സാഹചര്യം ഒഴിവാക്കുക.',
    'I have been residing on my property for years with the relevant documents and have regularly paid the applicable land tax.\n\nI request that appropriate safeguards be implemented so that actions arising from the ESA process do not unnecessarily affect my legally held home, agricultural land, farming activities, or legitimate sources of income.',
    'മതിയായ രേഖകളോടെ വർഷങ്ങളായി ഭൂനികുതി അടച്ച് സ്ഥിരമായി താമസിക്കുന്ന എന്റെ വീടും കൃഷിയിടങ്ങളും നിയമാനുസൃതമായ വരുമാന മാർഗങ്ങളും നഷ്ടപ്പെടുന്ന രീതിയിലുള്ള നടപടികൾ ഒഴിവാക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.\n\nഇതിനാവശ്യമായ നടപടികൾ സ്വീകരിക്കണം.',
  ),
]
