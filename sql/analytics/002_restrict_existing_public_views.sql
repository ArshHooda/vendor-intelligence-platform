-- Apply once to an existing project that previously exposed dashboard views.
-- The GitHub Pages build reads private Storage server-side and no longer needs
-- browser access to these views.

revoke all on
  public.dashboard_summary,
  public.vendor_risk_summary,
  public.top_vendor_concentration,
  public.payment_hold_summary
from anon, authenticated;
