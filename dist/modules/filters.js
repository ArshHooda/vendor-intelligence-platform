import { normalized, number, replaceOptions, text, uniqueOptions } from "./utils.js";

function values(elements) {
  return {
    vendor: elements.vendorFilter.value,
    paymentStatus: elements.paymentStatusFilter.value,
    lastPurchase: elements.lastPurchaseFilter.value,
    frequency: elements.frequencyFilter.value,
    gap: elements.gapFilter.value,
    country: elements.countryFilter.value,
    vendorStatus: elements.vendorStatusFilter.value,
    approval: elements.approvalFilter.value,
    risk: elements.riskFilter.value,
  };
}

function matchesLastPurchase(vendor, selection) {
  if (selection === "all") return true;
  if (selection === "none") return !vendor.last_purchase_date;
  if (!vendor.last_purchase_date) return false;
  const days = number(vendor.days_since_last_purchase);
  return selection === "older" ? days > 365 : days <= number(selection);
}

function matchesFrequency(vendor, selection) {
  if (selection === "all") return true;
  const frequency = number(vendor.purchase_frequency_per_month);
  if (selection === "high") return frequency >= 4;
  if (selection === "regular") return frequency >= 1 && frequency < 4;
  if (selection === "occasional") return frequency > 0 && frequency < 1;
  return number(vendor.bill_count) === 0;
}

function matchesGap(vendor, selection) {
  if (selection === "all") return true;
  const missing = vendor.average_gap_days === null || vendor.average_gap_days === undefined;
  if (selection === "none") return missing;
  if (missing) return false;
  const gap = number(vendor.average_gap_days);
  if (selection === "short") return gap <= 30;
  if (selection === "medium") return gap > 30 && gap <= 90;
  return gap > 90;
}

export function populateFilters(vendors, elements) {
  const vendorOptions = [...vendors]
    .sort((left, right) => normalized(left.vendor_name).localeCompare(normalized(right.vendor_name)))
    .map((vendor) => ({
      value: text(vendor.vendor_source_id),
      label: `${text(vendor.vendor_name, "Unknown vendor")} · ${text(vendor.vendor_source_id)}`,
    }));
  replaceOptions(elements.vendorFilter, "All vendors", vendorOptions);
  replaceOptions(
    elements.paymentStatusFilter,
    "All payment statuses",
    uniqueOptions(vendors.flatMap((vendor) => vendor.payment_statuses || [])),
  );
  replaceOptions(elements.countryFilter, "All countries", uniqueOptions(vendors.map((vendor) => vendor.vendor_country)));
  replaceOptions(elements.vendorStatusFilter, "All vendor statuses", uniqueOptions(vendors.map((vendor) => vendor.vendor_status)));
  replaceOptions(elements.approvalFilter, "All approval statuses", uniqueOptions(vendors.map((vendor) => vendor.vendor_approval_status)));
  replaceOptions(elements.riskFilter, "All risk types", uniqueOptions(vendors.map((vendor) => vendor.risk_label)));
}

export function selectedVendors(vendors, elements) {
  const selected = values(elements);
  return vendors.filter((vendor) => {
    if (selected.vendor !== "all" && text(vendor.vendor_source_id) !== selected.vendor) return false;
    if (
      selected.paymentStatus !== "all" &&
      !(vendor.payment_statuses || []).includes(selected.paymentStatus)
    ) return false;
    if (!matchesLastPurchase(vendor, selected.lastPurchase)) return false;
    if (!matchesFrequency(vendor, selected.frequency)) return false;
    if (!matchesGap(vendor, selected.gap)) return false;
    if (selected.country !== "all" && normalized(vendor.vendor_country) !== selected.country) return false;
    if (selected.vendorStatus !== "all" && normalized(vendor.vendor_status) !== selected.vendorStatus) return false;
    if (selected.approval !== "all" && normalized(vendor.vendor_approval_status) !== selected.approval) return false;
    return selected.risk === "all" || normalized(vendor.risk_label) === selected.risk;
  });
}

export function hasActiveFilters(elements) {
  return Object.values(values(elements)).some((value) => value !== "all");
}

export function resetFilters(elements) {
  [
    elements.vendorFilter,
    elements.paymentStatusFilter,
    elements.lastPurchaseFilter,
    elements.frequencyFilter,
    elements.gapFilter,
    elements.countryFilter,
    elements.vendorStatusFilter,
    elements.approvalFilter,
    elements.riskFilter,
  ].forEach((select) => {
    select.value = "all";
  });
}
