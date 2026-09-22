const DASHBOARD_DATA_URL = "./data/vendor_activity.json";

const ALLOWED_PURCHASE_FIELDS = new Set([
  "purchase_id",
  "purchase_date",
  "status",
  "currency",
  "currency_code",
  "original_amount",
  "base_amount_usd",
  "payment_hold",
  "payment_hold_reason",
]);

const ALLOWED_VENDOR_FIELDS = new Set([
  "vendor_source_id", "vendor_name", "vendor_status", "vendor_approval_status",
  "vendor_country", "master_last_paid_date", "bill_count", "total_spend",
  "average_bill_amount", "largest_bill_amount", "first_purchase_date",
  "last_purchase_date", "days_since_last_purchase", "purchase_frequency_per_month",
  "average_gap_days", "payment_status", "payment_statuses", "open_spend",
  "payment_hold_count", "payment_hold_amount", "vendor_record_count",
  "spend_share_percent", "risk_label", "purchases",
]);

function validatePurchase(purchase) {
  if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) {
    throw new Error("Purchase data contains an invalid record");
  }
  const unknownFields = Object.keys(purchase).filter(
    (field) => !ALLOWED_PURCHASE_FIELDS.has(field),
  );
  if (unknownFields.length) {
    throw new Error(`Purchase data contains fields that are not approved for publishing: ${unknownFields.join(", ")}`);
  }
  if (!/^PUR-[A-F0-9]{12}$/.test(String(purchase.purchase_id || ""))) {
    throw new Error("Purchase data contains a non-pseudonymous reference");
  }
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.vendors) || !payload.vendors.length) {
    throw new Error("Activity snapshot contains no vendors");
  }
  payload.vendors.forEach((vendor) => {
    const vendorFields = Object.keys(vendor);
    const hasExactVendorFields = vendorFields.length === ALLOWED_VENDOR_FIELDS.size
      && vendorFields.every((field) => ALLOWED_VENDOR_FIELDS.has(field));
    if (
      !hasExactVendorFields
      || !vendor.vendor_source_id
      || !vendor.vendor_name
      || !Array.isArray(vendor.purchases)
    ) {
      throw new Error("Activity snapshot contains an invalid vendor record");
    }
    vendor.purchases.forEach(validatePurchase);
  });
  return payload;
}

export async function fetchDashboardData() {
  const response = await fetch(DASHBOARD_DATA_URL, {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) {
    throw new Error(`Activity snapshot failed (${response.status})`);
  }
  return validatePayload(await response.json());
}
