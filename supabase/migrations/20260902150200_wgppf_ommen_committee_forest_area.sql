-- Insert the Oommen Committee forest-area correction as Letter 1,
-- and renumber the existing WGPPF letters 1–11 to 2–12.

do $$
declare
  v_id uuid;
  v_ml text := $body_ml$ഫിസിക്കൽ വെരിഫിക്കേഷൻ നടത്തിയ ഉമ്മൻ കമ്മിറ്റി റിപ്പോർട്ടിന്റെ അടിസ്ഥാനത്തിൽ കേരളത്തിലെ 131 വില്ലേജുകളിലെ ഫോറസ്റ്റ് ആയി കരടിൽ രേഖപ്പെടുത്തിയിരിക്കുന്ന 9,993.7 ചതുരശ്രകിലോമീറ്റർ (9,107 + 886.7) എന്ന വന വിസ്തൃതിയിലെ തെറ്റ് അടിയന്തരമായി തിരുത്തണം.

അതായത് വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖ അനുസരിച്ച്, കേരളത്തിലെ മുഴുവൻ ഫോറസ്റ്റായ 9,107 ച.കി.മീ., കേവലം 7,595.67 ചതുരശ്രകിലോമീറ്റർ മാത്രം വനമുള്ള 123 വില്ലേജുകളിലെ ഫോറസ്റ്റ് ആയി റിപ്പോർട്ട് ചെയ്ത ഉമ്മൻ കമ്മിറ്റി റിപ്പോർട്ടിലെ അടിസ്ഥാനപരമായ തെറ്റ് അടിയന്തരമായി തിരുത്തി നൽകണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.$body_ml$;
  v_en text := $body_en$The 9,993.7 square kilometres (9,107 + 886.7) recorded as forest in 131 Kerala villages in the draft, on the basis of the Oommen Committee report which conducted physical verification, must be urgently corrected.

That is, according to Forest Department official records, Kerala's entire forest area is 9,107 sq. km. The Oommen Committee report's fundamental error of reporting that figure as the forest of 123 villages that have only 7,595.67 square kilometres of forest must be urgently corrected.$body_en$;
begin
  select id into v_id
  from public.campaigns
  where slug = 'western-ghats-people-protection-forum';

  if v_id is null then
    raise notice 'WGPPF campaign not found; skipping.';
    return;
  end if;

  update public.objection_clauses
  set
    sort_order = case code
      when 'WGPPF01' then 2
      when 'WGPPF02' then 3
      when 'WGPPF03' then 4
      when 'WGPPF04' then 5
      when 'WGPPF05' then 6
      when 'WGPPF06' then 7
      when 'WGPPF07' then 8
      when 'WGPPF08' then 9
      when 'WGPPF09' then 10
      when 'WGPPF10' then 11
      when 'WGPPF11' then 12
      else sort_order
    end,
    title_en = case code
      when 'WGPPF01' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 2')
      when 'WGPPF02' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 3')
      when 'WGPPF03' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 4')
      when 'WGPPF04' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 5')
      when 'WGPPF05' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 6')
      when 'WGPPF06' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 7')
      when 'WGPPF07' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 8')
      when 'WGPPF08' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 9')
      when 'WGPPF09' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 10')
      when 'WGPPF10' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 11')
      when 'WGPPF11' then regexp_replace(title_en, '^Letter [0-9]+', 'Letter 12')
      else title_en
    end,
    title_ml = case code
      when 'WGPPF01' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 2')
      when 'WGPPF02' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 3')
      when 'WGPPF03' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 4')
      when 'WGPPF04' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 5')
      when 'WGPPF05' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 6')
      when 'WGPPF06' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 7')
      when 'WGPPF07' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 8')
      when 'WGPPF08' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 9')
      when 'WGPPF09' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 10')
      when 'WGPPF10' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 11')
      when 'WGPPF11' then regexp_replace(title_ml, '^കത്ത് [0-9]+', 'കത്ത് 12')
      else title_ml
    end
  where campaign_id = v_id
    and code in (
      'WGPPF01', 'WGPPF02', 'WGPPF03', 'WGPPF04', 'WGPPF05',
      'WGPPF06', 'WGPPF07', 'WGPPF08', 'WGPPF09', 'WGPPF10', 'WGPPF11'
    );

  insert into public.objection_clauses (
    campaign_id, code, section_ref, sort_order, is_active,
    title_en, title_ml, explain_en, explain_ml, full_text_en, full_text_ml,
    email_en, email_ml, email_subject_en, email_subject_ml, email_body_en, email_body_ml
  ) values (
    v_id, 'WGPPF12', null, 1, true,
    'Letter 1 — Correct the Oommen Committee forest-area error in the draft',
    'കത്ത് 1 — ഉമ്മൻ കമ്മിറ്റി റിപ്പോർട്ടിലെ വനവിസ്തൃതി തെറ്റ് തിരുത്തണം',
    'The 9,993.7 sq. km recorded as forest in 131 villages must be corrected against Forest Department records.',
    '131 വില്ലേജുകളിൽ 9,993.7 ച.കി.മീ. വനമായി രേഖപ്പെടുത്തിയ കണക്ക് ഉമ്മൻ കമ്മിറ്റി റിപ്പോർട്ടിലെ അടിസ്ഥാന തെറ്റ് തിരുത്തണം.',
    v_en, v_ml, v_en, v_ml,
    'The Oommen Committee forest-area error in the draft ESA notification must be urgently corrected',
    'ഉമ്മൻ കമ്മിറ്റി റിപ്പോർട്ടിലെ വനവിസ്തൃതി തെറ്റ് അടിയന്തരമായി തിരുത്തണം',
    v_en, v_ml
  )
  on conflict (campaign_id, code) do update set
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    title_en = excluded.title_en,
    title_ml = excluded.title_ml,
    explain_en = excluded.explain_en,
    explain_ml = excluded.explain_ml,
    full_text_en = excluded.full_text_en,
    full_text_ml = excluded.full_text_ml,
    email_en = excluded.email_en,
    email_ml = excluded.email_ml,
    email_subject_en = excluded.email_subject_en,
    email_subject_ml = excluded.email_subject_ml,
    email_body_en = excluded.email_body_en,
    email_body_ml = excluded.email_body_ml,
    updated_at = now();
end $$;
