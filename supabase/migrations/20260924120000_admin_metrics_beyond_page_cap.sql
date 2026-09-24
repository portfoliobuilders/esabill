-- Read-only aggregates for the admin dashboard.
-- No existing rows are updated, deleted, or rewritten.

create index if not exists submissions_campaign_test_created
  on public.submissions (campaign_id, is_test, created_at);

create index if not exists submission_clauses_clause_id
  on public.submission_clauses (clause_id);

create or replace function public.admin_campaign_metrics(
  p_campaign_id uuid,
  p_include_tests boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select
      s.id,
      s.status,
      s.district,
      s.constituency_id,
      s.created_at,
      s.verified_at,
      s.handoff_at,
      s.confirmed_at,
      s.send_method,
      s.language,
      s.custom_text,
      s.is_test
    from public.submissions s
    where s.campaign_id = p_campaign_id
      and (p_include_tests or s.is_test = false)
  ),
  status_counts as (
    select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb) as value
    from (
      select status::text as status, count(*)::int as cnt
      from scoped
      group by status
    ) grouped
  ),
  windows as (
    select
      count(*) filter (where created_at >= now() - interval '7 days')::int as this_week,
      count(*) filter (
        where created_at >= now() - interval '14 days'
          and created_at < now() - interval '7 days'
      )::int as prev_week,
      count(*) filter (
        where status in ('confirmed_sent', 'server_sent')
          and created_at >= now() - interval '7 days'
      )::int as confirmed_this_week,
      count(*) filter (
        where status in ('confirmed_sent', 'server_sent')
          and created_at >= now() - interval '14 days'
          and created_at < now() - interval '7 days'
      )::int as confirmed_prev_week,
      count(*) filter (where created_at >= now() - interval '24 hours')::int as today,
      count(*) filter (where btrim(coalesce(custom_text, '')) <> '')::int as with_comment
    from scoped
  ),
  districts as (
    select coalesce(
      jsonb_agg(jsonb_build_object('name', district, 'cnt', cnt) order by cnt desc, district),
      '[]'::jsonb
    ) as value
    from (
      select district, count(*)::int as cnt
      from scoped
      where btrim(coalesce(district, '')) <> ''
      group by district
    ) grouped
  ),
  constituencies as (
    select coalesce(
      jsonb_agg(jsonb_build_object('name', name, 'cnt', cnt) order by cnt desc, name),
      '[]'::jsonb
    ) as value
    from (
      select coalesce(nullif(btrim(c.name_ml), ''), c.name_en) as name, count(*)::int as cnt
      from scoped s
      join public.constituencies c on c.id = s.constituency_id
      where coalesce(nullif(btrim(c.name_ml), ''), c.name_en) is not null
      group by 1
    ) grouped
  ),
  concerns as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'code', code,
          'title_ml', title_ml,
          'title_en', title_en,
          'section_ref', section_ref,
          'cnt', cnt
        )
        order by cnt desc, code
      ),
      '[]'::jsonb
    ) as value
    from (
      select oc.id, oc.code, oc.title_ml, oc.title_en, oc.section_ref, count(distinct s.id)::int as cnt
      from scoped s
      join public.submission_clauses sc on sc.submission_id = s.id
      join public.objection_clauses oc on oc.id = sc.clause_id
      group by oc.id, oc.code, oc.title_ml, oc.title_en, oc.section_ref
    ) grouped
  ),
  trend as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', day,
          'prepared', prepared,
          'emailOpened', email_opened,
          'confirmedSent', confirmed_sent
        )
        order by day
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        day::text as day,
        count(*) filter (where kind = 'prepared')::int as prepared,
        count(*) filter (where kind = 'opened')::int as email_opened,
        count(*) filter (where kind = 'confirmed')::int as confirmed_sent
      from (
        select
          (timezone('Asia/Kolkata', coalesce(verified_at, handoff_at, confirmed_at, created_at)))::date as day,
          'prepared'::text as kind
        from scoped
        where status in ('verified', 'handoff_opened', 'confirmed_sent', 'server_sent')
        union all
        select (timezone('Asia/Kolkata', handoff_at))::date, 'opened'
        from scoped
        where status in ('handoff_opened', 'confirmed_sent', 'server_sent')
          and handoff_at is not null
        union all
        select (timezone('Asia/Kolkata', confirmed_at))::date, 'confirmed'
        from scoped
        where status in ('confirmed_sent', 'server_sent')
          and confirmed_at is not null
      ) events
      where day is not null
      group by day
    ) grouped
  ),
  methods as (
    select coalesce(
      jsonb_agg(jsonb_build_object('method', send_method, 'cnt', cnt) order by cnt desc, send_method),
      '[]'::jsonb
    ) as value
    from (
      select send_method::text as send_method, count(*)::int as cnt
      from scoped
      where send_method is not null
      group by send_method
    ) grouped
  ),
  languages as (
    select coalesce(
      jsonb_agg(jsonb_build_object('language', language, 'cnt', cnt) order by cnt desc, language),
      '[]'::jsonb
    ) as value
    from (
      select case when language = 'en' then 'English' else 'Malayalam' end as language, count(*)::int as cnt
      from scoped
      group by 1
    ) grouped
  ),
  combinations as (
    select coalesce(
      jsonb_agg(jsonb_build_object('labels', labels, 'cnt', cnt) order by cnt desc, labels),
      '[]'::jsonb
    ) as value
    from (
      select labels, count(*)::int as cnt
      from (
        select
          submission_id,
          (
            select string_agg(title, ' + ' order by title)
            from (
              select title
              from unnest(titles) as title
              order by title
              limit 3
            ) picked
          ) as labels
        from (
          select sc.submission_id, array_agg(oc.title_en) as titles
          from scoped s
          join public.submission_clauses sc on sc.submission_id = s.id
          join public.objection_clauses oc on oc.id = sc.clause_id
          where oc.title_en is not null and btrim(oc.title_en) <> ''
          group by sc.submission_id
          having count(*) >= 2
        ) titled
      ) labeled
      where labels is not null and labels <> ''
      group by labels
    ) grouped
  )
  select jsonb_build_object(
    'status_counts', (select value from status_counts),
    'this_week', (select this_week from windows),
    'prev_week', (select prev_week from windows),
    'confirmed_this_week', (select confirmed_this_week from windows),
    'confirmed_prev_week', (select confirmed_prev_week from windows),
    'today', (select today from windows),
    'with_comment', (select with_comment from windows),
    'districts', (select value from districts),
    'constituencies', (select value from constituencies),
    'concerns', (select value from concerns),
    'trend', (select value from trend),
    'send_methods', (select value from methods),
    'languages', (select value from languages),
    'combinations', (select value from combinations)
  );
$$;

revoke all on function public.admin_campaign_metrics(uuid, boolean) from public;
revoke all on function public.admin_campaign_metrics(uuid, boolean) from anon, authenticated;
grant execute on function public.admin_campaign_metrics(uuid, boolean) to service_role;
