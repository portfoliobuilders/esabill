-- Western Ghat People Protection Forum (പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി)
-- Ten selectable letter templates for the July 2026 Western Ghats ESA draft notification.
-- Campaign stays draft/inactive until a live consultation is verified from a primary source.

do $$
declare
  v_id uuid;
  v_ml_intro text := $ml$2026 ജൂലൈ 27-ന് കേന്ദ്ര പരിസ്ഥിതി, വനം, കാലാവസ്ഥാ വ്യതിയാന മന്ത്രാലയം പുറപ്പെടുവിച്ച Western Ghats Ecologically Sensitive Area (ESA) കരട് വിജ്ഞാപനം ഞങ്ങളുടെ പ്രദേശത്തെ ജനങ്ങളെ നേരിട്ട് ബാധിക്കുന്നു.

പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതിയുടെ (Western Ghat People Protection Forum) തയ്യാറാക്കിയ കത്ത്-ടെംപ്ലatesിൽ നിന്ന് നിങ്ങളുടെ ആവശ്യത്തിനനുസരിച്ച് ഒരു കത്ത് തിരഞ്ഞെടുത്ത്, വിലാസവും വാർഡ്/വില്ലേജ് വിവരങ്ങളും പൂരിപ്പിച്ച് കേന്ദ്ര മന്ത്രാലയത്തിലേക്ക് അയയ്ക്കാം.$ml$;
  v_en_intro text := $en$The Draft Notification on the Western Ghats Ecologically Sensitive Area (ESA), issued by the Ministry of Environment, Forest and Climate Change on 27 July 2026, directly affects people living in our area.

Choose one of the letter templates prepared by the Western Ghat People Protection Forum (പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി), fill in your address and ward/village details, and send your representation to the Ministry.$en$;
  v_body_ml text := $mlt${{intro}}

{{concerns}}

{{custom_text}}

{{closing}}

പേര്: {{full_name}}
വിലാസം: {{address}}
വാർഡ്: ______  റവന്യൂ വില്ലേജ്: {{village}}  ജില്ല: {{district}}
മൊബൈൽ: {{phone}}$mlt$;
  v_body_en text := $ent${{intro}}

{{concerns}}

{{custom_text}}

{{closing}}

Name: {{full_name}}
Address: {{address}}
Ward: ______  Revenue Village: {{village}}  Panchayat: {{panchayat}}  District: {{district}}
Mobile: {{phone}}$ent$;
begin
  insert into public.campaigns (
    slug,
    title_ml,
    title_en,
    summary_ml,
    summary_en,
    homepage_intro_ml,
    homepage_intro_en,
    recipient_email,
    recipient_emails,
    cc_emails,
    bcc_emails,
    subject_ml,
    subject_en,
    intro_ml,
    intro_en,
    closing_ml,
    closing_en,
    body_template_ml,
    body_template_en,
    source_url,
    reference_url,
    opens_at,
    deadline_at,
    status,
    is_active,
    publish_status,
    allow_multiple_concerns,
    concern_selection_mode,
    max_concern_selections,
    allow_custom_concern,
    custom_concern_label_ml,
    custom_concern_label_en,
    custom_concern_placeholder_ml,
    custom_concern_placeholder_en,
    og_title_ml,
    og_title_en,
    og_description_ml,
    og_description_en,
    explainer_ml,
    explainer_en
  ) values (
    'western-ghats-people-protection-forum',
    'പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി — ESA കരട് വിജ്ഞാപനം',
    'Western Ghat People Protection Forum — ESA Draft Notification',
    '2026 ജൂലൈ 27-ലെ Western Ghats ESA കരട് വിജ്ഞാപനത്തിനെതിരെ പത്ത് കത്ത്-ടെംപ്ലates. തിരഞ്ഞെടുത്ത് നിങ്ങളുടെ വിവരങ്ങൾ ചേർത്ത് കേന്ദ്ര മന്ത്രാലയത്തിലേക്ക് അയയ്ക്കാം.',
    'Ten letter templates opposing the 27 July 2026 Western Ghats ESA draft notification. Select one, add your details, and send to the Ministry.',
    v_ml_intro,
    v_en_intro,
    'esz-mef@nic.in',
    array['esz-mef@nic.in']::text[],
    '{}'::text[],
    '{}'::text[],
    'Western Ghats ESA കരട് വിജ്ഞാപനം — പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി',
    'Western Ghats ESA Draft Notification — Western Ghat People Protection Forum',
    'ബഹുമാനപ്പെട്ട സെക്രട്ടറി,',
    'Respected Sir,',
    'വിശ്വസ്തതയോടെ,',
    'Yours faithfully,',
    v_body_ml,
    v_body_en,
    'https://moef.gov.in/',
    null,
    timestamptz '2026-07-27 00:00:00+05:30',
    timestamptz '2026-09-25 18:29:59+05:30',
    'draft',
    false,
    'draft',
    false,
    'single',
    null,
    true,
    'വാർഡ് നമ്പർ, റവന്യൂ വില്ലേജ് പേര് (ആവശ്യമെങ്കിൽ)',
    'Ward number and revenue village name (if needed)',
    'ഉദാ: 5-ാം വാർഡ്, കുന്നൂർ റവന്യൂ വില്ലേജ്',
    'e.g. Ward No. 5, Kunnur Revenue Village',
    'പശ്ചിമഘട്ട ജനസംരക്ഷണ സമിതി — ESA കരട് വിജ്ഞാപനം',
    'Western Ghat People Protection Forum — ESA Draft Notification',
    '2026 ജൂലൈ 27-ലെ Western Ghats ESA കരട് വിജ്ഞാപനത്തിനെതിരെ പത്ത് കത്ത്-ടെംപ്ലates.',
    'Ten letter templates for the 27 July 2026 Western Ghats ESA draft notification.',
    '{}'::text[],
    '{}'::text[]
  )
  on conflict (slug) do update set
    title_ml = excluded.title_ml,
    title_en = excluded.title_en,
    summary_ml = excluded.summary_ml,
    summary_en = excluded.summary_en,
    homepage_intro_ml = excluded.homepage_intro_ml,
    homepage_intro_en = excluded.homepage_intro_en,
    recipient_email = excluded.recipient_email,
    recipient_emails = excluded.recipient_emails,
    cc_emails = excluded.cc_emails,
    bcc_emails = excluded.bcc_emails,
    subject_ml = excluded.subject_ml,
    subject_en = excluded.subject_en,
    intro_ml = excluded.intro_ml,
    intro_en = excluded.intro_en,
    closing_ml = excluded.closing_ml,
    closing_en = excluded.closing_en,
    body_template_ml = excluded.body_template_ml,
    body_template_en = excluded.body_template_en,
    source_url = excluded.source_url,
    opens_at = excluded.opens_at,
    deadline_at = excluded.deadline_at,
    allow_multiple_concerns = excluded.allow_multiple_concerns,
    concern_selection_mode = excluded.concern_selection_mode,
    max_concern_selections = excluded.max_concern_selections,
    allow_custom_concern = excluded.allow_custom_concern,
    custom_concern_label_ml = excluded.custom_concern_label_ml,
    custom_concern_label_en = excluded.custom_concern_label_en,
    custom_concern_placeholder_ml = excluded.custom_concern_placeholder_ml,
    custom_concern_placeholder_en = excluded.custom_concern_placeholder_en,
    og_title_ml = excluded.og_title_ml,
    og_title_en = excluded.og_title_en,
    og_description_ml = excluded.og_description_ml,
    og_description_en = excluded.og_description_en,
    updated_at = now()
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.campaigns where slug = 'western-ghats-people-protection-forum';
  end if;

  delete from public.campaign_recipients where campaign_id = v_id;
  insert into public.campaign_recipients (campaign_id, recipient_type, email, display_order) values
    (v_id, 'to', 'esz-mef@nic.in', 1);

  delete from public.campaign_form_fields where campaign_id = v_id;
  insert into public.campaign_form_fields (campaign_id, field_key, label_en, label_ml, is_enabled, is_required, display_order) values
    (v_id, 'name',           'Full name',                'പൂർണ്ണ നാമം',                   true,  true,  1),
    (v_id, 'address',        'Address',                  'വിലാസം',                        true,  true,  2),
    (v_id, 'phone',          'Mobile number',            'മൊബൈൽ നമ്പർ',                   true,  true,  3),
    (v_id, 'district',       'District',                 'ജില്ല',                         true,  true,  4),
    (v_id, 'local_body',     'Panchayat / Municipality', 'പഞ്ചായത്ത് / മുനിസിപ്പാലിറ്റി', true,  true,  5),
    (v_id, 'village',        'Revenue village',          'റവന്യൂ വില്ലേജ്',               true,  true,  6),
    (v_id, 'pincode',        'PIN code',                 'പിൻകോഡ്',                      true,  false, 7),
    (v_id, 'email',          'Email',                    'ഇമെയിൽ',                       false, false, 8),
    (v_id, 'custom_message', 'Ward / village details',   'വാർഡ് / വില്ലേജ് വിവരങ്ങൾ',     true,  false, 9);

  delete from public.objection_clauses
  where campaign_id = v_id
    and code not like 'WGPPF%'
    and not exists (select 1 from public.submission_clauses sc where sc.clause_id = objection_clauses.id);

  update public.objection_clauses set is_active = false
  where campaign_id = v_id and code not like 'WGPPF%';

  insert into public.objection_clauses (
    campaign_id, code, section_ref, sort_order, is_active,
    title_en, title_ml, explain_en, explain_ml, full_text_en, full_text_ml,
    email_en, email_ml, email_subject_en, email_subject_ml, email_body_en, email_body_ml
  ) values
  (
    v_id, 'WGPPF01', null, 1, true,
    'Malayalam translation of notification and documents',
    'മലയാളത്തിൽ വിജ്ഞാപനവും രേഖകളും ലഭ്യമാക്കണം',
    'Request full Malayalam translation of the draft notification and supporting documents, with adequate additional time before finalisation.',
    'കരട് വിജ്ഞാപനവും അനുബന്ധ രേഖകളും മലയാളത്തിൽ ലഭ്യമാക്കി, പഠിക്കാനും ആക്ഷേപം നൽകാനും മതിയായ സമയം അനുവദിക്കണം.',
    $c1e$The Draft Notification on the Western Ghats Ecologically Sensitive Area (ESA) issued by the Ministry on 27 July 2026 directly affects the people living in our area.

Without the notification, supporting documents, lists and maps being made available in Malayalam, ordinary residents cannot reasonably understand the legal, geographical and social implications and submit informed objections.

We therefore request that the complete notification and all relevant supporting documents be made available in Malayalam. After such publication, a fresh and reasonable period should be granted to study the documents and obtain expert assistance before submitting objections.

No final notification should be issued until this process is completed.$c1e$,
    $c1m$2026 ജൂലൈ 27-ന് കേന്ദ്ര പരിസ്ഥിതി, വനം, കാലാവസ്ഥാ വ്യതിയാന മന്ത്രാലയം പുറപ്പെടുവിച്ച Western Ghats Ecologically Sensitive Area (ESA) കരട് വിജ്ഞാപനം ഞങ്ങളുടെ പ്രദേശത്തെ ജനങ്ങളെ നേരിട്ട് ബാധിക്കുന്നതാണ്.

കരട് വിജ്ഞാപനം, അനുബന്ധ രേഖകൾ, പട്ടികകൾ, മാപ്പുകൾ എന്നിവ മലയാളത്തിൽ ലഭ്യമല്ലാത്ത സാഹചര്യത്തിൽ സാധാരണ ജനങ്ങൾക്ക് അതിന്റെ നിയമപരവും ഭൂമിശാസ്ത്രപരവും സാമൂഹികവുമായ പ്രത്യാഘാതങ്ങൾ പൂർണ്ണമായി മനസ്സിലാക്കി ആക്ഷേപങ്ങൾ സമർപ്പിക്കുക പ്രായോഗികമല്ല.

അതിനാൽ വിജ്ഞാപനത്തിന്റെ പൂർണ്ണ മലയാള പരിഭാഷയും അനുബന്ധ രേഖകളും ലഭ്യമാക്കിയ ശേഷം അവ പഠിക്കാനും വിദഗ്ധരുടെ സഹായത്തോടെ അഭിപ്രായങ്ങൾ സമർപ്പിക്കാനും മതിയായ പുതിയ സമയം അനുവദിക്കണം.

ഈ നടപടികൾ പൂർത്തിയാക്കാതെ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കരുതെന്ന് ശക്തമായി ആവശ്യപ്പെടുന്നു.$c1m$,
    $c1e$The Draft Notification on the Western Ghats Ecologically Sensitive Area (ESA) issued by the Ministry on 27 July 2026 directly affects the people living in our area.

Without the notification, supporting documents, lists and maps being made available in Malayalam, ordinary residents cannot reasonably understand the legal, geographical and social implications and submit informed objections.

We therefore request that the complete notification and all relevant supporting documents be made available in Malayalam. After such publication, a fresh and reasonable period should be granted to study the documents and obtain expert assistance before submitting objections.

No final notification should be issued until this process is completed.$c1e$,
    $c1m$2026 ജൂലൈ 27-ന് കേന്ദ്ര പരിസ്ഥിതി, വനം, കാലാവസ്ഥാ വ്യതിയാന മന്ത്രാലയം പുറപ്പെടുവിച്ച Western Ghats Ecologically Sensitive Area (ESA) കരട് വിജ്ഞാപനം ഞങ്ങളുടെ പ്രദേശത്തെ ജനങ്ങളെ നേരിട്ട് ബാധിക്കുന്നതാണ്.

കരട് വിജ്ഞാപനം, അനുബന്ധ രേഖകൾ, പട്ടികകൾ, മാപ്പുകൾ എന്നിവ മലയാളത്തിൽ ലഭ്യമല്ലാത്ത സാഹചര്യത്തിൽ സാധാരണ ജനങ്ങൾക്ക് അതിന്റെ നിയമപരവും ഭൂമിശാസ്ത്രപരവും സാമൂഹികവുമായ പ്രത്യാഘാതങ്ങൾ പൂർണ്ണമായി മനസ്സിലാക്കി ആക്ഷേപങ്ങൾ സമർപ്പിക്കുക പ്രായോഗികമല്ല.

അതിനാൽ വിജ്ഞാപനത്തിന്റെ പൂർണ്ണ മലയാള പരിഭാഷയും അനുബന്ധ രേഖകളും ലഭ്യമാക്കിയ ശേഷം അവ പഠിക്കാനും വിദഗ്ധരുടെ സഹായത്തോടെ അഭിപ്രായങ്ങൾ സമർപ്പിക്കാനും മതിയായ പുതിയ സമയം അനുവദിക്കണം.

ഈ നടപടികൾ പൂർത്തിയാക്കാതെ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കരുതെന്ന് ശക്തമായി ആവശ്യപ്പെടുന്നു.$c1m$,
    '2026 July 27 Western Ghats ESA Draft Notification and all supporting documents should be made available in Malayalam, with adequate additional time before finalisation',
    '2026 ജൂലൈ 27-ലെ Western Ghats ESA കരട് വിജ്ഞാപനവും അനുബന്ധ രേഖകളും മലയാളത്തിൽ ലഭ്യമാക്കി, മതിയായ സമയം അനുവദിച്ചശേഷം മാത്രമേ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കാവൂ',
    $c1e$The Draft Notification on the Western Ghats Ecologically Sensitive Area (ESA) issued by the Ministry on 27 July 2026 directly affects the people living in our area.

Without the notification, supporting documents, lists and maps being made available in Malayalam, ordinary residents cannot reasonably understand the legal, geographical and social implications and submit informed objections.

We therefore request that the complete notification and all relevant supporting documents be made available in Malayalam. After such publication, a fresh and reasonable period should be granted to study the documents and obtain expert assistance before submitting objections.

No final notification should be issued until this process is completed.$c1e$,
    $c1m$2026 ജൂലൈ 27-ന് കേന്ദ്ര പരിസ്ഥിതി, വനം, കാലാവസ്ഥാ വ്യതിയാന മന്ത്രാലയം പുറപ്പെടുവിച്ച Western Ghats Ecologically Sensitive Area (ESA) കരട് വിജ്ഞാപനം ഞങ്ങളുടെ പ്രദേശത്തെ ജനങ്ങളെ നേരിട്ട് ബാധിക്കുന്നതാണ്.

കരട് വിജ്ഞാപനം, അനുബന്ധ രേഖകൾ, പട്ടികകൾ, മാപ്പുകൾ എന്നിവ മലയാളത്തിൽ ലഭ്യമല്ലാത്ത സാഹചര്യത്തിൽ സാധാരണ ജനങ്ങൾക്ക് അതിന്റെ നിയമപരവും ഭൂമിശാസ്ത്രപരവും സാമൂഹികവുമായ പ്രത്യാഘാതങ്ങൾ പൂർണ്ണമായി മനസ്സിലാക്കി ആക്ഷേപങ്ങൾ സമർപ്പിക്കുക പ്രായോഗികമല്ല.

അതിനാൽ വിജ്ഞാപനത്തിന്റെ പൂർണ്ണ മലയാള പരിഭാഷയും അനുബന്ധ രേഖകളും ലഭ്യമാക്കിയ ശേഷം അവ പഠിക്കാനും വിദഗ്ധരുടെ സഹായത്തോടെ അഭിപ്രായങ്ങൾ സമർപ്പിക്കാനും മതിയായ പുതിയ സമയം അനുവദിക്കണം.

ഈ നടപടികൾ പൂർത്തിയാക്കാതെ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കരുതെന്ന് ശക്തമായി ആവശ്യപ്പെടുന്നു.$c1m$
  ),
  (
    v_id, 'WGPPF02', null, 2, true,
    'Publish clear village/ward/cadastral maps and Survey Number information',
    'വ്യക്തമായ മാപ്പുകളും cadastral വിവരങ്ങളും പ്രസിദ്ധീകരിക്കണം',
    'Request revenue-village, ward and Survey Number maps so landholders can see whether their land falls within the proposed ESA.',
    'റവന്യൂ വില്ലേജ്, വാർഡ്, Survey Number അടിസ്ഥാനത്തിലുള്ള GIS/cadastral മാപ്പുകൾ പ്രസിദ്ധീകരിക്കണം.',
    $c2e$The maps accompanying the draft do not enable an ordinary landholder to determine accurately whether his or her land, ward, settlement, agricultural area or forest area falls within the proposed ESA.

We therefore request publication of clear revenue-village, ward and Survey Number/Cadastral maps. Forest Land, Protected Areas, Agricultural Land and Residential Areas should be separately identifiable through GIS/cadastral maps.

Only after such maps are made available can affected persons submit meaningful objections. We therefore request publication of the maps followed by adequate time for objections.$c2e$,
    $c2m$കരട് വിജ്ഞാപനത്തോടൊപ്പം ലഭ്യമായ മാപ്പുകൾ പരിശോധിച്ച് ഒരു സാധാരണ ഭൂവുടമയ്ക്ക് തന്റെ ഭൂമി, വാർഡ്, ജനവാസകേന്ദ്രം, കൃഷിയിടം, വനഭൂമി എന്നിവ ESA പരിധിയിൽ ഉൾപ്പെട്ടിട്ടുണ്ടോ എന്ന് കൃത്യമായി മനസ്സിലാക്കാൻ കഴിയുന്നില്ല.

അതിനാൽ റവന്യൂ വില്ലേജ്, വാർഡ്, Survey Number/Cadastral അടിസ്ഥാനത്തിലുള്ള വ്യക്തമായ മാപ്പുകൾ പ്രസിദ്ധീകരിക്കണം. Forest Land, Protected Area, Agricultural Land, Residential Area എന്നിവ പ്രത്യേകം തിരിച്ചറിയാവുന്ന രീതിയിലുള്ള GIS/cadastral maps പൊതുജനങ്ങൾക്ക് ലഭ്യമാക്കണം.

വ്യക്തമായ മാപ്പുകൾ ലഭ്യമാക്കിയ ശേഷം മാത്രമേ ബാധിതർക്ക് ഫലപ്രദമായ ആക്ഷേപം സമർപ്പിക്കാൻ കഴിയൂ. അതിനാൽ മാപ്പുകൾ പ്രസിദ്ധീകരിക്കുകയും തുടർന്ന് മതിയായ objection period അനുവദിക്കുകയും ചെയ്യണമെന്ന് ആവശ്യപ്പെടുന്നു.$c2m$,
    $c2e$The maps accompanying the draft do not enable an ordinary landholder to determine accurately whether his or her land, ward, settlement, agricultural area or forest area falls within the proposed ESA.

We therefore request publication of clear revenue-village, ward and Survey Number/Cadastral maps. Forest Land, Protected Areas, Agricultural Land and Residential Areas should be separately identifiable through GIS/cadastral maps.

Only after such maps are made available can affected persons submit meaningful objections. We therefore request publication of the maps followed by adequate time for objections.$c2e$,
    $c2m$കരട് വിജ്ഞാപനത്തോടൊപ്പം ലഭ്യമായ മാപ്പുകൾ പരിശോധിച്ച് ഒരു സാധാരണ ഭൂവുടമയ്ക്ക് തന്റെ ഭൂമി, വാർഡ്, ജനവാസകേന്ദ്രം, കൃഷിയിടം, വനഭൂമി എന്നിവ ESA പരിധിയിൽ ഉൾപ്പെട്ടിട്ടുണ്ടോ എന്ന് കൃത്യമായി മനസ്സിലാക്കാൻ കഴിയുന്നില്ല.

അതിനാൽ റവന്യൂ വില്ലേജ്, വാർഡ്, Survey Number/Cadastral അടിസ്ഥാനത്തിലുള്ള വ്യക്തമായ മാപ്പുകൾ പ്രസിദ്ധീകരിക്കണം. Forest Land, Protected Area, Agricultural Land, Residential Area എന്നിവ പ്രത്യേകം തിരിച്ചറിയാവുന്ന രീതിയിലുള്ള GIS/cadastral maps പൊതുജനങ്ങൾക്ക് ലഭ്യമാക്കണം.

വ്യക്തമായ മാപ്പുകൾ ലഭ്യമാക്കിയ ശേഷം മാത്രമേ ബാധിതർക്ക് ഫലപ്രദമായ ആക്ഷേപം സമർപ്പിക്കാൻ കഴിയൂ. അതിനാൽ മാപ്പുകൾ പ്രസിദ്ധീകരിക്കുകയും തുടർന്ന് മതിയായ objection period അനുവദിക്കുകയും ചെയ്യണമെന്ന് ആവശ്യപ്പെടുന്നു.$c2m$,
    'Publish clear village/ward/cadastral maps and Survey Number information for effective ESA objections',
    'ESA അതിർത്തി വ്യക്തമായി തിരിച്ചറിയുന്നതിനായി village/ward/cadastral അടിസ്ഥാനത്തിലുള്ള മാപ്പുകളും Survey Number വിവരങ്ങളും പ്രസിദ്ധീകരിക്കണം',
    $c2e$The maps accompanying the draft do not enable an ordinary landholder to determine accurately whether his or her land, ward, settlement, agricultural area or forest area falls within the proposed ESA.

We therefore request publication of clear revenue-village, ward and Survey Number/Cadastral maps. Forest Land, Protected Areas, Agricultural Land and Residential Areas should be separately identifiable through GIS/cadastral maps.

Only after such maps are made available can affected persons submit meaningful objections. We therefore request publication of the maps followed by adequate time for objections.$c2e$,
    $c2m$കരട് വിജ്ഞാപനത്തോടൊപ്പം ലഭ്യമായ മാപ്പുകൾ പരിശോധിച്ച് ഒരു സാധാരണ ഭൂവുടമയ്ക്ക് തന്റെ ഭൂമി, വാർഡ്, ജനവാസകേന്ദ്രം, കൃഷിയിടം, വനഭൂമി എന്നിവ ESA പരിധിയിൽ ഉൾപ്പെട്ടിട്ടുണ്ടോ എന്ന് കൃത്യമായി മനസ്സിലാക്കാൻ കഴിയുന്നില്ല.

അതിനാൽ റവന്യൂ വില്ലേജ്, വാർഡ്, Survey Number/Cadastral അടിസ്ഥാനത്തിലുള്ള വ്യക്തമായ മാപ്പുകൾ പ്രസിദ്ധീകരിക്കണം. Forest Land, Protected Area, Agricultural Land, Residential Area എന്നിവ പ്രത്യേകം തിരിച്ചറിയാവുന്ന രീതിയിലുള്ള GIS/cadastral maps പൊതുജനങ്ങൾക്ക് ലഭ്യമാക്കണം.

വ്യക്തമായ മാപ്പുകൾ ലഭ്യമാക്കിയ ശേഷം മാത്രമേ ബാധിതർക്ക് ഫലപ്രദമായ ആക്ഷേപം സമർപ്പിക്കാൻ കഴിയൂ. അതിനാൽ മാപ്പുകൾ പ്രസിദ്ധീകരിക്കുകയും തുടർന്ന് മതിയായ objection period അനുവദിക്കുകയും ചെയ്യണമെന്ന് ആവശ്യപ്പെടുന്നു.$c2m$
  ),
  (
    v_id, 'WGPPF03', null, 3, true,
    'Exclude a ward with no forest or protected area from the ESA',
    'വനമോ സംരക്ഷിത പ്രദേശമോ ഇല്ലാത്ത വാർഡ് ESAയിൽ നിന്ന് ഒഴിവാക്കണം',
    'Request exclusion of a ward that contains no forest land and no protected area such as a National Park or Wildlife Sanctuary.',
    'വനഭൂമിയോ ദേശീയോദ്യാനമോ വന്യജീവി സങ്കേതമോ ഇല്ലാത്ത വാർഡിനെ ESAയിൽ നിന്ന് പൂർണ്ണമായി ഒഴിവാക്കണം.',
    $c3e$Ward No. ______ of our __________________ Revenue Village contains no forest land and no protected area such as a National Park or Wildlife Sanctuary.

Hence including the entire ward in the ESA does not reflect the actual land-use pattern and ecological structure of the area.

Since the absence of forest and protected area is confirmed, the entire ward should be excluded from the final ESA notification. The revenue village must also be excluded from the ESA.$c3e$,
    $c3m$ഞങ്ങളുടെ ................................ റവന്യൂ വില്ലേജിലെ ............-ാം വാർഡിൽ വനഭൂമിയോ ദേശീയോദ്യാനം, വന്യജീവി സങ്കേതം തുടങ്ങിയ സംരക്ഷിത പ്രദേശമോ നിലവിലില്ല.

അതിനാൽ ഈ വാർഡിനെ മുഴുവനായി ESA പരിധിയിൽ ഉൾപ്പെടുത്തുന്നത് പ്രദേശത്തിന്റെ യഥാർത്ഥ ഭൂവിനിയോഗവും പരിസ്ഥിതി ഘടനയും പ്രതിഫലിപ്പിക്കുന്നതല്ല.

വാർഡ് തലത്തിൽ സ്ഥലപരിശോധനയും ഔദ്യോഗിക രേഖകളുടെ പരിശോധനയും നടത്തി വനമോ സംരക്ഷിത പ്രദേശമോ ഇല്ലെന്ന് സ്ഥിരീകരിച്ചാൽ ഈ വാർഡിനെ അന്തിമ ESA വിജ്ഞാപനത്തിൽ നിന്ന് പൂർണ്ണമായി ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുന്നു.$c3m$,
    $c3e$Ward No. ______ of our __________________ Revenue Village contains no forest land and no protected area such as a National Park or Wildlife Sanctuary.

Hence including the entire ward in the ESA does not reflect the actual land-use pattern and ecological structure of the area.

Since the absence of forest and protected area is confirmed, the entire ward should be excluded from the final ESA notification. The revenue village must also be excluded from the ESA.$c3e$,
    $c3m$ഞങ്ങളുടെ ................................ റവന്യൂ വില്ലേജിലെ ............-ാം വാർഡിൽ വനഭൂമിയോ ദേശീയോദ്യാനം, വന്യജീവി സങ്കേതം തുടങ്ങിയ സംരക്ഷിത പ്രദേശമോ നിലവിലില്ല.

അതിനാൽ ഈ വാർഡിനെ മുഴുവനായി ESA പരിധിയിൽ ഉൾപ്പെടുത്തുന്നത് പ്രദേശത്തിന്റെ യഥാർത്ഥ ഭൂവിനിയോഗവും പരിസ്ഥിതി ഘടനയും പ്രതിഫലിപ്പിക്കുന്നതല്ല.

വാർഡ് തലത്തിൽ സ്ഥലപരിശോധനയും ഔദ്യോഗിക രേഖകളുടെ പരിശോധനയും നടത്തി വനമോ സംരക്ഷിത പ്രദേശമോ ഇല്ലെന്ന് സ്ഥിരീകരിച്ചാൽ ഈ വാർഡിനെ അന്തിമ ESA വിജ്ഞാപനത്തിൽ നിന്ന് പൂർണ്ണമായി ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുന്നു.$c3m$,
    'Exclude Ward No. ______, which contains no forest or protected area, from the ESA',
    'വനമോ സംരക്ഷിത പ്രദേശമോ ഇല്ലാത്ത ............-ാം വാർഡിനെ ESAയിൽ നിന്ന് ഒഴിവാക്കണം',
    $c3e$Ward No. ______ of our __________________ Revenue Village contains no forest land and no protected area such as a National Park or Wildlife Sanctuary.

Hence including the entire ward in the ESA does not reflect the actual land-use pattern and ecological structure of the area.

Since the absence of forest and protected area is confirmed, the entire ward should be excluded from the final ESA notification. The revenue village must also be excluded from the ESA.$c3e$,
    $c3m$ഞങ്ങളുടെ ................................ റവന്യൂ വില്ലേജിലെ ............-ാം വാർഡിൽ വനഭൂമിയോ ദേശീയോദ്യാനം, വന്യജീവി സങ്കേതം തുടങ്ങിയ സംരക്ഷിത പ്രദേശമോ നിലവിലില്ല.

അതിനാൽ ഈ വാർഡിനെ മുഴുവനായി ESA പരിധിയിൽ ഉൾപ്പെടുത്തുന്നത് പ്രദേശത്തിന്റെ യഥാർത്ഥ ഭൂവിനിയോഗവും പരിസ്ഥിതി ഘടനയും പ്രതിഫലിപ്പിക്കുന്നതല്ല.

വാർഡ് തലത്തിൽ സ്ഥലപരിശോധനയും ഔദ്യോഗിക രേഖകളുടെ പരിശോധനയും നടത്തി വനമോ സംരക്ഷിത പ്രദേശമോ ഇല്ലെന്ന് സ്ഥിരീകരിച്ചാൽ ഈ വാർഡിനെ അന്തിമ ESA വിജ്ഞാപനത്തിൽ നിന്ന് പൂർണ്ണമായി ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുന്നു.$c3m$
  ),
  (
    v_id, 'WGPPF04', null, 4, true,
    'Revenue villages in Kerala should not be included wholesale in the ESA',
    'കേരളത്തിലെ റവന്യൂ വില്ലേജുകളെ blanket ആയി ESA ആക്കരുത്',
    'Kerala-specific micro-level demarcation based on forest and protected areas, not entire revenue villages.',
    'ഭരണപരമായ റവന്യൂ വില്ലേജിനെ മാത്രം അടിസ്ഥാനമാക്കി മുഴുവൻ പ്രദേശവും ESA ആയി പ്രഖ്യാപിക്കുന്നത് യുക്തിസഹമല്ല.',
    $c4e$Kerala has geographical and demographic conditions substantially different from the other Western Ghats States. Many revenue villages contain densely settled areas, towns, agricultural holdings, government and semi-government institutions, schools, hospitals, places of worship and commercial establishments.

Therefore, treating the entire administrative revenue village as ESA merely because it is a listed village is not scientifically appropriate.

Kerala-specific conditions should be considered and a scientific micro-level demarcation should be undertaken based on forest land and protected areas. Densely inhabited and cultivated areas should not be included by blanket treatment in the ESA.$c4e$,
    $c4m$കേരളത്തിന്റെ ഭൂമിശാസ്ത്രവും ജനസംഖ്യാ ഘടനയും മറ്റ് പശ്ചിമഘട്ട സംസ്ഥാനങ്ങളിൽ നിന്ന് വ്യത്യസ്തമാണ്. പല റവന്യൂ വില്ലേജുകളിലും ഉയർന്ന ജനസാന്ദ്രതയോടൊപ്പം പട്ടണങ്ങൾ, ജനവാസകേന്ദ്രങ്ങൾ, കൃഷിയിടങ്ങൾ, സർക്കാർ-അർധസർക്കാർ സ്ഥാപനങ്ങൾ, സ്കൂളുകൾ, ആശുപത്രികൾ, ആരാധനാലയങ്ങൾ, വ്യാപാര സ്ഥാപനങ്ങൾ തുടങ്ങിയവ നിലനിൽക്കുന്നു.

അതിനാൽ ഭരണപരമായ റവന്യൂ വില്ലേജിനെ മാത്രം അടിസ്ഥാനമാക്കി മുഴുവൻ പ്രദേശവും ESA ആയി പ്രഖ്യാപിക്കുന്നത് യുക്തിസഹമല്ല.

കേരളത്തിന്റെ പ്രത്യേക സാഹചര്യങ്ങൾ കണക്കിലെടുത്ത് വനഭൂമി, സംരക്ഷിത പ്രദേശം, യഥാർത്ഥ ecologically fragile areas എന്നിവയുടെ ശാസ്ത്രീയമായ micro-level demarcation നടത്തണം. ജനവാസവും കൃഷിയും ഉൾപ്പെടുന്ന പ്രദേശങ്ങളെ blanket inclusion-ൽ നിന്ന് ഒഴിവാക്കണം.$c4m$,
    $c4e$Kerala has geographical and demographic conditions substantially different from the other Western Ghats States. Many revenue villages contain densely settled areas, towns, agricultural holdings, government and semi-government institutions, schools, hospitals, places of worship and commercial establishments.

Therefore, treating the entire administrative revenue village as ESA merely because it is a listed village is not scientifically appropriate.

Kerala-specific conditions should be considered and a scientific micro-level demarcation should be undertaken based on forest land and protected areas. Densely inhabited and cultivated areas should not be included by blanket treatment in the ESA.$c4e$,
    $c4m$കേരളത്തിന്റെ ഭൂമിശാസ്ത്രവും ജനസംഖ്യാ ഘടനയും മറ്റ് പശ്ചിമഘട്ട സംസ്ഥാനങ്ങളിൽ നിന്ന് വ്യത്യസ്തമാണ്. പല റവന്യൂ വില്ലേജുകളിലും ഉയർന്ന ജനസാന്ദ്രതയോടൊപ്പം പട്ടണങ്ങൾ, ജനവാസകേന്ദ്രങ്ങൾ, കൃഷിയിടങ്ങൾ, സർക്കാർ-അർധസർക്കാർ സ്ഥാപനങ്ങൾ, സ്കൂളുകൾ, ആശുപത്രികൾ, ആരാധനാലയങ്ങൾ, വ്യാപാര സ്ഥാപനങ്ങൾ തുടങ്ങിയവ നിലനിൽക്കുന്നു.

അതിനാൽ ഭരണപരമായ റവന്യൂ വില്ലേജിനെ മാത്രം അടിസ്ഥാനമാക്കി മുഴുവൻ പ്രദേശവും ESA ആയി പ്രഖ്യാപിക്കുന്നത് യുക്തിസഹമല്ല.

കേരളത്തിന്റെ പ്രത്യേക സാഹചര്യങ്ങൾ കണക്കിലെടുത്ത് വനഭൂമി, സംരക്ഷിത പ്രദേശം, യഥാർത്ഥ ecologically fragile areas എന്നിവയുടെ ശാസ്ത്രീയമായ micro-level demarcation നടത്തണം. ജനവാസവും കൃഷിയും ഉൾപ്പെടുന്ന പ്രദേശങ്ങളെ blanket inclusion-ൽ നിന്ന് ഒഴിവാക്കണം.$c4m$,
    'Revenue villages in Kerala should not be included wholesale in the ESA',
    'കേരളത്തിലെ പ്രത്യേക സാഹചര്യത്തിൽ മുഴുവൻ റവന്യൂ വില്ലേജുകളെയും ESAയായി പ്രഖ്യാപിക്കുന്ന രീതി ഒഴിവാക്കണം',
    $c4e$Kerala has geographical and demographic conditions substantially different from the other Western Ghats States. Many revenue villages contain densely settled areas, towns, agricultural holdings, government and semi-government institutions, schools, hospitals, places of worship and commercial establishments.

Therefore, treating the entire administrative revenue village as ESA merely because it is a listed village is not scientifically appropriate.

Kerala-specific conditions should be considered and a scientific micro-level demarcation should be undertaken based on forest land and protected areas. Densely inhabited and cultivated areas should not be included by blanket treatment in the ESA.$c4e$,
    $c4m$കേരളത്തിന്റെ ഭൂമിശാസ്ത്രവും ജനസംഖ്യാ ഘടനയും മറ്റ് പശ്ചിമഘട്ട സംസ്ഥാനങ്ങളിൽ നിന്ന് വ്യത്യസ്തമാണ്. പല റവന്യൂ വില്ലേജുകളിലും ഉയർന്ന ജനസാന്ദ്രതയോടൊപ്പം പട്ടണങ്ങൾ, ജനവാസകേന്ദ്രങ്ങൾ, കൃഷിയിടങ്ങൾ, സർക്കാർ-അർധസർക്കാർ സ്ഥാപനങ്ങൾ, സ്കൂളുകൾ, ആശുപത്രികൾ, ആരാധനാലയങ്ങൾ, വ്യാപാര സ്ഥാപനങ്ങൾ തുടങ്ങിയവ നിലനിൽക്കുന്നു.

അതിനാൽ ഭരണപരമായ റവന്യൂ വില്ലേജിനെ മാത്രം അടിസ്ഥാനമാക്കി മുഴുവൻ പ്രദേശവും ESA ആയി പ്രഖ്യാപിക്കുന്നത് യുക്തിസഹമല്ല.

കേരളത്തിന്റെ പ്രത്യേക സാഹചര്യങ്ങൾ കണക്കിലെടുത്ത് വനഭൂമി, സംരക്ഷിത പ്രദേശം, യഥാർത്ഥ ecologically fragile areas എന്നിവയുടെ ശാസ്ത്രീയമായ micro-level demarcation നടത്തണം. ജനവാസവും കൃഷിയും ഉൾപ്പെടുന്ന പ്രദേശങ്ങളെ blanket inclusion-ൽ നിന്ന് ഒഴിവാക്കണം.$c4m$
  ),
  (
    v_id, 'WGPPF05', null, 5, true,
    'Residential areas and agricultural lands should be excluded from the final ESA boundary',
    'ജനവാസവും കൃഷിയിടങ്ങളും ഒഴിവാക്കണം',
    'Exclude houses, settlements, farms, plantations, towns, schools, hospitals and public institutions from the ESA boundary.',
    'വീടുകൾ, ജനവാസ മേഖലകൾ, കൃഷിയിടങ്ങൾ, തോട്ടങ്ങൾ, പൊതുസ്ഥാപനങ്ങൾ ESA അതിർത്തിയിൽ നിന്ന് വ്യക്തമായി ഒഴിവാക്കണം.',
    $c5e$We fully recognise the objective of ecological protection. However, including entire revenue villages containing residential settlements, agricultural holdings, plantations and public institutions in the ESA may unnecessarily affect the lives and livelihoods of residents.

Houses, residential areas, agricultural land, plantations, towns, schools, hospitals, places of worship, roads and public institutions should therefore be clearly excluded from the ESA boundary.

Only areas with demonstrable ecological significance such as forest and protected areas should be scientifically identified and included.$c5e$,
    $c5m$ESAയുടെ ലക്ഷ്യം പരിസ്ഥിതി സംരക്ഷണമാണെന്നത് ഞങ്ങൾ അംഗീകരിക്കുന്നു. എന്നാൽ ജനവാസകേന്ദ്രങ്ങളും കൃഷിയിടങ്ങളും തോട്ടങ്ങളും പൊതുസ്ഥാപനങ്ങളും ഉൾപ്പെടുന്ന മുഴുവൻ റവന്യൂ വില്ലേജിനെയും ESAയിൽ ഉൾപ്പെടുത്തുന്നത് ജനജീവിതത്തെ അനാവശ്യമായി ബാധിക്കാൻ ഇടയാക്കും.

അതുകൊണ്ട് വീടുകൾ, ജനവാസ മേഖലകൾ, കൃഷിയിടങ്ങൾ, തോട്ടങ്ങൾ, പട്ടണങ്ങൾ, സ്കൂളുകൾ, ആശുപത്രികൾ, ആരാധനാലയങ്ങൾ, റോഡുകൾ, പൊതുസ്ഥാപനങ്ങൾ തുടങ്ങിയ നിലവിലുള്ള മനുഷ്യവാസ മേഖലകൾ വ്യക്തമായി ഒഴിവാക്കി ESAയുടെ അതിർത്തി നിർണയിക്കണം.

യഥാർത്ഥ പരിസ്ഥിതി പ്രാധാന്യമുള്ള പ്രദേശങ്ങളെ മാത്രം ശാസ്ത്രീയമായി തിരിച്ചറിഞ്ഞ് ESA പരിധിയിൽ ഉൾപ്പെടുത്തണമെന്ന് ആവശ്യപ്പെടുന്നു.$c5m$,
    $c5e$We fully recognise the objective of ecological protection. However, including entire revenue villages containing residential settlements, agricultural holdings, plantations and public institutions in the ESA may unnecessarily affect the lives and livelihoods of residents.

Houses, residential areas, agricultural land, plantations, towns, schools, hospitals, places of worship, roads and public institutions should therefore be clearly excluded from the ESA boundary.

Only areas with demonstrable ecological significance such as forest and protected areas should be scientifically identified and included.$c5e$,
    $c5m$ESAയുടെ ലക്ഷ്യം പരിസ്ഥിതി സംരക്ഷണമാണെന്നത് ഞങ്ങൾ അംഗീകരിക്കുന്നു. എന്നാൽ ജനവാസകേന്ദ്രങ്ങളും കൃഷിയിടങ്ങളും തോട്ടങ്ങളും പൊതുസ്ഥാപനങ്ങളും ഉൾപ്പെടുന്ന മുഴുവൻ റവന്യൂ വില്ലേജിനെയും ESAയിൽ ഉൾപ്പെടുത്തുന്നത് ജനജീവിതത്തെ അനാവശ്യമായി ബാധിക്കാൻ ഇടയാക്കും.

അതുകൊണ്ട് വീടുകൾ, ജനവാസ മേഖലകൾ, കൃഷിയിടങ്ങൾ, തോട്ടങ്ങൾ, പട്ടണങ്ങൾ, സ്കൂളുകൾ, ആശുപത്രികൾ, ആരാധനാലയങ്ങൾ, റോഡുകൾ, പൊതുസ്ഥാപനങ്ങൾ തുടങ്ങിയ നിലവിലുള്ള മനുഷ്യവാസ മേഖലകൾ വ്യക്തമായി ഒഴിവാക്കി ESAയുടെ അതിർത്തി നിർണയിക്കണം.

യഥാർത്ഥ പരിസ്ഥിതി പ്രാധാന്യമുള്ള പ്രദേശങ്ങളെ മാത്രം ശാസ്ത്രീയമായി തിരിച്ചറിഞ്ഞ് ESA പരിധിയിൽ ഉൾപ്പെടുത്തണമെന്ന് ആവശ്യപ്പെടുന്നു.$c5m$,
    'Residential areas and agricultural lands should be excluded from the final ESA boundary',
    'ജനവാസകേന്ദ്രങ്ങൾ, കൃഷിയിടങ്ങൾ, തോട്ടങ്ങൾ, പൊതുസ്ഥാപനങ്ങൾ എന്നിവ ESAയിൽ നിന്ന് ഒഴിവാക്കി അന്തിമ അതിർത്തി നിർണയിക്കണം',
    $c5e$We fully recognise the objective of ecological protection. However, including entire revenue villages containing residential settlements, agricultural holdings, plantations and public institutions in the ESA may unnecessarily affect the lives and livelihoods of residents.

Houses, residential areas, agricultural land, plantations, towns, schools, hospitals, places of worship, roads and public institutions should therefore be clearly excluded from the ESA boundary.

Only areas with demonstrable ecological significance such as forest and protected areas should be scientifically identified and included.$c5e$,
    $c5m$ESAയുടെ ലക്ഷ്യം പരിസ്ഥിതി സംരക്ഷണമാണെന്നത് ഞങ്ങൾ അംഗീകരിക്കുന്നു. എന്നാൽ ജനവാസകേന്ദ്രങ്ങളും കൃഷിയിടങ്ങളും തോട്ടങ്ങളും പൊതുസ്ഥാപനങ്ങളും ഉൾപ്പെടുന്ന മുഴുവൻ റവന്യൂ വില്ലേജിനെയും ESAയിൽ ഉൾപ്പെടുത്തുന്നത് ജനജീവിതത്തെ അനാവശ്യമായി ബാധിക്കാൻ ഇടയാക്കും.

അതുകൊണ്ട് വീടുകൾ, ജനവാസ മേഖലകൾ, കൃഷിയിടങ്ങൾ, തോട്ടങ്ങൾ, പട്ടണങ്ങൾ, സ്കൂളുകൾ, ആശുപത്രികൾ, ആരാധനാലയങ്ങൾ, റോഡുകൾ, പൊതുസ്ഥാപനങ്ങൾ തുടങ്ങിയ നിലവിലുള്ള മനുഷ്യവാസ മേഖലകൾ വ്യക്തമായി ഒഴിവാക്കി ESAയുടെ അതിർത്തി നിർണയിക്കണം.

യഥാർത്ഥ പരിസ്ഥിതി പ്രാധാന്യമുള്ള പ്രദേശങ്ങളെ മാത്രം ശാസ്ത്രീയമായി തിരിച്ചറിഞ്ഞ് ESA പരിധിയിൽ ഉൾപ്പെടുത്തണമെന്ന് ആവശ്യപ്പെടുന്നു.$c5m$
  ),
  (
    v_id, 'WGPPF06', null, 6, true,
    'Verify the 9,107 sq. km forest figure used in the draft notification',
    '9,107 ച.കി.മീ. വനവിസ്തൃതിയുടെ കണക്കുകൾ പുനഃപരിശോധിക്കണം',
    'The 9,107 sq. km figure appears to be the entire Kerala forest area, not the forest in the listed villages alone.',
    '9,107 ച.കി.മീ. എന്നത് 123/131 വില്ലേജുകളുടെ വനമല്ല, സംസ്ഥാനത്തിന്റെ മൊത്തം വനവിസ്തൃതിയാണെന്ന് ആശങ്ക.',
    $c6e$The draft uses a figure of 9,107 square kilometres of forest area in relation to the proposed ESA in Kerala. This figure has appeared in earlier official documents of the Forest Department and represents the entire forest area of the State, not the forest area of the listed villages alone.

The figure should be corrected in the final notification. Any numerical or boundary discrepancy should be corrected before the final notification is issued.$c6e$,
    $c6m$കരട് വിജ്ഞാപനത്തിൽ കേരളത്തിലെ ESA വിസ്തൃതിയുമായി ബന്ധപ്പെട്ട് 9,107 ചതുരശ്ര കിലോമീറ്റർ വനമേഖലയെക്കുറിച്ച് കണക്കുകൾ ഉപയോഗിച്ചിരിക്കുന്നു. ഇത് കേരളത്തിലെ വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖ പ്രകാരം കേരളത്തിലെ മുഴുവൻ ഫോറസ്റ്റ് വിസ്തൃതിയാണ്; കേവലം 123 വില്ലേജുകളുടെ മാത്രം ഫോറസ്റ്റ് വിസ്തൃതി ഇതിനേക്കാൾ വളരെ കുറവാണ്.

വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖകൾ, റവന്യൂ രേഖകൾ, ESA ഗ്രാമങ്ങളുടെ യഥാർത്ഥ ഭൂവിസ്തൃതി എന്നിവ തമ്മിൽ cross-verification നടത്തണം.

കണക്കുപിശകോ പരിധി-കുഴപ്പമോ കണ്ടെത്തി അത് തിരുത്തിയ ശേഷമേ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കാവൂ.$c6m$,
    $c6e$The draft uses a figure of 9,107 square kilometres of forest area in relation to the proposed ESA in Kerala. This figure has appeared in earlier official documents of the Forest Department and represents the entire forest area of the State, not the forest area of the listed villages alone.

The figure should be corrected in the final notification. Any numerical or boundary discrepancy should be corrected before the final notification is issued.$c6e$,
    $c6m$കരട് വിജ്ഞാപനത്തിൽ കേരളത്തിലെ ESA വിസ്തൃതിയുമായി ബന്ധപ്പെട്ട് 9,107 ചതുരശ്ര കിലോമീറ്റർ വനമേഖലയെക്കുറിച്ച് കണക്കുകൾ ഉപയോഗിച്ചിരിക്കുന്നു. ഇത് കേരളത്തിലെ വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖ പ്രകാരം കേരളത്തിലെ മുഴുവൻ ഫോറസ്റ്റ് വിസ്തൃതിയാണ്; കേവലം 123 വില്ലേജുകളുടെ മാത്രം ഫോറസ്റ്റ് വിസ്തൃതി ഇതിനേക്കാൾ വളരെ കുറവാണ്.

വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖകൾ, റവന്യൂ രേഖകൾ, ESA ഗ്രാമങ്ങളുടെ യഥാർത്ഥ ഭൂവിസ്തൃതി എന്നിവ തമ്മിൽ cross-verification നടത്തണം.

കണക്കുപിശകോ പരിധി-കുഴപ്പമോ കണ്ടെത്തി അത് തിരുത്തിയ ശേഷമേ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കാവൂ.$c6m$,
    'The basis and geographical extent of the 9,107 sq. km forest figure should be verified',
    'കരട് വിജ്ഞാപനത്തിൽ ഉപയോഗിച്ചിരിക്കുന്ന 123 വില്ലേജുകളിലെ 9,107 ച.കി.മീ. വനവിസ്തൃതിയുടെ പിശക് ഔദ്യോഗിക രേഖകളുമായി പരിശോധിച്ച് തിരുത്തണം',
    $c6e$The draft uses a figure of 9,107 square kilometres of forest area in relation to the proposed ESA in Kerala. This figure has appeared in earlier official documents of the Forest Department and represents the entire forest area of the State, not the forest area of the listed villages alone.

The figure should be corrected in the final notification. Any numerical or boundary discrepancy should be corrected before the final notification is issued.$c6e$,
    $c6m$കരട് വിജ്ഞാപനത്തിൽ കേരളത്തിലെ ESA വിസ്തൃതിയുമായി ബന്ധപ്പെട്ട് 9,107 ചതുരശ്ര കിലോമീറ്റർ വനമേഖലയെക്കുറിച്ച് കണക്കുകൾ ഉപയോഗിച്ചിരിക്കുന്നു. ഇത് കേരളത്തിലെ വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖ പ്രകാരം കേരളത്തിലെ മുഴുവൻ ഫോറസ്റ്റ് വിസ്തൃതിയാണ്; കേവലം 123 വില്ലേജുകളുടെ മാത്രം ഫോറസ്റ്റ് വിസ്തൃതി ഇതിനേക്കാൾ വളരെ കുറവാണ്.

വനംവകുപ്പിന്റെ ഔദ്യോഗിക രേഖകൾ, റവന്യൂ രേഖകൾ, ESA ഗ്രാമങ്ങളുടെ യഥാർത്ഥ ഭൂവിസ്തൃതി എന്നിവ തമ്മിൽ cross-verification നടത്തണം.

കണക്കുപിശകോ പരിധി-കുഴപ്പമോ കണ്ടെത്തി അത് തിരുത്തിയ ശേഷമേ അന്തിമ വിജ്ഞാപനം പുറപ്പെടുവിക്കാവൂ.$c6m$
  ),
  (
    v_id, 'WGPPF07', null, 7, true,
    'Reconsider the proposed 9,993.7 sq. km ESA extent in Kerala',
    'കേരളത്തിന് നിർദ്ദേശിച്ച ESA വിസ്തൃതി പുനഃപരിശോധിക്കണം',
    '9,993.7 sq. km is about 26% of Kerala. Demarcation should focus on actual forests and protected areas.',
    '9,993.7 ച.കി.മീ. ESA വിസ്തൃതി കേരളത്തിന്റെ ജനസാന്ദ്രതയും ഭൂവിനിയോഗവും കണക്കിലെടുത്ത് പുനഃപരിശോധിക്കണം.',
    $c7e$The draft notification dated 27 July 2026 proposes an ESA extent of 9,993.7 square kilometres in Kerala. This area must be assessed in the context of Kerala's limited geographical area, high population density and existing forests and protected areas.

The necessity and extent of ESA in Kerala should be reconsidered using Kerala-specific demographic and land-use conditions.

We request scientific demarcation focused on actual forests and protected areas rather than blanket inclusion of revenue villages.$c7e$,
    $c7m$2026 ജൂലൈ 27-ലെ കരട് വിജ്ഞാപനത്തിൽ കേരളത്തിലെ ESA വിസ്തൃതി 9,993.7 ചതുരശ്ര കിലോമീറ്ററായി നിർദ്ദേശിച്ചിരിക്കുന്നു. ഇത് കേരളത്തിന്റെ മൊത്തം വിസ്തൃതിയുടെ 26% ആണ്. ഈ വിസ്തൃതി കേരളത്തിന്റെ ചെറിയ ഭൂവിസ്തൃതിയോടും ഉയർന്ന ജനസാന്ദ്രതയോടും നിലവിലുള്ള വന-സംരക്ഷിത പ്രദേശങ്ങളോടും ചേർത്ത് വിലയിരുത്തേണ്ടതാണ്.

കേരളത്തിന്റെ പ്രത്യേക ജനസംഖ്യാ-ഭൂവിനിയോഗ സാഹചര്യം അടിസ്ഥാനമാക്കി ESAയുടെ യഥാർത്ഥ ആവശ്യം ഫോറസ്റ്റിലും സംരക്ഷിത മേഖലകളിലും മാത്രമായി നിജപ്പെടുത്തണം.

റവന്യൂ വില്ലേജുകളെ blanket ആയി ESAയിൽ ഉൾപ്പെടുത്താതെ യഥാർത്ഥ വനങ്ങളും സംരക്ഷിത പ്രദേശങ്ങളും കേന്ദ്രീകരിച്ചുള്ള ശാസ്ത്രീയ demarcation നടത്തണമെന്ന് ആവശ്യപ്പെടുന്നു.$c7m$,
    $c7e$The draft notification dated 27 July 2026 proposes an ESA extent of 9,993.7 square kilometres in Kerala. This area must be assessed in the context of Kerala's limited geographical area, high population density and existing forests and protected areas.

The necessity and extent of ESA in Kerala should be reconsidered using Kerala-specific demographic and land-use conditions.

We request scientific demarcation focused on actual forests and protected areas rather than blanket inclusion of revenue villages.$c7e$,
    $c7m$2026 ജൂലൈ 27-ലെ കരട് വിജ്ഞാപനത്തിൽ കേരളത്തിലെ ESA വിസ്തൃതി 9,993.7 ചതുരശ്ര കിലോമീറ്ററായി നിർദ്ദേശിച്ചിരിക്കുന്നു. ഇത് കേരളത്തിന്റെ മൊത്തം വിസ്തൃതിയുടെ 26% ആണ്. ഈ വിസ്തൃതി കേരളത്തിന്റെ ചെറിയ ഭൂവിസ്തൃതിയോടും ഉയർന്ന ജനസാന്ദ്രതയോടും നിലവിലുള്ള വന-സംരക്ഷിത പ്രദേശങ്ങളോടും ചേർത്ത് വിലയിരുത്തേണ്ടതാണ്.

കേരളത്തിന്റെ പ്രത്യേക ജനസംഖ്യാ-ഭൂവിനിയോഗ സാഹചര്യം അടിസ്ഥാനമാക്കി ESAയുടെ യഥാർത്ഥ ആവശ്യം ഫോറസ്റ്റിലും സംരക്ഷിത മേഖലകളിലും മാത്രമായി നിജപ്പെടുത്തണം.

റവന്യൂ വില്ലേജുകളെ blanket ആയി ESAയിൽ ഉൾപ്പെടുത്താതെ യഥാർത്ഥ വനങ്ങളും സംരക്ഷിത പ്രദേശങ്ങളും കേന്ദ്രീകരിച്ചുള്ള ശാസ്ത്രീയ demarcation നടത്തണമെന്ന് ആവശ്യപ്പെടുന്നു.$c7m$,
    'The proposed 9,993.7 sq. km ESA extent in Kerala should be reconsidered',
    'കേരളത്തിന് നിർദ്ദേശിച്ചിരിക്കുന്ന 9,993.7 ച.കി.മീ. ESA വിസ്തൃതി ജനസാന്ദ്രതയും ഭൂവിനിയോഗവും കണക്കിലെടുത്ത് പുനഃപരിശോധിക്കണം',
    $c7e$The draft notification dated 27 July 2026 proposes an ESA extent of 9,993.7 square kilometres in Kerala. This area must be assessed in the context of Kerala's limited geographical area, high population density and existing forests and protected areas.

The necessity and extent of ESA in Kerala should be reconsidered using Kerala-specific demographic and land-use conditions.

We request scientific demarcation focused on actual forests and protected areas rather than blanket inclusion of revenue villages.$c7e$,
    $c7m$2026 ജൂലൈ 27-ലെ കരട് വിജ്ഞാപനത്തിൽ കേരളത്തിലെ ESA വിസ്തൃതി 9,993.7 ചതുരശ്ര കിലോമീറ്ററായി നിർദ്ദേശിച്ചിരിക്കുന്നു. ഇത് കേരളത്തിന്റെ മൊത്തം വിസ്തൃതിയുടെ 26% ആണ്. ഈ വിസ്തൃതി കേരളത്തിന്റെ ചെറിയ ഭൂവിസ്തൃതിയോടും ഉയർന്ന ജനസാന്ദ്രതയോടും നിലവിലുള്ള വന-സംരക്ഷിത പ്രദേശങ്ങളോടും ചേർത്ത് വിലയിരുത്തേണ്ടതാണ്.

കേരളത്തിന്റെ പ്രത്യേക ജനസംഖ്യാ-ഭൂവിനിയോഗ സാഹചര്യം അടിസ്ഥാനമാക്കി ESAയുടെ യഥാർത്ഥ ആവശ്യം ഫോറസ്റ്റിലും സംരക്ഷിത മേഖലകളിലും മാത്രമായി നിജപ്പെടുത്തണം.

റവന്യൂ വില്ലേജുകളെ blanket ആയി ESAയിൽ ഉൾപ്പെടുത്താതെ യഥാർത്ഥ വനങ്ങളും സംരക്ഷിത പ്രദേശങ്ങളും കേന്ദ്രീകരിച്ചുള്ള ശാസ്ത്രീയ demarcation നടത്തണമെന്ന് ആവശ്യപ്പെടുന്നു.$c7m$
  ),
  (
    v_id, 'WGPPF08', null, 8, true,
    'Kerala''s increased population density must be considered in ESA demarcation',
    'ജനസാന്ദ്രത പ്രത്യേകമായി പരിഗണിക്കണം',
    'Population density and land-use intensity have increased; old ESA thresholds should not blanket-include inhabited areas.',
    'പഴയ ESA മാനദണ്ഡങ്ങൾ ഇന്നത്തെ കേരളത്തിന്റെ ജനസാന്ദ്രതയെ പ്രതിഫലിപ്പിക്കുന്നില്ല.',
    $c8e$If it is argued that Kerala's forest extent has increased over the past decades, the equally important fact that population density and intensity of land use have also increased must be considered.

Population-density thresholds used in earlier ESA exercises may not adequately reflect present-day Kerala. Therefore, inclusion of densely inhabited areas based only on older criteria should be reconsidered.

A fresh scientific assessment should use current population data, built-up areas, agricultural land use and public infrastructure.

We request that highly populated areas be excluded from blanket ESA inclusion.$c8e$,
    $c8m$കേരളത്തിലെ വനവിസ്തൃതി വർധിച്ചിട്ടുണ്ടെന്ന വാദം ഉന്നയിക്കപ്പെടുന്നുണ്ടെങ്കിൽ, അതോടൊപ്പം കഴിഞ്ഞ പതിറ്റാണ്ടുകളിൽ ജനസാന്ദ്രതയും ഭൂവിനിയോഗ തീവ്രതയും വർധിച്ചിട്ടുണ്ടെന്ന യാഥാർഥ്യവും പരിഗണിക്കണം.

പഴയ ESA മാനദണ്ഡങ്ങളിൽ ഉപയോഗിച്ച ജനസാന്ദ്രതാ പരിധികൾ ഇന്നത്തെ കേരളത്തിന്റെ യാഥാർഥ്യവുമായി താരതമ്യം ചെയ്യുമ്പോൾ പല പ്രദേശങ്ങളിലും വളരെ താഴ്ന്നതാണ്. അതിനാൽ പഴയ കണക്കുകൾ മാത്രം ഉപയോഗിച്ച് ഇന്നത്തെ ജനവാസ മേഖലകളെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് പുനഃപരിശോധിക്കണം.

ഇന്നത്തെ ജനസംഖ്യാ കണക്കുകൾ, built-up areas, agricultural land use, public infrastructure എന്നിവ ഉൾപ്പെടുത്തി പുതുക്കിയ scientific assessment നടത്തണം.

ജനസാന്ദ്രത വളരെ ഉയർന്ന വില്ലേജുകളെ ESAയുടെ blanket inclusion-ൽ നിന്ന് ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുന്നു.$c8m$,
    $c8e$If it is argued that Kerala's forest extent has increased over the past decades, the equally important fact that population density and intensity of land use have also increased must be considered.

Population-density thresholds used in earlier ESA exercises may not adequately reflect present-day Kerala. Therefore, inclusion of densely inhabited areas based only on older criteria should be reconsidered.

A fresh scientific assessment should use current population data, built-up areas, agricultural land use and public infrastructure.

We request that highly populated areas be excluded from blanket ESA inclusion.$c8e$,
    $c8m$കേരളത്തിലെ വനവിസ്തൃതി വർധിച്ചിട്ടുണ്ടെന്ന വാദം ഉന്നയിക്കപ്പെടുന്നുണ്ടെങ്കിൽ, അതോടൊപ്പം കഴിഞ്ഞ പതിറ്റാണ്ടുകളിൽ ജനസാന്ദ്രതയും ഭൂവിനിയോഗ തീവ്രതയും വർധിച്ചിട്ടുണ്ടെന്ന യാഥാർഥ്യവും പരിഗണിക്കണം.

പഴയ ESA മാനദണ്ഡങ്ങളിൽ ഉപയോഗിച്ച ജനസാന്ദ്രതാ പരിധികൾ ഇന്നത്തെ കേരളത്തിന്റെ യാഥാർഥ്യവുമായി താരതമ്യം ചെയ്യുമ്പോൾ പല പ്രദേശങ്ങളിലും വളരെ താഴ്ന്നതാണ്. അതിനാൽ പഴയ കണക്കുകൾ മാത്രം ഉപയോഗിച്ച് ഇന്നത്തെ ജനവാസ മേഖലകളെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് പുനഃപരിശോധിക്കണം.

ഇന്നത്തെ ജനസംഖ്യാ കണക്കുകൾ, built-up areas, agricultural land use, public infrastructure എന്നിവ ഉൾപ്പെടുത്തി പുതുക്കിയ scientific assessment നടത്തണം.

ജനസാന്ദ്രത വളരെ ഉയർന്ന വില്ലേജുകളെ ESAയുടെ blanket inclusion-ൽ നിന്ന് ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുന്നു.$c8m$,
    'Kerala''s increased population density must be specifically considered in ESA demarcation',
    'കേരളത്തിലെ വർധിച്ച ജനസാന്ദ്രത ESA demarcation-ന്റെ പ്രധാന മാനദണ്ഡമായി പരിഗണിക്കണം',
    $c8e$If it is argued that Kerala's forest extent has increased over the past decades, the equally important fact that population density and intensity of land use have also increased must be considered.

Population-density thresholds used in earlier ESA exercises may not adequately reflect present-day Kerala. Therefore, inclusion of densely inhabited areas based only on older criteria should be reconsidered.

A fresh scientific assessment should use current population data, built-up areas, agricultural land use and public infrastructure.

We request that highly populated areas be excluded from blanket ESA inclusion.$c8e$,
    $c8m$കേരളത്തിലെ വനവിസ്തൃതി വർധിച്ചിട്ടുണ്ടെന്ന വാദം ഉന്നയിക്കപ്പെടുന്നുണ്ടെങ്കിൽ, അതോടൊപ്പം കഴിഞ്ഞ പതിറ്റാണ്ടുകളിൽ ജനസാന്ദ്രതയും ഭൂവിനിയോഗ തീവ്രതയും വർധിച്ചിട്ടുണ്ടെന്ന യാഥാർഥ്യവും പരിഗണിക്കണം.

പഴയ ESA മാനദണ്ഡങ്ങളിൽ ഉപയോഗിച്ച ജനസാന്ദ്രതാ പരിധികൾ ഇന്നത്തെ കേരളത്തിന്റെ യാഥാർഥ്യവുമായി താരതമ്യം ചെയ്യുമ്പോൾ പല പ്രദേശങ്ങളിലും വളരെ താഴ്ന്നതാണ്. അതിനാൽ പഴയ കണക്കുകൾ മാത്രം ഉപയോഗിച്ച് ഇന്നത്തെ ജനവാസ മേഖലകളെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് പുനഃപരിശോധിക്കണം.

ഇന്നത്തെ ജനസംഖ്യാ കണക്കുകൾ, built-up areas, agricultural land use, public infrastructure എന്നിവ ഉൾപ്പെടുത്തി പുതുക്കിയ scientific assessment നടത്തണം.

ജനസാന്ദ്രത വളരെ ഉയർന്ന വില്ലേജുകളെ ESAയുടെ blanket inclusion-ൽ നിന്ന് ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുന്നു.$c8m$
  ),
  (
    v_id, 'WGPPF09', null, 9, true,
    'Gram Sabha strongly objects to inclusion of a ward with no forest or protected area',
    'വനമില്ലാത്ത വാർഡിനെ ഗ്രാമസഭ എതിർക്കുന്നു',
    'Collective Gram Sabha objection to including a ward that has no forest or protected area.',
    'വനമോ സംരക്ഷിത പ്രദേശമോ ഇല്ലാത്ത വാർഡിനെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് ഗ്രാമസഭ എതിർക്കുന്നു.',
    $c9e$The Gram Sabha records that Ward No. ______ of __________________ Revenue Village in our Panchayat contains no forest or protected area.

Inclusion of such a ward in the ESA is inconsistent with its actual ecological and land-use characteristics.

The Gram Sabha therefore strongly objects to the inclusion and requests that the ward and revenue village as a whole be excluded from the final ESA notification.

We request that this Gram Sabha resolution be formally considered while taking the final decision.$c9e$,
    $c9m$ഞങ്ങളുടെ പഞ്ചായത്തിലെ __________________ റവന്യൂ വില്ലേജിലെ ______-ാം വാർഡിൽ വനഭൂമിയോ സംരക്ഷിത പ്രദേശമോ ഇല്ലെന്ന് ഗ്രാമസഭ രേഖപ്പെടുത്തുന്നു.

അത്തരം വാർഡിനെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് യഥാർത്ഥ പരിസ്ഥിതി-ഭൂവിനിയോഗ സ്വഭാവവുമായി പൊരുത്തപ്പെടുന്നില്ല.

ഗ്രാമസഭ ഈ ഉൾപ്പെടുത്തൽ ശക്തമായി എതിർക്കുകയും വാർഡിനെയും റവന്യൂ വില്ലേജിനെയും അന്തിമ ESA വിജ്ഞാപനത്തിൽ നിന്ന് ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുകയും ചെയ്യുന്നു.

അന്തിമ തീരുമാനം എടുക്കുമ്പോൾ ഈ ഗ്രാമസഭ തീരുമാനം ഔദ്യോഗികമായി പരിഗണിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.$c9m$,
    $c9e$The Gram Sabha records that Ward No. ______ of __________________ Revenue Village in our Panchayat contains no forest or protected area.

Inclusion of such a ward in the ESA is inconsistent with its actual ecological and land-use characteristics.

The Gram Sabha therefore strongly objects to the inclusion and requests that the ward and revenue village as a whole be excluded from the final ESA notification.

We request that this Gram Sabha resolution be formally considered while taking the final decision.$c9e$,
    $c9m$ഞങ്ങളുടെ പഞ്ചായത്തിലെ __________________ റവന്യൂ വില്ലേജിലെ ______-ാം വാർഡിൽ വനഭൂമിയോ സംരക്ഷിത പ്രദേശമോ ഇല്ലെന്ന് ഗ്രാമസഭ രേഖപ്പെടുത്തുന്നു.

അത്തരം വാർഡിനെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് യഥാർത്ഥ പരിസ്ഥിതി-ഭൂവിനിയോഗ സ്വഭാവവുമായി പൊരുത്തപ്പെടുന്നില്ല.

ഗ്രാമസഭ ഈ ഉൾപ്പെടുത്തൽ ശക്തമായി എതിർക്കുകയും വാർഡിനെയും റവന്യൂ വില്ലേജിനെയും അന്തിമ ESA വിജ്ഞാപനത്തിൽ നിന്ന് ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുകയും ചെയ്യുന്നു.

അന്തിമ തീരുമാനം എടുക്കുമ്പോൾ ഈ ഗ്രാമസഭ തീരുമാനം ഔദ്യോഗികമായി പരിഗണിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.$c9m$,
    'Gram Sabha strongly objects to inclusion of a ward having no forest or protected area',
    'വനമില്ലാത്ത വാർഡിനെ ഗ്രാമസഭ എതിർക്കുന്നു',
    $c9e$The Gram Sabha records that Ward No. ______ of __________________ Revenue Village in our Panchayat contains no forest or protected area.

Inclusion of such a ward in the ESA is inconsistent with its actual ecological and land-use characteristics.

The Gram Sabha therefore strongly objects to the inclusion and requests that the ward and revenue village as a whole be excluded from the final ESA notification.

We request that this Gram Sabha resolution be formally considered while taking the final decision.$c9e$,
    $c9m$ഞങ്ങളുടെ പഞ്ചായത്തിലെ __________________ റവന്യൂ വില്ലേജിലെ ______-ാം വാർഡിൽ വനഭൂമിയോ സംരക്ഷിത പ്രദേശമോ ഇല്ലെന്ന് ഗ്രാമസഭ രേഖപ്പെടുത്തുന്നു.

അത്തരം വാർഡിനെ ESAയിൽ ഉൾപ്പെടുത്തുന്നത് യഥാർത്ഥ പരിസ്ഥിതി-ഭൂവിനിയോഗ സ്വഭാവവുമായി പൊരുത്തപ്പെടുന്നില്ല.

ഗ്രാമസഭ ഈ ഉൾപ്പെടുത്തൽ ശക്തമായി എതിർക്കുകയും വാർഡിനെയും റവന്യൂ വില്ലേജിനെയും അന്തിമ ESA വിജ്ഞാപനത്തിൽ നിന്ന് ഒഴിവാക്കണമെന്ന് ആവശ്യപ്പെടുകയും ചെയ്യുന്നു.

അന്തിമ തീരുമാനം എടുക്കുമ്പോൾ ഈ ഗ്രാമസഭ തീരുമാനം ഔദ്യോഗികമായി പരിഗണിക്കണമെന്ന് അഭ്യർത്ഥിക്കുന്നു.$c9m$
  ),
  (
    v_id, 'WGPPF10', null, 10, true,
    'Where forest land is very limited, only the actual forest land should be included',
    'വനഭൂമി വളരെ കുറവുള്ള വാർഡിൽ — യഥാർത്ഥ വനഭൂമി മാത്രം ഉൾപ്പെടുത്തണം',
    'Identify exact Survey Number boundaries of forest land; exclude residential and agricultural areas.',
    'വനഭൂമി കുറവുള്ള വാർഡിൽ മുഴുവൻ വാർഡും ESAയാക്കരുത്; cadastral അതിർത്തി പ്രകാരം വനഭൂമി മാത്രം.',
    $c10e$Forest land in Ward No. ______ of __________________ Revenue Village is very limited.

Including the entire ward in the ESA does not reflect the actual land-use pattern.

The exact Survey Number/Cadastral boundaries of forest land should be identified, and only the officially verified forest land should be included. Residential and agricultural areas should be fully excluded.$c10e$,
    $c10m$__________________ റവന്യൂ വില്ലേജിലെ ______-ാം വാർഡിലെ വനഭൂമി വളരെ കുറവാണ്.

മുഴുവൻ വാർഡിനെയും ESAയിൽ ഉൾപ്പെടുത്തുന്നത് യഥാർത്ഥ ഭൂവിനിയോഗ രീതിയെ പ്രതിഫലിപ്പിക്കുന്നില്ല.

Survey Number/Cadastral അതിർത്തി പ്രകാരം വനഭൂമി കൃത്യമായി നിർണയിച്ച് ഔദ്യോഗികമായി സ്ഥിരീകരിച്ച വനഭൂമി മാത്രം ഉൾപ്പെടുത്തണം. ജനവാസ-കൃഷി മേഖലകൾ പൂർണ്ണമായും ഒഴിവാക്കണം.$c10m$,
    $c10e$Forest land in Ward No. ______ of __________________ Revenue Village is very limited.

Including the entire ward in the ESA does not reflect the actual land-use pattern.

The exact Survey Number/Cadastral boundaries of forest land should be identified, and only the officially verified forest land should be included. Residential and agricultural areas should be fully excluded.$c10e$,
    $c10m$__________________ റവന്യൂ വില്ലേജിലെ ______-ാം വാർഡിലെ വനഭൂമി വളരെ കുറവാണ്.

മുഴുവൻ വാർഡിനെയും ESAയിൽ ഉൾപ്പെടുത്തുന്നത് യഥാർത്ഥ ഭൂവിനിയോഗ രീതിയെ പ്രതിഫലിപ്പിക്കുന്നില്ല.

Survey Number/Cadastral അതിർത്തി പ്രകാരം വനഭൂമി കൃത്യമായി നിർണയിച്ച് ഔദ്യോഗികമായി സ്ഥിരീകരിച്ച വനഭൂമി മാത്രം ഉൾപ്പെടുത്തണം. ജനവാസ-കൃഷി മേഖലകൾ പൂർണ്ണമായും ഒഴിവാക്കണം.$c10m$,
    'Where forest land is very limited, only the actual forest land should be included',
    'വനഭൂമി വളരെ കുറവുള്ള വാർഡിൽ — യഥാർത്ഥ വനഭൂമി മാത്രം ഉൾപ്പെടുത്തണം',
    $c10e$Forest land in Ward No. ______ of __________________ Revenue Village is very limited.

Including the entire ward in the ESA does not reflect the actual land-use pattern.

The exact Survey Number/Cadastral boundaries of forest land should be identified, and only the officially verified forest land should be included. Residential and agricultural areas should be fully excluded.$c10e$,
    $c10m$__________________ റവന്യൂ വില്ലേജിലെ ______-ാം വാർഡിലെ വനഭൂമി വളരെ കുറവാണ്.

മുഴുവൻ വാർഡിനെയും ESAയിൽ ഉൾപ്പെടുത്തുന്നത് യഥാർത്ഥ ഭൂവിനിയോഗ രീതിയെ പ്രതിഫലിപ്പിക്കുന്നില്ല.

Survey Number/Cadastral അതിർത്തി പ്രകാരം വനഭൂമി കൃത്യമായി നിർണയിച്ച് ഔദ്യോഗികമായി സ്ഥിരീകരിച്ച വനഭൂമി മാത്രം ഉൾപ്പെടുത്തണം. ജനവാസ-കൃഷി മേഖലകൾ പൂർണ്ണമായും ഒഴിവാക്കണം.$c10m$
  )
  on conflict (campaign_id, code) do update set
    section_ref = excluded.section_ref,
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
