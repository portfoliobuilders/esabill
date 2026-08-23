import { CampaignFlow, NoActiveCampaign } from '@/components/campaign/CampaignFlow'
import { aiServerConfigured } from '@/lib/ai/provider'
import { resolvePublicCampaign } from '@/lib/campaign'
import { loadObjectionData } from '@/lib/campaigns'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ preview?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams
  const state = await resolvePublicCampaign(params.preview)
  if (state.state === 'dormant') return <NoActiveCampaign />
  const data = await loadObjectionData(state)
  if (!data) return <NoActiveCampaign />
  const view = state.state === 'live' || state.state === 'preview' || state.state === 'inactive' || state.state === 'expired' ? state.state : 'expired'
  return (
    <CampaignFlow
      campaign={data.campaign}
      clauses={data.clauses}
      formFields={data.formFields}
      districts={data.districts}
      mode={data.mode}
      view={view}
      sources={data.sources}
      aiConfigured={aiServerConfigured()}
    />
  )
}
