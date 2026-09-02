-- Restore Malayalam "കത്ത് N" prefixes after a bad unicode escape replacement,
-- and correct അഭ്യർത്ഥിക്കുന്നു in the new Letter 1 body.

do $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.campaigns
  where slug = 'western-ghats-people-protection-forum';

  if v_id is null then
    return;
  end if;

  update public.objection_clauses
  set title_ml = 'കത്ത് ' || sort_order::text || coalesce(substring(title_ml from ' — .*'), '')
  where campaign_id = v_id
    and code in (
      'WGPPF01', 'WGPPF02', 'WGPPF03', 'WGPPF04', 'WGPPF05',
      'WGPPF06', 'WGPPF07', 'WGPPF08', 'WGPPF09', 'WGPPF10', 'WGPPF11'
    );

  update public.objection_clauses
  set
    full_text_ml = replace(full_text_ml, 'അഭ്യർത്തിക്കുന്നു', 'അഭ്യർത്ഥിക്കുന്നു'),
    email_ml = replace(email_ml, 'അഭ്യർത്തിക്കുന്നു', 'അഭ്യർത്ഥിക്കുന്നു'),
    email_body_ml = replace(email_body_ml, 'അഭ്യർത്തിക്കുന്നു', 'അഭ്യർത്ഥിക്കുന്നു'),
    updated_at = now()
  where campaign_id = v_id
    and code = 'WGPPF12';
end $$;
