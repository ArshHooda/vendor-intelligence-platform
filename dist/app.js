const DASHBOARD_DATA_URL = "./data/vendor_activity.json";
const SUPABASE_URL = "https://reejwrpxnckikgfefxtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YiJBi0gdgRpu9-Xhr_0pxg_hQRs9rha";

const state = { metadata: {}, vendors: [], filtered: [], page: 1, pageSize: 50, sortBy: "total_spend", sortDirection: "desc", filtersReady: false };
const $ = (selector) => document.querySelector(selector);
const elements = Object.fromEntries([
  "refreshButton", "statusDot", "statusText", "asOfDate", "errorBanner", "errorMessage",
  "vendorFilter", "paymentStatusFilter", "lastPurchaseFilter", "frequencyFilter", "gapFilter",
  "countryFilter", "vendorStatusFilter", "approvalFilter", "riskFilter", "resetFilters",
  "filteredVendorCount", "filterResultText", "totalSpend", "portfolioShare", "totalBills",
  "vendorsWithPurchases", "averageBill", "largestBill", "openSpend", "openSpendShare",
  "averageFrequency", "medianGap", "paymentHolds", "paymentHoldSpend", "noPurchaseVendors",
  "topSpendersCount", "spenderList", "largestVendorShare", "largestVendorName", "topThreeShare",
  "dormantVendors", "flaggedVendors", "sortBy", "sortDirection", "pageSize", "vendorTableBody",
  "pageSummary", "previousPage", "nextPage", "sourceNote",
].map((id) => [id, $(`#${id}`)]));

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const wholeNumber = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function text(value, fallback = "—") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function normalized(value) { return text(value, "Not specified").trim(); }
function formatDate(value) {
  if (!value) return "No purchases";
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? text(value) : dateFormatter.format(parsed);
}
function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function replaceOptions(select, placeholder, options) {
  const previous = select.value;
  select.replaceChildren(new Option(placeholder, "all"));
  options.forEach(({ value, label }) => select.add(new Option(label, value)));
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}
function uniqueOptions(values) {
  return [...new Set(values.map(normalized))].filter(Boolean).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
}

function adaptSupabaseRows(rows) {
  return rows.map((row) => ({
    ...row,
    bill_count: number(row.bill_count), total_spend: number(row.total_spend),
    average_bill_amount: number(row.bill_count) ? number(row.total_spend) / number(row.bill_count) : null,
    largest_bill_amount: null, first_purchase_date: null, last_purchase_date: null,
    days_since_last_purchase: null, purchase_frequency_per_month: 0, average_gap_days: null,
    payment_status: "Unavailable", payment_statuses: [], open_spend: 0,
  }));
}
async function fetchSupabaseFallback() {
  const fields = ["vendor_source_id", "vendor_name", "vendor_status", "vendor_approval_status", "vendor_country", "bill_count", "total_spend", "spend_share_percent", "payment_hold_count", "payment_hold_amount", "vendor_record_count", "risk_label"].join(",");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/vendor_risk_summary?select=${fields}&order=total_spend.desc.nullslast&limit=2000`, { headers: { Accept: "application/json", apikey: SUPABASE_PUBLISHABLE_KEY } });
  if (!response.ok) throw new Error(`Supabase fallback failed (${response.status})`);
  const vendors = adaptSupabaseRows(await response.json());
  return { metadata: { generated_at: new Date().toISOString(), unique_vendors: vendors.length, vendors_with_purchases: vendors.filter((row) => row.bill_count > 0).length, total_spend: vendors.reduce((sum, row) => sum + row.total_spend, 0), bill_rows: vendors.reduce((sum, row) => sum + row.bill_count, 0) }, vendors };
}
async function fetchDashboardData() {
  try {
    const response = await fetch(DASHBOARD_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Activity snapshot failed (${response.status})`);
    const payload = await response.json();
    if (!Array.isArray(payload.vendors) || !payload.vendors.length) throw new Error("Activity snapshot contains no vendors");
    return { ...payload, source: "snapshot" };
  } catch (snapshotError) {
    console.warn("Vendor activity snapshot unavailable", snapshotError);
    return { ...(await fetchSupabaseFallback()), source: "supabase", snapshotError };
  }
}

function populateFilters() {
  const vendors = [...state.vendors].sort((a, b) => normalized(a.vendor_name).localeCompare(normalized(b.vendor_name))).map((row) => ({ value: text(row.vendor_source_id), label: `${text(row.vendor_name, "Unknown vendor")} · ${text(row.vendor_source_id)}` }));
  replaceOptions(elements.vendorFilter, "All vendors", vendors);
  replaceOptions(elements.paymentStatusFilter, "All payment statuses", uniqueOptions(state.vendors.flatMap((row) => row.payment_statuses || [])));
  replaceOptions(elements.countryFilter, "All countries", uniqueOptions(state.vendors.map((row) => row.vendor_country)));
  replaceOptions(elements.vendorStatusFilter, "All vendor statuses", uniqueOptions(state.vendors.map((row) => row.vendor_status)));
  replaceOptions(elements.approvalFilter, "All approval statuses", uniqueOptions(state.vendors.map((row) => row.vendor_approval_status)));
  replaceOptions(elements.riskFilter, "All risk types", uniqueOptions(state.vendors.map((row) => row.risk_label)));
  state.filtersReady = true;
}
function filterValues() {
  return { vendor: elements.vendorFilter.value, paymentStatus: elements.paymentStatusFilter.value, lastPurchase: elements.lastPurchaseFilter.value, frequency: elements.frequencyFilter.value, gap: elements.gapFilter.value, country: elements.countryFilter.value, vendorStatus: elements.vendorStatusFilter.value, approval: elements.approvalFilter.value, risk: elements.riskFilter.value };
}
function matchesLastPurchase(row, value) {
  if (value === "all") return true;
  if (value === "none") return !row.last_purchase_date;
  if (!row.last_purchase_date) return false;
  const days = number(row.days_since_last_purchase);
  return value === "older" ? days > 365 : days <= number(value);
}
function matchesFrequency(row, value) {
  if (value === "all") return true;
  const frequency = number(row.purchase_frequency_per_month);
  if (value === "high") return frequency >= 4;
  if (value === "regular") return frequency >= 1 && frequency < 4;
  if (value === "occasional") return frequency > 0 && frequency < 1;
  return number(row.bill_count) === 0;
}
function matchesGap(row, value) {
  if (value === "all") return true;
  if (value === "none") return row.average_gap_days === null || row.average_gap_days === undefined;
  if (row.average_gap_days === null || row.average_gap_days === undefined) return false;
  const gap = number(row.average_gap_days);
  if (value === "short") return gap <= 30;
  if (value === "medium") return gap > 30 && gap <= 90;
  return gap > 90;
}
function selectedVendors() {
  const filters = filterValues();
  return state.vendors.filter((row) => {
    if (filters.vendor !== "all" && text(row.vendor_source_id) !== filters.vendor) return false;
    if (filters.paymentStatus !== "all" && !(row.payment_statuses || []).includes(filters.paymentStatus)) return false;
    if (!matchesLastPurchase(row, filters.lastPurchase) || !matchesFrequency(row, filters.frequency) || !matchesGap(row, filters.gap)) return false;
    if (filters.country !== "all" && normalized(row.vendor_country) !== filters.country) return false;
    if (filters.vendorStatus !== "all" && normalized(row.vendor_status) !== filters.vendorStatus) return false;
    if (filters.approval !== "all" && normalized(row.vendor_approval_status) !== filters.approval) return false;
    return filters.risk === "all" || normalized(row.risk_label) === filters.risk;
  });
}

function summarize(rows) {
  const totals = rows.reduce((result, row) => {
    result.spend += number(row.total_spend); result.bills += number(row.bill_count);
    result.openSpend += number(row.open_spend); result.holds += number(row.payment_hold_count);
    result.holdSpend += number(row.payment_hold_amount); result.largestBill = Math.max(result.largestBill, number(row.largest_bill_amount));
    return result;
  }, { spend: 0, bills: 0, openSpend: 0, holds: 0, holdSpend: 0, largestBill: 0 });
  totals.withPurchases = rows.filter((row) => number(row.bill_count) > 0).length;
  totals.withoutPurchases = rows.length - totals.withPurchases;
  const frequencies = rows.filter((row) => number(row.bill_count) > 0).map((row) => number(row.purchase_frequency_per_month));
  totals.averageFrequency = frequencies.length ? frequencies.reduce((sum, value) => sum + value, 0) / frequencies.length : 0;
  totals.medianGap = median(rows.map((row) => row.average_gap_days === null || row.average_gap_days === undefined ? NaN : Number(row.average_gap_days)));
  return totals;
}
function renderMetrics(rows) {
  const totals = summarize(rows);
  const portfolioSpend = number(state.metadata.total_spend) || totals.spend;
  const portfolioShare = portfolioSpend ? (totals.spend / portfolioSpend) * 100 : 0;
  const openShare = totals.spend ? (totals.openSpend / totals.spend) * 100 : 0;
  elements.totalSpend.textContent = compactMoney.format(totals.spend); elements.totalSpend.title = money.format(totals.spend);
  elements.portfolioShare.textContent = `${portfolioShare.toFixed(1)}% of portfolio`;
  elements.totalBills.textContent = wholeNumber.format(totals.bills);
  elements.vendorsWithPurchases.textContent = `${wholeNumber.format(totals.withPurchases)} vendors with purchases`;
  elements.averageBill.textContent = totals.bills ? money.format(totals.spend / totals.bills) : money.format(0);
  elements.largestBill.textContent = `Largest bill ${compactMoney.format(totals.largestBill)}`;
  elements.openSpend.textContent = compactMoney.format(totals.openSpend); elements.openSpend.title = money.format(totals.openSpend);
  elements.openSpendShare.textContent = `${openShare.toFixed(1)}% of selected spend`;
  elements.averageFrequency.textContent = `${decimal.format(totals.averageFrequency)} / mo`;
  elements.medianGap.textContent = totals.medianGap === null ? "n.a." : `${decimal.format(totals.medianGap)} days`;
  elements.paymentHolds.textContent = wholeNumber.format(totals.holds);
  elements.paymentHoldSpend.textContent = `${money.format(totals.holdSpend)} on hold`;
  elements.noPurchaseVendors.textContent = wholeNumber.format(totals.withoutPurchases);
  elements.filteredVendorCount.textContent = wholeNumber.format(rows.length);
  elements.filterResultText.textContent = `of ${wholeNumber.format(state.vendors.length)} vendors in the current view`;
  elements.resetFilters.disabled = !Object.values(filterValues()).some((value) => value !== "all");
}

function renderSpenders(rows) {
  const limit = number(elements.topSpendersCount.value) || 3;
  const ranked = [...rows].filter((row) => number(row.total_spend) > 0).sort((a, b) => number(b.total_spend) - number(a.total_spend)).slice(0, limit);
  const selectedSpend = rows.reduce((sum, row) => sum + number(row.total_spend), 0);
  const maximum = ranked.length ? number(ranked[0].total_spend) : 0;
  elements.spenderList.replaceChildren();
  if (!ranked.length) { elements.spenderList.append(element("li", "loading-row", "No spend matches the current filters.")); return; }
  ranked.forEach((row, index) => {
    const item = element("li", "spender-row");
    const details = element("div", "spender-details");
    const topLine = element("div", "spender-topline");
    const vendor = element("div", "spender-name");
    vendor.append(element("strong", "", text(row.vendor_name, "Unknown vendor")), element("span", "", text(row.vendor_source_id)));
    const amount = element("div", "spender-amount");
    amount.append(element("strong", "", compactMoney.format(number(row.total_spend))), element("span", "", `${wholeNumber.format(number(row.bill_count))} purchases · ${selectedSpend ? ((number(row.total_spend) / selectedSpend) * 100).toFixed(1) : "0.0"}%`));
    topLine.append(vendor, amount);
    const track = element("div", "spender-track"); const bar = element("span", "spender-bar");
    bar.style.width = `${maximum ? (number(row.total_spend) / maximum) * 100 : 0}%`; track.append(bar);
    details.append(topLine, track); item.append(element("span", "spender-rank", String(index + 1)), details);
    elements.spenderList.append(item);
  });
}
function renderSignals(rows) {
  const ranked = [...rows].sort((a, b) => number(b.total_spend) - number(a.total_spend));
  const totalSpend = ranked.reduce((sum, row) => sum + number(row.total_spend), 0);
  const largest = ranked.find((row) => number(row.total_spend) > 0); const topThreeSpend = ranked.slice(0, 3).reduce((sum, row) => sum + number(row.total_spend), 0);
  elements.largestVendorShare.textContent = `${largest && totalSpend ? ((number(largest.total_spend) / totalSpend) * 100).toFixed(1) : "0.0"}%`;
  elements.largestVendorName.textContent = largest ? text(largest.vendor_name) : "No vendor spend";
  elements.topThreeShare.textContent = `${totalSpend ? ((topThreeSpend / totalSpend) * 100).toFixed(1) : "0.0"}%`;
  elements.dormantVendors.textContent = wholeNumber.format(rows.filter((row) => number(row.bill_count) > 0 && number(row.days_since_last_purchase) > 365).length);
  elements.flaggedVendors.textContent = wholeNumber.format(rows.filter((row) => !["normal", "no purchase history"].includes(normalized(row.risk_label).toLowerCase())).length);
}

function compareRows(a, b, key) {
  const aValue = a[key]; const bValue = b[key];
  const aMissing = aValue === null || aValue === undefined || aValue === "";
  const bMissing = bValue === null || bValue === undefined || bValue === "";
  if (aMissing !== bMissing) return aMissing ? 1 : -1;
  let result;
  if (key.includes("date")) result = new Date(aValue).getTime() - new Date(bValue).getTime();
  else if (typeof aValue === "number" || typeof bValue === "number") result = number(aValue) - number(bValue);
  else result = normalized(aValue).localeCompare(normalized(bValue), undefined, { sensitivity: "base" });
  return state.sortDirection === "asc" ? result : -result;
}
function paymentChip(row) {
  const status = text(row.payment_status, "No purchases"); const value = status.toLowerCase();
  let modifier = "payment-chip--paid";
  if (value.includes("open")) modifier = "payment-chip--open";
  else if (value.includes("reject")) modifier = "payment-chip--rejected";
  else if (value.includes("no purchase") || value.includes("unavailable")) modifier = "payment-chip--none";
  return element("span", `payment-chip ${modifier}`, status);
}
function vendorCell(row) {
  const cell = element("td", "vendor-cell");
  cell.append(element("strong", "", text(row.vendor_name, "Unknown vendor")), element("span", "", text(row.vendor_source_id, "No ID")));
  return cell;
}
function renderTable() {
  const sorted = [...state.filtered].sort((a, b) => compareRows(a, b, state.sortBy));
  const pageCount = Math.max(1, Math.ceil(sorted.length / state.pageSize)); state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize; const rows = sorted.slice(start, start + state.pageSize);
  elements.vendorTableBody.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr"); const cell = element("td", "empty-row", "No vendors match the current filters.");
    cell.colSpan = 8; row.append(cell); elements.vendorTableBody.append(row);
  } else rows.forEach((item) => {
    const row = document.createElement("tr"); const paymentCell = document.createElement("td"); paymentCell.append(paymentChip(item));
    row.append(vendorCell(item), paymentCell, element("td", "", formatDate(item.last_purchase_date)), element("td", "numeric-cell", wholeNumber.format(number(item.bill_count))), element("td", "numeric-cell", `${decimal.format(number(item.purchase_frequency_per_month))} / mo`), element("td", "numeric-cell", item.average_gap_days === null || item.average_gap_days === undefined ? "n.a." : `${decimal.format(number(item.average_gap_days))} days`), element("td", "money-cell", item.average_bill_amount === null || item.average_bill_amount === undefined ? "—" : money.format(number(item.average_bill_amount))), element("td", "money-cell", money.format(number(item.total_spend))));
    elements.vendorTableBody.append(row);
  });
  const shownStart = sorted.length ? start + 1 : 0; const shownEnd = Math.min(start + state.pageSize, sorted.length);
  elements.pageSummary.textContent = `Showing ${wholeNumber.format(shownStart)}–${wholeNumber.format(shownEnd)} of ${wholeNumber.format(sorted.length)} vendors · Page ${state.page} of ${pageCount}`;
  elements.previousPage.disabled = state.page <= 1; elements.nextPage.disabled = state.page >= pageCount;
  document.querySelectorAll("th button[data-sort]").forEach((button) => {
    const active = button.dataset.sort === state.sortBy; button.classList.toggle("is-active", active);
    button.setAttribute("aria-sort", active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none");
  });
}
function applyFilters() {
  if (!state.filtersReady) return;
  state.filtered = selectedVendors(); renderMetrics(state.filtered); renderSpenders(state.filtered); renderSignals(state.filtered); renderTable();
}
function showError(message) { elements.errorBanner.hidden = false; elements.errorMessage.textContent = message; }
function setLoading(loading) {
  elements.refreshButton.disabled = loading; elements.refreshButton.classList.toggle("is-loading", loading);
  if (loading) { elements.statusDot.className = "status-dot"; elements.statusText.textContent = "Refreshing"; }
}
async function loadDashboard() {
  setLoading(true); elements.errorBanner.hidden = true;
  try {
    const payload = await fetchDashboardData(); state.metadata = payload.metadata || {}; state.vendors = payload.vendors; state.page = 1;
    populateFilters(); applyFilters(); elements.statusDot.className = "status-dot is-live";
    elements.statusText.textContent = payload.source === "snapshot" ? "Vendor activity snapshot" : "Live summary fallback";
    elements.asOfDate.textContent = state.metadata.as_of_date ? formatDate(state.metadata.as_of_date) : "Latest available";
    elements.sourceNote.textContent = `Vendor-level snapshot built from ${wholeNumber.format(number(state.metadata.matched_bill_rows || state.metadata.bill_rows))} matched bills and ${wholeNumber.format(number(state.metadata.vendor_master_rows || state.vendors.length))} vendor records. Raw invoices are not published.`;
    if (payload.source === "supabase") showError("Purchase-date, payment-status, frequency, and gap metrics require the generated deployment snapshot. Showing the available Supabase summary.");
  } catch (error) {
    console.error("Dashboard data load failed", error); state.vendors = []; state.filtered = [];
    elements.statusDot.className = "status-dot is-offline"; elements.statusText.textContent = "Data unavailable";
    showError(`${error.message}. Run the dashboard data builder or refresh after deployment.`);
    renderMetrics([]); renderSpenders([]); renderSignals([]); renderTable();
  } finally { setLoading(false); }
}

const filters = [elements.vendorFilter, elements.paymentStatusFilter, elements.lastPurchaseFilter, elements.frequencyFilter, elements.gapFilter, elements.countryFilter, elements.vendorStatusFilter, elements.approvalFilter, elements.riskFilter];
filters.forEach((select) => select.addEventListener("change", () => { state.page = 1; applyFilters(); }));
elements.resetFilters.addEventListener("click", () => { filters.forEach((select) => { select.value = "all"; }); state.page = 1; applyFilters(); });
elements.topSpendersCount.addEventListener("change", () => renderSpenders(state.filtered));
elements.sortBy.addEventListener("change", () => { state.sortBy = elements.sortBy.value; state.page = 1; renderTable(); });
elements.sortDirection.addEventListener("change", () => { state.sortDirection = elements.sortDirection.value; state.page = 1; renderTable(); });
elements.pageSize.addEventListener("change", () => { state.pageSize = number(elements.pageSize.value); state.page = 1; renderTable(); });
elements.previousPage.addEventListener("click", () => { if (state.page > 1) state.page -= 1; renderTable(); });
elements.nextPage.addEventListener("click", () => { if (state.page * state.pageSize < state.filtered.length) state.page += 1; renderTable(); });
document.querySelectorAll("th button[data-sort]").forEach((button) => button.addEventListener("click", () => {
  const key = button.dataset.sort;
  if (state.sortBy === key) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  else { state.sortBy = key; state.sortDirection = key === "vendor_name" || key === "payment_status" ? "asc" : "desc"; }
  elements.sortBy.value = state.sortBy; elements.sortDirection.value = state.sortDirection; state.page = 1; renderTable();
}));
elements.refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
