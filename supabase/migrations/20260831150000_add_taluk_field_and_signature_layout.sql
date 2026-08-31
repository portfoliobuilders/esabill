-- Taluk form field and signature-block email layout for Western Ghats campaign.

do $$
declare
  v_id uuid;
  v_sig_en text := $sig_en$From:

Name: {{full_name}}
Address: {{address}}
Village: {{village}}  Panchayat: {{panchayat}}
Taluk: {{taluk}}  District: {{district}}
Mobile: {{phone}}$sig_en$;
  v_sig_ml text := $sig_ml$ആരിൽ നിന്ന്:

പേര്: {{full_name}}
വിലാസം: {{address}}
വില്ലേജ്: {{village}}  പഞ്ചായത്ത്: {{panchayat}}
താലൂക്ക്: {{taluk}}  ജില്ല: {{district}}
മൊബൈൽ: {{phone}}$sig_ml$;
begin
  select id into v_id from public.campaigns where slug = 'western-ghats-people-protection-forum';
  if v_id is null then
    return;
  end if;

  update public.campaigns
  set
    body_template_en = split_part(body_template_en, '{{closing}}', 1) || '{{closing}}' || E'\n\n' || v_sig_en,
    body_template_ml = split_part(body_template_ml, '{{closing}}', 1) || '{{closing}}' || E'\n\n' || v_sig_ml
  where id = v_id;

  insert into public.campaign_form_fields (campaign_id, field_key, label_en, label_ml, is_enabled, is_required, display_order)
  values (v_id, 'taluk', 'Taluk', 'താലൂക്ക്', true, true, 8)
  on conflict (campaign_id, field_key) do update set
    label_en = excluded.label_en,
    label_ml = excluded.label_ml,
    is_enabled = excluded.is_enabled,
    is_required = excluded.is_required,
    display_order = excluded.display_order;

  update public.campaign_form_fields set display_order = 9 where campaign_id = v_id and field_key = 'pincode';
  update public.campaign_form_fields set display_order = 10 where campaign_id = v_id and field_key = 'email';
  update public.campaign_form_fields set display_order = 11 where campaign_id = v_id and field_key = 'custom_message';
end $$;
