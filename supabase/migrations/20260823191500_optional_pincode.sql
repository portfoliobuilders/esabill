-- PIN code no longer blocks sending. Keep the field, but do not require it.
update public.campaign_form_fields
set is_required = false
where field_key = 'pincode'
  and is_required = true;
