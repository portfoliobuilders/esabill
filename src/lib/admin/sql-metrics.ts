import 'server-only'

import { createServiceClient } from '@/lib/supabase/server'
import type { SubmissionStatus } from '@/types/database'

export type SqlNamedCount = { name: string; cnt: number }

export type SqlConcern = {
  id: string
  code: string
  title_ml: string
  title_en: string
  section_ref: string | null
  cnt: number
}

export type SqlTrendPoint = {
  day: string
  prepared: number
  emailOpened: number
  confirmedSent: number
}

export type SqlMetrics = {
  statusCounts: Partial<Record<SubmissionStatus, number>>
  thisWeek: number
  prevWeek: number
  confirmedThisWeek: number
  confirmedPrevWeek: number
  today: number
  withComment: number
  districts: SqlNamedCount[]
  constituencies: SqlNamedCount[]
  concerns: SqlConcern[]
  trend: SqlTrendPoint[]
  sendMethods: { method: string; cnt: number }[]
  languages: { language: string; cnt: number }[]
  combinations: { labels: string; cnt: number }[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
}

export function metricsFromPayload(payload: unknown): SqlMetrics | null {
  const row = asRecord(payload)
  if (!row || !row.status_counts || !Array.isArray(row.districts)) return null
  const counts = asRecord(row.status_counts) ?? {}
  const statusCounts: Partial<Record<SubmissionStatus, number>> = {}
  for (const [status, cnt] of Object.entries(counts)) {
    statusCounts[status as SubmissionStatus] = asNumber(cnt)
  }
  return {
    statusCounts,
    thisWeek: asNumber(row.this_week),
    prevWeek: asNumber(row.prev_week),
    confirmedThisWeek: asNumber(row.confirmed_this_week),
    confirmedPrevWeek: asNumber(row.confirmed_prev_week),
    today: asNumber(row.today),
    withComment: asNumber(row.with_comment),
    districts: asRows(row.districts).map((item) => ({ name: String(item.name ?? ''), cnt: asNumber(item.cnt) })),
    constituencies: asRows(row.constituencies).map((item) => ({
      name: String(item.name ?? ''),
      cnt: asNumber(item.cnt),
    })),
    concerns: asRows(row.concerns).map((item) => ({
      id: String(item.id ?? ''),
      code: String(item.code ?? ''),
      title_ml: String(item.title_ml ?? ''),
      title_en: String(item.title_en ?? ''),
      section_ref: item.section_ref == null ? null : String(item.section_ref),
      cnt: asNumber(item.cnt),
    })),
    trend: asRows(row.trend).map((item) => ({
      day: String(item.day ?? ''),
      prepared: asNumber(item.prepared),
      emailOpened: asNumber(item.emailOpened),
      confirmedSent: asNumber(item.confirmedSent),
    })),
    sendMethods: asRows(row.send_methods).map((item) => ({
      method: String(item.method ?? ''),
      cnt: asNumber(item.cnt),
    })),
    languages: asRows(row.languages).map((item) => ({
      language: String(item.language ?? ''),
      cnt: asNumber(item.cnt),
    })),
    combinations: asRows(row.combinations).map((item) => ({
      labels: String(item.labels ?? ''),
      cnt: asNumber(item.cnt),
    })),
  }
}

/** Database-side totals. Returns null when the function is not installed yet. */
export async function fetchSqlMetrics(campaignId: string, includeTests: boolean): Promise<SqlMetrics | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('admin_campaign_metrics', {
      p_campaign_id: campaignId,
      p_include_tests: includeTests,
    })
    if (error || data == null) return null
    return metricsFromPayload(data)
  } catch {
    return null
  }
}
