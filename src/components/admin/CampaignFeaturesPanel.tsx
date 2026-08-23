'use client'

import { adminInput, adminLabel } from '@/components/admin/admin-ui'
import type { CampaignFeatureSettings, AiProviderId, IdentityMode } from '@/lib/campaign-features'

export function CampaignFeaturesPanel({
  value,
  onChange,
  health,
}: {
  value: CampaignFeatureSettings
  onChange: (patch: Partial<CampaignFeatureSettings>) => void
  health: {
    postalCount: number | null
    aiConfigured: boolean
  }
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold text-stone-900">Campaign Features</h2>
        <p className="text-sm text-stone-600">These settings are campaign-specific. The public form stays simple when a feature is off.</p>

        <label className={adminLabel}>
          Identity
          <select
            className={adminInput}
            value={value.identity_mode}
            onChange={(event) => onChange({ identity_mode: event.target.value as IdentityMode })}
          >
            <option value="required">Name required</option>
            <option value="optional">Name optional</option>
          </select>
        </label>

        <Toggle
          label="Automatic PIN lookup"
          checked={value.enable_pin_lookup}
          onChange={(checked) => onChange({ enable_pin_lookup: checked })}
        />
        <Toggle
          label="Privacy / minimal details mode"
          hint="Lets people omit name and location from the email body. Mailto still shows their sending address."
          checked={value.allow_privacy_mode}
          onChange={(checked) => onChange({ allow_privacy_mode: checked })}
        />
        <Toggle
          label="Voice typing"
          hint="Browser speech recognition. Never required."
          checked={value.enable_voice_input}
          onChange={(checked) => onChange({ enable_voice_input: checked })}
        />
        <Toggle
          label="Read email aloud"
          hint="Browser text-to-speech. Never required."
          checked={value.enable_mail_read_aloud}
          onChange={(checked) => onChange({ enable_mail_read_aloud: checked })}
        />
      </section>

      <section className="space-y-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold text-stone-900">AI Email Improvement</h2>
        <Toggle
          label="AI-assisted email improvement"
          hint="Optional. Never blocks sending. Uses only predefined concern text, not names or custom notes."
          checked={value.enable_ai_mail}
          onChange={(checked) => onChange({ enable_ai_mail: checked, ai_provider: checked ? value.ai_provider === 'disabled' ? 'gemini' : value.ai_provider : 'disabled' })}
        />
        <label className={adminLabel}>
          Provider
          <select
            className={adminInput}
            value={value.ai_provider}
            onChange={(event) => onChange({ ai_provider: event.target.value as AiProviderId })}
          >
            <option value="disabled">Disabled</option>
            <option value="gemini">Gemini</option>
            <option value="local">Local (not configured)</option>
          </select>
        </label>
        <label className={adminLabel}>
          Model
          <input className={adminInput} value={value.ai_model} onChange={(event) => onChange({ ai_model: event.target.value })} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={adminLabel}>
            Daily limit
            <input
              type="number"
              min={0}
              className={adminInput}
              value={value.ai_daily_limit}
              onChange={(event) => onChange({ ai_daily_limit: Number(event.target.value) || 0 })}
            />
          </label>
          <label className={adminLabel}>
            Monthly limit
            <input
              type="number"
              min={0}
              className={adminInput}
              value={value.ai_monthly_limit}
              onChange={(event) => onChange({ ai_monthly_limit: Number(event.target.value) || 0 })}
            />
          </label>
        </div>
        <p className="text-sm text-stone-600">
          Free-only policy is on. Public mail still works without AI. API keys stay on the server. Gemini 2.5 Flash
          free-tier quotas change; do not treat them as guaranteed. Prefer approved cached concern text over live calls.
        </p>
      </section>

      <section className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-4">
        <h2 className="text-base font-semibold text-stone-900">Health</h2>
        <p className="text-sm text-stone-700">PIN Directory: {health.postalCount == null ? 'Unknown' : health.postalCount > 0 ? `Ready (${health.postalCount} offices)` : 'Empty — import postal data'}</p>
        <p className="text-sm text-stone-700">Voice Input: Browser feature</p>
        <p className="text-sm text-stone-700">Read Aloud: Browser feature</p>
        <p className="text-sm text-stone-700">AI Mail: {health.aiConfigured ? 'Configured' : 'Not configured'}</p>
      </section>
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2 text-sm">
      <span>
        <span className="block font-medium text-stone-900">{label}</span>
        {hint ? <span className="mt-1 block text-stone-600">{hint}</span> : null}
      </span>
      <input type="checkbox" className="size-5 accent-emerald-800" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
