import 'server-only'

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

import type { AdminFilters, TrendRange } from '@/lib/admin/filters'
import { weekChangePct } from '@/lib/admin/metrics'
import {
  CONFIRMED_STATUSES,
  DISPLAY_STAGE_LABEL,
  EMAIL_OPENED_STATUSES,
  PREPARED_STATUSES,
  displayStage,
  funnelFromStatusCounts,
  sendMethodLabel,
  statusesForDisplayStage,
  type DisplayStage,
  type FunnelCounts,
} from '@/lib/admin/stages'
import { fetchSqlMetrics, type SqlMetrics } from '@/lib/admin/sql-metrics'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEveryPage } from '@/lib/supabase/paginate'
import type { SubmissionStatus } from '@/types/database'

export type { AdminFilters }

export const ADMIN_PAGE_SIZE = 50

export type AdminSubmissionRow = {
  id: string
  created_at: string
  full_name: string | null
  email: string | null
  phone_e164: string | null
  district: string
  panchayat: string | null
  constituency_name: string | null
  clause_count: number
  stage: DisplayStage
  stageLabel: string
  send_method: string | null
  sendMethodLabel: string
  is_test: boolean
  custom_text: string | null
}

export type KpiCard = {
  key: string
  label: string
  value: number
  hint: string
  weekPct: number | null
}

export type ConcernStat = {
  id: string
  code: string
  title_ml: string
  title_en: string
  section_ref: string | null
  cnt: number
  pct: number
}

export type NamedCount = {
  name: string
  cnt: number
}

export type TrendPoint = {
  day: string
  prepared: number
  emailOpened: number
  confirmedSent: number
}

export type DashboardData = {
  kpis: KpiCard[]
  funnel: FunnelCounts
  funnelPercents: { prepared: number | null; emailOpened: number | null; confirmedSent: number | null }
  dropOff: { prepared: number | null; emailOpened: number | null; confirmedSent: number | null }
  topConcerns: ConcernStat[]
  topDistricts: NamedCount[]
  topConstituencies: NamedCount[]
  trend: TrendPoint[]
  participantCount: number
}

export type SubmissionDetail = {
  id: string
  campaign_id: string
  full_name: string | null
  email: string | null
  phone_e164: string | null
  address_line: string | null
  panchayat: string | null
  district: string
  pincode: string | null
  constituency_name: string | null
  constituency_id: string | null
  language: string
  custom_text: string | null
  custom_text_public: boolean
  generated_subject: string
  generated_body: string
  generated_to: string[]
  generated_cc: string[]
  send_method: string | null
  status: SubmissionStatus
  stage: DisplayStage
  is_test: boolean
  created_at: string
  verified_at: string | null
  handoff_at: string | null
  confirmed_at: string | null
  consent_at: string
  consent_version: string
  ip_hash: string | null
  user_agent: string | null
  show_name_public: boolean
  clauses: { id: string; code: string; title_ml: string; title_en: string; section_ref: string | null }[]
  reps: { name_ml: string; name_en: string; official_email: string | null; level: string }[]
}

export type DeletionRequestRow = {
  id: string
  email: string
  reason: string | null
  handled_at: string | null
  created_at: string
  matching_count: number
}

export type NotifySignupRow = {
  id: string
  email: string
  created_at: string
}

export type AnalyticsData = {
  funnel: FunnelCounts
  trend: TrendPoint[]
  concerns: ConcernStat[]
  districts: NamedCount[]
  constituencies: NamedCount[]
  sendMethods: { method: string; label: string; cnt: number; pct: number }[]
  languages: { language: string; cnt: number; pct: number }[]
  personalCommentRate: { withComment: number; total: number; pct: number }
  combinations: { labels: string; cnt: number }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterQuery = PostgrestFilterBuilder<any, any, any, any, any>

function applyFilters<Q extends FilterQuery>(query: Q, filters: AdminFilters, campaignId: string): Q {
  let q = query.eq('campaign_id', campaignId) as Q
  if (filters.tests !== 'include') q = q.eq('is_test', false) as Q
  const statuses = statusesForDisplayStage(filters.stage)
  if (statuses && statuses.length === 1) q = q.eq('status', statuses[0]) as Q
  if (statuses && statuses.length > 1) q = q.in('status', statuses) as Q
  if (filters.district) q = q.eq('district', filters.district) as Q
  if (filters.panchayat) q = q.ilike('panchayat', filters.panchayat) as Q
  if (filters.constituencyId) q = q.eq('constituency_id', filters.constituencyId) as Q
  if (filters.dateFrom) q = q.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`) as Q
  if (filters.dateTo) q = q.lte('created_at', `${filters.dateTo}T23:59:59.999Z`) as Q
  if (filters.sendMethod) q = q.eq('send_method', filters.sendMethod) as Q
  if (filters.hasCustomText === 'yes') q = q.not('custom_text', 'is', null).neq('custom_text', '') as Q
  if (filters.hasCustomText === 'no') q = q.or('custom_text.is.null,custom_text.eq.') as Q
  const search = sanitizeSearch(filters.q ?? '')
  if (search) {
    q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone_e164.ilike.%${search}%`) as Q
  }
  return q
}

function sanitizeSearch(raw: string): string {
  return raw.replace(/[%*,()]/g, ' ').trim().slice(0, 80)
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function statusMap(rows: { status: string }[]): Partial<Record<SubmissionStatus, number>> {
  const counts: Partial<Record<SubmissionStatus, number>> = {}
  for (const row of rows) {
    const status = row.status as SubmissionStatus
    counts[status] = (counts[status] ?? 0) + 1
  }
  return counts
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

function conversion(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((to / from) * 1000) / 10
}

function dropOff(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((1 - to / from) * 1000) / 10
}

function istDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function rangeStart(range: TrendRange): Date | null {
  const now = Date.now()
  if (range === '7d') return new Date(now - 7 * 86_400_000)
  if (range === '30d') return new Date(now - 30 * 86_400_000)
  return null
}

type LightRow = {
  id: string
  status: SubmissionStatus
  district: string
  constituency_id: string | null
  created_at: string
  verified_at: string | null
  handoff_at: string | null
  confirmed_at: string | null
  send_method: string | null
  language: string
  custom_text: string | null
  is_test: boolean
}

async function fetchLightRows(campaignId: string, includeTests: boolean): Promise<LightRow[]> {
  const supabase = createServiceClient()
  return fetchEveryPage(async (from, to) => {
    let query = supabase
      .from('submissions')
      .select(
        'id, status, district, constituency_id, created_at, verified_at, handoff_at, confirmed_at, send_method, language, custom_text, is_test',
      )
      .eq('campaign_id', campaignId)
      .order('id', { ascending: true })
      .range(from, to)
    if (!includeTests) query = query.eq('is_test', false)
    const { data, error } = await query
    return { data: (data ?? null) as LightRow[] | null, error }
  })
}

function buildTrend(rows: LightRow[], range: TrendRange): TrendPoint[] {
  const start = rangeStart(range)
  const byDay = new Map<string, TrendPoint>()
  const ensure = (day: string) => {
    let point = byDay.get(day)
    if (!point) {
      point = { day, prepared: 0, emailOpened: 0, confirmedSent: 0 }
      byDay.set(day, point)
    }
    return point
  }

  for (const row of rows) {
    const preparedAt =
      row.verified_at ||
      (PREPARED_STATUSES.includes(row.status) ? row.handoff_at || row.confirmed_at || row.created_at : null)
    const openedAt = row.handoff_at
    const confirmedAt = row.confirmed_at
    const preparedDay = istDay(preparedAt)
    const openedDay = istDay(openedAt)
    const confirmedDay = istDay(confirmedAt)
    if (preparedDay && PREPARED_STATUSES.includes(row.status)) {
      if (!start || new Date(`${preparedDay}T00:00:00+05:30`) >= start) ensure(preparedDay).prepared += 1
    }
    if (openedDay && EMAIL_OPENED_STATUSES.includes(row.status)) {
      if (!start || new Date(`${openedDay}T00:00:00+05:30`) >= start) ensure(openedDay).emailOpened += 1
    }
    if (confirmedDay && CONFIRMED_STATUSES.includes(row.status)) {
      if (!start || new Date(`${confirmedDay}T00:00:00+05:30`) >= start) ensure(confirmedDay).confirmedSent += 1
    }
  }

  const days = [...byDay.keys()].sort()
  if (days.length === 0) {
    const today = istDay(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10)
    return [{ day: today, prepared: 0, emailOpened: 0, confirmedSent: 0 }]
  }
  return days.map((day) => byDay.get(day)!)
}

async function fetchConcernStats(
  campaignId: string,
  includeTests: boolean,
  participantCount: number,
): Promise<ConcernStat[]> {
  const supabase = createServiceClient()
  const data = await fetchEveryPage(async (from, to) => {
    let query = supabase
      .from('submission_clauses')
      .select(
        `
    clause_id,
    submission_id,
    objection_clauses(id, code, title_ml, title_en, section_ref),
    submissions!inner(id, campaign_id, is_test)
  `,
      )
      .eq('submissions.campaign_id', campaignId)
      .order('submission_id', { ascending: true })
      .order('clause_id', { ascending: true })
      .range(from, to)
    if (!includeTests) query = query.eq('submissions.is_test', false)
    return query
  })

  const seen = new Map<string, Set<string>>()
  const meta = new Map<string, Omit<ConcernStat, 'cnt' | 'pct'>>()
  for (const row of data ?? []) {
    const subRaw = row.submissions as { id: string } | { id: string }[] | null
    const sub = (Array.isArray(subRaw) ? subRaw[0] : subRaw) as { id: string } | null
    const submissionId = (sub?.id ?? (row.submission_id as string | undefined)) || ''
    const ocRaw = row.objection_clauses as
      | { id: string; code: string; title_ml: string; title_en: string; section_ref: string | null }
      | { id: string; code: string; title_ml: string; title_en: string; section_ref: string | null }[]
      | null
    const oc = Array.isArray(ocRaw) ? ocRaw[0] : ocRaw
    if (!submissionId || !oc?.id) continue
    if (!seen.has(oc.id)) seen.set(oc.id, new Set())
    seen.get(oc.id)!.add(submissionId)
    meta.set(oc.id, {
      id: oc.id,
      code: oc.code,
      title_ml: oc.title_ml,
      title_en: oc.title_en,
      section_ref: oc.section_ref,
    })
  }

  return [...meta.values()]
    .map((item) => {
      const cnt = seen.get(item.id)?.size ?? 0
      return { ...item, cnt, pct: pct(cnt, participantCount) }
    })
    .sort((a, b) => b.cnt - a.cnt)
}

function filterSqlTrend(points: SqlMetrics['trend'], range: TrendRange): TrendPoint[] {
  const start = rangeStart(range)
  const filtered = points.filter((point) => {
    if (!point.day) return false
    if (!start) return true
    return new Date(`${point.day}T00:00:00+05:30`) >= start
  })
  if (filtered.length === 0) {
    const today = istDay(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10)
    return [{ day: today, prepared: 0, emailOpened: 0, confirmedSent: 0 }]
  }
  return filtered
}

function dashboardFromSql(sql: SqlMetrics, trendRange: TrendRange): DashboardData {
  const funnel = funnelFromStatusCounts(sql.statusCounts)
  const topConcerns = sql.concerns.slice(0, 5).map((item) => ({
    ...item,
    pct: pct(item.cnt, funnel.started),
  }))
  return {
    kpis: [
      {
        key: 'participants',
        label: 'Total Participants',
        value: funnel.started,
        hint: 'Real submissions for this campaign',
        weekPct: weekChangePct(sql.thisWeek, sql.prevWeek),
      },
      {
        key: 'prepared',
        label: 'Objections Prepared',
        value: funnel.prepared,
        hint: 'Reached email preview',
        weekPct: null,
      },
      {
        key: 'opened',
        label: 'Email Opened',
        value: funnel.emailOpened,
        hint: 'Mail app or Gmail was opened',
        weekPct: null,
      },
      {
        key: 'confirmed',
        label: 'Confirmed Sent',
        value: funnel.confirmedSent,
        hint: 'Citizen confirmed sending',
        weekPct: weekChangePct(sql.confirmedThisWeek, sql.confirmedPrevWeek),
      },
      {
        key: 'districts',
        label: 'Districts Reached',
        value: sql.districts.length,
        hint: 'Distinct districts among participants',
        weekPct: null,
      },
      {
        key: 'today',
        label: 'Today',
        value: sql.today,
        hint: 'New real submissions in 24 hours',
        weekPct: null,
      },
    ],
    funnel,
    funnelPercents: {
      prepared: conversion(funnel.started, funnel.prepared),
      emailOpened: conversion(funnel.prepared, funnel.emailOpened),
      confirmedSent: conversion(funnel.emailOpened, funnel.confirmedSent),
    },
    dropOff: {
      prepared: dropOff(funnel.started, funnel.prepared),
      emailOpened: dropOff(funnel.prepared, funnel.emailOpened),
      confirmedSent: dropOff(funnel.emailOpened, funnel.confirmedSent),
    },
    topConcerns,
    topDistricts: sql.districts.slice(0, 8),
    topConstituencies: sql.constituencies.slice(0, 8),
    trend: filterSqlTrend(sql.trend, trendRange),
    participantCount: funnel.started,
  }
}

function analyticsFromSql(sql: SqlMetrics, trendRange: TrendRange): AnalyticsData {
  const funnel = funnelFromStatusCounts(sql.statusCounts)
  const concerns = sql.concerns.map((item) => ({ ...item, pct: pct(item.cnt, funnel.started) }))
  const methodTotal = sql.sendMethods.reduce((sum, item) => sum + item.cnt, 0)
  return {
    funnel,
    trend: filterSqlTrend(sql.trend, trendRange),
    concerns,
    districts: sql.districts,
    constituencies: sql.constituencies,
    sendMethods: sql.sendMethods.map((item) => ({
      method: item.method,
      label: sendMethodLabel(item.method),
      cnt: item.cnt,
      pct: pct(item.cnt, methodTotal),
    })),
    languages: sql.languages.map((item) => ({
      ...item,
      pct: pct(item.cnt, funnel.started),
    })),
    personalCommentRate: {
      withComment: sql.withComment,
      total: funnel.started,
      pct: pct(sql.withComment, funnel.started),
    },
    combinations: sql.combinations.slice(0, 8),
  }
}

export async function fetchDashboardData(
  campaignId: string,
  includeTests: boolean,
  trendRange: TrendRange = '7d',
): Promise<DashboardData> {
  const sql = await fetchSqlMetrics(campaignId, includeTests)
  if (sql) return dashboardFromSql(sql, trendRange)
  const rows = await fetchLightRows(campaignId, includeTests)
  const counts = statusMap(rows)
  const funnel = funnelFromStatusCounts(counts)
  const now = Date.now()
  const dayAgo = now - 86_400_000
  const weekAgo = now - 7 * 86_400_000
  const twoWeeksAgo = now - 14 * 86_400_000

  const inWindow = (iso: string, from: number, to: number) => {
    const t = new Date(iso).getTime()
    return t >= from && t < to
  }

  const thisWeek = rows.filter((r) => inWindow(r.created_at, weekAgo, now)).length
  const prevWeek = rows.filter((r) => inWindow(r.created_at, twoWeeksAgo, weekAgo)).length
  const confirmedThis = rows.filter((r) => CONFIRMED_STATUSES.includes(r.status) && inWindow(r.created_at, weekAgo, now)).length
  const confirmedPrev = rows.filter((r) => CONFIRMED_STATUSES.includes(r.status) && inWindow(r.created_at, twoWeeksAgo, weekAgo)).length

  const districts = new Set(rows.map((r) => r.district).filter(Boolean))
  const uniqueDistricts = districts.size
  const today = rows.filter((r) => new Date(r.created_at).getTime() >= dayAgo).length
  const topConcerns = (await fetchConcernStats(campaignId, includeTests, funnel.started)).slice(0, 5)

  const districtCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.district) continue
    districtCounts.set(row.district, (districtCounts.get(row.district) ?? 0) + 1)
  }
  const topDistricts = [...districtCounts.entries()]
    .map(([name, cnt]) => ({ name, cnt }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 8)

  const constituencyIds = [...new Set(rows.map((r) => r.constituency_id).filter(Boolean))] as string[]
  let topConstituencies: NamedCount[] = []
  if (constituencyIds.length > 0) {
    const supabase = createServiceClient()
    const { data } = await supabase.from('constituencies').select('id, name_ml, name_en').in('id', constituencyIds)
    const names = new Map((data ?? []).map((c) => [c.id as string, (c.name_ml as string) || (c.name_en as string)]))
    const constituencyCounts = new Map<string, number>()
    for (const row of rows) {
      if (!row.constituency_id) continue
      const name = names.get(row.constituency_id)
      if (!name) continue
      constituencyCounts.set(name, (constituencyCounts.get(name) ?? 0) + 1)
    }
    topConstituencies = [...constituencyCounts.entries()]
      .map(([name, cnt]) => ({ name, cnt }))
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, 8)
  }

  return {
    kpis: [
      {
        key: 'participants',
        label: 'Total Participants',
        value: funnel.started,
        hint: 'Real submissions for this campaign',
        weekPct: weekChangePct(thisWeek, prevWeek),
      },
      {
        key: 'prepared',
        label: 'Objections Prepared',
        value: funnel.prepared,
        hint: 'Reached email preview',
        weekPct: null,
      },
      {
        key: 'opened',
        label: 'Email Opened',
        value: funnel.emailOpened,
        hint: 'Mail app or Gmail was opened',
        weekPct: null,
      },
      {
        key: 'confirmed',
        label: 'Confirmed Sent',
        value: funnel.confirmedSent,
        hint: 'Citizen confirmed sending',
        weekPct: weekChangePct(confirmedThis, confirmedPrev),
      },
      {
        key: 'districts',
        label: 'Districts Reached',
        value: uniqueDistricts,
        hint: 'Distinct districts among participants',
        weekPct: null,
      },
      {
        key: 'today',
        label: 'Today',
        value: today,
        hint: 'New real submissions in 24 hours',
        weekPct: null,
      },
    ],
    funnel,
    funnelPercents: {
      prepared: conversion(funnel.started, funnel.prepared),
      emailOpened: conversion(funnel.prepared, funnel.emailOpened),
      confirmedSent: conversion(funnel.emailOpened, funnel.confirmedSent),
    },
    dropOff: {
      prepared: dropOff(funnel.started, funnel.prepared),
      emailOpened: dropOff(funnel.prepared, funnel.emailOpened),
      confirmedSent: dropOff(funnel.emailOpened, funnel.confirmedSent),
    },
    topConcerns,
    topDistricts,
    topConstituencies,
    trend: buildTrend(rows, trendRange),
    participantCount: funnel.started,
  }
}

export async function fetchAnalyticsData(
  campaignId: string,
  includeTests: boolean,
  trendRange: TrendRange,
): Promise<AnalyticsData> {
  const sql = await fetchSqlMetrics(campaignId, includeTests)
  if (sql) return analyticsFromSql(sql, trendRange)
  const rows = await fetchLightRows(campaignId, includeTests)
  const counts = statusMap(rows)
  const funnel = funnelFromStatusCounts(counts)
  const concerns = await fetchConcernStats(campaignId, includeTests, funnel.started)

  const districtCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.district) continue
    districtCounts.set(row.district, (districtCounts.get(row.district) ?? 0) + 1)
  }
  const districts = [...districtCounts.entries()]
    .map(([name, cnt]) => ({ name, cnt }))
    .sort((a, b) => b.cnt - a.cnt)

  const constituencyIds = [...new Set(rows.map((r) => r.constituency_id).filter(Boolean))] as string[]
  let constituencies: NamedCount[] = []
  if (constituencyIds.length > 0) {
    const supabase = createServiceClient()
    const { data } = await supabase.from('constituencies').select('id, name_ml').in('id', constituencyIds)
    const names = new Map((data ?? []).map((c) => [c.id as string, c.name_ml as string]))
    const map = new Map<string, number>()
    for (const row of rows) {
      if (!row.constituency_id) continue
      const name = names.get(row.constituency_id)
      if (!name) continue
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    constituencies = [...map.entries()].map(([name, cnt]) => ({ name, cnt })).sort((a, b) => b.cnt - a.cnt)
  }

  const methodCounts = new Map<string, number>()
  for (const row of rows) {
    if (!row.send_method) continue
    methodCounts.set(row.send_method, (methodCounts.get(row.send_method) ?? 0) + 1)
  }
  const methodTotal = [...methodCounts.values()].reduce((a, b) => a + b, 0)
  const sendMethods = [...methodCounts.entries()]
    .map(([method, cnt]) => ({
      method,
      label: sendMethodLabel(method),
      cnt,
      pct: pct(cnt, methodTotal),
    }))
    .sort((a, b) => b.cnt - a.cnt)

  const langCounts = new Map<string, number>()
  for (const row of rows) {
    const lang = row.language === 'en' ? 'English' : 'Malayalam'
    langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1)
  }
  const languages = [...langCounts.entries()]
    .map(([language, cnt]) => ({ language, cnt, pct: pct(cnt, funnel.started) }))
    .sort((a, b) => b.cnt - a.cnt)

  const withComment = rows.filter((r) => Boolean(r.custom_text?.trim())).length

  const supabase = createServiceClient()
  const comboRows = await fetchEveryPage(async (from, to) => {
    let comboQuery = supabase
      .from('submission_clauses')
      .select(
        `
    submission_id,
    clause_id,
    objection_clauses(title_en, sort_order),
    submissions!inner(campaign_id, is_test)
  `,
      )
      .eq('submissions.campaign_id', campaignId)
      .order('submission_id', { ascending: true })
      .order('clause_id', { ascending: true })
      .range(from, to)
    if (!includeTests) comboQuery = comboQuery.eq('submissions.is_test', false)
    return comboQuery
  })
  const bySubmission = new Map<string, string[]>()
  for (const row of comboRows ?? []) {
    const ocRaw = row.objection_clauses as { title_en: string; sort_order: number } | { title_en: string; sort_order: number }[] | null
    const oc = Array.isArray(ocRaw) ? ocRaw[0] : ocRaw
    if (!oc?.title_en) continue
    const list = bySubmission.get(row.submission_id as string) ?? []
    list.push(oc.title_en)
    bySubmission.set(row.submission_id as string, list)
  }
  const comboCounts = new Map<string, number>()
  for (const titles of bySubmission.values()) {
    if (titles.length < 2) continue
    const labels = [...titles].sort().slice(0, 3).join(' + ')
    comboCounts.set(labels, (comboCounts.get(labels) ?? 0) + 1)
  }
  const combinations = [...comboCounts.entries()]
    .map(([labels, cnt]) => ({ labels, cnt }))
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 8)

  return {
    funnel,
    trend: buildTrend(rows, trendRange),
    concerns,
    districts,
    constituencies,
    sendMethods,
    languages,
    personalCommentRate: {
      withComment,
      total: funnel.started,
      pct: pct(withComment, funnel.started),
    },
    combinations,
  }
}

export async function fetchAdminSubmissions(
  campaignId: string,
  filters: AdminFilters,
): Promise<{ rows: AdminSubmissionRow[]; total: number; page: number; pageSize: number }> {
  const supabase = createServiceClient()
  const page = Math.max(1, filters.page ?? 1)
  const from = (page - 1) * ADMIN_PAGE_SIZE
  const to = from + ADMIN_PAGE_SIZE - 1
  const ascending = filters.dir === 'asc'
  const sortColumn = filters.sort === 'stage' ? 'status' : 'created_at'

  let countQuery = filters.concernId
    ? supabase
        .from('submissions')
        .select('id, concern_match:submission_clauses!inner(clause_id)', { count: 'exact', head: true })
        .eq('concern_match.clause_id', filters.concernId)
    : supabase.from('submissions').select('id', { count: 'exact', head: true })
  countQuery = applyFilters(countQuery, filters, campaignId)
  const { count, error: countError } = await countQuery
  if (countError) throw countError

  // Production is missing custom_text_public; selecting it 500s the whole page.
  const listColumns = `
      id,
      created_at,
      full_name,
      email,
      phone_e164,
      district,
      panchayat,
      status,
      send_method,
      is_test,
      custom_text,
      constituency:constituencies(name_ml, name_en),
      submission_clauses(count)
    ` as const
  const filteredColumns = `
      id,
      created_at,
      full_name,
      email,
      phone_e164,
      district,
      panchayat,
      status,
      send_method,
      is_test,
      custom_text,
      constituency:constituencies(name_ml, name_en),
      submission_clauses(count),
      concern_match:submission_clauses!inner(clause_id)
    ` as const
  let dataQuery = filters.concernId
    ? supabase.from('submissions').select(filteredColumns).eq('concern_match.clause_id', filters.concernId)
    : supabase.from('submissions').select(listColumns)
    .order(sortColumn, { ascending })
    .range(from, to)

  if (sortColumn !== 'created_at') {
    dataQuery = dataQuery.order('created_at', { ascending: false })
  }

  dataQuery = applyFilters(dataQuery, filters, campaignId)
  if (filters.concernId) dataQuery = dataQuery.eq('concern_match.clause_id', filters.concernId)
  const { data, error } = await dataQuery
  if (error) throw error

  const rows: AdminSubmissionRow[] = (data ?? []).map((row) => {
    const constituencyRaw = row.constituency
    const constituency = (Array.isArray(constituencyRaw) ? constituencyRaw[0] : constituencyRaw) as
      | { name_ml: string; name_en: string }
      | null
    const clauseCountArr = row.submission_clauses as { count: number }[] | null
    const status = row.status as SubmissionStatus
    const stage = displayStage(status)
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      full_name: (row.full_name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone_e164: (row.phone_e164 as string | null) ?? null,
      district: row.district as string,
      panchayat: (row.panchayat as string | null) ?? null,
      constituency_name: constituency?.name_ml ?? constituency?.name_en ?? null,
      stage,
      stageLabel: DISPLAY_STAGE_LABEL[stage],
      send_method: (row.send_method as string | null) ?? null,
      sendMethodLabel: sendMethodLabel(row.send_method as string | null),
      is_test: Boolean(row.is_test),
      clause_count: clauseCountArr?.[0]?.count ?? 0,
      custom_text: (row.custom_text as string | null) ?? null,
    }
  })

  return { rows, total: count ?? 0, page, pageSize: ADMIN_PAGE_SIZE }
}

export async function fetchSubmissionDetail(id: string): Promise<SubmissionDetail | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('submissions')
    .select(
      `
      id,
      campaign_id,
      full_name,
      email,
      phone_e164,
      address_line,
      panchayat,
      district,
      pincode,
      language,
      custom_text,
      custom_text_public,
      generated_subject,
      generated_body,
      generated_to,
      generated_cc,
      send_method,
      status,
      is_test,
      created_at,
      verified_at,
      handoff_at,
      confirmed_at,
      consent_at,
      consent_version,
      ip_hash,
      user_agent,
      show_name_public,
      constituency_id,
      cc_representative_ids,
      constituency:constituencies(name_ml, name_en),
      submission_clauses(
        objection_clauses(id, code, title_ml, title_en, section_ref)
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const constituencyRaw = data.constituency
  const constituency = (Array.isArray(constituencyRaw) ? constituencyRaw[0] : constituencyRaw) as
    | { name_ml: string; name_en: string }
    | null

  const clauseRows = (data.submission_clauses ?? []) as {
    objection_clauses:
      | { id: string; code: string; title_ml: string; title_en: string; section_ref: string | null }
      | { id: string; code: string; title_ml: string; title_en: string; section_ref: string | null }[]
      | null
  }[]
  const clauses = clauseRows
    .map((row) => {
      const oc = Array.isArray(row.objection_clauses) ? row.objection_clauses[0] : row.objection_clauses
      return oc ?? null
    })
    .filter(
      (c): c is { id: string; code: string; title_ml: string; title_en: string; section_ref: string | null } =>
        Boolean(c),
    )

  const ccIds = (data.cc_representative_ids as string[] | null) ?? []
  let reps: SubmissionDetail['reps'] = []
  if (ccIds.length > 0) {
    const { data: repRows } = await supabase
      .from('representatives')
      .select('name_ml, name_en, official_email, level')
      .in('id', ccIds)
    reps = (repRows ?? []) as SubmissionDetail['reps']
  }

  const status = data.status as SubmissionStatus
  const stage = displayStage(status)
  const generatedTo = Array.isArray(data.generated_to) ? (data.generated_to as string[]) : []
  const generatedCc = Array.isArray(data.generated_cc) ? (data.generated_cc as string[]) : []

  return {
    id: data.id as string,
    campaign_id: data.campaign_id as string,
    full_name: (data.full_name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    phone_e164: (data.phone_e164 as string | null) ?? null,
    address_line: (data.address_line as string | null) ?? null,
    panchayat: (data.panchayat as string | null) ?? null,
    district: data.district as string,
    pincode: (data.pincode as string | null) ?? null,
    constituency_name: constituency?.name_ml ?? constituency?.name_en ?? null,
    constituency_id: (data.constituency_id as string | null) ?? null,
    language: (data.language as string) ?? 'ml',
    custom_text: (data.custom_text as string | null) ?? null,
    custom_text_public: Boolean(data.custom_text_public),
    generated_subject: (data.generated_subject as string) ?? '',
    generated_body: (data.generated_body as string) ?? '',
    generated_to: generatedTo,
    generated_cc: generatedCc,
    send_method: (data.send_method as string | null) ?? null,
    status,
    stage,
    is_test: Boolean(data.is_test),
    created_at: data.created_at as string,
    verified_at: (data.verified_at as string | null) ?? null,
    handoff_at: (data.handoff_at as string | null) ?? null,
    confirmed_at: (data.confirmed_at as string | null) ?? null,
    consent_at: data.consent_at as string,
    consent_version: data.consent_version as string,
    ip_hash: (data.ip_hash as string | null) ?? null,
    user_agent: (data.user_agent as string | null) ?? null,
    show_name_public: Boolean(data.show_name_public),
    clauses,
    reps,
  }
}

export async function fetchFilterOptions(campaignId: string): Promise<{
  districts: string[]
  panchayats: string[]
  constituencies: { id: string; name_ml: string; district: string }[]
  concerns: { id: string; code: string; title_en: string; title_ml: string }[]
}> {
  const supabase = createServiceClient()
  const [districts, panchayats, { data: constituencies }, { data: concerns }] = await Promise.all([
    fetchEveryPage((from, to) =>
      supabase
        .from('submissions')
        .select('id, district')
        .eq('campaign_id', campaignId)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchEveryPage((from, to) =>
      supabase
        .from('submissions')
        .select('id, panchayat')
        .eq('campaign_id', campaignId)
        .not('panchayat', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    supabase.from('constituencies').select('id, name_ml, district').eq('is_active', true).order('district'),
    supabase
      .from('objection_clauses')
      .select('id, code, title_en, title_ml')
      .eq('campaign_id', campaignId)
      .order('sort_order'),
  ])

  const districtSet = [...new Set(districts.map((d) => d.district as string).filter(Boolean))].sort()
  const panchayatSet = [
    ...new Set(panchayats.map((p) => (p.panchayat as string | null)?.trim() ?? '').filter(Boolean)),
  ].sort()
  return {
    districts: districtSet,
    panchayats: panchayatSet,
    constituencies: (constituencies ?? []) as { id: string; name_ml: string; district: string }[],
    concerns: (concerns ?? []) as { id: string; code: string; title_en: string; title_ml: string }[],
  }
}

export async function fetchDeletionRequests(): Promise<DeletionRequestRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('deletion_requests')
    .select('id, email, reason, handled_at, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as Omit<DeletionRequestRow, 'matching_count'>[]
  const emails = [...new Set(rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean))]
  const counts = new Map<string, number>()
  if (emails.length > 0) {
    const matches = await fetchEveryPage((from, to) =>
      supabase
        .from('submissions')
        .select('id, email_normalized')
        .in('email_normalized', emails)
        .order('id', { ascending: true })
        .range(from, to),
    )
    for (const row of matches) {
      const email = String(row.email_normalized ?? '')
        .trim()
        .toLowerCase()
      if (!email) continue
      counts.set(email, (counts.get(email) ?? 0) + 1)
    }
  }

  return rows.map((row) => ({
    ...row,
    matching_count: counts.get(row.email.trim().toLowerCase()) ?? 0,
  }))
}

export async function fetchNotifySignups(): Promise<NotifySignupRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('notify_signups')
    .select('id, email, created_at')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as NotifySignupRow[]
}

export async function fetchConcerns(campaignId: string): Promise<
  {
    id: string
    code: string
    section_ref: string | null
    title_ml: string
    title_en: string
    sort_order: number
    is_active: boolean
    usage_count: number
  }[]
> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('objection_clauses')
    .select('id, code, section_ref, title_ml, title_en, sort_order, is_active')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })
  if (error) throw error

  const usage = await fetchEveryPage((from, to) =>
    supabase
      .from('submission_clauses')
      .select('clause_id, submission_id, submissions!inner(campaign_id, is_test)')
      .eq('submissions.campaign_id', campaignId)
      .eq('submissions.is_test', false)
      .order('submission_id', { ascending: true })
      .order('clause_id', { ascending: true })
      .range(from, to),
  )

  const counts = new Map<string, Set<string>>()
  for (const row of usage) {
    const id = row.clause_id as string
    const submissionId = row.submission_id as string
    if (!counts.has(id)) counts.set(id, new Set())
    counts.get(id)!.add(submissionId)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    section_ref: (row.section_ref as string | null) ?? null,
    title_ml: row.title_ml as string,
    title_en: row.title_en as string,
    sort_order: row.sort_order as number,
    is_active: Boolean(row.is_active),
    usage_count: counts.get(row.id as string)?.size ?? 0,
  }))
}

export async function fetchConcernById(id: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('objection_clauses').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  const { count } = await supabase
    .from('submission_clauses')
    .select('submission_id', { count: 'exact', head: true })
    .eq('clause_id', id)
  return { ...data, usage_count: count ?? 0 }
}

export type SiteSettings = {
  default_language: string
  site_title_ml: string
  site_title_en: string
  tagline_ml: string
  tagline_en: string
  logo_url: string | null
  favicon_url: string | null
  og_image_url: string | null
  support_email: string | null
  public_disclaimer_ml: string
  public_disclaimer_en: string
  public_footer_ml: string
  public_footer_en: string
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
  return {
    default_language: (data?.default_language as string | undefined) ?? 'ml',
    site_title_ml: (data?.site_title_ml as string | undefined) ?? 'ജനശബ്ദം',
    site_title_en: (data?.site_title_en as string | undefined) ?? 'Janashabdam',
    tagline_ml: (data?.tagline_ml as string | undefined) ?? '',
    tagline_en: (data?.tagline_en as string | undefined) ?? '',
    logo_url: (data?.logo_url as string | null | undefined) ?? null,
    favicon_url: (data?.favicon_url as string | null | undefined) ?? null,
    og_image_url: (data?.og_image_url as string | null | undefined) ?? null,
    support_email: (data?.support_email as string | null | undefined) ?? null,
    public_disclaimer_ml: (data?.public_disclaimer_ml as string | undefined) ?? '',
    public_disclaimer_en: (data?.public_disclaimer_en as string | undefined) ?? '',
    public_footer_ml: (data?.public_footer_ml as string | undefined) ?? '',
    public_footer_en: (data?.public_footer_en as string | undefined) ?? '',
  }
}

export async function* streamSubmissionsCsv(campaignId: string, filters: AdminFilters): AsyncGenerator<string> {
  yield '\uFEFF'
  yield 'created_at,full_name,email,phone,address,panchayat,district,pincode,constituency,selected_concerns,custom_text,stage,send_method,confirmed_at,campaign_id,is_test\n'

  const supabase = createServiceClient()
  const batchSize = 200
  let offset = 0

  while (true) {
    const exportColumns = filters.concernId
      ? `
        id,
        created_at,
        full_name,
        email,
        phone_e164,
        address_line,
        panchayat,
        district,
        pincode,
        status,
        send_method,
        confirmed_at,
        custom_text,
        campaign_id,
        is_test,
        constituency:constituencies(name_ml),
        submission_clauses(objection_clauses(title_en, code)),
        concern_match:submission_clauses!inner(clause_id)
      ` as const
      : `
        id,
        created_at,
        full_name,
        email,
        phone_e164,
        address_line,
        panchayat,
        district,
        pincode,
        status,
        send_method,
        confirmed_at,
        custom_text,
        campaign_id,
        is_test,
        constituency:constituencies(name_ml),
        submission_clauses(objection_clauses(title_en, code))
      ` as const
    let query = supabase
      .from('submissions')
      .select(exportColumns)
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1)

    query = applyFilters(query, filters, campaignId)
    if (filters.concernId) query = query.eq('concern_match.clause_id', filters.concernId)
    const { data, error } = await query
    if (error) throw error
    const records = (data ?? []) as unknown as {
      created_at: string
      full_name: string | null
      email: string | null
      phone_e164: string | null
      address_line: string | null
      panchayat: string | null
      district: string
      pincode: string | null
      status: SubmissionStatus
      send_method: string | null
      confirmed_at: string | null
      custom_text: string | null
      campaign_id: string
      is_test: boolean
      constituency: { name_ml: string } | { name_ml: string }[] | null
      submission_clauses: {
        objection_clauses: { title_en: string; code: string } | { title_en: string; code: string }[] | null
      }[] | null
    }[]
    if (records.length === 0) break

    for (const row of records) {
      const constituencyRaw = row.constituency
      const constituency = (Array.isArray(constituencyRaw) ? constituencyRaw[0] : constituencyRaw) as
        | { name_ml: string }
        | null
      const clauseRows = (row.submission_clauses ?? []) as {
        objection_clauses: { title_en: string; code: string } | { title_en: string; code: string }[] | null
      }[]
      const concerns = clauseRows
        .map((item) => {
          const oc = Array.isArray(item.objection_clauses) ? item.objection_clauses[0] : item.objection_clauses
          return oc?.title_en || oc?.code || ''
        })
        .filter(Boolean)
        .join('; ')
      const stage = displayStage(row.status as SubmissionStatus)
      yield [
        csvCell(new Date(row.created_at as string).toISOString()),
        csvCell((row.full_name as string | null) ?? ''),
        csvCell((row.email as string | null) ?? ''),
        csvCell((row.phone_e164 as string | null) ?? ''),
        csvCell((row.address_line as string | null) ?? ''),
        csvCell((row.panchayat as string | null) ?? ''),
        csvCell((row.district as string) ?? ''),
        csvCell((row.pincode as string | null) ?? ''),
        csvCell(constituency?.name_ml ?? ''),
        csvCell(concerns),
        csvCell((row.custom_text as string | null) ?? ''),
        csvCell(DISPLAY_STAGE_LABEL[stage]),
        csvCell(sendMethodLabel(row.send_method as string | null)),
        csvCell((row.confirmed_at as string | null) ?? ''),
        csvCell((row.campaign_id as string) ?? ''),
        csvCell(row.is_test ? 'true' : 'false'),
      ].join(',') + '\n'
    }

    if (data.length < batchSize) break
    offset += batchSize
  }
}

export async function* streamNotifySignupsCsv(): AsyncGenerator<string> {
  yield '\uFEFF'
  yield 'email,created_at\n'

  const supabase = createServiceClient()
  const batchSize = 200
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('notify_signups')
      .select('email, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      yield `${csvCell(row.email as string)},${csvCell(row.created_at as string)}\n`
    }
    if (data.length < batchSize) break
    offset += batchSize
  }
}
