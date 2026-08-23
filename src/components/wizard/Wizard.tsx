'use client'

import { useReducer } from 'react'

import { prepareDemoLetter } from '@/app/actions/submission'
import { PageContainer } from '@/components/ui/PageContainer'
import { IconChevronRight } from '@/components/ui/icons'
import { Progress } from '@/components/wizard/Progress'
import { ConcernSelector } from '@/components/wizard/ConcernSelector'
import { emptyRouting, Step2_DetailsForm } from '@/components/wizard/Step2_DetailsForm'
import { Step3_Preview, type CanonicalLetter } from '@/components/wizard/Step3_Preview'
import { useLang } from '@/components/LanguageProvider'
import {
  applyPredefinedConcernClick,
  campaignConcernConfig,
  flattenCustomConcerns,
  MAX_CUSTOM_CONCERN_BOXES,
  selectedClausesForLetter,
  validatePredefinedSelection,
} from '@/lib/concern-selection'
import { composeEmail } from '@/lib/compose'
import { cx } from '@/lib/cx'
import type { DistrictOption } from '@/lib/kerala-districts'
import {
  createDetailsSchema,
  emptyDetails,
  fieldErrorsFromZod,
  type DetailsFields,
  type FieldErrors,
} from '@/lib/details-schema'
import { t } from '@/lib/i18n'
import { normalizeIndianPhone } from '@/lib/phone'
import { btnGhost, btnPrimary, focusRing } from '@/lib/ui'
import type { WizardMode } from '@/lib/wizard-mode'
import type { Campaign, ObjectionClause, WizardRouting } from '@/types/database'

type Step = 1 | 2 | 3

type WizardState = {
  step: Step
  selectedClauseIds: string[]
  customConcerns: string[]
  details: DetailsFields
  routing: WizardRouting
  submissionId: string | null
  detailsErrors: FieldErrors
  clauseError: boolean
  maxError: boolean
  canonicalLetter: CanonicalLetter | null
}

type WizardAction =
  | { type: 'select_clause'; id: string; mode: 'single' | 'multiple'; maxSelections: number | null }
  | { type: 'set_details'; details: Partial<DetailsFields> }
  | { type: 'set_custom_concern'; index: number; text: string }
  | { type: 'add_custom_concern' }
  | { type: 'remove_custom_concern'; index: number }
  | { type: 'set_routing'; routing: WizardRouting }
  | {
      type: 'submit_details'
      details: DetailsFields
      nextStep: Step
      letter?: CanonicalLetter | null
      submissionId?: string | null
    }
  | { type: 'details_invalid'; errors: FieldErrors }
  | { type: 'next' }
  | { type: 'clause_error' }
  | { type: 'goto'; step: Step }
  | { type: 'back' }

function withCustomConcerns(state: WizardState, customConcerns: string[]): WizardState {
  const detailsErrors = { ...state.detailsErrors }
  delete detailsErrors.customText
  return {
    ...state,
    clauseError: false,
    customConcerns,
    detailsErrors,
  }
}

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'select_clause': {
      const next = applyPredefinedConcernClick({
        mode: action.mode,
        selectedIds: state.selectedClauseIds,
        id: action.id,
        maxSelections: action.maxSelections,
      })
      return {
        ...state,
        clauseError: false,
        maxError: next.limited,
        selectedClauseIds: next.selectedIds,
      }
    }
    case 'set_details': {
      const detailsErrors = { ...state.detailsErrors }
      for (const key of Object.keys(action.details) as Array<keyof DetailsFields>) {
        delete detailsErrors[key]
      }
      return {
        ...state,
        details: { ...state.details, ...action.details },
        detailsErrors,
      }
    }
    case 'set_custom_concern': {
      const next = [...state.customConcerns]
      next[action.index] = action.text.slice(0, 300)
      return withCustomConcerns(state, next)
    }
    case 'add_custom_concern': {
      if (state.customConcerns.length >= MAX_CUSTOM_CONCERN_BOXES) {
        return state
      }
      return { ...state, customConcerns: [...state.customConcerns, ''] }
    }
    case 'remove_custom_concern': {
      const next = state.customConcerns.filter((_, index) => index !== action.index)
      return withCustomConcerns(state, next.length > 0 ? next : [''])
    }
    case 'set_routing':
      return { ...state, routing: action.routing }
    case 'submit_details':
      return {
        ...state,
        details: action.details,
        detailsErrors: {},
        step: action.nextStep,
        canonicalLetter: action.letter === undefined ? state.canonicalLetter : action.letter,
        submissionId: action.submissionId === undefined ? state.submissionId : action.submissionId,
      }
    case 'details_invalid':
      return { ...state, detailsErrors: action.errors }
    case 'clause_error':
      return { ...state, clauseError: true }
    case 'next':
      return { ...state, step: state.step < 3 ? ((state.step + 1) as Step) : state.step }
    case 'goto':
      return { ...state, step: action.step }
    case 'back':
      return { ...state, step: state.step > 1 ? ((state.step - 1) as Step) : state.step }
    default:
      return state
  }
}

export function Wizard({
  campaign,
  clauses,
  districts,
  mode,
  testerEmail,
}: {
  campaign: Campaign
  clauses: ObjectionClause[]
  districts: DistrictOption[]
  mode: WizardMode
  testerEmail: string | null
}) {
  const { lang } = useLang()
  const config = campaignConcernConfig(campaign)
  const [state, dispatch] = useReducer(reducer, {
    step: 1,
    selectedClauseIds: [],
    customConcerns: [''],
    details: emptyDetails(),
    routing: emptyRouting,
    submissionId: null,
    detailsErrors: {},
    clauseError: false,
    maxError: false,
    canonicalLetter: null,
  })

  const extraConcerns = flattenCustomConcerns(state.customConcerns)
  const selectedClauses = selectedClausesForLetter(clauses, state.selectedClauseIds)

  function goNextFromStep1() {
    const validity = validatePredefinedSelection({
      mode: config.mode,
      selectedIds: state.selectedClauseIds,
      maxSelections: config.maxSelections,
    })
    if (validity !== 'ok') {
      dispatch({ type: 'clause_error' })
      return
    }
    dispatch({ type: 'next' })
  }

  async function goNextFromStep2() {
    const parsed = createDetailsSchema(
      lang,
      districts.map((d) => d.value),
      [],
    ).safeParse(state.details)
    if (!parsed.success) {
      dispatch({ type: 'details_invalid', errors: fieldErrorsFromZod(parsed.error) })
      return
    }
    const phone = normalizeIndianPhone(parsed.data.phone) ?? parsed.data.phone
    const details = { ...parsed.data, phone }

    try {
      const prepared = await prepareDemoLetter({
        campaignSlug: campaign.slug,
        fullName: details.fullName,
        email: details.email,
        phone,
        address: details.addressLine,
        panchayat: details.panchayat,
        village: details.village,
        district: details.district,
        pincode: details.pincode,
        language: lang,
        customText: details.customText,
        extraConcerns: config.allowCustomConcern ? extraConcerns : [],
        clauseCodes: selectedClauses.map((clause) => clause.code),
        constituencyId: state.routing.constituencyId,
        ccRepIds: state.routing.ccRepresentativeIds,
        postOffice: details.postOffice,
        state: details.state,
        postalRegion: details.postalRegion,
        taluk: details.taluk,
      })
      if (prepared.ok) {
        dispatch({
          type: 'submit_details',
          details,
          nextStep: 3,
          letter: { subject: prepared.data.subject, body: prepared.data.body },
          submissionId: prepared.data.id,
        })
        return
      }
    } catch {
      // Bundled demo still works if the database is unreachable.
    }

    const local = composeEmail({
      campaign,
      clauses: selectedClauses,
      details: {
        fullName: details.fullName,
        addressLine: details.addressLine,
        panchayat: details.panchayat,
        village: details.village,
        district: details.district,
        pincode: details.pincode,
        phone,
        email: details.email,
        customText: details.customText,
        extraConcerns: config.allowCustomConcern ? extraConcerns : [],
        postOffice: details.postOffice,
        state: details.state,
        postalRegion: details.postalRegion,
        taluk: details.taluk,
      },
      lang,
    })
    dispatch({
      type: 'submit_details',
      details,
      nextStep: 3,
      letter: { subject: local.subject, body: local.body },
      submissionId: null,
    })
  }

  return (
    <PageContainer>
      {mode !== 'live' && (campaign.source_url || campaign.reference_url) ? (
        <p className="mb-4 font-mono text-xs leading-relaxed text-muted sm:text-sm">
          {campaign.source_url ? (
            <a
              href={campaign.source_url}
              className={`font-medium text-accent underline ${focusRing}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t(lang, 'gazetteBill')}
            </a>
          ) : null}
          {campaign.source_url && campaign.reference_url ? ' · ' : null}
          {campaign.reference_url ? (
            <a
              href={campaign.reference_url}
              className={`font-medium text-accent underline ${focusRing}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t(lang, 'volunteerLetter')}
            </a>
          ) : null}
        </p>
      ) : null}

      <Progress step={state.step} />

      {state.step === 1 ? (
        <ConcernSelector
          campaign={campaign}
          clauses={clauses}
          selectedIds={state.selectedClauseIds}
          customConcerns={state.customConcerns}
          customError={state.detailsErrors.customText}
          maxError={state.maxError}
          onSelect={(id) =>
            dispatch({
              type: 'select_clause',
              id,
              mode: config.mode,
              maxSelections: config.maxSelections,
            })
          }
          onCustomChange={(index, text) => dispatch({ type: 'set_custom_concern', index, text })}
          onAddCustom={() => dispatch({ type: 'add_custom_concern' })}
          onRemoveCustom={(index) => dispatch({ type: 'remove_custom_concern', index })}
        />
      ) : null}

      {state.step === 2 ? (
        <Step2_DetailsForm
          details={state.details}
          districts={districts}
          errors={state.detailsErrors}
          routing={state.routing}
          allowSample={mode !== 'live'}
          onChange={(patch) => dispatch({ type: 'set_details', details: patch })}
          onRoutingChange={(routing) => dispatch({ type: 'set_routing', routing })}
        />
      ) : null}

      {state.step === 3 ? (
        <Step3_Preview
          campaign={campaign}
          clauses={selectedClauses}
          details={state.details}
          routing={state.routing}
          submissionId={state.submissionId}
          mode={mode}
          testerEmail={testerEmail}
          canonicalLetter={state.canonicalLetter}
          extraConcerns={config.allowCustomConcern ? extraConcerns : []}
          onEditDetails={() => dispatch({ type: 'goto', step: 2 })}
          onEditObjections={() => dispatch({ type: 'goto', step: 1 })}
        />
      ) : null}

      {state.step === 1 && state.clauseError ? (
        <p className="mt-3 text-sm text-red-800" role="alert" aria-live="assertive">
          {config.mode === 'single' ? t(lang, 'minClausesHint') : t(lang, 'minClausesHintMultiple')}
        </p>
      ) : null}

      {state.step === 1 ? (
        <div className="mt-6">
          <button type="button" onClick={goNextFromStep1} className={cx(btnPrimary, 'w-full')}>
            {t(lang, 'continueToDetails')}
            <IconChevronRight className="size-4 shrink-0" />
          </button>
        </div>
      ) : null}

      {state.step === 2 ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => dispatch({ type: 'back' })}
            className={cx(btnGhost, 'w-full sm:w-auto')}
          >
            {t(lang, 'back')}
          </button>
          <button type="button" onClick={() => void goNextFromStep2()} className={cx(btnPrimary, 'w-full sm:flex-1')}>
            {t(lang, 'continueToLetter')}
            <IconChevronRight className="size-4 shrink-0" />
          </button>
        </div>
      ) : null}

      {state.step > 2 ? (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => dispatch({ type: 'back' })} className={cx(btnGhost)}>
            {t(lang, 'back')}
          </button>
        </div>
      ) : null}
    </PageContainer>
  )
}
