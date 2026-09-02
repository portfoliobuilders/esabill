-- Live campaign is western-ghats-people-protection-forum (not esa-draft-notification).
-- Fill CC / BCC so Gmail compose includes Kerala forest and environment offices.

do $$
declare
  v_id uuid;
begin
  select id into v_id from public.campaigns where slug = 'western-ghats-people-protection-forum';
  if v_id is null then
    raise exception 'Campaign western-ghats-people-protection-forum is missing';
  end if;

  update public.campaigns
  set
    recipient_email = 'esz-mef@nic.in',
    recipient_emails = array['esz-mef@nic.in']::text[],
    cc_emails = array[
      'min.for@kerala.gov.in',
      'prlsecy.forest@kerala.gov.in',
      'pccf.for@kerala.gov.in',
      'cww.for@kerala.gov.in',
      'pccf-d.for@kerala.gov.in',
      'pccf-flr.for@kerala.gov.in',
      'environmentdirectorate@gmail.com',
      'envt.dir@kerala.gov.in'
    ]::text[],
    bcc_emails = array['esacomplaints2026@gmail.com']::text[],
    updated_at = now()
  where id = v_id;

  delete from public.campaign_recipients where campaign_id = v_id;
  insert into public.campaign_recipients (campaign_id, recipient_type, email, display_order) values
    (v_id, 'to',  'esz-mef@nic.in', 1),
    (v_id, 'cc',  'min.for@kerala.gov.in', 1),
    (v_id, 'cc',  'prlsecy.forest@kerala.gov.in', 2),
    (v_id, 'cc',  'pccf.for@kerala.gov.in', 3),
    (v_id, 'cc',  'cww.for@kerala.gov.in', 4),
    (v_id, 'cc',  'pccf-d.for@kerala.gov.in', 5),
    (v_id, 'cc',  'pccf-flr.for@kerala.gov.in', 6),
    (v_id, 'cc',  'environmentdirectorate@gmail.com', 7),
    (v_id, 'cc',  'envt.dir@kerala.gov.in', 8),
    (v_id, 'bcc', 'esacomplaints2026@gmail.com', 1);
end $$;
