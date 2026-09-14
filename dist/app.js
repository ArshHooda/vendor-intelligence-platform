const SUPABASE_URL = "https://reejwrpxnckikgfefxtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_YiJBi0gdgRpu9-Xhr_0pxg_hQRs9rha";

const API_PATHS = {
  summary: "/rest/v1/dashboard_summary?select=*",
  vendors:
    "/rest/v1/vendor_risk_summary?select=vendor_source_id,vendor_name,vendor_status,vendor_approval_status,vendor_country,bill_count,total_spend,spend_share_percent,payment_hold_count,payment_hold_amount,vendor_record_count,risk_label&order=total_spend.desc.nullslast&limit=1000",
  holds: "/rest/v1/payment_hold_summary?select=*",
};

const VERIFIED_SNAPSHOT = {
  summary: [
    {
      total_bills: 13360,
      vendors_with_bills: 874,
      total_spend: 283563244.54,
      average_bill_amount: 21224.793752994012,
      largest_bill_amount: 4468780.5,
      payment_hold_bill_count: 23,
      payment_hold_spend: 94369.7,
    },
  ],
  vendors: [
    {
      vendor_source_id: "VEN01556",
      vendor_name: "Syneos Health Clinical, Inc. (dba Syneos Health, LLC)",
      vendor_status: "Active",
      vendor_approval_status: "Approved",
      vendor_country: "United States",
      bill_count: 210,
      total_spend: 109451708.12,
      spend_share_percent: 38.6,
      payment_hold_count: 0,
      payment_hold_amount: 0,
      vendor_record_count: 1,
      risk_label: "High concentration",
    },
    {
      vendor_source_id: "VEN01627",
      vendor_name: "The Leadership Edge, Inc.",
      vendor_status: "Active",
      vendor_approval_status: "Approved",
      vendor_country: "United States",
      bill_count: 3,
      total_spend: 160900,
      spend_share_percent: 0.06,
      payment_hold_count: 0,
      payment_hold_amount: 0,
      vendor_record_count: 2,
      risk_label: "Duplicate vendor record",
    },
    {
      vendor_source_id: "VEN02334",
      vendor_name: "Element Materials Technology Bend, LLC (NA)",
      vendor_status: "Active",
      vendor_approval_status: "Pending Approval",
      vendor_country: "United States",
      bill_count: 1,
      total_spend: 32630,
      spend_share_percent: 0.01,
      payment_hold_count: 1,
      payment_hold_amount: 32630,
      vendor_record_count: 1,
      risk_label: "Payment hold",
    },
  ],
  holds: [
    {
      payment_hold_reason: "Pending Vendor Approval",
      bill_count: 23,
      total_amount: 94369.7,
      earliest_bill_date: "2025-12-29",
      latest_bill_date: "2026-07-30",
    },
  ],
};

const state = { summary: [], vendors: [], holds: [], filtersReady: false };

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  updatedAt: document.querySelector("#updatedAt"),
  errorBanner: document.querySelector("#errorBanner"),
  errorMessage: document.querySelector("#errorMessage"),
  vendorFilter: document.querySelector("#vendorFilter"),
  countryFilter: document.querySelector("#countryFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  approvalFilter: document.querySelector("#approvalFilter"),
  riskFilter: document.querySelector("#riskFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  filteredVendorCount: document.querySelector("#filteredVendorCount"),
  filterResultText: document.querySelector("#filterResultText"),
  totalSpend: document.querySelector("#totalSpend"),
  totalBills: document.querySelector("#totalBills"),
  vendorsWithBills: document.querySelector("#vendorsWithBills"),
  paymentHolds: document.querySelector("#paymentHolds"),
  averageBill: document.querySelector("#averageBill"),
  largestBill: document.querySelector("#largestBill"),
  paymentHoldSpend: document.querySelector("#paymentHoldSpend"),
  topVendorShare: document.querySelector("#topVendorShare"),
  topVendorName: document.querySelector("#topVendorName"),
  topVendorSpend: document.querySelector("#topVendorSpend"),
  concentrationProgress: document.querySelector("#concentrationProgress"),
  concentrationBar: document.querySelector("#concentrationBar"),
  concentrationNote: document.querySelector("#concentrationNote"),
  concentrationChip: document.querySelector("#concentrationChip"),
  holdCountChip: document.querySelector("#holdCountChip"),
  holdAmount: document.querySelector("#holdAmount"),
  holdReason: document.querySelector("#holdReason"),
  earliestHold: document.querySelector("#earliestHold"),
  latestHold: document.querySelector("#latestHold"),
  topVendorsNote: document.querySelector("#topVendorsNote"),
  riskResultsNote: document.querySelector("#riskResultsNote"),
  topVendorsBody: document.querySelector("#topVendorsBody"),
  riskQueueBody: document.querySelector("#riskQueueBody"),
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const wholeNumber = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function requestHeaders() {
  const headers = { Accept: "application/json", apikey: SUPABASE_PUBLISHABLE_KEY };
  if (SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }
  return headers;
}

async function fetchView(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers: requestHeaders() });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message || body.hint || "";
    } catch {
      detail = "";
    }
    throw new Error(detail || `Supabase request failed (${response.status})`);
  }
  return response.json();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalize(value) {
  return safeText(value, "Not specified").trim();
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? safeText(value) : dateFormatter.format(parsed);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function vendorCell(row) {
  const cell = createElement("td", "vendor-cell");
  cell.append(
    createElement("strong", "", safeText(row.vendor_name, "Unknown vendor")),
    createElement("span", "", safeText(row.vendor_source_id, "No vendor ID")),
  );
  return cell;
}

function replaceOptions(select, placeholder, options) {
  const previousValue = select.value;
  select.replaceChildren(new Option(placeholder, "all"));
  options.forEach(({ value, label }) => select.add(new Option(label, value)));
  if ([...select.options].some((option) => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function uniqueOptions(rows, key) {
  return [...new Set(rows.map((row) => normalize(row[key])))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
}

function populateFilters() {
  const vendors = [...state.vendors]
    .sort((a, b) => normalize(a.vendor_name).localeCompare(normalize(b.vendor_name)))
    .map((row) => ({
      value: safeText(row.vendor_source_id),
      label: `${safeText(row.vendor_name, "Unknown vendor")} · ${safeText(row.vendor_source_id)}`,
    }));

  replaceOptions(elements.vendorFilter, "All vendors", vendors);
  replaceOptions(elements.countryFilter, "All countries", uniqueOptions(state.vendors, "vendor_country"));
  replaceOptions(elements.statusFilter, "All statuses", uniqueOptions(state.vendors, "vendor_status"));
  replaceOptions(
    elements.approvalFilter,
    "All approval statuses",
    uniqueOptions(state.vendors, "vendor_approval_status"),
  );
  replaceOptions(
    elements.riskFilter,
    "All risk types",
    uniqueOptions(state.vendors, "risk_label").filter(
      ({ value }) => value.toLowerCase() !== "normal",
    ),
  );
  state.filtersReady = true;
}

function currentFilters() {
  return {
    vendor: elements.vendorFilter.value,
    country: elements.countryFilter.value,
    status: elements.statusFilter.value,
    approval: elements.approvalFilter.value,
    risk: elements.riskFilter.value,
  };
}

function isFiltered(filters) {
  return Object.values(filters).some((value) => value !== "all");
}

function filteredVendors() {
  const filters = currentFilters();
  return state.vendors.filter((row) => {
    if (filters.vendor !== "all" && safeText(row.vendor_source_id) !== filters.vendor) return false;
    if (filters.country !== "all" && normalize(row.vendor_country) !== filters.country) return false;
    if (filters.status !== "all" && normalize(row.vendor_status) !== filters.status) return false;
    if (filters.approval !== "all" && normalize(row.vendor_approval_status) !== filters.approval) return false;
    if (filters.risk !== "all" && normalize(row.risk_label) !== filters.risk) return false;
    return true;
  });
}

function summarize(rows) {
  return rows.reduce(
    (totals, row) => {
      totals.totalSpend += asNumber(row.total_spend);
      totals.totalBills += asNumber(row.bill_count);
      totals.paymentHoldCount += asNumber(row.payment_hold_count);
      totals.paymentHoldSpend += asNumber(row.payment_hold_amount);
      return totals;
    },
    { totalSpend: 0, totalBills: 0, paymentHoldCount: 0, paymentHoldSpend: 0 },
  );
}

function renderSummary(rows) {
  const totals = summarize(rows);
  const filters = currentFilters();
  const fullSummary = state.summary[0] || {};
  const average = totals.totalBills ? totals.totalSpend / totals.totalBills : 0;
  const portfolioSpend = asNumber(fullSummary.total_spend);
  const portfolioShare = portfolioSpend ? (totals.totalSpend / portfolioSpend) * 100 : 0;

  elements.totalSpend.textContent = compactMoney.format(totals.totalSpend);
  elements.totalSpend.title = money.format(totals.totalSpend);
  elements.totalBills.textContent = wholeNumber.format(totals.totalBills);
  elements.vendorsWithBills.textContent = wholeNumber.format(rows.length);
  elements.paymentHolds.textContent = wholeNumber.format(totals.paymentHoldCount);
  elements.averageBill.textContent = `Average bill ${money.format(average)}`;
  elements.largestBill.textContent = isFiltered(filters)
    ? `${portfolioShare.toFixed(1)}% of portfolio spend`
    : `Largest bill ${compactMoney.format(asNumber(fullSummary.largest_bill_amount))}`;
  elements.paymentHoldSpend.textContent = `${money.format(totals.paymentHoldSpend)} on hold`;
  elements.filteredVendorCount.textContent = wholeNumber.format(rows.length);
  elements.filterResultText.textContent = `of ${wholeNumber.format(
    state.vendors.length,
  )} vendors in the current view`;
  elements.resetFilters.disabled = !isFiltered(filters);
}

function setConcentrationChip(share) {
  elements.concentrationChip.className = "risk-chip";
  if (share >= 25) {
    elements.concentrationChip.classList.add("risk-chip--high");
    elements.concentrationChip.textContent = "High attention";
  } else if (share >= 10) {
    elements.concentrationChip.classList.add("risk-chip--medium");
    elements.concentrationChip.textContent = "Monitor";
  } else {
    elements.concentrationChip.classList.add("risk-chip--neutral");
    elements.concentrationChip.textContent = "Diversified";
  }
}

function renderConcentration(rows) {
  const ranked = [...rows].sort((a, b) => asNumber(b.total_spend) - asNumber(a.total_spend));
  const totalSpend = ranked.reduce((total, row) => total + asNumber(row.total_spend), 0);
  const topVendor = ranked[0];

  if (!topVendor || totalSpend <= 0) {
    elements.topVendorShare.textContent = "—";
    elements.topVendorName.textContent = "No vendors match these filters";
    elements.topVendorSpend.textContent = money.format(0);
    elements.concentrationProgress.setAttribute("aria-valuenow", "0");
    elements.concentrationBar.style.width = "0%";
    elements.concentrationNote.textContent = "Change or clear a filter to continue.";
    setConcentrationChip(0);
    return;
  }

  const share = (asNumber(topVendor.total_spend) / totalSpend) * 100;
  const topFiveSpend = ranked.slice(0, 5).reduce((total, row) => total + asNumber(row.total_spend), 0);
  const topFiveShare = (topFiveSpend / totalSpend) * 100;

  elements.topVendorShare.textContent = `${share.toFixed(1)}%`;
  elements.topVendorName.textContent = safeText(topVendor.vendor_name);
  elements.topVendorSpend.textContent = money.format(asNumber(topVendor.total_spend));
  elements.concentrationProgress.setAttribute("aria-valuenow", String(share));
  elements.concentrationBar.style.width = `${Math.min(Math.max(share, 0), 100)}%`;
  elements.concentrationNote.textContent = `The five largest vendors represent ${topFiveShare.toFixed(
    1,
  )}% of spend in this selection.`;
  setConcentrationChip(share);
}

function renderTopVendors(rows) {
  const ranked = [...rows]
    .sort((a, b) => asNumber(b.total_spend) - asNumber(a.total_spend))
    .slice(0, 10);
  const selectedSpend = rows.reduce((total, row) => total + asNumber(row.total_spend), 0);
  elements.topVendorsBody.replaceChildren();
  elements.topVendorsNote.textContent = `Showing ${wholeNumber.format(ranked.length)} of ${wholeNumber.format(
    rows.length,
  )} matching vendors`;

  if (!ranked.length) {
    const row = document.createElement("tr");
    const cell = createElement("td", "empty-row", "No vendors match the current filters.");
    cell.colSpan = 4;
    row.append(cell);
    elements.topVendorsBody.append(row);
    return;
  }

  ranked.forEach((item) => {
    const share = selectedSpend ? (asNumber(item.total_spend) / selectedSpend) * 100 : 0;
    const row = document.createElement("tr");
    row.append(
      vendorCell(item),
      createElement("td", "", wholeNumber.format(asNumber(item.bill_count))),
      createElement("td", "money-cell", money.format(asNumber(item.total_spend))),
      createElement("td", "share-cell", `${share.toFixed(2)}%`),
    );
    elements.topVendorsBody.append(row);
  });
}

function riskClass(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("concentration")) return "risk-chip risk-chip--high";
  if (normalized.includes("hold")) return "risk-chip risk-chip--medium";
  return "risk-chip risk-chip--neutral";
}

function riskPriority(row) {
  const label = normalize(row.risk_label).toLowerCase();
  if (label.includes("concentration")) return 0;
  if (label.includes("hold")) return 1;
  if (label.includes("duplicate")) return 2;
  return 3;
}

function renderRisks(rows) {
  const risks = rows
    .filter((row) => normalize(row.risk_label).toLowerCase() !== "normal")
    .sort((a, b) => {
      const priority = riskPriority(a) - riskPriority(b);
      if (priority) return priority;
      const exposureA = asNumber(a.payment_hold_amount) || asNumber(a.total_spend);
      const exposureB = asNumber(b.payment_hold_amount) || asNumber(b.total_spend);
      return exposureB - exposureA;
    });

  elements.riskQueueBody.replaceChildren();
  elements.riskResultsNote.textContent = `${wholeNumber.format(risks.length)} flagged vendor${
    risks.length === 1 ? "" : "s"
  } in this selection`;

  if (!risks.length) {
    const row = document.createElement("tr");
    const cell = createElement("td", "empty-row", "No flagged vendor risks match the current filters.");
    cell.colSpan = 5;
    row.append(cell);
    elements.riskQueueBody.append(row);
    return;
  }

  risks.forEach((item) => {
    const row = document.createElement("tr");
    const risk = document.createElement("td");
    risk.append(createElement("span", riskClass(item.risk_label), safeText(item.risk_label)));
    const status = createElement(
      "span",
      `status-label${String(item.vendor_status).toLowerCase() === "inactive" ? " is-inactive" : ""}`,
      safeText(item.vendor_approval_status, safeText(item.vendor_status)),
    );
    const statusCell = document.createElement("td");
    statusCell.append(status);
    const exposure = asNumber(item.payment_hold_amount) || asNumber(item.total_spend);

    row.append(
      risk,
      vendorCell(item),
      statusCell,
      createElement("td", "", wholeNumber.format(asNumber(item.bill_count))),
      createElement("td", "money-cell", money.format(exposure)),
    );
    elements.riskQueueBody.append(row);
  });
}

function renderHolds(rows) {
  const totals = summarize(rows);
  const hold = state.holds[0];
  elements.holdCountChip.textContent = `${wholeNumber.format(totals.paymentHoldCount)} bills`;
  elements.holdAmount.textContent = money.format(totals.paymentHoldSpend);

  if (!totals.paymentHoldCount) {
    elements.holdReason.textContent = "No payment holds in this selection";
    elements.earliestHold.textContent = "—";
    elements.latestHold.textContent = "—";
    return;
  }

  elements.holdReason.textContent = safeText(hold?.payment_hold_reason, "Pending Vendor Approval");
  elements.earliestHold.textContent = formatDate(hold?.earliest_bill_date);
  elements.latestHold.textContent = formatDate(hold?.latest_bill_date);
}

function applyFilters() {
  if (!state.filtersReady) return;
  const rows = filteredVendors();
  renderSummary(rows);
  renderConcentration(rows);
  renderTopVendors(rows);
  renderRisks(rows);
  renderHolds(rows);
}

function renderDashboard(data) {
  state.summary = data.summary;
  state.vendors = data.vendors;
  state.holds = data.holds;
  populateFilters();
  applyFilters();
}

function setLoading(isLoading) {
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.classList.toggle("is-loading", isLoading);
  if (isLoading) {
    elements.statusDot.className = "status-dot";
    elements.statusText.textContent = "Refreshing";
  }
}

async function loadDashboard() {
  setLoading(true);
  elements.errorBanner.hidden = true;
  try {
    const [summary, vendors, holds] = await Promise.all([
      fetchView(API_PATHS.summary),
      fetchView(API_PATHS.vendors),
      fetchView(API_PATHS.holds),
    ]);
    renderDashboard({ summary, vendors, holds });
    elements.statusDot.className = "status-dot is-live";
    elements.statusText.textContent = "Live data";
    elements.updatedAt.textContent = `Updated ${new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date())}`;
  } catch (error) {
    console.error("Dashboard data load failed", error);
    renderDashboard(VERIFIED_SNAPSHOT);
    elements.statusDot.className = "status-dot is-offline";
    elements.statusText.textContent = "Verified snapshot";
    elements.updatedAt.textContent = "Snapshot verified September 14, 2026";
    elements.errorBanner.hidden = false;
    elements.errorMessage.textContent = `${error.message} Showing the last verified snapshot.`;
  } finally {
    setLoading(false);
  }
}

[
  elements.vendorFilter,
  elements.countryFilter,
  elements.statusFilter,
  elements.approvalFilter,
  elements.riskFilter,
].forEach((select) => select.addEventListener("change", applyFilters));

elements.resetFilters.addEventListener("click", () => {
  [
    elements.vendorFilter,
    elements.countryFilter,
    elements.statusFilter,
    elements.approvalFilter,
    elements.riskFilter,
  ].forEach((select) => {
    select.value = "all";
  });
  applyFilters();
});

elements.refreshButton.addEventListener("click", loadDashboard);
loadDashboard();
