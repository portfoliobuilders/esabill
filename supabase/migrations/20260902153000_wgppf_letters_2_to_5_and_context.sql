-- Insert WGPPF letters 2–5, shift existing letters to 6–16, refresh campaign context.

do $$
declare
  v_id uuid;
  v_ml_13 text := $ml13$കേരളത്തിന്റെ പ്രത്യേക സാഹചര്യത്തിൽ റവന്യൂ വില്ലേജ് ESA പ്രഖ്യാപനത്തിൽ അടിസ്ഥാന ഘടകമായി പരിഗണിക്കാൻ പാടില്ല.

131 വില്ലേജുകളിലെ ജനവാസ കേന്ദ്രങ്ങളും കൃഷിയിടങ്ങളും തോട്ടങ്ങളും അടങ്ങുന്ന മുഴുവൻ റവന്യൂ വില്ലേജ് ESA പരിധിയിൽ നിന്ന് ഒഴിവാക്കണം. റവന്യൂ വില്ലേജിന്റെ പേരിൽ ESA അറിയപ്പെടരുത്. അഥവാ സൗകര്യത്തിനു വേണ്ടി റവന്യൂ വില്ലേജിന്റെ പേരിലാണ് ESA അന്തിമ വിജ്ഞാപനത്തിൽ അറിയപ്പെടുന്നതെങ്കിൽ, ആ വില്ലേജിലെ റവന്യൂ ഭൂമിയിൽ ESA നിയമങ്ങൾ ബാധകമല്ല എന്ന് കൃത്യമായി അന്തിമ വിജ്ഞാപനത്തിൽ രേഖപ്പെടുത്തണം.$ml13$;
  v_en_13 text := $en13$In Kerala's special circumstances, a revenue village must not be treated as the basic unit for ESA notification.

Residential areas, agricultural lands and plantations in the 131 villages must be fully excluded from the ESA boundary. ESA must not be notified in the name of a revenue village alone.

If, for administrative convenience, ESA is notified in a revenue village's name in the final notification, it must be clearly recorded that ESA regulations do not apply to revenue land within that village.$en13$;
  v_ml_14 text := $ml14$കേരള സംസ്ഥാനത്തിൽ ESA അന്തിമ വിജ്ഞാപനത്തിൽ പെടുത്തേണ്ട വനമേഖലയുടെയും സംരക്ഷിത മേഖലയുടെയും കൃത്യമായ ജിയോ കോഡിനേറ്റ് മാപ്പ്, ജനവാസ കേന്ദ്രങ്ങളെയും കൃഷിയിടങ്ങളെയും തോട്ടങ്ങളെയും ഒഴിവാക്കി, അടിയന്തരമായി തയ്യാറാക്കി കേന്ദ്ര വനപരിസ്ഥിതി കാലാവസ്ഥ വ്യതിയാന വകുപ്പിന് നൽകണം. പരാതികൾ അയക്കുവാൻ ഈ മാപ്പ് ബയോ ഡൈവേഴ്സിറ്റി ബോർഡിന്റെ വെബ്സൈറ്റിൽ ജനങ്ങൾക്ക് ലഭ്യമാക്കണം എന്ന് ആവശ്യപ്പെടുന്നു.$ml14$;
  v_en_14 text := $en14$An accurate geo-coordinate map of the forest and protected areas to be included in Kerala's final ESA notification — excluding residential areas, agricultural lands and plantations — must be prepared urgently and submitted to the Ministry of Environment, Forest and Climate Change.

This map must also be made available to the public on the Kerala State Biodiversity Board website so that people can send representations and complaints with reference to it.$en14$;
  v_ml_15 text := $ml15$കൃത്യമായ ESA മാപ്പും മേൽപ്പറഞ്ഞ തിരുത്തലുകൾക്ക് ആവശ്യമായ സർക്കാർ കമന്റുകളും ഉൾച്ചേർത്ത സംസ്ഥാന സർക്കാരിന്റെ അന്തിമ റിപ്പോർട്ട് ചീഫ് സെക്രട്ടറി വഴി കേന്ദ്ര വനപരിസ്ഥിതി മന്ത്രാലയത്തിൽ അടിയന്തരമായി എത്തിക്കണമെന്ന് അപേക്ഷിക്കുന്നു.$ml15$;
  v_en_15 text := $en15$The State Government's final report, incorporating the accurate ESA map and the government comments required for the corrections stated above, must be urgently forwarded to the Ministry of Environment, Forest and Climate Change through the Chief Secretary.$en15$;
  v_ml_16 text := $ml16$കരട് വിജ്ഞാപനം എത്രയും പെട്ടെന്ന് മാതൃഭാഷയിൽ ലഭ്യമാക്കുകയും കൃത്യമായ ESA മാപ്പ് അടക്കമുള്ള അനുബന്ധ രേഖകൾ ജനങ്ങൾക്ക് ആക്ഷേപങ്ങൾ അയക്കാൻ പറ്റിയ വിധത്തിൽ എത്രയും പെട്ടെന്ന് പൊതുജനങ്ങൾക്ക് ലഭ്യമാക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.$ml16$;
  v_en_16 text := $en16$The draft notification must be made available in the mother tongue as soon as possible, together with the accurate ESA map and all supporting documents, so that the public can study them and send objections without delay.$en16$;
begin
  select id into v_id
  from public.campaigns
  where slug = 'western-ghats-people-protection-forum';

  if v_id is null then
    raise notice 'WGPPF campaign not found; skipping.';
    return;
  end if;

  if exists (
    select 1 from public.objection_clauses
    where campaign_id = v_id and code = 'WGPPF16'
  ) then
    raise notice 'WGPPF letters 2–5 already present; skipping.';
    return;
  end if;

  update public.objection_clauses
  set sort_order = sort_order + 4
  where campaign_id = v_id
    and code in (
      'WGPPF01', 'WGPPF02', 'WGPPF03', 'WGPPF04', 'WGPPF05',
      'WGPPF06', 'WGPPF07', 'WGPPF08', 'WGPPF09', 'WGPPF10', 'WGPPF11'
    );

  insert into public.objection_clauses (
    campaign_id, code, section_ref, sort_order, is_active,
    title_en, title_ml, explain_en, explain_ml, full_text_en, full_text_ml,
    email_en, email_ml, email_subject_en, email_subject_ml, email_body_en, email_body_ml
  ) values
  (
    v_id, 'WGPPF13', null, 2, true,
    'Letter 2 — Revenue villages must not be the basis for ESA in Kerala',
    'കത്ത് 2 — റവന്യൂ വില്ലേജ് ESA-യിൽ അടിസ്ഥാന ഘടകമാകരുത്',
    'Whole revenue villages with homes, farms and plantations must be excluded from ESA.',
    '131 വില്ലേജുകളിലെ ജനവാസ-കൃഷി-തോട്ട മേഖലകൾ ESAയിൽ നിന്ന് ഒഴിവാക്കണം.',
    v_en_13, v_ml_13, v_en_13, v_ml_13,
    'Revenue villages must not be the basis for ESA in Kerala',
    'കേരളത്തിൽ റവന്യൂ വില്ലേജ് ESA-യിൽ അടിസ്ഥാന ഘടകമാകരുത്',
    v_en_13, v_ml_13
  ),
  (
    v_id, 'WGPPF14', null, 3, true,
    'Letter 3 — Publish an accurate geo-coordinate ESA map for Kerala',
    'കത്ത് 3 — കൃത്യമായ ജിയോ കോഡിനേറ്റ് ESA മാപ്പ് പ്രസിദ്ധീകരിക്കണം',
    'Forest/protected-area geo map excluding homes, farms and plantations must be published urgently.',
    'വന-സംരക്ഷിത മേഖലകളുടെ ജിയോ മാപ്പ് Biodiversity Board വെബ്സൈറ്റിൽ ലഭ്യമാക്കണം.',
    v_en_14, v_ml_14, v_en_14, v_ml_14,
    'Accurate geo-coordinate ESA map for Kerala must be published urgently',
    'കൃത്യമായ ജിയോ കോഡിനേറ്റ് ESA മാപ്പ് അടിയന്തരമായി പ്രസിദ്ധീകരിക്കണം',
    v_en_14, v_ml_14
  ),
  (
    v_id, 'WGPPF15', null, 4, true,
    'Letter 4 — Send Kerala''s final ESA report through the Chief Secretary',
    'കത്ത് 4 — ചീഫ് സെക്രട്ടറി വഴി സംസ്ഥാനത്തിന്റെ അന്തിമ ESA റിപ്പോർട്ട് അയയ്ക്കണം',
    'Final state report with ESA map and government comments must reach MoEFCC urgently.',
    'ESA മാപ്പും സർക്കാർ കമന്റുകളും ഉൾപ്പെടുത്തിയ അന്തിമ റിപ്പോർട്ട് അടിയന്തരമായി അയയ്ക്കണം.',
    v_en_15, v_ml_15, v_en_15, v_ml_15,
    'Kerala final ESA report with map must be sent through the Chief Secretary',
    'ചീഫ് സെക്രട്ടറി വഴി സംസ്ഥാനത്തിന്റെ അന്തിമ ESA റിപ്പോർട്ട് അയയ്ക്കണം',
    v_en_15, v_ml_15
  ),
  (
    v_id, 'WGPPF16', null, 5, true,
    'Letter 5 — Publish the draft notification and ESA map in Malayalam immediately',
    'കത്ത് 5 — കരട് വിജ്ഞാപനവും ESA മാപ്പും മാതൃഭാഷയിൽ ഉടൻ ലഭ്യമാക്കണം',
    'Draft notification, ESA map and supporting documents must be published in Malayalam at once.',
    'കരട് വിജ്ഞാപനവും ESA മാപ്പും അനുബന്ധ രേഖകളും ഉടൻ മലയാളത്തിൽ ലഭ്യമാക്കണം.',
    v_en_16, v_ml_16, v_en_16, v_ml_16,
    'Draft ESA notification and map must be published in Malayalam immediately',
    'കരട് ESA വിജ്ഞാപനവും മാപ്പും ഉടൻ മലയാളത്തിൽ ലഭ്യമാക്കണം',
    v_en_16, v_ml_16
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

  update public.objection_clauses
  set
    title_ml = 'കത്ത് ' || sort_order::text || coalesce(substring(title_ml from ' — .*'), ''),
    title_en = 'Letter ' || sort_order::text || coalesce(substring(title_en from ' — .*'), '')
  where campaign_id = v_id
    and code like 'WGPPF%';

  update public.objection_clauses
  set
    title_ml = case code
      when 'WGPPF13' then 'കത്ത് 2 — റവന്യൂ വില്ലേജ് ESA-യിൽ അടിസ്ഥാന ഘടകമാകരുത്'
      when 'WGPPF14' then 'കത്ത് 3 — കൃത്യമായ ജിയോ കോഡിനേറ്റ് ESA മാപ്പ് പ്രസിദ്ധീകരിക്കണം'
      when 'WGPPF15' then 'കത്ത് 4 — ചീഫ് സെക്രട്ടറി വഴി സംസ്ഥാനത്തിന്റെ അന്തിമ ESA റിപ്പോർട്ട് അയയ്ക്കണം'
      when 'WGPPF16' then 'കത്ത് 5 — കരട് വിജ്ഞാപനവും ESA മാപ്പും മാതൃഭാഷയിൽ ഉടൻ ലഭ്യമാക്കണം'
      else title_ml
    end,
    email_subject_ml = case code
      when 'WGPPF13' then 'കേരളത്തിൽ റവന്യൂ വില്ലേജ് ESA-യിൽ അടിസ്ഥാന ഘടകമാകരുത്'
      else email_subject_ml
    end
  where campaign_id = v_id
    and code in ('WGPPF13', 'WGPPF14', 'WGPPF15', 'WGPPF16');

  update public.campaigns
  set
    summary_ml = '2026 ജൂലൈ 27-ലെ Western Ghats ESA കരട് വിജ്ഞാപനത്തിനെതിരെ പതിനാറ് കത്ത്-ടെംപ്ലates. തിരഞ്ഞെടുത്ത് നിങ്ങളുടെ വിവരങ്ങൾ ചേർത്ത് കേന്ദ്ര മന്ത്രാലയത്തിലേക്ക് അയയ്ക്കാം.',
    summary_en = 'Sixteen letter templates opposing the 27 July 2026 Western Ghats ESA draft notification. Select one, add your details, and send to the Ministry.',
    homepage_intro_ml = $intro_ml$2026 ജൂലൈ 27-ന് S.O.4106(E) നമ്പരിൽ കേന്ദ്ര വന പരിസ്ഥിതി കാലാവസ്ഥാ വ്യതിയാന മന്ത്രാലയം പുറപ്പെടുവിച്ച Western Ghats Ecologically Sensitive Area (ESA) കരട് വിജ്ഞാപനം ഞങ്ങളുടെ പ്രദേശത്തെ ജനങ്ങളെ നേരിട്ട് ബാധിക്കുന്നു. ആക്ഷേപങ്ങൾ സെപ്റ്റംബർ 25-ന് മുമ്പ് അറിയിക്കണം.

വ്യക്തികളും, സ്ഥാപനങ്ങളും, സംഘടനകളും, റസിഡൻ്റ് അസോസിയേഷനുകളും, ഗ്രാമസഭകളും, തൃതല പഞ്ചായത്ത് ഡയറക്ടർ ബോർഡുകളും, നിയമസഭയും കേന്ദ്ര പരിസ്ഥിതി, വന-കാലാവസ്ഥ വ്യതിയാന വകുപ്പിന് ആക്ഷേപങ്ങൾ അയയ്ക്കാവുന്നതാണ്.

പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതിയുടെ (Western Ghat People Protection Forum) തയ്യാറാക്കിയ കത്ത്-ടെംപ്ലatesിൽ നിന്ന് നിങ്ങളുടെ ആവശ്യത്തിനനുസരിച്ച് ഒരു കത്ത് തിരഞ്ഞെടുത്ത്, വിലാസവും വാർഡ്/വില്ലേജ് വിവരങ്ങളും പൂരിപ്പിച്ച് കേന്ദ്ര മന്ത്രാലയത്തിലേക്ക് അയയ്ക്കാം.$intro_ml$,
    homepage_intro_en = $intro_en$The Draft Notification on the Western Ghats Ecologically Sensitive Area (ESA), issued as S.O.4106(E) by the Ministry of Environment, Forest and Climate Change on 27 July 2026, directly affects people living in our area. Objections must be sent before 25 September.

Individuals, institutions, organisations, resident associations, gram sabhas, panchayat director boards and the Legislative Assembly may all send representations to the Ministry.

Choose one of the letter templates prepared by the Western Ghat People Protection Forum (പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി), fill in your address and ward/village details, and send your representation to the Ministry.$intro_en$,
    explainer_ml = array[
      '2014–2026 ESA വിഷയത്തിൽ കേരള സർക്കാർ റിപ്പോർട്ടുകളിൽ വില്ലേജുകളുടെ എണ്ണവും ESA വിസ്തൃതിയും തുടരെ മാറിയിട്ടുണ്ട് (123 → 119 → 92 → 98 → 131; 13,108.7 km² → 9,993.7 km² → 8,656.46 km² → 8,590.69 km²).',
      'HLWG/കസ്തൂരിരംഗൻ 2013: 123 വില്ലേജുകൾ, 13,108.7 km². കേരള/Oommen 2014: 123 വില്ലേജുകൾ, 9,993.7 km². കേരള 2018: 92 വില്ലേജുകൾ, 8,656.46 km². ജില്ലാ verification: 98 വില്ലേജുകൾ, 8,711.89 km². കേരള 02-11-2024: 98 വില്ലേജുകൾ, 8,590.69 km². MoEF&CC 2024/2026 Draft: 131 വില്ലേജുകൾ, 9,993.7 km².',
      'Centre govt 2024 മുതൽ 123 വില്ലേജുകൾ എട്ടായി വിഭജിച്ച് 131 ആക്കിയതും, ഉമ്മൻ കമ്മിറ്റി physical verification റിപ്പോർട്ടും, കേരള റിപ്പോർട്ടുകളിലെ വൈരുദ്ധ്യവും കരട് വിജ്ഞാപനത്തിൽ വ്യക്തമായി വിശദീകരിക്കപ്പെടാത്തതിന് കാരണമാകാം.',
      'ജനങ്ങളുടെ കിടപ്പാടങ്ങളും കൃഷിഭൂമികളും അന്തിമ വിജ്ഞാപനത്തിൽ വനഭൂമിയുടെ ഭാഗമായി മാറുകയോ ESA-യിൽ പെടുകയോ ചെയ്താൽ സംഭവിക്കാവുന്ന അപകടങ്ങൾ ഒഴിവാക്കാൻ, താഴെപ്പറയുന്ന ആക്ഷേപങ്ങൾ പോലെ നിങ്ങൾക്കും സ്വന്തമായി ആക്ഷേപം എഴുതി കേന്ദ്ര മന്ത്രാലയത്തെ അറിയിക്കാവുന്നതാണ്.'
    ],
    explainer_en = array[
      'Between 2014 and 2026, Kerala government reports on ESA have repeatedly changed both village counts and ESA area (123 → 119 → 92 → 98 → 131 villages; 13,108.7 km² → 9,993.7 km² → 8,656.46 km² → 8,590.69 km²).',
      'HLWG/Kasturirangan 2013: 123 villages, 13,108.7 km². Kerala/Oommen 2014: 123 villages, 9,993.7 km². Kerala 2018: 92 villages, 8,656.46 km². District verification: 98 villages, 8,711.89 km². Kerala 02-11-2024: 98 villages, 8,590.69 km². MoEF&CC 2024/2026 Draft: 131 villages, 9,993.7 km².',
      'The increase from 123 to 131 villages by splitting eight villages, the Oommen Committee physical verification report, and contradictions across Kerala reports may explain why these issues were not clearly explained in the draft notification.',
      'To avoid harm if homesteads and farmland are wrongly treated as forest or included in ESA, you may write your own objection to the Ministry, using the templates below as a guide.'
    ],
    updated_at = now()
  where id = v_id;
end $$;
