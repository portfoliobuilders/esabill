-- Print fetched PIN location on letters whose templates only signed off with the name.
update public.campaigns
set body_template_en = trim(trailing from body_template_en) || E'\n\n{{location_block}}'
where coalesce(body_template_en, '') !~* '\{\{\s*(identity_block|location_block|pincode|post_office)\s*\}\}';

update public.campaigns
set body_template_ml = trim(trailing from body_template_ml) || E'\n\n{{location_block}}'
where coalesce(body_template_ml, '') !~* '\{\{\s*(identity_block|location_block|pincode|post_office)\s*\}\}';
