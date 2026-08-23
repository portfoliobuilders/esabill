export type SendMethod = 'gmail_web' | 'mailto' | 'copy' | 'server' | 'print'

export type SubmissionStatus =
  | 'draft'
  | 'verified'
  | 'handoff_opened'
  | 'confirmed_sent'
  | 'server_sent'
  | 'failed'

export type RepLevel = 'mla' | 'mp_lok_sabha' | 'mp_rajya_sabha' | 'minister' | 'local_body'

/** Legacy publish_status values kept in sync with `status`. */
export type PublishStatus = 'draft' | 'preview' | 'live' | 'closed' | 'archived'

export type CampaignStatus = 'draft' | 'active' | 'inactive' | 'expired' | 'archived'

export type RecipientType = 'to' | 'cc' | 'bcc'

export type FormFieldKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'district'
  | 'village'
  | 'local_body'
  | 'address'
  | 'custom_message'
  | 'pincode'

export type AiBodyStatus = 'none' | 'draft' | 'approved'

export type Campaign = {
  id: string
  slug: string
  title_ml: string
  title_en: string
  summary_ml: string
  summary_en: string
  homepage_intro_ml: string
  homepage_intro_en: string
  recipient_email: string
  recipient_emails: string[]
  cc_emails: string[]
  bcc_emails: string[]
  reply_to_email: string | null
  subject_ml: string
  subject_en: string
  intro_ml: string
  intro_en: string
  closing_ml: string
  closing_en: string
  body_template_ml: string
  body_template_en: string
  source_url: string
  reference_url: string | null
  opens_at: string
  deadline_at: string | null
  is_active: boolean
  status: CampaignStatus
  publish_status: PublishStatus
  allow_multiple_concerns: boolean
  og_title_en: string
  og_title_ml: string
  og_description_en: string
  og_description_ml: string
  social_image_url: string | null
  explainer_ml: string[]
  explainer_en: string[]
  concern_selection_mode: 'single' | 'multiple'
  max_concern_selections: number | null
  allow_custom_concern: boolean
  custom_concern_label_en: string | null
  custom_concern_label_ml: string | null
  custom_concern_placeholder_en: string | null
  custom_concern_placeholder_ml: string | null
  feature_settings?: Record<string, unknown> | null
  created_at: string
  updated_at?: string
  updated_by?: string | null
  created_by?: string | null
}

export type ObjectionClause = {
  id: string
  campaign_id: string
  code: string
  section_ref: string | null
  title_ml: string
  title_en: string
  explain_ml: string
  explain_en: string
  email_ml: string
  email_en: string
  full_text_ml: string
  full_text_en: string
  email_subject_ml?: string
  email_subject_en?: string
  email_body_ml?: string
  email_body_en?: string
  ai_body_en?: string
  ai_body_ml?: string
  ai_body_en_status?: AiBodyStatus
  ai_body_ml_status?: AiBodyStatus
  full_url: string | null
  sort_order: number
  is_active: boolean
}

export type CampaignRecipient = {
  id: string
  campaign_id: string
  recipient_type: RecipientType
  email: string
  display_order: number
  is_active: boolean
}

export type CampaignFormField = {
  id: string
  campaign_id: string
  field_key: FormFieldKey
  label_en: string
  label_ml: string
  is_enabled: boolean
  is_required: boolean
  display_order: number
}

/** Supporting newspaper clippings / references. Never copied into composed emails. */
export type CampaignSource = {
  id: string
  campaign_id: string
  publication_name: string
  publication_date: string | null
  title_ml: string
  title_en: string
  description_ml: string
  description_en: string
  source_url: string | null
  file_url: string | null
  file_path?: string | null
  file_mime: string | null
  file_name: string | null
  is_public: boolean
  sort_order: number
  created_at: string
  updated_at?: string
  created_by?: string | null
}

export type SiteBranding = {
  brand_name_en: string
  brand_name_ml: string
  tagline_en: string
  tagline_ml: string
  logo_url: string | null
  favicon_url: string | null
  og_image_url: string | null
  default_language: string
  public_disclaimer_ml: string
  public_disclaimer_en: string
  public_footer_ml: string
  public_footer_en: string
  support_email: string | null
}

export type Submission = {
  id: string
  campaign_id: string
  full_name: string
  email: string
  email_normalized: string
  phone_e164: string | null
  address_line: string
  panchayat: string | null
  village: string | null
  district: string
  pincode: string | null
  language: string
  custom_text: string | null
  generated_subject: string
  generated_body: string
  generated_to: string[]
  generated_cc: string[]
  generated_bcc: string[]
  send_method: SendMethod | null
  status: SubmissionStatus
  show_name_public: boolean
  custom_text_public: boolean
  verified_at: string | null
  handoff_at: string | null
  confirmed_at: string | null
  ip_hash: string | null
  user_agent: string | null
  consent_version: string
  consent_at: string
  created_at: string
  constituency_id: string | null
  cc_representative_ids: string[]
  is_test: boolean
}

export type Constituency = {
  id: string
  code: string
  name_en: string
  name_ml: string
  district: string
  level: RepLevel
  is_active: boolean
}

export type Representative = {
  id: string
  constituency_id: string | null
  name_en: string
  name_ml: string
  level: RepLevel
  party: string | null
  front: string | null
  official_email: string | null
  office_phone: string | null
  portfolio: string | null
  term_start: string
  term_end: string | null
  source_url: string
  verified_at: string
  is_current: boolean
}

export type ConstituencyConfidence = 'exact' | 'probable' | 'district'

export type ConstituencyCandidate = {
  constituency: Constituency
  confidence: ConstituencyConfidence
}

export type ConstituencyMatch = ConstituencyCandidate & {
  representative: Representative | null
}

export type WizardRouting = {
  constituencyId: string | null
  ccMla: boolean
  ccRepresentativeIds: string[]
  constituency: Constituency | null
  representative: Representative | null
}
