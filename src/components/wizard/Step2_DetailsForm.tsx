'use client'

import { useEffect, useRef, useState } from 'react'

import { SelectField, TextAreaField, TextField } from '@/components/ui/FormField'
import { useLang } from '@/components/LanguageProvider'
import { cx } from '@/lib/cx'
import type { DistrictOption } from '@/lib/kerala-districts'
import { MAX_CUSTOM_CHARS, type DetailsFields, type FieldErrors } from '@/lib/details-schema'
import { t } from '@/lib/i18n'
import { focusRing } from '@/lib/ui'
import type { ConstituencyMatch, WizardRouting } from '@/types/database'

const PINCODE_RE = /^[1-9][0-9]{5}$/

export const emptyRouting: WizardRouting = {
  constituencyId: null,
  ccMla: false,
  ccRepresentativeIds: [],
  constituency: null,
  representative: null,
}

function hasOfficialEmail(match: ConstituencyMatch | undefined): boolean {
  return Boolean(match?.representative?.official_email?.trim())
}

function routingFromMatch(match: ConstituencyMatch, ccMla: boolean): WizardRouting {
  const representative = match.representative
  const optedIn = ccMla && Boolean(representative?.official_email?.trim())
  return {
    constituencyId: match.constituency.id,
    ccMla: optedIn,
    ccRepresentativeIds: optedIn && representative ? [representative.id] : [],
    constituency: match.constituency,
    representative,
  }
}

export function Step2_DetailsForm({
  details,
  districts,
  errors,
  routing,
  allowSample,
  onChange,
  onRoutingChange,
}: {
  details: DetailsFields
  districts: DistrictOption[]
  errors: FieldErrors
  routing: WizardRouting
  allowSample?: boolean
  onChange: (patch: Partial<DetailsFields>) => void
  onRoutingChange: (routing: WizardRouting) => void
}) {
  const { lang } = useLang()
  const [candidates, setCandidates] = useState<ConstituencyMatch[]>([])
  const onRoutingChangeRef = useRef(onRoutingChange)
  onRoutingChangeRef.current = onRoutingChange
  const routingRef = useRef(routing)
  routingRef.current = routing

  useEffect(() => {
    const district = details.district.trim()
    const pincode = details.pincode.trim()
    const panchayat = details.panchayat.trim()

    if (!district || !PINCODE_RE.test(pincode)) {
      setCandidates([])
      if (routingRef.current.constituencyId || routingRef.current.ccMla) {
        onRoutingChangeRef.current(emptyRouting)
      }
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pincode, district, panchayat })
      void fetch(`/api/constituency?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            setCandidates([])
            onRoutingChangeRef.current(emptyRouting)
            return
          }
          const body = (await response.json()) as { candidates?: ConstituencyMatch[] }
          const next = body.candidates ?? []
          setCandidates(next)

          const current = routingRef.current
          const stillPresent = next.find((row) => row.constituency.id === current.constituencyId)
          if (stillPresent) {
            onRoutingChangeRef.current(routingFromMatch(stillPresent, current.ccMla))
            return
          }

          const exactSingle = next.length === 1 && next[0].confidence === 'exact' ? next[0] : null
          if (exactSingle) {
            onRoutingChangeRef.current(routingFromMatch(exactSingle, false))
            return
          }

          onRoutingChangeRef.current(emptyRouting)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setCandidates([])
          onRoutingChangeRef.current(emptyRouting)
        })
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [details.district, details.pincode, details.panchayat])

  const selected = candidates.find((row) => row.constituency.id === routing.constituencyId)
  const showMlaOptIn = hasOfficialEmail(selected)

  function selectConstituency(constituencyId: string) {
    const match = candidates.find((row) => row.constituency.id === constituencyId)
    if (!match) {
      onRoutingChange(emptyRouting)
      return
    }
    onRoutingChange(routingFromMatch(match, false))
  }

  function setCcMla(checked: boolean) {
    if (!selected || !hasOfficialEmail(selected)) {
      onRoutingChange({ ...routing, ccMla: false, ccRepresentativeIds: [] })
      return
    }
    onRoutingChange(routingFromMatch(selected, checked))
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink sm:text-3xl">{t(lang, 'yourDetails')}</h1>
      <p className="mt-2 text-base leading-relaxed text-body">
        {t(lang, 'detailsHowUsed')}{' '}
        <a href="/privacy" className={`font-medium text-accent underline ${focusRing}`}>
          {t(lang, 'footerPrivacy')}
        </a>
      </p>

      <div className="mt-6 rounded-[8px] border border-rule bg-raised p-4">
        <TextAreaField
          id="customText"
          name="customText"
          label={t(lang, 'customText')}
          value={details.customText}
          maxLength={MAX_CUSTOM_CHARS}
          rows={5}
          onChange={(event) => onChange({ customText: event.target.value })}
          hint={`${details.customText.length}/${MAX_CUSTOM_CHARS} ${t(lang, 'charsUsed')} — ${t(lang, 'customTextInvite')}`}
          error={errors.customText}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField
          id="fullName"
          name="fullName"
          autoComplete="name"
          label={t(lang, 'fullName')}
          value={details.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          error={errors.fullName}
        />
        <TextField
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label={t(lang, 'phone')}
          value={details.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          hint={t(lang, 'phoneHint')}
          error={errors.phone}
        />
        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          label={t(lang, 'email')}
          value={details.email}
          onChange={(event) => onChange({ email: event.target.value })}
          error={errors.email}
        />
        <SelectField
          id="district"
          name="district"
          autoComplete="address-level1"
          label={t(lang, 'district')}
          value={details.district}
          onChange={(event) => onChange({ district: event.target.value })}
          error={errors.district}
        >
          <option value="">{t(lang, 'selectDistrict')}</option>
          {districts.map((district) => (
            <option key={district.value} value={district.value}>
              {lang === 'en' ? district.labelEn : district.labelMl}
            </option>
          ))}
        </SelectField>
        <TextField
          id="pincode"
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          label={t(lang, 'pincode')}
          value={details.pincode}
          onChange={(event) => onChange({ pincode: event.target.value })}
          error={errors.pincode}
        />
        <TextField
          id="panchayat"
          name="panchayat"
          autoComplete="address-level2"
          label={t(lang, 'panchayat')}
          value={details.panchayat}
          onChange={(event) => onChange({ panchayat: event.target.value })}
        />
        <div className="sm:col-span-2">
          <TextField
            id="addressLine"
            name="addressLine"
            autoComplete="street-address"
            label={t(lang, 'address')}
            value={details.addressLine}
            onChange={(event) => onChange({ addressLine: event.target.value })}
            error={errors.addressLine}
          />
        </div>
      </div>

      {candidates.length > 0 ? (
        <div className="mt-4">
          <SelectField
            id="constituency"
            name="constituency"
            label={t(lang, 'constituencyConfirm')}
            value={routing.constituencyId ?? ''}
            onChange={(event) => selectConstituency(event.target.value)}
          >
            <option value="">{t(lang, 'constituencyConfirm')}</option>
            {candidates.map((candidate) => (
              <option key={candidate.constituency.id} value={candidate.constituency.id}>
                {lang === 'en' ? candidate.constituency.name_en : candidate.constituency.name_ml}
              </option>
            ))}
          </SelectField>

          {showMlaOptIn && selected?.representative ? (
            <div className="mt-3">
              <p className="text-base leading-relaxed text-ink">
                {lang === 'en' ? selected.representative.name_en : selected.representative.name_ml}
              </p>
              <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-[8px] border border-rule bg-raised p-3">
                <input
                  type="checkbox"
                  name="ccMla"
                  checked={routing.ccMla}
                  onChange={(event) => setCcMla(event.target.checked)}
                  className={cx('mt-1 size-6 shrink-0 accent-accent', focusRing)}
                />
                <span className="text-base leading-relaxed text-ink">{t(lang, 'ccRepresentative')}</span>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
