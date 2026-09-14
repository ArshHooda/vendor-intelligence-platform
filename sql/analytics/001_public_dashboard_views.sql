-- Browser-safe reporting views for the static dashboard.
-- Keep staging, core, quality, and analytics out of Data API exposed schemas.

create or replace view public.dashboard_summary as
select
  total_bills,
  vendors_with_bills,
  total_spend,
  average_bill_amount,
  largest_bill_amount,
  payment_hold_bill_count,
  payment_hold_spend
from analytics.dashboard_summary;

create or replace view public.vendor_risk_summary as
select
  vendor_source_id,
  vendor_name,
  vendor_status,
  vendor_approval_status,
  vendor_country,
  bill_count,
  total_spend,
  spend_share_percent,
  payment_hold_count,
  payment_hold_amount,
  vendor_record_count,
  risk_label
from analytics.vendor_risk_summary;

create or replace view public.top_vendor_concentration as
select
  vendor_source_id,
  vendor_name,
  vendor_status,
  vendor_approval_status,
  vendor_country,
  bill_count,
  total_spend,
  round(spend_share * 100, 2) as spend_share_percent
from analytics.top_vendor_concentration
limit 50;

create or replace view public.payment_hold_summary as
select
  payment_hold_reason,
  bill_count,
  total_amount,
  earliest_bill_date,
  latest_bill_date
from analytics.payment_hold_summary;

grant select on
  public.dashboard_summary,
  public.vendor_risk_summary,
  public.top_vendor_concentration,
  public.payment_hold_summary
to anon, authenticated;
