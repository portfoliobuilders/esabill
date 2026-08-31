-- Ward field for campaign forms, email templates, and submission records.

alter table public.submissions
  add column if not exists ward text;

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.campaigns where slug = 'western-ghats-people-protection-forum';
  if v_id is null then
    return;
  end if;

  update public.campaigns
  set
    body_template_ml = replace(body_template_ml, 'വാർഡ്: ______', 'വാർഡ്: {{ward}}'),
    body_template_en = replace(body_template_en, 'Ward: ______', 'Ward: {{ward}}')
  where id = v_id;

  insert into public.campaign_form_fields (campaign_id, field_key, label_en, label_ml, is_enabled, is_required, display_order)
  values (v_id, 'ward', 'Ward', 'വാർഡ്', true, true, 6)
  on conflict (campaign_id, field_key) do update set
    label_en = excluded.label_en,
    label_ml = excluded.label_ml,
    is_enabled = excluded.is_enabled,
    is_required = excluded.is_required,
    display_order = excluded.display_order;

  update public.campaign_form_fields set display_order = 7 where campaign_id = v_id and field_key = 'village';
  update public.campaign_form_fields set display_order = 8 where campaign_id = v_id and field_key = 'pincode';
  update public.campaign_form_fields set display_order = 9 where campaign_id = v_id and field_key = 'email';
  update public.campaign_form_fields set display_order = 10 where campaign_id = v_id and field_key = 'custom_message';
end $$;
